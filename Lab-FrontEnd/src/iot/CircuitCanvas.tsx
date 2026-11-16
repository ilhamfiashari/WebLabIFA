import { useRef, useState } from 'react'
import { Maximize2, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { BOARDS, getBoardPin, getComponentSpec } from './boards'
import { BoardHardwareView, ComponentHardwareView } from './CircuitSvgComponents'
import type { BoardId, PlacedComponent, SimulationState, Wire, WireEndpoint } from './types'

const BOARD_X = 48
const BOARD_Y = 92

function getEndpointXY(
  boardId: BoardId,
  components: PlacedComponent[],
  ep: WireEndpoint,
): { x: number; y: number } | null {
  if (ep.nodeId === 'board') {
    const p = getBoardPin(boardId, ep.pinId)
    if (!p) return null
    return { x: BOARD_X + p.x, y: BOARD_Y + p.y }
  }
  const comp = components.find((c) => c.id === ep.nodeId)
  if (!comp) return null
  const spec = getComponentSpec(comp.kind)
  const pin = spec.pins.find((p) => p.id === ep.pinId)
  if (!pin) return null
  return { x: comp.x + pin.dx, y: comp.y + pin.dy }
}

function manhattanWirePath(ax: number, ay: number, bx: number, by: number, offsetIdx: number): string {
  const midX = Math.round((ax + bx) / 2) + ((offsetIdx % 5) - 2) * 8
  const r = 6
  if (Math.abs(ax - bx) < 4 || Math.abs(ay - by) < 4) {
    return `M ${ax} ${ay} L ${bx} ${by}`
  }
  const sy = by > ay ? 1 : -1
  const sx1 = midX > ax ? 1 : -1
  const sx2 = bx > midX ? 1 : -1
  return [
    `M ${ax} ${ay}`,
    `L ${midX - sx1 * r} ${ay}`,
    `Q ${midX} ${ay} ${midX} ${ay + sy * r}`,
    `L ${midX} ${by - sy * r}`,
    `Q ${midX} ${by} ${midX + sx2 * r} ${by}`,
    `L ${bx} ${by}`,
  ].join(' ')
}

export function CircuitCanvas({
  boardId,
  components,
  wires,
  sim,
  wireColor,
  lang,
  onMoveComponent,
  onUpdateProps,
  onAddWire,
  onDeleteWire,
  onDeleteComponent,
}: {
  boardId: BoardId
  components: PlacedComponent[]
  wires: Wire[]
  sim: SimulationState
  wireColor: string
  lang: 'id' | 'en'
  onMoveComponent: (id: string, x: number, y: number) => void
  onUpdateProps: (id: string, patch: Partial<PlacedComponent['props']>) => void
  onAddWire: (from: WireEndpoint, to: WireEndpoint) => void
  onDeleteWire: (wireId: string) => void
  onDeleteComponent: (id: string) => void
}) {
  const board = BOARDS[boardId]
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [selectedPin, setSelectedPin] = useState<WireEndpoint | null>(null)
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null)
  const dragRef = useRef<{ compId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const handlePinClick = (ep: WireEndpoint) => {
    if (!selectedPin) {
      setSelectedPin(ep)
      return
    }
    if (selectedPin.nodeId === ep.nodeId && selectedPin.pinId === ep.pinId) {
      setSelectedPin(null)
      return
    }
    onAddWire(selectedPin, ep)
    setSelectedPin(null)
  }

  const startDrag = (compId: string, clientX: number, clientY: number) => {
    const comp = components.find((c) => c.id === compId)
    if (!comp) return
    setSelectedCompId(compId)
    dragRef.current = { compId, startX: clientX, startY: clientY, origX: comp.x, origY: comp.y }
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current
    if (!d) return
    const dx = (e.clientX - d.startX) / zoom
    const dy = (e.clientY - d.startY) / zoom
    const nx = Math.max(230, Math.min(760, Math.round((d.origX + dx) / 10) * 10))
    const ny = Math.max(30, Math.min(350, Math.round((d.origY + dy) / 10) * 10))
    onMoveComponent(d.compId, nx, ny)
  }

  const endDrag = () => {
    dragRef.current = null
  }

  return (
    <div className="iot-canvas-shell">
      <div className="iot-canvas-toolbar">
        <span className="iot-wire-hint">
          {selectedPin
            ? lang === 'en'
              ? `Connecting from ${selectedPin.nodeId}:${selectedPin.pinId} — click target pin`
              : `Menyambung dari ${selectedPin.nodeId}:${selectedPin.pinId} — klik pin tujuan`
            : lang === 'en'
              ? 'Click any two pins to wire · Drag components to arrange'
              : 'Klik dua pin untuk memasang kabel · Geser komponen di grid'}
        </span>
        <div className="iot-canvas-btns">
          {selectedPin ? (
            <button type="button" className="btn-outline iot-mini-btn" onClick={() => setSelectedPin(null)}>
              {lang === 'en' ? 'Cancel Wire' : 'Batal Kabel'}
            </button>
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
          <button type="button" className="btn-outline iot-mini-btn" onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.1).toFixed(2)))} aria-label="Zoom out">
            <ZoomOut size={13} />
          </button>
          <button type="button" className="btn-outline iot-mini-btn" onClick={() => setZoom(1)} aria-label="Reset zoom">
            <Maximize2 size={13} />
          </button>
          <button type="button" className="btn-outline iot-mini-btn" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} aria-label="Zoom in">
            <ZoomIn size={13} />
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        className="iot-svg-board"
        viewBox={`0 0 ${Math.round(740 / zoom)} ${Math.round(420 / zoom)}`}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClick={() => {
          setSelectedCompId(null)
        }}
      >
        <defs>
          <pattern id="iot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#334155" opacity="0.55" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="#0b1322" />
        <rect width="100%" height="100%" fill="url(#iot-grid)" />

        {/* Orthogonal Jumper Wires */}
        {wires.map((w, idx) => {
          const a = getEndpointXY(boardId, components, w.from)
          const b = getEndpointXY(boardId, components, w.to)
          if (!a || !b) return null
          const d = manhattanWirePath(a.x, a.y, b.x, b.y, idx)
          return (
            <g
              key={w.id}
              className="iot-wire-group"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteWire(w.id)
              }}
            >
              <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
              <path
                d={d}
                fill="none"
                stroke={w.color || wireColor}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {sim.running ? (
                <circle r={3} fill="#ffffff" opacity={0.85}>
                  <animateMotion dur="1.4s" repeatCount="indefinite" path={d} />
                </circle>
              ) : null}
              <title>{lang === 'en' ? 'Click wire to remove' : 'Klik kabel untuk menghapus'}</title>
            </g>
          )
        })}

        {/* Microcontroller Board */}
        <BoardHardwareView
          board={board}
          boardX={BOARD_X}
          boardY={BOARD_Y}
          sim={sim}
          selectedPin={selectedPin}
          onPinClick={handlePinClick}
        />

        {/* Placed Circuit Components */}
        {components.map((comp) => (
          <ComponentHardwareView
            key={comp.id}
            comp={comp}
            sim={sim}
            selectedPin={selectedPin}
            selectedComp={selectedCompId === comp.id}
            onStartDrag={startDrag}
            onPinClick={handlePinClick}
            onUpdateProps={onUpdateProps}
          />
        ))}
      </svg>
    </div>
  )
}
