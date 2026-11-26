import { BOARDS, getBoardInstances, getBoardPin, isBreadboardKind, resolveBreadboardPinAlias, resolveNodeBoardId } from './boards'
import { lintArduinoCpp } from './cppDiagnostics'
import type {
  BoardId,
  CircuitDiagnosticItem,
  GpioRuntime,
  HardwareAlert,
  HttpRequestLog,
  MqttMessage,
  PlacedComponent,
  SerialEntry,
  SimulationState,
  WebServerRoute,
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

export interface ProjectSyncSummary {
  linkedFiles: string[]
  missingIncludes: string[]
  combinedSource: string
}

function expandSketchIncludes(
  code: string,
  extraFiles: SketchFile[],
  visited = new Set<string>(),
  missingIncludes = new Set<string>(),
): string {
  if (!extraFiles.length && !/#include\s+"/.test(code)) return code
  return code
    .split('\n')
    .map((line) => {
      const m = /^\s*#include\s+"([^"]+)"/.exec(line)
      if (!m) return line
      const incName = m[1].trim()
      const lowerInc = incName.toLowerCase()
      if (visited.has(lowerInc)) return ''
      const file = extraFiles.find(
        (f) => f.name.toLowerCase() === lowerInc || f.name.toLowerCase().endsWith(`/${lowerInc}`),
      )
      if (!file) {
        missingIncludes.add(incName)
        return line
      }
      visited.add(lowerInc)
      visited.add(file.name.toLowerCase())
      return expandSketchIncludes(file.content, extraFiles, visited, missingIncludes)
    })
    .join('\n')
}

/**
 * Sinkronisasi seluruh file proyek (Main.ino + #include ".h/.hpp" + modul kompilasi .cpp/.c/.ino)
 * menjadi satu unit kompilasi Arduino agar proyek besar multi-file saling terhubung.
 */
export function analyzeProjectFileSync(
  code: string,
  extraFiles: SketchFile[] = [],
): ProjectSyncSummary {
  const visited = new Set<string>()
  const missingIncludes = new Set<string>()
  const primaryExpanded = expandSketchIncludes(code, extraFiles, visited, missingIncludes)

  const extraModuleChunks: string[] = []
  for (const f of extraFiles) {
    const lower = f.name.toLowerCase()
    const isSourceUnit =
      lower.endsWith('.cpp') || lower.endsWith('.c') || lower.endsWith('.ino')
    if (isSourceUnit && !visited.has(lower)) {
      visited.add(lower)
      extraModuleChunks.push(expandSketchIncludes(f.content, extraFiles, visited, missingIncludes))
    }
  }

  const combinedSource = extraModuleChunks.length
    ? `${primaryExpanded}\n${extraModuleChunks.join('\n')}`
    : primaryExpanded

  const linkedFiles = ['Main.ino', ...extraFiles.map((f) => f.name)]
  return {
    linkedFiles,
    missingIncludes: Array.from(missingIncludes),
    combinedSource,
  }
}

function countBracesDeltaOutsideStrings(line: string): number {
  let delta = 0
  let inStr = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && line[i - 1] !== '\\') {
      inStr = !inStr
      continue
    }
    if (!inStr) {
      if (ch === '{') delta += 1
      else if (ch === '}') delta -= 1
    }
  }
  return delta
}

