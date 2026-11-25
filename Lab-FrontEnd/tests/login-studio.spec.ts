import os from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { drawLabScreen } from '../src/login/lab-animation'
import { REAR_MONITOR_THEME_COUNT, REAR_SCOPE_THEME_COUNT, rearMonitorThemeAt, rearScopeThemeAt } from '../src/login/rear-instruments'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ status: 401, json: {} }))
  await page.route('**/api/public/weather*', route => route.fulfill({ json: { live: false, condition: 'clear', weather_code: 0 } }))
})

test('studio programs, weather, pause, sensors and persistence', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await expect(page.locator('[data-lab-animation]')).toHaveAttribute('data-screen-resolution', '1920x1080')
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  for (const program of ['security', 'pentest', 'vulnerability', 'attacks', 'web', 'stego', 'iot', 'protocols', 'desktop']) {
    await page.getByLabel('Program laptop').selectOption(program)
    await expect(page.locator('[data-lab-animation]')).toHaveAttribute('data-program', program)
  }
  await page.getByLabel('Pencahayaan ruang').selectOption('day')
  for (const weather of ['clear', 'cloudy', 'drizzle', 'rain', 'storm', 'snow', 'blizzard']) {
    await page.getByLabel('Cuaca di luar').selectOption(weather)
    await expect(page.locator('[data-lab-animation]')).toHaveAttribute('data-weather', weather)
  }
  for (const lighting of ['sunrise', 'day', 'sunset', 'night'] as const) {
    await page.getByLabel('Pencahayaan ruang').selectOption(lighting)
    await expect(page.locator('.hero-image')).toHaveAttribute('src', `/assets/login/lab-${lighting}.webp`)
    await expect(page.locator('[data-lab-animation]')).toHaveAttribute('data-weather', 'blizzard')
  }
  await page.getByLabel('Pencahayaan ruang').selectOption('day')
  await page.getByLabel('Cuaca di luar').selectOption('storm')
  await page.getByLabel('Program laptop').selectOption('iot')
  await page.getByLabel('Aktivitas jaringan').fill('0')
  await page.getByLabel('Jarak ultrasonik').fill('25')
  await page.getByLabel('Tema login').selectOption('dark')
  await expect(page.locator('.login-v2-net-up')).toHaveText('↑ 0.0 Mbps')
  await expect(page.locator('.login-sensor-note')).toContainText('25.')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Studio', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Jeda animasi', exact: true }).click()
  const frame = await page.locator('[data-lab-animation]').getAttribute('data-frame')
  await page.waitForTimeout(350)
  await expect(page.locator('[data-lab-animation]')).toHaveAttribute('data-frame', frame!)
  await page.reload()
  await expect(page.locator('#main')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('#main')).toHaveAttribute('data-paused', 'true')
  await page.getByRole('button', { name: 'Pratinjau studio', exact: true }).click()
  await expect(page.locator('#main')).toHaveAttribute('data-preview', 'true')
  await page.screenshot({ path: path.join(os.tmpdir(), 'lab-studio-storm.png') })
  await page.getByRole('button', { name: 'Kembali ke login', exact: true }).click()
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Atur ulang studio' }).click()
  await expect(page.locator('#main')).toHaveAttribute('data-theme', 'system')
  expect(errors).toEqual([])
})

test('responsive studio and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  const frame = await page.locator('[data-lab-animation]').getAttribute('data-frame')
  await page.waitForTimeout(350)
  await expect(page.locator('[data-lab-animation]')).toHaveAttribute('data-frame', frame!)
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('button', { name: 'Studio', exact: true }).click()
    await expect(page.getByLabel('Tema login')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: path.join(os.tmpdir(), `lab-studio-${width}.png`), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Masuk dengan Google', exact: true })).toBeVisible()
    if (width < 768) await expect(page.getByRole('button', { name: 'Pratinjau studio', exact: true })).toBeHidden()
  }
  await page.getByRole('button', { name: 'Laptop: IoT simulation', exact: true }).click()
  await expect(page.locator('[data-lab-animation]')).toHaveAttribute('data-program', 'iot')
})

