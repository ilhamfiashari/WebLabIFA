import { BOARDS, getBoardInstances, getBoardPin, isBreadboardKind, resolveBreadboardPinAlias, resolveNodeBoardId } from './boards'
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

export interface SketchFile {
  name: string
  content: string
}

export interface CompiledSketch {
  defines: Record<string, number | string>
  setupStmts: ParsedStatement[]
  loopStmts: ParsedStatement[]
  helpers: Record<string, ParsedStatement[]>
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
        if (/^\}\s*else\s+if\s*\(/.test(cur) && depth === 1) {
          inElse = true
          elseLines.push({ text: cur.replace(/^\}\s*else\s+/, ''), num: lines[i].num })
          i++
          while (i < lines.length && depth > 0) {
            const ec = lines[i].text
            const eo = (ec.match(/\{/g) ?? []).length
            const ecl = (ec.match(/\}/g) ?? []).length
            const nextD = depth + eo - ecl
            if (nextD <= 0) {
              elseLines.push({ text: '}', num: lines[i].num })
              i++
              break
            }
            elseLines.push(lines[i])
            depth = nextD
            i++
          }
          break
        }
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

function expandSketchIncludes(
  code: string,
  extraFiles: SketchFile[],
  visited = new Set<string>(),
): string {
  if (!extraFiles.length) return code
  return code
    .split('\n')
    .map((line) => {
      const m = /^\s*#include\s+"([^"]+)"/.exec(line)
      if (!m) return line
      const incName = m[1].trim()
      if (visited.has(incName.toLowerCase())) return ''
      const file = extraFiles.find(
        (f) => f.name.toLowerCase() === incName.toLowerCase() || f.name.toLowerCase().endsWith(`/${incName.toLowerCase()}`),
      )
      if (!file) return line
      visited.add(incName.toLowerCase())
      return expandSketchIncludes(file.content, extraFiles, visited)
    })
    .join('\n')
}

