import type { LabProgram, LabWeather } from './studio-model'
import {
  AUTO_CYCLE_MODES,
  LAPTOP_CONTENT,
  LAPTOP_MODES,
  LAPTOP_SHORT_MENU,
  type LaptopMode,
} from './laptop-content'

export const LAPTOP_WIDTH = 1920
export const LAPTOP_HEIGHT = 1080
const TAU = Math.PI * 2
type Point = [number, number]

export function laptopSceneAt(t: number, selection: LabProgram): { mode: LaptopMode; variant: number } {
  const page = Math.floor(Math.max(0, t) / 10)
  return {
    mode: selection === 'auto' ? AUTO_CYCLE_MODES[Math.floor(page / 2) % AUTO_CYCLE_MODES.length] : selection,
    variant: page % 2,
  }
}

function syntaxColor(line: string): string {
  const trimmed = line.trimStart()
  if (trimmed.startsWith('#') || trimmed.startsWith('//')) return '#6f9eb2'
  if (
    trimmed.startsWith('from ') ||
    trimmed.startsWith('import ') ||
    trimmed.startsWith('#include') ||
    trimmed.startsWith('def ') ||
    trimmed.startsWith('async ') ||
    trimmed.startsWith('void ') ||
    trimmed.startsWith('for ') ||
    trimmed.startsWith('while ') ||
    trimmed.startsWith('if ') ||
    trimmed.startsWith('else') ||
    trimmed.startsWith('return ') ||
    trimmed.startsWith('assert ') ||
    trimmed.startsWith('@app')
  ) {
    return '#7be8d0'
  }
  if (line.includes('"') || line.includes("'")) return '#f3d58d'
  if (trimmed.startsWith('const ') || trimmed.startsWith('float ') || trimmed.startsWith('long ')) return '#9fd4ff'
  return '#cde4f0'
}

