import type { BoardId, BoardSpec, ComponentKind, GpioRuntime, PlacedComponent, SimulationState, WireEndpoint } from './types'
import { decodeResistorBands, formatOhms, getComponentSpec } from './boards'

export function BoardThumbnail({ boardId }: { boardId: BoardId }) {
  const isArduino = boardId === 'arduino-uno' || boardId === 'arduino-mega'
  const isPico = boardId === 'pico-w'
  const pcb = isArduino ? '#0e6990' : isPico ? '#156035' : '#1b1e23'
  return (
    <svg viewBox="0 0 110 64" width="100%" height="56" aria-hidden="true">
      <rect x={22} y={8} width={66} height={48} rx={5} fill={pcb} stroke="#475569" strokeWidth={1.2} />
      {isArduino ? (
        <>
          <rect x={16} y={14} width={12} height={14} rx={2} fill="#cbd5e1" stroke="#64748b" />
          <rect x={16} y={36} width={10} height={12} rx={2} fill="#1e293b" />
          <rect x={44} y={24} width={28} height={16} rx={2} fill="#0f172a" stroke="#94a3b8" strokeWidth={0.8} />
          <rect x={34} y={10} width={44} height={4} fill="#1e293b" />
          <rect x={34} y={50} width={44} height={4} fill="#1e293b" />
        </>
      ) : (
        <>
          <rect x={40} y={12} width={30} height={22} rx={2} fill="#94a3b8" stroke="#cbd5e1" strokeWidth={0.9} />
          <rect x={47} y={48} width={16} height={8} rx={2} fill="#cbd5e1" />
          <path d="M44 10 V5 H49 V10 H54 V5 H59 V10 H65 V5" fill="none" stroke="#eab308" strokeWidth={1.2} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              <circle cx={27} cy={14 + i * 7} r={1.8} fill="#facc15" />
              <circle cx={83} cy={14 + i * 7} r={1.8} fill="#facc15" />
            </g>
          ))}
        </>
      )}
    </svg>
  )
}

