import type { BoardSpec, GpioRuntime, PlacedComponent, SimulationState, WireEndpoint } from './types'
import { getComponentSpec } from './boards'

export function BoardHardwareView({
  board,
  boardX,
  boardY,
  sim,
  selectedPin,
  onPinClick,
}: {
  board: BoardSpec
  boardX: number
  boardY: number
  sim: SimulationState
  selectedPin: WireEndpoint | null
  onPinClick: (ep: WireEndpoint) => void
}) {
  const builtin: GpioRuntime | undefined = sim.gpioStates[board.builtinLedGpio]
  const builtinOn = Boolean(builtin && builtin.digital === 1)
  const pcbColor =
    board.id === 'arduino-uno' ? '#0f5c7a' : board.id === 'pico-w' ? '#14532d' : '#182436'

  return (
    <g transform={`translate(${boardX}, ${boardY})`}>
      {/* PCB body */}
      <rect x={0} y={0} width={board.width} height={board.height} rx={12} fill={pcbColor} stroke="#334155" strokeWidth={2} />
      {/* RF Antenna for Wi-Fi boards */}
      {board.hasWifi ? (
        <g>
          <rect x={44} y={-10} width={80} height={24} rx={4} fill="#0f172a" stroke="#64748b" strokeWidth={1.2} />
          <path d="M56 6 V-4 H66 V4 H76 V-4 H86 V4 H96 V-4 H110" fill="none" stroke="#eab308" strokeWidth={2} />
        </g>
      ) : null}
      {/* USB Connector at bottom */}
      <rect x={board.width / 2 - 20} y={board.height - 14} width={40} height={20} rx={4} fill="#cbd5e1" stroke="#475569" strokeWidth={1.5} />
      <text x={board.width / 2} y={board.height - 1} textAnchor="middle" fontSize="8" fill="#1e293b" fontWeight={700}>
        {board.id === 'arduino-uno' ? 'USB-B' : 'USB-C'}
      </text>

      {/* Main SoC package */}
      <rect x={board.width / 2 - 28} y={64} width={56} height={56} rx={5} fill="#0f172a" stroke="#94a3b8" strokeWidth={1.2} />
      <text x={board.width / 2} y={89} textAnchor="middle" fontSize="9.5" fontWeight={700} fill="#e2e8f0">
        {board.shortName}
      </text>
      <text x={board.width / 2} y={102} textAnchor="middle" fontSize="7.5" fill="#94a3b8">
        {board.logicVoltage}V · {board.clockMhz}MHz
      </text>

      {/* PWR LED + Built-in LED */}
      <circle cx={42} cy={36} r={4} fill={sim.running ? '#22c55e' : '#14532d'} />
      <text x={50} y={39} fontSize="8" fill="#cbd5e1">PWR</text>

      <circle
        cx={112}
        cy={36}
        r={builtinOn ? 5 : 4}
        fill={builtinOn ? '#f59e0b' : '#451a03'}
        style={builtinOn ? { filter: 'drop-shadow(0 0 6px #f59e0b)' } : undefined}
      />
      <text x={120} y={39} fontSize="8" fill="#cbd5e1">LED</text>

      {/* BOOT & RST micro-buttons */}
      <rect x={44} y={134} width={22} height={14} rx={3} fill="#e2e8f0" />
      <text x={55} y={158} textAnchor="middle" fontSize="7" fill="#94a3b8">RST</text>
      <rect x={102} y={134} width={22} height={14} rx={3} fill="#e2e8f0" />
      <text x={113} y={158} textAnchor="middle" fontSize="7" fill="#94a3b8">BOOT</text>

      {/* Wi-Fi IP status tag on board */}
      {board.hasWifi && sim.wifiConnected ? (
        <g>
          <rect x={34} y={170} width={100} height={18} rx={4} fill="#064e3b" stroke="#10b981" strokeWidth={1} />
          <text x={84} y={182} textAnchor="middle" fontSize="8" fill="#a7f3d0" fontWeight={600}>
            WiFi {sim.wifiIp}
          </text>
        </g>
      ) : null}

      {/* Pin Headers */}
      {board.pins.map((p) => {
        const isSel = selectedPin?.nodeId === 'board' && selectedPin?.pinId === p.id
        const activeGpio = p.gpio !== undefined ? sim.gpioStates[p.gpio] : undefined
        const isHigh = Boolean(activeGpio && activeGpio.digital === 1)
        const fill =
          isSel
            ? '#f59e0b'
            : p.kind === 'power'
              ? '#ef4444'
              : p.kind === 'gnd'
                ? '#334155'
                : isHigh
                  ? '#22c55e'
                  : '#eab308'

        return (
          <g
            key={p.id}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onPinClick({ nodeId: 'board', pinId: p.id })
            }}
          >
            <circle cx={p.x} cy={p.y} r={isSel ? 7 : 5.5} fill="#0f172a" stroke={fill} strokeWidth={2.2} />
            <circle cx={p.x} cy={p.y} r={2.2} fill={fill} />
            <text
              x={p.side === 'left' ? p.x + 10 : p.x - 10}
              y={p.y + 3}
              textAnchor={p.side === 'left' ? 'start' : 'end'}
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight={600}
              fill={isHigh ? '#86efac' : '#e2e8f0'}
            >
              {p.label}
            </text>
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
  onStartDrag,
  onPinClick,
  onUpdateProps,
}: {
  comp: PlacedComponent
  sim: SimulationState
  selectedPin: WireEndpoint | null
  selectedComp: boolean
  onStartDrag: (compId: string, clientX: number, clientY: number) => void
  onPinClick: (ep: WireEndpoint) => void
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
    if (!led) return comp.color === 'green' ? '#166534' : comp.color === 'blue' ? '#1e40af' : comp.color === 'yellow' ? '#854d0e' : '#7f1d1d'
    const lvl = Math.max(led.r, led.g, led.b)
    if (lvl <= 0.05) {
      return comp.color === 'green' ? '#166534' : comp.color === 'blue' ? '#1e40af' : comp.color === 'yellow' ? '#854d0e' : '#7f1d1d'
    }
    if (comp.kind === 'rgb-led') {
      return `rgb(${Math.round(led.r * 255)}, ${Math.round(led.g * 255)}, ${Math.round(led.b * 255)})`
    }
    return comp.color === 'green' ? '#22c55e' : comp.color === 'blue' ? '#38bdf8' : comp.color === 'yellow' ? '#facc15' : '#ef4444'
  })()

  const isGlowing = Boolean(led && Math.max(led.r, led.g, led.b) > 0.05)

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
      {/* Selection outline */}
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

      {/* Component body artwork */}
      {comp.kind === 'led' || comp.kind === 'rgb-led' ? (
        <g>
          <rect x={8} y={6} width={spec.width - 16} height={spec.height - 20} rx={8} fill="#1e293b" stroke="#475569" strokeWidth={1.2} />
          <circle
            cx={spec.width / 2}
            cy={32}
            r={isGlowing ? 16 : 14}
            fill={ledFill}
            stroke="#e2e8f0"
            strokeWidth={1.5}
            style={isGlowing ? { filter: `drop-shadow(0 0 12px ${ledFill})` } : undefined}
          />
          {led?.burned ? (
            <text x={spec.width / 2} y={14} textAnchor="middle" fontSize="8" fill="#fca5a5" fontWeight={700}>
              ! NO RES
            </text>
          ) : null}
        </g>
      ) : comp.kind === 'resistor' ? (
        <g>
          <line x1={6} y1={22} x2={76} y2={22} stroke="#94a3b8" strokeWidth={3} />
          <rect x={18} y={12} width={46} height={20} rx={6} fill="#e7cfa0" stroke="#a16207" strokeWidth={1.2} />
          <rect x={26} y={12} width={5} height={20} fill="#dc2626" />
          <rect x={35} y={12} width={5} height={20} fill="#dc2626" />
          <rect x={44} y={12} width={5} height={20} fill="#78350f" />
          <rect x={54} y={12} width={4} height={20} fill="#eab308" />
        </g>
      ) : comp.kind === 'pushbutton' ? (
        <g>
          <rect x={8} y={6} width={56} height={50} rx={6} fill="#334155" stroke="#64748b" strokeWidth={1.4} />
          <rect
            className="iot-interactive-control"
            x={18}
            y={14}
            width={36}
            height={34}
            rx={6}
            fill={comp.props.pressed ? '#16a34a' : '#dc2626'}
            stroke="#f8fafc"
            strokeWidth={1.5}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onUpdateProps(comp.id, { pressed: true })
            }}
            onPointerUp={(e) => {
              e.stopPropagation()
              onUpdateProps(comp.id, { pressed: false })
            }}
            onClick={(e) => {
              e.stopPropagation()
              onUpdateProps(comp.id, { pressed: !comp.props.pressed })
            }}
          />
          <text x={36} y={34} textAnchor="middle" fontSize="8" fill="#fff" fontWeight={700} style={{ pointerEvents: 'none' }}>
            {comp.props.pressed ? 'ON' : 'PUSH'}
          </text>
        </g>
      ) : comp.kind === 'hc-sr04' ? (
        <g>
          <rect x={4} y={6} width={104} height={66} rx={7} fill="#1d4ed8" stroke="#93c5fd" strokeWidth={1.4} />
          <circle cx={30} cy={30} r={16} fill="#cbd5e1" stroke="#475569" strokeWidth={2} />
          <circle cx={30} cy={30} r={9} fill="#1e293b" />
          <circle cx={82} cy={30} r={16} fill="#cbd5e1" stroke="#475569" strokeWidth={2} />
          <circle cx={82} cy={30} r={9} fill="#1e293b" />
          <foreignObject className="iot-interactive-control" x={8} y={49} width={96} height={24}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#fff' }}>
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
          <rect x={6} y={4} width={84} height={68} rx={6} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1.5} />
          <rect x={14} y={10} width={68} height={24} rx={3} fill="#e2e8f0" stroke="#cbd5e1" />
          <text x={48} y={25} textAnchor="middle" fontSize="9" fontWeight={700} fill="#0f172a">
            DHT22 · {comp.props.tempC ?? 28}°C
          </text>
          <foreignObject className="iot-interactive-control" x={10} y={36} width={76} height={36}>
            <div style={{ display: 'grid', gap: 2, fontSize: 8.5, color: '#0f172a' }}>
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
        <g>
          <rect x={10} y={6} width={64} height={68} rx={8} fill="#1e3a8a" stroke="#60a5fa" strokeWidth={1.4} />
          <circle cx={42} cy={32} r={18} fill="#e2e8f0" stroke="#475569" strokeWidth={2} />
          <line
            x1={42}
            y1={32}
            x2={42 + 14 * Math.cos((((comp.props.potPct ?? 50) / 100) * 260 - 220) * (Math.PI / 180))}
            y2={32 + 14 * Math.sin((((comp.props.potPct ?? 50) / 100) * 260 - 220) * (Math.PI / 180))}
            stroke="#0f172a"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <foreignObject className="iot-interactive-control" x={12} y={53} width={60} height={20}>
            <input
              type="range"
              min={0}
              max={100}
              value={comp.props.potPct ?? 50}
              onChange={(e) => onUpdateProps(comp.id, { potPct: Number(e.target.value) })}
              style={{ width: 58 }}
            />
          </foreignObject>
        </g>
      ) : comp.kind === 'ldr' ? (
        <g>
          <rect x={8} y={6} width={70} height={60} rx={8} fill="#78350f" stroke="#f59e0b" strokeWidth={1.4} />
          <circle cx={43} cy={28} r={14} fill="#fde68a" stroke="#b45309" strokeWidth={1.5} />
          <path d="M35 28 H51 M35 23 H51 M35 33 H51" stroke="#b45309" strokeWidth={1.8} />
          <foreignObject className="iot-interactive-control" x={12} y={45} width={62} height={20}>
            <input
              type="range"
              min={50}
              max={1000}
              value={comp.props.lux ?? 420}
              onChange={(e) => onUpdateProps(comp.id, { lux: Number(e.target.value) })}
              style={{ width: 60 }}
              title="Cahaya Lux"
            />
          </foreignObject>
        </g>
      ) : comp.kind === 'pir' ? (
        <g>
          <rect x={8} y={6} width={70} height={64} rx={8} fill="#1e293b" stroke="#94a3b8" strokeWidth={1.4} />
          <circle cx={43} cy={30} r={18} fill={comp.props.motion ? '#f8fafc' : '#cbd5e1'} stroke="#64748b" />
          <foreignObject className="iot-interactive-control" x={12} y={50} width={62} height={18}>
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
                background: comp.props.motion ? '#ef4444' : '#334155',
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
          <rect x={4} y={4} width={116} height={76} rx={6} fill="#1e3a8a" stroke="#60a5fa" strokeWidth={1.5} />
          <rect x={10} y={14} width={104} height={54} rx={3} fill="#020617" stroke="#334155" />
          {oledText.slice(0, 4).map((line, i) => (
            <text key={i} x={14} y={26 + i * 11} fontSize="8" fontFamily="monospace" fill="#38bdf8">
              {line}
            </text>
          ))}
        </g>
      ) : comp.kind === 'lcd-1602' ? (
        <g>
          <rect x={4} y={4} width={124} height={62} rx={6} fill="#064e3b" stroke="#34d399" strokeWidth={1.5} />
          <rect x={10} y={12} width={112} height={42} rx={3} fill="#65a30d" stroke="#1a2e05" />
          <text x={14} y={29} fontSize="8.5" fontFamily="monospace" fontWeight={700} fill="#1a2e05">
            {lcdText[0]}
          </text>
          <text x={14} y={45} fontSize="8.5" fontFamily="monospace" fontWeight={700} fill="#1a2e05">
            {lcdText[1]}
          </text>
        </g>
      ) : comp.kind === 'servo' ? (
        <g>
          <rect x={10} y={14} width={82} height={56} rx={6} fill="#0284c7" stroke="#7dd3fc" strokeWidth={1.4} />
          <circle cx={51} cy={38} r={14} fill="#f8fafc" stroke="#334155" strokeWidth={1.5} />
          <g transform={`translate(51, 38) rotate(${servoAngle - 90})`}>
            <rect x={-4} y={-24} width={8} height={28} rx={4} fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />
            <circle cx={0} cy={0} r={3.5} fill="#0f172a" />
          </g>
          <text x={51} y={64} textAnchor="middle" fontSize="8" fill="#fff" fontWeight={700}>
            {servoAngle}°
          </text>
        </g>
      ) : comp.kind === 'buzzer' ? (
        <g>
          <circle cx={36} cy={34} r={24} fill="#0f172a" stroke={buzzer?.active ? '#f59e0b' : '#475569'} strokeWidth={2} />
          <circle cx={36} cy={34} r={7} fill={buzzer?.active ? '#f59e0b' : '#334155'} />
          {buzzer?.active ? (
            <>
              <circle cx={36} cy={34} r={29} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 3" />
              <text x={36} y={12} textAnchor="middle" fontSize="8" fill="#fbbf24" fontWeight={700}>
                {buzzer.freq}Hz
              </text>
            </>
          ) : null}
        </g>
      ) : (
        <g>
          <rect x={8} y={6} width={76} height={60} rx={6} fill="#0369a1" stroke="#38bdf8" strokeWidth={1.4} />
          <circle cx={24} cy={22} r={4.5} fill={relayOn ? '#22c55e' : '#334155'} />
          <text x={48} y={38} textAnchor="middle" fontSize="9.5" fill="#fff" fontWeight={700}>
            RELAY {relayOn ? 'ON' : 'OFF'}
          </text>
        </g>
      )}

      {/* Label badge above component */}
      <text x={spec.width / 2} y={-8} textAnchor="middle" fontSize="9.5" fontWeight={700} fill="#cbd5e1">
        {comp.label}
      </text>

      {/* Component clickable pins */}
      {spec.pins.map((p) => {
        const isSel = selectedPin?.nodeId === comp.id && selectedPin?.pinId === p.id
        const color = isSel ? '#f59e0b' : p.role === 'power' ? '#ef4444' : p.role === 'gnd' || p.role === 'cathode' ? '#64748b' : '#38bdf8'
        return (
          <g
            key={p.id}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onPinClick({ nodeId: comp.id, pinId: p.id })
            }}
          >
            <circle cx={p.dx} cy={p.dy} r={isSel ? 6.5 : 5} fill="#0f172a" stroke={color} strokeWidth={2} />
            <circle cx={p.dx} cy={p.dy} r={2} fill={color} />
            <title>{p.label}</title>
          </g>
        )
      })}
    </g>
  )
}