export function compileArduinoSketch(code: string, extraFiles: SketchFile[] = []): CompiledSketch {
  const { combinedSource: expanded, missingIncludes } = analyzeProjectFileSync(code, extraFiles)
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

  const pushModeLine = (target: 'setup' | 'loop' | 'helper', text: string, num: number) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (target === 'setup') setupLines.push({ text: trimmed, num })
    else if (target === 'loop') loopLines.push({ text: trimmed, num })
    else if (activeHelper) helperBlocks[activeHelper].push({ text: trimmed, num })
  }

  const enterBlock = (target: 'setup' | 'loop' | 'helper', cleanLine: string, lineNum: number) => {
    const openIdx = cleanLine.indexOf('{')
    if (openIdx < 0) {
      mode = target
      braceDepth = 0
      return
    }
    const delta = countBracesDeltaOutsideStrings(cleanLine)
    let afterOpen = cleanLine.slice(openIdx + 1).trim()
    if (delta <= 0) {
      if (afterOpen.endsWith('}')) afterOpen = afterOpen.slice(0, -1).trim()
      if (afterOpen) pushModeLine(target, afterOpen, lineNum)
      mode = 'top'
      braceDepth = 0
    } else {
      mode = target
      braceDepth = delta
      if (afterOpen) pushModeLine(target, afterOpen, lineNum)
    }
  }

  for (let idx = 0; idx < rawLines.length; idx++) {
    const clean = stripComments(rawLines[idx])
    if (!clean) continue
    if (
      clean.startsWith('#include') ||
      clean.startsWith('#pragma') ||
      clean.startsWith('#ifndef') ||
      clean.startsWith('#ifdef') ||
      clean.startsWith('#if ') ||
      clean.startsWith('#else') ||
      clean.startsWith('#elif') ||
      clean.startsWith('#endif')
    ) {
      continue
    }
    const defNumM = /^#define\s+([A-Za-z_]\w*)\s+([0-9.-]+)\s*$/.exec(clean)
    if (defNumM) {
      defines[defNumM[1]] = Number(defNumM[2])
      continue
    }
    const defStrM = /^#define\s+([A-Za-z_]\w*)\s+"([^"]*)"\s*$/.exec(clean)
    if (defStrM) {
      defines[defStrM[1]] = defStrM[2]
      continue
    }
    if (/^#define\s+[A-Za-z_]\w*\s*$/.test(clean)) {
      continue
    }
    if (mode === 'top') {
      if (clean.startsWith('extern ')) continue
      const constM = /^(?:const\s+)?(?:int|float|double|long|bool|boolean)\s+([A-Za-z_]\w*)\s*=\s*([0-9.-]+|true|false)\s*;/.exec(clean)
      if (constM) {
        defines[constM[1]] = constM[2] === 'true' ? 1 : constM[2] === 'false' ? 0 : Number(constM[2])
        continue
      }
      const strConstM = /^(?:const\s+char\s*\*|const\s+String|String)\s+([A-Za-z_]\w*)\s*=\s*"([^"]*)"\s*;/.exec(clean)
      if (strConstM) {
        defines[strConstM[1]] = strConstM[2]
        continue
      }
      if (/^void\s+setup\s*\(/.test(clean)) {
        hasSetup = true
        enterBlock('setup', clean, idx + 1)
        continue
      }
      if (/^void\s+loop\s*\(/.test(clean)) {
        hasLoop = true
        enterBlock('loop', clean, idx + 1)
        continue
      }
      // Abaikan forward declaration / prototipe fungsi pada file header (.h) yang diakhiri ';'
      const helperM =
        /^(?:void|int|float|double|long|bool|boolean|String|uint\d+_t)\s+([A-Za-z_]\w*)\s*\([^)]*\)(?:\s*\{.*)?$/.exec(
          clean,
        )
      if (helperM && !clean.endsWith(';')) {
        activeHelper = helperM[1]
        helperBlocks[activeHelper] = []
        enterBlock('helper', clean, idx + 1)
        continue
      }
      continue
    }

    const stepDelta = countBracesDeltaOutsideStrings(clean)
    braceDepth += stepDelta
    if (braceDepth <= 0) {
      const beforeClose = clean.replace(/\}\s*$/, '').trim()
      if (beforeClose) pushModeLine(mode, beforeClose, idx + 1)
      mode = 'top'
      braceDepth = 0
      continue
    }
    pushModeLine(mode, clean, idx + 1)
  }

  const helpers: Record<string, ParsedStatement[]> = {}
  for (const [fnName, lines] of Object.entries(helperBlocks)) {
    helpers[fnName] = parseStatements(lines)
  }

  if (missingIncludes.length > 0) {
    return {
      defines,
      setupStmts: [],
      loopStmts: [],
      helpers,
      servoPins: [],
      compileError: `Compile Error: File lokal #include "${missingIncludes[0]}" tidak ditemukan di tab file proyek.`,
    }
  }

  const mainDiags = lintArduinoCpp(code)
  if (mainDiags.length > 0) {
    const first = mainDiags[0]
    return {
      defines,
      setupStmts: [],
      loopStmts: [],
      helpers,
      servoPins: [],
      compileError: `Compile Error (Main.ino baris ${first.line}): ${first.messageId}`,
    }
  }

  for (const extra of extraFiles) {
    const lower = extra.name.toLowerCase()
    if (!/\.(ino|h|hpp|cpp|c)$/.test(lower)) continue
    const extraDiags = lintArduinoCpp(extra.content)
    if (extraDiags.length > 0) {
      const first = extraDiags[0]
      return {
        defines,
        setupStmts: [],
        loopStmts: [],
        helpers,
        servoPins: [],
        compileError: `Compile Error (${extra.name} baris ${first.line}): ${first.messageId}`,
      }
    }
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

interface NetEdge {
  to: WireEndpoint
  ohms: number
  isResistor: boolean
}

interface NetGraph {
  adj: Map<string, NetEdge[]>
}

interface ReachNode {
  endpoint: WireEndpoint
  ohms: number
  crossedResistor: boolean
}

function epKey(e: WireEndpoint): string {
  return `${e.nodeId}:${e.pinId}`
}

function buildNetGraph(
  wires: Wire[],
  components: PlacedComponent[],
  relayClosed: Record<string, boolean> = {},
): NetGraph {
  const adj = new Map<string, NetEdge[]>()
  const addEdge = (a: WireEndpoint, b: WireEndpoint, ohms = 0, isResistor = false) => {
    const ka = epKey(a)
    const kb = epKey(b)
    const listA = adj.get(ka)
    if (listA) listA.push({ to: b, ohms, isResistor })
    else adj.set(ka, [{ to: b, ohms, isResistor }])
    const listB = adj.get(kb)
    if (listB) listB.push({ to: a, ohms, isResistor })
    else adj.set(kb, [{ to: a, ohms, isResistor }])
  }
  const compKindMap = new Map(components.map((c) => [c.id, c.kind]))
  const normEp = (e: WireEndpoint): WireEndpoint => {
    const k = compKindMap.get(e.nodeId)
    return k && isBreadboardKind(k) ? { nodeId: e.nodeId, pinId: resolveBreadboardPinAlias(e.pinId) } : e
  }
  for (const w of wires) addEdge(normEp(w.from), normEp(w.to), 0, false)

  // Conductive internal paths: resistors, switches, relays, potentiometers, and breadboards
  for (const c of components) {
    if (c.kind === 'resistor') {
      const val = Math.max(0, Number(c.ohms ?? 220))
      addEdge({ nodeId: c.id, pinId: 'P1' }, { nodeId: c.id, pinId: 'P2' }, val, true)
    } else if (c.kind === 'pushbutton') {
      if (c.props.pressed || c.props.latched) {
        addEdge({ nodeId: c.id, pinId: 'OUT' }, { nodeId: c.id, pinId: 'GND' }, 0, false)
      }
    } else if (c.kind === 'slide-switch') {
      const isRight = Boolean(c.props.latched || c.props.pressed)
      addEdge({ nodeId: c.id, pinId: '2' }, { nodeId: c.id, pinId: isRight ? '3' : '1' }, 0, false)
    } else if (c.kind === 'dip-switch') {
      const bits = c.props.dipBits ?? [0, 0, 0, 0, 0, 0, 0, 0]
      if (bits[0]) addEdge({ nodeId: c.id, pinId: 'IN1' }, { nodeId: c.id, pinId: 'GND' }, 0, false)
      if (bits[1]) addEdge({ nodeId: c.id, pinId: 'IN2' }, { nodeId: c.id, pinId: 'GND' }, 0, false)
      if (bits[2]) addEdge({ nodeId: c.id, pinId: 'IN3' }, { nodeId: c.id, pinId: 'GND' }, 0, false)
    } else if (c.kind === 'relay') {
      const closed = Boolean(relayClosed[c.id])
      addEdge({ nodeId: c.id, pinId: 'COM' }, { nodeId: c.id, pinId: closed ? 'NO' : 'NC' }, 0, false)
    } else if (c.kind === 'potentiometer' || c.kind === 'slide-pot') {
      // 10kΩ variable rheostat/divider: turning knob smoothly varies series resistance when wired inline
      const pct = Math.max(0, Math.min(100, c.props.potPct ?? 50))
      const rTop = Math.max(20, Math.round(((100 - pct) / 100) * 10000))
      const rBot = Math.max(20, Math.round((pct / 100) * 10000))
      addEdge({ nodeId: c.id, pinId: 'VCC' }, { nodeId: c.id, pinId: 'SIG' }, rTop, true)
      addEdge({ nodeId: c.id, pinId: 'SIG' }, { nodeId: c.id, pinId: 'GND' }, rBot, true)
    } else if (isBreadboardKind(c.kind)) {
      const cols = c.kind === 'breadboard-mini' ? 17 : c.kind === 'breadboard-large' ? 63 : 30
      for (let col = 1; col <= cols; col++) {
        const topStrip = ['a', 'b', 'c', 'd', 'e'] as const
        const botStrip = ['f', 'g', 'h', 'i', 'j'] as const
        for (let r = 0; r < topStrip.length - 1; r++) {
          addEdge({ nodeId: c.id, pinId: `c${col}_${topStrip[r]}` }, { nodeId: c.id, pinId: `c${col}_${topStrip[r + 1]}` }, 0, false)
          addEdge({ nodeId: c.id, pinId: `c${col}_${botStrip[r]}` }, { nodeId: c.id, pinId: `c${col}_${botStrip[r + 1]}` }, 0, false)
        }
      }
      if (c.kind === 'breadboard' || c.kind === 'breadboard-large') {
        const railLen = c.kind === 'breadboard-large' ? 50 : 25
        for (const prefix of ['tp_', 'tn_', 'bp_', 'bn_'] as const) {
          for (let i = 1; i < railLen; i++) {
            addEdge({ nodeId: c.id, pinId: `${prefix}${i}` }, { nodeId: c.id, pinId: `${prefix}${i + 1}` }, 0, false)
          }
        }
      }
    }
  }
  return { adj }
}

/**
 * Shortest-resistance path search (Dijkstra) across wires, breadboards, closed switches, and resistors.
 * Tracks exact cumulative series resistance along the path and only marks `crossedResistor`
 * when traversing a true resistive element (never a breadboard trace).
 */
function traceElectricPaths(
  graph: NetGraph,
  start: WireEndpoint,
  options?: { allowResistive?: boolean },
): ReachNode[] {
  const allowResistive = options?.allowResistive ?? true
  const startKey = epKey(start)
  const best = new Map<string, ReachNode>([
    [startKey, { endpoint: start, ohms: 0, crossedResistor: false }],
  ])
  const queue: ReachNode[] = [{ endpoint: start, ohms: 0, crossedResistor: false }]

  while (queue.length > 0) {
    // Small graph: pop lowest-resistance node
    let bestIdx = 0
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].ohms < queue[bestIdx].ohms) bestIdx = i
    }
    const cur = queue.splice(bestIdx, 1)[0]
    const curKey = epKey(cur.endpoint)
    const recorded = best.get(curKey)
    if (recorded && cur.ohms > recorded.ohms) continue

    const neighbors = graph.adj.get(curKey) ?? []
    for (const edge of neighbors) {
      if (!allowResistive && edge.isResistor) continue
      const nextOhms = cur.ohms + edge.ohms
      const nextCrossed = cur.crossedResistor || edge.isResistor
      const nk = epKey(edge.to)
      const prev = best.get(nk)
      if (!prev || nextOhms < prev.ohms || (nextOhms === prev.ohms && !nextCrossed && prev.crossedResistor)) {
        const node: ReachNode = { endpoint: edge.to, ohms: nextOhms, crossedResistor: nextCrossed }
        best.set(nk, node)
        queue.push(node)
      }
    }
  }
  return Array.from(best.values())
}

