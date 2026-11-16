import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ status: 401, json: { message: 'Sesi tidak aktif' } }))
  await page.route('**/api/public/config', route => route.fulfill({ json: { support_email: 'lab@example.test' } }))
})

for (const width of [360, 390, 768, 1440]) {
  test(`login responsif ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Masuk ke IFA Lab', exact: true })).toBeVisible()
    const button = page.getByRole('button', { name: 'Masuk dengan Google', exact: true })
    await expect(button).toBeVisible()
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect.poll(() => page.evaluate(() => document.fonts.check('16px Inter'))).toBe(true)
    expect(await page.locator('img[src="/assets/google-g.svg"]').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    if (width >= 768) await expect(page.locator('.hero-image')).toBeVisible()
    await page.screenshot({ path: `../docs/screenshots/login-${width}.png`, fullPage: true })
  })
}

test('navigasi keyboard dan tautan informasi', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByText('Lewati ke konten utama')).toBeFocused()
  await page.getByRole('link', { name: 'Kebijakan Privasi' }).click()
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
  await expect(page.getByRole('button', { name: 'Kembali ke Halaman Sekarang' })).toBeVisible()
})
