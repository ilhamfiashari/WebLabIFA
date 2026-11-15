import { expect, test, type Page } from '@playwright/test'

const admin = { id: '00000000-0000-0000-0000-0000000000a1', name: 'Rani Admin', email: 'rani@example.test', role: 'admin', allowed_roles: ['dosen', 'admin'], home_route: '/lab/admin', csrf_token: 'csrf-fixture', expires_at: '2026-11-15T20:00:00Z' }

test.beforeEach(async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ json: admin }))
  await page.route('**/api/dashboard/admin', route => route.fulfill({ json: null }))
})

const pages = [
  ['/lab/admin', 'Beranda Admin'], ['/lab/admin/pengguna', 'Pengguna & Akses'], ['/lab/admin/kelas', 'Kelas'],
  ['/lab/admin/katalog', 'Katalog & Publikasi'], ['/lab/admin/audit', 'Audit Log'], ['/lab/admin/pengaturan', 'Pengaturan'],
] as const

async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

for (const width of [390, 768, 1440]) {
  test(`halaman admin responsif ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    await page.setViewportSize({ width, height: 900 })
    for (const [path, title] of pages) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
      await noOverflow(page)
      if (width !== 768) await page.screenshot({ path: `../docs/screenshots/admin${path.replace('/lab/admin', '').replace('/', '-') || '-beranda'}-${width}.png`, fullPage: true })
    }
    expect(errors).toEqual([])
  })
}

test('navigasi sidebar tanpa memuat ulang dan tombol kembali', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/admin')
  await page.getByRole('navigation', { name: 'Navigasi Admin' }).getByRole('link', { name: 'Audit Log' }).click()
  await expect(page).toHaveURL(/\/lab\/admin\/audit$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Audit Log' })).toBeVisible()
  await expect(page).toHaveTitle('Audit Log · Admin · IFA Lab')
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Beranda Admin' })).toBeVisible()
})

test('filter beranda memperbarui grafik dan tabel data', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/admin')
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Akun unik beraktivitas' }) })
  await card.getByRole('button', { name: 'Tampilkan tabel' }).click()
  await expect(card.locator('tbody tr')).toHaveCount(4)
  await expect(card.locator('tbody tr').last()).toContainText('92')
  await page.getByRole('combobox', { name: 'Rentang waktu' }).selectOption('12w')
  await expect(card.locator('tbody tr')).toHaveCount(12)
  await page.getByRole('combobox', { name: 'Kelas' }).selectOption('IF-3A')
  await expect(page.locator('.kpi').first()).toContainText('39')
})

test('tooltip grafik dapat dibaca dengan keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/admin')
  await page.getByRole('img', { name: /Grafik garis akun/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.chart-tip')).toContainText('52')
})

test('pencarian pengguna, detail, dan aksi tanpa API dinonaktifkan', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/admin/pengguna')
  await page.getByPlaceholder('Cari nama atau NIM').fill('123140077')
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1)
  await page.getByRole('button', { name: 'Aksi untuk Dian Putri' }).click()
  await expect(page.getByRole('menuitem', { name: 'Cabut grant' })).toBeDisabled()
  await page.getByRole('menuitem', { name: 'Lihat detail' }).click()
  const dialog = page.getByRole('dialog', { name: 'Dian Putri' })
  await expect(dialog).toContainText('Nonaktif')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Ditangguhkan')
  await page.getByPlaceholder('Cari nama atau NIM').fill('')
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1)
})

test('tema gelap tersimpan dan diterapkan', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/admin')
  await page.getByRole('button', { name: 'Tema: Terang' }).click()
  await page.getByRole('menuitemradio', { name: 'Gelap' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({ path: '../docs/screenshots/admin-beranda-dark-1440.png', fullPage: true })
})

test('navigasi seluler membuka drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/lab/admin')
  await page.getByRole('button', { name: 'Buka navigasi' }).click()
  await page.getByRole('navigation', { name: 'Navigasi Admin' }).getByRole('link', { name: 'Kelas' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Kelas' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tutup navigasi' })).not.toBeInViewport()
})

test('beralih ke Dosen dan keluar memakai CSRF', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  let body = '', csrf = ''
  await page.route('**/api/session/context', async route => { body = route.request().postData() ?? ''; csrf = route.request().headers()['x-csrf-token']; await route.fulfill({ json: { home_route: '/lab/dosen' } }) })
  await page.goto('/lab/admin')
  await page.getByRole('button', { name: 'Beralih ke Dosen' }).first().click()
  await expect.poll(() => body).toContain('dosen')
  expect(csrf).toBe('csrf-fixture')
})

test('subrute admin ditolak untuk peran lain', async ({ page }) => {
  await page.unroute('**/api/me')
  await page.route('**/api/me', route => route.fulfill({ json: { ...admin, role: 'dosen', home_route: '/lab/dosen' } }))
  await page.goto('/lab/admin/pengguna')
  await expect(page.getByRole('heading', { name: 'Akses halaman ditolak' })).toBeVisible()
})
