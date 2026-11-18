import type { BoardSpec, ComponentKind, GpioRuntime, PlacedComponent, SimulationState } from './types'

export function RealBoardBodySvg({
  board,
  sim,
  isPrimary,
}: {
  board: BoardSpec
  sim: SimulationState
  isPrimary: boolean
}) {
  const builtin: GpioRuntime | undefined = isPrimary ? sim.gpioStates[board.builtinLedGpio] : undefined
  const builtinOn = Boolean(builtin && builtin.digital === 1)
  const w = board.width
  const h = board.height

  if (board.id === 'arduino-uno') {
    return (
      <g>
        {/* Signature Arduino Uno R3 notched PCB outline */}
        <path
          d={`M 14 0 H ${w - 18} L ${w} 18 V ${h - 14} L ${w - 14} ${h} H 14 Q 0 ${h} 0 ${h - 14} V 14 Q 0 0 14 0 Z`}
          fill="#00878f"
          stroke="#0f172a"
          strokeWidth={1.8}
        />
        {/* Mounting holes */}
        {[
          [16, 16],
          [w - 22, 18],
          [16, h - 16],
          [w - 22, h - 18],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={4.2} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5} />
        ))}
        {/* Top & bottom black female header bars */}
        <rect x={84} y={5} width={226} height={17} rx={2} fill="#18181b" stroke="#334155" strokeWidth={1} />
        <rect x={110} y={h - 22} width={144} height={17} rx={2} fill="#18181b" stroke="#334155" strokeWidth={1} />

        {/* Silver USB-B connector (top-left) */}
        <rect x={-12} y={32} width={52} height={38} rx={3} fill="#e2e8f0" stroke="#475569" strokeWidth={1.6} />
        <rect x={2} y={38} width={28} height={26} rx={2} fill="#cbd5e1" />
        <text x={14} y={54} textAnchor="middle" fontSize="6.5" fontWeight={700} fill="#334155">USB-B</text>

        {/* DC Barrel Power Jack (bottom-left) */}
        <rect x={-8} y={136} width={54} height={36} rx={3} fill="#18181b" stroke="#334155" strokeWidth={1.4} />
        <circle cx={6} cy={154} r={8} fill="#09090b" stroke="#475569" />

        {/* Reset button & 16U2 USB IC */}
        <rect x={48} y={18} width={18} height={16} rx={3} fill="#e2e8f0" stroke="#475569" />
        <circle cx={57} cy={26} r={4} fill="#ea580c" />
        <rect x={68} y={48} width={22} height={22} rx={2} fill="#1e293b" stroke="#64748b" />
        <ellipse cx={79} cy={84} rx={10} ry={4.5} fill="#cbd5e1" stroke="#475569" />

        {/* Branding & ON / L LEDs */}
        <text x={148} y={64} fontSize="14" fontWeight={800} fill="#ffffff" letterSpacing="0.5">
          ARDUINO
        </text>
        <text x={148} y={80} fontSize="10" fontWeight={700} fill="#cffafe">
          UNO R3 · 5V
        </text>
        <circle cx={270} cy={62} r={3.6} fill={sim.running ? '#22c55e' : '#14532d'} />
        <text x={282} y={65} fontSize="7" fill="#fff">ON</text>
        <circle
          cx={270}
          cy={80}
          r={builtinOn ? 4.4 : 3.6}
          fill={builtinOn ? '#f59e0b' : '#451a03'}
          style={builtinOn ? { filter: 'drop-shadow(0 0 6px #f59e0b)' } : undefined}
        />
        <text x={282} y={83} fontSize="7" fill="#fff">L</text>

        {/* Signature 28-pin ATmega328P DIP IC */}
        <rect x={144} y={118} width={128} height={34} rx={3} fill="#111827" stroke="#475569" strokeWidth={1.4} />
        <path d="M 144 130 A 5 5 0 0 1 144 140" fill="#334155" />
        {Array.from({ length: 14 }, (_, idx) => (
          <g key={idx}>
            <rect x={151 + idx * 8.6} y={113} width={4} height={5} fill="#cbd5e1" />
            <rect x={151 + idx * 8.6} y={152} width={4} height={5} fill="#cbd5e1" />
          </g>
        ))}
        <text x={208} y={138} textAnchor="middle" fontSize="8.5" fontFamily="monospace" fontWeight={700} fill="#94a3b8">
          ATMEGA328P-PU
        </text>

        {/* ICSP 2x3 gold header on right */}
        {[0, 1].map((col) =>
          [0, 1, 2].map((row) => (
            <circle key={`${col}-${row}`} cx={292 + col * 10} cy={124 + row * 10} r={2.2} fill="#eab308" stroke="#0f172a" />
          )),
        )}
      </g>
    )
  }

  if (board.id === 'arduino-mega') {
    return (
      <g>
        <path
          d={`M 14 0 H ${w - 18} L ${w} 18 V ${h - 14} L ${w - 14} ${h} H 14 Q 0 ${h} 0 ${h - 14} V 14 Q 0 0 14 0 Z`}
          fill="#008189"
          stroke="#0f172a"
          strokeWidth={1.8}
        />
        {[
          [16, 16],
          [w - 22, 18],
          [16, h - 16],
          [w - 22, h - 18],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={4.2} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5} />
        ))}
        <rect x={84} y={5} width={246} height={17} rx={2} fill="#18181b" stroke="#334155" />
        <rect x={110} y={h - 22} width={146} height={17} rx={2} fill="#18181b" stroke="#334155" />
        {/* Extended double-row Digital I/O header block (D22-D53) on right edge */}
        <rect x={342} y={42} width={24} height={138} rx={2} fill="#18181b" stroke="#334155" />
        {Array.from({ length: 14 }, (_, row) => (
          <g key={row}>
            <circle cx={349} cy={50 + row * 9} r={2} fill="#475569" />
            <circle cx={359} cy={50 + row * 9} r={2} fill="#475569" />
          </g>
        ))}

        {/* USB-B & DC Barrel Jack */}
        <rect x={-12} y={34} width={52} height={38} rx={3} fill="#e2e8f0" stroke="#475569" strokeWidth={1.6} />
        <text x={14} y={56} textAnchor="middle" fontSize="6.5" fontWeight={700} fill="#334155">USB-B</text>
        <rect x={-8} y={142} width={54} height={36} rx={3} fill="#18181b" stroke="#334155" strokeWidth={1.4} />

        {/* Square ATmega2560 QFP100 IC */}
        <rect x={174} y={76} width={68} height={68} rx={4} fill="#111827" stroke="#94a3b8" strokeWidth={1.2} />
        <text x={208} y={108} textAnchor="middle" fontSize="8" fontFamily="monospace" fontWeight={700} fill="#e2e8f0">
          ATmega2560
        </text>
        <text x={208} y={121} textAnchor="middle" fontSize="6.5" fill="#94a3b8">
          MEGA 2560 R3
        </text>

        <text x={72} y={96} fontSize="13" fontWeight={800} fill="#fff">ARDUINO</text>
        <text x={72} y={114} fontSize="10" fontWeight={700} fill="#cffafe">MEGA 2560</text>
        <circle cx={290} cy={70} r={3.6} fill={sim.running ? '#22c55e' : '#14532d'} />
        <text x={300} y={73} fontSize="7" fill="#fff">ON</text>
        <circle cx={290} cy={90} r={builtinOn ? 4.4 : 3.6} fill={builtinOn ? '#f59e0b' : '#451a03'} />
        <text x={300} y={93} fontSize="7" fill="#fff">L</text>
      </g>
    )
  }

  if (board.id === 'pico-w') {
    return (
      <g>
        {/* Raspberry Pi Pico W slim vivid green PCB */}
        <rect x={0} y={0} width={w} height={h} rx={7} fill="#15803d" stroke="#052e16" strokeWidth={1.8} />
        {/* Micro-USB at TOP edge */}
        <rect x={w / 2 - 18} y={-8} width={36} height={22} rx={3} fill="#e2e8f0" stroke="#475569" strokeWidth={1.4} />
        <text x={w / 2} y={7} textAnchor="middle" fontSize="6.2" fontWeight={700} fill="#334155">USB</text>
        {/* Triangular PCB antenna cutout area + Infineon CYW43439 wireless shield at bottom */}
        <rect x={w / 2 - 36} y={208} width={72} height={46} rx={4} fill="#cbd5e1" stroke="#64748b" strokeWidth={1.4} />
        <text x={w / 2} y={230} textAnchor="middle" fontSize="7.2" fontWeight={700} fill="#0f172a">CYW43439</text>
        <text x={w / 2} y={241} textAnchor="middle" fontSize="6" fill="#334155">Wi-Fi 2.4GHz</text>
        <path d={`M ${w / 2 - 22} 296 L ${w / 2} 262 L ${w / 2 + 22} 296`} fill="none" stroke="#86efac" strokeWidth={1.5} />

        {/* White BOOTSEL button */}
        <rect x={w / 2 - 15} y={40} width={30} height={18} rx={3} fill="#f8fafc" stroke="#334155" />
        <circle cx={w / 2} cy={49} r={4.5} fill="#cbd5e1" />
        <text x={w / 2} y={67} textAnchor="middle" fontSize="6.5" fill="#ecfdf5" fontWeight={700}>BOOTSEL</text>

        {/* Diamond-rotated RP2040 QFN chip in center */}
        <g transform={`translate(${w / 2}, 136) rotate(45)`}>
          <rect x={-22} y={-22} width={44} height={44} rx={3} fill="#0f172a" stroke="#475569" strokeWidth={1.3} />
        </g>
        <text x={w / 2} y={135} textAnchor="middle" fontSize="7.5" fontWeight={800} fill="#e2e8f0">RP2040</text>
        <text x={w / 2} y={146} textAnchor="middle" fontSize="6" fill="#86efac">Pi Pico W</text>

        {/* Onboard LED */}
        <circle cx={w / 2 - 28} cy={46} r={4} fill={builtinOn ? '#4ade80' : '#052e16'} style={builtinOn ? { filter: 'drop-shadow(0 0 6px #4ade80)' } : undefined} />
        <text x={w / 2 - 28} y={58} textAnchor="middle" fontSize="6" fill="#d1fae5">LED</text>

        {/* 3-pin SWD header at bottom */}
        {[-12, 0, 12].map((dx, i) => (
          <circle key={i} cx={w / 2 + dx} cy={h - 14} r={2.4} fill="#eab308" stroke="#052e16" />
        ))}
      </g>
    )
  }

  if (board.id === 'pi-pico') {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={7} fill="#166534" stroke="#052e16" strokeWidth={1.8} />
        <rect x={w / 2 - 18} y={-8} width={36} height={22} rx={3} fill="#e2e8f0" stroke="#475569" strokeWidth={1.4} />
        <text x={w / 2} y={7} textAnchor="middle" fontSize="6.2" fontWeight={700} fill="#334155">USB</text>
        <rect x={w / 2 - 15} y={40} width={30} height={18} rx={3} fill="#f8fafc" stroke="#334155" />
        <circle cx={w / 2} cy={49} r={4.5} fill="#cbd5e1" />
        <text x={w / 2} y={67} textAnchor="middle" fontSize="6.5" fill="#ecfdf5" fontWeight={700}>BOOTSEL</text>
        <g transform={`translate(${w / 2}, 148) rotate(45)`}>
          <rect x={-24} y={-24} width={48} height={48} rx={3} fill="#0f172a" stroke="#475569" strokeWidth={1.3} />
        </g>
        <text x={w / 2} y={147} textAnchor="middle" fontSize="7.5" fontWeight={800} fill="#e2e8f0">RP2040</text>
        <text x={w / 2} y={158} textAnchor="middle" fontSize="6" fill="#86efac">Pi Pico</text>
        <circle cx={w / 2 - 28} cy={46} r={4} fill={builtinOn ? '#4ade80' : '#052e16'} />
        <text x={w / 2 - 28} y={58} textAnchor="middle" fontSize="6" fill="#d1fae5">LED</text>
        {[-12, 0, 12].map((dx, i) => (
          <circle key={i} cx={w / 2 + dx} cy={h - 14} r={2.4} fill="#eab308" stroke="#052e16" />
        ))}
      </g>
    )
  }

  if (board.id === 'arduino-nano') {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={7} fill="#006d77" stroke="#083344" strokeWidth={1.8} />
        <rect x={w / 2 - 22} y={-8} width={44} height={26} rx={3} fill="#cbd5e1" stroke="#475569" strokeWidth={1.4} />
        <text x={w / 2} y={8} textAnchor="middle" fontSize="6.2" fontWeight={700} fill="#334155">MINI-USB</text>
        <g transform={`translate(${w / 2}, 132) rotate(45)`}>
          <rect x={-22} y={-22} width={44} height={44} rx={2} fill="#18181b" stroke="#64748b" strokeWidth={1.2} />
        </g>
        <text x={w / 2} y={131} textAnchor="middle" fontSize="6.5" fontWeight={700} fill="#e2e8f0">ATmega328P</text>
        <text x={w / 2} y={142} textAnchor="middle" fontSize="6" fill="#67e8f9">Arduino Nano</text>
        <circle cx={w / 2} cy={222} r={11} fill="#e2e8f0" stroke="#475569" strokeWidth={1.5} />
        <circle cx={w / 2} cy={222} r={5} fill="#f8fafc" />
        <text x={w / 2} y={244} textAnchor="middle" fontSize="6.5" fill="#fff" fontWeight={700}>RESET</text>
        <circle cx={w / 2 - 24} cy={46} r={3.8} fill={sim.running ? '#22c55e' : '#14532d'} />
        <text x={w / 2 - 24} y={57} textAnchor="middle" fontSize="5.8" fill="#d1fae5">PWR</text>
        <circle cx={w / 2 + 24} cy={46} r={3.8} fill={builtinOn ? '#f59e0b' : '#451a03'} />
        <text x={w / 2 + 24} y={57} textAnchor="middle" fontSize="5.8" fill="#fef3c7">L</text>
      </g>
    )
  }

  if (board.id === 'esp32') {
    return (
      <g>
        {/* Classic Wokwi ESP32 DevKit v1 black PCB */}
        <rect x={0} y={0} width={w} height={h} rx={8} fill="#18181b" stroke="#334155" strokeWidth={1.8} />
        {/* Exposed meander PCB antenna at top edge */}
        <rect x={w / 2 - 48} y={-8} width={96} height={30} rx={3} fill="#18181b" stroke="#475569" strokeWidth={1} />
        <path
          d={`M ${w / 2 - 36} 16 V 0 H ${w / 2 - 24} V 16 H ${w / 2 - 12} V 0 H ${w / 2} V 16 H ${w / 2 + 12} V 0 H ${w / 2 + 28}`}
          fill="none"
          stroke="#d4af37"
          strokeWidth={2}
        />
        {/* Large WROOM-32 brushed steel RF shield */}
        <rect x={w / 2 - 46} y={24} width={92} height={88} rx={4} fill="#cbd5e1" stroke="#64748b" strokeWidth={1.5} />
        <text x={w / 2} y={56} textAnchor="middle" fontSize="11.5" fontWeight={800} fill="#0f172a">
          ESP32
        </text>
        <text x={w / 2} y={71} textAnchor="middle" fontSize="7.5" fontWeight={700} fill="#334155">
          WROOM-32
        </text>
        <circle cx={w / 2} cy={90} r={11} fill="none" stroke="#64748b" strokeWidth={1.2} />
        <path d={`M ${w / 2 - 5} 90 A 5 5 0 1 1 ${w / 2 + 5} 90`} fill="none" stroke="#64748b" strokeWidth={1.2} />

        {/* CP2102 USB-UART & AMS1117 Regulator */}
        <rect x={w / 2 - 14} y={168} width={28} height={28} rx={2} fill="#09090b" stroke="#52525b" />
        <text x={w / 2} y={185} textAnchor="middle" fontSize="6" fill="#a1a1aa">CP2102</text>
        <rect x={w / 2 - 18} y={214} width={36} height={18} rx={2} fill="#27272a" stroke="#71717a" />
        <text x={w / 2} y={226} textAnchor="middle" fontSize="5.8" fill="#d4d4d8">AMS1117</text>

        {/* PWR & D2 LEDs */}
        <circle cx={w / 2 - 18} cy={146} r={3.8} fill={sim.running ? '#ef4444' : '#450a0a'} style={sim.running ? { filter: 'drop-shadow(0 0 5px #ef4444)' } : undefined} />
        <text x={w / 2 - 18} y={157} textAnchor="middle" fontSize="6.5" fill="#cbd5e1">PWR</text>
        <circle cx={w / 2 + 18} cy={146} r={3.8} fill={builtinOn ? '#38bdf8' : '#082f49'} style={builtinOn ? { filter: 'drop-shadow(0 0 6px #38bdf8)' } : undefined} />
        <text x={w / 2 + 18} y={157} textAnchor="middle" fontSize="6.5" fill="#cbd5e1">D2</text>

        {/* EN & BOOT buttons flanking Micro-USB port */}
        <rect x={30} y={h - 40} width={20} height={18} rx={2} fill="#cbd5e1" stroke="#475569" />
        <circle cx={40} cy={h - 31} r={4} fill="#18181b" />
        <text x={40} y={h - 13} textAnchor="middle" fontSize="6.5" fill="#e4e4e7">EN</text>

        <rect x={w - 50} y={h - 40} width={20} height={18} rx={2} fill="#cbd5e1" stroke="#475569" />
        <circle cx={w - 40} cy={h - 31} r={4} fill="#18181b" />
        <text x={w - 40} y={h - 13} textAnchor="middle" fontSize="6.5" fill="#e4e4e7">BOOT</text>

        <rect x={w / 2 - 19} y={h - 16} width={38} height={22} rx={3} fill="#e2e8f0" stroke="#475569" strokeWidth={1.4} />
        <text x={w / 2} y={h - 2} textAnchor="middle" fontSize="6.2" fontWeight={700} fill="#1e293b">mUSB</text>
      </g>
    )
  }

  // Default: compact ESP32-C3 SuperMini / DevKitM-1
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} rx={9} fill="#0f172a" stroke="#334155" strokeWidth={1.8} />
      {[
        [10, 10],
        [w - 10, 10],
        [10, h - 10],
        [w - 10, h - 10],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={3.6} fill="#020617" stroke="#eab308" strokeWidth={1.4} />
      ))}
      {/* Ceramic chip antenna */}
      <rect x={w / 2 - 22} y={7} width={44} height={14} rx={2} fill="#f8fafc" stroke="#94a3b8" />
      <rect x={w / 2 - 14} y={10} width={28} height={8} rx={1} fill="#ca8a04" />

      {/* ESP32-C3 metallic RF package */}
      <rect x={w / 2 - 34} y={30} width={68} height={58} rx={4} fill="#cbd5e1" stroke="#64748b" strokeWidth={1.3} />
      <text x={w / 2} y={56} textAnchor="middle" fontSize="9.5" fontWeight={800} fill="#0f172a">
        ESP32-C3
      </text>
      <text x={w / 2} y={69} textAnchor="middle" fontSize="7" fontWeight={600} fill="#334155">
        RISC-V · 160MHz
      </text>

      <rect x={w / 2 - 12} y={108} width={24} height={24} rx={3} fill="#1e293b" stroke="#475569" />
      <text x={w / 2} y={123} textAnchor="middle" fontSize="6" fill="#94a3b8">UART</text>

      <circle cx={w / 2 - 18} cy={156} r={3.6} fill={sim.running ? '#ef4444' : '#450a0a'} style={sim.running ? { filter: 'drop-shadow(0 0 5px #ef4444)' } : undefined} />
      <text x={w / 2 - 18} y={167} textAnchor="middle" fontSize="6.5" fill="#cbd5e1">PWR</text>
      <circle cx={w / 2 + 18} cy={156} r={4} fill={builtinOn ? '#22c55e' : '#14532d'} style={builtinOn ? { filter: 'drop-shadow(0 0 6px #22c55e)' } : undefined} />
      <text x={w / 2 + 18} y={167} textAnchor="middle" fontSize="6.5" fill="#cbd5e1">RGB</text>

      {sim.wifiConnected ? (
        <g>
          <rect x={w / 2 - 40} y={178} width={80} height={16} rx={4} fill="#064e3b" stroke="#10b981" />
          <text x={w / 2} y={189} textAnchor="middle" fontSize="7" fill="#a7f3d0" fontWeight={700}>{sim.wifiIp}</text>
        </g>
      ) : null}

      <rect x={26} y={h - 42} width={20} height={18} rx={3} fill="#cbd5e1" stroke="#475569" />
      <circle cx={36} cy={h - 33} r={4} fill="#334155" />
      <text x={36} y={h - 15} textAnchor="middle" fontSize="6.5" fill="#cbd5e1">RST</text>

      <rect x={w - 46} y={h - 42} width={20} height={18} rx={3} fill="#cbd5e1" stroke="#475569" />
      <circle cx={w - 36} cy={h - 33} r={4} fill="#334155" />
      <text x={w - 36} y={h - 15} textAnchor="middle" fontSize="6.5" fill="#cbd5e1">BOOT</text>

      <rect x={w / 2 - 18} y={h - 14} width={36} height={18} rx={4} fill="#e2e8f0" stroke="#475569" strokeWidth={1.5} />
      <text x={w / 2} y={h - 2} textAnchor="middle" fontSize="6.5" fill="#0f172a" fontWeight={800}>USB-C</text>
    </g>
  )
}

