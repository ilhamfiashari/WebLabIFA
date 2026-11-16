import { useEffect, useRef, useState } from 'react'
import {
  CheckSquare,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  BOARDS,
  RESISTOR_DIGIT_BANDS,
  RESISTOR_MULTIPLIER_BANDS,
  RESISTOR_QUICK_VALUES,
  WIRE_COLORS,
  decodeResistorBands,
  formatOhms,
  getBoardInstances,
  getBoardPin,
  getComponentSpec,
} from './boards'
import { BoardHardwareView, ComponentHardwareView } from './CircuitSvgComponents'
import type {
  BoardId,
  PlacedComponent,
  SimulationState,
  Wire,
  WireEndpoint,
  WireWaypoint,
} from './types'

const SVG_W = 860
const SVG_H = 480

interface EndpointGeometry {
  x: number
  y: number
  sx: number
  sy: number
  side: 'left' | 'right' | 'down' | 'up'
  boardNode?: { x: number; y: number; width: number; height: number }
}

function getEndpointGeometry(
  primaryBoardId: BoardId,
  components: PlacedComponent[],
  ep: WireEndpoint,
): EndpointGeometry | null {
  const boards = getBoardInstances(primaryBoardId, components)
  const inst = boards.find((b) => b.nodeId === ep.nodeId)
  if (inst) {
    const spec = BOARDS[inst.boardId]
    const p = getBoardPin(inst.boardId, ep.pinId)
    if (!p) return null
    const x = inst.x + p.x
    const y = inst.y + p.y
    const boardNode = { x: inst.x, y: inst.y, width: spec.width, height: spec.height }
    if (p.side === 'left') {
      return { x, y, sx: inst.x - 18, sy: y, side: 'left', boardNode }
    }
    return { x, y, sx: inst.x + spec.width + 18, sy: y, side: 'right', boardNode }
  }
  const comp = components.find((c) => c.id === ep.nodeId && c.kind !== 'mcu')
  if (!comp) return null
  const spec = getComponentSpec(comp.kind)
  const pin = spec.pins.find((p) => p.id === ep.pinId)
  if (!pin) return null
  const x = comp.x + pin.dx
  const y = comp.y + pin.dy
  if (comp.kind === 'resistor' || comp.kind === 'pushbutton') {
    if (pin.dx < spec.width / 2) return { x, y, sx: x - 14, sy: y, side: 'left' }
    return { x, y, sx: x + 14, sy: y, side: 'right' }
  }
  return { x, y, sx: x, sy: y + 12, side: 'down' }
}

function findNearestPin(
  primaryBoardId: BoardId,
  components: PlacedComponent[],
  x: number,
  y: number,
  maxDist = 18,
): (WireEndpoint & { x: number; y: number }) | null {
  let best: (WireEndpoint & { x: number; y: number }) | null = null
  let bestDist = maxDist
  for (const inst of getBoardInstances(primaryBoardId, components)) {
    for (const p of BOARDS[inst.boardId].pins) {
      const px = inst.x + p.x
      const py = inst.y + p.y
      const d = Math.hypot(px - x, py - y)
      if (d <= bestDist) {
        bestDist = d
        best = { nodeId: inst.nodeId, pinId: p.id, x: px, y: py }
      }
    }
  }
  for (const comp of components) {
    if (comp.kind === 'mcu') continue
    const spec = getComponentSpec(comp.kind)
    for (const p of spec.pins) {
      const px = comp.x + p.dx
      const py = comp.y + p.dy
      const d = Math.hypot(px - x, py - y)
      if (d <= bestDist) {
        bestDist = d
        best = { nodeId: comp.id, pinId: p.id, x: px, y: py }
      }
    }
  }
  return best
}

function computeAutoWaypoints(
  a: EndpointGeometry,
  b: EndpointGeometry,
  offsetIdx: number,
): WireWaypoint[] {
  const lane = (offsetIdx % 4) * 10
  const refBoard = a.boardNode ?? b.boardNode

  // Avoid crossing straight over an MCU PCB body when connecting left-edge pin to right-side parts
  if (refBoard) {
    const crossesBoardLR =
      (a.side === 'left' && b.x > refBoard.x + refBoard.width) ||
      (b.side === 'left' && a.x > refBoard.x + refBoard.width)
    if (crossesBoardLR) {
      const leftPt = a.side === 'left' ? a : b
      const rightPt = a.side === 'left' ? b : a
      const goTop = leftPt.y < refBoard.y + refBoard.height / 2
      const clearY = goTop ? Math.max(18, refBoard.y - 18 - lane) : Math.min(SVG_H - 18, refBoard.y + refBoard.height + 18 + lane)
      const rightTurnX = rightPt.side === 'down' ? rightPt.x : rightPt.sx
      const pts: WireWaypoint[] = [
        { x: leftPt.sx, y: leftPt.y },
        { x: leftPt.sx, y: clearY },
        { x: rightTurnX, y: clearY },
      ]
      if (rightPt.side !== 'down') {
        pts.push({ x: rightTurnX, y: rightPt.y })
      }
      return a.side === 'left' ? pts : pts.reverse()
    }
  }

  // Clean orthogonal jumper without protruding spikes on vertical pins (LED/sensors)
  const startX = a.side === 'down' ? a.x : a.sx
  const endX = b.side === 'down' ? b.x : b.sx

  if (a.side === 'right' && b.side === 'down') {
    if (b.y > a.y + 8) {
      return [
        { x: a.sx + lane * 0.4, y: a.y },
        { x: b.x, y: a.y },
      ]
    }
    const clearY = b.y + 14 + lane * 0.4
    return [
      { x: a.sx, y: a.y },
      { x: a.sx, y: clearY },
      { x: b.x, y: clearY },
    ]
  }
  if (b.side === 'right' && a.side === 'down') {
    if (a.y > b.y + 8) {
      return [
        { x: a.x, y: b.y },
        { x: b.sx + lane * 0.4, y: b.y },
      ]
    }
    const clearY = a.y + 14 + lane * 0.4
    return [
      { x: a.x, y: clearY },
      { x: b.sx, y: clearY },
      { x: b.sx, y: b.y },
    ]
  }

  const midX = Math.round((startX + endX) / 2) + ((offsetIdx % 3) - 1) * 8
  const pts: WireWaypoint[] = []
  if (a.side !== 'down') pts.push({ x: a.sx, y: a.y })
  pts.push({ x: midX, y: a.y }, { x: midX, y: b.y })
  if (b.side !== 'down') pts.push({ x: b.sx, y: b.y })
  return pts
}

