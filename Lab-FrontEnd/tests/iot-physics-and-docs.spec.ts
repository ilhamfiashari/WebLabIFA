import { expect, test } from '@playwright/test'

const student = {
  id: '00000000-0000-0000-0000-0000000000s1',
  name: 'Nadia Mahasiswa',
  email: '122140001@student.itera.ac.id',
  role: 'mahasiswa',
  allowed_roles: ['mahasiswa'],
  home_route: '/lab',
  csrf_token: 'csrf-student',
  expires_at: '2026-11-26T20:00:00Z',
}

const lecturer = {
  id: '00000000-0000-0000-0000-0000000000d1',
  name: 'Dr. Ilham Dosen',
  email: 'firman.ashari@if.itera.ac.id',
  role: 'dosen',
  allowed_roles: ['dosen', 'admin'],
  home_route: '/lab/dosen',
  csrf_token: 'csrf-dosen',
  expires_at: '2026-11-26T20:00:00Z',
}

const admin = {
  id: '00000000-0000-0000-0000-0000000000a1',
  name: 'Rani Admin',
  email: 'rani@example.test',
  role: 'admin',
  allowed_roles: ['dosen', 'admin'],
  home_route: '/lab/admin',
  csrf_token: 'csrf-admin',
  expires_at: '2026-11-26T20:00:00Z',
}

async function mockCommonApi(page: import('@playwright/test').Page, user: typeof student) {
  await page.route('**/api/me', (route) => route.fulfill({ json: user }))
  await page.route('**/api/notifications', (route) => route.fulfill({ json: { items: [], unread: 0 } }))
  await page.route('**/api/account/presence', (route) => route.fulfill({ json: { ok: true } }))
  await page.route('**/api/dashboard/**', (route) => route.fulfill({ json: null }))
  await page.route('**/api/iot/**', (route) =>
    route.fulfill({
      json: {
        projects: [],
        completed_missions: [],
        mission_states: [],
        access: { can_access_iot_studio: true, can_submit_assignments: true, iot_track_enabled: true },
      },
    }),
  )
}

