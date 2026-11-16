import { BOARDS, getBoardInstances, getBoardPin, resolveNodeBoardId } from './boards'
import type {
  BoardId,
  CircuitDiagnosticItem,
  GpioRuntime,
  HardwareAlert,
  MqttMessage,
  PlacedComponent,
  SerialEntry,
  SimulationState,
  Wire,
  WireEndpoint,
} from './types'

interface ParsedStatement {
  line: number
  kind: 'call' | 'assign' | 'if' | 'delay'
  raw: string
  target?: string
  expr?: string
  cond?: string
  thenBody?: ParsedStatement[]
  elseBody?: ParsedStatement[]
}

export interface CompiledSketch {
  defines: Record<string, number>
  setupStmts: ParsedStatement[]
  loopStmts: ParsedStatement[]
  servoPins: number[]
  compileError: string | null
}

function stripComments(line: string): string {
  let out = ''
  let inStr = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"' && line[i - 1] !== '\\') inStr = !inStr
    if (!inStr && line[i] === '/' && line[i + 1] === '/') break
    out += line[i]
  }
  return out.trim()
}

function splitArgs(raw: string): string[] {
  const args: string[] = []
  let depth = 0
  let inStr = false
  let cur = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '"' && raw[i - 1] !== '\\') inStr = !inStr
    if (!inStr) {
      if (ch === '(') depth++
      else if (ch === ')') depth = Math.max(0, depth - 1)
      else if (ch === ',' && depth === 0) {
        args.push(cur.trim())
        cur = ''
        continue
      }
    }
    cur += ch
  }
  if (cur.trim()) args.push(cur.trim())
  return args
}

