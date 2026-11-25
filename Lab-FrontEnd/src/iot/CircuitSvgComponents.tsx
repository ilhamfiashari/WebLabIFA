import type { BoardId, BoardSpec, ComponentKind, PlacedComponent, SimulationState, WireEndpoint } from './types'
import { decodeResistorBands, formatOhms, getComponentSpec, isBreadboardKind, rotatePointAroundBox } from './boards'
import { RealBoardBodySvg, WokwiExtendedPartSvg, WokwiPartThumbnail } from './WokwiPartsSvg'

export function BoardThumbnail({ boardId }: { boardId: BoardId }) {
  if (boardId === 'arduino-uno') {
    return (
      <svg viewBox="0 0 110 64" width="100%" height="56" aria-hidden="true">
        <path d="M16 10 H86 L92 16 V48 L86 54 H16 Q12 54 12 50 V14 Q12 10 16 10 Z" fill="#00878f" stroke="#0f172a" strokeWidth={1.1} />
        <rect x={6} y={16} width={14} height={12} rx={2} fill="#e2e8f0" stroke="#475569" />
        <rect x={8} y={38} width={12} height={10} rx={2} fill="#18181b" />
        <rect x={36} y={12} width={48} height={5} fill="#18181b" />
        <rect x={42} y={47} width={34} height={5} fill="#18181b" />
        <rect x={46} y={29} width={34} height={11} rx={1.5} fill="#111827" stroke="#94a3b8" strokeWidth={0.7} />
      </svg>
    )
  }
  if (boardId === 'arduino-mega') {
    return (
      <svg viewBox="0 0 110 64" width="100%" height="56" aria-hidden="true">
        <path d="M10 10 H98 L104 16 V48 L98 54 H10 Q6 54 6 50 V14 Q6 10 10 10 Z" fill="#008189" stroke="#0f172a" strokeWidth={1.1} />
        <rect x={2} y={16} width={12} height={12} rx={2} fill="#e2e8f0" stroke="#475569" />
        <rect x={4} y={38} width={11} height={10} rx={2} fill="#18181b" />
        <rect x={30} y={12} width={56} height={5} fill="#18181b" />
        <rect x={92} y={18} width={8} height={28} fill="#18181b" />
        <rect x={48} y={23} width={20} height={18} rx={2} fill="#111827" stroke="#94a3b8" strokeWidth={0.8} />
      </svg>
    )
  }
  if (boardId === 'pico-w' || boardId === 'pi-pico') {
    return (
      <svg viewBox="0 0 110 64" width="100%" height="56" aria-hidden="true">
        <rect x={36} y={7} width={38} height={50} rx={4} fill={boardId === 'pi-pico' ? '#166534' : '#15803d'} stroke="#052e16" strokeWidth={1.1} />
        <rect x={47} y={3} width={16} height={8} rx={2} fill="#e2e8f0" stroke="#475569" />
        <rect x={45} y={16} width={12} height={7} rx={1.5} fill="#f8fafc" />
        {boardId === 'pico-w' ? <rect x={44} y={40} width={22} height={13} rx={2} fill="#cbd5e1" stroke="#64748b" /> : null}
        <g transform="translate(55,31) rotate(45)">
          <rect x={-5} y={-5} width={10} height={10} fill="#0f172a" />
        </g>
      </svg>
    )
  }
  if (boardId === 'arduino-nano') {
    return (
      <svg viewBox="0 0 110 64" width="100%" height="56" aria-hidden="true">
        <rect x={34} y={8} width={42} height={48} rx={4} fill="#006d77" stroke="#083344" strokeWidth={1.2} />
        <rect x={46} y={3} width={18} height={9} rx={2} fill="#cbd5e1" stroke="#475569" />
        <g transform="translate(55,30) rotate(45)">
          <rect x={-6} y={-6} width={12} height={12} fill="#18181b" stroke="#64748b" strokeWidth={0.8} />
        </g>
        <circle cx={55} cy={46} r={4} fill="#e2e8f0" />
      </svg>
    )
  }
  if (boardId === 'esp32') {
    return (
      <svg viewBox="0 0 110 64" width="100%" height="56" aria-hidden="true">
        <rect x={28} y={8} width={54} height={50} rx={4} fill="#18181b" stroke="#475569" strokeWidth={1.1} />
        <path d="M44 9 V4 H49 V9 H54 V4 H59 V9 H65 V4" fill="none" stroke="#d4af37" strokeWidth={1.4} />
        <rect x={41} y={12} width={28} height={24} rx={2} fill="#cbd5e1" stroke="#64748b" />
        <rect x={47} y={49} width={16} height={9} rx={2} fill="#e2e8f0" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <circle cx={33} cy={22 + i * 7} r={1.6} fill="#eab308" />
            <circle cx={77} cy={22 + i * 7} r={1.6} fill="#eab308" />
          </g>
        ))}
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 110 64" width="100%" height="56" aria-hidden="true">
      <rect x={32} y={8} width={46} height={48} rx={5} fill="#0f172a" stroke="#475569" strokeWidth={1.2} />
      <rect x={47} y={10} width={16} height={5} rx={1} fill="#f8fafc" />
      <rect x={42} y={18} width={26} height={19} rx={2} fill="#cbd5e1" stroke="#64748b" />
      <rect x={47} y={48} width={16} height={8} rx={2} fill="#e2e8f0" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <circle cx={37} cy={17 + i * 7.5} r={1.6} fill="#facc15" />
          <circle cx={73} cy={17 + i * 7.5} r={1.6} fill="#facc15" />
        </g>
      ))}
    </svg>
  )
}

