import { expect, test, type Page } from '@playwright/test'

const student = {
  id: '00000000-0000-4000-8000-000000000101',
  name: 'Rani',
  email: 'rani@student.itera.ac.id',
  role: 'mahasiswa' as const,
  allowed_roles: ['mahasiswa'],
  home_route: '/lab',
  nim: '123140001',
  csrf_token: 'csrf-webdev-student',
  expires_at: '2026-11-30T20:00:00Z',
}

const lecturer = {
  id: '00000000-0000-4000-8000-000000000201',
  name: 'Ilham',
  email: 'ilham@if.itera.ac.id',
  role: 'dosen' as const,
  allowed_roles: ['dosen', 'mahasiswa'],
  home_route: '/lab/dosen',
  csrf_token: 'csrf-webdev-dosen',
  expires_at: '2026-11-30T20:00:00Z',
}

function attachCommonMocks(page: Page, email: string) {
  return Promise.all([
    page.route('**/api/notifications', (r) => r.fulfill({ json: { items: [], unread: 0 } })),
    page.route('**/api/account/presence', (r) => r.fulfill({ json: { ok: true, path: '/lab' } })),
    page.route('**/api/account/security', (r) =>
      r.fulfill({
        json: {
          primary_email: email,
          secondary_email: null,
          notify_assignments: true,
          notify_feedback: true,
          notify_security_alerts: true,
          mfa_enabled: true,
          totp_verified: true,
          backup_codes_remaining: 8,
          passkeys: [],
          sessions: [],
          notifications: [],
          recent_activity: [],
        },
      }),
    ),
    page.route('**/api/dashboard/student', (r) =>
      r.fulfill({
        json: {
          kpis: { labs_completed: 0, labs_total: 10, levels_passed: 0, levels_total: 40, assignments_done: 0, assignments_total: 0, xp: 0 },
          continue_session: null,
          activity_series: [],
          score_series: [],
          owasp_map: [],
          assignments: [],
          badges: [],
          recent_sessions: [],
        },
      }),
    ),
    page.route('**/api/student/leaderboard**', (r) =>
      r.fulfill({
        json: {
          classes: [],
          selected_class: 'ALL',
          my_rank: { rank: 1, total_students: 1, xp: 0, avg_score: 0, levels_passed: 0, badges_count: 0 },
          entries: [],
        },
      }),
    ),
    page.route('**/api/dashboard/instructor*', (r) =>
      r.fulfill({
        json: {
          classes: [{ id: 'IF-3A', name: 'IF-3A · Keamanan Web', course: 'Keamanan Web', semester: 'Ganjil', timezone: 'Asia/Jakarta' }],
          selected_class: 'ALL',
          kpis: { students_enrolled: 1, active_students: 1, assignments_passed: 0, assignments_total: 0, avg_score: null },
          assignments: [],
          score_histogram: [],
          ungraded_count: 0,
          student_rows: [],
        },
      }),
    ),
    page.route('**/api/instructor/leaderboard*', (r) =>
      r.fulfill({
        json: {
          classes: [],
          selected_class: 'ALL',
          entries: [],
        },
      }),
    ),
  ])
}