function parseStatements(lines: Array<{ text: string; num: number }>): ParsedStatement[] {
  const stmts: ParsedStatement[] = []
  let i = 0
  while (i < lines.length) {
    const { text, num } = lines[i]
    if (!text) {
      i++
      continue
    }
    if (text.startsWith('if ') || text.startsWith('if(')) {
      const condMatch = /^if\s*\((.+)\)\s*\{?$/.exec(text)
      const cond = condMatch?.[1] ?? 'true'
      const thenLines: Array<{ text: string; num: number }> = []
      const elseLines: Array<{ text: string; num: number }> = []
      let depth = (text.match(/\{/g) ?? []).length - (text.match(/\}/g) ?? []).length
      i++
      let inElse = false
      while (i < lines.length && depth > 0) {
        const cur = lines[i].text
        if (/^\}\s*else\s*\{$/.test(cur) && depth === 1) {
          inElse = true
          i++
          continue
        }
        const opens = (cur.match(/\{/g) ?? []).length
        const closes = (cur.match(/\}/g) ?? []).length
        const nextDepth = depth + opens - closes
        if (nextDepth <= 0) {
          i++
          break
        }
        if (inElse) elseLines.push(lines[i])
        else thenLines.push(lines[i])
        depth = nextDepth
        i++
      }
      stmts.push({
        line: num,
        kind: 'if',
        raw: text,
        cond,
        thenBody: parseStatements(thenLines),
        elseBody: parseStatements(elseLines),
      })
      continue
    }

    // Split multiple semicolon-separated statements on one line
    const parts: string[] = []
    let cur = ''
    let inStr = false
    for (let k = 0; k < text.length; k++) {
      const ch = text[k]
      if (ch === '"' && text[k - 1] !== '\\') inStr = !inStr
      if (!inStr && ch === ';') {
        if (cur.trim()) parts.push(cur.trim())
        cur = ''
      } else {
        cur += ch
      }
    }
    if (cur.trim()) parts.push(cur.trim())

    for (const part of parts) {
      if (part === '}' || part === '{') continue
      const delayM = /^delay\(\s*(.+)\s*\)$/.exec(part)
      if (delayM) {
        stmts.push({ line: num, kind: 'delay', raw: part, expr: delayM[1] })
        continue
      }
      const assignM = /^(?:int|float|double|long|bool|boolean|String|const\s+int)?\s*([a-zA-Z_]\w*)\s*=\s*(.+)$/.exec(part)
      if (assignM && !part.includes('==')) {
        stmts.push({ line: num, kind: 'assign', raw: part, target: assignM[1], expr: assignM[2] })
        continue
      }
      stmts.push({ line: num, kind: 'call', raw: part })
    }
    i++
  }
  return stmts
}

export function compileArduinoSketch(code: string): CompiledSketch {
  const rawLines = code.split('\n')
  const defines: Record<string, number> = {
    HIGH: 1,
    LOW: 0,
    INPUT: 0,
    OUTPUT: 1,
    INPUT_PULLUP: 2,
    true: 1,
    false: 0,
    LED_BUILTIN: 8,
  }
  const setupLines: Array<{ text: string; num: number }> = []
  const loopLines: Array<{ text: string; num: number }> = []
  let mode: 'top' | 'setup' | 'loop' = 'top'
  let braceDepth = 0
  let hasSetup = false
  let hasLoop = false

  for (let idx = 0; idx < rawLines.length; idx++) {
    const clean = stripComments(rawLines[idx])
    if (!clean) continue
    if (clean.startsWith('#include')) continue
    const defM = /^#define\s+([A-Za-z_]\w*)\s+([0-9.-]+)/.exec(clean)
    if (defM) {
      defines[defM[1]] = Number(defM[2])
      continue
    }
    if (mode === 'top') {
      const constM = /^(?:const\s+)?int\s+([A-Za-z_]\w*)\s*=\s*([0-9.-]+)\s*;/.exec(clean)
      if (constM) {
        defines[constM[1]] = Number(constM[2])
        continue
      }
      if (/^void\s+setup\s*\(/.test(clean)) {
        hasSetup = true
        mode = 'setup'
        braceDepth = (clean.match(/\{/g) ?? []).length - (clean.match(/\}/g) ?? []).length
        continue
      }
      if (/^void\s+loop\s*\(/.test(clean)) {
        hasLoop = true
        mode = 'loop'
        braceDepth = (clean.match(/\{/g) ?? []).length - (clean.match(/\}/g) ?? []).length
        continue
      }
      continue
    }

    const opens = (clean.match(/\{/g) ?? []).length
    const closes = (clean.match(/\}/g) ?? []).length
    braceDepth += opens - closes
    if (braceDepth <= 0) {
      mode = 'top'
      braceDepth = 0
      continue
    }
    if (mode === 'setup') setupLines.push({ text: clean, num: idx + 1 })
    else if (mode === 'loop') loopLines.push({ text: clean, num: idx + 1 })
  }

  if (!hasSetup || !hasLoop) {
    return {
      defines,
      setupStmts: [],
      loopStmts: [],
      servoPins: [],
      compileError: !hasSetup
        ? 'Compile Error: Fungsi `void setup()` tidak ditemukan pada sketch.'
        : 'Compile Error: Fungsi `void loop()` tidak ditemukan pada sketch.',
    }
  }

  return {
    defines,
    setupStmts: parseStatements(setupLines),
    loopStmts: parseStatements(loopLines),
    servoPins: [],
    compileError: null,
  }
}

interface NetGraph {
  adj: Map<string, WireEndpoint[]>
}

function epKey(e: WireEndpoint): string {
  return `${e.nodeId}:${e.pinId}`
}

function buildNetGraph(wires: Wire[], components: PlacedComponent[]): NetGraph {
  const adj = new Map<string, WireEndpoint[]>()
  const addEdge = (a: WireEndpoint, b: WireEndpoint) => {
    const ka = epKey(a)
    const kb = epKey(b)
    adj.set(ka, [...(adj.get(ka) ?? []), b])
    adj.set(kb, [...(adj.get(kb) ?? []), a])
  }
  for (const w of wires) addEdge(w.from, w.to)
  // Resistors & breadboard terminal pairs conduct across their linked pins
  for (const c of components) {
    if (c.kind === 'resistor') {
      addEdge({ nodeId: c.id, pinId: 'P1' }, { nodeId: c.id, pinId: 'P2' })
    } else if (c.kind === 'breadboard') {
      addEdge({ nodeId: c.id, pinId: 'A1' }, { nodeId: c.id, pinId: 'A2' })
      addEdge({ nodeId: c.id, pinId: 'B1' }, { nodeId: c.id, pinId: 'B2' })
    }
  }
  return { adj }
}

function traceReachable(
  graph: NetGraph,
  start: WireEndpoint,
  components: PlacedComponent[] = [],
): { endpoints: WireEndpoint[]; crossedResistor: boolean; minResistorOhms: number | null } {
  const visited = new Set<string>([epKey(start)])
  const queue: WireEndpoint[] = [start]
  const endpoints: WireEndpoint[] = []
  let crossedResistor = false
  let minResistorOhms: number | null = null

  while (queue.length > 0) {
    const cur = queue.shift()!
    endpoints.push(cur)
    const neighbors = graph.adj.get(epKey(cur)) ?? []
    for (const next of neighbors) {
      if (next.nodeId === cur.nodeId) {
        crossedResistor = true
        const comp = components.find((c) => c.id === cur.nodeId)
        if (comp?.kind === 'resistor') {
          const val = comp.ohms ?? 220
          minResistorOhms = minResistorOhms === null ? val : Math.min(minResistorOhms, val)
        }
      }
      const nk = epKey(next)
      if (!visited.has(nk)) {
        visited.add(nk)
        queue.push(next)
      }
    }
  }
  return { endpoints, crossedResistor, minResistorOhms }
}

export function analyzeCircuitSafety(
  boardId: BoardId,
  components: PlacedComponent[],
  wires: Wire[],
): HardwareAlert[] {
  const alerts: HardwareAlert[] = []
  const graph = buildNetGraph(wires, components)
  const boardNodes = getBoardInstances(boardId, components)

  // Check Power <-> GND direct short circuit across every placed MCU
  for (const inst of boardNodes) {
    const board = BOARDS[inst.boardId]
    const powerPins = board.pins.filter((p) => p.kind === 'power')
    const gndPins = board.pins.filter((p) => p.kind === 'gnd')
    for (const pwr of powerPins) {
      const reach = traceReachable(graph, { nodeId: inst.nodeId, pinId: pwr.id }, components)
      const hitsGnd = reach.endpoints.some((e) => {
        const eb = resolveNodeBoardId(boardId, components, e.nodeId)
        if (!eb) return false
        return getBoardPin(eb, e.pinId)?.kind === 'gnd' || (e.nodeId === inst.nodeId && gndPins.some((g) => g.id === e.pinId))
      })
      if (hitsGnd && !reach.crossedResistor) {
        alerts.push({
          id: `short-${inst.nodeId}-${pwr.id}`,
          severity: 'error',
          messageId: `Short-Circuit (${inst.label})! Jalur ${pwr.label} terhubung langsung ke GND tanpa beban/resistor.`,
          messageEn: `Short-Circuit (${inst.label})! ${pwr.label} is wired directly to GND without a load or resistor.`,
        })
      }
      if (pwr.voltage === 5 && board.logicVoltage === 3.3) {
        const hitsGpio = reach.endpoints.some((e) => {
          const eb = resolveNodeBoardId(boardId, components, e.nodeId)
          if (!eb) return false
          const bp = getBoardPin(eb, e.pinId)
          return bp && bp.gpio !== undefined && BOARDS[eb].logicVoltage === 3.3
        })
        if (hitsGpio) {
          alerts.push({
            id: `overvolt-${inst.nodeId}-${pwr.id}`,
            severity: 'error',
            messageId: `Bahaya Tegangan 5V! Pin 5V tidak boleh disambung ke GPIO 3.3V pada ${inst.label}.`,
            messageEn: `5V Over-Voltage! 5V rail must not connect to a 3.3V GPIO pin on ${inst.label}.`,
          })
        }
      }
    }
  }

  // Check LED missing or undersized current-limiting resistor
  for (const c of components) {
    if (c.kind === 'led') {
      const reachA = traceReachable(graph, { nodeId: c.id, pinId: 'A' }, components)
      const hitsSource = reachA.endpoints.some((e) => resolveNodeBoardId(boardId, components, e.nodeId) !== null)
      if (hitsSource && !reachA.crossedResistor) {
        alerts.push({
          id: `no-res-${c.id}`,
          severity: 'warn',
          messageId: `${c.label} belum memakai resistor seri (220Ω). Tambahkan resistor agar arus aman.`,
          messageEn: `${c.label} lacks a series 220Ω resistor. Add one to limit LED current.`,
        })
      } else if (hitsSource && reachA.minResistorOhms !== null && reachA.minResistorOhms < 47) {
        alerts.push({
          id: `low-res-${c.id}`,
          severity: 'warn',
          messageId: `Nilai resistor seri pada ${c.label} terlalu kecil (${reachA.minResistorOhms}Ω < 47Ω) — berisiko arus berlebih!`,
          messageEn: `Series resistor on ${c.label} is too low (${reachA.minResistorOhms}Ω < 47Ω) — risk of over-current!`,
        })
      }
    }
  }

  return alerts
}

export interface VmContext {
  boardId: BoardId
  sketch: CompiledSketch
  vars: Record<string, number | string>
  sim: SimulationState
  servoPinMap: Record<string, number>
  serialRxQueue: string[]
  oledBuffer: string[]
  oledStarted: boolean
  loopIterations: number
  loopCursor: number
  graph: NetGraph
}

export function createInitialSimulation(
  boardId: BoardId,
  components: PlacedComponent[],
  wires: Wire[],
): SimulationState {
  const gpioStates: Record<number, GpioRuntime> = {}
  for (const p of BOARDS[boardId].pins) {
    if (p.gpio !== undefined) {
      gpioStates[p.gpio] = { gpio: p.gpio, mode: 'INPUT', digital: 0, pwmDuty: 0, adcValue: 0, voltage: 0 }
    }
  }
  return {
    running: false,
    elapsedMs: 0,
    compileError: null,
    gpioStates,
    ledBrightness: {},
    servoAngles: {},
    buzzerActive: {},
    relayClosed: {},
    oledLines: {},
    lcdRows: {},
    serialLog: [],
    plotHistory: [],
    logicHistory: [],
    mqttMessages: [],
    wifiConnected: false,
    wifiIp: '0.0.0.0',
    alerts: analyzeCircuitSafety(boardId, components, wires),
  }
}

export function createVmContext(
  boardId: BoardId,
  sketch: CompiledSketch,
  components: PlacedComponent[],
  wires: Wire[],
): VmContext {
  const sim = createInitialSimulation(boardId, components, wires)
  return {
    boardId,
    sketch,
    vars: { ...sketch.defines },
    sim,
    servoPinMap: {},
    serialRxQueue: [],
    oledBuffer: [],
    oledStarted: false,
    loopIterations: 0,
    loopCursor: 0,
    graph: buildNetGraph(wires, components),
  }
}

function gpioPinIds(boardId: BoardId, gpio: number): string[] {
  return BOARDS[boardId].pins.filter((p) => p.gpio === gpio).map((p) => p.id)
}

function findConnectedComponent(
  ctx: VmContext,
  components: PlacedComponent[],
  gpio: number,
  kind?: PlacedComponent['kind'],
): PlacedComponent | undefined {
  for (const pid of gpioPinIds(ctx.boardId, gpio)) {
    const reach = traceReachable(ctx.graph, { nodeId: 'board', pinId: pid })
    for (const ep of reach.endpoints) {
      if (ep.nodeId === 'board') continue
      const comp = components.find((c) => c.id === ep.nodeId && (!kind || c.kind === kind))
      if (comp) return comp
    }
  }
  return undefined
}

function isSingleStringLiteral(s: string): boolean {
  if (!s.startsWith('"') || !s.endsWith('"') || s.length < 2) return false
  for (let i = 1; i < s.length - 1; i++) {
    if (s[i] === '"' && s[i - 1] !== '\\') return false
  }
  return true
}

function evalExpr(
  raw: string,
  ctx: VmContext,
  components: PlacedComponent[],
): number | string {
  const s = raw.trim()
  if (isSingleStringLiteral(s)) {
    return s.slice(1, -1).replace(/\\"/g, '"')
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  if (s in ctx.vars) return ctx.vars[s]

  // String concatenation (+)
  if (s.includes('"') && s.includes('+')) {
    const parts: string[] = []
    let cur = ''
    let inStr = false
    let depth = 0
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]
      if (ch === '"' && s[i - 1] !== '\\') inStr = !inStr
      if (!inStr) {
        if (ch === '(') depth++
        else if (ch === ')') depth--
        else if (ch === '+' && depth === 0) {
          parts.push(cur.trim())
          cur = ''
          continue
        }
      }
      cur += ch
    }
    if (cur.trim()) parts.push(cur.trim())
    if (parts.length > 1) {
      return parts.map((p) => String(evalExpr(p, ctx, components))).join('')
    }
  }

  // String(...)
  const strM = /^String\((.+)\)$/.exec(s)
  if (strM) {
    const inner = evalExpr(strM[1], ctx, components)
    return typeof inner === 'number' ? String(Math.round(inner * 10) / 10) : String(inner)
  }

  // Ternary a ? b : c
  if (s.includes('?') && s.includes(':')) {
    const qIdx = s.indexOf('?')
    const cIdx = s.lastIndexOf(':')
    if (qIdx > 0 && cIdx > qIdx) {
      const cond = evalBool(s.slice(0, qIdx), ctx, components)
      return evalExpr(cond ? s.slice(qIdx + 1, cIdx) : s.slice(cIdx + 1), ctx, components)
    }
  }

  // Hardware function calls
  const callM = /^([a-zA-Z_][a-zA-Z0-9_.]*)\((.*)\)$/.exec(s)
  if (callM) {
    const fn = callM[1]
    const args = splitArgs(callM[2]).map((a) => evalExpr(a, ctx, components))
    if (fn === 'millis') return ctx.sim.elapsedMs
    if (fn === 'Serial.available') return ctx.serialRxQueue.length
    if (fn === 'Serial.readString') return ctx.serialRxQueue.shift() ?? ''
    if (fn === 'digitalRead') {
      const gpio = Number(args[0] ?? 0)
      const btn = findConnectedComponent(ctx, components, gpio, 'pushbutton') ?? findConnectedComponent(ctx, components, gpio, 'slide-switch')
      if (btn) return btn.props.pressed || btn.props.latched ? 0 : 1
      const pir = findConnectedComponent(ctx, components, gpio, 'pir')
      if (pir) return pir.props.motion ? 1 : 0
      return ctx.sim.gpioStates[gpio]?.digital ?? 0
    }
    if (fn === 'analogRead') {
      const gpio = Number(args[0] ?? 0)
      const maxAdc = BOARDS[ctx.boardId].logicVoltage === 5 ? 1023 : 4095
      const pot = findConnectedComponent(ctx, components, gpio, 'potentiometer') ?? findConnectedComponent(ctx, components, gpio, 'slide-pot')
      if (pot) return Math.round(((pot.props.potPct ?? 50) / 100) * maxAdc)
      const joy = findConnectedComponent(ctx, components, gpio, 'joystick')
      if (joy) return Math.round(((joy.props.joyX ?? 512) / 1023) * maxAdc)
      const ldr = findConnectedComponent(ctx, components, gpio, 'ldr')
      if (ldr) return Math.round(((ldr.props.lux ?? 500) / 1000) * maxAdc)
      const mq2 = findConnectedComponent(ctx, components, gpio, 'mq2')
      if (mq2) return Math.round((Math.min(2500, mq2.props.gasPpm ?? 280) / 2500) * maxAdc)
      const ntc = findConnectedComponent(ctx, components, gpio, 'ntc')
      if (ntc) return Math.round((Math.max(0, Math.min(85, (ntc.props.tempC ?? 25) + 10)) / 95) * maxAdc)
      return ctx.sim.gpioStates[gpio]?.adcValue ?? 0
    }
    if (fn === 'ultrasonicRead') {
      const trigGpio = Number(args[0] ?? 5)
      const ultra =
        findConnectedComponent(ctx, components, trigGpio, 'hc-sr04') ??
        components.find((c) => c.kind === 'hc-sr04')
      return ultra?.props.distanceCm ?? 42
    }
    if (fn === 'dht.readTemperature') {
      const gpio = Number(args[0] ?? -1)
      const dht =
        (gpio >= 0 ? findConnectedComponent(ctx, components, gpio, 'dht22') : undefined) ??
        components.find((c) => c.kind === 'dht22')
      return dht?.props.tempC ?? 27.5
    }
    if (fn === 'dht.readHumidity') {
      const gpio = Number(args[0] ?? -1)
      const dht =
        (gpio >= 0 ? findConnectedComponent(ctx, components, gpio, 'dht22') : undefined) ??
        components.find((c) => c.kind === 'dht22')
      return dht?.props.humidity ?? 60
    }
    if (fn === 'map') {
      const [v, inMin, inMax, outMin, outMax] = args.map(Number)
      if (inMax === inMin) return outMin
      return Math.round(((v - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin)
    }
    if (fn === 'constrain') {
      const [v, lo, hi] = args.map(Number)
      return Math.min(hi, Math.max(lo, v))
    }
  }

  // Simple binary arithmetic (+, -, *, /)
  for (const op of [' + ', ' - ', ' * ', ' / '] as const) {
    if (s.includes(op)) {
      const idx = s.lastIndexOf(op)
      const a = Number(evalExpr(s.slice(0, idx), ctx, components))
      const b = Number(evalExpr(s.slice(idx + op.length), ctx, components))
      if (op === ' + ') return a + b
      if (op === ' - ') return a - b
      if (op === ' * ') return a * b
      return b === 0 ? 0 : a / b
    }
  }

  return 0
}

function evalBool(raw: string, ctx: VmContext, components: PlacedComponent[]): boolean {
  const s = raw.trim()
  if (s.includes('&&')) {
    return s.split('&&').every((part) => evalBool(part, ctx, components))
  }
  if (s.includes('||')) {
    return s.split('||').some((part) => evalBool(part, ctx, components))
  }
  for (const op of ['==', '!=', '>=', '<=', '>', '<'] as const) {
    const idx = s.indexOf(op)
    if (idx !== -1) {
      const l = evalExpr(s.slice(0, idx), ctx, components)
      const r = evalExpr(s.slice(idx + op.length), ctx, components)
      if (op === '==') return l == r
      if (op === '!=') return l != r
      if (op === '>=') return Number(l) >= Number(r)
      if (op === '<=') return Number(l) <= Number(r)
      if (op === '>') return Number(l) > Number(r)
      return Number(l) < Number(r)
    }
  }
  return Boolean(evalExpr(s, ctx, components))
}

function extractPlotMetrics(text: string): Record<string, number> | null {
  const series: Record<string, number> = {}
  const pairs = text.match(/([A-Za-z_]\w*)\s*:\s*(-?\d+(?:\.\d+)?)/g)
  if (pairs && pairs.length > 0) {
    for (const p of pairs) {
      const [k, v] = p.split(':')
      series[k.trim()] = Number(v.trim())
    }
    return series
  }
  if (/^-?\d+(?:\.\d+)?$/.test(text.trim())) {
    series.value = Number(text.trim())
    return series
  }
  return null
}

function pushSerial(ctx: VmContext, text: string) {
  const entry: SerialEntry = {
    id: `ser-${ctx.sim.serialLog.length + 1}-${ctx.sim.elapsedMs}`,
    timeMs: ctx.sim.elapsedMs,
    text,
    kind: 'rx',
  }
  ctx.sim.serialLog = [...ctx.sim.serialLog.slice(-79), entry]
  const metrics = extractPlotMetrics(text)
  if (metrics) {
    ctx.sim.plotHistory = [...ctx.sim.plotHistory.slice(-49), { t: ctx.sim.elapsedMs, series: metrics }]
  }
}

function runStatements(stmts: ParsedStatement[], ctx: VmContext, components: PlacedComponent[]): number {
  let delayAccum = 0
  for (const st of stmts) {
    if (st.kind === 'delay') {
      delayAccum += Math.max(50, Math.min(2000, Number(evalExpr(st.expr ?? '200', ctx, components))))
      continue
    }
    if (st.kind === 'assign' && st.target) {
      ctx.vars[st.target] = evalExpr(st.expr ?? '0', ctx, components)
      continue
    }
    if (st.kind === 'if') {
      const ok = evalBool(st.cond ?? 'false', ctx, components)
      if (ok && st.thenBody) delayAccum += runStatements(st.thenBody, ctx, components)
      else if (!ok && st.elseBody) delayAccum += runStatements(st.elseBody, ctx, components)
      continue
    }

    const callM = /^([a-zA-Z_][a-zA-Z0-9_.]*)\((.*)\)$/.exec(st.raw)
    if (!callM) continue
    const fn = callM[1]
    const argsRaw = splitArgs(callM[2])
    const args = argsRaw.map((a) => evalExpr(a, ctx, components))

    if (fn === 'pinMode') {
      const gpio = Number(args[0] ?? 0)
      const modeNum = Number(args[1] ?? 0)
      const mode = modeNum === 1 ? 'OUTPUT' : modeNum === 2 ? 'INPUT_PULLUP' : 'INPUT'
      if (ctx.sim.gpioStates[gpio]) ctx.sim.gpioStates[gpio] = { ...ctx.sim.gpioStates[gpio], mode }
    } else if (fn === 'digitalWrite') {
      const gpio = Number(args[0] ?? 0)
      const val = Number(args[1] ?? 0) ? 1 : 0
      const v = val ? BOARDS[ctx.boardId].logicVoltage : 0
      ctx.sim.gpioStates[gpio] = {
        ...(ctx.sim.gpioStates[gpio] ?? { gpio, mode: 'OUTPUT', adcValue: 0 }),
        mode: 'OUTPUT',
        digital: val,
        pwmDuty: val * 255,
        voltage: v,
      }
    } else if (fn === 'analogWrite') {
      const gpio = Number(args[0] ?? 0)
      const duty = Math.max(0, Math.min(255, Math.round(Number(args[1] ?? 0))))
      const v = Math.round((duty / 255) * BOARDS[ctx.boardId].logicVoltage * 100) / 100
      ctx.sim.gpioStates[gpio] = {
        ...(ctx.sim.gpioStates[gpio] ?? { gpio, mode: 'PWM', adcValue: 0 }),
        mode: 'PWM',
        digital: duty > 0 ? 1 : 0,
        pwmDuty: duty,
        voltage: v,
      }
    } else if (fn === 'tone') {
      const gpio = Number(args[0] ?? 0)
      const freq = Number(args[1] ?? 1000)
      const buzz = findConnectedComponent(ctx, components, gpio, 'buzzer')
      if (buzz) ctx.sim.buzzerActive[buzz.id] = { freq, active: true }
      ctx.sim.gpioStates[gpio] = {
        ...(ctx.sim.gpioStates[gpio] ?? { gpio, mode: 'PWM', adcValue: 0 }),
        mode: 'PWM',
        digital: 1,
        pwmDuty: 128,
        voltage: BOARDS[ctx.boardId].logicVoltage / 2,
      }
    } else if (fn === 'noTone') {
      const gpio = Number(args[0] ?? 0)
      const buzz = findConnectedComponent(ctx, components, gpio, 'buzzer')
      if (buzz) ctx.sim.buzzerActive[buzz.id] = { freq: 0, active: false }
      if (ctx.sim.gpioStates[gpio]) {
        ctx.sim.gpioStates[gpio] = { ...ctx.sim.gpioStates[gpio], digital: 0, pwmDuty: 0, voltage: 0 }
      }
    } else if (fn.endsWith('.attach')) {
      const obj = fn.split('.')[0]
      ctx.servoPinMap[obj] = Number(args[0] ?? 2)
    } else if (fn.endsWith('.write')) {
      const obj = fn.split('.')[0]
      const angle = Math.max(0, Math.min(180, Math.round(Number(args[0] ?? 0))))
      const gpio = ctx.servoPinMap[obj] ?? 2
      const servo = findConnectedComponent(ctx, components, gpio, 'servo') ?? components.find((c) => c.kind === 'servo')
      if (servo) ctx.sim.servoAngles[servo.id] = angle
      if (ctx.sim.gpioStates[gpio]) {
        ctx.sim.gpioStates[gpio] = { ...ctx.sim.gpioStates[gpio], mode: 'PWM', digital: 1, pwmDuty: Math.round((angle / 180) * 255) }
      }
    } else if (fn === 'Serial.println' || fn === 'Serial.print') {
      pushSerial(ctx, String(args[0] ?? ''))
    } else if (fn === 'oled.begin') {
      ctx.oledStarted = true
    } else if (fn === 'oled.clear') {
      ctx.oledBuffer = []
    } else if (fn === 'oled.println' || fn === 'oled.print') {
      ctx.oledBuffer.push(String(args[0] ?? '').slice(0, 21))
    } else if (fn === 'oled.display') {
      for (const c of components) {
        if (c.kind === 'oled-ssd1306') ctx.sim.oledLines[c.id] = ctx.oledBuffer.slice(0, 5)
      }
    } else if (fn === 'lcd.print') {
      const row = Number(ctx.vars.__lcdRow ?? 0)
      for (const c of components) {
        if (c.kind === 'lcd-1602') {
          const cur = ctx.sim.lcdRows[c.id] ?? ['                ', '                ']
          const next: [string, string] = [...cur] as [string, string]
          next[row === 1 ? 1 : 0] = String(args[0] ?? '').padEnd(16, ' ').slice(0, 16)
          ctx.sim.lcdRows[c.id] = next
        }
      }
    } else if (fn === 'lcd.setCursor') {
      ctx.vars.__lcdRow = Number(args[1] ?? 0)
    } else if (fn === 'WiFi.begin' && BOARDS[ctx.boardId].hasWifi) {
      const ssid = String(args[0] ?? 'Wokwi-GUEST')
      ctx.sim.wifiConnected = true
      ctx.sim.wifiIp = ssid.toLowerCase().includes('wokwi') ? '10.13.37.2' : '192.168.4.42'
    } else if (fn === 'mqtt.begin') {
      const url = String(args[0] ?? 'mqtt://broker.weblab.local:1883')
      ctx.vars.__mqttBroker = url
      ctx.vars.__mqttTls = url.startsWith('mqtts://') ? 1 : 0
    } else if (fn === 'mqtt.publish') {
      const broker = String(ctx.vars.__mqttBroker ?? 'mqtt://broker.weblab.local:1883')
      const tls = broker.startsWith('mqtts://')
      const msg: MqttMessage = {
        id: `mqtt-${ctx.sim.mqttMessages.length + 1}-${ctx.sim.elapsedMs}`,
        timeMs: ctx.sim.elapsedMs,
        broker,
        topic: String(args[0] ?? 'ifalab/telemetry'),
        payload: String(args[1] ?? '{}'),
        tls,
      }
      ctx.sim.mqttMessages = [...ctx.sim.mqttMessages.slice(-24), msg]
    }
  }
  return delayAccum
}

function syncCircuitActuators(ctx: VmContext, components: PlacedComponent[], wires: Wire[]) {
  ctx.graph = buildNetGraph(wires, components)
  ctx.sim.alerts = analyzeCircuitSafety(ctx.boardId, components, wires)

  const readPinDuty = (ep: WireEndpoint): { duty: number; hasResistor: boolean; minResistorOhms: number | null } => {
    const reach = traceReachable(ctx.graph, ep, components)
    let duty = 0
    for (const r of reach.endpoints) {
      const rb = resolveNodeBoardId(ctx.boardId, components, r.nodeId)
      if (!rb) continue
      const bp = getBoardPin(rb, r.pinId)
      if (!bp) continue
      if (bp.kind === 'power') duty = Math.max(duty, 1)
      else if (bp.gpio !== undefined && r.nodeId === 'board') {
        const gs = ctx.sim.gpioStates[bp.gpio]
        if (gs && gs.mode === 'OUTPUT') duty = Math.max(duty, gs.digital)
        else if (gs && gs.mode === 'PWM') duty = Math.max(duty, gs.pwmDuty / 255)
      }
    }
    return { duty, hasResistor: reach.crossedResistor, minResistorOhms: reach.minResistorOhms }
  }

  const hitsGround = (ep: WireEndpoint): boolean => {
    const reach = traceReachable(ctx.graph, ep, components)
    return reach.endpoints.some((r) => {
      const rb = resolveNodeBoardId(ctx.boardId, components, r.nodeId)
      if (!rb) return false
      const bp = getBoardPin(rb, r.pinId)
      return bp?.kind === 'gnd'
    })
  }

  for (const c of components) {
    if (c.kind === 'led') {
      const a = readPinDuty({ nodeId: c.id, pinId: 'A' })
      const kGnd = hitsGround({ nodeId: c.id, pinId: 'K' })
      const baseLevel = kGnd ? a.duty : 0
      const ohms = a.minResistorOhms ?? 220
      const resistorScale =
        !a.hasResistor || ohms < 47 ? 1 : ohms <= 470 ? 1 : ohms <= 2200 ? 0.65 : ohms <= 10000 ? 0.35 : 0.16
      const level = baseLevel * resistorScale
      const clr = c.color ?? 'red'
      ctx.sim.ledBrightness[c.id] = {
        r: clr === 'red' || clr === 'yellow' ? level : 0,
        g: clr === 'green' || clr === 'yellow' ? level : 0,
        b: clr === 'blue' ? level : 0,
        burned: baseLevel > 0 && (!a.hasResistor || (a.minResistorOhms !== null && a.minResistorOhms < 47)),
      }
    } else if (c.kind === 'rgb-led') {
      const kGnd = hitsGround({ nodeId: c.id, pinId: 'GND' })
      const r = kGnd ? readPinDuty({ nodeId: c.id, pinId: 'R' }).duty : 0
      const g = kGnd ? readPinDuty({ nodeId: c.id, pinId: 'G' }).duty : 0
      const b = kGnd ? readPinDuty({ nodeId: c.id, pinId: 'B' }).duty : 0
      ctx.sim.ledBrightness[c.id] = { r, g, b }
    } else if (c.kind === 'relay') {
      const sig = readPinDuty({ nodeId: c.id, pinId: 'IN' })
      ctx.sim.relayClosed[c.id] = sig.duty > 0.5
    } else if (c.kind === 'buzzer') {
      const sig = readPinDuty({ nodeId: c.id, pinId: 'POS' })
      if (!ctx.sim.buzzerActive[c.id]) {
        ctx.sim.buzzerActive[c.id] = { freq: sig.duty > 0 ? 1000 : 0, active: sig.duty > 0 && hitsGround({ nodeId: c.id, pinId: 'GND' }) }
      }
    }
  }

  // Record 8-channel digital logic sample for Wokwi Logic Analyzer & VCD export
  const channels: Record<number, 0 | 1> = {}
  for (const g of Object.values(ctx.sim.gpioStates)) {
    channels[g.gpio] = g.digital
  }
  ctx.sim.logicHistory = [...ctx.sim.logicHistory.slice(-47), { timeMs: ctx.sim.elapsedMs, channels }]
}

function emitBootBanner(ctx: VmContext) {
  const lines: string[] =
    ctx.boardId === 'esp32'
      ? [
          'ets Jul 29 2019 12:21:46',
          'rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)',
          'configsip: 0, SPIWP:0xee',
          'mode:DIO, clock div:2',
          'entry 0x400805dc',
        ]
      : ctx.boardId === 'esp32-c3'
        ? [
            'ESP-ROM:esp32c3-api1-20210207',
            'rst:0x1 (POWERON),boot:0xc (SPI_FAST_FLASH_BOOT) · entry 0x403ce000',
          ]
        : ctx.boardId === 'pico-w'
          ? ['[RP2040] Bootrom v3 · CYW43439 Wi-Fi init OK · 133 MHz']
          : [`[${BOARDS[ctx.boardId].shortName}] AVR Optiboot 16MHz READY (115200 baud)`]

  for (const text of lines) {
    ctx.sim.serialLog = [
      ...ctx.sim.serialLog.slice(-79),
      { id: `boot-${ctx.sim.serialLog.length + 1}`, timeMs: 0, text, kind: 'sys' },
    ]
  }
}

export function stepSetup(ctx: VmContext, components: PlacedComponent[], wires: Wire[]) {
  ctx.graph = buildNetGraph(wires, components)
  emitBootBanner(ctx)
  runStatements(ctx.sketch.setupStmts, ctx, components)
  syncCircuitActuators(ctx, components, wires)
}

export function stepLoop(ctx: VmContext, components: PlacedComponent[], wires: Wire[]): number {
  ctx.graph = buildNetGraph(wires, components)
  const stmts = ctx.sketch.loopStmts
  if (stmts.length === 0) {
    ctx.loopIterations += 1
    ctx.sim.elapsedMs += 300
    syncCircuitActuators(ctx, components, wires)
    return 300
  }

  let delayMs = 250
  let safetySteps = 0
  while (safetySteps < stmts.length + 1) {
    const idx = ctx.loopCursor % stmts.length
    const st = stmts[idx]
    ctx.loopCursor += 1
    safetySteps += 1
    if (ctx.loopCursor >= stmts.length) {
      ctx.loopCursor = 0
      ctx.loopIterations += 1
    }

    if (st.kind === 'delay') {
      delayMs = Math.max(80, Math.min(1800, Number(evalExpr(st.expr ?? '250', ctx, components))))
      break
    }
    const innerDelay = runStatements([st], ctx, components)
    if (innerDelay > 0) {
      delayMs = Math.max(80, Math.min(1800, innerDelay))
      break
    }
    if (ctx.loopCursor === 0) break
  }

  if (ctx.loopIterations === 0 && safetySteps >= stmts.length) {
    ctx.loopIterations += 1
  }
  ctx.sim.elapsedMs += delayMs
  syncCircuitActuators(ctx, components, wires)
  return delayMs
}

export function verifyCircuitAndCode(
  boardId: BoardId,
  code: string,
  components: PlacedComponent[],
  wires: Wire[],
): CircuitDiagnosticItem[] {
  const items: CircuitDiagnosticItem[] = []
  const compiled = compileArduinoSketch(code)

  if (compiled.compileError) {
    items.push({
      id: 'diag-compile',
      status: 'error',
      textId: compiled.compileError,
      textEn: compiled.compileError,
    })
  } else {
    items.push({
      id: 'diag-compile',
      status: 'ok',
      textId: `Kompilasi Arduino C++ valid (${compiled.setupStmts.length} setup · ${compiled.loopStmts.length} loop).`,
      textEn: `Arduino C++ sketch compiled cleanly (${compiled.setupStmts.length} setup · ${compiled.loopStmts.length} loop).`,
    })
  }

  const safetyAlerts = analyzeCircuitSafety(boardId, components, wires)
  for (const a of safetyAlerts) {
    items.push({
      id: a.id,
      status: a.severity === 'error' ? 'error' : 'warn',
      textId: a.messageId,
      textEn: a.messageEn,
    })
  }
  if (safetyAlerts.length === 0) {
    items.push({
      id: 'diag-safety',
      status: 'ok',
      textId: `Pemeriksaan keamanan ${BOARDS[boardId].logicVoltage}V bersih (0 korsleting / over-voltage).`,
      textEn: `${BOARDS[boardId].logicVoltage}V electrical safety passed (0 shorts / over-voltage).`,
    })
  }

  const activeParts = components.filter((c) => c.kind !== 'breadboard' && c.kind !== 'mcu')
  if (activeParts.length === 0) {
    items.push({
      id: 'diag-parts',
      status: 'warn',
      textId: 'Belum ada komponen elektronik di kanvas. Tambahkan LED/sensor dari tab Components.',
      textEn: 'No active parts placed on canvas yet. Add an LED or sensor from the Components tab.',
    })
    return items
  }

  const graph = buildNetGraph(wires, components)
  const unwiredParts = activeParts.filter((c) => !wires.some((w) => w.from.nodeId === c.id || w.to.nodeId === c.id))
  if (unwiredParts.length > 0) {
    items.push({
      id: 'diag-unwired',
      status: 'warn',
      textId: `Komponen belum terpasang kabel: ${unwiredParts.map((u) => u.label).join(', ')}.`,
      textEn: `Unwired components: ${unwiredParts.map((u) => u.label).join(', ')}.`,
    })
  } else {
    // Check LED polarity & ground return + sensor reverse polarity across any placed MCU
    const isBoardGnd = (ep: WireEndpoint): boolean => {
      const eb = resolveNodeBoardId(boardId, components, ep.nodeId)
      return eb ? getBoardPin(eb, ep.pinId)?.kind === 'gnd' : false
    }
    const isBoardPwrOrGpio = (ep: WireEndpoint): boolean => {
      const eb = resolveNodeBoardId(boardId, components, ep.nodeId)
      if (!eb) return false
      const pin = getBoardPin(eb, ep.pinId)
      return Boolean(pin && pin.kind !== 'gnd')
    }
    const reversedLed = activeParts.find((c) => {
      if (c.kind !== 'led') return false
      const reachA = traceReachable(graph, { nodeId: c.id, pinId: 'A' }, components)
      const reachK = traceReachable(graph, { nodeId: c.id, pinId: 'K' }, components)
      const aHitsGnd = reachA.endpoints.some(isBoardGnd)
      const kHitsPwr = reachK.endpoints.some(isBoardPwrOrGpio)
      return aHitsGnd && kHitsPwr
    })
    const ungroundedLed = activeParts.find((c) => {
      if (c.kind !== 'led') return false
      const reach = traceReachable(graph, { nodeId: c.id, pinId: 'K' }, components)
      return !reach.endpoints.some(isBoardGnd)
    })
    if (reversedLed) {
      items.push({
        id: 'diag-led-polarity',
        status: 'error',
        textId: `Polaritas ${reversedLed.label} terbalik! Anoda (+) harus menuju GPIO/3V3 dan Katoda (-) menuju GND.`,
        textEn: `${reversedLed.label} polarity reversed! Wire Anode (+) to GPIO/3V3 and Cathode (-) to GND.`,
      })
    } else if (ungroundedLed) {
      items.push({
        id: 'diag-led-gnd',
        status: 'warn',
        textId: `Katoda (-) pada ${ungroundedLed.label} belum tersambung ke pin GND.`,
        textEn: `${ungroundedLed.label} cathode (-) is not wired to GND.`,
      })
    } else {
      items.push({
        id: 'diag-wiring-ok',
        status: 'ok',
        textId: `Rangkaian terhubung (${activeParts.length} komponen, ${wires.length} kabel jumper valid).`,
        textEn: `Circuit wiring valid (${activeParts.length} parts, ${wires.length} jumper wires).`,
      })
    }
  }

  return items
}
