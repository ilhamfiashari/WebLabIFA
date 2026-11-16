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

const BOARD_X = 42
const BOARD_Y = 76

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

function buildFlexibleWirePath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  wire: Wire,
  offsetIdx: number,
): { d: string; handleX: number; handleY: number } {
  const defaultMidX = Math.round((ax + bx) / 2) + ((offsetIdx % 5) - 2) * 10
  const mx = wire.bendX ?? defaultMidX

  if (wire.bendY !== undefined) {
    const my = wire.bendY
    const d = `M ${ax} ${ay} L ${mx} ${ay} L ${mx} ${my} L ${bx} ${my} L ${bx} ${by}`
    return { d, handleX: mx, handleY: my }
  }

  const r = 6
  if (Math.abs(ay - by) < 6 && wire.bendX === undefined) {
    return {
      d: `M ${ax} ${ay} L ${bx} ${by}`,
      handleX: Math.round((ax + bx) / 2),
      handleY: Math.round((ay + by) / 2),
    }
  }
  const sy = by > ay ? 1 : -1
  const sx1 = mx >= ax ? 1 : -1
  const sx2 = bx >= mx ? 1 : -1
  const radY = Math.min(r, Math.abs(by - ay) / 2)
  const radX1 = Math.min(r, Math.abs(mx - ax) / 2)
  const radX2 = Math.min(r, Math.abs(bx - mx) / 2)
  const d = [
    `M ${ax} ${ay}`,
    `L ${mx - sx1 * radX1} ${ay}`,
    `Q ${mx} ${ay} ${mx} ${ay + sy * radY}`,
    `L ${mx} ${by - sy * radY}`,
    `Q ${mx} ${by} ${mx + sx2 * radX2} ${by}`,
    `L ${bx} ${by}`,
  ].join(' ')
  return { d, handleX: mx, handleY: Math.round((ay + by) / 2) }
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

  const compDragRef = useRef<{ compId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const wireDragRef = useRef<{ wireId: string; startX: number; startY: number; origBX: number; origBY: number } | null>(null)

  // Delete selected wire/part on Backspace/Delete key (when not typing in textarea/input)
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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedWireId, selectedCompId, onDeleteWire, onDeleteComponent])

  const handlePinClick = (ep: WireEndpoint) => {
    setSelectedWireId(null)
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
    if (compDragRef.current) {
      const d = compDragRef.current
      const dx = (e.clientX - d.startX) / zoom
      const dy = (e.clientY - d.startY) / zoom
      const nx = Math.max(280, Math.min(720, Math.round((d.origX + dx) / 10) * 10))
      const ny = Math.max(26, Math.min(350, Math.round((d.origY + dy) / 10) * 10))
      onMoveComponent(d.compId, nx, ny)
    } else if (wireDragRef.current) {
      const wd = wireDragRef.current
      const dx = (e.clientX - wd.startX) / zoom
      const dy = (e.clientY - wd.startY) / zoom
      const bx = Math.max(20, Math.min(790, Math.round((wd.origBX + dx) / 8) * 8))
      const by = Math.max(20, Math.min(420, Math.round((wd.origBY + dy) / 8) * 8))
      onUpdateWire(wd.wireId, { bendX: bx, bendY: by })
    }
  }

  const endDrag = () => {
    compDragRef.current = null
    wireDragRef.current = null
  }

  const activeWire = wires.find((w) => w.id === selectedWireId) ?? null
  const canvasBg = isDark ? '#0b1322' : '#fdf4e3'
  const gridDot = isDark ? '#334155' : '#dfd2bc'

  return (
    <div className="iot-canvas-shell" style={{ background: canvasBg }}>
      {/* Floating Center Pill Toolbar matching iotsimulator.net */}
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
            title={lang === 'en' ? 'Toggle pin & part labels' : 'Tampilkan/sembunyikan label'}
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

      {/* Flexible Context Bar for Selected Pin / Wire / Component */}
      <div className="iot-canvas-subbar">
        <span className="iot-wire-hint">
          {selectedPin
            ? lang === 'en'
              ? `Connecting ${selectedPin.nodeId}:${selectedPin.pinId} — click target pin`
              : `Menyambung ${selectedPin.nodeId}:${selectedPin.pinId} — klik pin tujuan`
            : activeWire
              ? lang === 'en'
                ? 'Wire selected: drag the white handle to reroute, recolor, or delete.'
                : 'Kabel dipilih: geser titik putih untuk membelokkan jalur, ubah warna, atau hapus.'
              : lang === 'en'
                ? 'Click pins to connect wires · Click a wire to bend/edit · Drag parts on grid'
                : 'Klik dua pin untuk menyambung kabel · Klik kabel untuk geser belokan · Geser part di grid'}
        </span>

        <div className="iot-canvas-btns">
          {selectedPin ? (
            <button type="button" className="btn-outline iot-mini-btn" onClick={() => setSelectedPin(null)}>
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
        viewBox={`0 0 ${Math.round(800 / zoom)} ${Math.round(440 / zoom)}`}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
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

        {/* Flexible Orthogonal Jumper Wires */}
        {wires.map((w, idx) => {
          const a = getEndpointXY(boardId, components, w.from)
          const b = getEndpointXY(boardId, components, w.to)
          if (!a || !b) return null
          const { d, handleX, handleY } = buildFlexibleWirePath(a.x, a.y, b.x, b.y, w, idx)
          const isSelected = selectedWireId === w.id
          return (
            <g
              key={w.id}
              className={`iot-wire-group ${isSelected ? 'is-selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedCompId(null)
                setSelectedPin(null)
                setSelectedWireId(w.id)
              }}
            >
              {/* Wide hit target for easy click/selection */}
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
              {sim.running ? (
                <circle r={3} fill="#ffffff" opacity={0.9}>
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
                  <title>{lang === 'en' ? 'Drag to reshape wire' : 'Geser untuk mengubah belokan kabel'}</title>
                </g>
              ) : null}
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
          showLabels={showLabels}
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
            showLabels={showLabels}
            isDark={isDark}
            onStartDrag={startCompDrag}
            onPinClick={handlePinClick}
            onUpdateProps={onUpdateProps}
          />
        ))}
      </svg>
    </div>
  )
}