export function PartThumbnail({ kind }: { kind: ComponentKind }) {
  const extThumb = WokwiPartThumbnail({ kind })
  if (extThumb) return extThumb
  return (
    <svg viewBox="0 0 110 64" width="100%" height="56" aria-hidden="true">
      {kind === 'led' ? (
        <g transform="translate(36, 4)">
          <path d="M10 38 V16 A10 10 0 0 1 30 16 V38 Z" fill="#ef4444" stroke="#991b1b" strokeWidth={1.2} />
          <rect x={8} y={36} width={24} height={4} rx={1.5} fill="#dc2626" />
          <ellipse cx={16} cy={18} rx={3} ry={6} fill="rgba(255,255,255,0.45)" />
          <line x1={15} y1={40} x2={15} y2={56} stroke="#94a3b8" strokeWidth={2.4} />
          <line x1={25} y1={40} x2={25} y2={52} stroke="#94a3b8" strokeWidth={2.4} />
        </g>
      ) : kind === 'rgb-led' ? (
        <g transform="translate(34, 4)">
          <path d="M11 38 V16 A10 10 0 0 1 31 16 V38 Z" fill="url(#thumb-rgb)" stroke="#475569" strokeWidth={1.2} />
          <defs>
            <linearGradient id="thumb-rgb" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          {[12, 18, 24, 30].map((lx) => (
            <line key={lx} x1={lx} y1={38} x2={lx} y2={54} stroke="#94a3b8" strokeWidth={2} />
          ))}
        </g>
      ) : kind === 'pushbutton' ? (
        <g transform="translate(23, 8)">
          <rect x={14} y={6} width={36} height={36} rx={4} fill="#e2e8f0" stroke="#334155" strokeWidth={1.8} />
          <line x1={2} y1={14} x2={14} y2={14} stroke="#64748b" strokeWidth={3} />
          <line x1={2} y1={34} x2={14} y2={34} stroke="#64748b" strokeWidth={3} />
          <line x1={50} y1={14} x2={62} y2={14} stroke="#64748b" strokeWidth={3} />
          <line x1={50} y1={34} x2={62} y2={34} stroke="#64748b" strokeWidth={3} />
          <circle cx={32} cy={24} r={12} fill="#ef4444" stroke="#991b1b" strokeWidth={1.4} />
          <circle cx={29} cy={21} r={4} fill="rgba(255,255,255,0.28)" />
        </g>
      ) : kind === 'resistor' ? (
        <g transform="translate(8, 18)">
          <line x1={4} y1={14} x2={90} y2={14} stroke="#94a3b8" strokeWidth={3.2} />
          <path d="M22 6 Q28 6 32 8 H62 Q66 6 72 6 Q76 14 72 22 Q66 22 62 20 H32 Q28 22 22 22 Q18 14 22 6 Z" fill="#e6cfa3" stroke="#a16207" strokeWidth={1.2} />
          <rect x={28} y={6.5} width={5} height={15} fill="#dc2626" />
          <rect x={39} y={7.5} width={5} height={13} fill="#dc2626" />
          <rect x={50} y={7.5} width={5} height={13} fill="#78350f" />
          <rect x={63} y={6.5} width={4} height={15} fill="#eab308" />
        </g>
      ) : kind === 'breadboard-mini' ? (
        <g transform="translate(18, 8)">
          <rect x={2} y={2} width={70} height={44} rx={3} fill="#d6d3c9" />
          <rect x={0} y={0} width={70} height={42} rx={3} fill="#f7f6f0" stroke="#cbd5e1" strokeWidth={1.1} />
          <rect x={3} y={19} width={64} height={4} rx={1} fill="#e5e3d8" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => (
            <g key={c}>
              <rect x={8 + c * 5.8} y={7} width={2.2} height={2.2} rx={0.4} fill="#1e293b" />
              <rect x={8 + c * 5.8} y={12} width={2.2} height={2.2} rx={0.4} fill="#1e293b" />
              <rect x={8 + c * 5.8} y={28} width={2.2} height={2.2} rx={0.4} fill="#1e293b" />
              <rect x={8 + c * 5.8} y={33} width={2.2} height={2.2} rx={0.4} fill="#1e293b" />
            </g>
          ))}
        </g>
      ) : kind === 'breadboard' ? (
        <g transform="translate(8, 5)">
          <rect x={2} y={2} width={88} height={52} rx={3} fill="#d6d3c9" />
          <rect x={0} y={0} width={88} height={50} rx={3} fill="#f7f6f0" stroke="#cbd5e1" strokeWidth={1.1} />
          <line x1={6} y1={5} x2={82} y2={5} stroke="#2563eb" strokeWidth={1.1} />
          <line x1={6} y1={11} x2={82} y2={11} stroke="#dc2626" strokeWidth={1.1} />
          <line x1={6} y1={39} x2={82} y2={39} stroke="#2563eb" strokeWidth={1.1} />
          <line x1={6} y1={45} x2={82} y2={45} stroke="#dc2626" strokeWidth={1.1} />
          <rect x={3} y={23} width={82} height={4} rx={1} fill="#e5e3d8" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((c) => (
            <g key={c}>
              <rect x={9 + c * 6.2} y={14.5} width={2.2} height={2.2} rx={0.4} fill="#1e293b" />
              <rect x={9 + c * 6.2} y={19} width={2.2} height={2.2} rx={0.4} fill="#1e293b" />
              <rect x={9 + c * 6.2} y={29} width={2.2} height={2.2} rx={0.4} fill="#1e293b" />
              <rect x={9 + c * 6.2} y={33.5} width={2.2} height={2.2} rx={0.4} fill="#1e293b" />
            </g>
          ))}
        </g>
      ) : kind === 'breadboard-large' ? (
        <g transform="translate(4, 6)">
          <rect x={2} y={2} width={98} height={48} rx={3} fill="#d6d3c9" />
          <rect x={0} y={0} width={98} height={46} rx={3} fill="#f7f6f0" stroke="#cbd5e1" strokeWidth={1.1} />
          <line x1={5} y1={4.5} x2={93} y2={4.5} stroke="#2563eb" strokeWidth={1.1} />
          <line x1={5} y1={9.5} x2={93} y2={9.5} stroke="#dc2626" strokeWidth={1.1} />
          <line x1={5} y1={36.5} x2={93} y2={36.5} stroke="#2563eb" strokeWidth={1.1} />
          <line x1={5} y1={41.5} x2={93} y2={41.5} stroke="#dc2626" strokeWidth={1.1} />
          <rect x={3} y={21} width={92} height={4} rx={1} fill="#e5e3d8" />
          {Array.from({ length: 16 }, (_, c) => (
            <g key={c}>
              <rect x={7 + c * 5.4} y={13} width={1.9} height={1.9} rx={0.3} fill="#1e293b" />
              <rect x={7 + c * 5.4} y={17} width={1.9} height={1.9} rx={0.3} fill="#1e293b" />
              <rect x={7 + c * 5.4} y={27} width={1.9} height={1.9} rx={0.3} fill="#1e293b" />
              <rect x={7 + c * 5.4} y={31} width={1.9} height={1.9} rx={0.3} fill="#1e293b" />
            </g>
          ))}
        </g>
      ) : kind === 'potentiometer' ? (
        <g transform="translate(27, 4)">
          <rect x={6} y={4} width={44} height={44} rx={5} fill="#0369a1" stroke="#0284c7" strokeWidth={1.4} />
          <circle cx={28} cy={24} r={15} fill="#e2e8f0" stroke="#64748b" strokeWidth={1.6} />
          <line x1={28} y1={24} x2={37} y2={14} stroke="#0f172a" strokeWidth={2.8} strokeLinecap="round" />
          {[16, 28, 40].map((px) => (
            <line key={px} x1={px} y1={48} x2={px} y2={56} stroke="#94a3b8" strokeWidth={2.5} />
          ))}
        </g>
      ) : kind === 'hc-sr04' ? (
        <g transform="translate(13, 8)">
          <rect x={2} y={4} width={80} height={38} rx={4} fill="#1d4ed8" stroke="#60a5fa" strokeWidth={1.4} />
          <circle cx={24} cy={23} r={12} fill="#cbd5e1" stroke="#475569" strokeWidth={1.8} />
          <circle cx={24} cy={23} r={7} fill="#0f172a" />
          <circle cx={60} cy={23} r={12} fill="#cbd5e1" stroke="#475569" strokeWidth={1.8} />
          <circle cx={60} cy={23} r={7} fill="#0f172a" />
          {[28, 36, 44, 52].map((px) => (
            <line key={px} x1={px} y1={42} x2={px} y2={50} stroke="#facc15" strokeWidth={2} />
          ))}
        </g>
      ) : kind === 'dht22' ? (
        <g transform="translate(28, 5)">
          <rect x={6} y={2} width={42} height={42} rx={4} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1.4} />
          <rect x={12} y={8} width={30} height={24} rx={2} fill="#e2e8f0" stroke="#cbd5e1" />
          {[14, 20, 26].map((gy) => (
            <line key={gy} x1={15} y1={gy} x2={39} y2={gy} stroke="#94a3b8" strokeWidth={1.5} />
          ))}
          {[16, 27, 38].map((px) => (
            <line key={px} x1={px} y1={44} x2={px} y2={53} stroke="#94a3b8" strokeWidth={2} />
          ))}
        </g>
      ) : kind === 'lcd-1602' ? (
        <g transform="translate(11, 8)">
          <rect x={2} y={4} width={84} height={40} rx={3} fill="#0f766e" stroke="#115e59" strokeWidth={1.4} />
          <rect x={8} y={10} width={72} height={28} rx={2} fill="#84cc16" stroke="#1e293b" strokeWidth={2} />
          <line x1={12} y1={19} x2={68} y2={19} stroke="#365314" strokeWidth={2} strokeDasharray="3 2" />
          <line x1={12} y1={28} x2={56} y2={28} stroke="#365314" strokeWidth={2} strokeDasharray="3 2" />
        </g>
      ) : kind === 'oled-ssd1306' ? (
        <g transform="translate(17, 6)">
          <rect x={4} y={4} width={68} height={46} rx={4} fill="#1e3a8a" stroke="#60a5fa" strokeWidth={1.4} />
          <rect x={10} y={13} width={56} height={30} rx={2} fill="#020617" />
          <text x={38} y={31} textAnchor="middle" fontSize="8.5" fontFamily="monospace" fill="#38bdf8">128×64</text>
        </g>
      ) : kind === 'servo' ? (
        <g transform="translate(16, 8)">
          <path d="M2 24 H14 M2 28 H14 M2 32 H14" stroke="#f97316" strokeWidth={2.5} />
          <rect x={14} y={12} width={56} height={30} rx={4} fill="#334155" stroke="#1e293b" strokeWidth={1.4} />
          <circle cx={52} cy={27} r={10} fill="#cbd5e1" stroke="#475569" />
          <rect x={48} y={2} width={8} height={26} rx={4} fill="#f8fafc" stroke="#64748b" strokeWidth={1.2} />
        </g>
      ) : kind === 'buzzer' ? (
        <g transform="translate(28, 6)">
          <circle cx={27} cy={26} r={21} fill="#1e293b" stroke="#475569" strokeWidth={1.8} />
          <circle cx={27} cy={26} r={6} fill="#cbd5e1" />
        </g>
      ) : kind === 'ldr' ? (
        <g transform="translate(27, 8)">
          <circle cx={28} cy={20} r={16} fill="#fde68a" stroke="#b45309" strokeWidth={2} />
          <path d="M18 20 Q23 13 28 20 T38 20" fill="none" stroke="#b45309" strokeWidth={2} />
          <line x1={21} y1={35} x2={21} y2={50} stroke="#94a3b8" strokeWidth={2} />
          <line x1={35} y1={35} x2={35} y2={50} stroke="#94a3b8" strokeWidth={2} />
        </g>
      ) : kind === 'pir' ? (
        <g transform="translate(27, 6)">
          <rect x={6} y={6} width={44} height={40} rx={5} fill="#0f766e" />
          <circle cx={28} cy={26} r={15} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5} />
        </g>
      ) : kind === 'web-browser' ? (
        <g transform="translate(14, 7)">
          <rect x={2} y={4} width={78} height={48} rx={5} fill="#0f172a" stroke="#38bdf8" strokeWidth={1.5} />
          <rect x={2} y={4} width={78} height={12} rx={4} fill="#1e293b" />
          <circle cx={9} cy={10} r={2} fill="#ef4444" />
          <circle cx={15} cy={10} r={2} fill="#f59e0b" />
          <circle cx={21} cy={10} r={2} fill="#22c55e" />
          <rect x={27} y={7} width={48} height={6} rx={2} fill="#334155" />
          <rect x={8} y={21} width={30} height={11} rx={2} fill="#0284c7" opacity={0.85} />
          <rect x={42} y={21} width={32} height={11} rx={2} fill="#16a34a" opacity={0.85} />
          <text x={23} y={29} textAnchor="middle" fontSize="6" fill="#f8fafc" fontWeight={700}>27.5C</text>
          <text x={58} y={29} textAnchor="middle" fontSize="6" fill="#f8fafc" fontWeight={700}>HTTP</text>
          <rect x={8} y={36} width={66} height={10} rx={2} fill="#1e293b" />
          <text x={41} y={43.5} textAnchor="middle" fontSize="6" fill="#38bdf8" fontWeight={700}>WEB BROWSER</text>
        </g>
      ) : (
        <g transform="translate(22, 8)">
          <rect x={6} y={6} width={54} height={38} rx={4} fill="#0284c7" stroke="#38bdf8" strokeWidth={1.4} />
          <circle cx={18} cy={18} r={3.5} fill="#22c55e" />
          <text x={36} y={32} textAnchor="middle" fontSize="8.5" fill="#fff" fontWeight={700}>RELAY</text>
        </g>
      )}
    </svg>
  )
}