test('green board LED pulses and rear instrument pixels move, then freeze on pause', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('ifa-login-studio-v1', JSON.stringify({ time: 'day', weather: 'clear', paused: false })))
  await page.goto('/login')
  await page.getByRole('button', { name: 'Pratinjau studio', exact: true }).click()
  await page.waitForFunction(() => Number(document.querySelector<HTMLCanvasElement>('[data-lab-animation]')?.dataset.greenLed) < .02)
  await page.screenshot({ path: path.join(os.tmpdir(), 'lab-led-green-off.png') })
  await page.waitForFunction(() => Number(document.querySelector<HTMLCanvasElement>('[data-lab-animation]')?.dataset.greenLed) > .8)
  await page.screenshot({ path: path.join(os.tmpdir(), 'lab-led-green-on.png') })
  const readRear = () => page.locator('[data-lab-animation]').evaluate((element: HTMLCanvasElement) => {
    const scale = Math.max(element.clientWidth / 1446, element.clientHeight / 1087) * element.width / element.clientWidth
    const ctx = element.getContext('2d')!
    // Sample only the rear LCDs; laptop, weather and LED changes cannot satisfy this assertion.
    return [[920, 357, 55, 35], [1013, 389, 25, 20]].map(([x, y, w, h]) => {
      const pixels = ctx.getImageData(Math.round(x * scale), Math.round(y * scale), Math.round(w * scale), Math.round(h * scale)).data
      return Array.from(pixels).reduce((sum, value, index) => (sum + value * (index % 31 + 1)) % 1000000007, 0)
    })
  })
  const before = await readRear()
  await expect.poll(readRear).not.toEqual(before)
  const readIndoorLeaves = () => page.locator('[data-lab-animation]').evaluate((element: HTMLCanvasElement) => {
    const scale = Math.max(element.clientWidth / 1446, element.clientHeight / 1087) * element.width / element.clientWidth
    const ctx = element.getContext('2d')!
    const pixels = ctx.getImageData(Math.round(15 * scale), Math.round(15 * scale), Math.round(110 * scale), Math.round(110 * scale)).data
    return Array.from(pixels).reduce((sum, value, index) => (sum + value * (index % 29 + 1)) % 1000000007, 0)
  })
  const leavesBefore = await readIndoorLeaves()
  expect(leavesBefore).toBeGreaterThan(0)
  await expect.poll(readIndoorLeaves).not.toEqual(leavesBefore)
  await page.getByRole('button', { name: 'Jeda animasi', exact: true }).click()
  const frozen = await readRear()
  const leavesFrozen = await readIndoorLeaves()
  await page.waitForTimeout(350)
  expect(await readRear()).toEqual(frozen)
  expect(await readIndoorLeaves()).toEqual(leavesFrozen)
})

