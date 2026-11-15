import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

interface Raw { tracks: Array<{ id: string; title: string; description: string }>; levels: Array<{ level: number; name: string; points: number }>; exercises: Array<Record<string, unknown> & { id: string; track: string; level: number; answer: string[]; hint: string; explanation: string; kind: string }> }
const raw: Raw = JSON.parse(readFileSync(new URL('../../Lab-Backend/content/latihan.json', import.meta.url), 'utf8'))
const base = { csrf_token: 'csrf-fixture', expires_at: '2026-11-15T20:00:00Z' }
const student = { ...base, id: 's1', name: 'Edi Mulyadi', email: 'mahasiswa@example.test', role: 'mahasiswa', allowed_roles: ['mahasiswa'], home_route: '/lab' }
const lecturer = { ...base, id: 'd1', name: 'Rani Dosen', email: 'rani@example.test', role: 'dosen', allowed_roles: ['admin', 'dosen'], home_route: '/lab/dosen' }

/** Meniru aturan server: urut per jalur, petunjuk setengah poin, -10% per salah, minimum 20%. */
function mockServer(page: Page) {
  const progress = new Map<string, { attempts: number; hint: boolean; points: number; done: boolean }>()
  const ordered = (track: string) => raw.exercises.filter(e => e.track === track).sort((a, b) => a.level - b.level)
  const unlocked = (id: string) => { const e = raw.exercises.find(x => x.id === id)!; const list = ordered(e.track); return list.slice(0, list.findIndex(x => x.id === id)).every(x => progress.get(x.id)?.done) }
  const points = (level: number) => raw.levels.find(l => l.level === level)!.points
  const view = () => ({ levels: raw.levels, tracks: raw.tracks.map(t => ({ ...t, exercises: ordered(t.id).map(e => {
    const p = progress.get(e.id); const status = p?.done ? 'selesai' : unlocked(e.id) ? 'terbuka' : 'terkunci'
    return { id: e.id, level: e.level, title: e.title, owasp: e.owasp, points: points(e.level), status,
      ...(status === 'terkunci' ? {} : { content: { scenario: e.scenario, code: e.code ?? null, code_lang: e.code_lang ?? null, question: e.question, kind: e.kind, options: e.options ?? [], hint: p?.hint ? e.hint : null, explanation: p?.done ? e.explanation : null } }),
      ...(p ? { progress: { attempts: p.attempts, hint_used: p.hint, earned: p.points } } : {}) }
  }) })) })
  const sent: string[] = []
  return { progress, sent, install: async () => {
    await page.route('**/api/latihan', r => r.fulfill({ json: view() }))
    await page.route('**/api/latihan/*/jawab', async r => {
      sent.push(r.request().headers()['x-csrf-token'])
      const id = r.request().url().split('/').at(-2)!; const e = raw.exercises.find(x => x.id === id)!
      if (!unlocked(id)) return r.fulfill({ status: 409, json: {} })
      const p = progress.get(id) ?? { attempts: 0, hint: false, points: 0, done: false }
      if (p.done) return r.fulfill({ json: { correct: true, earned: p.points, attempts: p.attempts, explanation: e.explanation } })
      p.attempts++
      const answer = (JSON.parse(r.request().postData()!).answer as string).trim().toLowerCase()
      const correct = e.answer.includes(answer)
      if (correct) { const b = points(e.level); p.points = Math.max(Math.floor(b / 5), (p.hint ? b / 2 : b) - (p.attempts - 1) * b / 10); p.done = true }
      progress.set(id, p)
      return r.fulfill({ json: { correct, earned: correct ? p.points : 0, attempts: p.attempts, ...(correct ? { explanation: e.explanation } : {}) } })
    })
    await page.route('**/api/latihan/*/petunjuk', r => { const id = r.request().url().split('/').at(-2)!; const p = progress.get(id) ?? { attempts: 0, hint: false, points: 0, done: false }; p.hint = true; progress.set(id, p); return r.fulfill({ json: { hint: raw.exercises.find(x => x.id === id)!.hint } }) })
  } }
}