export function WokwiExtendedPartSvg({
  comp,
  sim,
  onUpdateProps,
}: {
  comp: PlacedComponent
  sim: SimulationState
  onUpdateProps: (compId: string, patch: Partial<PlacedComponent['props']>) => void
}) {
  switch (comp.kind) {
    case 'mq2': {
      const ppm = comp.props.gasPpm ?? 280
      return (
        <g>
          <rect x={4} y={6} width={88} height={64} rx={6} fill="#991b1b" stroke="#f87171" strokeWidth={1.3} />
          <circle cx={48} cy={29} r={17} fill="#94a3b8" stroke="#475569" strokeWidth={2} />
          <circle cx={48} cy={29} r={11} fill="#64748b" strokeDasharray="2 2" stroke="#cbd5e1" />
          <text x={48} y={32} textAnchor="middle" fontSize="7" fontWeight={700} fill="#f8fafc">{ppm}ppm</text>
          <foreignObject className="iot-interactive-control" x={12} y={49} width={72} height={18}>
            <input
              type="range"
              min={50}
              max={2500}
              value={ppm}
              onChange={(e) => onUpdateProps(comp.id, { gasPpm: Number(e.target.value) })}
              style={{ width: 70 }}
              title="Gas MQ2 (ppm)"
            />
          </foreignObject>
        </g>
      )
    }
    case 'ds18b20':
      return (
        <g>
          <path d="M 22 44 V 16 A 17 12 0 0 1 56 16 V 44 Z" fill="#1e293b" stroke="#64748b" strokeWidth={1.4} />
          <text x={39} y={32} textAnchor="middle" fontSize="7.5" fill="#e2e8f0" fontWeight={700}>DS18</text>
          <line x1={20} y1={44} x2={20} y2={72} stroke="#94a3b8" strokeWidth={2.2} />
          <line x1={39} y1={44} x2={39} y2={72} stroke="#94a3b8" strokeWidth={2.2} />
          <line x1={58} y1={44} x2={58} y2={72} stroke="#94a3b8" strokeWidth={2.2} />
        </g>
      )
    case 'ntc':
      return (
        <g>
          <rect x={6} y={8} width={66} height={52} rx={6} fill="#b91c1c" stroke="#fca5a5" />
          <circle cx={39} cy={23} r={8} fill="#0f172a" stroke="#f8fafc" />
          <text x={39} y={40} textAnchor="middle" fontSize="7.5" fill="#fff" fontWeight={700}>NTC {comp.props.tempC ?? 25}°C</text>
          <foreignObject className="iot-interactive-control" x={11} y={43} width={56} height={16}>
            <input
              type="range"
              min={-10}
              max={85}
              value={comp.props.tempC ?? 25}
              onChange={(e) => onUpdateProps(comp.id, { tempC: Number(e.target.value) })}
              style={{ width: 54 }}
              title="Suhu NTC °C"
            />
          </foreignObject>
        </g>
      )
    case 'mpu6050':
      return (
        <g>
          <rect x={4} y={6} width={94} height={60} rx={5} fill="#1d4ed8" stroke="#93c5fd" strokeWidth={1.4} />
          <rect x={39} y={19} width={20} height={18} rx={2} fill="#0f172a" stroke="#cbd5e1" />
          <text x={50} y={15} textAnchor="middle" fontSize="7.5" fill="#fff" fontWeight={700}>MPU-6050 · {comp.props.tiltDeg ?? 0}°</text>
          <foreignObject className="iot-interactive-control" x={12} y={43} width={78} height={18}>
            <input
              type="range"
              min={-90}
              max={90}
              value={comp.props.tiltDeg ?? 0}
              onChange={(e) => onUpdateProps(comp.id, { tiltDeg: Number(e.target.value) })}
              style={{ width: 76 }}
              title="Sudut kemiringan MPU-6050"
            />
          </foreignObject>
        </g>
      )
    case 'bmp180':
      return (
        <g>
          <rect x={4} y={6} width={86} height={58} rx={5} fill="#0369a1" stroke="#7dd3fc" strokeWidth={1.4} />
          <rect x={35} y={22} width={24} height={22} rx={3} fill="#e2e8f0" stroke="#475569" />
          <circle cx={47} cy={33} r={2.5} fill="#0f172a" />
          <text x={47} y={56} textAnchor="middle" fontSize="7.5" fill="#fff" fontWeight={700}>{comp.props.pressureHpa ?? 1013} hPa</text>
        </g>
      )
    case 'rfid-rc522':
      return (
        <g>
          <rect x={4} y={6} width={98} height={70} rx={6} fill="#1d4ed8" stroke="#60a5fa" strokeWidth={1.5} />
          <circle cx={53} cy={34} r={18} fill="none" stroke="#93c5fd" strokeWidth={1.8} strokeDasharray="4 2" />
          <text x={53} y={28} textAnchor="middle" fontSize="7" fontWeight={700} fill="#fff">RC522</text>
          <foreignObject className="iot-interactive-control" x={18} y={51} width={70} height={18}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onUpdateProps(comp.id, { rfidUid: comp.props.rfidUid ? null : 'E3 9A 4B 12' })
              }}
              style={{ width: '100%', fontSize: 8.5, fontWeight: 700, borderRadius: 4, border: 0, cursor: 'pointer', background: comp.props.rfidUid ? '#16a34a' : '#e2e8f0', color: comp.props.rfidUid ? '#fff' : '#0f172a' }}
            >
              {comp.props.rfidUid ? 'UID: E39A' : 'Tap RFID'}
            </button>
          </foreignObject>
        </g>
      )
    case 'rtc-ds1307':
      return (
        <g>
          <rect x={4} y={6} width={88} height={58} rx={5} fill="#1e40af" stroke="#60a5fa" strokeWidth={1.4} />
          <circle cx={34} cy={34} r={16} fill="#cbd5e1" stroke="#475569" strokeWidth={1.4} />
          <text x={34} y={37} textAnchor="middle" fontSize="6.5" fontWeight={700} fill="#334155">CR2032</text>
          <rect x={58} y={24} width={22} height={20} rx={2} fill="#0f172a" />
          <text x={69} y={56} textAnchor="middle" fontSize="7" fill="#fff" fontWeight={700}>DS1307</text>
        </g>
      )
    case 'slide-pot': {
      const pct = comp.props.potPct ?? 50
      const kx = 18 + (pct / 100) * 76
      return (
        <g>
          <rect x={6} y={8} width={100} height={36} rx={5} fill="#0284c7" stroke="#7dd3fc" strokeWidth={1.3} />
          <rect x={16} y={22} width={80} height={8} rx={3} fill="#0f172a" />
          <rect
            className="iot-interactive-control"
            x={kx - 7}
            y={14}
            width={14}
            height={24}
            rx={3}
            fill="#f8fafc"
            stroke="#334155"
            strokeWidth={1.5}
            style={{ cursor: 'ew-resize' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              const sx = e.clientX
              const sVal = comp.props.potPct ?? 50
              const onMove = (ev: PointerEvent) => {
                onUpdateProps(comp.id, { potPct: Math.max(0, Math.min(100, Math.round(sVal + (ev.clientX - sx) * 1.1))) })
              }
              const onUp = () => {
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
              }
              window.addEventListener('pointermove', onMove)
              window.addEventListener('pointerup', onUp)
            }}
          />
          <text x={56} y={19} textAnchor="middle" fontSize="6.5" fill="#e0f2fe" fontWeight={700}>{pct}%</text>
        </g>
      )
    }
    case 'rotary-encoder': {
      const step = comp.props.encoderStep ?? 0
      return (
        <g>
          <rect x={6} y={6} width={80} height={64} rx={6} fill="#1e293b" stroke="#64748b" strokeWidth={1.4} />
          <circle cx={46} cy={32} r={17} fill="#cbd5e1" stroke="#475569" strokeWidth={2} />
          <line
            x1={46}
            y1={32}
            x2={46 + 12 * Math.cos((step * 30 - 90) * (Math.PI / 180))}
            y2={32 + 12 * Math.sin((step * 30 - 90) * (Math.PI / 180))}
            stroke="#0f172a"
            strokeWidth={3}
          />
          <foreignObject className="iot-interactive-control" x={12} y={50} width={68} height={18}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <button type="button" onClick={() => onUpdateProps(comp.id, { encoderStep: step - 1 })} style={{ flex: 1, fontSize: 8.5, fontWeight: 700, border: 0, borderRadius: 3, cursor: 'pointer' }}>↺</button>
              <button type="button" onClick={() => onUpdateProps(comp.id, { pressed: !comp.props.pressed })} style={{ flex: 1, fontSize: 7.5, fontWeight: 700, border: 0, borderRadius: 3, cursor: 'pointer', background: comp.props.pressed ? '#16a34a' : '#e2e8f0' }}>SW</button>
              <button type="button" onClick={() => onUpdateProps(comp.id, { encoderStep: step + 1 })} style={{ flex: 1, fontSize: 8.5, fontWeight: 700, border: 0, borderRadius: 3, cursor: 'pointer' }}>↻</button>
            </div>
          </foreignObject>
        </g>
      )
    }
    case 'keypad-4x4': {
      const keys = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D']
      return (
        <g>
          <rect x={4} y={4} width={104} height={106} rx={6} fill="#1e293b" stroke="#475569" strokeWidth={1.5} />
          <foreignObject className="iot-interactive-control" x={10} y={10} width={92} height={94}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
              {keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateProps(comp.id, { lastKey: k, encoderStep: (comp.props.encoderStep ?? 0) + 1 })
                  }}
                  style={{
                    height: 20,
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: 3,
                    border: 0,
                    cursor: 'pointer',
                    background: comp.props.lastKey === k ? '#2563eb' : /[A-D*#]/.test(k) ? '#b91c1c' : '#3b82f6',
                    color: '#fff',
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          </foreignObject>
        </g>
      )
    }
    case 'dip-switch': {
      const bits = comp.props.dipBits ?? [0, 0, 0, 0, 0, 0, 0, 0]
      return (
        <g>
          <rect x={4} y={8} width={104} height={44} rx={4} fill="#b91c1c" stroke="#7f1d1d" strokeWidth={1.5} />
          {bits.map((b, i) => (
            <g
              key={i}
              className="iot-interactive-control"
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                const next = bits.map((v, idx) => (idx === i ? (v ? 0 : 1) : v))
                onUpdateProps(comp.id, { dipBits: next })
              }}
            >
              <rect x={11 + i * 11.5} y={14} width={8} height={26} rx={1} fill="#7f1d1d" />
              <rect x={12 + i * 11.5} y={b ? 15 : 27} width={6} height={11} rx={1} fill="#f8fafc" />
            </g>
          ))}
        </g>
      )
    }
    case 'ir-receiver':
      return (
        <g>
          <rect x={14} y={10} width={44} height={44} rx={5} fill="#0f172a" stroke="#64748b" />
          <circle cx={36} cy={30} r={11} fill="#334155" stroke="#94a3b8" />
          <text x={36} y={48} textAnchor="middle" fontSize="6.5" fill="#cbd5e1">38kHz</text>
        </g>
      )
    case 'ir-remote':
      return (
        <g>
          <rect x={6} y={6} width={72} height={100} rx={10} fill="#18181b" stroke="#52525b" strokeWidth={1.5} />
          <circle cx={42} cy={14} r={3.5} fill="#ef4444" />
          <foreignObject className="iot-interactive-control" x={12} y={22} width={60} height={78}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {['PWR', 'UP', 'OK', '1', '2', '3', '4', '5', '6'].map((btn) => (
                <button
                  key={btn}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateProps(comp.id, { irHex: `0xFF_${btn}` })
                  }}
                  style={{ height: 22, fontSize: 7.5, fontWeight: 700, border: 0, borderRadius: 3, cursor: 'pointer', background: btn === 'PWR' ? '#dc2626' : '#3f3f46', color: '#fff' }}
                >
                  {btn}
                </button>
              ))}
            </div>
          </foreignObject>
        </g>
      )
    case 'seven-seg': {
      const custom = sim.sevenSegText[comp.id]
      const val = sim.running ? (sim.elapsedMs / 500) % 10 : 8
      const shown = custom ? custom.slice(0, 1) : String(Math.floor(val))
      const segColor =
        comp.color === 'green' ? '#22c55e' : comp.color === 'blue' ? '#38bdf8' : comp.color === 'yellow' ? '#facc15' : comp.color === 'white' ? '#f8fafc' : '#ef4444'
      return (
        <g>
          <rect x={6} y={6} width={56} height={66} rx={5} fill="#09090b" stroke="#52525b" strokeWidth={1.6} />
          <text x={34} y={54} textAnchor="middle" fontSize="38" fontFamily="monospace" fontWeight={800} fill={segColor}>
            {shown}
          </text>
          <text x={34} y={16} textAnchor="middle" fontSize="5.5" fill="#94a3b8">
            {comp.props.common === 'cathode' ? 'CC' : 'CA'}
          </text>
        </g>
      )
    }
    case 'seven-seg-4': {
      const custom = sim.sevenSegText[comp.id]
      const secs = Math.floor((sim.elapsedMs || 0) / 1000) % 10000
      const str = custom ? custom.padStart(4, ' ').slice(0, 5) : String(secs).padStart(4, '0')
      const segColor =
        comp.color === 'green' ? '#22c55e' : comp.color === 'blue' ? '#38bdf8' : comp.color === 'yellow' ? '#facc15' : comp.color === 'white' ? '#f8fafc' : '#ef4444'
      const sep = comp.props.tmType === 'dp' ? '.' : ':'
      const displayStr = custom ? custom : `${str.slice(0, 2)}${sep}${str.slice(2)}`
      return (
        <g>
          <rect x={4} y={8} width={116} height={54} rx={5} fill="#09090b" stroke="#475569" strokeWidth={1.5} />
          <text x={62} y={45} textAnchor="middle" fontSize="24" fontFamily="monospace" fontWeight={800} fill={segColor} letterSpacing="2">
            {displayStr}
          </text>
        </g>
      )
    }
    case 'led-bar-graph': {
      const litCount = sim.running ? (Math.floor(sim.elapsedMs / 250) % 10) + 1 : 6
      const modeClr = comp.color ?? 'GYR'
      return (
        <g>
          <rect x={4} y={10} width={104} height={38} rx={4} fill="#0f172a" stroke="#475569" />
          {Array.from({ length: 10 }, (_, i) => {
            const on = i < litCount
            const c =
              modeClr === 'BCYR'
                ? i < 3 ? '#3b82f6' : i < 6 ? '#06b6d4' : i < 8 ? '#eab308' : '#ef4444'
                : modeClr === 'GYR'
                  ? i < 6 ? '#22c55e' : i < 8 ? '#eab308' : '#ef4444'
                  : modeClr === 'green' ? '#22c55e' : modeClr === 'yellow' ? '#facc15' : modeClr === 'blue' ? '#38bdf8' : '#ef4444'
            return <rect key={i} x={10 + i * 9.5} y={16} width={6.5} height={26} rx={1} fill={on ? c : '#1e293b'} />
          })}
        </g>
      )
    }
    case 'neopixel-ring': {
      const count = comp.props.ringPixels ?? 12
      const step = Math.floor((sim.elapsedMs || 0) / 220) % count
      const colors = ['#ef4444', '#f59e0b', '#22c55e', '#38bdf8', '#8b5cf6', '#ec4899']
      return (
        <g>
          <circle cx={48} cy={44} r={36} fill="#0f172a" stroke="#475569" strokeWidth={1.5} />
          <circle cx={48} cy={44} r={18} fill="none" stroke="#334155" strokeWidth={1.2} />
          {Array.from({ length: count }, (_, i) => {
            const ang = (i / count) * Math.PI * 2 - Math.PI / 2
            const cx = 48 + Math.cos(ang) * 27
            const cy = 44 + Math.sin(ang) * 27
            const clr = sim.running ? colors[(i + step) % colors.length] : '#e2e8f0'
            return <circle key={i} cx={cx} cy={cy} r={count > 16 ? 2.7 : 3.8} fill={clr} />
          })}
        </g>
      )
    }
    case 'neopixel-strip': {
      const step = Math.floor((sim.elapsedMs || 0) / 220) % 8
      const colors = ['#ef4444', '#f59e0b', '#22c55e', '#38bdf8', '#a855f7']
      return (
        <g>
          <rect x={4} y={12} width={136} height={24} rx={4} fill="#0f172a" stroke="#475569" />
          {Array.from({ length: 8 }, (_, i) => (
            <rect
              key={i}
              x={11 + i * 16}
              y={17}
              width={10}
              height={14}
              rx={2}
              fill={sim.running ? colors[(i + step) % colors.length] : '#cbd5e1'}
            />
          ))}
        </g>
      )
    }
    case 'lcd-20x4': {
      const isBlue = comp.props.lcdBackground === 'blue'
      const bgFill = isBlue ? '#1d4ed8' : '#84cc16'
      const fgFill = comp.props.lcdTextColor === 'white' || isBlue ? '#f8fafc' : '#1a2e05'
      const addr = comp.props.i2cAddress ?? '0x27'
      const rows = sim.lcdRows[comp.id] ?? [
        `LCD 20x4 ${comp.props.lcdPins === 'full' ? 'PAR' : 'I2C'} (${addr})`,
        'Menunggu output...',
        '',
        '',
      ]
      return (
        <g>
          <rect x={4} y={4} width={142} height={76} rx={5} fill="#0f766e" stroke="#115e59" strokeWidth={1.5} />
          <rect x={10} y={12} width={130} height={58} rx={3} fill={bgFill} stroke="#1e293b" strokeWidth={2} />
          {rows.slice(0, 4).map((line, r) => (
            <text key={r} x={15} y={24 + r * 12} fontSize="7.5" fontFamily="monospace" fontWeight={700} fill={fgFill}>
              {line}
            </text>
          ))}
        </g>
      )
    }
    case 'tft-ili9341':
      return (
        <g>
          <rect x={4} y={4} width={116} height={84} rx={6} fill="#b91c1c" stroke="#f87171" strokeWidth={1.4} />
          <rect x={12} y={12} width={100} height={66} rx={3} fill="#020617" stroke="#334155" />
          <rect x={18} y={18} width={88} height={14} rx={2} fill="#2563eb" />
          <text x={62} y={28} textAnchor="middle" fontSize="7.5" fill="#fff" fontWeight={700}>ILI9341 TFT</text>
          <text x={62} y={52} textAnchor="middle" fontSize="8" fill="#38bdf8" fontFamily="monospace">
            {sim.running ? `LIVE ${Math.round(sim.elapsedMs / 1000)}s` : '320×240 SPI'}
          </text>
        </g>
      )
    case 'slide-switch': {
      const on = Boolean(comp.props.latched || comp.props.pressed)
      return (
        <g
          className="iot-interactive-control"
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.stopPropagation()
            onUpdateProps(comp.id, { latched: !on, pressed: !on })
          }}
        >
          <rect x={8} y={8} width={56} height={30} rx={4} fill="#334155" stroke="#64748b" strokeWidth={1.4} />
          <rect x={14} y={14} width={44} height={18} rx={3} fill="#0f172a" />
          <rect x={on ? 38 : 16} y={15} width={18} height={16} rx={2} fill={on ? '#22c55e' : '#e2e8f0'} />
          <text x={36} y={36} textAnchor="middle" fontSize="6.5" fill="#cbd5e1" fontWeight={700}>
            {on ? 'ON' : 'OFF'}
          </text>
        </g>
      )
    }
    case 'joystick': {
      const jx = comp.props.joyX ?? 512
      const jy = comp.props.joyY ?? 512
      const ox = ((jx - 512) / 512) * 14
      const oy = ((jy - 512) / 512) * 14
      return (
        <g>
          <rect x={6} y={6} width={84} height={74} rx={6} fill="#1e293b" stroke="#64748b" strokeWidth={1.5} />
          <circle cx={48} cy={42} r={24} fill="#0f172a" stroke="#475569" strokeWidth={1.5} />
          <circle
            className="iot-interactive-control"
            cx={48 + ox}
            cy={42 + oy}
            r={13}
            fill="#334155"
            stroke="#94a3b8"
            strokeWidth={1.5}
            style={{ cursor: 'move' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              const sx = e.clientX
              const sy = e.clientY
              const onMove = (ev: PointerEvent) => {
                const dx = Math.max(-24, Math.min(24, ev.clientX - sx))
                const dy = Math.max(-24, Math.min(24, ev.clientY - sy))
                onUpdateProps(comp.id, {
                  joyX: Math.round(512 + (dx / 24) * 511),
                  joyY: Math.round(512 + (dy / 24) * 511),
                })
              }
              const onUp = () => {
                onUpdateProps(comp.id, { joyX: 512, joyY: 512 })
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
              }
              window.addEventListener('pointermove', onMove)
              window.addEventListener('pointerup', onUp)
            }}
          />
          <circle cx={48 + ox} cy={42 + oy} r={6} fill="#0284c7" style={{ pointerEvents: 'none' }} />
        </g>
      )
    }
    case 'hx711':
      return (
        <g>
          <rect x={6} y={8} width={96} height={52} rx={5} fill="#059669" stroke="#34d399" strokeWidth={1.4} />
          <rect x={18} y={16} width={72} height={24} rx={3} fill="#e2e8f0" stroke="#64748b" />
          <text x={54} y={32} textAnchor="middle" fontSize="9.5" fontWeight={700} fill="#0f172a">
            {((comp.props.weightKg ?? 1.2)).toFixed(1)} kg
          </text>
          <text x={54} y={53} textAnchor="middle" fontSize="6.5" fill="#ecfdf5" fontWeight={700}>
            HX711 ({comp.props.hxType ?? '50kg'})
          </text>
        </g>
      )
    case 'max7219-matrix': {
      const tick = Math.floor((sim.elapsedMs || 0) / 300)
      const customRows = sim.matrixRows[comp.id]
      const litClr = comp.color === 'green' ? '#22c55e' : comp.color === 'blue' ? '#38bdf8' : comp.color === 'orange' ? '#f97316' : '#ef4444'
      const offClr = comp.color === 'green' ? '#14532d' : comp.color === 'blue' ? '#0c4a6e' : '#3f1d1d'
      return (
        <g>
          <rect x={6} y={6} width={86} height={76} rx={5} fill="#18181b" stroke="#52525b" strokeWidth={1.5} />
          {Array.from({ length: 8 }, (_, r) =>
            Array.from({ length: 8 }, (__, c) => {
              const on = customRows
                ? Boolean((customRows[r] ?? 0) & (1 << (7 - c)))
                : sim.running
                  ? (r + c + tick) % 3 === 0
                  : r === c || r + c === 7
              return <circle key={`${r}-${c}`} cx={16 + c * 9.2} cy={14 + r * 8.2} r={2.8} fill={on ? litClr : offClr} />
            }),
          )}
        </g>
      )
    }
    case 'stepper': {
      const angle = sim.running ? ((sim.elapsedMs || 0) / 18) % 360 : 0
      return (
        <g>
          <rect x={10} y={8} width={76} height={74} rx={8} fill="#1e293b" stroke="#64748b" strokeWidth={1.6} />
          <circle cx={48} cy={45} r={26} fill="#cbd5e1" stroke="#475569" strokeWidth={1.8} />
          <g transform={`translate(48, 45) rotate(${angle})`}>
            <circle cx={0} cy={0} r={9} fill="#334155" />
            <rect x={-3} y={-20} width={6} height={20} rx={2} fill="#f97316" />
          </g>
        </g>
      )
    }
    case 'shift-74hc595':
    case 'shift-74hc165':
      return (
        <g>
          <rect x={10} y={16} width={92} height={44} rx={4} fill="#18181b" stroke="#64748b" strokeWidth={1.5} />
          <circle cx={18} cy={38} r={4} fill="#334155" />
          <text x={56} y={36} textAnchor="middle" fontSize="8.5" fontWeight={700} fill="#e2e8f0">
            {comp.kind === 'shift-74hc595' ? '74HC595' : '74HC165'}
          </text>
          <text x={56} y={48} textAnchor="middle" fontSize="6" fill="#94a3b8">
            {comp.kind === 'shift-74hc595' ? '8-Bit SIPO' : '8-Bit PISO'}
          </text>
        </g>
      )
    case 'stepper-a4988':
      return (
        <g>
          <rect x={22} y={8} width={52} height={72} rx={5} fill="#b91c1c" stroke="#f87171" strokeWidth={1.4} />
          <rect x={32} y={24} width={32} height={32} rx={3} fill="#0f172a" stroke="#94a3b8" />
          <circle cx={48} cy={66} r={5} fill="#eab308" />
          <text x={48} y={43} textAnchor="middle" fontSize="7" fontWeight={700} fill="#e2e8f0">A4988</text>
        </g>
      )
    case 'microsd':
      return (
        <g>
          <rect x={10} y={8} width={82} height={58} rx={5} fill="#0369a1" stroke="#38bdf8" strokeWidth={1.4} />
          <rect x={24} y={12} width={54} height={38} rx={2} fill="#cbd5e1" stroke="#475569" />
          <text x={51} y={34} textAnchor="middle" fontSize="8" fontWeight={700} fill="#0f172a">microSD</text>
        </g>
      )
    case 'lcd-nokia5110':
      return (
        <g>
          <rect x={8} y={6} width={102} height={74} rx={5} fill="#be123c" stroke="#fb7185" strokeWidth={1.5} />
          <rect x={16} y={14} width={86} height={54} rx={3} fill="#84a98c" stroke="#1e293b" strokeWidth={1.6} />
          <text x={59} y={38} textAnchor="middle" fontSize="8.5" fontWeight={700} fill="#0f172a" fontFamily="monospace">NOKIA 5110</text>
          <text x={59} y={51} textAnchor="middle" fontSize="7" fill="#1e293b" fontFamily="monospace">84×48 PCD8544</text>
        </g>
      )
    case 'neopixel-single': {
      const tick = Math.floor((sim.elapsedMs || 0) / 300) % 4
      const clrs = ['#ef4444', '#22c55e', '#38bdf8', '#a855f7']
      return (
        <g>
          <rect x={12} y={10} width={48} height={44} rx={5} fill="#0f172a" stroke="#64748b" strokeWidth={1.4} />
          <rect x={22} y={18} width={28} height={28} rx={4} fill="#e2e8f0" />
          <circle cx={36} cy={32} r={8} fill={sim.running ? clrs[tick] : '#38bdf8'} />
        </g>
      )
    }
    case 'clock-gen':
      return (
        <g>
          <rect x={10} y={8} width={72} height={46} rx={5} fill="#1e293b" stroke="#64748b" strokeWidth={1.4} />
          <path d="M 22 36 H 32 V 22 H 44 V 36 H 56 V 22 H 68" fill="none" stroke="#22c55e" strokeWidth={2.2} />
          <text x={46} y={48} textAnchor="middle" fontSize="6.5" fontWeight={700} fill="#cbd5e1">CLK 1Hz</text>
        </g>
      )
    default:
      return null
  }
}

