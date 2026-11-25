// Small physical displays on the rear bench. Everything uses the room's animation clock
// and rotates across distinct visual themes so adjacent monitors and oscilloscopes stay varied.

export const REAR_MONITOR_THEME_COUNT = 5
export const REAR_SCOPE_THEME_COUNT = 5

const MONITOR_THEME_PERIOD = 6.0
const SCOPE_THEME_PERIOD = 5.5

export function rearMonitorThemeAt(t: number, channel: number): number {
  return (Math.floor(Math.max(0, t) / MONITOR_THEME_PERIOD) + channel * 2) % REAR_MONITOR_THEME_COUNT
}

export function rearScopeThemeAt(t: number, channel: number): number {
  return (Math.floor(Math.max(0, t) / SCOPE_THEME_PERIOD) + channel * 2) % REAR_SCOPE_THEME_COUNT
}

function transitionFlash(ctx: CanvasRenderingContext2D, w: number, h: number, localTime: number) {
  if (localTime < 0.32) {
    const p = localTime / 0.32
    ctx.fillStyle = `rgba(210, 248, 255, ${(1 - p) * 0.16})`
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = `rgba(255, 255, 255, ${(1 - p) * 0.28})`
    ctx.fillRect(0, p * h, w, 3)
  }
}

export function createRearInstruments() {
  const scope = document.createElement('canvas')
  scope.width = 180
  scope.height = 112
  const monitor = document.createElement('canvas')
  monitor.width = 288
  monitor.height = 164
  const scopeCtx = scope.getContext('2d')!
  const monitorCtx = monitor.getContext('2d')!

  function drawScopeGrid(ctx: CanvasRenderingContext2D, bg: string, grid: string) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, 180, 112)
    ctx.strokeStyle = grid
    ctx.lineWidth = 0.7
    for (let x = 12; x < 180; x += 24) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 112)
      ctx.stroke()
    }
    for (let y = 12; y < 112; y += 22) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(180, y)
      ctx.stroke()
    }
  }

  function drawScope(t: number, channel: number) {
    const ctx = scopeCtx
    const theme = rearScopeThemeAt(t, channel)
    const localTime = Math.max(0, t) % SCOPE_THEME_PERIOD

    if (theme === 0) {
      // Classic green phosphor dual-trace harmonic sine
      drawScopeGrid(ctx, '#092014', '#24482c')
      for (let trace = 0; trace < 2; trace++) {
        ctx.strokeStyle = trace ? '#6aa74a' : '#95ef5a'
        ctx.lineWidth = trace ? 1 : 2
        ctx.beginPath()
        for (let x = 0; x <= 180; x += 2) {
          const phase = x * (0.12 + channel * 0.012) - t * (3.2 + channel * 0.4)
          const signal = trace
            ? Math.sin(phase * 0.48 + 0.7) * 13
            : Math.sin(phase) * 23 + Math.sin(phase * 2.1) * 5
          const y = 55 + signal
          if (!x) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.fillStyle = '#b3fa7522'
      ctx.fillRect((t * 48 + channel * 33) % 190 - 10, 0, 8, 112)
    } else if (theme === 1) {
      // Digital PWM / UART square pulse train (electric cyan)
      drawScopeGrid(ctx, '#071824', '#183d54')
      const lanes = [
        { base: 34, amp: 14, color: '#38e8ff', freq: 0.11, duty: 0.45 + Math.sin(t * 1.1 + channel) * 0.25 },
        { base: 80, amp: 14, color: '#7dd3fc', freq: 0.18, duty: 0.5 },
      ]
      for (const lane of lanes) {
        ctx.strokeStyle = lane.color
        ctx.lineWidth = 1.8
        ctx.beginPath()
        for (let x = 0; x <= 180; x += 2) {
          const cycle = ((x * lane.freq - t * (2.6 + channel * 0.35)) % 1 + 1) % 1
          const high = cycle < lane.duty
          const y = lane.base + (high ? -lane.amp : lane.amp)
          if (!x) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.fillStyle = '#38e8ff26'
      ctx.fillRect((t * 54 + channel * 41) % 190 - 10, 0, 6, 112)
    } else if (theme === 2) {
      // Lissajous XY phase plot (amber/gold phosphor)
      drawScopeGrid(ctx, '#1b1307', '#423015')
      ctx.strokeStyle = '#6b4c1d'
      ctx.lineWidth = 0.9
      ctx.beginPath()
      ctx.moveTo(90, 6)
      ctx.lineTo(90, 106)
      ctx.moveTo(10, 56)
      ctx.lineTo(170, 56)
      ctx.stroke()

      const a = 3
      const b = 2 + (channel % 2)
      const delta = t * 1.15 + channel * 0.9
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 1.9
      ctx.beginPath()
      for (let i = 0; i <= 160; i++) {
        const p = (i / 160) * Math.PI * 2
        const x = 90 + Math.sin(a * p + delta) * 62
        const y = 56 + Math.sin(b * p) * 38
        if (!i) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      const headP = (t * 2.4) % (Math.PI * 2)
      ctx.fillStyle = '#fef08a'
      ctx.beginPath()
      ctx.arc(90 + Math.sin(a * headP + delta) * 62, 56 + Math.sin(b * headP) * 38, 3.2, 0, Math.PI * 2)
      ctx.fill()
    } else if (theme === 3) {
      // RF FFT spectrum analyzer (magenta / violet)
      drawScopeGrid(ctx, '#170a21', '#381d4d')
      const bins = 18
      for (let i = 0; i < bins; i++) {
        const center = Math.exp(-(((i - (8 + Math.sin(t * 0.9 + channel) * 3.5)) / 3.4) ** 2))
        const jitter = 0.25 + 0.75 * Math.abs(Math.sin(t * 3.1 + i * 0.9 + channel))
        const h = Math.max(6, Math.round((center * 68 + jitter * 20) * 0.95))
        const x = 8 + i * 9.2
        ctx.fillStyle = i % 2 ? '#c084fc' : '#f472b6'
        ctx.fillRect(x, 104 - h, 6.5, h)
        ctx.fillStyle = '#fdf4ff'
        ctx.fillRect(x, 101 - h, 6.5, 2)
      }
    } else {
      // Sensor impulse / heartbeat & sawtooth ramp (coral / orange)
      drawScopeGrid(ctx, '#1e0d0b', '#47211d')
      ctx.strokeStyle = '#fb923c'
      ctx.lineWidth = 1.1
      ctx.beginPath()
      for (let x = 0; x <= 180; x += 3) {
        const saw = ((((x * 0.035 - t * 0.9 + channel * 0.3) % 1) + 1) % 1) * 2 - 1
        const y = 78 + saw * 14
        if (!x) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      ctx.strokeStyle = '#ff6b57'
      ctx.lineWidth = 2.1
      ctx.beginPath()
      for (let x = 0; x <= 180; x += 2) {
        const phase = (((x * 0.018 - t * 0.75 + channel * 0.37) % 1) + 1) % 1
        let spike = 0
        if (phase > 0.42 && phase < 0.46) spike = 9
        else if (phase >= 0.46 && phase < 0.50) spike = -34
        else if (phase >= 0.50 && phase < 0.54) spike = 15
        else if (phase >= 0.62 && phase < 0.72) spike = -7 * Math.sin(((phase - 0.62) / 0.1) * Math.PI)
        const y = 52 + spike
        if (!x) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    transitionFlash(ctx, 180, 112, localTime)
    return scope
  }

  function drawMonitor(t: number, channel: number, network: number) {
    const ctx = monitorCtx
    const moving = network > 0 ? t : t * 0.35
    const theme = rearMonitorThemeAt(t, channel)
    const localTime = Math.max(0, t) % MONITOR_THEME_PERIOD

    if (theme === 0) {
      // Signal & packet spectrum monitor (cyan/teal)
      ctx.fillStyle = '#071c26'
      ctx.fillRect(0, 0, 288, 164)
      ctx.fillStyle = '#174454'
      ctx.fillRect(0, 0, 288, 14)
      ctx.fillRect(0, 148, 288, 16)
      ctx.fillStyle = '#67e8f9'
      ctx.font = 'bold 8.5px sans-serif'
      ctx.fillText(channel ? 'PACKET TELEMETRY' : 'SIGNAL MONITOR', 8, 10)
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i % 3 ? '#27717d' : '#5298a3'
        ctx.fillRect(7, 22 + i * 11, 13 + ((i * 17 + Math.floor(moving * 2)) % 4) * 5, 3)
      }
      ctx.strokeStyle = '#244654'
      ctx.lineWidth = 0.6
      for (let y = 30; y < 145; y += 28) {
        ctx.beginPath()
        ctx.moveTo(48, y)
        ctx.lineTo(280, y)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(48, 104)
      for (let x = 0; x <= 232; x += 2) {
        const peak = Math.max(0, Math.sin(x * 0.115 - moving * 1.7 + channel)) ** 6
        const y = network === 0 ? 101 : 101 - peak * (22 + network * 0.32) - Math.sin(x * 0.2 + moving * 1.2) * 3
        ctx.lineTo(48 + x, y)
      }
      ctx.lineTo(280, 106)
      ctx.closePath()
      ctx.fillStyle = '#249ba9'
      ctx.fill()
      for (let i = 0; i < 23; i++) {
        const height = network === 0 ? 2 : 3 + (Math.sin(i * 0.8 + moving * 1.3 + channel) + 1) * 9
        ctx.fillStyle = '#51c6c4'
        ctx.fillRect(50 + i * 10, 140 - height, 5, height)
      }
      ctx.fillStyle = '#78cbc5'
      ctx.fillRect(9 + (moving * 19) % 220, 154, 20, 3)
    } else if (theme === 1) {
      // SOC Threat Radar & IoT Mesh Topology (emerald / indigo)
      ctx.fillStyle = '#091423'
      ctx.fillRect(0, 0, 288, 164)
      ctx.fillStyle = '#132a46'
      ctx.fillRect(0, 0, 288, 15)
      ctx.fillStyle = '#6ee7b7'
      ctx.font = 'bold 8.5px sans-serif'
      ctx.fillText('SOC RADAR & MESH TOPOLOGY', 8, 10)

      // Left rotating radar
      const cx = 74
      const cy = 88
      const rMax = 52
      ctx.strokeStyle = '#1f4d4b'
      ctx.lineWidth = 1
      for (const r of [16, 34, 52]) {
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      const angle = moving * 1.6 + channel
      ctx.fillStyle = 'rgba(52, 211, 153, 0.22)'
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, rMax, angle - 0.55, angle)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#34d399'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * rMax, cy + Math.sin(angle) * rMax)
      ctx.stroke()

      const blips: [number, number][] = [[48, 66], [96, 74], [62, 114], [104, 106]]
      blips.forEach(([bx, by], idx) => {
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(moving * 2.2 + idx * 1.4))
        ctx.fillStyle = idx === 1 ? `rgba(251, 113, 133, ${pulse})` : `rgba(110, 231, 183, ${pulse})`
        ctx.beginPath()
        ctx.arc(bx, by, 3, 0, Math.PI * 2)
        ctx.fill()
      })

      // Right node topology with moving packets
      const nodes: [number, number][] = [
        [176, 44],
        [244, 48],
        [210, 88],
        [172, 128],
        [252, 126],
      ]
      const edges: [number, number][] = [[0, 2], [1, 2], [2, 3], [2, 4], [0, 1], [3, 4]]
      ctx.strokeStyle = '#255678'
      ctx.lineWidth = 1.2
      for (const [a, b] of edges) {
        ctx.beginPath()
        ctx.moveTo(nodes[a][0], nodes[a][1])
        ctx.lineTo(nodes[b][0], nodes[b][1])
        ctx.stroke()
      }
      edges.forEach(([a, b], i) => {
        const p = (moving * 0.65 + i * 0.23) % 1
        const px = nodes[a][0] + (nodes[b][0] - nodes[a][0]) * p
        const py = nodes[a][1] + (nodes[b][1] - nodes[a][1]) * p
        ctx.fillStyle = '#38bdf8'
        ctx.beginPath()
        ctx.arc(px, py, 2.4, 0, Math.PI * 2)
        ctx.fill()
      })
      nodes.forEach(([nx, ny], i) => {
        ctx.fillStyle = i === 2 ? '#10b981' : '#38bdf8'
        ctx.beginPath()
        ctx.arc(nx, ny, i === 2 ? 6 : 4.5, 0, Math.PI * 2)
        ctx.fill()
      })
    } else if (theme === 2) {
      // Live Firewall & SIEM Audit Terminal (charcoal + neon green/amber/red)
      ctx.fillStyle = '#0b1116'
      ctx.fillRect(0, 0, 288, 164)
      ctx.fillStyle = '#1b2833'
      ctx.fillRect(0, 0, 288, 15)
      ctx.fillStyle = '#86efac'
      ctx.font = 'bold 8.5px monospace'
      ctx.fillText('SIEM FIREWALL STREAM // LIVE', 8, 10)

      const scroll = Math.floor(moving * 2.5)
      const colors = ['#4ade80', '#38bdf8', '#fbbf24', '#f87171', '#4ade80', '#a78bfa']
      for (let row = 0; row < 10; row++) {
        const id = (row + scroll) % colors.length
        const y = 26 + row * 12
        ctx.fillStyle = colors[id]
        ctx.fillRect(10, y, 22, 5)
        ctx.fillStyle = '#334155'
        ctx.fillRect(38, y, 64 + ((row * 29 + scroll * 13) % 72), 5)
        ctx.fillStyle = id === 3 ? '#fca5a5' : '#94a3b8'
        ctx.fillRect(188, y, 16 + ((row * 11 + scroll * 7) % 18), 5)
      }
      // Right mini CPU/MEM/NET gauges
      ctx.fillStyle = '#131f2a'
      ctx.fillRect(228, 22, 52, 130)
      const bars = [
        { label: 'CPU', val: 0.45 + 0.35 * Math.sin(moving * 1.2), color: '#4ade80' },
        { label: 'MEM', val: 0.62 + 0.14 * Math.cos(moving * 0.7), color: '#38bdf8' },
        { label: 'IDS', val: 0.3 + 0.55 * Math.abs(Math.sin(moving * 1.9 + channel)), color: '#fbbf24' },
      ]
      bars.forEach((bar, i) => {
        const bx = 234 + i * 15
        const bh = Math.round(bar.val * 92)
        ctx.fillStyle = '#1e293b'
        ctx.fillRect(bx, 34, 9, 92)
        ctx.fillStyle = bar.color
        ctx.fillRect(bx, 126 - bh, 9, bh)
      })
      if (Math.floor(t * 3) % 2 === 0) {
        ctx.fillStyle = '#4ade80'
        ctx.fillRect(10, 148, 7, 9)
      }
    } else if (theme === 3) {
      // Thermal & IoT Sensor Matrix Heatmap (midnight violet -> amber -> coral)
      ctx.fillStyle = '#140c21'
      ctx.fillRect(0, 0, 288, 164)
      ctx.fillStyle = '#2a1945'
      ctx.fillRect(0, 0, 288, 15)
      ctx.fillStyle = '#fcd34d'
      ctx.font = 'bold 8.5px sans-serif'
      ctx.fillText('THERMAL SENSOR ARRAY // DHT + IR', 8, 10)

      const cols = 12
      const rows = 5
      const palette = ['#1d4ed8', '#0891b2', '#10b981', '#eab308', '#f97316', '#ef4444']
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wave =
            (Math.sin(c * 0.55 - moving * 1.3 + r * 0.6) +
              Math.cos(r * 0.9 + moving * 0.9 - channel)) *
              0.25 +
            0.5
          const idx = Math.max(0, Math.min(palette.length - 1, Math.floor(wave * palette.length)))
          ctx.fillStyle = palette[idx]
          ctx.fillRect(10 + c * 22.5, 24 + r * 17, 19, 13.5)
        }
      }
      // Bottom live trend sparkline
      ctx.strokeStyle = '#fde047'
      ctx.lineWidth = 1.8
      ctx.beginPath()
      for (let x = 0; x <= 268; x += 4) {
        const y = 138 + Math.sin(x * 0.06 - moving * 2.2) * 10 + Math.cos(x * 0.13 + moving) * 4
        if (!x) ctx.moveTo(10 + x, y)
        else ctx.lineTo(10 + x, y)
      }
      ctx.stroke()
    } else {
      // 5-Channel Digital Logic & Bus Protocol Analyzer (slate blue)
      ctx.fillStyle = '#091522'
      ctx.fillRect(0, 0, 288, 164)
      ctx.fillStyle = '#17304a'
      ctx.fillRect(0, 0, 288, 15)
      ctx.fillStyle = '#93c5fd'
      ctx.font = 'bold 8.5px monospace'
      ctx.fillText('BUS LOGIC ANALYZER // SPI I2C UART', 8, 10)

      const busLanes = [
        { color: '#38bdf8', freq: 0.12, seed: 1.1 },
        { color: '#4ade80', freq: 0.08, seed: 2.3 },
        { color: '#fbbf24', freq: 0.16, seed: 3.7 },
        { color: '#c084fc', freq: 0.09, seed: 5.1 },
        { color: '#fb7185', freq: 0.14, seed: 6.4 },
      ]
      busLanes.forEach((lane, idx) => {
        const baseY = 36 + idx * 26
        ctx.fillStyle = lane.color
        ctx.fillRect(8, baseY - 5, 18, 9)
        ctx.strokeStyle = lane.color
        ctx.lineWidth = 1.7
        ctx.beginPath()
        for (let x = 34; x <= 278; x += 3) {
          const bit = Math.sin(x * lane.freq - moving * (2.2 + idx * 0.35) + lane.seed) + Math.sin(x * lane.freq * 2.3 + lane.seed) > 0
          const y = bit ? baseY - 8 : baseY + 6
          if (x === 34) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      })
    }

    transitionFlash(ctx, 288, 164, localTime)
    return monitor
  }

  return { drawScope, drawMonitor }
}

// LCD edges, excluding photographed bezels. Sunset and night share the warmer camera angle.
export const REAR_DISPLAYS = {
  day: {
    monitors: [[[914, 351], [988, 350], [985, 399], [911, 401]], [[1295, 346], [1398, 343], [1396, 401], [1292, 404]]],
    scopes: [[[833, 386], [862, 387], [861, 410], [833, 409]], [[1010, 386], [1045, 386], [1044, 413], [1009, 412]], [[1167, 385], [1211, 385], [1210, 415], [1166, 414]]],
  },
  night: {
    monitors: [[[888, 346], [963, 343], [960, 391], [885, 393]], [[1292, 338], [1397, 333], [1393, 391], [1288, 395]]],
    scopes: [[[800, 376], [834, 376], [833, 401], [799, 401]], [[993, 379], [1028, 379], [1027, 405], [992, 405]], [[1157, 378], [1203, 378], [1202, 405], [1156, 406]]],
  },
} satisfies Record<string, { monitors: [number, number][][]; scopes: [number, number][][] }>

export function greenLedLevel(t: number, distance: number, reduced: boolean) {
  if (reduced) return 1
  const period = distance < 30 ? 1.1 : 2.4
  const phase = t % period
  // A readable double pulse with a real off interval; close objects shorten the interval.
  const pulse = Math.max(Math.max(0, 1 - Math.abs(phase - 0.16) / 0.16), Math.max(0, 1 - Math.abs(phase - 0.52) / 0.16))
  return pulse * pulse * (3 - 2 * pulse)
}

export function createGreenLedDimmer(photo: HTMLImageElement, night: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = 88
  canvas.height = 244
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const x = 1110
  const y = 674
  const ledY = night ? 699 : 708
  ctx.drawImage(
    photo,
    (x * photo.naturalWidth) / 1446,
    (y * photo.naturalHeight) / 1087,
    (88 * photo.naturalWidth) / 1446,
    (244 * photo.naturalHeight) / 1087,
    0,
    0,
    88,
    244,
  )
  const pixels = ctx.getImageData(0, 0, 88, 244)
  const d = pixels.data
  for (let py = 0; py < 244; py++) {
    for (let px = 0; px < 88; px++) {
      const i = (py * 88 + px) * 4
      const r = d[i]
      const g = d[i + 1]
      const b = d[i + 2]
      const bulb = Math.exp(-(((px + x - 1150) / 15) ** 2 + ((py + y - ledY) / 20) ** 2))
      const reflection = Math.exp(-(((px + x - 1155) / 22) ** 2 + ((py + y - (night ? 825 : 839)) / 53) ** 2))
      const green = Math.max(0, Math.min(1, (g - Math.max(r, b) - 12) / 50))
      const neutral = (r + b) * 0.44
      d[i] = neutral
      d[i + 1] = neutral * 1.12
      d[i + 2] = neutral * 0.95
      d[i + 3] = Math.round(green * Math.min(1, Math.max(bulb * 2, reflection * 2)) * 255)
    }
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}