test.describe('Mahasiswa', () => {
  test.beforeEach(async ({ page }) => { await page.route('**/api/me', r => r.fulfill({ json: student })) })

  test('langkah terkunci, jawaban diperiksa, dan level terbuka setelah tuntas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const server = mockServer(page); await server.install()
    await page.goto('/lab/latihan')
    await expect(page.getByRole('heading', { level: 1, name: 'Latihan' })).toBeVisible()
    await expect(page.locator('.level').nth(1)).toContainText('Terkunci')
    await expect(page.locator('.step.is-locked')).toHaveCount(11)
    await page.goto('/lab/latihan/web-1-2')
    await expect(page.getByRole('heading', { name: 'Langkah ini masih terkunci' })).toBeVisible()
    await page.getByRole('link', { name: /Lanjutkan: Nilai milik teman/ }).click()

    await page.getByText('Injection', { exact: true }).click()
    await page.getByRole('button', { name: 'Periksa jawaban' }).click()
    await expect(page.getByText(/Belum tepat. Percobaan ke-1/)).toBeVisible()
    await page.getByRole('button', { name: 'Petunjuk' }).click()
    await page.getByRole('button', { name: 'Ya, tampilkan' }).click()
    await expect(page.getByText(/tidak memeriksa apakah NIM/)).toBeVisible()
    await page.getByText('Broken Access Control (IDOR)').click()
    await page.getByRole('button', { name: 'Periksa jawaban' }).click()
    await expect(page.getByText('Jawaban tepat!')).toBeVisible()
    await expect(page.getByText(/\+4 XP/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pembahasan' })).toBeVisible()
    expect(server.sent.every(t => t === 'csrf-fixture')).toBe(true)
    await page.screenshot({ path: '../docs/screenshots/mahasiswa-latihan-1440.png', fullPage: true })

    await page.getByRole('link', { name: 'Lanjut ke langkah berikutnya' }).click()
    await expect(page).toHaveURL(/web-1-2$/)
    await page.getByText("admin' --").click()
    await page.getByRole('button', { name: 'Periksa jawaban' }).click()
    await page.getByRole('link', { name: 'Lanjut ke langkah berikutnya' }).click()
    await page.getByLabel('Jawaban Anda').fill('  X-Frame-Options ')
    await page.getByRole('button', { name: 'Periksa jawaban' }).click()
    await expect(page.getByText('+10 XP')).toBeVisible()
    await page.getByRole('link', { name: 'Buka level berikutnya' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Komentar yang menjalankan skrip' })).toBeVisible()
    await expect(page.getByText('Level Menengah · Langkah 1 dari 3')).toBeVisible()

    await page.getByRole('navigation', { name: 'Navigasi Mahasiswa' }).getByRole('link', { name: 'Beranda' }).click()
    await expect(page.getByText('24 XP · 26 XP lagi menuju Penjelajah')).toBeVisible()
    await expect(page.getByRole('link', { name: /Lanjutkan: Komentar yang menjalankan skrip/ })).toBeVisible()
    await page.screenshot({ path: '../docs/screenshots/mahasiswa-beranda-1440.png', fullPage: true })
    await page.getByRole('navigation', { name: 'Navigasi Mahasiswa' }).getByRole('link', { name: 'Pencapaian' }).click()
    await expect(page.locator('.badge-card.is-earned')).toHaveCount(2)
    await expect(page.locator('.data-table tbody tr')).toHaveCount(3)
  })

  test('peta level rapi di ponsel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const server = mockServer(page); await server.install()
    for (const path of ['/lab', '/lab/latihan', '/lab/latihan/web-1-1', '/lab/pencapaian']) {
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    await page.goto('/lab/latihan')
    await page.screenshot({ path: '../docs/screenshots/mahasiswa-latihan-390.png', fullPage: true })
  })

  test('rute Dosen dan Admin ditolak', async ({ page }) => {
    await page.goto('/lab/dosen/latihan')
    await expect(page.getByRole('heading', { name: 'Akses halaman ditolak' })).toBeVisible()
    await page.goto('/lab/admin')
    await expect(page.getByRole('heading', { name: 'Akses halaman ditolak' })).toBeVisible()
  })
})

test.describe('Dosen', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/me', r => r.fulfill({ json: lecturer }))
    await page.route('**/api/dosen/latihan', r => r.fulfill({ json: { levels: raw.levels, tracks: raw.tracks.map(t => ({ ...t, exercises: raw.exercises.filter(e => e.track === t.id).sort((a, b) => a.level - b.level).map(e => ({
      id: e.id, level: e.level, title: e.title, owasp: e.owasp, points: raw.levels.find(l => l.level === e.level)!.points, status: 'terbuka',
      content: { scenario: e.scenario, code: e.code ?? null, code_lang: e.code_lang ?? null, question: e.question, kind: e.kind, options: e.options ?? [], hint: e.hint, explanation: e.explanation }, key: { answers: e.answer },
    })) })) } }))
  })

  test('semua level terbuka dengan kunci jawaban tanpa gamifikasi', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/lab/dosen')
    await expect(page.getByRole('heading', { level: 1, name: 'Selamat datang, Rani' })).toBeVisible()
    await page.screenshot({ path: '../docs/screenshots/dosen-beranda-1440.png', fullPage: true })
    await page.getByRole('navigation', { name: 'Navigasi Dosen' }).getByRole('link', { name: 'Bank latihan' }).click()
    await expect(page.locator('.step.is-locked')).toHaveCount(0)
    await expect(page.locator('.xp-pill, .rank-card, .tag-xp')).toHaveCount(0)
    await page.getByRole('tab', { name: /Keamanan IoT/ }).click()
    await page.getByRole('link', { name: /Glitch saat boot/ }).click()
    await expect(page.locator('.choices li.is-correct')).toContainText('Fault injection')
    await expect(page.getByRole('heading', { name: 'Pembahasan' })).toBeVisible()
    await page.getByRole('link', { name: 'Sebelumnya' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'ACL broker kelas' })).toBeVisible()
    await page.goto('/lab/dosen/latihan/web-1-3')
    await expect(page.locator('.accepted')).toContainText('x-frame-options')
    await page.screenshot({ path: '../docs/screenshots/dosen-latihan-1440.png', fullPage: true })
    await page.getByRole('button', { name: 'Mode presentasi' }).click()
    await expect(page.locator('.accepted')).toHaveCount(0)
    await page.getByRole('button', { name: 'Tampilkan jawaban' }).click()
    await expect(page.locator('.accepted')).toContainText('x-frame-options')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Mode presentasi aktif' })).toBeVisible()
  })

  test('tidak memanggil API Mahasiswa dan rute Mahasiswa ditolak', async ({ page }) => {
    let student = 0
    await page.route('**/api/latihan', r => { student++; return r.fulfill({ status: 403, json: {} }) })
    await page.goto('/lab/dosen/latihan')
    await expect(page.getByRole('heading', { level: 1, name: 'Bank latihan' })).toBeVisible()
    expect(student).toBe(0)
    await page.goto('/lab/latihan')
    await expect(page.getByRole('heading', { name: 'Akses halaman ditolak' })).toBeVisible()
  })
})
