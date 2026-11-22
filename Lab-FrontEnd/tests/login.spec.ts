import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ status: 401, json: { message: 'Sesi tidak aktif' } }))
  await page.route('**/api/public/config', route => route.fulfill({ json: { support_email: 'lab@example.test' } }))
  await page.route('**/api/public/weather*', route =>
    route.fulfill({
      json: {
        live: true,
        condition: 'clear',
        weather_code: 0,
        temperature_c: 28,
        is_day: true,
        sunrise: '2026-11-16T05:35',
        sunset: '2026-11-16T17:50',
        timezone: 'Asia/Jakarta',
      },
    }),
  )
})

for (const width of [360, 390, 768, 1440]) {
  test(`login responsif ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/login')
    const title = page.getByRole('heading', { name: 'Lab Virtual', exact: true })
    const hero = page.locator('.hero-image')
    await expect(title).toBeVisible()
    await expect(hero).toBeVisible()
    await expect(page.getByText('Cybersec · IoT · Web', { exact: true })).toBeVisible()
    const button = page.getByRole('button', { name: 'Masuk dengan Google', exact: true })
    await expect(button).toBeVisible()
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect.poll(() => page.evaluate(() => document.fonts.check('16px Inter'))).toBe(true)
    expect(await page.locator('img[src="/assets/google-g.svg"]').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    if (width >= 900) {
      await expect(page.getByTestId('login-atmosphere')).toBeVisible()
    } else {
      const expectedPhotoHeight = await hero.evaluate(async (image: HTMLImageElement) => {
        await image.decode()
        return image.clientWidth * image.naturalHeight / image.naturalWidth
      })
      const photo = (await hero.boundingBox())!
      const header = (await page.locator('.login-v2-header').boundingBox())!
      expect(photo.x).toBe(0)
      expect(photo.width).toBe(width)
      expect(Math.abs(photo.height - expectedPhotoHeight)).toBeLessThan(2)
      expect(photo.y).toBeGreaterThanOrEqual(header.y + header.height)
      await expect(page.locator('.login-lab-stage')).toHaveCSS('mask-image', 'none')
      expect(photo.y + photo.height).toBeLessThan((await title.boundingBox())!.y)
      const panelOwnsOverlap = await page.locator('.login-v2-left').evaluate(panel => {
        const { x, y, width } = panel.getBoundingClientRect()
        return panel.contains(document.elementFromPoint(x + width / 2, y + 1))
      })
      expect(panelOwnsOverlap).toBe(true)
      await expect(button).toBeInViewport()
      await expect(page.getByText('Gunakan akun Google yang terdaftar.', { exact: true })).toBeVisible()
      await expect(page.getByTestId('login-atmosphere')).toBeHidden()
    }
    await page.screenshot({ path: `../docs/screenshots/login-${width}.png`, fullPage: true })
  })
}

test('toggle bahasa ID/EN dan pergantian background waktu serta cuaca realtime berfungsi', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T11:30:00') })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await expect(page.locator('.hero-image')).toHaveAttribute('src', '/assets/login/lab-day.webp')

  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Virtual Lab', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in with Google', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ID', exact: true }).click()

  await page.clock.setFixedTime(new Date('2026-11-16T06:00:00'))
  await page.clock.fastForward(16_000)
  await expect(page.locator('.hero-image')).toHaveAttribute('src', '/assets/login/lab-sunrise.webp')

  await page.clock.setFixedTime(new Date('2026-11-16T17:35:00'))
  await page.clock.fastForward(16_000)
  await expect(page.locator('.hero-image')).toHaveAttribute('src', '/assets/login/lab-sunset.webp')

  await page.clock.setFixedTime(new Date('2026-11-16T22:15:00'))
  await page.clock.fastForward(16_000)
  await expect(page.locator('.hero-image')).toHaveAttribute('src', '/assets/login/lab-night.webp')

  await page.unroute('**/api/public/weather*')
  await page.route('**/api/public/weather*', route =>
    route.fulfill({
      json: {
        live: true,
        condition: 'rain',
        weather_code: 63,
        temperature_c: 23,
        is_day: true,
        sunrise: null,
        sunset: null,
        timezone: 'Asia/Jakarta',
      },
    }),
  )
  await page.reload()
  await expect(page.locator('.hero-image')).toHaveAttribute('src', '/assets/login/lab-rainy.webp')

  await page.unroute('**/api/public/weather*')
  await page.route('**/api/public/weather*', route =>
    route.fulfill({
      json: {
        live: true,
        condition: 'snow',
        weather_code: 73,
        temperature_c: -1,
        is_day: true,
        sunrise: null,
        sunset: null,
        timezone: 'Asia/Jakarta',
      },
    }),
  )
  await page.reload()
  await expect(page.locator('.hero-image')).toHaveAttribute('src', '/assets/login/lab-snowy.webp')
})

test('navigasi keyboard dan tautan informasi', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByText('Lewati ke konten utama')).toBeFocused()
  await page.getByRole('link', { name: 'Privasi', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Kebijakan Privasi', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'halaman Bantuan' }).click()
  await expect(page.getByRole('link', { name: 'lab@example.test' })).toHaveAttribute('href', 'mailto:lab@example.test')
})

for (const status of ['cancelled', 'expired', 'temporary', 'unauthorized']) {
  test(`status login ${status}`, async ({ page }) => {
    await page.goto(`/login?status=${status}`)
    await expect(page.getByRole('status')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Masuk dengan Google', exact: true })).toBeEnabled()
  })
}

test('CTA memulai OAuth dan menampilkan status pengalihan', async ({ page }) => {
  await page.route('**/api/auth/google/start', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Provider uji</h1>' }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Masuk dengan Google', exact: true }).click()
  await expect(page).toHaveURL(/\/api\/auth\/google\/start$/)
  await expect(page.getByRole('heading', { name: 'Provider uji' })).toBeVisible()
})

test('akses /lab tanpa sesi kembali ke login', async ({ page }) => {
  await page.goto('/lab')
  await expect(page).toHaveURL(/\/login\?status=expired$/)
})

test('identitas dirender sebagai teks dan logout memakai CSRF', async ({ page }) => {
  const user = { id: '00000000-0000-0000-0000-000000000001', name: '<img src=x onerror=alert(1)>', email: 'rani@example.test', role: 'mahasiswa', csrf_token: 'csrf-fixture', expires_at: '2026-11-14T20:00:00Z' }
  await page.unroute('**/api/me')
  await page.route('**/api/me', route => route.fulfill({ json: user }))
  let csrf = ''
  await page.route('**/api/auth/logout', async route => { csrf = route.request().headers()['x-csrf-token']; await page.unroute('**/api/me'); await page.route('**/api/me', r => r.fulfill({ status: 401 })); await route.fulfill({ status: 204 }) })
  await page.route('**/api/latihan', route => route.fulfill({ json: { levels: [], tracks: [] } }))
  await page.goto('/lab')
  await expect(page.getByText('Sesi aktif', { exact: true })).toBeVisible()
  await expect(page.locator('.session-card img, .page-head img, .account-info img')).toHaveCount(0)
  await page.screenshot({ path: '../docs/screenshots/lab-session-fixture.png', fullPage: true })
  await page.getByRole('button', { name: 'Menu akun' }).click()
  await page.getByRole('menuitem', { name: 'Keluar' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(csrf).toBe('csrf-fixture')
})

test('gangguan sesi tidak menampilkan identitas palsu', async ({ page }) => {
  await page.unroute('**/api/me')
  await page.route('**/api/me', route => route.fulfill({ status: 503 }))
  await page.goto('/lab')
  await expect(page.getByRole('heading', { name: 'Gangguan layanan sementara' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Coba Lagi' })).toBeVisible()
})
