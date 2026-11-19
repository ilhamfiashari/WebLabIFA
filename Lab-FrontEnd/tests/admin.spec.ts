import { expect, test, type Page } from '@playwright/test'

const admin = { id: '00000000-0000-0000-0000-0000000000a1', name: 'Rani Admin', email: 'rani@example.test', role: 'admin', allowed_roles: ['dosen', 'admin'], home_route: '/lab/admin', csrf_token: 'csrf-fixture', expires_at: '2026-11-15T20:00:00Z' }

test.beforeEach(async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ json: admin }))
  await page.route('**/api/dashboard/admin', route => route.fulfill({ json: null }))
  await page.route('**/api/notifications', route => route.fulfill({ json: { items: [], unread: 0 } }))
  await page.route('**/api/account/presence', route => route.fulfill({ json: { ok: true, path: '/lab/admin' } }))
  await page.route('**/api/account/security', route => route.fulfill({
    json: {
      primary_email: admin.email,
      secondary_email: null,
      notify_assignments: true,
      notify_feedback: true,
      notify_security_alerts: true,
      mfa_enabled: false,
      totp_verified: false,
      backup_codes_remaining: 0,
      passkeys: [],
      sessions: [],
      notifications: [],
      recent_activity: [],
    },
  }))
  await page.route('**/api/admin/security-monitor', route => route.fulfill({
    json: {
      summary: { active_sessions: 0, unacknowledged_anomalies: 0, mfa_enabled_users: 0, emails_sent_total: 0 },
      active_sessions: [],
      activity_logs: [],
      anomalies: [],
    },
  }))
  await page.route('**/api/admin/settings', route => {
    const method = route.request().method()
    const payload = method === 'POST'
      ? JSON.parse(route.request().postData() || '{}')
      : {
          active_tracks: ['web', 'iot'],
          enforce_sequential_unlock: true,
          strict_deadline_lock: true,
          block_concurrent_attempts: true,
          max_import_questions: 100,
          allow_dosen_question_import: true,
          allow_student_hints: true,
          hide_answer_explanations_until_due: true,
        }
    return route.fulfill({ json: { settings: payload } })
  })
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

test('admin mengatur peran pengguna, kelas, dan hak akses granular serta mata kuliah dibatasi 2', async ({ page }) => {
  await page.unroute('**/api/dashboard/admin')
  let accessPayload: Record<string, unknown> | null = null
  let accessCsrf = ''
  await page.route('**/api/dashboard/admin', route => route.fulfill({
    json: {
      kpis: { active_accounts: 2, total_accounts: 2, active_classes: 2, published_labs: 15, owasp_covered: 10, total_sessions: 5 },
      role_counts: { mahasiswa: 1, dosen: 1, admin: 1 },
      users: [
        {
          id: 'u-stu-1',
          name: 'Nadia Mahasiswa',
          email: '123140051@student.itera.ac.id',
          active: true,
          roles: ['mahasiswa'],
          class_ids: ['IF-3A'],
          permissions: {
            can_access_web_labs: true,
            can_access_iot_studio: true,
            can_submit_assignments: true,
            can_import_questions: false,
            can_manage_assignments: false,
            can_view_class_analytics: false,
            can_export_reports: false,
          },
          created_at: '2026-11-01T00:00:00Z',
        },
      ],
      classes: [
        { id: 'IF-3A', name: 'IF-3A · Keamanan Web', course: 'Keamanan Web', semester: 'Ganjil 2026/2027', timezone: 'Asia/Jakarta', leaderboard_enabled: true, active: true },
        { id: 'IF-4A', name: 'IF-4A · IoT', course: 'IoT', semester: 'Ganjil 2026/2027', timezone: 'Asia/Jakarta', leaderboard_enabled: true, active: true },
      ],
      modules: [],
      audit_logs: [],
    },
  }))
  await page.route('**/api/admin/users/u-stu-1/access', route => {
    accessCsrf = route.request().headers()['x-csrf-token'] ?? ''
    accessPayload = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>
    return route.fulfill({ json: { user_id: 'u-stu-1', ...accessPayload } })
  })

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/lab/admin/pengguna')
  await page.getByRole('button', { name: 'Atur Peran & Hak Akses' }).click()
  const drawer = page.getByRole('dialog', { name: 'Atur Peran & Hak Akses · Nadia Mahasiswa' })
  await expect(drawer).toBeVisible()
  await drawer.getByLabel('dosen', { exact: true }).check()
  await drawer.getByLabel(/IF-4A/).check()
  await drawer.getByLabel('Terbitkan & Kelola Penugasan Kelas').check()
  await drawer.getByRole('button', { name: 'Simpan Hak Akses' }).click()

  await expect(page.getByText('Peran dan hak akses Nadia Mahasiswa berhasil diperbarui.')).toBeVisible()
  expect(accessCsrf).toBe('csrf-fixture')
  expect(accessPayload).toMatchObject({
    roles: ['mahasiswa', 'dosen'],
    class_ids: ['IF-3A', 'IF-4A'],
    permissions: expect.objectContaining({ can_manage_assignments: true }),
  })

  await page.goto('/lab/admin/kelas')
  const courseSelect = page.getByLabel('Mata kuliah kelas')
  await expect(courseSelect).toBeVisible()
  expect(await courseSelect.locator('option').allInnerTexts()).toEqual(['Keamanan Web', 'IoT'])
})