export function BoardHardwareView({
  nodeId,
  board,
  boardX,
  boardY,
  label,
  isPrimary,
  selectedBoard,
  sim,
  selectedPin,
  showLabels,
  onStartDrag,
  onPinPointerDown,
  onPinPointerUp,
}: {
  nodeId: string
  board: BoardSpec
  boardX: number
  boardY: number
  label: string
  isPrimary: boolean
  selectedBoard: boolean
  sim: SimulationState
  selectedPin: WireEndpoint | null
  showLabels: boolean
  onStartDrag: (nodeId: string, clientX: number, clientY: number) => void
  onPinPointerDown: (ep: WireEndpoint, clientX: number, clientY: number) => void
  onPinPointerUp: (ep: WireEndpoint) => void
}) {
  const w = board.width
  const h = board.height

  return (
    <g
      transform={`translate(${boardX}, ${boardY})`}
      style={{ cursor: 'grab' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onStartDrag(nodeId, e.clientX, e.clientY)
      }}
    >
      {selectedBoard ? (
        <rect
          x={-6}
          y={-6}
          width={w + 12}
          height={h + 12}
          rx={13}
          fill="none"
          stroke="#16a34a"
          strokeWidth={2}
          strokeDasharray="5 3"
        />
      ) : null}

      <RealBoardBodySvg board={board} sim={sim} isPrimary={isPrimary} />

      {!isPrimary ? (
        <text x={w / 2} y={-10} textAnchor="middle" fontSize="9.5" fontWeight={700} fill="#38bdf8">
          {label}
        </text>
      ) : null}

      {board.pins.map((p) => {
        const isSel = selectedPin?.nodeId === nodeId && selectedPin?.pinId === p.id
        const activeGpio = isPrimary && p.gpio !== undefined ? sim.gpioStates[p.gpio] : undefined
        const isHigh = Boolean(activeGpio && activeGpio.digital === 1)
        const fill =
          isSel
            ? '#f59e0b'
            : p.kind === 'power'
              ? '#ef4444'
              : p.kind === 'gnd'
                ? '#475569'
                : isHigh
                  ? '#22c55e'
                  : '#eab308'

        const labelX = p.side === 'left' ? p.x + 10 : p.side === 'right' ? p.x - 10 : p.x
        const labelY = p.side === 'top' ? p.y + 15 : p.side === 'bottom' ? p.y - 11 : p.y + 3
        const anchor = p.side === 'left' ? 'start' : p.side === 'right' ? 'end' : 'middle'

        return (
          <g
            key={p.id}
            className="iot-pin"
            data-node-id={nodeId}
            data-pin-id={p.id}
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onPinPointerDown({ nodeId, pinId: p.id }, e.clientX, e.clientY)
            }}
            onPointerUp={(e) => {
              e.stopPropagation()
              onPinPointerUp({ nodeId, pinId: p.id })
            }}
          >
            <circle className="iot-pin-hit" cx={p.x} cy={p.y} r={10} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={isSel ? 7 : 5.2} fill="#0f172a" stroke={fill} strokeWidth={2.2} />
            <circle cx={p.x} cy={p.y} r={2} fill={fill} />
            {showLabels ? (
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                fontSize={p.side === 'top' || p.side === 'bottom' ? '7.2' : '8.2'}
                fontFamily="monospace"
                fontWeight={700}
                fill={isHigh ? '#86efac' : '#f8fafc'}
                style={{ pointerEvents: 'none' }}
              >
                {p.label}
              </text>
            ) : null}
            <title>{p.label}</title>
          </g>
        )
      })}
    </g>
  )
}