function traceReachable(
  graph: NetGraph,
  start: WireEndpoint,
): { endpoints: WireEndpoint[]; crossedResistor: boolean; minResistorOhms: number | null; nodes: ReachNode[] } {
  const nodes = traceElectricPaths(graph, start, { allowResistive: true })
  const endpoints = nodes.map((n) => n.endpoint)
  const resistive = nodes.filter((n) => n.crossedResistor)
  const crossedResistor = resistive.length > 0
  const minResistorOhms = resistive.length > 0 ? Math.min(...resistive.map((n) => n.ohms)) : null
  return { endpoints, crossedResistor, minResistorOhms, nodes }
}

export function analyzeCircuitSafety(
  boardId: BoardId,
  components: PlacedComponent[],
  wires: Wire[],
  relayClosed: Record<string, boolean> = {},
): HardwareAlert[] {
  const alerts: HardwareAlert[] = []
  const graph = buildNetGraph(wires, components, relayClosed)
  const boardNodes = getBoardInstances(boardId, components)

  // Check Power <-> GND direct short circuit across every placed MCU
  for (const inst of boardNodes) {
    const board = BOARDS[inst.boardId]
    const powerPins = board.pins.filter((p) => p.kind === 'power')
    const gndPins = board.pins.filter((p) => p.kind === 'gnd')
    for (const pwr of powerPins) {
      const nodes = traceElectricPaths(graph, { nodeId: inst.nodeId, pinId: pwr.id })
      const directGnd = nodes.find((n) => {
        if (n.crossedResistor) return false
        const eb = resolveNodeBoardId(boardId, components, n.endpoint.nodeId)
        if (!eb) return false
        return (
          getBoardPin(eb, n.endpoint.pinId)?.kind === 'gnd' ||
          (n.endpoint.nodeId === inst.nodeId && gndPins.some((g) => g.id === n.endpoint.pinId))
        )
      })
      if (directGnd) {
        alerts.push({
          id: `short-${inst.nodeId}-${pwr.id}`,
          severity: 'error',
          messageId: `Short-Circuit (${inst.label})! Jalur ${pwr.label} terhubung langsung ke GND tanpa beban/resistor.`,
          messageEn: `Short-Circuit (${inst.label})! ${pwr.label} is wired directly to GND without a load or resistor.`,
        })
      }
      if (pwr.voltage === 5 && board.logicVoltage === 3.3) {
        const hitsGpio = nodes.some((n) => {
          if (n.crossedResistor && n.ohms >= 1000) return false
          const eb = resolveNodeBoardId(boardId, components, n.endpoint.nodeId)
          if (!eb) return false
          const bp = getBoardPin(eb, n.endpoint.pinId)
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

  // Check LED missing or undersized current-limiting resistor (supports Anode OR Cathode side resistor!)
  for (const c of components) {
    if (c.kind === 'led') {
      const anodePin = c.props.flip ? 'K' : 'A'
      const cathodePin = c.props.flip ? 'A' : 'K'
      const nodesA = traceElectricPaths(graph, { nodeId: c.id, pinId: anodePin })
      const nodesK = traceElectricPaths(graph, { nodeId: c.id, pinId: cathodePin })

      const sourceNode = nodesA.find((n) => {
        const eb = resolveNodeBoardId(boardId, components, n.endpoint.nodeId)
        if (!eb) return false
        const bp = getBoardPin(eb, n.endpoint.pinId)
        return Boolean(bp && (bp.kind === 'power' || bp.gpio !== undefined))
      })
      const gndNode = nodesK.find((n) => {
        const eb = resolveNodeBoardId(boardId, components, n.endpoint.nodeId)
        if (!eb) return false
        return getBoardPin(eb, n.endpoint.pinId)?.kind === 'gnd'
      })

      if (sourceNode && gndNode) {
        const hasRes = sourceNode.crossedResistor || gndNode.crossedResistor
        const totalOhms = (sourceNode.crossedResistor ? sourceNode.ohms : 0) + (gndNode.crossedResistor ? gndNode.ohms : 0)
        if (!hasRes) {
          alerts.push({
            id: `no-res-${c.id}`,
            severity: 'warn',
            messageId: `${c.label} belum memakai resistor seri (220Ω). Tambahkan resistor di sisi Anoda atau Katoda agar arus aman.`,
            messageEn: `${c.label} lacks a series 220Ω resistor. Add one on either the Anode or Cathode leg to limit LED current.`,
          })
        } else if (totalOhms < 47) {
          alerts.push({
            id: `low-res-${c.id}`,
            severity: 'warn',
            messageId: `Nilai resistor seri pada ${c.label} terlalu kecil (${Math.round(totalOhms)}Ω < 47Ω) — berisiko arus berlebih!`,
            messageEn: `Series resistor on ${c.label} is too low (${Math.round(totalOhms)}Ω < 47Ω) — risk of over-current!`,
          })
        }
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
  httpHandlers: Record<string, string>
  activeHttpPath: string
  extraFiles: SketchFile[]
}

export function normalizeWebPath(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return '/'
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed)
      return parsed.pathname || '/'
    } catch {
      const idx = trimmed.indexOf('/', trimmed.indexOf('://') + 3)
      const tail = idx >= 0 ? trimmed.slice(idx) : '/'
      return tail.split(/[?#]/)[0] || '/'
    }
  }
  const clean = trimmed.split(/[?#]/)[0] || '/'
  return clean.startsWith('/') ? clean : `/${clean}`
}

export function normalizeContentType(raw: string): 'text/html' | 'application/json' | 'text/plain' {
  const lower = raw.toLowerCase()
  if (lower.includes('html')) return 'text/html'
  if (lower.includes('json')) return 'application/json'
  return 'text/plain'
}

export function buildLiveWebReadings(
  sim: SimulationState,
  components: PlacedComponent[],
): Record<string, string | number | boolean> {
  const dht = components.find((c) => c.kind === 'dht22')
  const ultra = components.find((c) => c.kind === 'hc-sr04')
  const ldr = components.find((c) => c.kind === 'ldr')
  const mq2 = components.find((c) => c.kind === 'mq2')
  const pir = components.find((c) => c.kind === 'pir')
  const pot = components.find((c) => c.kind === 'potentiometer' || c.kind === 'slide-pot')
  const ntc = components.find((c) => c.kind === 'ntc')
  const bmp = components.find((c) => c.kind === 'bmp180')
  const hx = components.find((c) => c.kind === 'hx711')
  const mpu = components.find((c) => c.kind === 'mpu6050')

  const hasLedPart = components.some((c) => c.kind === 'led' || c.kind === 'rgb-led')
  const ledOn = hasLedPart
    ? Object.values(sim.ledBrightness).some((v) => !v.burned && (v.r > 0.05 || v.g > 0.05 || v.b > 0.05))
    : Object.values(sim.gpioStates).some((g) => g.mode === 'OUTPUT' && g.digital === 1)
  const relayOn = Object.values(sim.relayClosed).some(Boolean)
  const servoEntry = Object.values(sim.servoAngles)[0]
  const buzzerOn = Object.values(sim.buzzerActive).some((b) => b.active)

  const out: Record<string, string | number | boolean> = {
    WIFI_IP: sim.wifiIp || '0.0.0.0',
    WIFI_CONNECTED: sim.wifiConnected,
    UPTIME_SEC: Math.round((sim.elapsedMs || 0) / 100) / 10,
    LED_STATE: ledOn ? 'ON' : 'OFF',
    ledOn,
    RELAY_STATE: relayOn ? 'ON' : 'OFF',
    relayOn,
    BUZZER_STATE: buzzerOn ? 'ON' : 'OFF',
    buzzerOn,
  }

  if (dht) {
    const temp = Math.round((dht.props.tempC ?? 27.5) * 10) / 10
    const hum = Math.round((dht.props.humidity ?? 60) * 10) / 10
    out.TEMP = temp
    out.temp = temp
    out.HUMIDITY = hum
    out.humidity = hum
  }
  if (ultra) {
    const dist = Math.round((ultra.props.distanceCm ?? 42) * 10) / 10
    out.DISTANCE = dist
    out.DISTANCE_CM = dist
    out.distance = dist
  }
  if (ldr) {
    const lux = Math.round(ldr.props.lux ?? 500)
    out.LUX = lux
    out.lux = lux
  }
  if (mq2) {
    const gas = Math.round(mq2.props.gasPpm ?? 280)
    out.GAS = gas
    out.GAS_PPM = gas
    out.gas = gas
  }
  if (pir) {
    const motion = Boolean(pir.props.motion)
    out.MOTION = motion ? 'DETECTED' : 'CLEAR'
    out.motion = motion
  }
  if (pot) {
    const pct = Math.round(pot.props.potPct ?? 50)
    out.POT = pct
    out.POT_PCT = pct
    out.pot = pct
  }
  if (ntc) {
    const ntcT = Math.round((ntc.props.tempC ?? 25) * 10) / 10
    out.NTC_TEMP = ntcT
    out.ntcTemp = ntcT
  }
  if (bmp) {
    const press = Math.round(bmp.props.pressureHpa ?? 1013)
    out.PRESSURE = press
    out.pressure = press
  }
  if (hx) {
    const weight = Math.round((hx.props.weightKg ?? 1.2) * 100) / 100
    out.WEIGHT = weight
    out.weight = weight
  }
  if (mpu) {
    const tilt = Math.round(mpu.props.tiltDeg ?? 0)
    out.TILT = tilt
    out.tilt = tilt
  }
  if (servoEntry !== undefined) {
    out.SERVO_ANGLE = Math.round(servoEntry)
    out.servoAngle = Math.round(servoEntry)
  }
  return out
}

export function interpolateWebTemplate(
  raw: string,
  sim: SimulationState,
  readings?: Record<string, string | number | boolean>,
): string {
  const source = readings ?? sim.webSensorReadings
  return raw.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, rawKey: string) => {
    const upper = rawKey.toUpperCase()
    const val = source[rawKey] ?? source[upper] ?? source[rawKey.toLowerCase()]
    if (val === undefined) return '—'
    return String(val)
  })
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
    webServerActive: false,
    webRoutes: {},
    httpLogs: [],
    webSensorReadings: buildLiveWebReadings(
      {
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
        webServerActive: false,
        webRoutes: {},
        httpLogs: [],
        webSensorReadings: {},
        alerts: [],
      },
      components,
    ),
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
    httpHandlers: {},
    activeHttpPath: '/',
    extraFiles,
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
      httpHandlers: {},
      activeHttpPath: '/',
      extraFiles,
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
    const reach = traceReachable(ctx.graph, { nodeId: ctx.nodeId, pinId: pid })
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
      const pinModeState = ctx.localGpio[gpio]?.mode ?? 'INPUT'
      // Check connected switches & digital sensors with true electrical polarity awareness
      for (const pid of gpioPinIds(ctx.boardId, gpio)) {
        const directNodes = traceElectricPaths(ctx.graph, { nodeId: ctx.nodeId, pinId: pid }, { allowResistive: false })
        const allNodes = traceElectricPaths(ctx.graph, { nodeId: ctx.nodeId, pinId: pid }, { allowResistive: true })
        for (const n of directNodes) {
          if (n.endpoint.nodeId === ctx.nodeId) continue
          const comp = components.find((c) => c.id === n.endpoint.nodeId)
          if (!comp) continue
          if (comp.kind === 'pushbutton') {
            const otherPin = n.endpoint.pinId === 'OUT' ? 'GND' : 'OUT'
            const otherReach = traceElectricPaths(ctx.graph, { nodeId: comp.id, pinId: otherPin })
            const wiredToPower = otherReach.some((r) => {
              const rb = resolveNodeBoardId(ctx.boardId, components, r.endpoint.nodeId)
              return rb ? getBoardPin(rb, r.endpoint.pinId)?.kind === 'power' : false
            })
            const down = Boolean(comp.props.pressed || comp.props.latched)
            return wiredToPower ? (down ? 1 : 0) : down ? 0 : 1
          }
          if (comp.kind === 'slide-switch') {
            // If COM conducts to power -> HIGH, to GND -> LOW; otherwise match latch state
            const hitPwr = directNodes.some((r) => {
              const rb = resolveNodeBoardId(ctx.boardId, components, r.endpoint.nodeId)
              return rb ? getBoardPin(rb, r.endpoint.pinId)?.kind === 'power' : false
            })
            const hitGnd = directNodes.some((r) => {
              const rb = resolveNodeBoardId(ctx.boardId, components, r.endpoint.nodeId)
              return rb ? getBoardPin(rb, r.endpoint.pinId)?.kind === 'gnd' : false
            })
            if (hitPwr && !hitGnd) return 1
            if (hitGnd && !hitPwr) return 0
            return comp.props.latched || comp.props.pressed ? 0 : 1
          }
          if (comp.kind === 'dip-switch') {
            const bits = comp.props.dipBits ?? [0, 0, 0, 0, 0, 0, 0, 0]
            const idx = n.endpoint.pinId === 'IN1' ? 0 : n.endpoint.pinId === 'IN2' ? 1 : n.endpoint.pinId === 'IN3' ? 2 : -1
            if (idx >= 0) return pinModeState === 'INPUT_PULLUP' ? (bits[idx] ? 0 : 1) : bits[idx] ? 1 : 0
          }
          if (comp.kind === 'rotary-encoder' && n.endpoint.pinId === 'SW') {
            return comp.props.pressed ? 0 : 1
          }
          if (comp.kind === 'pir') return comp.props.motion ? 1 : 0
          if (comp.kind === 'mq2' && n.endpoint.pinId === 'DO') return (comp.props.gasPpm ?? 280) >= 600 ? 1 : 0
          if (comp.kind === 'ldr' && n.endpoint.pinId === 'AO') {
            const thr = comp.props.ldrThreshold ?? 500
            return (comp.props.lux ?? 500) < thr ? 1 : 0
          }
        }
        // Check wired peer MCU output or direct power/GND rail driving this pin
        for (const n of allNodes) {
          if (n.endpoint.nodeId === ctx.nodeId) continue
          const peer = ctx.allNodes?.get(n.endpoint.nodeId)
          if (!peer) continue
          const peerPin = getBoardPin(peer.boardId, n.endpoint.pinId)
          if (peerPin?.kind === 'power') return 1
          if (peerPin?.gpio !== undefined) {
            const pgs = peer.localGpio[peerPin.gpio]
            if (pgs && (pgs.mode === 'OUTPUT' || pgs.mode === 'PWM') && pgs.digital === 1) {
              return 1
            }
          }
        }
      }
      if (pinModeState === 'INPUT_PULLUP') return 1
      return ctx.localGpio[gpio]?.digital ?? 0
    }
    if (fn === 'analogRead') {
      const gpio = Number(args[0] ?? 0)
      const maxAdc = BOARDS[ctx.boardId].logicVoltage === 5 ? 1023 : 4095
      // Distinguish exact connected pin (e.g. Joystick HORZ vs VERT, Potentiometer SIG, LDR, NTC, MQ2)
      for (const pid of gpioPinIds(ctx.boardId, gpio)) {
        const direct = traceElectricPaths(ctx.graph, { nodeId: ctx.nodeId, pinId: pid }, { allowResistive: false })
        for (const n of direct) {
          if (n.endpoint.nodeId === ctx.nodeId) continue
          const comp = components.find((c) => c.id === n.endpoint.nodeId)
          if (!comp) continue
          if (comp.kind === 'potentiometer' || comp.kind === 'slide-pot') {
            return Math.round(((comp.props.potPct ?? 50) / 100) * maxAdc)
          }
          if (comp.kind === 'joystick') {
            const axisVal = n.endpoint.pinId === 'VERT' ? (comp.props.joyY ?? 512) : (comp.props.joyX ?? 512)
            return Math.round((axisVal / 1023) * maxAdc)
          }
          if (comp.kind === 'ldr') {
            // Wokwi LDR physics: higher lux -> lower resistance -> higher voltage divider reading
            const lux = Math.max(0.1, comp.props.lux ?? 500)
            const rl10 = (comp.props.ldrRl10 ?? 50) * 1000
            const gamma = comp.props.ldrGamma ?? 0.7
            const rLdr = rl10 * Math.pow(10 / lux, gamma)
            const vRatio = 10000 / (10000 + rLdr)
            return Math.round(Math.max(0, Math.min(1, vRatio)) * maxAdc)
          }
          if (comp.kind === 'mq2') {
            return Math.round((Math.min(2500, comp.props.gasPpm ?? 280) / 2500) * maxAdc)
          }
          if (comp.kind === 'ntc') {
            // Wokwi NTC Beta equation: higher temp -> lower thermistor resistance
            const beta = comp.props.ntcBeta ?? 3950
            const tempK = (comp.props.tempC ?? 25) + 273.15
            const rNtc = 10000 * Math.exp(beta * (1 / tempK - 1 / 298.15))
            const ratio = 1 / (1 + rNtc / 10000)
            return Math.round(Math.max(0, Math.min(1, ratio)) * maxAdc)
          }
        }
      }
      const pot = findConnectedComponent(ctx, components, gpio, 'potentiometer') ?? findConnectedComponent(ctx, components, gpio, 'slide-pot')
      if (pot) return Math.round(((pot.props.potPct ?? 50) / 100) * maxAdc)
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
    if (fn === 'WiFi.localIP') {
      return ctx.sim.wifiIp || '0.0.0.0'
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
      const rawA = evalExpr(s.slice(0, idx), ctx, components)
      const rawB = evalExpr(s.slice(idx + op.length), ctx, components)
      if (op === ' + ') {
        if (typeof rawA === 'string' || typeof rawB === 'string') {
          return String(rawA) + String(rawB)
        }
        return Number(rawA) + Number(rawB)
      }
      const a = Number(rawA)
      const b = Number(rawB)
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

function pushSerial(ctx: VmContext, text: string) {
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
      const reach = traceReachable(ctx.graph, { nodeId: ctx.nodeId, pinId: up.id })
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
      pushSerial(ctx, String(args[0] ?? ''))
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
    } else if (fn === 'server.begin' || fn === 'web.begin') {
      ctx.sim.webServerActive = true
      if (!ctx.sim.wifiConnected && BOARDS[ctx.boardId].hasWifi) {
        ctx.sim.wifiConnected = true
        ctx.sim.wifiIp = '10.13.37.2'
      }
    } else if (fn === 'server.on' || fn === 'web.on') {
      const path = normalizeWebPath(String(args[0] ?? '/'))
      const handlerName = (argsRaw[1] ?? '').trim()
      if (handlerName) {
        ctx.httpHandlers[path] = handlerName
      }
    } else if (fn === 'server.send' || fn === 'web.send') {
      const status = Number(args[0] ?? 200)
      const contentType = normalizeContentType(String(args[1] ?? 'text/html'))
      const body = String(args[2] ?? '')
      const routePath = ctx.activeHttpPath || '/'
      const route: WebServerRoute = {
        path: routePath,
        method: 'GET',
        status,
        contentType,
        body,
        updatedAtMs: ctx.sim.elapsedMs,
      }
      ctx.sim.webRoutes = {
        ...ctx.sim.webRoutes,
        [routePath]: route,
      }
      ctx.sim.webServerActive = true
    } else if (fn === 'server.sendRoute' || fn === 'web.sendRoute') {
      const routePath = normalizeWebPath(String(args[0] ?? '/'))
      const status = Number(args[1] ?? 200)
      const contentType = normalizeContentType(String(args[2] ?? 'text/html'))
      const body = String(args[3] ?? '')
      ctx.sim.webRoutes = {
        ...ctx.sim.webRoutes,
        [routePath]: {
          path: routePath,
          method: 'GET',
          status,
          contentType,
          body,
          updatedAtMs: ctx.sim.elapsedMs,
        },
      }
      ctx.sim.webServerActive = true
    } else if (fn === 'server.handleClient' || fn === 'web.handleClient') {
      ctx.sim.webServerActive = true
      if (!ctx.sim.wifiConnected && BOARDS[ctx.boardId].hasWifi) {
        ctx.sim.wifiConnected = true
        ctx.sim.wifiIp = '10.13.37.2'
      }
      refreshPassiveWebRoutes(ctx, components)
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

function computeLedForwardVoltage(color: string): number {
  switch (color) {
    case 'red':
    case 'orange':
    case 'yellow':
      return 1.85
    case 'green':
      return 2.05
    default:
      return 2.35
  }
}

function computeOhmicLedLevel(
  supplyVoltage: number,
  duty: number,
  hasResistor: boolean,
  totalOhms: number,
  color: string,
): { level: number; currentMa: number; burned: boolean; seriesOhms: number | null } {
  if (duty <= 0 || supplyVoltage <= 0) {
    return { level: 0, currentMa: 0, burned: false, seriesOhms: hasResistor ? Math.round(totalOhms) : null }
  }
  const vf = computeLedForwardVoltage(color)
  const vHeadroom = Math.max(0.1, supplyVoltage - vf)
  if (!hasResistor) {
    const overMa = Math.round(vHeadroom * 35 * duty * 10) / 10
    return { level: duty, currentMa: overMa, burned: true, seriesOhms: null }
  }
  if (totalOhms < 47) {
    const overMa = Math.round((vHeadroom / Math.max(1, totalOhms)) * 1000 * duty * 10) / 10
    return { level: duty, currentMa: overMa, burned: true, seriesOhms: Math.round(totalOhms) }
  }
  // Real Ohm's law current: I = (Vs - Vf) / R_total
  const iPeakMa = (vHeadroom / totalOhms) * 1000
  const iAvgMa = iPeakMa * duty
  // Nominal bright LED current scales with board supply (6.5mA @ 3.3V / 220Ω, 14mA @ 5V / 220Ω)
  const nominalMa = supplyVoltage >= 4.5 ? 14 : 6.5
  const ratio = Math.max(0, Math.min(1, iPeakMa / nominalMa))
  // Perceptual brightness curve (human vision is non-linear; clearly separates 220Ω, 470Ω, 1kΩ, 4.7kΩ, 10kΩ, 100kΩ, 1MΩ)
  const perceptual = ratio < 0.0008 ? 0 : Math.pow(ratio, 0.58)
  const level = Math.max(0, Math.min(1, perceptual * duty))
  return {
    level,
    currentMa: Math.round(iAvgMa * 100) / 100,
    burned: false,
    seriesOhms: Math.round(totalOhms),
  }
}

export function syncCircuitActuators(ctx: VmContext, components: PlacedComponent[], wires: Wire[]) {
  // Pass 1: Evaluate relay coil states first so relay COM<->NO/NC switches conduct for downstream loads!
  const baseGraph = buildNetGraph(wires, components, ctx.sim.relayClosed)

  const readPinSourceFromGraph = (
    graph: NetGraph,
    ep: WireEndpoint,
  ): { duty: number; voltage: number; hasResistor: boolean; seriesOhms: number } => {
    const nodes = traceElectricPaths(graph, ep, { allowResistive: true })
    let bestDuty = 0
    let bestVoltage = 0
    let bestHasRes = false
    let bestOhms = 0
    let bestScore = -1

    for (const n of nodes) {
      const rb = resolveNodeBoardId(ctx.boardId, components, n.endpoint.nodeId)
      if (!rb) continue
      const bp = getBoardPin(rb, n.endpoint.pinId)
      if (!bp) continue
      let duty = 0
      let voltage = 0
      if (bp.kind === 'power') {
        duty = 1
        voltage = bp.voltage || BOARDS[rb].logicVoltage
      } else if (bp.gpio !== undefined) {
        const owner = ctx.allNodes?.get(n.endpoint.nodeId)
        const gs = owner ? owner.localGpio[bp.gpio] : n.endpoint.nodeId === 'board' ? ctx.sim.gpioStates[bp.gpio] : undefined
        if (gs && gs.mode === 'OUTPUT' && gs.digital === 1) {
          duty = 1
          voltage = BOARDS[rb].logicVoltage
        } else if (gs && gs.mode === 'PWM' && gs.pwmDuty > 0) {
          duty = gs.pwmDuty / 255
          voltage = BOARDS[rb].logicVoltage
        }
      }
      if (duty > 0) {
        // Prefer strongest source (highest voltage / lowest path resistance)
        const score = duty * voltage * 100000 - n.ohms
        if (score > bestScore) {
          bestScore = score
          bestDuty = duty
          bestVoltage = voltage
          bestHasRes = n.crossedResistor
          bestOhms = n.ohms
        }
      }
    }
    return { duty: bestDuty, voltage: bestVoltage, hasResistor: bestHasRes, seriesOhms: bestOhms }
  }

  for (const c of components) {
    if (c.kind === 'relay') {
      const sig = readPinSourceFromGraph(baseGraph, { nodeId: c.id, pinId: 'IN' })
      ctx.sim.relayClosed[c.id] = c.props.relayTransistor === 'pnp' ? sig.duty < 0.5 : sig.duty > 0.5
    }
  }

  // Pass 2: Rebuild graph with updated relay contacts so loads wired through COM->NO/NC update immediately
  ctx.graph = buildNetGraph(wires, components, ctx.sim.relayClosed)
  ctx.sim.alerts = analyzeCircuitSafety(ctx.boardId, components, wires, ctx.sim.relayClosed)

  const readPinSource = (ep: WireEndpoint) => readPinSourceFromGraph(ctx.graph, ep)

  const readGroundPath = (ep: WireEndpoint): { grounded: boolean; hasResistor: boolean; seriesOhms: number } => {
    const nodes = traceElectricPaths(ctx.graph, ep, { allowResistive: true })
    let best: { grounded: boolean; hasResistor: boolean; seriesOhms: number } | null = null
    for (const n of nodes) {
      const rb = resolveNodeBoardId(ctx.boardId, components, n.endpoint.nodeId)
      if (!rb) continue
      const bp = getBoardPin(rb, n.endpoint.pinId)
      if (bp?.kind === 'gnd') {
        if (!best || n.ohms < best.seriesOhms) {
          best = { grounded: true, hasResistor: n.crossedResistor, seriesOhms: n.ohms }
        }
      }
    }
    return best ?? { grounded: false, hasResistor: false, seriesOhms: 0 }
  }

  const nextBuzzers: Record<string, { freq: number; active: boolean }> = {}
  const nextBarGraph: Record<string, number> = {}
  const nowMs = Date.now()

  for (const c of components) {
    if (c.kind === 'led') {
      const anodePin = c.props.flip ? 'K' : 'A'
      const cathodePin = c.props.flip ? 'A' : 'K'
      const src = readPinSource({ nodeId: c.id, pinId: anodePin })
      const gnd = readGroundPath({ nodeId: c.id, pinId: cathodePin })
      const clr = c.color ?? 'red'
      if (!gnd.grounded || src.duty <= 0) {
        const anyRes = src.hasResistor || gnd.hasResistor
        const anyOhms = (src.hasResistor ? src.seriesOhms : 0) + (gnd.hasResistor ? gnd.seriesOhms : 0)
        ctx.sim.ledBrightness[c.id] = {
          r: 0,
          g: 0,
          b: 0,
          burned: false,
          currentMa: 0,
          seriesOhms: anyRes ? Math.round(anyOhms) : null,
        }
      } else {
        const hasResistor = src.hasResistor || gnd.hasResistor
        const totalOhms = (src.hasResistor ? src.seriesOhms : 0) + (gnd.hasResistor ? gnd.seriesOhms : 0)
        const opt = computeOhmicLedLevel(src.voltage, src.duty, hasResistor, totalOhms, clr)
        const level = opt.level
        ctx.sim.ledBrightness[c.id] = {
          r: clr === 'red' || clr === 'yellow' || clr === 'orange' || clr === 'white' || clr === 'purple' ? level : 0,
          g: clr === 'green' || clr === 'yellow' || clr === 'cyan' || clr === 'white' ? level : clr === 'orange' ? level * 0.5 : 0,
          b: clr === 'blue' || clr === 'cyan' || clr === 'white' || clr === 'purple' ? level : 0,
          burned: opt.burned,
          currentMa: opt.currentMa,
          seriesOhms: opt.seriesOhms,
        }
      }
    } else if (c.kind === 'rgb-led') {
      const isCommonAnode = c.props.common === 'anode'
      if (isCommonAnode) {
        const com = readPinSource({ nodeId: c.id, pinId: 'GND' })
        const evalCh = (pinId: 'R' | 'G' | 'B', color: string) => {
          if (com.duty <= 0.5) return { level: 0, currentMa: 0, burned: false, seriesOhms: null }
          const chSrc = readPinSource({ nodeId: c.id, pinId })
          const chGnd = readGroundPath({ nodeId: c.id, pinId })
          const sinkDuty = chSrc.duty > 0 ? Math.max(0, 1 - chSrc.duty) : chGnd.grounded ? 1 : 0
          if (sinkDuty <= 0) return { level: 0, currentMa: 0, burned: false, seriesOhms: null }
          const hasRes = com.hasResistor || chSrc.hasResistor || chGnd.hasResistor
          const ohms = (com.hasResistor ? com.seriesOhms : 0) + (chSrc.hasResistor ? chSrc.seriesOhms : chGnd.hasResistor ? chGnd.seriesOhms : 0)
          return computeOhmicLedLevel(com.voltage || 5, sinkDuty, hasRes, ohms, color)
        }
        const r = evalCh('R', 'red')
        const g = evalCh('G', 'green')
        const b = evalCh('B', 'blue')
        ctx.sim.ledBrightness[c.id] = {
          r: r.level,
          g: g.level,
          b: b.level,
          currentMa: Math.round((r.currentMa + g.currentMa + b.currentMa) * 100) / 100,
          seriesOhms: r.seriesOhms ?? g.seriesOhms ?? b.seriesOhms,
        }
      } else {
        const gnd = readGroundPath({ nodeId: c.id, pinId: 'GND' })
        const evalCh = (pinId: 'R' | 'G' | 'B', color: string) => {
          if (!gnd.grounded) return { level: 0, currentMa: 0, burned: false, seriesOhms: null }
          const ch = readPinSource({ nodeId: c.id, pinId })
          if (ch.duty <= 0) return { level: 0, currentMa: 0, burned: false, seriesOhms: null }
          const hasRes = ch.hasResistor || gnd.hasResistor
          const ohms = (ch.hasResistor ? ch.seriesOhms : 0) + (gnd.hasResistor ? gnd.seriesOhms : 0)
          return computeOhmicLedLevel(ch.voltage, ch.duty, hasRes, ohms, color)
        }
        const r = evalCh('R', 'red')
        const g = evalCh('G', 'green')
        const b = evalCh('B', 'blue')
        ctx.sim.ledBrightness[c.id] = {
          r: r.level,
          g: g.level,
          b: b.level,
          currentMa: Math.round((r.currentMa + g.currentMa + b.currentMa) * 100) / 100,
          seriesOhms: r.seriesOhms ?? g.seriesOhms ?? b.seriesOhms,
        }
      }
    } else if (c.kind === 'led-bar-graph') {
      const src = readPinSource({ nodeId: c.id, pinId: 'IN' })
      const gnd = readGroundPath({ nodeId: c.id, pinId: 'GND' })
      if (gnd.grounded && src.duty > 0) {
        const opt = computeOhmicLedLevel(src.voltage, src.duty, src.hasResistor || gnd.hasResistor, src.seriesOhms + gnd.seriesOhms, 'green')
        nextBarGraph[c.id] = Math.max(0, Math.min(10, Math.round(opt.level * 10)))
      } else {
        nextBarGraph[c.id] = 0
      }
    } else if (c.kind === 'buzzer') {
      const readPinToneFreq = (ep: WireEndpoint): number => {
        const reach = traceReachable(ctx.graph, ep)
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
      const posSig = readPinSource({ nodeId: c.id, pinId: 'POS' })
      const posTone = readPinToneFreq({ nodeId: c.id, pinId: 'POS' })
      const gndOk = readGroundPath({ nodeId: c.id, pinId: 'GND' }).grounded
      const swapSig = readPinSource({ nodeId: c.id, pinId: 'GND' })
      const swapTone = readPinToneFreq({ nodeId: c.id, pinId: 'GND' })
      const swapGndOk = readGroundPath({ nodeId: c.id, pinId: 'POS' }).grounded
      const forwardActive = gndOk && (posTone > 0 || posSig.duty > 0)
      const reverseActive = swapGndOk && (swapTone > 0 || swapSig.duty > 0)
      const active = forwardActive || reverseActive
      const freq = forwardActive ? (posTone > 0 ? posTone : 1000) : reverseActive ? (swapTone > 0 ? swapTone : 1000) : 0
      nextBuzzers[c.id] = { freq, active }
    }
  }
  ctx.sim.buzzerActive = nextBuzzers
  ctx.sim.barGraphLevels = nextBarGraph

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

function isPassiveGetRoute(path: string): boolean {
  return !/\/(on|off|toggle|open|close|set|reset|unlock|lock|buzz)(\/|$)/i.test(path)
}

function refreshPassiveWebRoutes(ctx: VmContext, components: PlacedComponent[]) {
  if (ctx.vars.__inPassiveRefresh) return
  ctx.vars.__inPassiveRefresh = 1
  try {
    for (const [routePath, handlerName] of Object.entries(ctx.httpHandlers)) {
      if (!isPassiveGetRoute(routePath)) continue
      const body = ctx.sketch.helpers[handlerName]
      if (!body) continue
      ctx.activeHttpPath = routePath
      runStatements(body, ctx, components)
    }
  } finally {
    ctx.activeHttpPath = '/'
    delete ctx.vars.__inPassiveRefresh
  }
}

export function syncWebServerState(ctx: VmContext, components: PlacedComponent[]) {
  const readings = buildLiveWebReadings(ctx.sim, components)
  ctx.sim.webSensorReadings = readings

  const htmlFile =
    ctx.extraFiles.find((f) => f.name.toLowerCase() === 'index.html') ??
    ctx.extraFiles.find((f) => f.name.toLowerCase().endsWith('.html'))

  const hasBrowser = components.some((c) => c.kind === 'web-browser')
  if (htmlFile && (BOARDS[ctx.boardId].hasWifi || hasBrowser)) {
    ctx.sim.webServerActive = true
    if (!ctx.sim.wifiConnected && BOARDS[ctx.boardId].hasWifi) {
      ctx.sim.wifiConnected = true
      ctx.sim.wifiIp = ctx.sim.wifiIp === '0.0.0.0' ? '10.13.37.2' : ctx.sim.wifiIp
    } else if (ctx.sim.wifiIp === '0.0.0.0') {
      ctx.sim.wifiIp = '10.13.37.2'
    }
    if (!ctx.httpHandlers['/']) {
      ctx.sim.webRoutes = {
        ...ctx.sim.webRoutes,
        '/': {
          path: '/',
          method: 'GET',
          status: 200,
          contentType: 'text/html',
          body: interpolateWebTemplate(htmlFile.content, ctx.sim, readings),
          updatedAtMs: ctx.sim.elapsedMs,
        },
      }
    }
  }

  const cssFile = ctx.extraFiles.find((f) => f.name.toLowerCase().endsWith('.css'))
  if (ctx.sim.webServerActive && cssFile) {
    const cssPath = normalizeWebPath(cssFile.name)
    ctx.sim.webRoutes = {
      ...ctx.sim.webRoutes,
      [cssPath]: {
        path: cssPath,
        method: 'GET',
        status: 200,
        contentType: 'text/plain',
        body: cssFile.content,
        updatedAtMs: ctx.sim.elapsedMs,
      },
    }
  }
}

export function invokeVirtualWebRoute(
  ctx: VmContext,
  components: PlacedComponent[],
  wires: Wire[],
  method: 'GET' | 'POST',
  rawUrl: string,
): { status: number; contentType: string; body: string; path: string } {
  const path = normalizeWebPath(rawUrl)
  ctx.graph = buildNetGraph(wires, components)

  const candidates = [ctx, ...ctx.peers]
  let handled = false
  for (const node of candidates) {
    const handlerName = node.httpHandlers[path]
    if (handlerName && node.sketch.helpers[handlerName]) {
      node.activeHttpPath = path
      runStatements(node.sketch.helpers[handlerName], node, components)
      node.activeHttpPath = '/'
      handled = true
      break
    }
  }

  if (handled) {
    syncCircuitActuators(ctx, components, wires)
    syncWebServerState(ctx, components)
  } else {
    syncWebServerState(ctx, components)
  }

  let route = ctx.sim.webRoutes[path]
  let status = route?.status ?? 404
  let contentType = route?.contentType ?? 'text/plain'
  let body = route?.body ?? ''

  if (!route) {
    if (!ctx.sim.webServerActive) {
      status = 503
      contentType = 'text/plain'
      body = '503 Service Unavailable — Jalankan simulasi dengan server.begin() atau tambahkan file index.html.'
    } else if (path === '/api/sensors') {
      status = 200
      contentType = 'application/json'
      body = JSON.stringify(
        {
          ok: true,
          wifiIp: ctx.sim.wifiIp,
          uptimeSec: Math.round((ctx.sim.elapsedMs || 0) / 100) / 10,
          readings: ctx.sim.webSensorReadings,
        },
        null,
        2,
      )
      route = {
        path,
        method,
        status,
        contentType: 'application/json',
        body,
        updatedAtMs: ctx.sim.elapsedMs,
      }
      ctx.sim.webRoutes = { ...ctx.sim.webRoutes, [path]: route }
    } else {
      status = 404
      contentType = 'text/plain'
      body = `404 Not Found: ${path}`
    }
  } else if (contentType.includes('html')) {
    body = interpolateWebTemplate(body, ctx.sim, ctx.sim.webSensorReadings)
  }

  const entry: HttpRequestLog = {
    id: `http-${ctx.sim.httpLogs.length + 1}-${Date.now()}`,
    timeMs: ctx.sim.elapsedMs,
    method,
    url: path,
    status,
    contentType,
    body: body.slice(0, 500),
  }
  ctx.sim.httpLogs = [...ctx.sim.httpLogs.slice(-29), entry]

  return { status, contentType, body, path }
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
  syncWebServerState(ctx, components)
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
  syncWebServerState(ctx, components)
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
  const syncInfo = analyzeProjectFileSync(code, extraFiles)
  const compiled = compileArduinoSketch(code, extraFiles)
  const extraMcus = components.filter((c) => c.kind === 'mcu' && c.id !== 'board')

  if (syncInfo.missingIncludes.length > 0) {
    items.push({
      id: 'diag-sync-missing',
      status: 'error',
      textId: `Sinkronisasi file gagal: #include "${syncInfo.missingIncludes.join('", "')}" belum ada di proyek.`,
      textEn: `File sync error: missing local include "${syncInfo.missingIncludes.join('", "')}".`,
    })
  } else if (extraFiles.length > 0) {
    items.push({
      id: 'diag-sync-ok',
      status: 'ok',
      textId: `Sinkronisasi multi-file aktif (${syncInfo.linkedFiles.join(' + ')} + diagram.json).`,
      textEn: `Multi-file workspace synced (${syncInfo.linkedFiles.join(' + ')} + diagram.json).`,
    })
  }

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
  const unwiredParts = activeParts.filter(
    (c) => c.kind !== 'web-browser' && !wires.some((w) => w.from.nodeId === c.id || w.to.nodeId === c.id),
  )
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
      const reachA = traceReachable(graph, { nodeId: c.id, pinId: anodePin })
      const reachK = traceReachable(graph, { nodeId: c.id, pinId: cathodePin })
      const aHitsGnd = reachA.endpoints.some(isBoardGnd)
      const kHitsPwr = reachK.endpoints.some(isBoardPwrOrGpio)
      return aHitsGnd && kHitsPwr
    })
    const ungroundedLed = activeParts.find((c) => {
      if (c.kind !== 'led') return false
      const cathodePin = c.props.flip ? 'A' : 'K'
      const reach = traceReachable(graph, { nodeId: c.id, pinId: cathodePin })
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