function attachWebDevApiMocks(page: Page, mode: 'mahasiswa' | 'dosen') {
  const completed: Array<{ mission_id: string; score: number; completed_at: string }> = []
  let portalXp = mode === 'mahasiswa' ? 0 : 0
  const savedMine: Array<Record<string, unknown>> = []

  return async () => {
    await page.route('**/api/webdev/projects**', async (r) => {
      if (r.request().method() === 'POST') {
        const body = JSON.parse(r.request().postData() || '{}') as Record<string, unknown>
        const proj = {
          id: String(body.id ?? `wd-${savedMine.length + 1}`),
          title: String(body.title ?? 'Proyek Web'),
          mission_id: body.mission_id ?? null,
          files: Array.isArray(body.files) ? body.files : [],
          updated_at: '2026-11-19T14:00:00Z',
          saved: true,
        }
        const idx = savedMine.findIndex((p) => p.id === proj.id)
        if (idx >= 0) savedMine[idx] = proj
        else savedMine.unshift(proj)
        return r.fulfill({ json: proj })
      }

      const doneSet = new Set(completed.map((c) => c.mission_id))
      const missionRules = [
        { id: 'webdev-p01-http', title: 'P1 · Cara Kerja Web & HTTP', xp: 50, required_xp: 0, prereq: null },
        { id: 'webdev-p02-html', title: 'P2 · Mengenal HTML5 Semantik', xp: 50, required_xp: 50, prereq: 'webdev-p01-http' },
        { id: 'webdev-p03-css', title: 'P3 · Mengenal CSS Flexbox & Tema', xp: 60, required_xp: 100, prereq: 'webdev-p02-html' },
        { id: 'webdev-p04-form-media', title: 'P4 · Tabel, Formulir, Layout & Media', xp: 60, required_xp: 160, prereq: 'webdev-p03-css' },
        { id: 'webdev-p05-js-dom', title: 'P5 · Pemrograman JavaScript & DOM', xp: 70, required_xp: 220, prereq: 'webdev-p04-form-media' },
        { id: 'webdev-p06-js-es6', title: 'P6 · JavaScript Generasi Baru (ES6+)', xp: 70, required_xp: 290, prereq: 'webdev-p05-js-dom' },
        { id: 'webdev-p07-react', title: 'P7 · Kerangka Kerja React JS & State', xp: 80, required_xp: 360, prereq: 'webdev-p06-js-es6' },
        { id: 'webdev-p08-uts', title: 'P8 · Evaluasi UTS Frontend Terpadu', xp: 90, required_xp: 440, prereq: 'webdev-p07-react' },
        { id: 'webdev-p09-python', title: 'P9 · Dasar Pemrograman Python', xp: 70, required_xp: 530, prereq: 'webdev-p08-uts' },
        { id: 'webdev-p10-oop-py', title: 'P10 · OOP di Python', xp: 70, required_xp: 600, prereq: 'webdev-p09-python' },
        { id: 'webdev-p11-fastapi', title: 'P11 · Kerangka Kerja FastAPI', xp: 80, required_xp: 670, prereq: 'webdev-p10-oop-py' },
        { id: 'webdev-p12-postgres', title: 'P12 · Basis Data PostgreSQL', xp: 80, required_xp: 750, prereq: 'webdev-p11-fastapi' },
        { id: 'webdev-p13-ai-web', title: 'P13 · AI pada Aplikasi Web', xp: 90, required_xp: 830, prereq: 'webdev-p12-postgres' },
        { id: 'webdev-p14-fullstack', title: 'P14-P16 · Proyek Full-Stack & Demo', xp: 120, required_xp: 920, prereq: 'webdev-p13-ai-web' },
      ]

      const mission_states = missionRules.map((m, idx) => {
        const prereqMet = !m.prereq || doneSet.has(m.prereq)
        const xpMet = portalXp >= m.required_xp
        const unlocked = mode === 'dosen' || (prereqMet && xpMet)
        return {
          mission_id: m.id,
          order: idx + 1,
          title: m.title,
          xp: m.xp,
          required_xp: m.required_xp,
          unlocked,
          completed: doneSet.has(m.id),
          lock_reason: unlocked ? null : `Butuh ${m.required_xp} XP Experience & prasyarat.`,
        }
      })

      return r.fulfill({
        json: {
          projects: savedMine,
          completed_missions: completed,
          mission_states,
          achievements: [
            {
              id: 'webdev-perintis',
              key: 'badge:webdev-perintis',
              title: 'Perintis Aplikasi Web',
              detail: 'Menyelesaikan misi perdana.',
              xp: 50,
              earned: doneSet.size >= 1,
            },
          ],
          portal_xp: portalXp,
          webdev_xp: portalXp,
          access: {
            can_access_web_labs: true,
            can_submit_assignments: true,
            is_instructor: mode === 'dosen',
          },
        },
      })
    })

    await page.route('**/api/webdev/missions/submit', async (r) => {
      const body = JSON.parse(r.request().postData() || '{}') as { mission_id: string }
      if (!completed.some((c) => c.mission_id === body.mission_id)) {
        completed.push({ mission_id: body.mission_id, score: 100, completed_at: '2026-11-19T14:05:00Z' })
      }
      if (mode === 'mahasiswa') {
        portalXp += 100
      }
      return r.fulfill({
        json: {
          mission_id: body.mission_id,
          score: 100,
          passed: true,
          xp_awarded: mode === 'mahasiswa' ? 100 : 0,
          portal_xp: portalXp,
          newly_unlocked: mode === 'mahasiswa' ? ['Perintis Aplikasi Web'] : [],
        },
      })
    })

    await page.route('**/api/dosen/webdev-projects**', (r) =>
      r.fulfill({
        json: {
          projects: [
            {
              id: 'stud-wd-1',
              title: 'Portal Mahasiswa Rani P2',
              mission_id: 'webdev-p02-html',
              owner_name: 'Rani',
              class_id: 'IF-3A',
              files: [{ name: 'index.html', content: '<main><article>Student Karya</article></main>' }],
              updated_at: '2026-11-19T14:10:00Z',
            },
          ],
        },
      }),
    )
  }
}