function resolveWireWaypoints(
  a: EndpointGeometry,
  b: EndpointGeometry,
  wire: Wire,
  offsetIdx: number,
): WireWaypoint[] {
  if (wire.waypoints && wire.waypoints.length > 0) {
    return wire.waypoints
  }
  if (wire.bendX !== undefined && wire.bendY !== undefined) {
    return [{ x: wire.bendX, y: wire.bendY }]
  }
  return computeAutoWaypoints(a, b, offsetIdx)
}

function buildPolylinePath(pts: WireWaypoint[]): string {
  return pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${Math.round(p.x)} ${Math.round(p.y)}`).join(' ')
}

function closestSegmentIndex(pts: WireWaypoint[], x: number, y: number): number {
  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const lenSq = dx * dx + dy * dy
    const t = lenSq > 0 ? Math.max(0, Math.min(1, ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq)) : 0
    const projX = p1.x + t * dx
    const projY = p1.y + t * dy
    const d = Math.hypot(x - projX, y - projY)
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }
  return bestIdx
}

export function CircuitCanvas({
  boardId,
  components,
  wires,
  sim,
  wireColor,
  isDark,
  lang,
  onStartStop,
  onReset,
  onCheckCircuit,
  onMoveBoardOrComponent,
  onUpdateComponent,
  onUpdateProps,
  onAddWire,
  onUpdateWire,
  onDeleteWire,
  onDeleteNode,
  onSelectPrimaryBoard,
}: {
  boardId: BoardId
  components: PlacedComponent[]
  wires: Wire[]
  sim: SimulationState
  wireColor: string
  isDark: boolean
  lang: 'id' | 'en'
  onStartStop: () => void
  onReset: () => void
  onCheckCircuit: () => void
  onMoveBoardOrComponent: (nodeId: string, x: number, y: number) => void
  onUpdateComponent: (id: string, patch: Partial<PlacedComponent>) => void
  onUpdateProps: (id: string, patch: Partial<PlacedComponent['props']>) => void
  onAddWire: (from: WireEndpoint, to: WireEndpoint) => void
  onUpdateWire: (wireId: string, patch: Partial<Wire>) => void
  onDeleteWire: (wireId: string) => void
  onDeleteNode: (nodeId: string) => void
  onSelectPrimaryBoard?: (boardId: BoardId) => void
}) {
  const en = lang === 'en'
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [showLabels, setShowLabels] = useState(true)
  const [selectedPin, setSelectedPin] = useState<WireEndpoint | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null)
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null)
  const [snapHighlight, setSnapHighlight] = useState<{ x: number; y: number } | null>(null)

  const [drawingPreview, setDrawingPreview] = useState<{
    from: WireEndpoint
    ax: number
    ay: number
    curX: number
    curY: number
    dragged: boolean
    startClientX: number
    startClientY: number
    /** When set, unplugs and re-attaches either end of an existing wire */
    replug?: { wireId: string; end: 'from' | 'to'; color: string }
  } | null>(null)

  const nodeDragRef = useRef<{
    nodeId: string
    startClientX: number
    startClientY: number
    origX: number
    origY: number
    moved: boolean
  } | null>(null)

  const waypointDragRef = useRef<{
    wireId: string
    index: number
    waypoints: WireWaypoint[]
  } | null>(null)
  const suppressNextClickRef = useRef(false)

  const boardInstances = getBoardInstances(boardId, components)

  const clientToSvg = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const ctm = svg.getScreenCTM()
    if (ctm) {
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const transformed = pt.matrixTransform(ctm.inverse())
      return { x: transformed.x, y: transformed.y }
    }
    const rect = svg.getBoundingClientRect()
    const vbW = Math.round(SVG_W / zoom)
    const vbH = Math.round(SVG_H / zoom)
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * vbW,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * vbH,
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWireId) {
          onDeleteWire(selectedWireId)
          setSelectedWireId(null)
        } else if (selectedNodeId && selectedNodeId !== 'board') {
          onDeleteNode(selectedNodeId)
          setSelectedNodeId(null)
          setInspectedNodeId(null)
        }
      } else if (e.key === 'Escape') {
        setSelectedPin(null)
        setSelectedWireId(null)
        setSelectedNodeId(null)
        setInspectedNodeId(null)
        setDrawingPreview(null)
        setSnapHighlight(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedWireId, selectedNodeId, onDeleteWire, onDeleteNode])

  const onPinPointerDown = (ep: WireEndpoint, clientX: number, clientY: number) => {
    suppressNextClickRef.current = false
    setSelectedWireId(null)
    setInspectedNodeId(null)
    // Click-to-click connection if a start pin is already selected
    if (selectedPin && !(selectedPin.nodeId === ep.nodeId && selectedPin.pinId === ep.pinId)) {
      onAddWire(selectedPin, ep)
      setSelectedPin(null)
      setDrawingPreview(null)
      return
    }
    const geo = getEndpointGeometry(boardId, components, ep)
    if (!geo) return
    setDrawingPreview({
      from: ep,
      ax: geo.x,
      ay: geo.y,
      curX: geo.x,
      curY: geo.y,
      dragged: false,
      startClientX: clientX,
      startClientY: clientY,
    })
  }

  const onPinPointerUp = (ep: WireEndpoint) => {
    if (!drawingPreview) return
    setSnapHighlight(null)
    if (drawingPreview.replug) {
      const { wireId, end } = drawingPreview.replug
      const sameAsAnchor = drawingPreview.from.nodeId === ep.nodeId && drawingPreview.from.pinId === ep.pinId
      if (!sameAsAnchor) {
        onUpdateWire(wireId, { [end]: ep, waypoints: undefined, bendX: undefined, bendY: undefined })
      }
      setDrawingPreview(null)
      return
    }
    const samePin = drawingPreview.from.nodeId === ep.nodeId && drawingPreview.from.pinId === ep.pinId
    if (!samePin) {
      onAddWire(drawingPreview.from, ep)
      setSelectedPin(null)
      setDrawingPreview(null)
      return
    }
    if (!drawingPreview.dragged) {
      setSelectedPin((prev) =>
        prev && prev.nodeId === ep.nodeId && prev.pinId === ep.pinId ? null : ep,
      )
    }
    setDrawingPreview(null)
  }

  const startNodeDrag = (nodeId: string, clientX: number, clientY: number) => {
    setSelectedWireId(null)
    setSelectedNodeId(nodeId)
    const boardInst = boardInstances.find((b) => b.nodeId === nodeId)
    if (boardInst) {
      nodeDragRef.current = {
        nodeId,
        startClientX: clientX,
        startClientY: clientY,
        origX: boardInst.x,
        origY: boardInst.y,
        moved: false,
      }
      return
    }
    const comp = components.find((c) => c.id === nodeId)
    if (!comp) return
    nodeDragRef.current = {
      nodeId,
      startClientX: clientX,
      startClientY: clientY,
      origX: comp.x,
      origY: comp.y,
      moved: false,
    }
  }

  const startUnplugDrag = (wire: Wire, end: 'from' | 'to', clientX: number, clientY: number) => {
    const anchorEp = end === 'from' ? wire.to : wire.from
    const anchorGeo = getEndpointGeometry(boardId, components, anchorEp)
    if (!anchorGeo) return
    const pt = clientToSvg(clientX, clientY)
    setSelectedPin(null)
    setInspectedNodeId(null)
    setDrawingPreview({
      from: anchorEp,
      ax: anchorGeo.x,
      ay: anchorGeo.y,
      curX: pt.x,
      curY: pt.y,
      dragged: true,
      startClientX: clientX,
      startClientY: clientY,
      replug: { wireId: wire.id, end, color: wire.color || wireColor },
    })
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = clientToSvg(e.clientX, e.clientY)
    if (drawingPreview) {
      const moved =
        Math.hypot(e.clientX - drawingPreview.startClientX, e.clientY - drawingPreview.startClientY) > 6
      const near = findNearestPin(boardId, components, pt.x, pt.y)
      if (near && !(near.nodeId === drawingPreview.from.nodeId && near.pinId === drawingPreview.from.pinId)) {
        setSnapHighlight({ x: near.x, y: near.y })
      } else {
        setSnapHighlight(null)
      }
      setDrawingPreview((prev) =>
        prev ? { ...prev, curX: near ? near.x : pt.x, curY: near ? near.y : pt.y, dragged: prev.dragged || moved } : null,
      )
      return
    }

    if (nodeDragRef.current) {
      const d = nodeDragRef.current
      const dist = Math.hypot(e.clientX - d.startClientX, e.clientY - d.startClientY)
      if (dist > 4) d.moved = true
      if (!d.moved) return
      const dx = (e.clientX - d.startClientX) / zoom
      const dy = (e.clientY - d.startClientY) / zoom
      const nx = Math.max(12, Math.min(SVG_W - 70, Math.round((d.origX + dx) / 6) * 6))
      const ny = Math.max(12, Math.min(SVG_H - 60, Math.round((d.origY + dy) / 6) * 6))
      onMoveBoardOrComponent(d.nodeId, nx, ny)
      return
    }

    if (waypointDragRef.current) {
      const wd = waypointDragRef.current
      const clampedX = Math.max(10, Math.min(SVG_W - 10, Math.round(pt.x / 4) * 4))
      const clampedY = Math.max(10, Math.min(SVG_H - 10, Math.round(pt.y / 4) * 4))
      const next = wd.waypoints.map((wp, idx) => (idx === wd.index ? { x: clampedX, y: clampedY } : wp))
      wd.waypoints = next
      onUpdateWire(wd.wireId, { waypoints: next, bendX: undefined, bendY: undefined })
    }
  }

  const endDrag = (e?: React.PointerEvent<SVGSVGElement>) => {
    setSnapHighlight(null)
    if (nodeDragRef.current) {
      const finished = nodeDragRef.current
      nodeDragRef.current = null
      if (finished.moved) {
        suppressNextClickRef.current = true
      } else {
        // Single click without dragging opens interactive popup on component/MCU
        suppressNextClickRef.current = true
        setInspectedNodeId((prev) => (prev === finished.nodeId ? null : finished.nodeId))
      }
    }
    if (waypointDragRef.current) {
      suppressNextClickRef.current = true
      waypointDragRef.current = null
    }
    if (drawingPreview) {
      if (drawingPreview.dragged && e) {
        suppressNextClickRef.current = true
        const pt = clientToSvg(e.clientX, e.clientY)
        const target = findNearestPin(boardId, components, pt.x, pt.y)
        const samePin =
          target &&
          target.nodeId === drawingPreview.from.nodeId &&
          target.pinId === drawingPreview.from.pinId
        if (target && !samePin) {
          if (drawingPreview.replug) {
            onUpdateWire(drawingPreview.replug.wireId, {
              [drawingPreview.replug.end]: { nodeId: target.nodeId, pinId: target.pinId },
              waypoints: undefined,
              bendX: undefined,
              bendY: undefined,
            })
          } else {
            onAddWire(drawingPreview.from, { nodeId: target.nodeId, pinId: target.pinId })
            setSelectedPin(null)
          }
        }
      }
      if (drawingPreview.dragged || drawingPreview.replug) {
        setDrawingPreview(null)
      }
    }
  }

  const activeWire = wires.find((w) => w.id === selectedWireId) ?? null
  const canvasBg = isDark ? '#0b1322' : '#fdf4e3'
  const gridDot = isDark ? '#334155' : '#dfd2bc'
  const activeStartPin = drawingPreview?.from ?? selectedPin

  // Compute inline popup anchor position inside .iot-canvas-shell
  const inspectedComp = components.find((c) => c.id === inspectedNodeId && c.kind !== 'mcu') ?? null
  const inspectedBoard = inspectedNodeId ? boardInstances.find((b) => b.nodeId === inspectedNodeId) ?? null : null
  const popupPos = (() => {
    const target = inspectedComp ?? (inspectedBoard ? { x: inspectedBoard.x, y: inspectedBoard.y } : null)
    if (!target) return null
    const leftPct = Math.min(68, Math.max(4, ((target.x + 18) / (SVG_W / zoom)) * 100))
    const topPct = Math.min(62, Math.max(14, ((target.y + 8) / (SVG_H / zoom)) * 100))
    return { leftPct, topPct }
  })()

  return (
    <div className="iot-canvas-shell" style={{ background: canvasBg }}>
      <div className="iot-floating-pill-wrap">
        <div className="iot-floating-pill" role="toolbar" aria-label={en ? 'Circuit Controls' : 'Kontrol Simulasi'}>
          <button
            type="button"
            className={`iot-play-pill ${sim.running ? 'is-running' : ''}`}
            onClick={onStartStop}
            title={sim.running ? (en ? 'Stop simulation' : 'Hentikan simulasi') : (en ? 'Run simulation' : 'Jalankan simulasi')}
          >
            {sim.running ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
            <span>{sim.running ? 'Stop' : en ? 'Run' : 'Jalankan'}</span>
          </button>

          <button
            type="button"
            className="iot-pill-btn"
            onClick={onCheckCircuit}
            title={en ? 'Check wiring & code' : 'Cek rangkaian & koding'}
          >
            <CheckSquare size={14} />
            <span>{en ? 'Check' : 'Cek'}</span>
          </button>

          <button type="button" className="iot-pill-btn" onClick={onReset} title={en ? 'Reset simulation' : 'Reset simulasi'}>
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <span className="iot-pill-divider" aria-hidden="true" />

          <button
            type="button"
            className={`iot-pill-btn ${showLabels ? 'is-on' : ''}`}
            onClick={() => setShowLabels((v) => !v)}
            title={en ? 'Toggle pin labels' : 'Tampilkan/sembunyikan label pin'}
            aria-label={en ? 'Toggle pin labels' : 'Tampilkan/sembunyikan label pin'}
          >
            <Type size={14} />
          </button>

          <button type="button" className="iot-pill-btn" onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.1).toFixed(2)))} aria-label="Zoom out">
            <ZoomOut size={14} />
          </button>
          <button type="button" className="iot-pill-btn" onClick={() => setZoom(1)} aria-label="Reset zoom">
            <Maximize2 size={13} />
          </button>
          <button type="button" className="iot-pill-btn" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} aria-label="Zoom in">
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      <div className="iot-canvas-subbar">
        <span className="iot-wire-hint">
          {drawingPreview?.replug
            ? en
              ? 'Unplugged wire end — drop onto target pin to re-plug'
              : 'Ujung kabel dicabut — arahkan & lepas di pin baru'
            : activeStartPin
              ? en
                ? `Pulling wire from ${activeStartPin.nodeId}:${activeStartPin.pinId} — drop or click target pin`
                : `Menarik kabel dari ${activeStartPin.nodeId}:${activeStartPin.pinId} — klik/lepas di pin tujuan`
              : activeWire
                ? en
                  ? 'Wire selected: drag plug rings to unplug/move pin, drag white dots to bend, or drag any + segment handle to add bends.'
                  : 'Kabel dipilih: geser ujung colokan untuk cabut/pindah pin, geser titik putih untuk belokkan, atau tarik tanda + untuk tambah belokan.'
                : en
                  ? 'Drag from any pin to connect · Drag MCUs & parts freely · Click resistor/sensors to configure inline'
                  : 'Tarik langsung dari pin ke pin · Geser MCU & komponen bebas · Klik resistor/sensor untuk atur nilai'}
        </span>

        <div className="iot-canvas-btns">
          {activeStartPin ? (
            <button type="button" className="btn-outline iot-mini-btn" onClick={() => { setSelectedPin(null); setDrawingPreview(null) }}>
              {en ? 'Cancel' : 'Batal'}
            </button>
          ) : null}

          {activeWire ? (
            <>
              <div className="iot-wire-picker" role="group" aria-label={en ? 'Wire color' : 'Warna kabel'}>
                {WIRE_COLORS.map((wc) => (
                  <button
                    key={wc.id}
                    type="button"
                    className={`iot-color-dot ${activeWire.color === wc.id ? 'is-selected' : ''}`}
                    style={{ backgroundColor: wc.id }}
                    title={en ? wc.nameEn : wc.nameId}
                    onClick={() => onUpdateWire(activeWire.id, { color: wc.id })}
                  />
                ))}
              </div>
              <button
                type="button"
                className="btn-outline iot-mini-btn"
                onClick={() => onUpdateWire(activeWire.id, { waypoints: undefined, bendX: undefined, bendY: undefined })}
                title={en ? 'Auto-route wire cleanly' : 'Rapikan jalur kabel otomatis'}
              >
                <Sparkles size={13} /> {en ? 'Auto-route' : 'Rapikan Kabel'}
              </button>
              <button
                type="button"
                className="btn-outline iot-mini-btn"
                onClick={() => {
                  onDeleteWire(activeWire.id)
                  setSelectedWireId(null)
                }}
              >
                <Trash2 size={13} /> {en ? 'Remove Wire' : 'Hapus Kabel'}
              </button>
            </>
          ) : null}

          {selectedNodeId && selectedNodeId !== 'board' ? (
            <button
              type="button"
              className="btn-outline iot-mini-btn"
              onClick={() => {
                onDeleteNode(selectedNodeId)
                setSelectedNodeId(null)
                setInspectedNodeId(null)
              }}
            >
              <Trash2 size={13} /> {en ? 'Remove Part' : 'Hapus Komponen'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Inline Component/MCU Popover Card anchored over SVG body */}
      {popupPos && (inspectedComp || inspectedBoard) ? (
        <div
          className="iot-comp-popover"
          style={{ left: `${popupPos.leftPct}%`, top: `${popupPos.topPct}%` }}
          role="dialog"
          aria-label={en ? 'Component settings' : 'Pengaturan komponen'}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="iot-popover-head">
            <strong>
              {inspectedComp
                ? inspectedComp.kind === 'resistor'
                  ? `${inspectedComp.label.split(' (')[0]} · ${formatOhms(inspectedComp.ohms ?? 220)}`
                  : inspectedComp.label
                : inspectedBoard?.label}
            </strong>
            <button
              type="button"
              className="iot-popover-close"
              aria-label={en ? 'Close' : 'Tutup'}
              onClick={() => setInspectedNodeId(null)}
            >
              <X size={13} />
            </button>
          </div>

          {inspectedComp?.kind === 'resistor' ? (() => {
            const ohms = inspectedComp.ohms ?? 220
            const { d1, d2, multIdx } = decodeResistorBands(ohms)
            const applyBands = (nd1: number, nd2: number, nMultIdx: number) => {
              const mult = RESISTOR_MULTIPLIER_BANDS[nMultIdx]?.multiplier ?? 1
              const nextOhms = Math.max(10, (nd1 * 10 + nd2) * mult)
              const base = inspectedComp.label.split(' (')[0] || 'R'
              onUpdateComponent(inspectedComp.id, {
                ohms: nextOhms,
                label: `${base} (${formatOhms(nextOhms)})`,
              })
            }
            return (
              <div className="iot-popover-body">
                <div className="iot-res-preview">
                  <span className="iot-res-pill-band" style={{ background: RESISTOR_DIGIT_BANDS[d1].hex }} />
                  <span className="iot-res-pill-band" style={{ background: RESISTOR_DIGIT_BANDS[d2].hex }} />
                  <span className="iot-res-pill-band" style={{ background: RESISTOR_MULTIPLIER_BANDS[multIdx].hex }} />
                  <span className="iot-res-pill-band" style={{ background: '#eab308' }} />
                  <span className="iot-res-val">{formatOhms(ohms)} ±5%</span>
                </div>

                <div className="iot-pop-field">
                  <span>{en ? 'Band 1 (1st digit)' : 'Gelang 1 (Digit 1)'}</span>
                  <div className="iot-swatch-row">
                    {RESISTOR_DIGIT_BANDS.slice(1).map((b) => (
                      <button
                        key={`b1-${b.digit}`}
                        type="button"
                        className={`iot-swatch ${d1 === b.digit ? 'is-active' : ''}`}
                        style={{ backgroundColor: b.hex }}
                        title={en ? b.nameEn : b.nameId}
                        aria-label={en ? b.nameEn : b.nameId}
                        onClick={() => applyBands(b.digit ?? 2, d2, multIdx)}
                      />
                    ))}
                  </div>
                </div>

                <div className="iot-pop-field">
                  <span>{en ? 'Band 2 (2nd digit)' : 'Gelang 2 (Digit 2)'}</span>
                  <div className="iot-swatch-row">
                    {RESISTOR_DIGIT_BANDS.map((b) => (
                      <button
                        key={`b2-${b.digit}`}
                        type="button"
                        className={`iot-swatch ${d2 === b.digit ? 'is-active' : ''}`}
                        style={{ backgroundColor: b.hex }}
                        title={en ? b.nameEn : b.nameId}
                        aria-label={en ? b.nameEn : b.nameId}
                        onClick={() => applyBands(d1, b.digit ?? 0, multIdx)}
                      />
                    ))}
                  </div>
                </div>

                <div className="iot-pop-field">
                  <span>{en ? 'Band 3 (Multiplier)' : 'Gelang 3 (Pengali)'}</span>
                  <div className="iot-swatch-row">
                    {RESISTOR_MULTIPLIER_BANDS.map((b, idx) => (
                      <button
                        key={`m-${idx}`}
                        type="button"
                        className={`iot-swatch ${multIdx === idx ? 'is-active' : ''}`}
                        style={{ backgroundColor: b.hex }}
                        title={en ? b.nameEn : b.nameId}
                        aria-label={en ? b.nameEn : b.nameId}
                        onClick={() => applyBands(d1, d2, idx)}
                      />
                    ))}
                  </div>
                </div>

                <div className="iot-pop-quick-vals">
                  {RESISTOR_QUICK_VALUES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`iot-quick-val ${ohms === v ? 'is-active' : ''}`}
                      onClick={() =>
                        onUpdateComponent(inspectedComp.id, {
                          ohms: v,
                          label: `${inspectedComp.label.split(' (')[0] || 'R'} (${formatOhms(v)})`,
                        })
                      }
                    >
                      {formatOhms(v)}
                    </button>
                  ))}
                </div>
              </div>
            )
          })() : null}

          {inspectedComp?.kind === 'led' ? (
            <div className="iot-popover-body">
              <div className="iot-pop-field">
                <span>{en ? 'LED Color' : 'Warna LED'}</span>
                <div className="iot-pop-quick-vals">
                  {(['red', 'green', 'yellow', 'blue'] as const).map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.color ?? 'red') === clr ? 'is-active' : ''}`}
                      onClick={() => onUpdateComponent(inspectedComp.id, { color: clr })}
                    >
                      {clr.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {inspectedComp?.kind === 'potentiometer' ? (
            <div className="iot-popover-body">
              <label className="iot-pop-field">
                <span>{en ? 'Rotation' : 'Putaran Kenop'}: {inspectedComp.props.potPct ?? 50}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={inspectedComp.props.potPct ?? 50}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { potPct: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : null}

          {inspectedComp?.kind === 'pushbutton' ? (
            <div className="iot-popover-body">
              <button
                type="button"
                className="btn-primary iot-mini-btn"
                onClick={() => onUpdateProps(inspectedComp.id, { latched: !inspectedComp.props.latched })}
              >
                {inspectedComp.props.latched
                  ? en ? 'Release Lock (Currently ON)' : 'Lepas Kunci (Sedang ON)'
                  : en ? 'Latch Switch ON' : 'Tahan / Kunci Tombol ON'}
              </button>
            </div>
          ) : null}

          {inspectedComp?.kind === 'dht22' ? (
            <div className="iot-popover-body">
              <label className="iot-pop-field">
                <span>{en ? 'Temperature' : 'Suhu'}: {inspectedComp.props.tempC ?? 28}°C</span>
                <input
                  type="range"
                  min={0}
                  max={55}
                  value={inspectedComp.props.tempC ?? 28}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { tempC: Number(e.target.value) })}
                />
              </label>
              <label className="iot-pop-field">
                <span>{en ? 'Humidity' : 'Kelembapan'}: {inspectedComp.props.humidity ?? 60}%</span>
                <input
                  type="range"
                  min={10}
                  max={95}
                  value={inspectedComp.props.humidity ?? 60}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { humidity: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : null}

          {inspectedComp?.kind === 'hc-sr04' ? (
            <div className="iot-popover-body">
              <label className="iot-pop-field">
                <span>{en ? 'Target Distance' : 'Jarak Objek'}: {inspectedComp.props.distanceCm ?? 40} cm</span>
                <input
                  type="range"
                  min={2}
                  max={250}
                  value={inspectedComp.props.distanceCm ?? 40}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { distanceCm: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : null}

          {inspectedComp?.kind === 'ldr' ? (
            <div className="iot-popover-body">
              <label className="iot-pop-field">
                <span>{en ? 'Light Intensity' : 'Intensitas Cahaya'}: {inspectedComp.props.lux ?? 420} lux</span>
                <input
                  type="range"
                  min={50}
                  max={1000}
                  value={inspectedComp.props.lux ?? 420}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { lux: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : null}

          {inspectedComp?.kind === 'pir' ? (
            <div className="iot-popover-body">
              <button
                type="button"
                className="btn-primary iot-mini-btn"
                onClick={() => onUpdateProps(inspectedComp.id, { motion: !inspectedComp.props.motion })}
              >
                {inspectedComp.props.motion ? (en ? 'Clear Motion' : 'Matikan Deteksi Gerak') : (en ? 'Trigger Motion' : 'Picu Gerakan Objek')}
              </button>
            </div>
          ) : null}

          {inspectedBoard ? (
            <div className="iot-popover-body">
              <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                {BOARDS[inspectedBoard.boardId].name} · {inspectedBoard.isPrimary ? (en ? 'Primary MCU (runs main sketch)' : 'MCU Utama (menjalankan program)') : (en ? 'Secondary MCU on canvas' : 'MCU Tambahan di kanvas')}
              </div>
              {onSelectPrimaryBoard ? (
                <div className="iot-pop-quick-vals">
                  {Object.values(BOARDS).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className={`iot-quick-val ${inspectedBoard.boardId === b.id ? 'is-active' : ''}`}
                      onClick={() => {
                        if (inspectedBoard.isPrimary) {
                          onSelectPrimaryBoard(b.id)
                        } else {
                          onUpdateComponent(inspectedBoard.nodeId, { boardId: b.id, label: b.shortName })
                        }
                      }}
                    >
                      {b.shortName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <svg
        ref={svgRef}
        className="iot-svg-board"
        viewBox={`0 0 ${Math.round(SVG_W / zoom)} ${Math.round(SVG_H / zoom)}`}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => endDrag(e)}
        onPointerLeave={() => endDrag()}
        onClick={() => {
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false
            return
          }
          setSelectedNodeId(null)
          setInspectedNodeId(null)
          setSelectedWireId(null)
        }}
      >
        <defs>
          <pattern id="iot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" fill={gridDot} opacity="0.7" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={canvasBg} />
        <rect width="100%" height="100%" fill="url(#iot-grid)" />

        {/* Layer 1: All Microcontroller Boards (draggable) & Components */}
        {boardInstances.map((inst) => (
          <BoardHardwareView
            key={inst.nodeId}
            nodeId={inst.nodeId}
            board={BOARDS[inst.boardId]}
            boardX={inst.x}
            boardY={inst.y}
            label={inst.label}
            isPrimary={inst.isPrimary}
            selectedBoard={selectedNodeId === inst.nodeId}
            sim={sim}
            selectedPin={activeStartPin}
            showLabels={showLabels}
            onStartDrag={startNodeDrag}
            onPinPointerDown={onPinPointerDown}
            onPinPointerUp={onPinPointerUp}
          />
        ))}

        {components
          .filter((c) => c.kind !== 'mcu')
          .map((comp) => (
            <ComponentHardwareView
              key={comp.id}
              comp={comp}
              sim={sim}
              selectedPin={activeStartPin}
              selectedComp={selectedNodeId === comp.id}
              showLabels={showLabels}
              isDark={isDark}
              onStartDrag={startNodeDrag}
              onPinPointerDown={onPinPointerDown}
              onPinPointerUp={onPinPointerUp}
              onUpdateProps={onUpdateProps}
            />
          ))}

        {/* Layer 2: Multi-point Flexible Jumper Wires + Segment Add Handles + Re-plug Caps */}
        {wires.map((w, idx) => {
          const a = getEndpointGeometry(boardId, components, w.from)
          const b = getEndpointGeometry(boardId, components, w.to)
          if (!a || !b) return null
          const waypoints = resolveWireWaypoints(a, b, w, idx)
          const pts: WireWaypoint[] = [{ x: a.x, y: a.y }, ...waypoints, { x: b.x, y: b.y }]
          const d = buildPolylinePath(pts)
          const isSelected = selectedWireId === w.id
          const strokeColor = w.color || wireColor

          return (
            <g
              key={w.id}
              className={`iot-wire-group ${isSelected ? 'is-selected' : ''}`}
              style={{ pointerEvents: drawingPreview ? 'none' : undefined }}
              onClick={(e) => {
                e.stopPropagation()
                suppressNextClickRef.current = false
                setSelectedNodeId(null)
                setInspectedNodeId(null)
                setSelectedPin(null)
                setSelectedWireId(w.id)
              }}
            >
              {/* Wide hit stroke: dragging directly on a selected wire inserts a bend point under cursor! */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                pointerEvents="stroke"
                onPointerDown={(e) => {
                  if (!isSelected) return
                  e.stopPropagation()
                  const pt = clientToSvg(e.clientX, e.clientY)
                  const segIdx = closestSegmentIndex(pts, pt.x, pt.y)
                  const updated = [...waypoints]
                  updated.splice(segIdx, 0, { x: Math.round(pt.x), y: Math.round(pt.y) })
                  onUpdateWire(w.id, { waypoints: updated, bendX: undefined, bendY: undefined })
                  waypointDragRef.current = { wireId: w.id, index: segIdx, waypoints: updated }
                }}
              />
              {isSelected ? (
                <path d={d} fill="none" stroke="#f59e0b" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={0.42} />
              ) : null}
              <path
                d={d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isSelected ? 3.8 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Endpoint plugs: draggable when selected to unplug & move to another pin */}
              {isSelected ? (
                <>
                  <g
                    className="iot-wire-plug-handle"
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      startUnplugDrag(w, 'from', e.clientX, e.clientY)
                    }}
                  >
                    <circle cx={a.x} cy={a.y} r={8.5} fill="#0f172a" stroke="#f59e0b" strokeWidth={2.5} />
                    <circle cx={a.x} cy={a.y} r={3.5} fill={strokeColor} />
                    <title>{en ? 'Drag to unplug & move wire start' : 'Tarik untuk cabut & pindahkan ujung awal kabel'}</title>
                  </g>
                  <g
                    className="iot-wire-plug-handle"
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      startUnplugDrag(w, 'to', e.clientX, e.clientY)
                    }}
                  >
                    <circle cx={b.x} cy={b.y} r={8.5} fill="#0f172a" stroke="#f59e0b" strokeWidth={2.5} />
                    <circle cx={b.x} cy={b.y} r={3.5} fill={strokeColor} />
                    <title>{en ? 'Drag to unplug & move wire end' : 'Tarik untuk cabut & pindahkan ujung akhir kabel'}</title>
                  </g>
                </>
              ) : (
                <>
                  <circle cx={a.x} cy={a.y} r={3.5} fill={strokeColor} stroke="#ffffff" strokeWidth={1} style={{ pointerEvents: 'none' }} />
                  <circle cx={b.x} cy={b.y} r={3.5} fill={strokeColor} stroke="#ffffff" strokeWidth={1} style={{ pointerEvents: 'none' }} />
                </>
              )}

              {sim.running ? (
                <circle r={3} fill="#ffffff" opacity={0.9} style={{ pointerEvents: 'none' }}>
                  <animateMotion dur="1.3s" repeatCount="indefinite" path={d} />
                </circle>
              ) : null}

              {/* Multi-point vertex handles & segment "+" add-bend handles when selected */}
              {isSelected ? (
                <>
                  {pts.slice(0, -1).map((p1, segIdx) => {
                    const p2 = pts[segIdx + 1]
                    if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 30) return null
                    const midX = (p1.x + p2.x) / 2
                    const midY = (p1.y + p2.y) / 2
                    return (
                      <g
                        key={`add-${segIdx}`}
                        className="iot-wire-add-handle"
                        style={{ cursor: 'crosshair' }}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          const updated = [...waypoints]
                          updated.splice(segIdx, 0, { x: Math.round(midX), y: Math.round(midY) })
                          onUpdateWire(w.id, { waypoints: updated, bendX: undefined, bendY: undefined })
                          waypointDragRef.current = { wireId: w.id, index: segIdx, waypoints: updated }
                        }}
                      >
                        <circle cx={midX} cy={midY} r={5.5} fill="#1e293b" stroke="#f59e0b" strokeWidth={1.4} opacity={0.85} />
                        <text x={midX} y={midY + 2.8} textAnchor="middle" fontSize="8.5" fontWeight={700} fill="#fef08a" style={{ pointerEvents: 'none' }}>
                          +
                        </text>
                        <title>{en ? 'Drag to insert new bend point' : 'Tarik untuk menambah titik belok baru'}</title>
                      </g>
                    )
                  })}

                  {waypoints.map((wp, wpIdx) => (
                    <g
                      key={`wp-${wpIdx}`}
                      className="iot-wire-vertex-handle"
                      style={{ cursor: 'move' }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        waypointDragRef.current = { wireId: w.id, index: wpIdx, waypoints: [...waypoints] }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (waypoints.length > 1) {
                          const updated = waypoints.filter((_, i) => i !== wpIdx)
                          onUpdateWire(w.id, { waypoints: updated, bendX: undefined, bendY: undefined })
                        }
                      }}
                    >
                      <circle cx={wp.x} cy={wp.y} r={7.2} fill="#ffffff" stroke="#f59e0b" strokeWidth={2.2} />
                      <circle cx={wp.x} cy={wp.y} r={2.3} fill="#0f172a" />
                      <title>{en ? 'Drag bend point (double-click to remove)' : 'Geser mengikuti kursor (klik 2× hapus titik)'}</title>
                    </g>
                  ))}
                </>
              ) : null}
            </g>
          )
        })}

        {/* Layer 3: Live wire preview when pulling directly from a pin or unplugging an end */}
        {drawingPreview ? (
          <g style={{ pointerEvents: 'none' }}>
            <path
              d={`M ${drawingPreview.ax} ${drawingPreview.ay} L ${Math.round((drawingPreview.ax + drawingPreview.curX) / 2)} ${drawingPreview.ay} L ${Math.round((drawingPreview.ax + drawingPreview.curX) / 2)} ${drawingPreview.curY} L ${drawingPreview.curX} ${drawingPreview.curY}`}
              fill="none"
              stroke={drawingPreview.replug?.color ?? wireColor}
              strokeWidth={3}
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
            <circle cx={drawingPreview.ax} cy={drawingPreview.ay} r={5} fill="#f59e0b" />
            <circle
              cx={drawingPreview.curX}
              cy={drawingPreview.curY}
              r={snapHighlight ? 8 : 5}
              fill={drawingPreview.replug?.color ?? wireColor}
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        ) : null}

        {snapHighlight ? (
          <circle
            cx={snapHighlight.x}
            cy={snapHighlight.y}
            r={12}
            fill="none"
            stroke="#22c55e"
            strokeWidth={2.5}
            style={{ pointerEvents: 'none' }}
          />
        ) : null}
      </svg>
    </div>
  )
}
