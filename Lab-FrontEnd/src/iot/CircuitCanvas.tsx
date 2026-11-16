import { useEffect, useRef, useState } from 'react'
import {
  CheckSquare,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { BOARDS, WIRE_COLORS, getBoardPin, getComponentSpec } from './boards'
import { BoardHardwareView, ComponentHardwareView } from './CircuitSvgComponents'
import type { BoardId, PlacedComponent, SimulationState, Wire, WireEndpoint } from './types'

const BOARD_X = 48
const BOARD_Y = 76

interface EndpointGeometry {
  x: number
  y: number
  sx: number
  sy: number
  side: 'left' | 'right' | 'down' | 'up'
}

function getEndpointGeometry(
  boardId: BoardId,
  components: PlacedComponent[],
  ep: WireEndpoint,
): EndpointGeometry | null {
  if (ep.nodeId === 'board') {
    const p = getBoardPin(boardId, ep.pinId)
    if (!p) return null
    const x = BOARD_X + p.x
    const y = BOARD_Y + p.y
    if (p.side === 'left') {
      return { x, y, sx: BOARD_X - 18, sy: y, side: 'left' }
    }
    return { x, y, sx: BOARD_X + BOARDS[boardId].width + 18, sy: y, side: 'right' }
  }
  const comp = components.find((c) => c.id === ep.nodeId)
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
  return { x, y, sx: x, sy: y + 14, side: 'down' }
}

function findNearestPin(
  boardId: BoardId,
  components: PlacedComponent[],
  x: number,
  y: number,
  maxDist = 16,
): WireEndpoint | null {
  let best: WireEndpoint | null = null
  let bestDist = maxDist
  for (const p of BOARDS[boardId].pins) {
    const d = Math.hypot(BOARD_X + p.x - x, BOARD_Y + p.y - y)
    if (d <= bestDist) {
      bestDist = d
      best = { nodeId: 'board', pinId: p.id }
    }
  }
  for (const comp of components) {
    const spec = getComponentSpec(comp.kind)
    for (const p of spec.pins) {
      const d = Math.hypot(comp.x + p.dx - x, comp.y + p.dy - y)
      if (d <= bestDist) {
        bestDist = d
        best = { nodeId: comp.id, pinId: p.id }
      }
    }
  }
  return best
}

function buildFlexibleWirePath(
  boardId: BoardId,
  components: PlacedComponent[],
  wire: Wire,
  offsetIdx: number,
): { d: string; handleX: number; handleY: number; ax: number; ay: number; bx: number; by: number } | null {
  const a = getEndpointGeometry(boardId, components, wire.from)
  const b = getEndpointGeometry(boardId, components, wire.to)
  if (!a || !b) return null

  const board = BOARDS[boardId]
  const boardBottom = BOARD_Y + board.height
  const boardTop = BOARD_Y
  const lane = (offsetIdx % 4) * 9

  // Manual user-dragged elbow keeps pin endpoints fixed at (a.x,a.y) & (b.x,b.y)
  if (wire.bendX !== undefined && wire.bendY !== undefined) {
    const mx = wire.bendX
    const my = wire.bendY
    const d = [
      `M ${a.x} ${a.y}`,
      `L ${a.sx} ${a.sy}`,
      `L ${a.sx} ${my}`,
      `L ${mx} ${my}`,
      `L ${b.sx} ${my}`,
      `L ${b.sx} ${b.sy}`,
      `L ${b.x} ${b.y}`,
    ].join(' ')
    return { d, handleX: mx, handleY: my, ax: a.x, ay: a.y, bx: b.x, by: b.y }
  }

  // Auto-route cleanly AROUND PCB if crossing from left side of board to right side (or vice versa)
  const crossesBoardLR =
    (a.side === 'left' && b.sx > BOARD_X + board.width) ||
    (b.side === 'left' && a.sx > BOARD_X + board.width)

  if (crossesBoardLR) {
    const leftY = a.side === 'left' ? a.y : b.y
    const clearY = leftY < boardTop + board.height / 2 ? boardTop - 20 - lane : boardBottom + 18 + lane
    const midX = Math.round((a.sx + b.sx) / 2)
    const d = [
      `M ${a.x} ${a.y}`,
      `L ${a.sx} ${a.sy}`,
      `L ${a.sx} ${clearY}`,
      `L ${b.sx} ${clearY}`,
      `L ${b.sx} ${b.sy}`,
      `L ${b.x} ${b.y}`,
    ].join(' ')
    return { d, handleX: midX, handleY: clearY, ax: a.x, ay: a.y, bx: b.x, by: b.y }
  }

  // Standard clean orthogonal jumper between pin exit stubs
  const midX = Math.round((a.sx + b.sx) / 2) + ((offsetIdx % 3) - 1) * 10
  const midY = Math.round((a.sy + b.sy) / 2)
  const d = [
    `M ${a.x} ${a.y}`,
    `L ${a.sx} ${a.sy}`,
    `L ${midX} ${a.sy}`,
    `L ${midX} ${b.sy}`,
    `L ${b.sx} ${b.sy}`,
    `L ${b.x} ${b.y}`,
  ].join(' ')
  return { d, handleX: midX, handleY: midY, ax: a.x, ay: a.y, bx: b.x, by: b.y }
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
  onMoveComponent,
  onUpdateProps,
  onAddWire,
  onUpdateWire,
  onDeleteWire,
  onDeleteComponent,
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
  onMoveComponent: (id: string, x: number, y: number) => void
  onUpdateProps: (id: string, patch: Partial<PlacedComponent['props']>) => void
  onAddWire: (from: WireEndpoint, to: WireEndpoint) => void
  onUpdateWire: (wireId: string, patch: Partial<Wire>) => void
  onDeleteWire: (wireId: string) => void
  onDeleteComponent: (id: string) => void
}) {
  const board = BOARDS[boardId]
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [showLabels, setShowLabels] = useState(true)
  const [selectedPin, setSelectedPin] = useState<WireEndpoint | null>(null)
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null)
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null)
  const [drawingPreview, setDrawingPreview] = useState<{
    from: WireEndpoint
    ax: number
    ay: number
    curX: number
    curY: number
    dragged: boolean
    startClientX: number
    startClientY: number
  } | null>(null)

  const compDragRef = useRef<{ compId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const wireDragRef = useRef<{ wireId: string; startX: number; startY: number; origBX: number; origBY: number } | null>(null)

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
    const vbW = Math.round(800 / zoom)
    const vbH = Math.round(450 / zoom)
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * vbW,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * vbH,
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWireId) {
          onDeleteWire(selectedWireId)
          setSelectedWireId(null)
        } else if (selectedCompId) {
          onDeleteComponent(selectedCompId)
          setSelectedCompId(null)
        }
      } else if (e.key === 'Escape') {
        setSelectedPin(null)
        setSelectedWireId(null)
        setSelectedCompId(null)
        setDrawingPreview(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedWireId, selectedCompId, onDeleteWire, onDeleteComponent])

  const onPinPointerDown = (ep: WireEndpoint, clientX: number, clientY: number) => {
    setSelectedWireId(null)
    // If another pin was already click-selected, connect immediately
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
    const samePin = drawingPreview.from.nodeId === ep.nodeId && drawingPreview.from.pinId === ep.pinId
    if (!samePin) {
      onAddWire(drawingPreview.from, ep)
      setSelectedPin(null)
      setDrawingPreview(null)
      return
    }
    // Single click on same pin -> keep selectedPin active for click-to-click mode
    if (!drawingPreview.dragged) {
      setSelectedPin((prev) =>
        prev && prev.nodeId === ep.nodeId && prev.pinId === ep.pinId ? null : ep,
      )
    }
    setDrawingPreview(null)
  }

  const startCompDrag = (compId: string, clientX: number, clientY: number) => {
    const comp = components.find((c) => c.id === compId)
    if (!comp) return
    setSelectedWireId(null)
    setSelectedCompId(compId)
    compDragRef.current = { compId, startX: clientX, startY: clientY, origX: comp.x, origY: comp.y }
  }

  const startWireDrag = (wire: Wire, handleX: number, handleY: number, clientX: number, clientY: number) => {
    setSelectedCompId(null)
    setSelectedWireId(wire.id)
    wireDragRef.current = {
      wireId: wire.id,
      startX: clientX,
      startY: clientY,
      origBX: wire.bendX ?? handleX,
      origBY: wire.bendY ?? handleY,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drawingPreview) {
      const pt = clientToSvg(e.clientX, e.clientY)
      const moved =
        Math.hypot(e.clientX - drawingPreview.startClientX, e.clientY - drawingPreview.startClientY) > 6
      setDrawingPreview((prev) =>
        prev ? { ...prev, curX: pt.x, curY: pt.y, dragged: prev.dragged || moved } : null,
      )
      return
    }
    if (compDragRef.current) {
      const d = compDragRef.current
      const dx = (e.clientX - d.startX) / zoom
      const dy = (e.clientY - d.startY) / zoom
      const nx = Math.max(295, Math.min(720, Math.round((d.origX + dx) / 10) * 10))
      const ny = Math.max(26, Math.min(350, Math.round((d.origY + dy) / 10) * 10))
      onMoveComponent(d.compId, nx, ny)
    } else if (wireDragRef.current) {
      const wd = wireDragRef.current
      const dx = (e.clientX - wd.startX) / zoom
      const dy = (e.clientY - wd.startY) / zoom
      const bx = Math.max(16, Math.min(784, Math.round((wd.origBX + dx) / 8) * 8))
      const by = Math.max(16, Math.min(434, Math.round((wd.origBY + dy) / 8) * 8))
      onUpdateWire(wd.wireId, { bendX: bx, bendY: by })
    }
  }

  const endDrag = (e?: React.PointerEvent<SVGSVGElement>) => {
    compDragRef.current = null
    wireDragRef.current = null
    if (drawingPreview) {
      if (drawingPreview.dragged && e) {
        const pt = clientToSvg(e.clientX, e.clientY)
        const target = findNearestPin(boardId, components, pt.x, pt.y)
        if (target && !(target.nodeId === drawingPreview.from.nodeId && target.pinId === drawingPreview.from.pinId)) {
          onAddWire(drawingPreview.from, target)
          setSelectedPin(null)
        }
      }
      if (drawingPreview.dragged) {
        setDrawingPreview(null)
      }
    }
  }

  const activeWire = wires.find((w) => w.id === selectedWireId) ?? null
  const canvasBg = isDark ? '#0b1322' : '#fdf4e3'
  const gridDot = isDark ? '#334155' : '#dfd2bc'
  const activeStartPin = drawingPreview?.from ?? selectedPin

  return (
    <div className="iot-canvas-shell" style={{ background: canvasBg }}>
      <div className="iot-floating-pill-wrap">
        <div className="iot-floating-pill" role="toolbar" aria-label={lang === 'en' ? 'Circuit Controls' : 'Kontrol Simulasi'}>
          <button
            type="button"
            className={`iot-play-pill ${sim.running ? 'is-running' : ''}`}
            onClick={onStartStop}
            title={sim.running ? (lang === 'en' ? 'Stop simulation' : 'Hentikan simulasi') : (lang === 'en' ? 'Run simulation' : 'Jalankan simulasi')}
          >
            {sim.running ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
            <span>{sim.running ? (lang === 'en' ? 'Stop' : 'Stop') : (lang === 'en' ? 'Run' : 'Jalankan')}</span>
          </button>

          <button
            type="button"
            className="iot-pill-btn"
            onClick={onCheckCircuit}
            title={lang === 'en' ? 'Check wiring & code' : 'Cek rangkaian & koding'}
          >
            <CheckSquare size={14} />
            <span>{lang === 'en' ? 'Check' : 'Cek'}</span>
          </button>

          <button type="button" className="iot-pill-btn" onClick={onReset} title="Reset">
            <RotateCcw size={14} />
          </button>

          <button
            type="button"
            className={`iot-pill-btn ${showLabels ? 'is-on' : ''}`}
            onClick={() => setShowLabels((v) => !v)}
            title={lang === 'en' ? 'Toggle pin & part labels' : 'Tampilkan/sembunyikan label pin'}
          >
            <Type size={14} />
          </button>

          <button type="button" className="iot-pill-btn" onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.1).toFixed(2)))} aria-label="Zoom out">
            <ZoomOut size={14} />
          </button>
          <button type="button" className="iot-pill-btn" onClick={() => setZoom(1)} aria-label="Reset zoom">
            <Maximize2 size={14} />
          </button>
          <button type="button" className="iot-pill-btn" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} aria-label="Zoom in">
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      <div className="iot-canvas-subbar">
        <span className="iot-wire-hint">
          {activeStartPin
            ? lang === 'en'
              ? `Pulling wire from ${activeStartPin.nodeId}:${activeStartPin.pinId} — drop or click target pin`
              : `Menarik kabel dari ${activeStartPin.nodeId}:${activeStartPin.pinId} — arahkan & klik/lepas di pin tujuan`
            : activeWire
              ? lang === 'en'
                ? 'Wire selected: drag the handle dot to bend cable cleanly (pins stay anchored).'
                : 'Kabel dipilih: geser titik pegangan putih untuk menggeser kabel (pin tetap terkunci).'
              : lang === 'en'
                ? 'Drag from any pin (or click two pins) to connect a wire · Click any wire to bend/edit'
                : 'Tarik langsung dari pin ke pin (atau klik dua pin) untuk pasang kabel · Klik kabel untuk menggeser jalur'}
        </span>

        <div className="iot-canvas-btns">
          {activeStartPin ? (
            <button type="button" className="btn-outline iot-mini-btn" onClick={() => { setSelectedPin(null); setDrawingPreview(null) }}>
              {lang === 'en' ? 'Cancel' : 'Batal'}
            </button>
          ) : null}

          {activeWire ? (
            <>
              <div className="iot-wire-picker">
                {WIRE_COLORS.map((wc) => (
                  <button
                    key={wc.id}
                    type="button"
                    className={`iot-color-dot ${activeWire.color === wc.id ? 'is-selected' : ''}`}
                    style={{ background: wc.id }}
                    title={lang === 'en' ? wc.nameEn : wc.nameId}
                    onClick={() => onUpdateWire(activeWire.id, { color: wc.id })}
                  />
                ))}
              </div>
              {(activeWire.bendX !== undefined || activeWire.bendY !== undefined) ? (
                <button
                  type="button"
                  className="btn-outline iot-mini-btn"
                  onClick={() => onUpdateWire(activeWire.id, { bendX: undefined, bendY: undefined })}
                >
                  {lang === 'en' ? 'Reset Bend' : 'Luruskan'}
                </button>
              ) : null}
              <button
                type="button"
                className="btn-outline iot-mini-btn"
                onClick={() => {
                  onDeleteWire(activeWire.id)
                  setSelectedWireId(null)
                }}
              >
                <Trash2 size={13} /> {lang === 'en' ? 'Delete Wire' : 'Hapus Kabel'}
              </button>
            </>
          ) : null}

          {selectedCompId ? (
            <button
              type="button"
              className="btn-outline iot-mini-btn"
              onClick={() => {
                onDeleteComponent(selectedCompId)
                setSelectedCompId(null)
              }}
            >
              <Trash2 size={13} /> {lang === 'en' ? 'Remove Part' : 'Hapus Part'}
            </button>
          ) : null}
        </div>
      </div>

      <svg
        ref={svgRef}
        className="iot-svg-board"
        viewBox={`0 0 ${Math.round(800 / zoom)} ${Math.round(450 / zoom)}`}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => endDrag(e)}
        onPointerLeave={() => endDrag()}
        onClick={() => {
          setSelectedCompId(null)
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

        {/* Layer 1: Microcontroller Board & Components */}
        <BoardHardwareView
          board={board}
          boardX={BOARD_X}
          boardY={BOARD_Y}
          sim={sim}
          selectedPin={activeStartPin}
          showLabels={showLabels}
          onPinPointerDown={onPinPointerDown}
          onPinPointerUp={onPinPointerUp}
        />

        {components.map((comp) => (
          <ComponentHardwareView
            key={comp.id}
            comp={comp}
            sim={sim}
            selectedPin={activeStartPin}
            selectedComp={selectedCompId === comp.id}
            showLabels={showLabels}
            isDark={isDark}
            onStartDrag={startCompDrag}
            onPinPointerDown={onPinPointerDown}
            onPinPointerUp={onPinPointerUp}
            onUpdateProps={onUpdateProps}
          />
        ))}

        {/* Layer 2: Flexible Orthogonal Jumper Wires rendered cleanly ON TOP (never hidden behind PCB) */}
        {wires.map((w, idx) => {
          const pathInfo = buildFlexibleWirePath(boardId, components, w, idx)
          if (!pathInfo) return null
          const { d, handleX, handleY, ax, ay, bx, by } = pathInfo
          const isSelected = selectedWireId === w.id
          return (
            <g
              key={w.id}
              className={`iot-wire-group ${isSelected ? 'is-selected' : ''}`}
              style={{ pointerEvents: drawingPreview ? 'none' : undefined }}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedCompId(null)
                setSelectedPin(null)
                setSelectedWireId(w.id)
              }}
            >
              <path d={d} fill="none" stroke="transparent" strokeWidth={18} pointerEvents="stroke" />
              {isSelected ? (
                <path d={d} fill="none" stroke="#f59e0b" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} />
              ) : null}
              <path
                d={d}
                fill="none"
                stroke={w.color || wireColor}
                strokeWidth={isSelected ? 3.8 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Crisp pin-plug dots locked tightly onto the pin endpoints */}
              <circle cx={ax} cy={ay} r={3.5} fill={w.color || wireColor} stroke="#ffffff" strokeWidth={1} style={{ pointerEvents: 'none' }} />
              <circle cx={bx} cy={by} r={3.5} fill={w.color || wireColor} stroke="#ffffff" strokeWidth={1} style={{ pointerEvents: 'none' }} />

              {sim.running ? (
                <circle r={3} fill="#ffffff" opacity={0.9} style={{ pointerEvents: 'none' }}>
                  <animateMotion dur="1.3s" repeatCount="indefinite" path={d} />
                </circle>
              ) : null}
              {isSelected ? (
                <g
                  style={{ cursor: 'move' }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    startWireDrag(w, handleX, handleY, e.clientX, e.clientY)
                  }}
                >
                  <circle cx={handleX} cy={handleY} r={8} fill="#ffffff" stroke="#f59e0b" strokeWidth={2.5} />
                  <circle cx={handleX} cy={handleY} r={2.5} fill="#0f172a" />
                  <title>{lang === 'en' ? 'Drag to reshape wire' : 'Geser untuk menggeser jalur kabel'}</title>
                </g>
              ) : null}
            </g>
          )
        })}

        {/* Layer 3: Live wire preview when pulling directly from a pin */}
        {drawingPreview ? (
          <g style={{ pointerEvents: 'none' }}>
            <path
              d={`M ${drawingPreview.ax} ${drawingPreview.ay} L ${Math.round((drawingPreview.ax + drawingPreview.curX) / 2)} ${drawingPreview.ay} L ${Math.round((drawingPreview.ax + drawingPreview.curX) / 2)} ${drawingPreview.curY} L ${drawingPreview.curX} ${drawingPreview.curY}`}
              fill="none"
              stroke={wireColor}
              strokeWidth={3}
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
            <circle cx={drawingPreview.ax} cy={drawingPreview.ay} r={5} fill="#f59e0b" />
            <circle cx={drawingPreview.curX} cy={drawingPreview.curY} r={5} fill={wireColor} stroke="#fff" strokeWidth={1.5} />
          </g>
        ) : null}
      </svg>
    </div>
  )
}
