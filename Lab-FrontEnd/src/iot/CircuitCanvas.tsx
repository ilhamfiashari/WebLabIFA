import { useEffect, useRef, useState } from 'react'
import {
  CheckSquare,
  Copy,
  Expand,
  Focus,
  Hand,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  RotateCw,
  Shrink,
  Sparkles,
  Trash2,
  Type,
  Undo2,
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
  isBreadboardKind,
  resolveBreadboardPinAlias,
  rotatePointAroundBox,
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
    if (p.side === 'top') {
      return { x, y, sx: x, sy: inst.y - 10, side: 'up', boardNode }
    }
    if (p.side === 'bottom') {
      return { x, y, sx: x, sy: inst.y + spec.height + 10, side: 'down', boardNode }
    }
    return { x, y, sx: inst.x + spec.width + 18, sy: y, side: 'right', boardNode }
  }
  const comp = components.find((c) => c.id === ep.nodeId && c.kind !== 'mcu')
  if (!comp) return null
  const spec = getComponentSpec(comp.kind)
  const resolvedId = isBreadboardKind(comp.kind) ? resolveBreadboardPinAlias(ep.pinId) : ep.pinId
  const pin = spec.pins.find((p) => p.id === ep.pinId || p.id === resolvedId)
  if (!pin) return null
  const rot = rotatePointAroundBox(pin.dx, pin.dy, spec.width, spec.height, comp.rotate)
  const x = comp.x + rot.dx
  const y = comp.y + rot.dy
  if ((comp.kind === 'resistor' || comp.kind === 'pushbutton') && (!comp.rotate || comp.rotate % 180 === 0)) {
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
      const rot = rotatePointAroundBox(p.dx, p.dy, spec.width, spec.height, comp.rotate)
      const px = comp.x + rot.dx
      const py = comp.y + rot.dy
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

  // Horizontal header pins (Arduino Uno/Mega/Nano top/bottom rows) route cleanly without fold-back stubs
  if (a.side === 'up' || a.side === 'down' || b.side === 'up' || b.side === 'down') {
    const step = (offsetIdx % 4) * 6
    const exitA = {
      x: a.side === 'up' || a.side === 'down' ? a.x : a.sx,
      y: a.side === 'up' ? a.sy - step : a.side === 'down' ? a.sy + step : a.y,
    }
    const exitB = {
      x: b.side === 'up' || b.side === 'down' ? b.x : b.sx,
      y: b.side === 'up' ? b.sy - step : b.side === 'down' ? b.sy + step : b.y,
    }

    const pickClearChannelX = (fromPt: EndpointGeometry, toPt: EndpointGeometry): number => {
      if (refBoard) {
        if (toPt.x >= refBoard.x + refBoard.width) {
          return Math.min(toPt.x - 14, refBoard.x + refBoard.width + 14 + step)
        }
        if (toPt.x <= refBoard.x) {
          return Math.max(toPt.x + 14, refBoard.x - 14 - step)
        }
      }
      return Math.round((fromPt.x + toPt.x) / 2)
    }

    // Avoid backtracking downward after exiting upward (or upward after exiting downward)
    const aBacktracksUp = a.side === 'up' && exitB.y > exitA.y
    const bBacktracksUp = b.side === 'up' && exitA.y > exitB.y
    const aBacktracksDown = a.side === 'down' && exitB.y < exitA.y
    const bBacktracksDown = b.side === 'down' && exitA.y < exitB.y

    if (aBacktracksUp || bBacktracksUp || aBacktracksDown || bBacktracksDown) {
      const aIsPrimary = aBacktracksUp || aBacktracksDown
      const primPt = aIsPrimary ? a : b
      const primExit = aIsPrimary ? exitA : exitB
      const otherExit = aIsPrimary ? exitB : exitA
      const otherSide = (aIsPrimary ? b : a).side
      const chanX = pickClearChannelX(primPt, aIsPrimary ? b : a)
      const pts: WireWaypoint[] = [
        primExit,
        { x: chanX, y: primExit.y },
        { x: chanX, y: otherExit.y },
      ]
      if (otherSide === 'up' || otherSide === 'down' || Math.abs(chanX - otherExit.x) > 2) {
        pts.push(otherExit)
      }
      return aIsPrimary ? pts : pts.reverse()
    }

    if (a.side === 'up' && b.side === 'up') {
      const topY = Math.min(exitA.y, exitB.y) - step
      return [{ x: exitA.x, y: topY }, { x: exitB.x, y: topY }]
    }
    if (a.side === 'down' && b.side === 'down') {
      const botY = Math.max(exitA.y, exitB.y) + step
      return [{ x: exitA.x, y: botY }, { x: exitB.x, y: botY }]
    }

    const midY = Math.round((exitA.y + exitB.y) / 2) + ((offsetIdx % 3) - 1) * 5
    const pts: WireWaypoint[] = [exitA]
    if (Math.abs(exitA.x - exitB.x) > 4 && Math.abs(exitA.y - exitB.y) > 4) {
      pts.push({ x: exitA.x, y: midY }, { x: exitB.x, y: midY })
    }
    pts.push(exitB)
    return pts
  }

  // Standard left/right pin pairs
  const midX = Math.round((a.sx + b.sx) / 2) + ((offsetIdx % 3) - 1) * 8
  return [
    { x: a.sx, y: a.y },
    { x: midX, y: a.y },
    { x: midX, y: b.y },
    { x: b.sx, y: b.y },
  ]
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
  onDuplicateNode,
  onSelectPrimaryBoard,
  onSelectMcuCode,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onGestureStart,
  onGestureEnd,
  focusMode = 'normal',
  onChangeFocusMode,
  isFullscreen = false,
  onToggleFullscreen,
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
  onDuplicateNode?: (nodeId: string) => void
  onSelectPrimaryBoard?: (boardId: BoardId) => void
  onSelectMcuCode?: (nodeId: string) => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  onGestureStart?: () => void
  onGestureEnd?: () => void
  focusMode?: 'normal' | 'focus' | 'canvas'
  onChangeFocusMode?: (mode: 'normal' | 'focus' | 'canvas') => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}) {
  const en = lang === 'en'
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panMode, setPanMode] = useState(false)
  const [isDraggingItem, setIsDraggingItem] = useState(false)
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
  const rotateDragRef = useRef<{
    compId: string
    centerX: number
    centerY: number
    startAngleDeg: number
    origRotate: number
    moved: boolean
  } | null>(null)
  const panDragRef = useRef<{
    startClientX: number
    startClientY: number
    origPanX: number
    origPanY: number
    moved: boolean
  } | null>(null)
  const suppressNextClickRef = useRef(false)

  const clampPan = (x: number, y: number) => ({
    x: Math.max(-1400, Math.min(2000, Math.round(x))),
    y: Math.max(-1000, Math.min(1600, Math.round(y))),
  })

  const applyZoom = (nextZoomRaw: number) => {
    const nextZ = Math.max(0.45, Math.min(2.2, +nextZoomRaw.toFixed(2)))
    if (nextZ === zoom) return
    const oldW = SVG_W / zoom
    const oldH = SVG_H / zoom
    const newW = SVG_W / nextZ
    const newH = SVG_H / nextZ
    setPan((p) => clampPan(p.x + (oldW - newW) / 2, p.y + (oldH - newH) / 2))
    setZoom(nextZ)
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const nextZ = Math.max(0.45, Math.min(2.2, +(zoom * (1 - e.deltaY * 0.0022)).toFixed(2)))
        if (nextZ !== zoom) {
          const oldW = SVG_W / zoom
          const oldH = SVG_H / zoom
          const newW = SVG_W / nextZ
          const newH = SVG_H / nextZ
          setPan((p) => clampPan(p.x + (oldW - newW) / 2, p.y + (oldH - newH) / 2))
          setZoom(nextZ)
        }
        return
      }
      const dominantHorizontal = Math.abs(e.deltaX) > 6 && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.6
      if (panMode || e.shiftKey || dominantHorizontal) {
        e.preventDefault()
        const dx = (e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX) / zoom
        const dy = (e.shiftKey ? 0 : e.deltaY) / zoom
        setPan((p) => clampPan(p.x + dx, p.y + dy))
      }
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [zoom, panMode])

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
      x: pan.x + ((clientX - rect.left) / Math.max(1, rect.width)) * vbW,
      y: pan.y + ((clientY - rect.top) / Math.max(1, rect.height)) * vbH,
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isTextInput =
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes((target as HTMLInputElement).type))
      if (isTextInput) return

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase()
        if (k === 'z') {
          e.preventDefault()
          if (e.shiftKey) {
            onRedo?.()
          } else if (selectedPin || drawingPreview) {
            setSelectedPin(null)
            setDrawingPreview(null)
            setSnapHighlight(null)
          } else {
            onUndo?.()
          }
          return
        }
        if (k === 'y' && !e.shiftKey) {
          e.preventDefault()
          onRedo?.()
          return
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWireId) {
          onDeleteWire(selectedWireId)
          setSelectedWireId(null)
        } else if (selectedNodeId && selectedNodeId !== 'board') {
          onDeleteNode(selectedNodeId)
          setSelectedNodeId(null)
          setInspectedNodeId(null)
        }
      } else if ((e.key === 'r' || e.key === 'R') && selectedNodeId) {
        const comp = components.find((c) => c.id === selectedNodeId && c.kind !== 'mcu')
        if (comp) onUpdateComponent(comp.id, { rotate: ((comp.rotate ?? 0) + 90) % 360 })
      } else if ((e.key === 'd' || e.key === 'D') && selectedNodeId && selectedNodeId !== 'board' && onDuplicateNode) {
        onDuplicateNode(selectedNodeId)
      } else if (e.key === 'Escape') {
        setSelectedPin(null)
        setSelectedWireId(null)
        setSelectedNodeId(null)
        setInspectedNodeId(null)
        setDrawingPreview(null)
        setSnapHighlight(null)
      }
      if (sim.running) {
        const k = e.key.toLowerCase()
        for (const c of components) {
          if (c.kind === 'pushbutton' && c.props.shortcutKey && c.props.shortcutKey.toLowerCase() === k) {
            onUpdateProps(c.id, { pressed: true })
          }
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (!sim.running) return
      const k = e.key.toLowerCase()
      for (const c of components) {
        if (c.kind === 'pushbutton' && c.props.shortcutKey && c.props.shortcutKey.toLowerCase() === k) {
          onUpdateProps(c.id, { pressed: false })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [
    selectedPin,
    drawingPreview,
    selectedWireId,
    selectedNodeId,
    components,
    sim.running,
    onUpdateComponent,
    onUpdateProps,
    onDuplicateNode,
    onDeleteWire,
    onDeleteNode,
    onUndo,
    onRedo,
  ])

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

  const startRotateDrag = (compId: string, clientX: number, clientY: number) => {
    const comp = components.find((c) => c.id === compId && c.kind !== 'mcu')
    if (!comp) return
    const spec = getComponentSpec(comp.kind)
    const centerX = comp.x + spec.width / 2
    const centerY = comp.y + spec.height / 2
    const pt = clientToSvg(clientX, clientY)
    const startAngleDeg = (Math.atan2(pt.y - centerY, pt.x - centerX) * 180) / Math.PI
    rotateDragRef.current = {
      compId,
      centerX,
      centerY,
      startAngleDeg,
      origRotate: comp.rotate ?? 0,
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
    if (panDragRef.current) {
      const pd = panDragRef.current
      const dist = Math.hypot(e.clientX - pd.startClientX, e.clientY - pd.startClientY)
      if (dist > 3) pd.moved = true
      if (!pd.moved) return
      const dx = (e.clientX - pd.startClientX) / zoom
      const dy = (e.clientY - pd.startClientY) / zoom
      setPan(clampPan(pd.origPanX - dx, pd.origPanY - dy))
      return
    }

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
      onGestureStart?.()
      setIsDraggingItem(true)
      const dx = (e.clientX - d.startClientX) / zoom
      const dy = (e.clientY - d.startClientY) / zoom
      const nx = Math.max(-1200, Math.min(2400, Math.round((d.origX + dx) / 6) * 6))
      const ny = Math.max(-900, Math.min(1800, Math.round((d.origY + dy) / 6) * 6))
      onMoveBoardOrComponent(d.nodeId, nx, ny)
      return
    }

    if (waypointDragRef.current) {
      const wd = waypointDragRef.current
      onGestureStart?.()
      const clampedX = Math.max(-1200, Math.min(2400, Math.round(pt.x / 4) * 4))
      const clampedY = Math.max(-900, Math.min(1800, Math.round(pt.y / 4) * 4))
      const next = wd.waypoints.map((wp, idx) => (idx === wd.index ? { x: clampedX, y: clampedY } : wp))
      wd.waypoints = next
      onUpdateWire(wd.wireId, { waypoints: next, bendX: undefined, bendY: undefined })
      return
    }

    if (rotateDragRef.current) {
      const rd = rotateDragRef.current
      const curAngle = (Math.atan2(pt.y - rd.centerY, pt.x - rd.centerX) * 180) / Math.PI
      const delta = curAngle - rd.startAngleDeg
      if (Math.abs(delta) > 3) rd.moved = true
      if (!rd.moved) return
      onGestureStart?.()
      let nextDeg = ((Math.round(rd.origRotate + delta) % 360) + 360) % 360
      if (e.shiftKey) {
        nextDeg = (Math.round(nextDeg / 45) * 45) % 360
      } else {
        for (const ortho of [0, 90, 180, 270, 360]) {
          if (Math.abs(nextDeg - ortho) <= 3) {
            nextDeg = ortho % 360
            break
          }
        }
      }
      onUpdateComponent(rd.compId, { rotate: nextDeg })
    }
  }

  const endDrag = (e?: React.PointerEvent<SVGSVGElement>) => {
    setSnapHighlight(null)
    setIsDraggingItem(false)
    onGestureEnd?.()
    if (panDragRef.current) {
      const finished = panDragRef.current
      panDragRef.current = null
      setIsPanning(false)
      if (finished.moved) suppressNextClickRef.current = true
    }
    if (rotateDragRef.current) {
      const finished = rotateDragRef.current
      rotateDragRef.current = null
      suppressNextClickRef.current = true
      if (!finished.moved) {
        onUpdateComponent(finished.compId, { rotate: ((finished.origRotate + 45) % 360) })
      }
    }
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

  // Anchor popup cleanly to the side of the component/board so its pins remain uncovered
  const inspectedComp = components.find((c) => c.id === inspectedNodeId && c.kind !== 'mcu') ?? null
  const inspectedBoard = inspectedNodeId ? boardInstances.find((b) => b.nodeId === inspectedNodeId) ?? null : null
  const popupPos = (() => {
    const viewW = SVG_W / zoom
    const viewH = SVG_H / zoom
    let targetX = 0
    let targetY = 0
    let targetW = 100
    if (inspectedComp) {
      targetX = inspectedComp.x
      targetY = inspectedComp.y
      targetW = getComponentSpec(inspectedComp.kind).width
    } else if (inspectedBoard) {
      targetX = inspectedBoard.x
      targetY = inspectedBoard.y
      targetW = BOARDS[inspectedBoard.boardId].width
    } else {
      return null
    }
    const placeRight = targetX + targetW + 270 < pan.x + viewW
    const anchorX = placeRight ? targetX + targetW + 14 : Math.max(pan.x + 10, targetX - 260)
    const leftPct = Math.min(68, Math.max(2, ((anchorX - pan.x) / viewW) * 100))
    const topPct = Math.min(58, Math.max(4, ((targetY - pan.y + 4) / viewH) * 100))
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
            className="iot-pill-btn"
            disabled={!canUndo && !activeStartPin}
            onClick={() => {
              if (activeStartPin) {
                setSelectedPin(null)
                setDrawingPreview(null)
                setSnapHighlight(null)
                return
              }
              onUndo?.()
            }}
            title={activeStartPin ? (en ? 'Cancel wire (Esc / Ctrl+Z)' : 'Batal tarik kabel (Esc / Ctrl+Z)') : (en ? 'Undo (Ctrl+Z)' : 'Urungkan / Undo (Ctrl+Z)')}
            aria-label={en ? 'Undo (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
          >
            <Undo2 size={14} />
          </button>

          <button
            type="button"
            className="iot-pill-btn"
            disabled={!canRedo}
            onClick={() => onRedo?.()}
            title={en ? 'Redo (Ctrl+Y / Ctrl+Shift+Z)' : 'Ulangi / Redo (Ctrl+Y / Ctrl+Shift+Z)'}
            aria-label={en ? 'Redo (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
          >
            <Redo2 size={14} />
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

          <button
            type="button"
            className={`iot-pill-btn ${panMode ? 'is-on' : ''}`}
            onClick={() => setPanMode((v) => !v)}
            title={en ? 'Hand pan tool (or drag empty canvas)' : 'Mode Geser Kanvas (atau seret area kosong kanvas)'}
            aria-label={en ? 'Pan canvas mode' : 'Geser kanvas'}
          >
            <Hand size={14} />
          </button>

          <button type="button" className="iot-pill-btn" onClick={() => applyZoom(zoom - 0.15)} aria-label="Zoom out">
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="iot-pill-btn"
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
            title={en ? 'Reset view & zoom (100%)' : 'Reset posisi & zoom kanvas'}
            aria-label="Reset zoom"
          >
            <Maximize2 size={13} />
          </button>
          <button type="button" className="iot-pill-btn" onClick={() => applyZoom(zoom + 0.15)} aria-label="Zoom in">
            <ZoomIn size={14} />
          </button>

          {onChangeFocusMode ? (
            <>
              <span className="iot-pill-divider" aria-hidden="true" />
              <button
                type="button"
                className={`iot-pill-btn ${focusMode === 'focus' ? 'is-on' : ''}`}
                onClick={() => onChangeFocusMode(focusMode === 'focus' ? 'normal' : 'focus')}
                title={en ? 'Studio Focus Mode (hide top panels)' : 'Mode Fokus Studio (sembunyikan panel atas)'}
                aria-label={en ? 'Studio Focus' : 'Fokus Studio'}
              >
                <Focus size={14} />
                <span>{en ? 'Focus' : 'Fokus'}</span>
              </button>
              <button
                type="button"
                className={`iot-pill-btn ${focusMode === 'canvas' ? 'is-on' : ''}`}
                onClick={() => onChangeFocusMode(focusMode === 'canvas' ? 'normal' : 'canvas')}
                title={en ? 'Canvas-only Focus (expand circuit)' : 'Fokus Kanvas Penuh (perbesar rangkaian)'}
                aria-label={en ? 'Canvas Focus' : 'Fokus Kanvas'}
              >
                {focusMode === 'canvas' ? <Shrink size={14} /> : <PanelLeftClose size={14} />}
                <span>{en ? 'Canvas' : 'Kanvas'}</span>
              </button>
            </>
          ) : null}

          {onToggleFullscreen ? (
            <button
              type="button"
              className={`iot-pill-btn ${isFullscreen ? 'is-on' : ''}`}
              onClick={onToggleFullscreen}
              title={isFullscreen ? (en ? 'Exit Fullscreen (Esc)' : 'Keluar Layar Penuh (Esc)') : en ? 'Fullscreen Simulator' : 'Tampilan Layar Penuh'}
              aria-label={isFullscreen ? (en ? 'Exit Fullscreen' : 'Keluar Layar Penuh') : en ? 'Fullscreen' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Expand size={14} />}
              <span>{isFullscreen ? (en ? 'Exit' : 'Keluar') : en ? 'Fullscreen' : 'Layar Penuh'}</span>
            </button>
          ) : null}
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
                  ? 'Drag empty canvas to pan · Drag pin to pin to wire · Drag MCUs & parts freely · Click part to configure'
                  : 'Geser area kosong kanvas untuk menggeser ruang kerja · Tarik dari pin ke pin · Geser MCU & komponen bebas'}
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
            <>
              <button
                type="button"
                className="btn-outline iot-mini-btn"
                title={en ? 'Rotate 90° (R)' : 'Putar 90° (R)'}
                onClick={() => {
                  const comp = components.find((c) => c.id === selectedNodeId && c.kind !== 'mcu')
                  if (comp) onUpdateComponent(comp.id, { rotate: ((comp.rotate ?? 0) + 90) % 360 })
                }}
              >
                <RotateCw size={13} /> {en ? 'Rotate (R)' : 'Putar (R)'}
              </button>
              {onDuplicateNode ? (
                <button
                  type="button"
                  className="btn-outline iot-mini-btn"
                  title={en ? 'Duplicate part (D)' : 'Duplikat komponen (D)'}
                  onClick={() => onDuplicateNode(selectedNodeId)}
                >
                  <Copy size={13} /> {en ? 'Duplicate (D)' : 'Duplikat (D)'}
                </button>
              ) : null}
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
            </>
          ) : null}
        </div>
      </div>

      <div className="iot-svg-stage" style={{ position: 'relative' }}>
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

          {inspectedComp ? (
            <label className="iot-pop-field" style={{ paddingBottom: 4 }}>
              <span>{en ? 'Label / Name' : 'Nama / Label Komponen'}</span>
              <input
                className="input"
                style={{ minHeight: 28, fontSize: 12, padding: '2px 8px' }}
                value={inspectedComp.kind === 'resistor' ? inspectedComp.label.split(' (')[0] : inspectedComp.label}
                onChange={(e) => {
                  const val = e.target.value
                  onUpdateComponent(inspectedComp.id, {
                    label:
                      inspectedComp.kind === 'resistor'
                        ? `${val || 'R'} (${formatOhms(inspectedComp.ohms ?? 220)})`
                        : val,
                  })
                }}
              />
            </label>
          ) : null}

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
                <span>{en ? 'LED Color (color)' : 'Warna LED (color)'}</span>
                <div className="iot-pop-quick-vals">
                  {(['red', 'green', 'yellow', 'blue', 'orange', 'purple', 'cyan', 'white'] as const).map((clr) => (
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
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(inspectedComp.props.flip)}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { flip: e.target.checked })}
                />
                <span>{en ? 'Flip pins horizontally (flip)' : 'Balik polaritas kaki horizontal (flip)'}</span>
              </label>
            </div>
          ) : null}

          {inspectedComp?.kind === 'rgb-led' ? (
            <div className="iot-popover-body">
              <div className="iot-pop-field">
                <span>{en ? 'Common Pin (common)' : 'Tipe Pin Common (common)'}</span>
                <div className="iot-pop-quick-vals">
                  {(['cathode', 'anode'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.common ?? 'cathode') === mode ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { common: mode })}
                    >
                      Common {mode === 'anode' ? 'Anode' : 'Cathode'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {inspectedComp?.kind === 'potentiometer' || inspectedComp?.kind === 'slide-pot' ? (
            <div className="iot-popover-body">
              <label className="iot-pop-field">
                <span>{en ? 'Slider / Rotation' : 'Posisi / Putaran'}: {inspectedComp.props.potPct ?? 50}%</span>
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

          {inspectedComp?.kind === 'mq2' ? (
            <div className="iot-popover-body">
              <label className="iot-pop-field">
                <span>{en ? 'Gas / Smoke (PPM)' : 'Kadar Gas / Asap (PPM)'}: {inspectedComp.props.gasPpm ?? 280} ppm</span>
                <input
                  type="range"
                  min={100}
                  max={2500}
                  value={inspectedComp.props.gasPpm ?? 280}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { gasPpm: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : null}

          {inspectedComp?.kind === 'ds18b20' || inspectedComp?.kind === 'ntc' ? (
            <div className="iot-popover-body">
              <label className="iot-pop-field">
                <span>{en ? 'Temperature' : 'Suhu'}: {inspectedComp.props.tempC ?? 25}°C</span>
                <input
                  type="range"
                  min={-10}
                  max={85}
                  value={inspectedComp.props.tempC ?? 25}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { tempC: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : null}

          {inspectedComp?.kind === 'mpu6050' ? (
            <div className="iot-popover-body">
              <label className="iot-pop-field">
                <span>{en ? 'Tilt Angle' : 'Kemiringan IMU'}: {inspectedComp.props.tiltDeg ?? 0}°</span>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  value={inspectedComp.props.tiltDeg ?? 0}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { tiltDeg: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : null}

          {inspectedComp?.kind === 'bmp180' ? (
            <div className="iot-popover-body">
              <label className="iot-pop-field">
                <span>{en ? 'Barometric Pressure' : 'Tekanan Udara'}: {inspectedComp.props.pressureHpa ?? 1013} hPa</span>
                <input
                  type="range"
                  min={900}
                  max={1100}
                  value={inspectedComp.props.pressureHpa ?? 1013}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { pressureHpa: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : null}

          {inspectedComp?.kind === 'pushbutton' ? (
            <div className="iot-popover-body">
              <div className="iot-pop-field">
                <span>{en ? 'Button Color (color)' : 'Warna Tombol (color)'}</span>
                <div className="iot-pop-quick-vals">
                  {(['red', 'green', 'blue', 'yellow', 'white', 'black', 'grey'] as const).map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.color ?? 'red') === clr ? 'is-active' : ''}`}
                      onClick={() => onUpdateComponent(inspectedComp.id, { color: clr })}
                    >
                      {clr}
                    </button>
                  ))}
                </div>
              </div>
              <label className="iot-pop-field">
                <span>{en ? 'Keyboard Shortcut (key)' : 'Shortcut Keyboard (key)'}</span>
                <input
                  className="input"
                  maxLength={6}
                  placeholder="mis. Q, 1, Space"
                  style={{ minHeight: 26, fontSize: 11.5, padding: '2px 8px' }}
                  value={inspectedComp.props.shortcutKey ?? ''}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { shortcutKey: e.target.value })}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={inspectedComp.props.bounce !== false}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { bounce: e.target.checked })}
                />
                <span>{en ? 'Simulate contact bounce' : 'Simulasi contact bounce'}</span>
              </label>
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

          {inspectedComp?.kind === 'slide-switch' ? (
            <div className="iot-popover-body">
              <button
                type="button"
                className="btn-primary iot-mini-btn"
                onClick={() => {
                  const next = !inspectedComp.props.pressed
                  onUpdateProps(inspectedComp.id, { pressed: next, latched: next })
                }}
              >
                {inspectedComp.props.pressed ? 'Status: ON (value="1")' : 'Status: OFF (value="")'}
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={inspectedComp.props.bounce !== false}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { bounce: e.target.checked })}
                />
                <span>{en ? 'Simulate contact bounce' : 'Simulasi contact bounce'}</span>
              </label>
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

          {inspectedComp?.kind === 'hx711' ? (
            <div className="iot-popover-body">
              <div className="iot-pop-field">
                <span>{en ? 'Load Cell Type (type)' : 'Tipe Load Cell (type)'}</span>
                <div className="iot-pop-quick-vals">
                  {(['50kg', '5kg', 'gauge'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.hxType ?? '50kg') === t ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { hxType: t })}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <label className="iot-pop-field">
                <span>{en ? 'Load Weight' : 'Beban Timbangan'}: {(inspectedComp.props.weightKg ?? 1.2).toFixed(1)} kg</span>
                <input
                  type="range"
                  min={0}
                  max={inspectedComp.props.hxType === '5kg' ? 5 : 50}
                  step={inspectedComp.props.hxType === '5kg' ? 0.1 : 0.5}
                  value={Math.min(inspectedComp.props.hxType === '5kg' ? 5 : 50, inspectedComp.props.weightKg ?? 1.2)}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { weightKg: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : null}

          {inspectedComp?.kind === 'lcd-1602' || inspectedComp?.kind === 'lcd-20x4' ? (
            <div className="iot-popover-body">
              <div className="iot-pop-field">
                <span>{en ? 'Backlight & Address' : 'Backlight & Alamat I2C'}</span>
                <div className="iot-pop-quick-vals">
                  {(['green', 'blue'] as const).map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.lcdBackground ?? 'green') === bg ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { lcdBackground: bg, lcdTextColor: bg === 'blue' ? 'white' : 'black' })}
                    >
                      {bg === 'blue' ? 'Blue' : 'Green'}
                    </button>
                  ))}
                  {(['0x27', '0x3F'] as const).map((addr) => (
                    <button
                      key={addr}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.i2cAddress ?? '0x27') === addr ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { i2cAddress: addr })}
                    >
                      {addr}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {inspectedComp?.kind === 'servo' ? (
            <div className="iot-popover-body">
              <div className="iot-pop-field">
                <span>{en ? 'Servo Horn (horn)' : 'Bentuk Horn (horn)'}</span>
                <div className="iot-pop-quick-vals">
                  {(['single', 'double', 'cross'] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.servoHorn ?? 'single') === h ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { servoHorn: h })}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div className="iot-pop-field">
                <span>{en ? 'Horn Color (hornColor)' : 'Warna Horn'}</span>
                <div className="iot-pop-quick-vals">
                  {[
                    { hex: '#ffffff', label: 'White' },
                    { hex: '#38bdf8', label: 'Blue' },
                    { hex: '#ef4444', label: 'Red' },
                    { hex: '#1e293b', label: 'Dark' },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.servoHornColor ?? '#ffffff') === c.hex ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { servoHornColor: c.hex })}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {inspectedComp?.kind === 'buzzer' ? (
            <div className="iot-popover-body">
              <div className="iot-pop-field">
                <span>{en ? 'Sound Mode (mode)' : 'Mode Suara (mode)'}</span>
                <div className="iot-pop-quick-vals">
                  {(['smooth', 'accurate'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.buzzerMode ?? 'smooth') === m ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { buzzerMode: m })}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <label className="iot-pop-field">
                <span>Volume: {Math.round((inspectedComp.props.buzzerVolume ?? 1) * 100)}%</span>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={inspectedComp.props.buzzerVolume ?? 1}
                  onChange={(e) => onUpdateProps(inspectedComp.id, { buzzerVolume: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : null}

          {inspectedComp?.kind === 'relay' ? (
            <div className="iot-popover-body">
              <div className="iot-pop-field">
                <span>{en ? 'Driver Transistor (transistor)' : 'Tipe Transistor (transistor)'}</span>
                <div className="iot-pop-quick-vals">
                  {(['npn', 'pnp'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.relayTransistor ?? 'npn') === t ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { relayTransistor: t })}
                    >
                      {t.toUpperCase()} ({t === 'npn' ? 'Active-HIGH' : 'Active-LOW'})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {inspectedComp?.kind === 'seven-seg' || inspectedComp?.kind === 'seven-seg-4' || inspectedComp?.kind === 'max7219-matrix' ? (
            <div className="iot-popover-body">
              <div className="iot-pop-field">
                <span>{en ? 'LED Color (color)' : 'Warna LED (color)'}</span>
                <div className="iot-pop-quick-vals">
                  {(['red', 'green', 'blue', 'yellow', 'white'] as const).map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.color ?? 'red') === clr ? 'is-active' : ''}`}
                      onClick={() => onUpdateComponent(inspectedComp.id, { color: clr })}
                    >
                      {clr}
                    </button>
                  ))}
                </div>
              </div>
              {inspectedComp.kind === 'seven-seg' ? (
                <div className="iot-pop-quick-vals">
                  {(['anode', 'cathode'] as const).map((cm) => (
                    <button
                      key={cm}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.common ?? 'anode') === cm ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { common: cm })}
                    >
                      Common {cm}
                    </button>
                  ))}
                </div>
              ) : null}
              {inspectedComp.kind === 'seven-seg-4' ? (
                <div className="iot-pop-quick-vals">
                  {(['colon', 'dp'] as const).map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.tmType ?? 'colon') === tp ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { tmType: tp })}
                    >
                      type: {tp}
                    </button>
                  ))}
                </div>
              ) : null}
              {inspectedComp.kind === 'max7219-matrix' ? (
                <div className="iot-pop-quick-vals">
                  {(['parola', 'fc16'] as const).map((ly) => (
                    <button
                      key={ly}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.matrixLayout ?? 'parola') === ly ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { matrixLayout: ly })}
                    >
                      layout: {ly}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {inspectedComp?.kind === 'led-bar-graph' ? (
            <div className="iot-popover-body">
              <div className="iot-pop-field">
                <span>{en ? 'Bar Color / Pattern (color)' : 'Pola Warna Bar (color)'}</span>
                <div className="iot-pop-quick-vals">
                  {(['GYR', 'BCYR', 'red', 'green', 'yellow', 'blue'] as const).map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.color ?? 'GYR') === clr ? 'is-active' : ''}`}
                      onClick={() => onUpdateComponent(inspectedComp.id, { color: clr })}
                    >
                      {clr}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {inspectedComp?.kind === 'neopixel-ring' ? (
            <div className="iot-popover-body">
              <div className="iot-pop-field">
                <span>{en ? 'Ring LED Count (pixels)' : 'Jumlah LED Ring (pixels)'}</span>
                <div className="iot-pop-quick-vals">
                  {([8, 12, 16, 24] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      className={`iot-quick-val ${(inspectedComp.props.ringPixels ?? 12) === cnt ? 'is-active' : ''}`}
                      onClick={() => onUpdateProps(inspectedComp.id, { ringPixels: cnt })}
                    >
                      {cnt} px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {inspectedComp ? (
            <div className="iot-popover-footer">
              <button
                type="button"
                className="btn-outline iot-mini-btn"
                onClick={() =>
                  onUpdateComponent(inspectedComp.id, { rotate: ((inspectedComp.rotate ?? 0) + 90) % 360 })
                }
              >
                <RotateCw size={12} /> {en ? 'Rotate 90° (R)' : 'Putar 90° (R)'}
              </button>
              {onDuplicateNode ? (
                <button
                  type="button"
                  className="btn-outline iot-mini-btn"
                  onClick={() => onDuplicateNode(inspectedComp.id)}
                >
                  <Copy size={12} /> {en ? 'Duplicate (D)' : 'Duplikat (D)'}
                </button>
              ) : null}
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
              <div className="iot-popover-footer">
                {onSelectMcuCode ? (
                  <button
                    type="button"
                    className="btn-outline iot-mini-btn"
                    onClick={() => {
                      onSelectMcuCode(inspectedBoard.nodeId)
                      setInspectedNodeId(null)
                    }}
                  >
                    {en ? 'Edit Code (.ino)' : 'Edit Kode (.ino)'}
                  </button>
                ) : null}
                {!inspectedBoard.isPrimary ? (
                  <button
                    type="button"
                    className="btn-outline iot-mini-btn"
                    onClick={() => {
                      onDeleteNode(inspectedBoard.nodeId)
                      setSelectedNodeId(null)
                      setInspectedNodeId(null)
                    }}
                  >
                    <Trash2 size={12} /> {en ? 'Remove MCU' : 'Hapus MCU'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <svg
        ref={svgRef}
        className={`iot-svg-board ${isPanning ? 'is-panning' : ''} ${panMode ? 'is-pan-mode' : ''} ${isDraggingItem || drawingPreview ? 'is-dragging' : ''}`}
        viewBox={`${pan.x} ${pan.y} ${Math.round(SVG_W / zoom)} ${Math.round(SVG_H / zoom)}`}
        onPointerDownCapture={(e) => {
          if (e.button === 1 || panMode) {
            e.preventDefault()
            e.stopPropagation()
            panDragRef.current = {
              startClientX: e.clientX,
              startClientY: e.clientY,
              origPanX: pan.x,
              origPanY: pan.y,
              moved: false,
            }
            setIsPanning(true)
          }
        }}
        onPointerDown={(e) => {
          const isBgTarget = e.target === e.currentTarget || (e.target as Element)?.getAttribute('data-canvas-bg') === '1'
          if (e.button === 0 && isBgTarget && (e.pointerType !== 'touch' || panMode)) {
            panDragRef.current = {
              startClientX: e.clientX,
              startClientY: e.clientY,
              origPanX: pan.x,
              origPanY: pan.y,
              moved: false,
            }
            setIsPanning(true)
          }
        }}
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
        <rect data-canvas-bg="1" x={-2400} y={-1800} width={6400} height={4600} fill={canvasBg} />
        <rect data-canvas-bg="1" x={-2400} y={-1800} width={6400} height={4600} fill="url(#iot-grid)" />

        {/* Layer 1: Microcontroller Boards & Breadboards; Layer 2: Unselected Wires; Layer 3: Interactive Components; Layer 4: Selected Wire Handles */}
        {(() => {
          const renderWire = (w: (typeof wires)[number], idx: number) => {
            const a = getEndpointGeometry(boardId, components, w.from)
            const b = getEndpointGeometry(boardId, components, w.to)
            if (!a || !b) return null
            const waypoints = resolveWireWaypoints(a, b, w, idx)
            const pts: WireWaypoint[] = [{ x: a.x, y: a.y }, ...waypoints, { x: b.x, y: b.y }]
            const d = buildPolylinePath(pts)
            const isSelected = selectedWireId === w.id
            const disableWirePointer = Boolean(drawingPreview) || (sim.running && !isSelected)
            const strokeColor = w.color || wireColor

            return (
              <g
                key={w.id}
                className={`iot-wire-group ${isSelected ? 'is-selected' : ''}`}
                style={{ pointerEvents: disableWirePointer ? 'none' : undefined }}
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
                  pointerEvents={disableWirePointer ? 'none' : 'stroke'}
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
          }

          const breadboards = components.filter((c) => c.kind === 'breadboard')
          const interactiveComponents = components.filter((c) => c.kind !== 'mcu' && c.kind !== 'breadboard')

          return (
            <>
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

              {breadboards.map((comp) => (
                <ComponentHardwareView
                  key={comp.id}
                  comp={comp}
                  sim={sim}
                  selectedPin={activeStartPin}
                  selectedComp={selectedNodeId === comp.id}
                  showLabels={showLabels}
                  isDark={isDark}
                  onStartDrag={startNodeDrag}
                  onStartRotate={startRotateDrag}
                  onPinPointerDown={onPinPointerDown}
                  onPinPointerUp={onPinPointerUp}
                  onUpdateProps={onUpdateProps}
                />
              ))}

              {wires.map((w, idx) => (w.id === selectedWireId ? null : renderWire(w, idx)))}

              {interactiveComponents.map((comp) => (
                <ComponentHardwareView
                  key={comp.id}
                  comp={comp}
                  sim={sim}
                  selectedPin={activeStartPin}
                  selectedComp={selectedNodeId === comp.id}
                  showLabels={showLabels}
                  isDark={isDark}
                  onStartDrag={startNodeDrag}
                  onStartRotate={startRotateDrag}
                  onPinPointerDown={onPinPointerDown}
                  onPinPointerUp={onPinPointerUp}
                  onUpdateProps={onUpdateProps}
                />
              ))}

              {wires.map((w, idx) => (w.id === selectedWireId ? renderWire(w, idx) : null))}
            </>
          )
        })()}

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
    </div>
  )
}