test('Ohm law resistor-LED brightness scales smoothly on Anode & Cathode sides and supports Relay/Pushbutton switching', async ({ page }) => {
  await page.goto('/login')
  const metrics = await page.evaluate(async () => {
    const modPath = '/src/iot/firmwareVm.ts'
    const vmMod = await import(/* @vite-ignore */ modPath)

    const code = `void setup() {
  pinMode(2, OUTPUT);
  digitalWrite(2, HIGH);
}
void loop() {
  delay(100);
}`
    const compiled = vmMod.compileArduinoSketch(code)

    const evalResistance = (ohms: number, cathodeSide = false) => {
      const comps = [
        { id: 'r1', kind: 'resistor' as const, x: 200, y: 100, label: `R1 (${ohms}Ω)`, ohms, props: {} },
        { id: 'led1', kind: 'led' as const, x: 320, y: 100, label: 'LED1', color: 'red', props: {} },
      ]
      const wires = cathodeSide
        ? [
            { id: 'w1', from: { nodeId: 'board', pinId: 'GPIO2' }, to: { nodeId: 'led1', pinId: 'A' }, color: '#ef4444' },
            { id: 'w2', from: { nodeId: 'led1', pinId: 'K' }, to: { nodeId: 'r1', pinId: 'P1' }, color: '#1e293b' },
            { id: 'w3', from: { nodeId: 'r1', pinId: 'P2' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
          ]
        : [
            { id: 'w1', from: { nodeId: 'board', pinId: 'GPIO2' }, to: { nodeId: 'r1', pinId: 'P1' }, color: '#ef4444' },
            { id: 'w2', from: { nodeId: 'r1', pinId: 'P2' }, to: { nodeId: 'led1', pinId: 'A' }, color: '#ef4444' },
            { id: 'w3', from: { nodeId: 'led1', pinId: 'K' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
          ]
      const ctx = vmMod.createVmContext('esp32-c3', compiled, comps, wires)
      vmMod.stepSetup(ctx, comps, wires)
      return { led: ctx.sim.ledBrightness.led1, alerts: ctx.sim.alerts }
    }

    const r220 = evalResistance(220, false)
    const r1k = evalResistance(1000, false)
    const r10k = evalResistance(10000, false)
    const r1m = evalResistance(1000000, false)
    const rCathode1k = evalResistance(1000, true)

    // Test hardware pushbutton inline switching (3V3 -> Button -> 220Ω -> LED -> GND)
    const btnComps = (pressed: boolean) => [
      { id: 'btn1', kind: 'pushbutton' as const, x: 180, y: 100, label: 'BTN', props: { pressed } },
      { id: 'r1', kind: 'resistor' as const, x: 260, y: 100, label: 'R1', ohms: 220, props: {} },
      { id: 'led1', kind: 'led' as const, x: 360, y: 100, label: 'LED1', color: 'green', props: {} },
    ]
    const btnWires = [
      { id: 'bw1', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'btn1', pinId: 'OUT' }, color: '#ef4444' },
      { id: 'bw2', from: { nodeId: 'btn1', pinId: 'GND' }, to: { nodeId: 'r1', pinId: 'P1' }, color: '#22c55e' },
      { id: 'bw3', from: { nodeId: 'r1', pinId: 'P2' }, to: { nodeId: 'led1', pinId: 'A' }, color: '#22c55e' },
      { id: 'bw4', from: { nodeId: 'led1', pinId: 'K' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
    ]
    const emptyCompiled = vmMod.compileArduinoSketch(`void setup() {
}
void loop() {
  delay(100);
}`)
    const ctxOff = vmMod.createVmContext('esp32-c3', emptyCompiled, btnComps(false), btnWires)
    vmMod.stepSetup(ctxOff, btnComps(false), btnWires)
    const ctxOn = vmMod.createVmContext('esp32-c3', emptyCompiled, btnComps(true), btnWires)
    vmMod.stepSetup(ctxOn, btnComps(true), btnWires)

    // Test Relay COM -> NO switching an LED load
    const relComps = [
      { id: 'rel1', kind: 'relay' as const, x: 200, y: 100, label: 'REL', props: {} },
      { id: 'r1', kind: 'resistor' as const, x: 310, y: 100, label: 'R1', ohms: 220, props: {} },
      { id: 'led1', kind: 'led' as const, x: 400, y: 100, label: 'LED1', color: 'blue', props: {} },
    ]
    const relWires = [
      { id: 'rw1', from: { nodeId: 'board', pinId: 'GPIO2' }, to: { nodeId: 'rel1', pinId: 'IN' }, color: '#38bdf8' },
      { id: 'rw2', from: { nodeId: 'board', pinId: '3V3' }, to: { nodeId: 'rel1', pinId: 'COM' }, color: '#ef4444' },
      { id: 'rw3', from: { nodeId: 'rel1', pinId: 'NO' }, to: { nodeId: 'r1', pinId: 'P1' }, color: '#38bdf8' },
      { id: 'rw4', from: { nodeId: 'r1', pinId: 'P2' }, to: { nodeId: 'led1', pinId: 'A' }, color: '#38bdf8' },
      { id: 'rw5', from: { nodeId: 'led1', pinId: 'K' }, to: { nodeId: 'board', pinId: 'GND1' }, color: '#1e293b' },
    ]
    const ctxRel = vmMod.createVmContext('esp32-c3', compiled, relComps, relWires)
    vmMod.stepSetup(ctxRel, relComps, relWires)

    return {
      r220: r220.led.r,
      r1k: r1k.led.r,
      r10k: r10k.led.r,
      r1m: r1m.led.r,
      rCathode1k: rCathode1k.led.r,
      cathodeAlerts: rCathode1k.alerts.length,
      btnOff: ctxOff.sim.ledBrightness.led1.g,
      btnOn: ctxOn.sim.ledBrightness.led1.g,
      relayLed: ctxRel.sim.ledBrightness.led1.b,
    }
  })

  expect(metrics.r220).toBeGreaterThan(0.9)
  expect(metrics.r1k).toBeLessThan(metrics.r220 - 0.35)
  expect(metrics.r10k).toBeLessThan(metrics.r1k - 0.2)
  expect(metrics.r10k).toBeGreaterThan(0.05)
  expect(metrics.r1m).toBe(0)
  // Cathode-side resistor matches Anode-side brightness and emits zero false NO-RES alerts
  expect(metrics.rCathode1k).toBeCloseTo(metrics.r1k, 2)
  expect(metrics.cathodeAlerts).toBe(0)
  // Pushbutton & Relay physical load switching
  expect(metrics.btnOff).toBe(0)
  expect(metrics.btnOn).toBeGreaterThan(0.8)
  expect(metrics.relayLed).toBeGreaterThan(0.6)
})

test('Documentation menu works across Mahasiswa, Dosen, and Admin portals with search', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  // 1. Mahasiswa
  await mockCommonApi(page, student)
  await page.goto('/lab/dokumentasi')
  await expect(page.getByRole('heading', { level: 1, name: /Dokumentasi IoT Simulator/i })).toBeVisible()
  await page.getByRole('searchbox', { name: /Cari dokumentasi/i }).fill('resistor')
  await page.getByRole('button', { name: /Hukum Ohm, Kecerahan LED/i }).click()
  await expect(page.getByText(/10 kΩ/)).toBeVisible()

  // 2. Dosen
  await page.unrouteAll()
  await mockCommonApi(page, lecturer)
  await page.goto('/lab/dosen/dokumentasi')
  await expect(page.getByRole('heading', { level: 1, name: /Dokumentasi IoT Simulator/i })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dokumentasi' })).toBeVisible()

  // 3. Admin
  await page.unrouteAll()
  await mockCommonApi(page, admin)
  await page.goto('/lab/admin/dokumentasi')
  await expect(page.getByRole('heading', { level: 1, name: /Dokumentasi IoT Simulator/i })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dokumentasi' })).toBeVisible()
})

test('DHT22 sliders never clip at max value and Components filter pills stay visible when scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockCommonApi(page, lecturer)
  await page.goto('/lab/dosen/iot')

  // Open DHT22 + OLED preset via Mission / Preset selector if available, or add DHT22 from Components tab
  await page.getByRole('tab', { name: 'Components' }).click()
  const catGroup = page.getByRole('group', { name: 'Component categories' })
  await expect(catGroup.getByRole('button', { name: 'Sensors' })).toBeVisible()
  await expect(catGroup.getByRole('button', { name: 'Displays' })).toBeVisible()

  // Scroll the components browser down and confirm sticky header keeps all category pills visible
  await page.locator('.iot-components-browser').evaluate((el) => { el.scrollTop = 300 })
  await expect(catGroup.getByRole('button', { name: 'Microcontrollers' })).toBeVisible()
  await expect(catGroup.getByRole('button', { name: 'Sensors' })).toBeVisible()

  // Filter to Sensors and add DHT22 to canvas
  await catGroup.getByRole('button', { name: 'Sensors' }).click()
  await page.getByRole('button', { name: /Tambah DHT22/i }).click()

  // Verify both DHT22 sliders fit strictly inside their foreignObject even when temp = 55°C (max)
  const tempSlider = page.locator('foreignObject input[title="Suhu °C"]').last()
  const humSlider = page.locator('foreignObject input[title="Kelembapan %"]').last()
  await expect(tempSlider).toBeVisible()
  await expect(humSlider).toBeVisible()
  await tempSlider.fill('55')

  const bounds = await page.evaluate(() => {
    const temp = document.querySelector('foreignObject input[title="Suhu °C"]') as HTMLInputElement | null
    const hum = document.querySelector('foreignObject input[title="Kelembapan %"]') as HTMLInputElement | null
    const fo = temp?.closest('foreignObject')
    if (!temp || !hum || !fo) return null
    const fb = fo.getBoundingClientRect()
    const tb = temp.getBoundingClientRect()
    const hb = hum.getBoundingClientRect()
    return {
      foW: fb.width,
      foH: fb.height,
      tempRightDiff: tb.right - fb.right,
      humRightDiff: hb.right - fb.right,
      humBottomDiff: hb.bottom - fb.bottom,
      tempW: tb.width,
      humW: hb.width,
    }
  })

  expect(bounds).not.toBeNull()
  expect(bounds!.tempRightDiff).toBeLessThanOrEqual(2)
  expect(bounds!.humRightDiff).toBeLessThanOrEqual(2)
  expect(bounds!.humBottomDiff).toBeLessThanOrEqual(2)
  expect(bounds!.tempW).toBeLessThanOrEqual(bounds!.foW + 2)
  expect(bounds!.humW).toBeLessThanOrEqual(bounds!.foW + 2)
})