// Rich multi-domain virtual workstation scenes: Cyber Security, Web Dev, Steganography, IoT, Networks, and OS Desktop.
export function drawLabScreen(
  ctx: CanvasRenderingContext2D,
  t: number,
  selection: LabProgram,
  weather: LabWeather,
  distance: number,
  network: number,
) {
  ctx.setTransform(1.5, 0, 0, 1.5, 0, 0)
  const active = laptopSceneAt(t, selection)

  const dot = (p: Point, r: number, color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(...p, r, 0, TAU)
    ctx.fill()
  }
  const line = (a: Point, b: Point, color: string, width = 2) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(...a)
    ctx.lineTo(...b)
    ctx.stroke()
  }
  const round = (x: number, y: number, w: number, h: number, color: string, r = 8) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.fill()
  }
  const text = (value: string, x: number, y: number, color = '#284c62', size = 16, mono = false) => {
    ctx.font = `600 ${size}px ${mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'Inter, sans-serif'}`
    ctx.fillStyle = color
    ctx.fillText(value, x, y)
  }
  const ring = (p: Point, r: number, color: string, start = 0, end = TAU, width = 2) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.arc(...p, r, start, end)
    ctx.stroke()
  }
  const packet = (a: Point, b: Point, offset: number, color = '#12a98c') => {
    const p = network ? (t * (0.13 + network / 240) + offset) % 1 : offset % 1
    dot([a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p], 5, color)
  }

  // Dedicated realistic OS Desktop view rendered directly on the laptop screen
  if (active.mode === 'desktop') {
    const grad = ctx.createLinearGradient(0, 64, 1280, 720)
    grad.addColorStop(0, '#0a2229')
    grad.addColorStop(0.5, '#10373f')
    grad.addColorStop(1, '#0b251f')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1280, 720)

    // Subtle geometric cyber-grid wallpaper
    ctx.strokeStyle = 'rgba(130, 232, 206, 0.08)'
    ctx.lineWidth = 1
    for (let x = 0; x < 1280; x += 64) {
      ctx.beginPath()
      ctx.moveTo(x, 64)
      ctx.lineTo(x, 720)
      ctx.stroke()
    }
    for (let y = 64; y < 720; y += 64) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(1280, y)
      ctx.stroke()
    }
    // Glowing ambient orb on wallpaper
    const orb = ctx.createRadialGradient(880, 320, 20, 880, 320, 320)
    orb.addColorStop(0, 'rgba(34, 211, 180, 0.22)')
    orb.addColorStop(1, 'rgba(34, 211, 180, 0)')
    ctx.fillStyle = orb
    ctx.fillRect(540, 64, 740, 620)

    // Top bar (OS menu + tabs)
    drawTopNav(active.mode)

    // Realistic desktop folders on the left grid
    const folders = [
      { name: 'CyberSecurity', color: '#22c58b', tag: '4 files' },
      { name: 'WebDev', color: '#38bdf8', tag: '4 files' },
      { name: 'Steganography', color: '#c084fc', tag: '4 files' },
      { name: 'IoT_ESP32', color: '#fbbf24', tag: '3 files' },
      { name: 'Terminal', color: '#14b8a6', tag: 'bash' },
    ]
    folders.forEach((f, idx) => {
      const col = idx % 2
      const row = Math.floor(idx / 2)
      const fx = 52 + col * 164
      const fy = 104 + row * 150
      const hovered = Math.floor(t * 0.6) % folders.length === idx
      if (hovered) round(fx - 12, fy - 12, 134, 126, 'rgba(255,255,255,0.1)', 14)
      if (f.name === 'Terminal') {
        round(fx + 10, fy + 8, 86, 66, '#091922', 10)
        ctx.strokeStyle = '#34d399'
        ctx.lineWidth = 2.5
        ctx.strokeRect(fx + 10, fy + 8, 86, 66)
        text('>_', fx + 24, fy + 48, '#5eead4', 24, true)
      } else {
        // Folder back tab + front flap
        round(fx + 12, fy + 4, 38, 16, f.color, 5)
        round(fx + 10, fy + 15, 88, 60, f.color, 9)
        round(fx + 10, fy + 27, 88, 48, 'rgba(255,255,255,0.16)', 8)
      }
      text(f.name, fx + 8, fy + 97, '#ecfdf5', 14)
      text(f.tag, fx + 8, fy + 114, '#86c4b8', 11, true)
    })

    // Floating desktop File Manager + Mini Terminal preview on right side
    round(430, 102, 800, 485, 'rgba(10, 26, 36, 0.92)', 14)
    round(430, 102, 800, 38, '#163547', 14)
    dot([454, 121], 6, '#ff5f56')
    dot([474, 121], 6, '#ffbd2e')
    dot([494, 121], 6, '#27c93f')
    text('ifa@weblab-os — /home/ifa/Desktop', 518, 126, '#d6f1fa', 14, true)

    // Sidebar inside desktop file manager
    round(444, 152, 178, 420, '#0d222f', 8)
    ;['Home', 'Desktop', 'CyberSecurity', 'WebDev', 'Steganography', 'IoT_ESP32'].forEach((item, i) => {
      if (i === 1) round(452, 162 + i * 38, 162, 30, '#1e5064', 6)
      text(item, 464, 182 + i * 38, i === 1 ? '#ffffff' : '#9cc4d4', 13)
    })

    // Live system monitor & active files inside window
    const previewFiles = [
      ['security_pipeline.py', 'CyberSecurity', '2.4 KB', '#34d399'],
      ['fastapi_server.py', 'WebDev', '1.9 KB', '#38bdf8'],
      ['cover_lab.png (LSB)', 'Steganography', '312 KB', '#c084fc'],
      ['esp32_dht22.ino', 'IoT_ESP32', '3.1 KB', '#fbbf24'],
      ['siem_capture.pcap', 'Networks', '840 KB', '#2dd4bf'],
    ]
    previewFiles.forEach(([fname, dir, sz, c], idx) => {
      const y = 162 + idx * 46
      round(638, y, 574, 38, idx === Math.floor(t * 0.5) % previewFiles.length ? '#173e50' : '#0f2937', 7)
      dot([656, y + 19], 5, c)
      text(fname, 672, y + 24, '#e6f6fc', 14, true)
      text(dir, 935, y + 24, '#8db8ca', 13)
      text(sz, 1135, y + 24, '#7cd9c6', 12, true)
    })

    // Embedded mini terminal at bottom of desktop window
    round(638, 404, 574, 168, '#071720', 8)
    text('ifa@weblab-os:~/Desktop$ ls -la', 654, 430, '#7decd3', 13, true)
    text('drwxr-xr-x  CyberSecurity/   WebDev/   Steganography/   IoT_ESP32/', 654, 456, '#b9dce8', 12.5, true)
    text('ifa@weblab-os:~/Desktop$ ./run-lab --interactive', 654, 486, '#7decd3', 13, true)
    text('[READY] Click Zoom (top-right) to open interactive Desktop & Terminal', 654, 512, '#f5d98e', 12.5, true)
    text(Math.floor(t * 2) % 2 ? '▌' : '', 654, 540, '#5eead4', 15, true)

    // Bottom frosted glass OS dock
    round(390, 622, 500, 68, 'rgba(14, 38, 48, 0.88)', 18)
    ;['#22c58b', '#38bdf8', '#c084fc', '#fbbf24', '#fb7185', '#14b8a6'].forEach((color, idx) => {
      round(420 + idx * 76, 636, 48, 40, color, 10)
      dot([444 + idx * 76, 682], 3, '#a7f3d0')
    })
    return
  }

  // Standard Lab IDE + Live Simulation View
  ctx.fillStyle = '#edf7fa'
  ctx.fillRect(0, 0, 1280, 720)
  for (let i = 0; i < 85; i++) dot([25 + ((i * 149) % 1230), 20 + ((i * 83) % 680)], 1.3, '#9ac6d24d')

  function scene(clock: number, alpha: number) {
    const { mode, variant } = laptopSceneAt(clock, selection)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(8, 133)
    ctx.scale(0.66, 0.66)
    const orbit = (count: number, rx: number, ry: number): Point[] =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * TAU + t * 0.09
        return [640 + Math.cos(a) * rx, 360 + Math.sin(a) * ry]
      })
    const shield = () => {
      ctx.save()
      ctx.translate(640, 355 + Math.sin(t * 0.5) * 4)
      ctx.scale(1.2, 1.2)
      ctx.beginPath()
      ctx.moveTo(0, -85)
      ctx.lineTo(72, -55)
      ctx.lineTo(65, 30)
      ctx.quadraticCurveTo(54, 77, 0, 101)
      ctx.quadraticCurveTo(-54, 77, -65, 30)
      ctx.lineTo(-72, -55)
      ctx.closePath()
      ctx.fillStyle = '#087e78'
      ctx.fill()
      ctx.strokeStyle = '#77ead2'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.strokeStyle = '#e8fff7'
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-30, 8)
      ctx.lineTo(-7, 32)
      ctx.lineTo(33, -18)
      ctx.stroke()
      ctx.restore()
    }

    if (mode === 'security') {
      const nodes = orbit(variant ? 20 : 12, 480, 247)
      nodes.forEach((node, i) => {
        const to: Point = variant ? nodes[(i + 3) % nodes.length] : [640, 360]
        line(node, to, '#94c8d4', 1.8)
        packet(node, to, i * 0.17)
        round(node[0] - 19, node[1] - 16, 38, 32, i % 3 ? '#d0eee8' : '#cbdfee', 7)
        dot(node, 5, '#169c8e')
      })
      for (let i = 0; i < 3; i++)
        ring(
          [640, 360],
          125 + i * 31,
          i === 1 ? '#64b9d0' : '#a6ddd7',
          t * (0.18 + i * 0.06),
          t * (0.18 + i * 0.06) + Math.PI * 1.35,
          3,
        )
      shield()
    } else if (mode === 'pentest') {
      if (!variant) {
        for (let i = 1; i < 5; i++) ring([640, 360], i * 65, '#add6df', 0, TAU, 1.5)
        const angle = t * 0.55
        ctx.save()
        ctx.translate(640, 360)
        ctx.rotate(angle)
        for (let i = 0; i < 12; i++) {
          ctx.globalAlpha = alpha * (1 - i / 12) * 0.14
          ctx.fillStyle = '#16ba9a'
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.arc(0, 0, 260, -i * 0.035 - 0.035, -i * 0.035)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
        line([640, 360], [640 + Math.cos(angle) * 260, 360 + Math.sin(angle) * 260], '#169f93', 3)
        orbit(13, 450, 250).forEach((n, i) => {
          const p = orbit(13, 200 + (i % 3) * 18, 120 + (i % 4) * 24)[i]
          line(n, p, '#bed9e1')
          dot(p, 7, i % 4 ? '#159f91' : '#e4ad48')
          ring(p, 12 + ((t * 13 + i * 7) % 23), '#91cfc7')
        })
      } else {
        const nodes = orbit(9, 450, 240)
        nodes.forEach((n, i) => {
          const next = nodes[(i + 1) % nodes.length]
          line(n, next, '#a5ccd7')
          packet(n, next, i * 0.15, i % 4 ? '#16a993' : '#de9a40')
          round(n[0] - 30, n[1] - 24, 60, 48, '#0d6382')
          for (let p = 0; p < 3; p++) dot([n[0] - 15 + p * 15, n[1] + 8], 3, '#78e3cb')
        })
        shield()
      }
    } else if (mode === 'vulnerability') {
      const sweep = (t * 110) % 1050
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 11; col++) {
          const x = 170 + col * 94
          const y = 150 + row * 101 + Math.sin(t * 0.3 + col * 0.2) * 3
          const checked = (col * 94 + 1050 - sweep) % 1050 < 540
          const alert = (row * 11 + col) % 13 === 0
          round(x, y, 66, 66, checked ? '#c8ece1' : '#dce8ed', 11)
          ctx.strokeStyle = checked ? '#159f88' : alert ? '#d9a24c' : '#91b6c9'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(x + 18, y + 33)
          if (checked) {
            ctx.lineTo(x + 29, y + 44)
            ctx.lineTo(x + 49, y + 22)
          } else {
            ctx.lineTo(x + 48, y + 33)
          }
          ctx.stroke()
          if (variant) {
            line([x + 66, y + 32], [x + 93, y + 32], '#bbd8df', 1)
            dot([x + 70 + ((t * 25 + col * 5) % 20), y + 32], 2, '#22af98')
          }
        }
      round(150 + sweep, 123, 4, 508, '#35bba7', 2)
    } else if (mode === 'attacks') {
      const nodes = orbit(12, 470, 246)
      nodes.forEach((n, i) => {
        const blocked = i % 3 === 0
        line(n, [640, 360], blocked ? '#e1afa2' : '#a9d5d9')
        packet(n, [640, 360], i * 0.16, blocked ? '#db7564' : '#20ad96')
        round(n[0] - 25, n[1] - 20, 50, 40, blocked ? '#e9c3b8' : '#b5dfd7')
        if (blocked) {
          line([n[0] - 9, n[1] - 9], [n[0] + 9, n[1] + 9], '#b35849', 3)
          line([n[0] + 9, n[1] - 9], [n[0] - 9, n[1] + 9], '#b35849', 3)
        }
      })
      ring([640, 360], variant ? 180 : 150, '#44b69a', 0, TAU, 5)
      shield()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU
        round(640 + Math.cos(a) * 182 - 5, 360 + Math.sin(a) * 182 - 5, 10, 10, '#1b9987', 2)
      }
    } else if (mode === 'web') {
      if (!variant) {
        // Browser DOM + CSS Grid Live Inspector
        round(80, 70, 1120, 580, '#ffffff', 18)
        ctx.strokeStyle = '#8bc4d0'
        ctx.lineWidth = 3
        ctx.strokeRect(80, 70, 1120, 580)
        round(80, 70, 1120, 56, '#143c4f', 16)
        dot([114, 98], 9, '#ff5f56')
        dot([144, 98], 9, '#ffbd2e')
        dot([174, 98], 9, '#27c93f')
        round(215, 82, 610, 32, '#0d2b3a', 8)
        text('https://lab.local/app  ·  200 OK  ·  CSP Strict', 235, 104, '#8de8d2', 17, true)
        round(855, 82, 160, 32, '#148573', 8)
        text('DOM Sync ✓', 882, 104, '#ffffff', 16)

        // Hero & 3-column CSS Grid cards with animated highlight box
        round(115, 152, 660, 95, '#e2f4f2', 12)
        text('<h1>WebLabIFA Studio</h1>', 142, 195, '#0f4c5c', 26, true)
        text('display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;', 142, 228, '#2b7a78', 15, true)
        const activeCard = Math.floor(t * 0.9) % 3
        for (let c = 0; c < 3; c++) {
          const cx = 115 + c * 226
          round(cx, 268, 208, 185, c === activeCard ? '#d2f2ea' : '#f1f7f9', 12)
          ctx.strokeStyle = c === activeCard ? '#0f9d8a' : '#b7d6de'
          ctx.lineWidth = c === activeCard ? 4 : 2
          ctx.strokeRect(cx, 268, 208, 185)
          round(cx + 18, 288, 172, 22, '#7bc8bd', 5)
          round(cx + 18, 326, 130, 14, '#a6d2dc', 4)
          round(cx + 18, 352, 155, 14, '#a6d2dc', 4)
          round(cx + 18, 392, 110, 38, c === activeCard ? '#0d8a7a' : '#2f7288', 8)
          text(c === 0 ? 'HTML5' : c === 1 ? 'CSS3' : 'React', cx + 44, 417, '#ffffff', 16)
        }
        // Right DOM Inspector Tree
        round(802, 152, 368, 466, '#0f2d3c', 12)
        text('DOM / Box Inspector', 822, 184, '#7be8d0', 18, true)
        const domLines = [
          '<html>',
          '  <body>',
          '    <header class="hero">',
          '      <h1>WebLabIFA</h1>',
          '    </header>',
          '    <section class="grid">',
          '      <article>HTML5</article>',
          '      <article>CSS3</article>',
          '      <article>React</article>',
          '    </section>',
          '  </body>',
          '</html>',
        ]
        domLines.forEach((dl, idx) => {
          const hl = idx === 6 + activeCard
          if (hl) round(814, 202 + idx * 32, 344, 26, '#1f5a70', 5)
          text(dl, 824, 220 + idx * 32, hl ? '#ffffff' : '#9ed4e3', 15, true)
        })
      } else {
        // FastAPI REST -> PostgreSQL Query Plan pipeline
        const stages: Array<{ x: number; title: string; sub: string; color: string }> = [
          { x: 110, title: 'Browser SPA', sub: 'React 19 · Fetch', color: '#0e7490' },
          { x: 470, title: 'FastAPI Router', sub: 'JWT + Pydantic', color: '#0f766e' },
          { x: 840, title: 'PostgreSQL 17', sub: 'Index Scan 0.4ms', color: '#1d4ed8' },
        ]
        line([340, 290], [470, 290], '#5eb5c5', 5)
        line([700, 290], [840, 290], '#5eb5c5', 5)
        packet([340, 290], [470, 290], 0.1, '#10b981')
        packet([700, 290], [840, 290], 0.5, '#38bdf8')
        packet([840, 330], [700, 330], 0.25, '#f59e0b')
        packet([470, 330], [340, 330], 0.65, '#34d399')
        line([470, 330], [340, 330], '#94cbd6', 3)
        line([840, 330], [700, 330], '#94cbd6', 3)

        stages.forEach((st) => {
          round(st.x, 200, 230, 200, st.color, 18)
          round(st.x + 14, 214, 202, 40, 'rgba(255,255,255,0.14)', 10)
          text(st.title, st.x + 28, 241, '#ffffff', 21)
          text(st.sub, st.x + 28, 286, '#cffafe', 16, true)
          for (let b = 0; b < 3; b++) {
            const bw = 70 + Math.round((Math.sin(t * 2 + b + st.x) + 1) * 52)
            round(st.x + 26, 314 + b * 24, bw, 12, 'rgba(255,255,255,0.45)', 4)
          }
        })
        round(110, 460, 960, 140, '#0f2d3c', 14)
        text('GET /api/v1/labs  ->  200 OK  {"items": 14, "sql": "Index Scan", "ms": 0.42}', 140, 514, '#7be8d0', 19, true)
        text('SELECT id, title, track FROM labs WHERE status = $1 ORDER BY id;', 140, 558, '#f3d58d', 18, true)
      }
    } else if (mode === 'stego') {
      if (!variant) {
        // Steganography RGB LSB Bit-Plane Extractor
        round(80, 88, 520, 480, '#0f2b38', 16)
        text('cover_lab.png · RGB Pixel Matrix', 106, 126, '#8de8d2', 19, true)
        const cols = 10
        const rows = 8
        const scanIdx = Math.floor(t * 4) % (cols * rows)
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = r * cols + c
            const activeCell = idx === scanIdx
            const px = 106 + c * 46
            const py = 148 + r * 48
            const bit = (r * 7 + c * 3 + 1) % 2
            const hue = activeCell ? '#14b8a6' : bit ? '#1d5d6e' : '#144152'
            round(px, py, 38, 38, hue, 6)
            if (activeCell) {
              ctx.strokeStyle = '#fef08a'
              ctx.lineWidth = 3
              ctx.strokeRect(px, py, 38, 38)
            }
            text(String(bit), px + 13, py + 25, activeCell ? '#ffffff' : '#8dd7d8', 17, true)
          }
        }

        // Right Bit-Plane Inspector & Extracted Secret Flag
        round(640, 88, 560, 290, '#102b3c', 16)
        text('LSB Bit-Plane 0 Extraction', 668, 128, '#f3d58d', 20, true)
        const channels = [
          { ch: 'R', bits: '1011010', lsb: (scanIdx + 1) % 2, color: '#fb7185' },
          { ch: 'G', bits: '0110110', lsb: scanIdx % 2, color: '#4ade80' },
          { ch: 'B', bits: '1100101', lsb: (scanIdx + 1) % 2, color: '#38bdf8' },
        ]
        channels.forEach((ch, idx) => {
          const y = 162 + idx * 66
          round(668, y, 504, 48, '#091d29', 9)
          text(`${ch.ch}-CH:`, 688, y + 31, ch.color, 20, true)
          text(ch.bits, 778, y + 31, '#9cc4d4', 22, true)
          round(940, y + 7, 56, 34, '#0f8c7a', 6)
          text(`[${ch.lsb}]`, 950, y + 31, '#ffffff', 22, true)
          text('-> LSB', 1024, y + 31, '#7be8d0', 18, true)
        })

        // Decoded hidden payload bar
        round(640, 404, 560, 164, '#092422', 16)
        ctx.strokeStyle = '#2dd4bf'
        ctx.lineWidth = 3
        ctx.strokeRect(640, 404, 560, 164)
        text('Decoded Hidden Payload (UTF-8):', 668, 444, '#8de8d2', 18, true)
        const flag = 'FLAG{IFA_STEGO_LSB_2026}'
        const chars = Math.max(4, Math.min(flag.length, Math.floor((t * 3.5) % (flag.length + 6))))
        text(flag.slice(0, chars) + (Math.floor(t * 2) % 2 ? '▌' : ''), 668, 496, '#fef08a', 28, true)
        text('Chi-Square LSB confidence: 99.4% · 0 visual artifacts', 668, 540, '#6ee7b7', 16, true)
      } else {
        // PNG Chunk & Hex Forensic Inspector
        round(80, 88, 1120, 484, '#0d2330', 16)
        text('PNG Chunk Forensics & Hex Dump — cover_lab.png', 110, 130, '#7be8d0', 22, true)
        const chunks = [
          { off: '00000000', hex: '89 50 4E 47 0D 0A 1A 0A', ascii: '.PNG....', tag: 'SIG', color: '#38bdf8' },
          { off: '00000008', hex: '00 00 00 0D 49 48 44 52', ascii: '....IHDR', tag: 'IHDR', color: '#4ade80' },
          { off: '00000020', hex: '00 00 04 B2 49 44 41 54', ascii: '....IDAT', tag: 'IDAT', color: '#60a5fa' },
          { off: '000004E0', hex: '00 00 00 18 74 45 58 74', ascii: '....tEXt', tag: 'COVERT', color: '#fbbf24' },
          { off: '000004F8', hex: '46 4C 41 47 7B 49 46 41', ascii: 'FLAG{IFA', tag: 'PAYLOAD', color: '#f472b6' },
          { off: '00000510', hex: '00 00 00 00 49 45 4E 44', ascii: '....IEND', tag: 'IEND', color: '#94a3b8' },
        ]
        const scanRow = Math.floor(t * 1.4) % chunks.length
        chunks.forEach((ch, idx) => {
          const y = 160 + idx * 62
          const activeRow = idx === scanRow || ch.tag === 'COVERT' || ch.tag === 'PAYLOAD'
          round(108, y, 1064, 48, activeRow ? '#173e52' : '#0a1b26', 8)
          text(ch.off, 128, y + 31, '#79a6bc', 18, true)
          text(ch.hex, 286, y + 31, '#e0f2fe', 18, true)
          text(ch.ascii, 706, y + 31, '#f3d58d', 18, true)
          round(940, y + 8, 198, 32, ch.color, 6)
          text(ch.tag, 992, y + 30, '#091820', 16, true)
        })
      }
    } else if (mode === 'iot') {
      round(478, 215, 324, 292, '#0e5462', 19)
      round(555, 270, 170, 142, '#bad5dc', 8)
      text('ESP32-C3', 590, 348, '#0c3f4d', 22, true)
      for (let i = 0; i < 12; i++) {
        round(461, 235 + i * 21, 27, 7, '#8cb4b5', 1)
        round(792, 235 + i * 21, 27, 7, '#8cb4b5', 1)
      }
      for (let i = 0; i < 5; i++) {
        line([575, 290 + i * 22], [705, 290 + i * 22], '#7a9fac', 3)
        dot([695, 290 + i * 22], 3, '#e1f7f4')
      }
      const sensors: Point[] = [
        [265, 170],
        [1030, 170],
        [265, 555],
        [1030, 555],
      ]
      sensors.forEach((s, i) => {
        const anchor: Point = [i % 2 ? 819 : 461, s[1] < 360 ? 276 : 444]
        ctx.strokeStyle = '#5ca8b2'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(...s)
        ctx.lineTo(s[0], anchor[1])
        ctx.lineTo(...anchor)
        ctx.stroke()
        packet(s, anchor, i * 0.3)
        ring(s, 45, '#a3d6d9', 0, TAU, 2)
        const cold = weather === 'snow' || weather === 'blizzard'
        if (i === 0) {
          round(s[0] - 8, s[1] - 25, 16, 45, cold ? '#4a9bde' : '#22b596', 8)
          dot([s[0], s[1] + 22], 14, cold ? '#4a9bde' : '#22b596')
        } else if (i === 1) {
          ctx.fillStyle = '#53a8d7'
          ctx.beginPath()
          ctx.moveTo(s[0], s[1] - 30)
          ctx.bezierCurveTo(s[0] + 40, s[1] + 10, s[0] + 24, s[1] + 35, s[0], s[1] + 30)
          ctx.bezierCurveTo(s[0] - 24, s[1] + 35, s[0] - 40, s[1] + 10, s[0], s[1] - 30)
          ctx.fill()
        } else {
          for (let r = 0; r < 3; r++)
            ring(s, 10 + ((t * (variant ? 30 : 20) + r * 17) % (35 + distance / 10)), '#34b89e', -0.9, 0.9, 3)
        }
      })
      dot([526, 459], 7, Math.sin(t * 3) > 0 ? '#45dfaf' : '#235b61')
      if (variant)
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = ['#27b69d', '#64a5dd', '#dcac52'][k]
          ctx.lineWidth = 2.5
          ctx.beginPath()
          for (let x = 0; x < 250; x += 3) {
            const y = 315 + k * 35 + Math.sin(x * 0.08 - t * 2 + k) * 9
            if (!x) ctx.moveTo(20, y)
            else ctx.lineTo(20 + x, y)
          }
          ctx.stroke()
        }
    } else {
      const rows = variant ? 6 : 4
      for (let i = 0; i < rows; i++) {
        const y = 120 + i * (480 / (rows - 1))
        round(120, y - 24, 85, 48, '#187e91', 8)
        round(1075, y - 24, 85, 48, '#125369', 8)
        line([205, y], [1075, y], '#b6d5e1', 2)
        for (let j = 0; j < 4; j++) {
          const direction = i % 2 ? -1 : 1
          const p = network ? (t * (0.1 + network / 330) + j * 0.25 + i * 0.13) % 1 : j * 0.25
          const x = 225 + (direction === 1 ? p : 1 - p) * 815
          round(x, y - 14, 50, 28, ['#29b49b', '#4c9edb', '#5fb8c4'][i % 3], 5)
          line([x + 11, y - 5], [x + 35, y - 5], '#dbf9f4', 2)
          line([x + 11, y + 4], [x + 26, y + 4], '#dbf9f4', 2)
        }
        if (variant && i < rows - 1) line([640, y + 16], [640, y + 480 / (rows - 1) - 16], '#85b7c9', 2)
      }
    }
    ctx.restore()
  }

  function drawTopNav(activeMode: LaptopMode) {
    round(0, 0, 1280, 64, '#12394c', 0)
    text('IFA', 18, 40, '#b1f2df', 21)
    LAPTOP_MODES.forEach((mode, i) => {
      const x = 84 + i * 124
      if (mode === activeMode) round(x, 10, 118, 44, '#26758a', 7)
      text(LAPTOP_SHORT_MENU[i], x + 10, 38, mode === activeMode ? '#ffffff' : '#b9d3df', 14.5)
    })
    // Zoom workstation button indicator on top-right of laptop bar
    round(1210, 11, 56, 42, '#1d5c70', 7)
    ctx.strokeStyle = '#b1f2df'
    ctx.lineWidth = 2.2
    ctx.strokeRect(1227, 22, 22, 20)
    line([1238, 22], [1249, 22], '#ffffff', 2.4)
    line([1249, 22], [1249, 32], '#ffffff', 2.4)
  }

  const p = t % 10
  const fade = Math.min(1, p / 0.65)
  if (t >= 10 && fade < 1) scene(t - 10, 1 - fade)
  scene(t, t < 10 ? 1 : fade)

  const content = LAPTOP_CONTENT[active.mode]
  drawTopNav(active.mode)

  text(content.pages[active.variant], 26, 104, '#234f64', 23)
  round(26, 635, 795, 62, '#daeeed', 7)
  text(`●  ${content.stepHint}`, 44, 673, '#167b6b', 19)

  // Realistic IDE Code Pane
  round(858, 82, 404, 356, '#0d2636', 9)
  round(858, 82, 404, 34, '#1b3e52', 9)
  dot([875, 99], 4.5, '#ff5f56')
  dot([890, 99], 4.5, '#ffbd2e')
  dot([905, 99], 4.5, '#27c93f')
  text(content.file, 922, 104, '#d9f0fa', 14.5, true)
  const cycle = (t + 8) % 22
  content.code.forEach((codeLine, i) => {
    const y = 136 + i * 17.2
    if (y > 426) return
    const visible = Math.max(0, Math.min(codeLine.length, Math.floor(cycle * 92 - i * 34)))
    text(String(i + 1).padStart(2, '0'), 870, y, '#547f96', 11.5, true)
    text(codeLine.slice(0, visible), 896, y, syntaxColor(codeLine), 12.5, true)
  })

  // Realistic CLI Terminal Pane
  round(858, 452, 404, 245, '#071c28', 9)
  round(858, 452, 404, 30, '#123142', 9)
  text('Terminal · local sandbox', 874, 472, '#9bc8db', 13.5, true)
  text('⤢ Zoom', 1196, 472, '#7decd3', 12.5, true)
  const count = Math.min(content.cli.length, 2 + Math.floor((t % 18) / 2))
  content.cli.slice(0, count).forEach((log, i) => {
    const color =
      i === 0
        ? '#e2f4fb'
        : log.includes('[ALERT]') || log.includes('[WAF]')
          ? '#fda4af'
          : log.includes('[DECODED]') || log.includes('[SAVED]')
            ? '#fde047'
            : '#8de8c8'
    text(log.slice(0, 46), 872, 506 + i * 24, color, 12.2, true)
  })
  text(Math.floor(t * 2) % 2 ? '▌' : '', 872, 506 + count * 24, '#9bf2d5', 14, true)
}
