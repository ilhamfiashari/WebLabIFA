import { useEffect, useRef } from 'react'
import type { SceneDescriptor } from './weatherTime'
import { drawLabScreen, laptopSceneAt, LAPTOP_HEIGHT, LAPTOP_WIDTH } from './lab-animation'
import type { LabWeather, StudioSettings } from './studio-model'
import { createGreenLedDimmer, createRearInstruments, greenLedLevel, REAR_DISPLAYS } from './rear-instruments'

// Native photograph coordinates. The night photograph has a slightly different camera angle.
type Point = [number, number]
const seed = (n: number) => { const x = Math.sin(n * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x) }
function project(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, corners: Point[], columns = 10, rows = 8) {
  // Perspective-correct quad subdivided into triangles; nothing spills onto the bezel.
  const [a, b, c, d] = corners
  const dx1 = b[0] - c[0], dx2 = d[0] - c[0], dx3 = a[0] - b[0] + c[0] - d[0]
  const dy1 = b[1] - c[1], dy2 = d[1] - c[1], dy3 = a[1] - b[1] + c[1] - d[1]
  const det = dx1 * dy2 - dx2 * dy1
  const g = (dx3 * dy2 - dx2 * dy3) / det, h = (dx1 * dy3 - dx3 * dy1) / det
  const point = (u: number, v: number): Point => [((b[0] - a[0] + g * b[0]) * u + (d[0] - a[0] + h * d[0]) * v + a[0]) / (g * u + h * v + 1), ((b[1] - a[1] + g * b[1]) * u + (d[1] - a[1] + h * d[1]) * v + a[1]) / (g * u + h * v + 1)]
  const tri = (uv: Point[]) => {
    const p = uv.map(([u, v]) => point(u, v)), s = uv.map(([u, v]) => [u * source.width, v * source.height])
    const [s0, s1, s2] = s, [p0, p1, p2] = p
    const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1])
    const aa = ((p1[0] - p0[0]) * (s2[1] - s0[1]) - (p2[0] - p0[0]) * (s1[1] - s0[1])) / den
    const bb = ((p1[1] - p0[1]) * (s2[1] - s0[1]) - (p2[1] - p0[1]) * (s1[1] - s0[1])) / den
    const cc = ((p2[0] - p0[0]) * (s1[0] - s0[0]) - (p1[0] - p0[0]) * (s2[0] - s0[0])) / den
    const dd = ((p2[1] - p0[1]) * (s1[0] - s0[0]) - (p1[1] - p0[1]) * (s2[0] - s0[0])) / den
    ctx.save(); ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.lineTo(...p2); ctx.closePath(); ctx.clip()
    ctx.transform(aa, bb, cc, dd, p0[0] - aa * s0[0] - cc * s0[1], p0[1] - bb * s0[0] - dd * s0[1]); ctx.drawImage(source, 0, 0); ctx.restore()
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const u = x / columns, v = y / rows, uu = (x + 1) / columns, vv = (y + 1) / rows
    tri([[u, v], [uu, v], [uu, vv]]); tri([[u, v], [uu, vv], [u, vv]])
  }
}