test('laptop renders twelve scenes with coding, CLI and selectable menus', async ({ page }) => {
  let textCalls = 0
  const frames: string[] = []
  for (let i = 0; i < 12; i++) {
    const ops: string[] = []
    const gradient = { addColorStop: () => {} }
    const ctx = new Proxy(
      {
        fillText: (value: string, x: number, y: number) => {
          textCalls++
          ops.push(`t:${value}@${Math.round(x)},${Math.round(y)}`)
        },
        measureText: (value: string) => ({ width: value.length * 8 }),
        createLinearGradient: () => gradient,
        createRadialGradient: () => gradient,
      },
      {
        get(target, prop) {
          if (prop in target) return target[prop as keyof typeof target]
          return (...args: unknown[]) => {
            ops.push(`${String(prop)}:${args.map(a => (typeof a === 'number' ? Math.round(a * 10) : String(a))).join(',')}`)
          }
        },
        set(target, prop, value) {
          ;(target as Record<string | symbol, unknown>)[prop] = value
          return true
        },
      },
    ) as unknown as CanvasRenderingContext2D
    drawLabScreen(ctx, i * 10 + 2, 'auto', 'clear', 80, 50)
    frames.push(ops.join('|'))
  }
  expect(new Set(frames).size).toBe(12)
  expect(textCalls).toBeGreaterThan(200)

  // Rear bench monitors and oscilloscopes cycle across distinct visual themes over time and stagger per display
  const monitorThemes = new Set([0, 6, 12, 18, 24].map(sec => rearMonitorThemeAt(sec, 0)))
  const scopeThemes = new Set([0, 6, 12, 18, 24].map(sec => rearScopeThemeAt(sec, 0)))
  expect(monitorThemes.size).toBe(REAR_MONITOR_THEME_COUNT)
  expect(scopeThemes.size).toBe(REAR_SCOPE_THEME_COUNT)
  expect(rearMonitorThemeAt(1, 0)).not.toBe(rearMonitorThemeAt(1, 1))
  expect(new Set([0, 1, 2].map(ch => rearScopeThemeAt(1, ch))).size).toBe(3)

  await page.goto('/login')
  await page.getByRole('button', { name: 'Laptop: Pentest', exact: true }).click()
  await expect(page.locator('[data-lab-animation]')).toHaveAttribute('data-program', 'pentest')
  await page.getByRole('button', { name: 'Pratinjau studio', exact: true }).click()
  await page.getByRole('button', { name: 'Laptop: Attacks', exact: true }).click()
  await expect(page.locator('[data-lab-animation]')).toHaveAttribute('data-program', 'attacks')
  await page.getByRole('button', { name: 'Laptop: IoT simulation', exact: true }).click()
  await expect(page.locator('[data-lab-animation]')).toHaveAttribute('data-program', 'iot')

  // Zoomed Workstation Pop-up: Desktop folders, file preview, and interactive wide Terminal
  await page.getByRole('button', { name: 'Laptop: Zoom workstation', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // Not full-screen: modal width should stay comfortably smaller than 1440px viewport
  const box = await dialog.locator('.ws-window').boundingBox()
  expect(box!.width).toBeLessThan(1200)
  await dialog.getByRole('tab', { name: 'Desktop' }).click()
  await dialog.getByRole('button', { name: 'Steganography' }).first().click()
  await dialog.getByRole('button', { name: /cover_lab\.png/ }).click()
  await expect(dialog.getByText(/FLAG\{IFA_STEGO_LSB_2026\}/)).toBeVisible()
  await dialog.getByRole('button', { name: /Jalankan di Terminal|Run in Terminal/ }).click()
  await expect(dialog.getByRole('log')).toContainText('FLAG{IFA_STEGO_LSB_2026}')
  await dialog.getByLabel(/Input perintah terminal|Terminal command input/).fill('cd ..')
  await page.keyboard.press('Enter')
  await dialog.getByLabel(/Input perintah terminal|Terminal command input/).fill('ls')
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('log')).toContainText('CyberSecurity/')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('workstation popup is symmetrically centered and responsive on 390px mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')

  await page.getByRole('button', { name: 'Zoom Terminal', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  const winBox = (await dialog.locator('.ws-window').boundingBox())!
  const leftGap = winBox.x
  const rightGap = 390 - (winBox.x + winBox.width)
  expect(leftGap).toBeGreaterThanOrEqual(8)
  expect(rightGap).toBeGreaterThanOrEqual(8)
  expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2)

  // Close button and Run button stay inside 390px viewport
  const closeBox = (await dialog.getByRole('button', { name: /Tutup workstation|Close workstation/ }).boundingBox())!
  expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(385)
  const submitBtn = dialog.getByRole('button', { name: /Jalankan perintah|Run command/ })
  await expect(submitBtn).toBeVisible()
  await dialog.getByLabel(/Input perintah terminal|Terminal command input/).fill('whoami')
  await submitBtn.click()
  await expect(dialog.getByRole('log')).toContainText('uid=1000')
  await page.screenshot({ path: path.join(os.tmpdir(), 'ws-mobile-terminal.png') })

  await dialog.getByRole('tab', { name: 'Desktop' }).click()
  const stegoBox = (await dialog.locator('.ws-desktop-icons').getByRole('button', { name: 'Steganography' }).boundingBox())!
  expect(stegoBox.height).toBeLessThan(85)
  expect(stegoBox.x + stegoBox.width).toBeLessThanOrEqual(385)
  await page.screenshot({ path: path.join(os.tmpdir(), 'ws-mobile-desktop.png') })
  await dialog.getByRole('button', { name: /Tutup workstation|Close workstation/ }).click()
  await expect(dialog).toHaveCount(0)
})

test('projected laptop screen has zero triangle grid seams in both WebGL and 2D fallback on mobile', async ({ page }) => {
  for (const disableWebGl of [false, true]) {
    if (disableWebGl) {
      await page.addInitScript(() => {
        const orig = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          type: string,
          ...args: unknown[]
        ) {
          if (type === 'webgl' || type === 'webgl2') return null
          return orig.apply(this, [type, ...args] as Parameters<typeof orig>)
        } as typeof HTMLCanvasElement.prototype.getContext
      })
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/login')
    await page.getByRole('button', { name: 'Studio', exact: true }).click()
    await page.getByLabel('Program laptop').selectOption('attacks')
    await expect(page.locator('[data-lab-animation]')).toHaveAttribute('data-program', 'attacks')

    // Sample top-left light header area inside the laptop canvas: every pixel must remain bright (no dark seam bleed).
    const darkSeamPixels = await page.evaluate(() => {
      const canvas = document.querySelector('[data-lab-animation]') as HTMLCanvasElement | null
      if (!canvas) return -1
      const ctx = canvas.getContext('2d')!
      const rect = canvas.getBoundingClientRect()
      const sx = canvas.width / rect.width
      const sy = canvas.height / rect.height
      const scale = Math.max(rect.width / 1446, rect.height / 1087)
      const offsetX = (rect.width - 1446 * scale) * 0.5
      // Scan across y=338 (below title text, above graph nodes) from x=95..235 in 1446x1087 coords (crosses grid column/diagonal seams)
      let darkCount = 0
      for (let lx = 95; lx <= 235; lx += 2) {
        const px = Math.round((offsetX + lx * scale) * sx)
        const py = Math.round((338 * scale) * sy)
        const d = ctx.getImageData(px, py, 1, 1).data
        if (d[3] < 245 || d[0] < 200 || d[1] < 200 || d[2] < 200) darkCount++
      }
      return darkCount
    })
    expect(darkSeamPixels).toBe(0)
  }
})