export function WokwiPartThumbnail({ kind }: { kind: ComponentKind }) {
  switch (kind) {
    case 'mq2':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={18} y={8} width={44} height={40} rx={5} fill="#991b1b" />
          <circle cx={40} cy={28} r={14} fill="#94a3b8" stroke="#475569" strokeWidth={2} />
        </svg>
      )
    case 'ds18b20':
    case 'ntc':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <path d="M 28 36 V 18 A 12 10 0 0 1 52 18 V 36 Z" fill={kind === 'ntc' ? '#b91c1c' : '#1e293b'} />
          <line x1={32} y1={36} x2={32} y2={50} stroke="#94a3b8" strokeWidth={2.5} />
          <line x1={40} y1={36} x2={40} y2={50} stroke="#94a3b8" strokeWidth={2.5} />
          <line x1={48} y1={36} x2={48} y2={50} stroke="#94a3b8" strokeWidth={2.5} />
        </svg>
      )
    case 'mpu6050':
    case 'bmp180':
    case 'rfid-rc522':
    case 'rtc-ds1307':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={16} y={10} width={48} height={36} rx={4} fill="#1d4ed8" />
          <rect x={31} y={19} width={18} height={18} rx={2} fill="#0f172a" stroke="#93c5fd" />
        </svg>
      )
    case 'slide-pot':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={12} y={16} width={56} height={24} rx={4} fill="#0284c7" />
          <rect x={18} y={26} width={44} height={4} fill="#0f172a" />
          <rect x={36} y={19} width={10} height={18} rx={2} fill="#f8fafc" />
        </svg>
      )
    case 'rotary-encoder':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={18} y={10} width={44} height={36} rx={4} fill="#1e293b" />
          <circle cx={40} cy={28} r={12} fill="#cbd5e1" stroke="#475569" strokeWidth={2} />
        </svg>
      )
    case 'keypad-4x4':
    case 'ir-remote':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={20} y={6} width={40} height={44} rx={4} fill="#1e293b" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <rect key={`${r}-${c}`} x={26 + c * 10} y={12 + r * 10} width={7} height={7} rx={1} fill="#3b82f6" />
            )),
          )}
        </svg>
      )
    case 'dip-switch':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={14} y={14} width={52} height={28} rx={3} fill="#b91c1c" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={19 + i * 9} y={19} width={5} height={18} fill="#f8fafc" />
          ))}
        </svg>
      )
    case 'ir-receiver':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={24} y={10} width={32} height={32} rx={4} fill="#0f172a" />
          <circle cx={40} cy={26} r={9} fill="#334155" />
        </svg>
      )
    case 'seven-seg':
    case 'seven-seg-4':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={14} y={12} width={52} height={32} rx={4} fill="#09090b" />
          <text x={40} y={36} textAnchor="middle" fontSize="18" fontFamily="monospace" fontWeight={800} fill="#ef4444">88</text>
        </svg>
      )
    case 'led-bar-graph':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={14} y={14} width={52} height={28} rx={4} fill="#0f172a" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={19 + i * 7.5} y={19} width={5} height={18} rx={1} fill={i < 4 ? '#22c55e' : '#ef4444'} />
          ))}
        </svg>
      )
    case 'neopixel-ring':
    case 'neopixel-strip':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <circle cx={40} cy={28} r={18} fill="#0f172a" />
          {['#ef4444', '#f59e0b', '#22c55e', '#38bdf8', '#8b5cf6', '#ec4899'].map((c, i) => {
            const a = (i / 6) * Math.PI * 2
            return <circle key={i} cx={40 + Math.cos(a) * 12} cy={28 + Math.sin(a) * 12} r={3} fill={c} />
          })}
        </svg>
      )
    case 'lcd-20x4':
    case 'tft-ili9341':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={10} y={10} width={60} height={36} rx={4} fill={kind === 'tft-ili9341' ? '#b91c1c' : '#0f766e'} />
          <rect x={16} y={16} width={48} height={24} rx={2} fill={kind === 'tft-ili9341' ? '#020617' : '#84cc16'} />
        </svg>
      )
    case 'slide-switch':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={18} y={16} width={44} height={22} rx={3} fill="#334155" />
          <rect x={24} y={20} width={14} height={14} rx={2} fill="#22c55e" />
        </svg>
      )
    case 'joystick':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={18} y={8} width={44} height={40} rx={5} fill="#1e293b" />
          <circle cx={40} cy={28} r={14} fill="#0f172a" stroke="#64748b" />
          <circle cx={40} cy={28} r={7} fill="#0284c7" />
        </svg>
      )
    case 'hx711':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={14} y={12} width={52} height={32} rx={4} fill="#059669" />
          <rect x={22} y={18} width={36} height={16} rx={2} fill="#e2e8f0" />
        </svg>
      )
    case 'max7219-matrix':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={18} y={8} width={44} height={40} rx={4} fill="#18181b" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => <circle key={`${r}-${c}`} cx={28 + c * 8} cy={16 + r * 8} r={2.3} fill="#ef4444" />),
          )}
        </svg>
      )
    case 'stepper':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={20} y={8} width={40} height={40} rx={5} fill="#1e293b" />
          <circle cx={40} cy={28} r={13} fill="#cbd5e1" />
          <circle cx={40} cy={28} r={4} fill="#f97316" />
        </svg>
      )
    case 'shift-74hc595':
    case 'shift-74hc165':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={14} y={14} width={52} height={28} rx={3} fill="#18181b" />
          <text x={40} y={31} textAnchor="middle" fontSize="9" fontWeight={700} fill="#e2e8f0">
            {kind === 'shift-74hc595' ? '595' : '165'}
          </text>
        </svg>
      )
    case 'stepper-a4988':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={22} y={8} width={36} height={40} rx={4} fill="#b91c1c" />
          <rect x={30} y={16} width={20} height={20} rx={2} fill="#0f172a" />
        </svg>
      )
    case 'microsd':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={16} y={10} width={48} height={36} rx={4} fill="#0369a1" />
          <rect x={24} y={14} width={32} height={22} rx={2} fill="#cbd5e1" />
        </svg>
      )
    case 'lcd-nokia5110':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={14} y={10} width={52} height={36} rx={4} fill="#be123c" />
          <rect x={20} y={15} width={40} height={26} rx={2} fill="#84a98c" />
        </svg>
      )
    case 'neopixel-single':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={22} y={10} width={36} height={36} rx={4} fill="#0f172a" />
          <circle cx={40} cy={28} r={9} fill="#38bdf8" />
        </svg>
      )
    case 'clock-gen':
      return (
        <svg viewBox="0 0 80 56" width="100%" height="56" aria-hidden="true">
          <rect x={16} y={12} width={48} height={32} rx={4} fill="#1e293b" />
          <path d="M 24 34 H 32 V 22 H 42 V 34 H 52" fill="none" stroke="#22c55e" strokeWidth={2.2} />
        </svg>
      )
    default:
      return null
  }
}