export function LabScene({ scene, weather, settings, en, onSample }: { scene: SceneDescriptor; weather: LabWeather; settings: StudioSettings; en: boolean; onSample: (seconds: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const current = useRef({ scene, weather, settings, en, onSample })
  const redraw = useRef<(() => void) | null>(null)
  useEffect(() => { current.current = { scene, weather, settings, en, onSample }; redraw.current?.() }, [scene, weather, settings, en, onSample])
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const screen = document.createElement('canvas'); screen.width = LAPTOP_WIDTH; screen.height = LAPTOP_HEIGHT
    const screenCtx = screen.getContext('2d')!
    const instruments = createRearInstruments()
    let greenDimmer: HTMLCanvasElement | null = null
    const foliage = document.createElement('canvas'); foliage.width = 318; foliage.height = 165
    const foliageCtx = foliage.getContext('2d', { willReadFrequently: true })!
    const photo = new Image()
    let sourcePixels: ImageData | null = null, movingPixels: ImageData | null = null, loadedSrc = '', leafFrame = -1
    photo.onload = () => { foliageCtx.clearRect(0, 0, 318, 165); foliageCtx.drawImage(photo, 810, 0, 636, 330, 0, 0, 318, 165); sourcePixels = foliageCtx.getImageData(0, 0, 318, 165); movingPixels = foliageCtx.createImageData(318, 165); greenDimmer = createGreenLedDimmer(photo, ['night', 'sunset'].includes(current.current.scene.key)); leafFrame = -1; resume() }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    let elapsed = 0, previous = 0, last = 0, sampleAt = -1, frame = 0, disposed = false
    function paint() {
      if (!canvas || !ctx) return
      const { scene, weather, settings } = current.current
      const night = scene.key === 'night', warmAngle = night || scene.key === 'sunset', t = elapsed, w = canvas.clientWidth, h = canvas.clientHeight
      if (loadedSrc !== scene.src) { loadedSrc = scene.src; sourcePixels = null; movingPixels = null; greenDimmer = null; photo.src = scene.src }
      ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0); ctx.clearRect(0, 0, w, h)
      const scale = Math.max(w / 1446, h / 1087)
      // Same cover crop as the photograph, including the tablet's 32% object position.
      ctx.translate((w - 1446 * scale) * (innerWidth <= 1080 ? .32 : 0), 0); ctx.scale(scale, scale)
      drawLabScreen(screenCtx, t, settings.program, weather, settings.distance, settings.network)
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
      project(ctx, screen, warmAngle ? [[43, 248], [736, 281], [790, 665], [85, 730]] : [[43, 246], [752, 284], [802, 687], [87, 740]])
      const led = (x: number, y: number, color: string, active: boolean, radius = 2) => {
        if (!active) { ctx.save(); const dim = ctx.createRadialGradient(x, y, 0, x, y, radius * 4); dim.addColorStop(0, 'rgba(5,8,9,.7)'); dim.addColorStop(1, 'rgba(5,8,9,0)'); ctx.fillStyle = dim; ctx.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8); ctx.restore() }
        ctx.fillStyle = active ? color : '#243a2c'; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill()
        if (active) { ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(x, y, 0, x, y, radius * 5); g.addColorStop(0, color + 'b0'); g.addColorStop(1, color + '00'); ctx.fillStyle = g; ctx.fillRect(x - radius * 5, y - radius * 5, radius * 10, radius * 10); ctx.restore() }
      }
      const packet = settings.network > 0 && (t % (3 - settings.network * .018)) < .17
      led(night ? 960 : 982, night ? 683 : 699, '#ff4437', reduce.matches || t % 2 < .2 || (t % 2 > .35 && t % 2 < .48), 3.2)
      led(night ? 943 : 945, night ? 680 : 700, '#659cff', true, 2)
      const greenLevel = greenLedLevel(t, settings.distance, reduce.matches)
      if (greenDimmer) { ctx.save(); ctx.globalAlpha = 1 - greenLevel; ctx.drawImage(greenDimmer, 1110, 674); ctx.restore() }
      // The painted bulb and the desk reflection share the same light envelope.
      if (greenLevel > 0) {
        ctx.save(); ctx.globalAlpha = greenLevel
        led(1150, warmAngle ? 699 : 708, '#64ff72', true, 4)
        ctx.translate(1155, warmAngle ? 825 : 839); ctx.scale(.7, 1.7)
        const reflection = ctx.createRadialGradient(0, 0, 0, 0, 0, 35)
        reflection.addColorStop(0, '#68ff6438'); reflection.addColorStop(1, '#68ff6400')
        ctx.fillStyle = reflection; ctx.fillRect(-35, -35, 70, 70); ctx.restore()
      }
      for (let i = 0; i < 7; i++) led((night ? 670 : 685) + i * 4.6, (night ? 154 : 158) + i * .46, '#7efb76', i === 0 || (settings.network > 0 && (t * (1 + settings.network / 45) + i * .24) % 1.7 < 1.1), 1.35)
      for (let i = 0; i < 20; i++) led(196 + i * 7.5, 91 + i * .66, '#a0ed56', i === 0 || (settings.network > 0 && (t * 1.7 + i * .17) % 2 < .8), 1.4)
      if (settings.network > 0) for (let i = 0; i < 8; i++) {
        const p = (t * (.25 + settings.network / 120) + i * .19) % 1
        ctx.save(); ctx.globalAlpha = Math.sin(p * Math.PI) * .8; ctx.fillStyle = '#85e7ff'; ctx.beginPath(); ctx.ellipse(207 + i * 9 + Math.sin(p * Math.PI) * 11, 173 + p * 51, 1.4, 2.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      }
      if (packet) { ctx.save(); ctx.globalAlpha = .35; ctx.strokeStyle = '#9be8d3'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(night ? 672 : 698, 146, 15 + (t % 1) * 15, 4 + (t % 1) * 5, 0, Math.PI, Math.PI * 2); ctx.stroke(); ctx.restore() }
      // Ultrasonic echo leaves the transducer in a short burst rather than floating through the room.
      if (laptopSceneAt(t, settings.program).mode === 'iot' && !reduce.matches) {
        ctx.save(); ctx.globalAlpha = (1 - t % 1.6 / 1.6) * .22; ctx.strokeStyle = '#79d2df'; ctx.lineWidth = 1.2
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(1382 + (t % 1.6) * 18 + i * 10, 707, 5 + i * 3, 12 + i * 5, 0, -.9, .9); ctx.stroke() }; ctx.restore()
      }
      // Window panes exclude the steel mullions and all indoor devices.
      ctx.save(); ctx.beginPath()
      ctx.moveTo(810, 0); ctx.lineTo(1446, 0); ctx.lineTo(1446, 372); ctx.lineTo(1210, 363); ctx.lineTo(1210, 307); ctx.lineTo(1120, 307); ctx.lineTo(1087, 235); ctx.lineTo(1004, 250); ctx.lineTo(1004, 326); ctx.lineTo(810, 330); ctx.closePath(); ctx.clip()
      for (const [x, y, ww, hh] of [[900, 0, 17, 360], [1166, 0, 17, 360], [1340, 0, 13, 370], [810, 202, 636, 22], [810, 49, 636, 18]]) ctx.clearRect(x, y, ww, hh)
      // Pane clipping is also applied to subsequent particles (clearRect alone would not exclude them).
      const panes = new Path2D(); panes.rect(810, 0, 90, 49); panes.rect(918, 0, 248, 49); panes.rect(810, 68, 90, 134); panes.rect(918, 68, 248, 134); panes.rect(1184, 0, 156, 202); panes.rect(1354, 0, 92, 202); panes.rect(810, 225, 90, 105); panes.rect(918, 225, 87, 101); panes.rect(1184, 225, 156, 105); panes.rect(1354, 225, 92, 147); ctx.clip(panes)
      // Inverse-sample only green canopy pixels. Window frames and equipment stay rigid.
      if (sourcePixels && movingPixels && settings.leaves && !night) {
        if (Math.floor(t * 12) !== leafFrame) {
          leafFrame = Math.floor(t * 12)
          const src = sourcePixels.data, dst = movingPixels.data
          for (let y = 0; y < 165; y++) for (let x = 0; x < 318; x++) {
            const i = (y * 318 + x) * 4, green = src[i + 1] > src[i] * 1.08 && src[i + 1] > src[i + 2] * 1.12
            const dx = green ? Math.round(Math.sin(t * .8 + y * .06) * (weather === 'storm' ? 2 : 1)) : 0
            const dy = green ? Math.round(Math.sin(t * .6 + x * .04) * .7) : 0
            const j = (Math.max(0, Math.min(164, y + dy)) * 318 + Math.max(0, Math.min(317, x + dx))) * 4
            dst[i] = src[j]; dst[i + 1] = src[j + 1]; dst[i + 2] = src[j + 2]; dst[i + 3] = 255
          }
          foliageCtx.putImageData(movingPixels, 0, 0)
        }
        ctx.drawImage(foliage, 810, 0, 636, 330)
      }
      const wet = ['drizzle', 'rain', 'storm'].includes(weather), snow = weather === 'snow' || weather === 'blizzard', storm = weather === 'storm' || weather === 'blizzard'
      if (wet || snow) {
        const count = storm ? 180 : weather === 'drizzle' ? 45 : 100
        for (let i = 0; i < count; i++) {
          const depth = .3 + seed(i) * .7, speed = snow ? 20 + depth * 25 : weather === 'drizzle' ? 180 : 340
          const y = (seed(i + 60) * 450 + t * speed) % 450 - 40, x = 805 + (seed(i + 400) * 660 + t * (storm ? 100 : 14) + Math.sin(t + i) * (snow ? 12 : 1)) % 660
          ctx.globalAlpha = depth * (snow ? .8 : .4); ctx.fillStyle = '#e8f4ff'; ctx.strokeStyle = '#d8e9f4'
          if (snow) { ctx.beginPath(); ctx.ellipse(x, y, depth * 2.6, depth * 2, t + i, 0, Math.PI * 2); ctx.fill() }
          else { ctx.lineWidth = depth; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (storm ? 7 : 1), y + depth * (storm ? 22 : 12)); ctx.stroke() }
        }
        if (wet) for (let i = 0; i < 26; i++) {
          const age = (t / (6 + seed(i) * 8) + seed(i + 90)) % 1
          const x = 822 + seed(i + 33) * 620, y = 35 + seed(i + 23) * 220 + Math.max(0, age - .45) ** 2 * 290
          ctx.globalAlpha = Math.sin(age * Math.PI) * .45; ctx.strokeStyle = '#edf7ff'; ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(x, y, 1.5 + age, 3 + age * 3, 0, 0, Math.PI * 2); ctx.stroke()
          // Expanding impact rings on the outside sill.
          const ripple = (t * .7 + seed(i + 12)) % 1; ctx.globalAlpha = (1 - ripple) * .22; ctx.beginPath(); ctx.ellipse(x, 323 + seed(i) * 9, ripple * 10, ripple * 2, 0, 0, Math.PI * 2); ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      if (settings.leaves && !snow) for (let i = 0; i < (storm ? 16 : 8); i++) {
        const p = (t / (storm ? 6 : 17) + seed(i + 9)) % 1, x = 820 + seed(i + 48) * 540 + Math.sin(p * 8 + i) * (storm ? 45 : 22), y = p * 420 - 25
        ctx.save(); ctx.translate(x, y); ctx.rotate(p * 7 + i); ctx.scale(Math.cos(p * 8 + i) * .7 + .3, 1); ctx.fillStyle = ['#839b39', '#b4a453', '#547939'][i % 3]; ctx.globalAlpha = Math.min(1, p * 8, (1 - p) * 8) * .8; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.quadraticCurveTo(0, -6, 6, 0); ctx.quadraticCurveTo(0, 4, -5, 0); ctx.fill(); ctx.restore()
      }
      if (weather === 'storm' && !reduce.matches) { const phase = t % 23; if (phase > 8 && phase < 8.6) { ctx.globalAlpha = Math.sin((phase - 8) / .6 * Math.PI) * .13; ctx.fillStyle = '#dce8ff'; ctx.fillRect(800, 0, 646, 370) } }
      ctx.restore()
      const rear = REAR_DISPLAYS[warmAngle ? 'night' : 'day']
      ctx.save(); ctx.filter = 'blur(.3px)'
      rear.monitors.forEach((quad, i) => project(ctx, instruments.drawMonitor(t, i, settings.network), quad, 3, 2))
      rear.scopes.forEach((quad, i) => project(ctx, instruments.drawScope(t, i), quad, 3, 2))
      ctx.restore()
      canvas.dataset.frame = String(Math.floor(elapsed * 30)); canvas.dataset.program = settings.program; canvas.dataset.weather = weather
      canvas.dataset.greenLed = greenLevel.toFixed(3)
      canvas.dataset.screenResolution = `${screen.width}x${screen.height}`
      const laptopScene = laptopSceneAt(t, settings.program)
      canvas.dataset.laptopScene = `${laptopScene.mode}-${laptopScene.variant}`
    }
    function tick(now: number) {
      frame = 0
      if (disposed || current.current.settings.paused || reduce.matches || document.hidden || !canvas?.getBoundingClientRect().width) { previous = 0; return }
      if (previous) elapsed += Math.min((now - previous) / 1000, .1)
      previous = now
      if (now - last >= 1000 / 30) { paint(); last = now }
      if (Math.floor(elapsed) !== sampleAt) { sampleAt = Math.floor(elapsed); current.current.onSample(elapsed) }
      frame = requestAnimationFrame(tick)
    }
    const resume = () => { paint(); if (!frame && !disposed && !current.current.settings.paused && !reduce.matches && !document.hidden) { previous = 0; frame = requestAnimationFrame(tick) } }
    const resize = () => { const r = canvas.getBoundingClientRect(); canvas.width = Math.max(1, Math.round(r.width * Math.min(devicePixelRatio, 2))); canvas.height = Math.max(1, Math.round(r.height * Math.min(devicePixelRatio, 2))); resume() }
    redraw.current = resume
    const observer = new ResizeObserver(resize); observer.observe(canvas)
    reduce.addEventListener('change', resume); document.addEventListener('visibilitychange', resume); resize()
    return () => { disposed = true; photo.onload = null; cancelAnimationFrame(frame); observer.disconnect(); reduce.removeEventListener('change', resume); document.removeEventListener('visibilitychange', resume); redraw.current = null }
  }, [])
  return <canvas ref={canvasRef} className="login-lab-effects" aria-hidden="true" data-lab-animation />
}