test('mahasiswa mengakses Lab Pengembangan Web dengan bar misi minimalis, XP Experience bertahap, coding & live web preview', async ({ page }) => {
  await page.route('**/api/me', (r) => r.fulfill({ json: student }))
  await attachCommonMocks(page, student.email)
  await attachWebDevApiMocks(page, 'mahasiswa')()

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab')

  // Navigasi melalui menu sidebar baru: Pengembangan Web
  await page.getByRole('navigation', { name: 'Navigasi Mahasiswa' }).getByRole('link', { name: 'Pengembangan Web' }).click()
  await expect(page).toHaveURL(/\/lab\/web-dev$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Lab Virtual Pengembangan Aplikasi Web' })).toBeVisible()

  // Bar misi minimalis: default tidak memakan ruang (drawer tersembunyi), menampilkan XP Experience
  const missionBar = page.getByRole('region', { name: 'Bar Misi Pengembangan Web' }).or(page.getByLabel('Bar Misi Pengembangan Web'))
  await expect(missionBar).toContainText('Experience: 0 XP · 0/14')
  await expect(page.getByRole('region', { name: 'Daftar Misi P1-P16' })).toHaveCount(0)

  // Buka daftar misi: hanya P1 terbuka, P2..P14 terkunci hingga meraih XP
  await page.getByRole('button', { name: /Daftar Misi \(14\)/ }).click()
  const drawer = page.getByRole('region', { name: 'Daftar Misi P1-P16' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('button', { name: /P1 · Cara Kerja Web & HTTP/ })).toBeEnabled()
  await expect(drawer.getByRole('button', { name: /P2 · Mengenal HTML5 Semantik/ })).toBeDisabled()
  await expect(drawer.getByRole('button', { name: /P14–P16 · Proyek Full-Stack & Demo/ })).toBeDisabled()
  await page.getByRole('button', { name: /Daftar Misi \(14\)/ }).click()

  // Jalankan kode pada P1 -> hasil HTML & CSS tampil di sebelah kanan, tombol JS interaktif bekerja
  await page.getByRole('button', { name: 'Jalankan' }).first().click()
  const preview = page.getByTestId('webdev-rendered-preview')
  await expect(preview.getByRole('heading', { name: 'Arsitektur Web & HTTP' })).toBeVisible()
  await preview.getByRole('button', { name: 'Kirim HTTP GET Test' }).click()
  await expect(preview).toContainText('Status: 200 OK · Response diterima dari server!')

  // Ubah kode editor HTML secara live dan pastikan render sebelah kanan langsung berubah
  const editor = page.getByLabel('Kode program aplikasi web')
  const curCode = await editor.inputValue()
  await editor.fill(curCode.replace('Arsitektur Web & HTTP', 'Arsitektur Web Live Render'))
  await expect(preview.getByRole('heading', { name: 'Arsitektur Web Live Render' })).toBeVisible()

  // Uji switcher viewport Mobile 390px
  await page.getByRole('button', { name: 'Mobile' }).click()
  await expect(preview).toHaveCSS('width', '390px')

  // Kumpulkan P1 -> Experience naik ke 100 XP dan Misi P2 terbuka otomatis!
  await page.getByRole('button', { name: 'Kumpulkan (+50 XP)' }).click()
  await expect(page.getByText(/Misi Web lulus! \+100 XP Experience/)).toBeVisible()
  await expect(missionBar).toContainText('Experience: 100 XP · 1/14')

  await page.getByRole('button', { name: /Daftar Misi \(14\)/ }).click()
  await expect(drawer.getByRole('button', { name: /P2 · Mengenal HTML5 Semantik/ })).toBeEnabled()
  await expect(drawer.getByRole('button', { name: /P7 · Kerangka Kerja React JS/ })).toBeDisabled()
})

test('dosen memiliki seluruh 14 misi Web Dev terbuka, dapat menguji React, FastAPI & PostgreSQL serta melihat proyek mahasiswa', async ({ page }) => {
  await page.route('**/api/me', (r) => r.fulfill({ json: lecturer }))
  await attachCommonMocks(page, lecturer.email)
  await attachWebDevApiMocks(page, 'dosen')()

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/dosen')

  await page.getByRole('navigation', { name: 'Navigasi Dosen' }).getByRole('link', { name: 'Pengembangan Web' }).click()
  await expect(page).toHaveURL(/\/lab\/dosen\/web-dev$/)
  await expect(page.getByText('Dosen · Semua 14 Misi Terbuka')).toBeVisible()

  // Semua 14 misi terbuka langsung untuk Dosen
  await page.getByRole('button', { name: /Daftar Misi \(14\)/ }).click()
  const drawer = page.getByRole('region', { name: 'Daftar Misi P1-P16' })
  await expect(drawer.getByRole('button', { name: /P1 · Cara Kerja Web & HTTP/ })).toBeEnabled()
  await expect(drawer.getByRole('button', { name: /P7 · Kerangka Kerja React JS/ })).toBeEnabled()
  await expect(drawer.getByRole('button', { name: /P11 · Kerangka Kerja FastAPI/ })).toBeEnabled()
  await expect(drawer.getByRole('button', { name: /P12 · Basis Data PostgreSQL/ })).toBeEnabled()
  await expect(drawer.getByRole('button', { name: /P14–P16 · Proyek Full-Stack/ })).toBeEnabled()

  // 1. Uji misi React JS (P7): render JSX + klik counter state bertambah
  await drawer.getByRole('button', { name: /P7 · Kerangka Kerja React JS/ }).click()
  await page.getByRole('button', { name: 'Jalankan' }).first().click()
  const preview = page.getByTestId('webdev-rendered-preview')
  await expect(preview).toContainText('Jumlah klik state saat ini: 0')
  await preview.getByRole('button', { name: /Tambah Counter/ }).click()
  await expect(preview).toContainText('Jumlah klik state saat ini: 1')

  // 2. Uji misi FastAPI (P11): endpoint REST API terdeteksi dan menghasilkan response JSON
  await page.getByRole('button', { name: /Daftar Misi \(14\)/ }).click()
  await drawer.getByRole('button', { name: /P11 · Kerangka Kerja FastAPI/ }).click()
  await page.getByRole('button', { name: 'Jalankan' }).first().click()
  const apiPanel = page.getByTestId('webdev-api-panel')
  await expect(apiPanel).toContainText('/api/katalog')
  await apiPanel.getByRole('button', { name: 'Uji Endpoint' }).first().click()
  await expect(apiPanel).toContainText('"framework": "FastAPI"')

  // 3. Uji misi PostgreSQL (P12): tabel & data baris terbentuk di tab PostgreSQL DB
  await page.getByRole('button', { name: /Daftar Misi \(14\)/ }).click()
  await drawer.getByRole('button', { name: /P12 · Basis Data PostgreSQL/ }).click()
  await page.getByRole('button', { name: 'Jalankan' }).first().click()
  const dbPanel = page.getByTestId('webdev-db-panel')
  await expect(dbPanel).toContainText('TABLE: proyek_web')
  await expect(dbPanel).toContainText('Portal Akademik')

  // 4. Dosen meninjau daftar proyek Web tersimpan mahasiswa
  await page.getByRole('button', { name: /Tersimpan/ }).click()
  await page.getByRole('button', { name: /Proyek Mahasiswa/ }).click()
  await expect(page.getByText('Portal Mahasiswa Rani P2')).toBeVisible()
})