export function compileArduinoSketch(code: string, extraFiles: SketchFile[] = []): CompiledSketch {
  const expanded = expandSketchIncludes(code, extraFiles)
  const rawLines = expanded.split('\n')
  const defines: Record<string, number | string> = {
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
  const helperBlocks: Record<string, Array<{ text: string; num: number }>> = {}
  let mode: 'top' | 'setup' | 'loop' | 'helper' = 'top'
  let activeHelper = ''
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
      const constM = /^(?:const\s+)?(?:int|float|double|long|bool|boolean)\s+([A-Za-z_]\w*)\s*=\s*([0-9.-]+|true|false)\s*;/.exec(clean)
      if (constM) {
        defines[constM[1]] = constM[2] === 'true' ? 1 : constM[2] === 'false' ? 0 : Number(constM[2])
        continue
      }
      const strConstM = /^String\s+([A-Za-z_]\w*)\s*=\s*"([^"]*)"\s*;/.exec(clean)
      if (strConstM) {
        defines[strConstM[1]] = strConstM[2]
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
      const helperM = /^(?:void|int|bool)\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*\{?$/.exec(clean)
      if (helperM) {
        mode = 'helper'
        activeHelper = helperM[1]
        helperBlocks[activeHelper] = []
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
    else if (mode === 'helper' && activeHelper) helperBlocks[activeHelper].push({ text: clean, num: idx + 1 })
  }

  const helpers: Record<string, ParsedStatement[]> = {}
  for (const [fnName, lines] of Object.entries(helperBlocks)) {
    helpers[fnName] = parseStatements(lines)
  }

  if (!hasSetup || !hasLoop) {
    return {
      defines,
      setupStmts: [],
      loopStmts: [],
      helpers,
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
    helpers,
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
  const compKindMap = new Map(components.map((c) => [c.id, c.kind]))
  const normEp = (e: WireEndpoint): WireEndpoint => {
    const k = compKindMap.get(e.nodeId)
    return k && isBreadboardKind(k) ? { nodeId: e.nodeId, pinId: resolveBreadboardPinAlias(e.pinId) } : e
  }
  for (const w of wires) addEdge(normEp(w.from), normEp(w.to))

  // Resistors & full breadboard conductive rails/columns
  for (const c of components) {
    if (c.kind === 'resistor') {
      addEdge({ nodeId: c.id, pinId: 'P1' }, { nodeId: c.id, pinId: 'P2' })
    } else if (isBreadboardKind(c.kind)) {
      const cols = c.kind === 'breadboard-mini' ? 17 : c.kind === 'breadboard-large' ? 63 : 30
      for (let col = 1; col <= cols; col++) {
        const topStrip = ['a', 'b', 'c', 'd', 'e'] as const
        const botStrip = ['f', 'g', 'h', 'i', 'j'] as const
        for (let r = 0; r < topStrip.length - 1; r++) {
          addEdge({ nodeId: c.id, pinId: `c${col}_${topStrip[r]}` }, { nodeId: c.id, pinId: `c${col}_${topStrip[r + 1]}` })
          addEdge({ nodeId: c.id, pinId: `c${col}_${botStrip[r]}` }, { nodeId: c.id, pinId: `c${col}_${botStrip[r + 1]}` })
        }
      }
      if (c.kind === 'breadboard' || c.kind === 'breadboard-large') {
        const railLen = c.kind === 'breadboard-large' ? 50 : 25
        for (const prefix of ['tp_', 'tn_', 'bp_', 'bn_'] as const) {
          for (let i = 1; i < railLen; i++) {
            addEdge({ nodeId: c.id, pinId: `${prefix}${i}` }, { nodeId: c.id, pinId: `${prefix}${i + 1}` })
          }
        }
      }
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
  nodeId: string
  label: string
  boardId: BoardId
  sketch: CompiledSketch
  vars: Record<string, number | string>
  sim: SimulationState
  localGpio: Record<number, GpioRuntime>
  servoPinMap: Record<string, number>
  tonePins: Record<number, number>
  toneStartedAtDelay: Record<number, number>
  toneBurstPins: Record<number, { freq: number; untilMs: number }>
  serialRxQueue: string[]
  oledBuffer: string[]
  oledStarted: boolean
  loopIterations: number
  loopCursor: number
  graph: NetGraph
  peers: VmContext[]
  allNodes?: Map<string, VmContext>
}

export function defaultMcuSketch(boardId: BoardId, label?: string): string {
  const spec = BOARDS[boardId]
  const ledPin = spec.builtinLedGpio
  const title = label || spec.shortName
  return `// Firmware ${title} (${spec.shortName})
#define NODE_LED ${ledPin}

void setup() {
  Serial.begin(115200);
  pinMode(NODE_LED, OUTPUT);
  Serial.println("${title} siap!");
}

void loop() {
  digitalWrite(NODE_LED, HIGH);
  Serial.println("${title}: HIGH");
  delay(650);

  digitalWrite(NODE_LED, LOW);
  delay(650);
}`
}

function buildBoardGpioMap(boardId: BoardId): Record<number, GpioRuntime> {
  const gpioStates: Record<number, GpioRuntime> = {}
  for (const p of BOARDS[boardId].pins) {
    if (p.gpio !== undefined) {
      gpioStates[p.gpio] = { gpio: p.gpio, mode: 'INPUT', digital: 0, pwmDuty: 0, adcValue: 0, voltage: 0 }
    }
  }
  return gpioStates
}

export function createInitialSimulation(
  boardId: BoardId,
  components: PlacedComponent[],
  wires: Wire[],
): SimulationState {
  const gpioStates = buildBoardGpioMap(boardId)
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
    sevenSegText: {},
    matrixRows: {},
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
  extraFiles: SketchFile[] = [],
): VmContext {
  const sim = createInitialSimulation(boardId, components, wires)
  const graph = buildNetGraph(wires, components)
  const primaryComp = components.find((c) => c.kind === 'mcu' && c.id === 'board')
  const primaryLabel = primaryComp?.label ?? BOARDS[boardId].shortName
  const allNodes = new Map<string, VmContext>()

  const root: VmContext = {
    nodeId: 'board',
    label: primaryLabel,
    boardId,
    sketch,
    vars: { ...sketch.defines },
    sim,
    localGpio: sim.gpioStates,
    servoPinMap: {},
    tonePins: {},
    toneStartedAtDelay: {},
    toneBurstPins: {},
    serialRxQueue: [],
    oledBuffer: [],
    oledStarted: false,
    loopIterations: 0,
    loopCursor: 0,
    graph,
    peers: [],
    allNodes,
  }
  allNodes.set('board', root)

  const extraMcus = components.filter((c) => c.kind === 'mcu' && c.id !== 'board')
  for (const mcu of extraMcus) {
    const peerBoard = mcu.boardId ?? 'arduino-uno'
    const peerCode = mcu.props.sketchCode ?? defaultMcuSketch(peerBoard, mcu.label)
    const peerCompiled = compileArduinoSketch(peerCode, extraFiles)
    const peerCtx: VmContext = {
      nodeId: mcu.id,
      label: mcu.label || BOARDS[peerBoard].shortName,
      boardId: peerBoard,
      sketch: peerCompiled,
      vars: { ...peerCompiled.defines },
      sim,
      localGpio: buildBoardGpioMap(peerBoard),
      servoPinMap: {},
      tonePins: {},
      toneStartedAtDelay: {},
      toneBurstPins: {},
      serialRxQueue: [],
      oledBuffer: [],
      oledStarted: false,
      loopIterations: 0,
      loopCursor: 0,
      graph,
      peers: [],
      allNodes,
    }
    root.peers.push(peerCtx)
    allNodes.set(mcu.id, peerCtx)
  }

  return root
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
    const reach = traceReachable(ctx.graph, { nodeId: ctx.nodeId, pinId: pid }, components)
    for (const ep of reach.endpoints) {
      if (ep.nodeId === ctx.nodeId) continue
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
      // Check wired peer MCU output signals driving this pin
      for (const pid of gpioPinIds(ctx.boardId, gpio)) {
        const reach = traceReachable(ctx.graph, { nodeId: ctx.nodeId, pinId: pid }, components)
        for (const ep of reach.endpoints) {
          if (ep.nodeId === ctx.nodeId) continue
          const peer = ctx.allNodes?.get(ep.nodeId)
          if (!peer) continue
          const peerPin = getBoardPin(peer.boardId, ep.pinId)
          if (peerPin?.kind === 'power') return 1
          if (peerPin?.gpio !== undefined) {
            const pgs = peer.localGpio[peerPin.gpio]
            if (pgs && (pgs.mode === 'OUTPUT' || pgs.mode === 'PWM') && pgs.digital === 1) {
              return 1
            }
          }
        }
      }
      return ctx.localGpio[gpio]?.digital ?? 0
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
    if (fn === 'keypad.getKey' || fn === 'keypadRead') {
      const kp = components.find((c) => c.kind === 'keypad-4x4')
      const seq = kp?.props.encoderStep ?? 0
      const lastSeq = Number(ctx.vars.__kpSeq ?? -1)
      if (kp?.props.lastKey && seq !== lastSeq) {
        ctx.vars.__kpSeq = seq
        return kp.props.lastKey
      }
      return ''
    }
    if (fn === 'mpu.readTilt') {
      const mpu = components.find((c) => c.kind === 'mpu6050')
      return mpu?.props.tiltDeg ?? 0
    }
    if (fn === 'bmp.readPressure') {
      const bmp = components.find((c) => c.kind === 'bmp180')
      return bmp?.props.pressureHpa ?? 1013
    }
    if (fn === 'hx711.readKg') {
      const hx = components.find((c) => c.kind === 'hx711')
      return hx?.props.weightKg ?? 1.2
    }
    if (fn === 'rtc.readTime') {
      const totalSec = Math.floor((ctx.sim.elapsedMs || 0) / 1000)
      const mm = String((12 + Math.floor(totalSec / 60)) % 24).padStart(2, '0')
      const ss = String(totalSec % 60).padStart(2, '0')
      return `${mm}:${ss}`
    }
  }

  // Strip balanced outer parentheses cleanly
  if (s.startsWith('(') && s.endsWith(')')) {
    let d = 0
    let wrapped = true
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i] === '(') d++
      else if (s[i] === ')') d--
      if (d === 0) {
        wrapped = false
        break
      }
    }
    if (wrapped) return evalExpr(s.slice(1, -1), ctx, components)
  }

  // Simple binary arithmetic (+, -, *, /, %)
  for (const op of [' + ', ' - ', ' * ', ' / ', ' % '] as const) {
    if (s.includes(op)) {
      const idx = s.lastIndexOf(op)
      const a = Number(evalExpr(s.slice(0, idx), ctx, components))
      const b = Number(evalExpr(s.slice(idx + op.length), ctx, components))
      if (op === ' + ') return a + b
      if (op === ' - ') return a - b
      if (op === ' * ') return a * b
      if (op === ' % ') return b === 0 ? 0 : a % b
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

function pushSerial(ctx: VmContext, text: string, components: PlacedComponent[] = []) {
  const isMulti = (ctx.allNodes?.size ?? 1) > 1
  const formatted = isMulti ? `[${ctx.label}] ${text}` : text
  const entry: SerialEntry = {
    id: `ser-${ctx.sim.serialLog.length + 1}-${ctx.sim.elapsedMs}`,
    timeMs: ctx.sim.elapsedMs,
    text: formatted,
    kind: 'rx',
  }
  ctx.sim.serialLog = [...ctx.sim.serialLog.slice(-79), entry]
  const metrics = extractPlotMetrics(text)
  if (metrics) {
    ctx.sim.plotHistory = [...ctx.sim.plotHistory.slice(-49), { t: ctx.sim.elapsedMs, series: metrics }]
  }
  // Forward UART messages across any wired TX/UART pin to connected peer MCUs
  if (isMulti && ctx.allNodes) {
    const uartPins = BOARDS[ctx.boardId].pins.filter((p) => p.kind === 'uart' || p.id.includes('TX'))
    const delivered = new Set<string>()
    for (const up of uartPins) {
      const reach = traceReachable(ctx.graph, { nodeId: ctx.nodeId, pinId: up.id }, components)
      for (const ep of reach.endpoints) {
        if (ep.nodeId === ctx.nodeId || delivered.has(ep.nodeId)) continue
        const peer = ctx.allNodes.get(ep.nodeId)
        if (peer) {
          peer.serialRxQueue.push(text)
          delivered.add(ep.nodeId)
        }
      }
    }
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
      if (ctx.localGpio[gpio]) ctx.localGpio[gpio] = { ...ctx.localGpio[gpio], mode }
    } else if (fn === 'digitalWrite') {
      const gpio = Number(args[0] ?? 0)
      const val = Number(args[1] ?? 0) ? 1 : 0
      const v = val ? BOARDS[ctx.boardId].logicVoltage : 0
      ctx.localGpio[gpio] = {
        ...(ctx.localGpio[gpio] ?? { gpio, mode: 'OUTPUT', adcValue: 0 }),
        mode: 'OUTPUT',
        digital: val,
        pwmDuty: val * 255,
        voltage: v,
      }
    } else if (fn === 'analogWrite') {
      const gpio = Number(args[0] ?? 0)
      const duty = Math.max(0, Math.min(255, Math.round(Number(args[1] ?? 0))))
      const v = Math.round((duty / 255) * BOARDS[ctx.boardId].logicVoltage * 100) / 100
      ctx.localGpio[gpio] = {
        ...(ctx.localGpio[gpio] ?? { gpio, mode: 'PWM', adcValue: 0 }),
        mode: 'PWM',
        digital: duty > 0 ? 1 : 0,
        pwmDuty: duty,
        voltage: v,
      }
    } else if (fn === 'tone') {
      const gpio = Number(args[0] ?? 0)
      const freq = Math.max(80, Math.min(5000, Number(args[1] ?? 1000)))
      const durArg = args.length >= 3 ? Number(args[2] ?? 0) : 0
      if (durArg > 0) {
        ctx.tonePins[gpio] = 0
        ctx.toneBurstPins[gpio] = {
          freq,
          untilMs: Date.now() + Math.max(120, Math.min(2000, durArg)),
        }
      } else {
        ctx.tonePins[gpio] = freq
        ctx.toneStartedAtDelay[gpio] = delayAccum
      }
      const buzz = findConnectedComponent(ctx, components, gpio, 'buzzer') ?? components.find((c) => c.kind === 'buzzer')
      if (buzz) ctx.sim.buzzerActive = { ...ctx.sim.buzzerActive, [buzz.id]: { freq, active: true } }
      ctx.localGpio[gpio] = {
        ...(ctx.localGpio[gpio] ?? { gpio, mode: 'PWM', adcValue: 0 }),
        mode: 'PWM',
        digital: 1,
        pwmDuty: 128,
        voltage: BOARDS[ctx.boardId].logicVoltage / 2,
      }
    } else if (fn === 'noTone') {
      const gpio = Number(args[0] ?? 0)
      const activeFreq = ctx.tonePins[gpio] ?? 0
      const startedAt = ctx.toneStartedAtDelay[gpio]
      if (activeFreq > 0 && startedAt !== undefined && delayAccum > startedAt) {
        const pulseDur = Math.max(320, Math.min(800, delayAccum - startedAt))
        ctx.toneBurstPins[gpio] = { freq: activeFreq, untilMs: Date.now() + pulseDur }
      }
      ctx.tonePins[gpio] = 0
      const buzz = findConnectedComponent(ctx, components, gpio, 'buzzer') ?? components.find((c) => c.kind === 'buzzer')
      if (buzz) {
        const burst = ctx.toneBurstPins[gpio]
        const burstActive = Boolean(burst && burst.untilMs > Date.now())
        ctx.sim.buzzerActive = {
          ...ctx.sim.buzzerActive,
          [buzz.id]: burstActive ? { freq: burst.freq, active: true } : { freq: 0, active: false },
        }
      }
      if (ctx.localGpio[gpio]) {
        ctx.localGpio[gpio] = { ...ctx.localGpio[gpio], digital: 0, pwmDuty: 0, voltage: 0 }
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
      if (ctx.localGpio[gpio]) {
        ctx.localGpio[gpio] = { ...ctx.localGpio[gpio], mode: 'PWM', digital: 1, pwmDuty: Math.round((angle / 180) * 255) }
      }
    } else if (fn === 'Serial.println' || fn === 'Serial.print') {
      pushSerial(ctx, String(args[0] ?? ''), components)
    } else if (fn === 'oled.begin') {
      ctx.oledStarted = true
    } else if (fn === 'oled.clear') {
      ctx.oledBuffer = []
    } else if (fn === 'oled.println' || fn === 'oled.print') {
      ctx.oledBuffer.push(String(args[0] ?? '').slice(0, 21))
    } else if (fn === 'oled.progressBar') {
      const pct = Math.max(0, Math.min(100, Math.round(Number(args[0] ?? 0))))
      const filled = Math.round(pct / 10)
      const bar = `[${'#'.repeat(filled)}${'-'.repeat(10 - filled)}] ${pct}%`
      ctx.oledBuffer.push(bar)
    } else if (fn === 'oled.display') {
      for (const c of components) {
        if (c.kind === 'oled-ssd1306') ctx.sim.oledLines[c.id] = ctx.oledBuffer.slice(0, 5)
      }
    } else if (fn === 'lcd.clear') {
      for (const c of components) {
        if (c.kind === 'lcd-1602') ctx.sim.lcdRows[c.id] = ['                ', '                ']
        if (c.kind === 'lcd-20x4') ctx.sim.lcdRows[c.id] = ['                    ', '                    ', '                    ', '                    ']
      }
    } else if (fn === 'lcd.print') {
      const row = Math.max(0, Math.round(Number(ctx.vars.__lcdRow ?? 0)))
      for (const c of components) {
        if (c.kind === 'lcd-1602') {
          const cur = ctx.sim.lcdRows[c.id] ?? ['                ', '                ']
          const next = [...cur]
          next[row >= 1 ? 1 : 0] = String(args[0] ?? '').padEnd(16, ' ').slice(0, 16)
          ctx.sim.lcdRows[c.id] = next
        } else if (c.kind === 'lcd-20x4') {
          const cur = ctx.sim.lcdRows[c.id] ?? ['                    ', '                    ', '                    ', '                    ']
          const next = [...cur]
          const rIdx = Math.min(3, row)
          next[rIdx] = String(args[0] ?? '').padEnd(20, ' ').slice(0, 20)
          ctx.sim.lcdRows[c.id] = next
        }
      }
    } else if (fn === 'lcd.setCursor') {
      ctx.vars.__lcdRow = Number(args[1] ?? 0)
    } else if (fn === 'sevenSeg.print' || fn === 'tm1637.showNumber' || fn === 'tm1637.print') {
      const txt = String(args[0] ?? '0')
      for (const c of components) {
        if (c.kind === 'seven-seg' || c.kind === 'seven-seg-4') {
          ctx.sim.sevenSegText[c.id] = txt
        }
      }
    } else if (fn === 'matrix.setPattern') {
      const modeName = String(args[0] ?? 'tunnel')
      const frame = Math.max(0, Math.round(Number(args[1] ?? 0)))
      let rows: number[]
      if (modeName === 'alert') {
        rows = [0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b00000000, 0b00011000, 0b00011000]
      } else if (modeName === 'smile') {
        rows = [0b00111100, 0b01000010, 0b10100101, 0b10000001, 0b10100101, 0b10011001, 0b01000010, 0b00111100]
      } else if (modeName === 'heart') {
        rows = [0b01100110, 0b11111111, 0b11111111, 0b11111111, 0b01111110, 0b00111100, 0b00011000, 0b00000000]
      } else {
        const ring = frame % 4
        rows = Array.from({ length: 8 }, (_, r) => {
          let mask = 0
          for (let col = 0; col < 8; col++) {
            const dist = Math.max(Math.abs(r - 3.5), Math.abs(col - 3.5))
            if (Math.round(dist - 0.5) === ring) mask |= 1 << (7 - col)
          }
          return mask
        })
      }
      for (const c of components) {
        if (c.kind === 'max7219-matrix') ctx.sim.matrixRows[c.id] = rows
      }
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
    } else if (ctx.sketch.helpers[fn]) {
      delayAccum += runStatements(ctx.sketch.helpers[fn], ctx, components)
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
      else if (bp.gpio !== undefined) {
        const owner = ctx.allNodes?.get(r.nodeId)
        const gs = owner ? owner.localGpio[bp.gpio] : r.nodeId === 'board' ? ctx.sim.gpioStates[bp.gpio] : undefined
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

  const nextBuzzers: Record<string, { freq: number; active: boolean }> = {}
  const nowMs = Date.now()
  for (const c of components) {
    if (c.kind === 'led') {
      const anodePin = c.props.flip ? 'K' : 'A'
      const cathodePin = c.props.flip ? 'A' : 'K'
      const a = readPinDuty({ nodeId: c.id, pinId: anodePin })
      const kGnd = hitsGround({ nodeId: c.id, pinId: cathodePin })
      const baseLevel = kGnd ? a.duty : 0
      const ohms = a.minResistorOhms ?? 220
      const resistorScale =
        !a.hasResistor || ohms < 47 ? 1 : ohms <= 470 ? 1 : ohms <= 2200 ? 0.65 : ohms <= 10000 ? 0.35 : 0.16
      const level = baseLevel * resistorScale
      const clr = c.color ?? 'red'
      ctx.sim.ledBrightness[c.id] = {
        r: clr === 'red' || clr === 'yellow' || clr === 'orange' || clr === 'white' || clr === 'purple' ? level : 0,
        g: clr === 'green' || clr === 'yellow' || clr === 'cyan' || clr === 'white' ? level : clr === 'orange' ? level * 0.5 : 0,
        b: clr === 'blue' || clr === 'cyan' || clr === 'white' || clr === 'purple' ? level : 0,
        burned: baseLevel > 0 && (!a.hasResistor || (a.minResistorOhms !== null && a.minResistorOhms < 47)),
      }
    } else if (c.kind === 'rgb-led') {
      const isCommonAnode = c.props.common === 'anode'
      if (isCommonAnode) {
        const comPwr = readPinDuty({ nodeId: c.id, pinId: 'GND' }).duty > 0.5
        const r = comPwr ? 1 - readPinDuty({ nodeId: c.id, pinId: 'R' }).duty : 0
        const g = comPwr ? 1 - readPinDuty({ nodeId: c.id, pinId: 'G' }).duty : 0
        const b = comPwr ? 1 - readPinDuty({ nodeId: c.id, pinId: 'B' }).duty : 0
        ctx.sim.ledBrightness[c.id] = { r, g, b }
      } else {
        const kGnd = hitsGround({ nodeId: c.id, pinId: 'GND' })
        const r = kGnd ? readPinDuty({ nodeId: c.id, pinId: 'R' }).duty : 0
        const g = kGnd ? readPinDuty({ nodeId: c.id, pinId: 'G' }).duty : 0
        const b = kGnd ? readPinDuty({ nodeId: c.id, pinId: 'B' }).duty : 0
        ctx.sim.ledBrightness[c.id] = { r, g, b }
      }
    } else if (c.kind === 'relay') {
      const sig = readPinDuty({ nodeId: c.id, pinId: 'IN' })
      ctx.sim.relayClosed[c.id] = c.props.relayTransistor === 'pnp' ? sig.duty < 0.5 : sig.duty > 0.5
    } else if (c.kind === 'buzzer') {
      const readPinToneFreq = (ep: WireEndpoint): number => {
        const reach = traceReachable(ctx.graph, ep, components)
        let f = 0
        for (const r of reach.endpoints) {
          const rb = resolveNodeBoardId(ctx.boardId, components, r.nodeId)
          if (!rb) continue
          const bp = getBoardPin(rb, r.pinId)
          if (!bp || bp.gpio === undefined) continue
          const owner = ctx.allNodes?.get(r.nodeId) ?? ctx
          let tf = owner.tonePins[bp.gpio] ?? 0
          if (tf <= 0) {
            const burst = owner.toneBurstPins[bp.gpio]
            if (burst && burst.untilMs > nowMs) tf = burst.freq
            else if (burst) delete owner.toneBurstPins[bp.gpio]
          }
          if (tf > 0) f = tf
        }
        return f
      }
      const posSig = readPinDuty({ nodeId: c.id, pinId: 'POS' })
      const posTone = readPinToneFreq({ nodeId: c.id, pinId: 'POS' })
      const gndOk = hitsGround({ nodeId: c.id, pinId: 'GND' })
      const swapSig = readPinDuty({ nodeId: c.id, pinId: 'GND' })
      const swapTone = readPinToneFreq({ nodeId: c.id, pinId: 'GND' })
      const swapGndOk = hitsGround({ nodeId: c.id, pinId: 'POS' })
      const forwardActive = gndOk && (posTone > 0 || posSig.duty > 0)
      const reverseActive = swapGndOk && (swapTone > 0 || swapSig.duty > 0)
      const active = forwardActive || reverseActive
      const freq = forwardActive ? (posTone > 0 ? posTone : 1000) : reverseActive ? (swapTone > 0 ? swapTone : 1000) : 0
      nextBuzzers[c.id] = { freq, active }
    }
  }
  ctx.sim.buzzerActive = nextBuzzers

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
          : ctx.boardId === 'pi-pico'
            ? ['[RP2040] Raspberry Pi Pico Bootrom v3 · 133 MHz READY']
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
  for (const peer of ctx.peers) {
    peer.graph = ctx.graph
    emitBootBanner(peer)
    if (!peer.sketch.compileError) {
      runStatements(peer.sketch.setupStmts, peer, components)
    }
  }
  syncCircuitActuators(ctx, components, wires)
}

function advanceMcuSlice(mcu: VmContext, components: PlacedComponent[]): number {
  const stmts = mcu.sketch.loopStmts
  if (stmts.length === 0 || mcu.sketch.compileError) {
    mcu.loopIterations += 1
    return 300
  }
  let delayMs = 250
  let safetySteps = 0
  while (safetySteps < stmts.length + 1) {
    const idx = mcu.loopCursor % stmts.length
    const st = stmts[idx]
    mcu.loopCursor += 1
    safetySteps += 1
    if (mcu.loopCursor >= stmts.length) {
      mcu.loopCursor = 0
      mcu.loopIterations += 1
    }

    if (st.kind === 'delay') {
      delayMs = Math.max(80, Math.min(1800, Number(evalExpr(st.expr ?? '250', mcu, components))))
      break
    }
    const innerDelay = runStatements([st], mcu, components)
    if (innerDelay > 0) {
      delayMs = Math.max(80, Math.min(1800, innerDelay))
      break
    }
    if (mcu.loopCursor === 0) break
  }
  if (mcu.loopIterations === 0 && safetySteps >= stmts.length) {
    mcu.loopIterations += 1
  }
  return delayMs
}

export function stepLoop(ctx: VmContext, components: PlacedComponent[], wires: Wire[]): number {
  ctx.graph = buildNetGraph(wires, components)
  const delayMs = advanceMcuSlice(ctx, components)
  for (const peer of ctx.peers) {
    peer.graph = ctx.graph
    advanceMcuSlice(peer, components)
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
  extraFiles: SketchFile[] = [],
): CircuitDiagnosticItem[] {
  const items: CircuitDiagnosticItem[] = []
  const compiled = compileArduinoSketch(code, extraFiles)
  const extraMcus = components.filter((c) => c.kind === 'mcu' && c.id !== 'board')

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

  for (const mcu of extraMcus) {
    const peerBoard = mcu.boardId ?? 'arduino-uno'
    const peerCode = mcu.props.sketchCode ?? defaultMcuSketch(peerBoard, mcu.label)
    const peerComp = compileArduinoSketch(peerCode, extraFiles)
    if (peerComp.compileError) {
      items.push({
        id: `diag-compile-${mcu.id}`,
        status: 'error',
        textId: `${mcu.label}: ${peerComp.compileError}`,
        textEn: `${mcu.label}: ${peerComp.compileError}`,
      })
    }
  }
  if (extraMcus.length > 0 && extraMcus.every((m) => !compileArduinoSketch(m.props.sketchCode ?? defaultMcuSketch(m.boardId ?? 'arduino-uno', m.label), extraFiles).compileError)) {
    const totalMcus = 1 + extraMcus.length
    items.push({
      id: 'diag-multi-mcu',
      status: 'ok',
      textId: `Multi-MCU aktif: ${totalMcus} mikrokontroler terpasang dan siap berjalan bersamaan.`,
      textEn: `Multi-MCU active: ${totalMcus} microcontrollers compiled and ready to run in parallel.`,
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

  const activeParts = components.filter((c) => !isBreadboardKind(c.kind) && c.kind !== 'mcu')
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
      const anodePin = c.props.flip ? 'K' : 'A'
      const cathodePin = c.props.flip ? 'A' : 'K'
      const reachA = traceReachable(graph, { nodeId: c.id, pinId: anodePin }, components)
      const reachK = traceReachable(graph, { nodeId: c.id, pinId: cathodePin }, components)
      const aHitsGnd = reachA.endpoints.some(isBoardGnd)
      const kHitsPwr = reachK.endpoints.some(isBoardPwrOrGpio)
      return aHitsGnd && kHitsPwr
    })
    const ungroundedLed = activeParts.find((c) => {
      if (c.kind !== 'led') return false
      const cathodePin = c.props.flip ? 'A' : 'K'
      const reach = traceReachable(graph, { nodeId: c.id, pinId: cathodePin }, components)
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
