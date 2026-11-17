// Small physical displays on the rear bench. Everything uses the room's animation clock.
export function createRearInstruments() {
  const scope = document.createElement('canvas'); scope.width = 180; scope.height = 112
  const monitor = document.createElement('canvas'); monitor.width = 288; monitor.height = 164
  const scopeCtx = scope.getContext('2d')!, monitorCtx = monitor.getContext('2d')!
  function drawScope(t: number, channel: number) {
    const ctx = scopeCtx
    ctx.fillStyle = '#092014'; ctx.fillRect(0, 0, 180, 112)
    ctx.strokeStyle = '#24482c'; ctx.lineWidth = .7
    for (let x = 12; x < 180; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 112); ctx.stroke() }
    for (let y = 12; y < 112; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(180, y); ctx.stroke() }
    for (let trace = 0; trace < 2; trace++) {
      ctx.strokeStyle = trace ? '#6aa74a' : '#95ef5a'; ctx.lineWidth = trace ? 1 : 2
      ctx.beginPath()
      for (let x = 0; x <= 180; x++) {
        const phase = x * (.12 + channel * .012) - t * (3.2 + channel * .4)
        const signal = trace ? Math.sin(phase * .48 + .7) * 13 : Math.sin(phase) * 23 + Math.sin(phase * 2.1) * 5
        const y = 55 + signal
        if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    // A gentle phosphor sweep, rather than flashing the whole instrument.
    ctx.fillStyle = '#b3fa7522'; ctx.fillRect((t * 48 + channel * 33) % 190 - 10, 0, 8, 112)
    return scope
  }
  function drawMonitor(t: number, channel: number, network: number) {
    const ctx = monitorCtx, moving = network > 0 ? t : 0
    ctx.fillStyle = '#071c26'; ctx.fillRect(0, 0, 288, 164)
    ctx.fillStyle = '#174454'; ctx.fillRect(0, 0, 288, 12); ctx.fillRect(0, 148, 288, 16)
    ctx.fillStyle = '#52afb8'; ctx.font = '8px sans-serif'; ctx.fillText(channel ? 'Packet telemetry' : 'Signal monitor', 8, 9)
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 3 ? '#27717d' : '#5298a3'
      ctx.fillRect(7, 22 + i * 11, 13 + ((i * 17 + Math.floor(moving * 2)) % 4) * 5, 3)
    }
    ctx.strokeStyle = '#244654'; ctx.lineWidth = .6
    for (let y = 30; y < 145; y += 28) { ctx.beginPath(); ctx.moveTo(48, y); ctx.lineTo(280, y); ctx.stroke() }
    ctx.beginPath(); ctx.moveTo(48, 104)
    for (let x = 0; x <= 232; x += 2) {
      const peak = Math.max(0, Math.sin(x * .115 - moving * 1.7 + channel)) ** 6
      const y = network === 0 ? 101 : 101 - peak * (22 + network * .32) - Math.sin(x * .2 + moving * 1.2) * 3
      ctx.lineTo(48 + x, y)
    }
    ctx.lineTo(280, 106); ctx.closePath(); ctx.fillStyle = '#249ba9'; ctx.fill()
    for (let i = 0; i < 23; i++) {
      const height = network === 0 ? 2 : 3 + (Math.sin(i * .8 + moving * 1.3 + channel) + 1) * 9
      ctx.fillStyle = '#51c6c4'; ctx.fillRect(50 + i * 10, 140 - height, 5, height)
    }
    ctx.fillStyle = '#78cbc5'; ctx.fillRect(9 + (moving * 19) % 220, 154, 20, 3)
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
  const pulse = Math.max(Math.max(0, 1 - Math.abs(phase - .16) / .16), Math.max(0, 1 - Math.abs(phase - .52) / .16))
  return pulse * pulse * (3 - 2 * pulse)
}

export function createGreenLedDimmer(photo: HTMLImageElement, night: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = 88; canvas.height = 244
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const x = 1110, y = 674, ledY = night ? 699 : 708
  ctx.drawImage(photo, x * photo.naturalWidth / 1446, y * photo.naturalHeight / 1087, 88 * photo.naturalWidth / 1446, 244 * photo.naturalHeight / 1087, 0, 0, 88, 244)
  const pixels = ctx.getImageData(0, 0, 88, 244), d = pixels.data
  for (let py = 0; py < 244; py++) for (let px = 0; px < 88; px++) {
    const i = (py * 88 + px) * 4, r = d[i], g = d[i + 1], b = d[i + 2]
    const bulb = Math.exp(-(((px + x - 1150) / 15) ** 2 + ((py + y - ledY) / 20) ** 2))
    const reflection = Math.exp(-(((px + x - 1155) / 22) ** 2 + ((py + y - (night ? 825 : 839)) / 53) ** 2))
    const green = Math.max(0, Math.min(1, (g - Math.max(r, b) - 12) / 50))
    const neutral = (r + b) * .44
    d[i] = neutral; d[i + 1] = neutral * 1.12; d[i + 2] = neutral * .95
    d[i + 3] = Math.round(green * Math.min(1, Math.max(bulb * 2, reflection * 2)) * 255)
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}