export function PartThumbnail({ kind }: { kind: ComponentKind }) {
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
      ) : kind === 'breadboard' ? (
        <g transform="translate(18, 6)">
          <rect x={0} y={0} width={74} height={52} rx={3} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.2} />
          <line x1={4} y1={6} x2={70} y2={6} stroke="#ef4444" strokeWidth={1.2} />
          <line x1={4} y1={46} x2={70} y2={46} stroke="#3b82f6" strokeWidth={1.2} />
          <rect x={3} y={24} width={68} height={4} fill="#e2e8f0" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
            <g key={c}>
              <circle cx={9 + c * 7} cy={14} r={1.2} fill="#334155" />
              <circle cx={9 + c * 7} cy={20} r={1.2} fill="#334155" />
              <circle cx={9 + c * 7} cy={32} r={1.2} fill="#334155" />
              <circle cx={9 + c * 7} cy={38} r={1.2} fill="#334155" />
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
  const builtin: GpioRuntime | undefined = isPrimary ? sim.gpioStates[board.builtinLedGpio] : undefined
  const builtinOn = Boolean(builtin && builtin.digital === 1)
  const isArduino = board.id === 'arduino-uno' || board.id === 'arduino-mega'
  const isPico = board.id === 'pico-w'
  const pcbColor = isArduino ? '#0d6e96' : isPico ? '#14532d' : '#181b20'
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
          x={-5}
          y={-5}
          width={w + 10}
          height={h + 10}
          rx={13}
          fill="none"
          stroke="#16a34a"
          strokeWidth={2}
          strokeDasharray="5 3"
        />
      ) : null}
      {/* Realistic PCB Body */}
      <rect x={0} y={0} width={w} height={h} rx={10} fill={pcbColor} stroke="#334155" strokeWidth={2} />
      {!isPrimary ? (
        <text x={w / 2} y={-8} textAnchor="middle" fontSize="9" fontWeight={700} fill="#38bdf8">
          {label}
        </text>
      ) : null}

      {/* Four brass corner mounting holes */}
      {[
        [10, 10],
        [w - 10, 10],
        [10, h - 10],
        [w - 10, h - 10],
      ].map(([cx, cy], idx) => (
        <g key={idx}>
          <circle cx={cx} cy={cy} r={4} fill="#0f172a" stroke="#eab308" strokeWidth={1.5} />
        </g>
      ))}

      {/* Top Wi-Fi meander PCB antenna (for ESP32 / Pico W) */}
      {board.hasWifi ? (
        <g>
          <rect x={w / 2 - 42} y={4} width={84} height={22} rx={3} fill="#111317" stroke="#475569" strokeWidth={1} />
          <path
            d={`M ${w / 2 - 32} 20 V 9 H ${w / 2 - 22} V 20 H ${w / 2 - 12} V 9 H ${w / 2 - 2} V 20 H ${w / 2 + 8} V 9 H ${w / 2 + 22}`}
            fill="none"
            stroke="#eab308"
            strokeWidth={2}
          />
        </g>
      ) : null}

      {/* Brushed silver RF shield / AVR MCU package safely centered inside pin columns */}
      <rect
        x={w / 2 - 38}
        y={32}
        width={76}
        height={64}
        rx={5}
        fill={isArduino ? '#1e293b' : '#cbd5e1'}
        stroke="#64748b"
        strokeWidth={1.4}
      />
      <text
        x={w / 2}
        y={62}
        textAnchor="middle"
        fontSize="10"
        fontWeight={800}
        fill={isArduino ? '#e2e8f0' : '#0f172a'}
      >
        {board.shortName}
      </text>
      <text
        x={w / 2}
        y={76}
        textAnchor="middle"
        fontSize="7.5"
        fill={isArduino ? '#94a3b8' : '#334155'}
        fontWeight={600}
      >
        {board.logicVoltage}V · {board.clockMhz}MHz
      </text>

      {/* Secondary IC & Regulator well inside center corridor */}
      <rect x={w / 2 - 14} y={114} width={28} height={28} rx={3} fill="#0f172a" stroke="#475569" strokeWidth={1} />
      <text x={w / 2} y={131} textAnchor="middle" fontSize="6.5" fill="#94a3b8">UART</text>

      {/* Power LED & Built-in LED cleanly centered above EN/BOOT */}
      <circle cx={w / 2 - 20} cy={166} r={4} fill={sim.running ? '#ef4444' : '#450a0a'} style={sim.running ? { filter: 'drop-shadow(0 0 5px #ef4444)' } : undefined} />
      <text x={w / 2 - 20} y={178} textAnchor="middle" fontSize="7" fill="#cbd5e1">PWR</text>

      <circle
        cx={w / 2 + 20}
        cy={166}
        r={builtinOn ? 4.8 : 4}
        fill={builtinOn ? '#22c55e' : '#14532d'}
        style={builtinOn ? { filter: 'drop-shadow(0 0 6px #22c55e)' } : undefined}
      />
      <text x={w / 2 + 20} y={178} textAnchor="middle" fontSize="7" fill="#cbd5e1">LED</text>

      {/* Wi-Fi IP status tag in lower-center corridor (no pin overlap) */}
      {board.hasWifi && sim.wifiConnected ? (
        <g>
          <rect x={w / 2 - 44} y={190} width={88} height={18} rx={4} fill="#064e3b" stroke="#10b981" strokeWidth={1} />
          <text x={w / 2} y={202} textAnchor="middle" fontSize="7.5" fill="#a7f3d0" fontWeight={700}>
            {sim.wifiIp}
          </text>
        </g>
      ) : null}

      {/* EN & BOOT tactile switches cleanly near bottom corners well below last pin (y=222) */}
      <g transform={`translate(28, ${h - 46})`}>
        <rect x={0} y={0} width={24} height={22} rx={3} fill="#cbd5e1" stroke="#475569" strokeWidth={1} />
        <circle cx={12} cy={11} r={5} fill="#334155" />
        <text x={12} y={32} textAnchor="middle" fontSize="7.5" fontWeight={700} fill="#cbd5e1">EN</text>
      </g>
      <g transform={`translate(${w - 52}, ${h - 46})`}>
        <rect x={0} y={0} width={24} height={22} rx={3} fill="#cbd5e1" stroke="#475569" strokeWidth={1} />
        <circle cx={12} cy={11} r={5} fill="#334155" />
        <text x={12} y={32} textAnchor="middle" fontSize="7.5" fontWeight={700} fill="#cbd5e1">BOOT</text>
      </g>

      {/* Metallic USB Port at bottom edge */}
      <rect x={w / 2 - 20} y={h - 16} width={40} height={20} rx={4} fill="#cbd5e1" stroke="#475569" strokeWidth={1.6} />
      <text x={w / 2} y={h - 3} textAnchor="middle" fontSize="7.5" fill="#1e293b" fontWeight={800}>
        {isArduino ? 'USB-B' : 'USB-C'}
      </text>

      {/* Pin Headers cleanly positioned along outer left/right edges with short readable labels */}
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
            <circle cx={p.x} cy={p.y} r={isSel ? 7 : 5.5} fill="#0f172a" stroke={fill} strokeWidth={2.2} />
            <circle cx={p.x} cy={p.y} r={2.2} fill={fill} />
            {showLabels ? (
              <text
                x={p.side === 'left' ? p.x + 10 : p.x - 10}
                y={p.y + 3}
                textAnchor={p.side === 'left' ? 'start' : 'end'}
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight={700}
                fill={isHigh ? '#86efac' : '#f1f5f9'}
              >
                {p.label}
              </text>
            ) : null}
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

  const ledFill = (() => {
    if (!led) return comp.color === 'green' ? '#16a34a' : comp.color === 'blue' ? '#2563eb' : comp.color === 'yellow' ? '#ca8a04' : '#dc2626'
    const lvl = Math.max(led.r, led.g, led.b)
    if (lvl <= 0.05) {
      return comp.color === 'green' ? '#166534' : comp.color === 'blue' ? '#1e40af' : comp.color === 'yellow' ? '#854d0e' : '#991b1b'
    }
    if (comp.kind === 'rgb-led') {
      return `rgb(${Math.round(led.r * 255)}, ${Math.round(led.g * 255)}, ${Math.round(led.b * 255)})`
    }
    return comp.color === 'green' ? '#22c55e' : comp.color === 'blue' ? '#38bdf8' : comp.color === 'yellow' ? '#facc15' : '#ef4444'
  })()

  const isGlowing = Boolean(led && Math.max(led.r, led.g, led.b) > 0.05)
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
        <g>
          {/* Metallic bent LED wire legs */}
          <path d={`M ${spec.width / 2 - 8} 48 V 72`} stroke="#94a3b8" strokeWidth={2.5} />
          <path d={`M ${spec.width / 2 + 8} 48 V 72`} stroke="#94a3b8" strokeWidth={2.5} />
          {/* Realistic 3D Glossy LED Dome */}
          <path
            d={`M ${spec.width / 2 - 14} 44 V 24 A 14 14 0 0 1 ${spec.width / 2 + 14} 24 V 44 Z`}
            fill={ledFill}
            stroke={isGlowing ? '#fef08a' : '#7f1d1d'}
            strokeWidth={1.5}
            style={isGlowing ? { filter: `drop-shadow(0 0 14px ${ledFill})` } : undefined}
          />
          <rect x={spec.width / 2 - 17} y={42} width={34} height={6} rx={2} fill={ledFill} stroke="#475569" strokeWidth={0.8} />
          <ellipse cx={spec.width / 2 - 5} cy={22} rx={3.5} ry={7} fill="rgba(255,255,255,0.42)" />
          {led?.burned ? (
            <text x={spec.width / 2} y={8} textAnchor="middle" fontSize="8" fill="#ef4444" fontWeight={700}>
              ! NO RES
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
      ) : comp.kind === 'breadboard' ? (
        <g>
          <rect x={0} y={0} width={170} height={112} rx={6} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5} />
          <line x1={8} y1={14} x2={162} y2={14} stroke="#ef4444" strokeWidth={1.6} />
          <line x1={8} y1={26} x2={162} y2={26} stroke="#3b82f6" strokeWidth={1.6} />
          <rect x={6} y={62} width={158} height={8} rx={2} fill="#e2e8f0" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((col) => (
            <g key={col}>
              <circle cx={26 + col * 12} cy={42} r={1.8} fill="#334155" />
              <circle cx={26 + col * 12} cy={52} r={1.8} fill="#334155" />
              <circle cx={26 + col * 12} cy={82} r={1.8} fill="#334155" />
              <circle cx={26 + col * 12} cy={92} r={1.8} fill="#334155" />
            </g>
          ))}
        </g>
      ) : comp.kind === 'pushbutton' ? (
        (() => {
          const isDown = Boolean(comp.props.pressed || comp.props.latched)
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
                fill={isDown ? '#16a34a' : '#dc2626'}
                stroke={isDown ? '#14532d' : '#7f1d1d'}
                strokeWidth={isDown ? 2.2 : 1.5}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onUpdateProps(comp.id, { pressed: true })
                  const release = () => {
                    onUpdateProps(comp.id, { pressed: false })
                    window.removeEventListener('pointerup', release)
                  }
                  window.addEventListener('pointerup', release)
                }}
              />
              <text x={39} y={isDown ? 38.5 : 37} textAnchor="middle" fontSize="7" fill="#fff" fontWeight={700} style={{ pointerEvents: 'none' }}>
                {comp.props.latched ? 'LOCK' : isDown ? 'ON' : 'HOLD'}
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
              <text x={42} y={64} textAnchor="middle" fontSize="8.5" fontWeight={700} fill="#e0f2fe" style={{ pointerEvents: 'none' }}>
                {pct}%
              </text>
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
        <g>
          <rect x={4} y={4} width={128} height={66} rx={5} fill="#0f766e" stroke="#115e59" strokeWidth={1.5} />
          <rect x={10} y={12} width={116} height={46} rx={3} fill="#84cc16" stroke="#1e293b" strokeWidth={2} />
          <text x={15} y={30} fontSize="8.5" fontFamily="monospace" fontWeight={700} fill="#1a2e05">
            {lcdText[0]}
          </text>
          <text x={15} y={46} fontSize="8.5" fontFamily="monospace" fontWeight={700} fill="#1a2e05">
            {lcdText[1]}
          </text>
        </g>
      ) : comp.kind === 'servo' ? (
        <g>
          <rect x={12} y={16} width={84} height={56} rx={6} fill="#334155" stroke="#1e293b" strokeWidth={1.6} />
          <circle cx={54} cy={40} r={14} fill="#e2e8f0" stroke="#475569" strokeWidth={1.5} />
          <g transform={`translate(54, 40) rotate(${servoAngle - 90})`}>
            <rect x={-4} y={-24} width={8} height={28} rx={4} fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />
            <circle cx={0} cy={0} r={3.5} fill="#0f172a" />
          </g>
          <text x={54} y={66} textAnchor="middle" fontSize="8" fill="#f8fafc" fontWeight={700}>
            {servoAngle}°
          </text>
        </g>
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
      ) : (
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
        </g>
      )}

      {showLabels ? (
        <text x={spec.width / 2} y={-8} textAnchor="middle" fontSize="9.5" fontWeight={700} fill={labelColor}>
          {comp.kind === 'resistor' ? `${comp.label.split(' (')[0]} (${formatOhms(comp.ohms ?? 220)})` : comp.label}
        </text>
      ) : null}

      {spec.pins.map((p) => {
        const isSel = selectedPin?.nodeId === comp.id && selectedPin?.pinId === p.id
        const color = isSel ? '#f59e0b' : p.role === 'power' ? '#ef4444' : p.role === 'gnd' || p.role === 'cathode' ? '#475569' : '#38bdf8'
        const shortTag = p.id === 'A' ? '+' : p.id === 'K' ? '-' : p.id
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
            <circle className="iot-pin-hit" cx={p.dx} cy={p.dy} r={10} fill="transparent" />
            <circle cx={p.dx} cy={p.dy} r={isSel ? 6.5 : 5} fill="#0f172a" stroke={color} strokeWidth={2} />
            <circle cx={p.dx} cy={p.dy} r={2} fill={color} />
            {showLabels ? (
              <text
                x={p.dx}
                y={p.dy + 13}
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
    </g>
  )
}