export function ComponentHardwareView({
  comp,
  sim,
  selectedPin,
  selectedComp,
  showLabels,
  isDark,
  onStartDrag,
  onStartRotate,
  onPinPointerDown,
  onPinPointerUp,
  onUpdateProps,
}: {
  comp: PlacedComponent
  sim: SimulationState
  selectedPin: WireEndpoint | null
  selectedComp: boolean
  showLabels: boolean
  isDark: boolean
  onStartDrag: (compId: string, clientX: number, clientY: number) => void
  onStartRotate?: (compId: string, clientX: number, clientY: number) => void
  onPinPointerDown: (ep: WireEndpoint, clientX: number, clientY: number) => void
  onPinPointerUp: (ep: WireEndpoint) => void
  onUpdateProps: (compId: string, patch: Partial<PlacedComponent['props']>) => void
}) {
  const spec = getComponentSpec(comp.kind)
  const led = sim.ledBrightness[comp.id]
  const servoAngle = sim.servoAngles[comp.id] ?? 0
  const buzzer = sim.buzzerActive[comp.id]
  const relayOn = Boolean(sim.relayClosed[comp.id])
  const oledText = sim.oledLines[comp.id] ?? ['SSD1306 128x64', 'Menunggu data...']
  const lcdText = sim.lcdRows[comp.id] ?? ['LCD 16x2 I2C    ', 'Siap...         ']

  const LED_PALETTE: Record<string, { dim: string; off: string; on: string; core: string }> = {
    red: { dim: '#881313', off: '#5c1414', on: '#ff3b3b', core: '#fecaca' },
    green: { dim: '#14532d', off: '#0f3d21', on: '#22ff66', core: '#dcfce7' },
    blue: { dim: '#1e3a8a', off: '#172554', on: '#38bdf8', core: '#e0f2fe' },
    yellow: { dim: '#713f12', off: '#4d2e0b', on: '#fde047', core: '#fefce8' },
    orange: { dim: '#7c2d12', off: '#521e0c', on: '#fb923c', core: '#ffedd5' },
    purple: { dim: '#581c87', off: '#3b0764', on: '#c084fc', core: '#f3e8ff' },
    cyan: { dim: '#155e75', off: '#0e3f4f', on: '#22d3ee', core: '#ecfeff' },
    white: { dim: '#64748b', off: '#475569', on: '#ffffff', core: '#ffffff' },
  }

  const mixHex = (hexA: string, hexB: string, t: number): string => {
    const clamped = Math.max(0, Math.min(1, t))
    const a = parseInt(hexA.slice(1), 16)
    const b = parseInt(hexB.slice(1), 16)
    const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * clamped)
    const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * clamped)
    const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * clamped)
    return `rgb(${r}, ${g}, ${bl})`
  }

  const ledLevel = led ? Math.max(0, Math.min(1, Math.max(led.r, led.g, led.b))) : 0
  const ledPal = LED_PALETTE[comp.color ?? 'red'] ?? LED_PALETTE.red
  const ledFill = (() => {
    if (!led) return ledPal.dim
    if (ledLevel <= 0.005) return ledPal.off
    if (comp.kind === 'rgb-led') {
      const r = Math.round(40 + led.r * 215)
      const g = Math.round(40 + led.g * 215)
      const b = Math.round(40 + led.b * 215)
      return `rgb(${r}, ${g}, ${b})`
    }
    return mixHex(ledPal.off, ledPal.on, ledLevel)
  })()

  const isGlowing = ledLevel > 0.015
  const glowRadius = Math.round(2 + ledLevel * 18)
  const haloOpacity = Math.max(0, Math.min(0.85, ledLevel * ledLevel * 0.85))
  const coreOpacity = Math.max(0, Math.min(0.92, (ledLevel - 0.15) * 1.1))
  const labelColor = isDark ? '#e2e8f0' : '#1e293b'

  return (
    <g
      transform={`translate(${comp.x}, ${comp.y})`}
      style={{ cursor: 'grab' }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.iot-interactive-control')) return
        e.stopPropagation()
        onStartDrag(comp.id, e.clientX, e.clientY)
      }}
    >
      <g transform={comp.rotate ? `rotate(${comp.rotate}, ${spec.width / 2}, ${spec.height / 2})` : undefined}>
        <rect
          x={-4}
          y={-4}
          width={spec.width + 8}
          height={spec.height + 8}
          rx={10}
          fill="transparent"
          stroke={selectedComp ? '#16a34a' : 'transparent'}
          strokeWidth={1.8}
          strokeDasharray="4 2"
        />

        {comp.kind === 'led' || comp.kind === 'rgb-led' ? (
        <g transform={comp.kind === 'led' && comp.props.flip ? `translate(${spec.width}, 0) scale(-1, 1)` : undefined}>
          {/* Soft outer optical glow halo scaled smoothly by Ohm's law current */}
          {isGlowing ? (
            <circle
              cx={spec.width / 2}
              cy={28}
              r={12 + ledLevel * 18}
              fill={ledFill}
              opacity={haloOpacity * 0.45}
              style={{ pointerEvents: 'none' }}
            />
          ) : null}
          {/* Metallic bent LED wire legs */}
          <path d={`M ${spec.width / 2 - 8} 48 V 72`} stroke="#94a3b8" strokeWidth={2.5} />
          <path d={`M ${spec.width / 2 + 8} 48 V 72`} stroke="#94a3b8" strokeWidth={2.5} />
          {/* Realistic 3D Glossy LED Dome with continuous brightness */}
          <path
            d={`M ${spec.width / 2 - 14} 44 V 24 A 14 14 0 0 1 ${spec.width / 2 + 14} 24 V 44 Z`}
            fill={ledFill}
            stroke={isGlowing ? mixHex('#475569', '#fef08a', ledLevel) : '#475569'}
            strokeWidth={1.5}
            style={
              isGlowing
                ? { filter: `drop-shadow(0 0 ${glowRadius}px ${ledFill})` }
                : undefined
            }
          />
          {/* Inner semiconductor die core glow (brightens intensely at high current, vanishes when dim) */}
          {coreOpacity > 0.02 ? (
            <ellipse
              cx={spec.width / 2}
              cy={29}
              rx={4 + ledLevel * 4.5}
              ry={5 + ledLevel * 5.5}
              fill={comp.kind === 'rgb-led' ? '#ffffff' : ledPal.core}
              opacity={coreOpacity * 0.72}
              style={{ pointerEvents: 'none' }}
            />
          ) : null}
          <rect x={spec.width / 2 - 17} y={42} width={34} height={6} rx={2} fill={ledFill} stroke="#475569" strokeWidth={0.8} />
          <ellipse cx={spec.width / 2 - 5} cy={22} rx={3.5} ry={7} fill="rgba(255,255,255,0.42)" />
          {led?.burned ? (
            <text x={spec.width / 2} y={8} textAnchor="middle" fontSize="8" fill="#ef4444" fontWeight={700}>
              ! OVERCURRENT
            </text>
          ) : sim.running && led && (led.currentMa ?? 0) > 0 ? (
            <text
              x={spec.width / 2}
              y={8}
              textAnchor="middle"
              fontSize="7"
              fontFamily="monospace"
              fill={isDark ? '#cbd5e1' : '#334155'}
              fontWeight={700}
            >
              {led.currentMa! >= 1 ? `${led.currentMa!.toFixed(1)}mA` : `${Math.round(led.currentMa! * 1000)}µA`} · {Math.round(ledLevel * 100)}%
            </text>
          ) : null}
        </g>
      ) : comp.kind === 'resistor' ? (
        (() => {
          const decoded = decodeResistorBands(comp.ohms ?? 220)
          return (
            <g className="iot-resistor-body">
              <line x1={6} y1={22} x2={84} y2={22} stroke="#94a3b8" strokeWidth={3} />
              <path
                d="M20 12 Q26 12 31 14 H59 Q64 12 70 12 Q74 22 70 32 Q64 32 59 30 H31 Q26 32 20 32 Q16 22 20 12 Z"
                fill="#e6cfa3"
                stroke={selectedComp ? '#f59e0b' : '#a16207'}
                strokeWidth={selectedComp ? 1.8 : 1.3}
              />
              <rect x={26} y={13} width={5} height={18} fill={decoded.bands[0]} />
              <rect x={37} y={14} width={5} height={16} fill={decoded.bands[1]} />
              <rect x={48} y={14} width={5} height={16} fill={decoded.bands[2]} />
              <rect x={60} y={13} width={4.5} height={18} fill={decoded.bands[3]} />
            </g>
          )
        })()
      ) : comp.kind === 'breadboard-mini' ? (
        <g>
          <rect x={44} y={-2.5} width={16} height={3.5} rx={0.8} fill="#e7e4da" stroke="#cbd5e1" strokeWidth={0.7} />
          <rect x={124} y={-2.5} width={16} height={3.5} rx={0.8} fill="#e7e4da" stroke="#cbd5e1" strokeWidth={0.7} />
          <rect x={-2.5} y={24} width={3.5} height={14} rx={0.8} fill="#e7e4da" stroke="#cbd5e1" strokeWidth={0.7} />
          <rect x={-2.5} y={66} width={3.5} height={14} rx={0.8} fill="#e7e4da" stroke="#cbd5e1" strokeWidth={0.7} />
          <rect x={1} y={2} width={184} height={106} rx={5} fill="#d6d2c4" />
          <rect x={0} y={0} width={184} height={104} rx={5} fill="#f7f6f1" stroke="#c8c4b6" strokeWidth={1.3} />
          <rect x={8} y={52.5} width={168} height={8} rx={2} fill="#e7e4da" stroke="#d5d1c3" strokeWidth={0.7} />
          {(['a', 'b', 'c', 'd', 'e'] as const).map((ltr, r) => (
            <text key={`mb-t-${ltr}`} x={9} y={18 + r * 7.5 + 2} textAnchor="middle" fontSize="5.4" fontWeight={700} fontFamily="monospace" fill="#64748b">{ltr}</text>
          ))}
          {(['f', 'g', 'h', 'i', 'j'] as const).map((ltr, r) => (
            <text key={`mb-b-${ltr}`} x={9} y={65 + r * 7.5 + 2} textAnchor="middle" fontSize="5.4" fontWeight={700} fontFamily="monospace" fill="#64748b">{ltr}</text>
          ))}
          {[1, 5, 10, 15].map((n) => (
            <text key={`mb-c-${n}`} x={20 + (n - 1) * 9} y={12} textAnchor="middle" fontSize="5.2" fontWeight={700} fontFamily="monospace" fill="#64748b">{n}</text>
          ))}
          {Array.from({ length: 17 }, (_, col) => {
            const hx = 20 + col * 9
            return (
              <g key={`mb-col-${col}`}>
                {[0, 1, 2, 3, 4].map((r) => (
                  <g key={`mb-r-${r}`}>
                    <rect x={hx - 2.2} y={18 + r * 7.5 - 2.2} width={4.4} height={4.4} rx={0.8} fill="#cbc7b9" />
                    <rect x={hx - 1.75} y={18 + r * 7.5 - 1.75} width={3.5} height={3.5} rx={0.5} fill="#18181b" />
                    <rect x={hx - 2.2} y={65 + r * 7.5 - 2.2} width={4.4} height={4.4} rx={0.8} fill="#cbc7b9" />
                    <rect x={hx - 1.75} y={65 + r * 7.5 - 1.75} width={3.5} height={3.5} rx={0.5} fill="#18181b" />
                  </g>
                ))}
              </g>
            )
          })}
        </g>
      ) : comp.kind === 'breadboard' ? (
        <g>
          {/* Side interlocking ABS dovetail tabs */}
          <rect x={72} y={-2.5} width={18} height={3.5} rx={0.8} fill="#e7e4da" stroke="#cbd5e1" strokeWidth={0.7} />
          <rect x={228} y={-2.5} width={18} height={3.5} rx={0.8} fill="#e7e4da" stroke="#cbd5e1" strokeWidth={0.7} />
          <rect x={-2.5} y={40} width={3.5} height={16} rx={0.8} fill="#e7e4da" stroke="#cbd5e1" strokeWidth={0.7} />
          <rect x={-2.5} y={100} width={3.5} height={16} rx={0.8} fill="#e7e4da" stroke="#cbd5e1" strokeWidth={0.7} />
          {/* 3D bottom lip & molded ABS cream/white housing */}
          <rect x={1} y={2} width={318} height={156} rx={5} fill="#d6d2c4" />
          <rect x={0} y={0} width={318} height={154} rx={5} fill="#f7f6f1" stroke="#c8c4b6" strokeWidth={1.3} />
          <rect x={2.5} y={2.5} width={313} height={149} rx={3.5} fill="none" stroke="#ffffff" strokeWidth={0.8} opacity={0.8} />

          {/* Top Power Rail Stripes & Polarity Marks */}
          <line x1={26} y1={7} x2={294} y2={7} stroke="#2563eb" strokeWidth={1.35} strokeLinecap="round" />
          <line x1={26} y1={28} x2={294} y2={28} stroke="#dc2626" strokeWidth={1.35} strokeLinecap="round" />
          <text x={15} y={15.5} textAnchor="middle" fontSize="9.5" fontWeight={800} fill="#2563eb" fontFamily="monospace">-</text>
          <text x={303} y={15.5} textAnchor="middle" fontSize="9.5" fontWeight={800} fill="#2563eb" fontFamily="monospace">-</text>
          <text x={15} y={24.5} textAnchor="middle" fontSize="9" fontWeight={800} fill="#dc2626" fontFamily="monospace">+</text>
          <text x={303} y={24.5} textAnchor="middle" fontSize="9" fontWeight={800} fill="#dc2626" fontFamily="monospace">+</text>

          {/* Bottom Power Rail Stripes & Polarity Marks */}
          <line x1={26} y1={131} x2={294} y2={131} stroke="#2563eb" strokeWidth={1.35} strokeLinecap="round" />
          <line x1={26} y1={151} x2={294} y2={151} stroke="#dc2626" strokeWidth={1.35} strokeLinecap="round" />
          <text x={15} y={139.5} textAnchor="middle" fontSize="9.5" fontWeight={800} fill="#2563eb" fontFamily="monospace">-</text>
          <text x={303} y={139.5} textAnchor="middle" fontSize="9.5" fontWeight={800} fill="#2563eb" fontFamily="monospace">-</text>
          <text x={15} y={148.5} textAnchor="middle" fontSize="9" fontWeight={800} fill="#dc2626" fontFamily="monospace">+</text>
          <text x={303} y={148.5} textAnchor="middle" fontSize="9" fontWeight={800} fill="#dc2626" fontFamily="monospace">+</text>

          {/* Power Rail Hairline Divider & Central DIP IC Trench */}
          <line x1={8} y1={31.5} x2={310} y2={31.5} stroke="#e2dfd3" strokeWidth={0.8} />
          <line x1={8} y1={128} x2={310} y2={128} stroke="#e2dfd3" strokeWidth={0.8} />
          <rect x={10} y={76.5} width={298} height={9} rx={2} fill="#e7e4da" stroke="#d5d1c3" strokeWidth={0.7} />
          <line x1={12} y1={78} x2={306} y2={78} stroke="#cac5b6" strokeWidth={0.7} />

          {/* Printed Row Letters (a-e & f-j on Left & Right) */}
          {(['a', 'b', 'c', 'd', 'e'] as const).map((ltr, r) => {
            const ry = 42 + r * 7.5
            return (
              <g key={`row-top-${ltr}`}>
                <text x={15} y={ry + 2} textAnchor="middle" fontSize="5.8" fontWeight={700} fontFamily="monospace" fill="#64748b">{ltr}</text>
                <text x={303} y={ry + 2} textAnchor="middle" fontSize="5.8" fontWeight={700} fontFamily="monospace" fill="#64748b">{ltr}</text>
              </g>
            )
          })}
          {(['f', 'g', 'h', 'i', 'j'] as const).map((ltr, r) => {
            const ry = 90 + r * 7.5
            return (
              <g key={`row-bot-${ltr}`}>
                <text x={15} y={ry + 2} textAnchor="middle" fontSize="5.8" fontWeight={700} fontFamily="monospace" fill="#64748b">{ltr}</text>
                <text x={303} y={ry + 2} textAnchor="middle" fontSize="5.8" fontWeight={700} fontFamily="monospace" fill="#64748b">{ltr}</text>
              </g>
            )
          })}

          {/* Printed Column Numbers (1, 5, 10, 15, 20, 25, 30) */}
          {[1, 5, 10, 15, 20, 25, 30].map((colNum) => {
            const cx = 28 + (colNum - 1) * 9
            return (
              <g key={`col-num-${colNum}`}>
                <text x={cx} y={37.5} textAnchor="middle" fontSize="5.4" fontWeight={700} fontFamily="monospace" fill="#64748b">{colNum}</text>
                <text x={cx} y={126.8} textAnchor="middle" fontSize="5.4" fontWeight={700} fontFamily="monospace" fill="#64748b">{colNum}</text>
              </g>
            )
          })}

          {/* Power Rail 25-hole Split Clusters (5 groups x 5 holes on Top & Bottom) */}
          {[0, 1, 2, 3, 4].map((grp) =>
            [0, 1, 2, 3, 4].map((idx) => {
              const hx = 34 + grp * 54 + idx * 9
              return (
                <g key={`rail-${grp}-${idx}`}>
                  {[13, 22, 137, 146].map((hy) => (
                    <g key={`rh-${hy}`}>
                      <rect x={hx - 2.3} y={hy - 2.3} width={4.6} height={4.6} rx={0.9} fill="#bdb9aa" />
                      <rect x={hx - 1.8} y={hy - 1.8} width={3.6} height={3.6} rx={0.6} fill="#18181b" />
                      <rect x={hx - 0.7} y={hy - 0.7} width={1.4} height={1.4} rx={0.3} fill="#64748b" />
                    </g>
                  ))}
                </g>
              )
            }),
          )}

          {/* 30 Columns x 10 Terminal Strip Square Sockets (300 Main Holes) */}
          {Array.from({ length: 30 }, (_, col) => {
            const hx = 28 + col * 9
            return (
              <g key={`col-${col}`}>
                {[0, 1, 2, 3, 4].map((r) => {
                  const hyTop = 42 + r * 7.5
                  const hyBot = 90 + r * 7.5
                  return (
                    <g key={`r-${r}`}>
                      <rect x={hx - 2.2} y={hyTop - 2.2} width={4.4} height={4.4} rx={0.8} fill="#cbc7b9" />
                      <rect x={hx - 1.75} y={hyTop - 1.75} width={3.5} height={3.5} rx={0.5} fill="#18181b" />
                      <rect x={hx - 0.6} y={hyTop - 0.6} width={1.2} height={1.2} rx={0.2} fill="#64748b" />
                      <rect x={hx - 2.2} y={hyBot - 2.2} width={4.4} height={4.4} rx={0.8} fill="#cbc7b9" />
                      <rect x={hx - 1.75} y={hyBot - 1.75} width={3.5} height={3.5} rx={0.5} fill="#18181b" />
                      <rect x={hx - 0.6} y={hyBot - 0.6} width={1.2} height={1.2} rx={0.2} fill="#64748b" />
                    </g>
                  )
                })}
              </g>
            )
          })}
        </g>
      ) : comp.kind === 'breadboard-large' ? (
        <g>
          {/* Large 830-Point Full Breadboard Housing */}
          <rect x={1} y={2} width={472} height={148} rx={5} fill="#d6d2c4" />
          <rect x={0} y={0} width={472} height={146} rx={5} fill="#f7f6f1" stroke="#c8c4b6" strokeWidth={1.3} />
          <line x1={24} y1={6.5} x2={448} y2={6.5} stroke="#2563eb" strokeWidth={1.2} />
          <line x1={24} y1={25.5} x2={448} y2={25.5} stroke="#dc2626" strokeWidth={1.2} />
          <line x1={24} y1={122.5} x2={448} y2={122.5} stroke="#2563eb" strokeWidth={1.2} />
          <line x1={24} y1={141.5} x2={448} y2={141.5} stroke="#dc2626" strokeWidth={1.2} />
          <text x={13} y={14.5} textAnchor="middle" fontSize="8.5" fontWeight={800} fill="#2563eb" fontFamily="monospace">-</text>
          <text x={459} y={14.5} textAnchor="middle" fontSize="8.5" fontWeight={800} fill="#2563eb" fontFamily="monospace">-</text>
          <text x={13} y={22.5} textAnchor="middle" fontSize="8.5" fontWeight={800} fill="#dc2626" fontFamily="monospace">+</text>
          <text x={459} y={22.5} textAnchor="middle" fontSize="8.5" fontWeight={800} fill="#dc2626" fontFamily="monospace">+</text>
          <text x={13} y={130.5} textAnchor="middle" fontSize="8.5" fontWeight={800} fill="#2563eb" fontFamily="monospace">-</text>
          <text x={459} y={130.5} textAnchor="middle" fontSize="8.5" fontWeight={800} fill="#2563eb" fontFamily="monospace">-</text>
          <text x={13} y={138.5} textAnchor="middle" fontSize="8.5" fontWeight={800} fill="#dc2626" fontFamily="monospace">+</text>
          <text x={459} y={138.5} textAnchor="middle" fontSize="8.5" fontWeight={800} fill="#dc2626" fontFamily="monospace">+</text>
          <rect x={10} y={71} width={452} height={7} rx={1.8} fill="#e7e4da" stroke="#d5d1c3" strokeWidth={0.7} />
          {[1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((colNum) => (
            <text key={`lc-${colNum}`} x={26 + (colNum - 1) * 6.8} y={33.8} textAnchor="middle" fontSize="5" fontWeight={700} fontFamily="monospace" fill="#64748b">{colNum}</text>
          ))}
          {(['a', 'b', 'c', 'd', 'e'] as const).map((ltr, r) => (
            <text key={`lt-${ltr}`} x={13} y={38 + r * 7 + 2} textAnchor="middle" fontSize="5.2" fontWeight={700} fontFamily="monospace" fill="#64748b">{ltr}</text>
          ))}
          {(['f', 'g', 'h', 'i', 'j'] as const).map((ltr, r) => (
            <text key={`lb-${ltr}`} x={13} y={83 + r * 7 + 2} textAnchor="middle" fontSize="5.2" fontWeight={700} fontFamily="monospace" fill="#64748b">{ltr}</text>
          ))}
          {Array.from({ length: 10 }, (_, grp) =>
            [0, 1, 2, 3, 4].map((h) => {
              const hx = (grp < 5 ? 32 + grp * 41 : 246 + (grp - 5) * 41) + h * 6.8
              return (
                <g key={`lr-${grp}-${h}`}>
                  <rect x={hx - 1.5} y={10.5} width={3} height={3} rx={0.5} fill="#18181b" />
                  <rect x={hx - 1.5} y={18.5} width={3} height={3} rx={0.5} fill="#18181b" />
                  <rect x={hx - 1.5} y={126.5} width={3} height={3} rx={0.5} fill="#18181b" />
                  <rect x={hx - 1.5} y={134.5} width={3} height={3} rx={0.5} fill="#18181b" />
                </g>
              )
            }),
          )}
          {Array.from({ length: 63 }, (_, col) => {
            const hx = 26 + col * 6.8
            return (
              <g key={`lcol-${col}`}>
                {[0, 1, 2, 3, 4].map((r) => (
                  <g key={`lr-${r}`}>
                    <rect x={hx - 1.5} y={38 + r * 7 - 1.5} width={3} height={3} rx={0.5} fill="#18181b" />
                    <rect x={hx - 1.5} y={83 + r * 7 - 1.5} width={3} height={3} rx={0.5} fill="#18181b" />
                  </g>
                ))}
              </g>
            )
          })}
        </g>
      ) : comp.kind === 'pushbutton' ? (
        (() => {
          const isDown = Boolean(comp.props.pressed || comp.props.latched)
          const capMap: Record<string, string> = {
            red: '#dc2626',
            green: '#16a34a',
            blue: '#2563eb',
            yellow: '#eab308',
            white: '#f8fafc',
            black: '#18181b',
            grey: '#64748b',
          }
          const baseCap = capMap[comp.color ?? 'red'] ?? '#dc2626'
          const capTextColor = comp.color === 'white' || comp.color === 'yellow' ? '#0f172a' : '#ffffff'
          return (
            <g>
              <line x1={10} y1={22} x2={22} y2={22} stroke="#94a3b8" strokeWidth={3} />
              <line x1={10} y1={48} x2={22} y2={48} stroke={isDown ? '#22c55e' : '#94a3b8'} strokeWidth={3} />
              <line x1={56} y1={22} x2={68} y2={22} stroke="#94a3b8" strokeWidth={3} />
              <line x1={56} y1={48} x2={68} y2={48} stroke={isDown ? '#22c55e' : '#94a3b8'} strokeWidth={3} />
              <rect x={18} y={12} width={42} height={44} rx={5} fill="#e2e8f0" stroke="#334155" strokeWidth={2} />
              <circle cx={23} cy={17} r={2} fill="#475569" />
              <circle cx={55} cy={17} r={2} fill="#475569" />
              <circle cx={23} cy={51} r={2} fill="#475569" />
              <circle cx={55} cy={51} r={2} fill="#475569" />
              <circle
                className="iot-interactive-control"
                cx={39}
                cy={isDown ? 35.5 : 34}
                r={13}
                fill={isDown ? '#16a34a' : baseCap}
                stroke={isDown ? '#14532d' : '#334155'}
                strokeWidth={isDown ? 2.2 : 1.5}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  const downAt = Date.now()
                  onUpdateProps(comp.id, { pressed: true })
                  const release = () => {
                    window.removeEventListener('pointerup', release)
                    const elapsed = Date.now() - downAt
                    if (elapsed >= 220) {
                      onUpdateProps(comp.id, { pressed: false })
                    } else {
                      window.setTimeout(() => {
                        onUpdateProps(comp.id, { pressed: false })
                      }, 240 - elapsed)
                    }
                  }
                  window.addEventListener('pointerup', release)
                }}
              />
              <text x={39} y={isDown ? 38.5 : 37} textAnchor="middle" fontSize="6.8" fill={isDown ? '#fff' : capTextColor} fontWeight={700} style={{ pointerEvents: 'none' }}>
                {comp.props.latched ? 'LOCK' : isDown ? 'ON' : comp.props.shortcutKey ? `[${comp.props.shortcutKey.toUpperCase()}]` : 'HOLD'}
              </text>
              {/* Small latch toggle corner button for hands-free hold */}
              <g
                className="iot-interactive-control"
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onUpdateProps(comp.id, { latched: !comp.props.latched })
                }}
              >
                <rect x={49} y={13} width={10} height={8} rx={2} fill={comp.props.latched ? '#16a34a' : '#94a3b8'} />
                <title>Toggle latch lock ON/OFF</title>
              </g>
            </g>
          )
        })()
      ) : comp.kind === 'hc-sr04' ? (
        <g>
          <rect x={4} y={6} width={108} height={68} rx={7} fill="#1d4ed8" stroke="#93c5fd" strokeWidth={1.4} />
          <circle cx={32} cy={30} r={16} fill="#cbd5e1" stroke="#475569" strokeWidth={2} />
          <circle cx={32} cy={30} r={9} fill="#0f172a" />
          <circle cx={84} cy={30} r={16} fill="#cbd5e1" stroke="#475569" strokeWidth={2} />
          <circle cx={84} cy={30} r={9} fill="#0f172a" />
          <foreignObject className="iot-interactive-control" x={10} y={50} width={96} height={24}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#fff', fontWeight: 600 }}>
              <input
                type="range"
                min={2}
                max={200}
                value={comp.props.distanceCm ?? 40}
                onChange={(e) => onUpdateProps(comp.id, { distanceCm: Number(e.target.value) })}
                style={{ width: 62 }}
              />
              <span>{comp.props.distanceCm ?? 40}cm</span>
            </div>
          </foreignObject>
        </g>
      ) : comp.kind === 'dht22' ? (
        <g>
          <rect x={6} y={4} width={86} height={70} rx={6} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1.5} />
          <rect x={14} y={10} width={70} height={24} rx={3} fill="#e2e8f0" stroke="#cbd5e1" />
          <text x={49} y={25} textAnchor="middle" fontSize="9" fontWeight={700} fill="#0f172a">
            {comp.props.tempC ?? 28}°C · {comp.props.humidity ?? 60}%
          </text>
          <foreignObject className="iot-interactive-control" x={10} y={36} width={78} height={36}>
            <div style={{ display: 'grid', gap: 2 }}>
              <input
                type="range"
                min={0}
                max={55}
                value={comp.props.tempC ?? 28}
                onChange={(e) => onUpdateProps(comp.id, { tempC: Number(e.target.value) })}
                title="Suhu °C"
              />
              <input
                type="range"
                min={10}
                max={95}
                value={comp.props.humidity ?? 60}
                onChange={(e) => onUpdateProps(comp.id, { humidity: Number(e.target.value) })}
                title="Kelembapan %"
              />
            </div>
          </foreignObject>
        </g>
      ) : comp.kind === 'potentiometer' ? (
        (() => {
          const pct = comp.props.potPct ?? 50
          const deg = (pct / 100) * 260 - 220
          return (
            <g>
              <rect x={10} y={6} width={64} height={70} rx={8} fill="#0369a1" stroke="#38bdf8" strokeWidth={1.4} />
              <g
                className="iot-interactive-control"
                style={{ cursor: 'ew-resize' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  const startX = e.clientX
                  const startY = e.clientY
                  const startVal = comp.props.potPct ?? 50
                  const onMove = (ev: PointerEvent) => {
                    const delta = ev.clientX - startX - (ev.clientY - startY) * 0.6
                    const nextVal = Math.max(0, Math.min(100, Math.round(startVal + delta)))
                    onUpdateProps(comp.id, { potPct: nextVal })
                  }
                  const onUp = () => {
                    window.removeEventListener('pointermove', onMove)
                    window.removeEventListener('pointerup', onUp)
                  }
                  window.addEventListener('pointermove', onMove)
                  window.addEventListener('pointerup', onUp)
                }}
              >
                <circle cx={42} cy={32} r={19} fill="#e2e8f0" stroke="#475569" strokeWidth={2} />
                <line
                  x1={42}
                  y1={32}
                  x2={42 + 14 * Math.cos(deg * (Math.PI / 180))}
                  y2={32 + 14 * Math.sin(deg * (Math.PI / 180))}
                  stroke="#0f172a"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                <circle cx={42} cy={32} r={4} fill="#0f172a" />
                <title>Putar / geser kenop potensiometer ({pct}%)</title>
              </g>
              <text x={42} y={58} textAnchor="middle" fontSize="8" fontWeight={700} fill="#e0f2fe" style={{ pointerEvents: 'none' }}>
                {pct}%
              </text>
              <foreignObject className="iot-interactive-control" x={12} y={59} width={60} height={16}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pct}
                  onChange={(e) => onUpdateProps(comp.id, { potPct: Number(e.target.value) })}
                  title={`${comp.label}: ${pct}%`}
                  aria-label={comp.label}
                  style={{ width: 58, height: 14 }}
                />
              </foreignObject>
            </g>
          )
        })()
      ) : comp.kind === 'ldr' ? (
        <g>
          <rect x={9} y={6} width={70} height={62} rx={8} fill="#78350f" stroke="#f59e0b" strokeWidth={1.4} />
          <circle cx={44} cy={28} r={14} fill="#fde68a" stroke="#b45309" strokeWidth={1.5} />
          <path d="M36 28 Q40 21 44 28 T52 28" fill="none" stroke="#b45309" strokeWidth={2} />
          <foreignObject className="iot-interactive-control" x={12} y={46} width={64} height={20}>
            <input
              type="range"
              min={50}
              max={1000}
              value={comp.props.lux ?? 420}
              onChange={(e) => onUpdateProps(comp.id, { lux: Number(e.target.value) })}
              style={{ width: 62 }}
              title="Cahaya Lux"
            />
          </foreignObject>
        </g>
      ) : comp.kind === 'pir' ? (
        <g>
          <rect x={10} y={6} width={70} height={66} rx={8} fill="#0f766e" stroke="#5eead4" strokeWidth={1.4} />
          <circle cx={45} cy={30} r={18} fill={comp.props.motion ? '#f8fafc' : '#cbd5e1'} stroke="#64748b" />
          <foreignObject className="iot-interactive-control" x={14} y={51} width={62} height={18}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onUpdateProps(comp.id, { motion: !comp.props.motion })
              }}
              style={{
                width: '100%',
                fontSize: 8.5,
                fontWeight: 700,
                background: comp.props.motion ? '#ef4444' : '#1e293b',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {comp.props.motion ? 'GERAK ON' : 'PICU PIR'}
            </button>
          </foreignObject>
        </g>
      ) : comp.kind === 'oled-ssd1306' ? (
        <g>
          <rect x={4} y={4} width={118} height={78} rx={6} fill="#1e3a8a" stroke="#60a5fa" strokeWidth={1.5} />
          <rect x={10} y={14} width={106} height={56} rx={3} fill="#020617" stroke="#334155" />
          {oledText.slice(0, 4).map((line, i) => (
            <text key={i} x={14} y={27 + i * 11} fontSize="8" fontFamily="monospace" fill="#38bdf8">
              {line}
            </text>
          ))}
        </g>
      ) : comp.kind === 'lcd-1602' ? (
        (() => {
          const isBlue = comp.props.lcdBackground === 'blue'
          const bgFill = isBlue ? '#1d4ed8' : '#84cc16'
          const fgFill = comp.props.lcdTextColor === 'white' || isBlue ? '#f8fafc' : '#1a2e05'
          return (
            <g>
              <rect x={4} y={4} width={128} height={66} rx={5} fill="#0f766e" stroke="#115e59" strokeWidth={1.5} />
              <rect x={10} y={12} width={116} height={46} rx={3} fill={bgFill} stroke="#1e293b" strokeWidth={2} />
              <text x={15} y={30} fontSize="8.5" fontFamily="monospace" fontWeight={700} fill={fgFill}>
                {lcdText[0]}
              </text>
              <text x={15} y={46} fontSize="8.5" fontFamily="monospace" fontWeight={700} fill={fgFill}>
                {lcdText[1]}
              </text>
            </g>
          )
        })()
      ) : comp.kind === 'servo' ? (
        (() => {
          const hornType = comp.props.servoHorn ?? 'single'
          const hornColor = comp.props.servoHornColor ?? '#ffffff'
          return (
            <g>
              <rect x={12} y={16} width={84} height={56} rx={6} fill="#334155" stroke="#1e293b" strokeWidth={1.6} />
              <circle cx={54} cy={40} r={14} fill="#e2e8f0" stroke="#475569" strokeWidth={1.5} />
              <g transform={`translate(54, 40) rotate(${servoAngle - 90})`}>
                {hornType === 'double' ? (
                  <rect x={-4} y={-24} width={8} height={48} rx={4} fill={hornColor} stroke="#0f172a" strokeWidth={1.2} />
                ) : hornType === 'cross' ? (
                  <>
                    <rect x={-4} y={-24} width={8} height={48} rx={4} fill={hornColor} stroke="#0f172a" strokeWidth={1.2} />
                    <rect x={-24} y={-4} width={48} height={8} rx={4} fill={hornColor} stroke="#0f172a" strokeWidth={1.2} />
                  </>
                ) : (
                  <rect x={-4} y={-24} width={8} height={28} rx={4} fill={hornColor} stroke="#0f172a" strokeWidth={1.2} />
                )}
                <circle cx={0} cy={0} r={3.5} fill="#0f172a" />
              </g>
              <text x={54} y={66} textAnchor="middle" fontSize="8" fill="#f8fafc" fontWeight={700}>
                {servoAngle}°
              </text>
            </g>
          )
        })()
      ) : comp.kind === 'buzzer' ? (
        <g>
          <circle cx={37} cy={34} r={24} fill="#0f172a" stroke={buzzer?.active ? '#f59e0b' : '#475569'} strokeWidth={2} />
          <circle cx={37} cy={34} r={7} fill={buzzer?.active ? '#f59e0b' : '#cbd5e1'} />
          {buzzer?.active ? (
            <>
              <circle cx={37} cy={34} r={29} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 3" />
              <text x={37} y={12} textAnchor="middle" fontSize="8" fill="#fbbf24" fontWeight={700}>
                {buzzer.freq}Hz
              </text>
            </>
          ) : null}
        </g>
      ) : comp.kind === 'relay' ? (
        <g>
          <rect x={8} y={6} width={80} height={60} rx={6} fill="#0284c7" stroke="#38bdf8" strokeWidth={1.4} />
          <circle cx={22} cy={20} r={4.5} fill={relayOn ? '#22c55e' : '#334155'} />
          {/* Internal moving armature switch */}
          <line x1={38} y1={22} x2={relayOn ? 68 : 64} y2={relayOn ? 14 : 26} stroke="#facc15" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={38} cy={22} r={2.2} fill="#e2e8f0" />
          <circle cx={68} cy={14} r={2.2} fill={relayOn ? '#22c55e' : '#94a3b8'} />
          <circle cx={68} cy={26} r={2.2} fill={!relayOn ? '#ef4444' : '#94a3b8'} />
          <text x={48} y={46} textAnchor="middle" fontSize="9.5" fill="#fff" fontWeight={700}>
            RELAY {relayOn ? 'ON' : 'OFF'}
          </text>
          <text x={48} y={56} textAnchor="middle" fontSize="6" fill="#e0f2fe">
            {(comp.props.relayTransistor ?? 'npn').toUpperCase()}
          </text>
        </g>
      ) : comp.kind === 'web-browser' ? (
        (() => {
          const isOnline = sim.webServerActive
          const readings = sim.webSensorReadings || {}
          const host = sim.wifiIp && sim.wifiIp !== '0.0.0.0' ? sim.wifiIp : '10.13.37.2'
          const addr = (comp.props.browserUrl || `http://${host}/`).slice(0, 26)
          const line1 =
            readings.TEMP !== undefined
              ? `T:${readings.TEMP}C  H:${readings.HUMIDITY ?? '-'}%`
              : readings.DISTANCE !== undefined
                ? `Jarak:${readings.DISTANCE}cm`
                : readings.LUX !== undefined
                  ? `Cahaya:${readings.LUX} lx`
                  : readings.GAS !== undefined
                    ? `Gas:${readings.GAS} ppm`
                    : `IP:${host}`
          const line2 = `LED:${readings.LED_STATE ?? 'OFF'}  LOG:${sim.httpLogs.length}`
          return (
            <g>
              <rect
                x={4}
                y={4}
                width={176}
                height={106}
                rx={7}
                fill="#0f172a"
                stroke={isOnline ? '#22c55e' : '#38bdf8'}
                strokeWidth={1.8}
              />
              <rect x={4} y={4} width={176} height={20} rx={6} fill="#1e293b" />
              <circle cx={14} cy={14} r={2.8} fill="#ef4444" />
              <circle cx={23} cy={14} r={2.8} fill="#f59e0b" />
              <circle cx={32} cy={14} r={2.8} fill="#22c55e" />
              <rect x={40} y={8} width={104} height={12} rx={3} fill="#0f172a" />
              <text x={44} y={16.5} fontSize="6.3" fill="#e2e8f0" fontFamily="monospace">
                {addr}
              </text>
              <rect x={148} y={8} width={28} height={12} rx={3} fill={isOnline ? '#166534' : '#334155'} />
              <text
                x={162}
                y={16.5}
                textAnchor="middle"
                fontSize="5.8"
                fontWeight={700}
                fill={isOnline ? '#bbf7d0' : '#cbd5e1'}
              >
                {isOnline ? '200' : 'IDLE'}
              </text>
              <rect x={10} y={29} width={164} height={46} rx={4} fill="#111827" stroke="#1e293b" strokeWidth={1} />
              <text x={16} y={42} fontSize="8" fontWeight={700} fill="#38bdf8" fontFamily="monospace">
                {isOnline ? 'WebServer HTTP Live' : 'Web Browser Siap'}
              </text>
              <text x={16} y={55} fontSize="8.5" fontWeight={700} fill="#f8fafc" fontFamily="monospace">
                {line1}
              </text>
              <text x={16} y={67} fontSize="7.2" fill="#94a3b8" fontFamily="monospace">
                {line2}
              </text>
              <rect x={10} y={80} width={164} height={22} rx={4} fill={isOnline ? '#0369a1' : '#1e293b'} />
              <text x={92} y={94} textAnchor="middle" fontSize="7.4" fontWeight={700} fill="#f8fafc">
                Klik -&gt; Buka Panel Web Browser
              </text>
            </g>
          )
        })()
      ) : (
        <WokwiExtendedPartSvg comp={comp} sim={sim} onUpdateProps={onUpdateProps} />
      )}
      </g>

      {showLabels ? (
        <text x={spec.width / 2} y={-8} textAnchor="middle" fontSize="9.5" fontWeight={700} fill={labelColor}>
          {comp.kind === 'resistor' ? `${comp.label.split(' (')[0]} (${formatOhms(comp.ohms ?? 220)})` : comp.label}
        </text>
      ) : null}

      {spec.pins.map((p) => {
        const rot = rotatePointAroundBox(p.dx, p.dy, spec.width, spec.height, comp.rotate)
        const isSel = selectedPin?.nodeId === comp.id && selectedPin?.pinId === p.id
        const color = isSel ? '#f59e0b' : p.role === 'power' ? '#ef4444' : p.role === 'gnd' || p.role === 'cathode' ? '#475569' : '#38bdf8'
        const shortTag = p.id === 'A' ? '+' : p.id === 'K' ? '-' : p.id
        if (isBreadboardKind(comp.kind)) {
          return (
            <rect
              key={p.id}
              className="iot-pin iot-bb-pin iot-bb-socket-ring"
              data-node-id={comp.id}
              data-pin-id={p.id}
              x={rot.dx - 3.2}
              y={rot.dy - 3.2}
              width={6.4}
              height={6.4}
              rx={1.2}
              fill="transparent"
              stroke={isSel ? '#f59e0b' : 'transparent'}
              strokeWidth={isSel ? 1.8 : 1.1}
              style={{ cursor: 'crosshair' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                onPinPointerDown({ nodeId: comp.id, pinId: p.id }, e.clientX, e.clientY)
              }}
              onPointerUp={(e) => {
                e.stopPropagation()
                onPinPointerUp({ nodeId: comp.id, pinId: p.id })
              }}
            >
              <title>{p.label}</title>
            </rect>
          )
        }
        return (
          <g
            key={p.id}
            className="iot-pin"
            data-node-id={comp.id}
            data-pin-id={p.id}
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onPinPointerDown({ nodeId: comp.id, pinId: p.id }, e.clientX, e.clientY)
            }}
            onPointerUp={(e) => {
              e.stopPropagation()
              onPinPointerUp({ nodeId: comp.id, pinId: p.id })
            }}
          >
            <circle className="iot-pin-hit" cx={rot.dx} cy={rot.dy} r={10} fill="transparent" />
            <circle cx={rot.dx} cy={rot.dy} r={isSel ? 6.5 : 5} fill="#0f172a" stroke={color} strokeWidth={2} />
            <circle cx={rot.dx} cy={rot.dy} r={2} fill={color} />
            {showLabels ? (
              <text
                x={rot.dx}
                y={rot.dy + 13}
                textAnchor="middle"
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight={700}
                fill={labelColor}
                style={{ pointerEvents: 'none' }}
              >
                {shortTag}
              </text>
            ) : null}
            <title>{p.label}</title>
          </g>
        )
      })}
      {selectedComp && onStartRotate ? (
        <g
          className="iot-rotate-handle iot-interactive-control"
          data-rotate-node={comp.id}
          transform={`translate(${spec.width + 6}, -6)`}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => {
            e.stopPropagation()
            onStartRotate(comp.id, e.clientX, e.clientY)
          }}
        >
          <circle r={9.5} fill="#16a34a" stroke="#ffffff" strokeWidth={1.6} />
          <path d="M 3.5 -2.5 A 4.2 4.2 0 1 0 4.1 1.6" fill="none" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" />
          <path d="M 1.2 -3.4 L 4.3 -2.6 L 3.8 0.5" fill="none" stroke="#ffffff" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          <title>Tarik bebas untuk memutar / klik +45°</title>
        </g>
      ) : null}
    </g>
  )
}
