import type { LabProgram, LabWeather } from './studio-model'
import { LAPTOP_CONTENT, LAPTOP_MENU, LAPTOP_MODES } from './laptop-content'

export const LAPTOP_WIDTH = 1920
export const LAPTOP_HEIGHT = 1080
const MODES = LAPTOP_MODES
const TAU = Math.PI * 2
type Point = [number, number]
export function laptopSceneAt(t: number, selection: LabProgram) {
  const page = Math.floor(t / 10)
  return { mode: selection === 'auto' ? MODES[Math.floor(page / 2) % MODES.length] : selection, variant: page % 2 }
}

// Twelve scenes, each pairing a live simulation with source code and a fixture CLI.
export function drawLabScreen(ctx: CanvasRenderingContext2D, t: number, selection: LabProgram, weather: LabWeather, distance: number, network: number) {
  ctx.setTransform(1.5, 0, 0, 1.5, 0, 0)
  ctx.fillStyle = '#edf7fa'; ctx.fillRect(0, 0, 1280, 720)
  const dot = (p: Point, r: number, color: string) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(...p, r, 0, TAU); ctx.fill() }
  const line = (a: Point, b: Point, color: string, width = 2) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke() }
  const round = (x: number, y: number, w: number, h: number, color: string, r = 8) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill() }
  const text = (value: string, x: number, y: number, color = '#284c62', size = 16, mono = false) => { ctx.font = `500 ${size}px ${mono ? 'ui-monospace, monospace' : 'Inter, sans-serif'}`; ctx.fillStyle = color; ctx.fillText(value, x, y) }
  const ring = (p: Point, r: number, color: string, start = 0, end = TAU, width = 2) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.arc(...p, r, start, end); ctx.stroke() }
  const packet = (a: Point, b: Point, offset: number, color = '#12a98c') => {
    const p = network ? (t * (.12 + network / 250) + offset) % 1 : offset % 1
    dot([a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p], 5, color)
  }
  for (let i = 0; i < 85; i++) dot([25 + (i * 149 % 1230), 20 + (i * 83 % 680)], 1.3, '#9ac6d24d')
  function scene(clock: number, alpha: number) {
    const { mode, variant } = laptopSceneAt(clock, selection)
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(8, 133); ctx.scale(.66, .66)
    const orbit = (count: number, rx: number, ry: number): Point[] => Array.from({ length: count }, (_, i) => {
      const a = i / count * TAU + t * .09
      return [640 + Math.cos(a) * rx, 360 + Math.sin(a) * ry]
    })
    const shield = () => {
      ctx.save(); ctx.translate(640, 355 + Math.sin(t * .5) * 4); ctx.scale(1.2, 1.2)
      ctx.beginPath(); ctx.moveTo(0, -85); ctx.lineTo(72, -55); ctx.lineTo(65, 30); ctx.quadraticCurveTo(54, 77, 0, 101); ctx.quadraticCurveTo(-54, 77, -65, 30); ctx.lineTo(-72, -55); ctx.closePath(); ctx.fillStyle = '#087e78'; ctx.fill(); ctx.strokeStyle = '#77ead2'; ctx.lineWidth = 4; ctx.stroke()
      ctx.strokeStyle = '#e8fff7'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-30, 8); ctx.lineTo(-7, 32); ctx.lineTo(33, -18); ctx.stroke(); ctx.restore()
    }
    if (mode === 'security') {
      const nodes = orbit(variant ? 20 : 12, 480, 247)
      nodes.forEach((node, i) => {
        const to: Point = variant ? nodes[(i + 3) % nodes.length] : [640, 360]
        line(node, to, '#94c8d4', 1.8); packet(node, to, i * .17)
        round(node[0] - 19, node[1] - 16, 38, 32, i % 3 ? '#d0eee8' : '#cbdfee', 7); dot(node, 5, '#169c8e')
      })
      for (let i = 0; i < 3; i++) ring([640, 360], 125 + i * 31, i === 1 ? '#64b9d0' : '#a6ddd7', t * (.18 + i * .06), t * (.18 + i * .06) + Math.PI * 1.35, 3)
      shield()
    } else if (mode === 'pentest') {
      if (!variant) {
        for (let i = 1; i < 5; i++) ring([640, 360], i * 65, '#add6df', 0, TAU, 1.5)
        const angle = t * .55
        ctx.save(); ctx.translate(640, 360); ctx.rotate(angle)
        for (let i = 0; i < 12; i++) { ctx.globalAlpha = alpha * (1 - i / 12) * .14; ctx.fillStyle = '#16ba9a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 260, -i * .035 - .035, -i * .035); ctx.closePath(); ctx.fill() }
        ctx.restore(); line([640, 360], [640 + Math.cos(angle) * 260, 360 + Math.sin(angle) * 260], '#169f93', 3)
        orbit(13, 450, 250).forEach((n, i) => { const p = orbit(13, 200 + i % 3 * 18, 120 + i % 4 * 24)[i]; line(n, p, '#bed9e1'); dot(p, 7, i % 4 ? '#159f91' : '#e4ad48'); ring(p, 12 + (t * 13 + i * 7) % 23, '#91cfc7') })
      } else {
        const nodes = orbit(9, 450, 240)
        nodes.forEach((n, i) => { const next = nodes[(i + 1) % nodes.length]; line(n, next, '#a5ccd7'); packet(n, next, i * .15, i % 4 ? '#16a993' : '#de9a40'); round(n[0] - 30, n[1] - 24, 60, 48, '#0d6382'); for (let p = 0; p < 3; p++) dot([n[0] - 15 + p * 15, n[1] + 8], 3, '#78e3cb') })
        shield()
      }
    } else if (mode === 'vulnerability') {
      const sweep = (t * 110) % 1050
      for (let row = 0; row < 5; row++) for (let col = 0; col < 11; col++) {
        const x = 170 + col * 94, y = 150 + row * 101 + Math.sin(t * .3 + col * .2) * 3
        const checked = (col * 94 + 1050 - sweep) % 1050 < 540, alert = (row * 11 + col) % 13 === 0
        round(x, y, 66, 66, checked ? '#c8ece1' : '#dce8ed', 11)
        ctx.strokeStyle = checked ? '#159f88' : alert ? '#d9a24c' : '#91b6c9'; ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(x + 18, y + 33); if (checked) { ctx.lineTo(x + 29, y + 44); ctx.lineTo(x + 49, y + 22) } else { ctx.lineTo(x + 48, y + 33) }; ctx.stroke()
        if (variant) { line([x + 66, y + 32], [x + 93, y + 32], '#bbd8df', 1); dot([x + 70 + (t * 25 + col * 5) % 20, y + 32], 2, '#22af98') }
      }
      round(150 + sweep, 123, 4, 508, '#35bba7', 2)
    } else if (mode === 'attacks') {
      const nodes = orbit(12, 470, 246)
      nodes.forEach((n, i) => { const blocked = i % 3 === 0; line(n, [640, 360], blocked ? '#e1afa2' : '#a9d5d9'); packet(n, [640, 360], i * .16, blocked ? '#db7564' : '#20ad96'); round(n[0] - 25, n[1] - 20, 50, 40, blocked ? '#e9c3b8' : '#b5dfd7'); if (blocked) { line([n[0] - 9, n[1] - 9], [n[0] + 9, n[1] + 9], '#b35849', 3); line([n[0] + 9, n[1] - 9], [n[0] - 9, n[1] + 9], '#b35849', 3) } })
      ring([640, 360], variant ? 180 : 150, '#44b69a', 0, TAU, 5); shield()
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; round(640 + Math.cos(a) * 182 - 5, 360 + Math.sin(a) * 182 - 5, 10, 10, '#1b9987', 2) }
    } else if (mode === 'iot') {
      round(478, 215, 324, 292, '#0e5462', 19); round(555, 270, 170, 142, '#bad5dc', 8)
      for (let i = 0; i < 12; i++) { round(461, 235 + i * 21, 27, 7, '#8cb4b5', 1); round(792, 235 + i * 21, 27, 7, '#8cb4b5', 1) }
      for (let i = 0; i < 5; i++) { line([575, 290 + i * 22], [705, 290 + i * 22], '#7a9fac', 3); dot([695, 290 + i * 22], 3, '#e1f7f4') }
      const sensors: Point[] = [[265, 170], [1030, 170], [265, 555], [1030, 555]]
      sensors.forEach((s, i) => {
        const anchor: Point = [i % 2 ? 819 : 461, s[1] < 360 ? 276 : 444]
        ctx.strokeStyle = '#5ca8b2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...s); ctx.lineTo(s[0], anchor[1]); ctx.lineTo(...anchor); ctx.stroke(); packet(s, anchor, i * .3)
        ring(s, 45, '#a3d6d9', 0, TAU, 2)
        const cold = weather === 'snow' || weather === 'blizzard'
        if (i === 0) { round(s[0] - 8, s[1] - 25, 16, 45, cold ? '#4a9bde' : '#22b596', 8); dot([s[0], s[1] + 22], 14, cold ? '#4a9bde' : '#22b596') }
        else if (i === 1) { ctx.fillStyle = '#53a8d7'; ctx.beginPath(); ctx.moveTo(s[0], s[1] - 30); ctx.bezierCurveTo(s[0] + 40, s[1] + 10, s[0] + 24, s[1] + 35, s[0], s[1] + 30); ctx.bezierCurveTo(s[0] - 24, s[1] + 35, s[0] - 40, s[1] + 10, s[0], s[1] - 30); ctx.fill() }
        else for (let r = 0; r < 3; r++) ring(s, 10 + (t * (variant ? 30 : 20) + r * 17) % (35 + distance / 10), '#34b89e', -.9, .9, 3)
      })
      dot([526, 459], 7, Math.sin(t * 3) > 0 ? '#45dfaf' : '#235b61')
      if (variant) for (let k = 0; k < 3; k++) { ctx.strokeStyle = ['#27b69d', '#64a5dd', '#dcac52'][k]; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x < 250; x += 3) { const y = 315 + k * 35 + Math.sin(x * .08 - t * 2 + k) * 9; if (!x) ctx.moveTo(20, y); else ctx.lineTo(20 + x, y) }; ctx.stroke() }
    } else {
      const rows = variant ? 6 : 4
      for (let i = 0; i < rows; i++) {
        const y = 120 + i * (480 / (rows - 1))
        round(120, y - 24, 85, 48, '#187e91', 8); round(1075, y - 24, 85, 48, '#125369', 8)
        line([205, y], [1075, y], '#b6d5e1', 2)
        for (let j = 0; j < 4; j++) {
          const direction = i % 2 ? -1 : 1, p = network ? (t * (.1 + network / 330) + j * .25 + i * .13) % 1 : j * .25
          const x = 225 + (direction === 1 ? p : 1 - p) * 815
          round(x, y - 14, 50, 28, ['#29b49b', '#4c9edb', '#5fb8c4'][i % 3], 5)
          line([x + 11, y - 5], [x + 35, y - 5], '#dbf9f4', 2); line([x + 11, y + 4], [x + 26, y + 4], '#dbf9f4', 2)
        }
        if (variant && i < rows - 1) line([640, y + 16], [640, y + 480 / (rows - 1) - 16], '#85b7c9', 2)
      }
    }
    ctx.restore()
  }
  const p = t % 10, fade = Math.min(1, p / .65)
  if (t >= 10 && fade < 1) scene(t - 10, 1 - fade)
  scene(t, t < 10 ? 1 : fade)
  const active = laptopSceneAt(t, selection), content = LAPTOP_CONTENT[active.mode]
  round(0, 0, 1280, 64, '#12394c', 0)
  text('IFA', 20, 40, '#b1f2df', 22)
  MODES.forEach((mode, i) => { const x = 90 + i * 196; if (mode === active.mode) round(x, 10, 189, 45, '#26758a', 6); text(LAPTOP_MENU[i], x + 12, 39, mode === active.mode ? '#fff' : '#b9d3df', 18) })
  text(content.pages[active.variant], 26, 104, '#234f64', 23)
  round(26, 635, 795, 62, '#daeeed', 7)
  text('●  '+(active.mode === 'attacks' ? 'Detect → isolate → recover' : active.mode === 'protocols' ? 'Discover → connect → deliver' : active.mode === 'iot' ? 'Sample → sign → publish' : 'Inspect → verify → record'), 44, 673, '#167b6b', 20)
  round(858, 82, 404, 356, '#103348', 8)
  round(858, 82, 404, 35, '#204b61', 8); text(content.file, 872, 106, '#d4edf7', 16, true)
  const cycle = (t + 8) % 22
  content.code.forEach((code, i) => {
    const y = 137 + i * 17
    if (y > 423) return
    const visible = Math.max(0, Math.min(code.length, Math.floor((cycle * 90) - i * 36)))
    text(String(i + 1).padStart(2, '0'), 870, y, '#628da7', 12, true)
    text(code.slice(0, visible), 896, y, code.startsWith('from') || code.includes('assert') ? '#8bded1' : code.includes('"') ? '#efd69b' : '#c2ddea', 13, true)
  })
  round(858, 452, 404, 245, '#082735', 8); text('CLI / local fixture', 874, 479, '#9bc2d4', 16, true)
  const count = Math.min(content.cli.length, 2 + Math.floor(t % 18 / 2))
  content.cli.slice(0, count).forEach((log, i) => text(log, 872, 510 + i * 25, i ? '#8fdcbe' : '#d9ebf3', 13, true))
  text(Math.floor(t * 2) % 2 ? '▌' : '', 872, 510 + count * 25, '#9bf2d5', 15, true)
}
