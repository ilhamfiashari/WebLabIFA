import { expect, test, type Page } from '@playwright/test'

const student = {
  id: '00000000-0000-0000-0000-000000000011',
  name: 'Rani Mahasiswa',
  email: '123140001@student.itera.ac.id',
  role: 'mahasiswa',
  allowed_roles: ['mahasiswa'],
  home_route: '/lab',
  csrf_token: 'csrf-sim-test',
  expires_at: '2026-11-15T20:00:00Z',
}

const lecturer = {
  id: '00000000-0000-0000-0000-000000000022',
  name: 'Ilham Dosen',
  email: 'dosen@example.test',
  role: 'dosen',
  allowed_roles: ['dosen', 'admin'],
  home_route: '/lab/dosen',
  csrf_token: 'csrf-sim-test',
  expires_at: '2026-11-15T20:00:00Z',
}

const admin = {
  id: '00000000-0000-0000-0000-000000000033',
  name: 'Rani Admin',
  email: 'admin@example.test',
  role: 'admin',
  allowed_roles: ['dosen', 'admin'],
  home_route: '/lab/admin',
  csrf_token: 'csrf-sim-test',
  expires_at: '2026-11-15T20:00:00Z',
}

function buildMockSimulatorRoutes(page: Page) {
  let rowVersion = 1
  let currentStep: 'pahami' | 'uji' | 'perbaiki' | 'verifikasi' | 'refleksi' = 'pahami'
  let hypothesis: string | null = null
  let diagnosis: string | null = null
  let selectedPatch: string | null = null
  let baselineRecorded = false
  let exploitProved = false
  let verificationPassed = false
  let reflectionSubmitted = false
  let hintsOpened = 0
  let score: number | null = null
  let passed = false
  let verificationRows: unknown[] = []
  let reflectionJson: Record<string, unknown> = {}

  const sessionPayload = () => ({
    session: {
      id: 'ses-sqli-1',
      lab_id: 'a05-sqli',
      level_id: 'easy',
      level_label: 'Easy',
      xp_reward: 50,
      scenario_version: '1.0.0',
      current_step: currentStep,
      selected_patch: selectedPatch,
      hypothesis,
      diagnosis,
      hints_opened: hintsOpened,
      baseline_recorded: baselineRecorded,
      exploit_proved: exploitProved,
      verification_passed: verificationPassed,
      reflection_submitted: reflectionSubmitted,
      score,
      passed,
      state: { level: 'easy' },
      verification: verificationRows,
      reflection: reflectionJson,
      row_version: rowVersion,
      started_at: '2026-11-15T10:00:00Z',
      updated_at: '2026-11-15T10:05:00Z',
      completed_at: null,
    },
    lab: {
      id: 'a05-sqli',
      track: 'web',
      owasp_code: 'A05',
      title: 'SQL Injection & Query Builder Aman',
      subtitle: 'Pencarian katalog produk yang menggabungkan string query mentah.',
      objective: 'Mengamankan query pencarian dan sortir dinamis dari manipulasi sintaks SQL.',
      context: 'Fitur pencarian katalog hanya boleh mengembalikan produk publik.',
      cwe_id: 'CWE-89',
      wstg_ref: 'WSTG-INPV-05',
      asvs_ref: 'ASVS V5.3',
      fixture_actors: ['pengunjung'],
      trust_nodes: [
        { id: 'search', label: 'Kolom Pencarian', zone: 'Client', role: 'Input user' },
        { id: 'api', label: 'Query Builder', zone: 'Server', role: 'Bind parameter' },
        { id: 'db', label: 'Tabel products', zone: 'Database', role: 'is_public=true' },
      ],
      trust_edges: [
        { from: 'search', to: 'api', label: 'q & sort', boundary: false },
        { from: 'api', to: 'db', label: 'SQL Query', boundary: true },
      ],
      code_stacks: [
        {
          stack: 'Rust (Axum + SQLx)',
          vulnerable_file: 'src/products.rs',
          vulnerable_code: 'let sql = format!("SELECT name FROM products WHERE name LIKE \'%{}%\'", q);',
          vulnerable_explain: 'Penggabungan string mengizinkan tanda kutip keluar dari literal data.',
          fixed_file: 'src/products.rs',
          fixed_code: 'sqlx::query_as("SELECT name FROM products WHERE is_public = true AND name ILIKE $1").bind(pat)',
          fixed_explain: 'Bind parameter memisahkan perintah SQL dan nilai parameter.',
        },
        {
          stack: 'Node.js (Express + pg)',
          vulnerable_file: 'routes/products.js',
          vulnerable_code: 'pool.query(`SELECT name FROM products WHERE name LIKE \'%${q}%\'`)',
          vulnerable_explain: 'Template literal masuk ke parser SQL.',
          fixed_file: 'routes/products.js',
          fixed_code: 'pool.query("SELECT name FROM products WHERE is_public = true AND name ILIKE $1", [`%${q}%`])',
          fixed_explain: 'Parameterized query $1 memperlakukan input sebagai literal teks.',
        },
      ],
      patch_options: [
        { id: 'param-allowlist', label: 'Parameterized Query + Sort Allowlist', summary: 'Gunakan $1 bind parameter dan enum sortir.' },
        { id: 'blacklist-or', label: 'Blokir kata kunci OR/UNION', summary: 'Regex menghapus kata OR/UNION dari input.' },
        { id: 'strip-quote-only', label: 'Hapus tanda kutip tunggal saja', summary: 'Mengganti tanda kutip tunggal.' },
      ],
      unlocked_hints: hintsOpened > 0 ? ['Petunjuk 1: Uji tanda kutip tunggal dan OR 1=1.'] : [],
      total_hints: 3,
      level_spec: {
        title: 'Query Concatenation Tanpa Proteksi',
        scenario: 'Input pencarian disisipkan ke klausa WHERE.',
        initial_control: 'Tidak ada sanitasi SQL',
        pahami_prompt: 'Mengapa pencarian merusak struktur query?',
        hypothesis_options: ['Karena input mengubah struktur AST SQL', 'Karena browser salah cache'],
        probe_instruction: 'Jalankan baseline lalu uji payload SQLi.',
        diagnosis_options: ['SQL concatenation tanpa bind parameter', 'CSS kurang rapi'],
        expected_baseline: 'Menampilkan produk publik',
        expected_exploit: 'Membocorkan produk rahasia',
        correct_hypothesis: null,
        correct_diagnosis: null,
      },
      reflection_spec: {
        root_cause_prompt: 'Apa akar masalah SQL Injection ini?',
        evidence_prompt: 'Catat bukti sebelum & sesudah patch.',
        transfer_question: 'Bagaimana mengamankan dynamic ORDER BY?',
        official_summary: 'Gunakan bind parameter dan allowlist kolom sortir.',
        key_takeaways: ['Data terpisah dari kode SQL via $1', 'Kolom ORDER BY wajib memakai allowlist'],
      },
    },
  })

  return async () => {
    await page.route('**/api/dashboard/student', r =>
      r.fulfill({
        json: {
          kpis: { labs_completed: 0, labs_total: 15, levels_passed: 2, levels_total: 60, assignments_done: 1, assignments_total: 2, xp: 150 },
          continue_session: { id: 'ses-sqli-1', lab_id: 'a05-sqli', lab_title: 'SQL Injection & Query Builder Aman', level_id: 'easy', current_step: 'pahami', updated_at: '2026-11-15T10:00:00Z' },
          activity_series: [{ label: '15 Nov', value: 2 }],
          score_series: [{ session_id: 's0', lab_id: 'a01-idor', level_id: 'easy', score: 92, passed: true, date: '14 Nov' }],
          owasp_map: [{ code: 'A05', name: 'Injection', done_levels: 1, total_levels: 8, status: 'Berjalan' }],
          assignments: [{ id: 'a1', class_id: 'IF-3A', title: 'Praktikum SQLi', lab_id: 'a05-sqli', required_level: 'easy', due_at: '2026-11-22T10:00:00Z', pass_threshold: 80, status: 'Berjalan', session_id: 'ses-sqli-1' }],
          badges: [{ id: 'bukti-pertama', title: 'Bukti Pertama', detail: 'Lulus lab pertama', earned: true }],
          recent_sessions: [],
        },
      }),
    )

    await page.route('**/api/labs/catalog*', r =>
      r.fulfill({
        json: {
          categories: [{ code: 'A01', name: 'Broken Access Control', summary: 'Kontrol akses' }, { code: 'A05', name: 'Injection', summary: 'SQLi & XSS' }],
          labs: [
            { id: 'a05-sqli', track: 'web', owasp_code: 'A05', title: 'SQL Injection & Query Builder Aman', subtitle: 'Uji query builder', objective: 'Bind parameter', cwe_id: 'CWE-89', wstg_ref: 'WSTG-INPV-05', asvs_ref: 'ASVS V5.3', estimated_minutes: 20, prerequisite: 'Tidak ada', publication_status: 'Terbit', version: '1.0.0', passed_levels: 0, total_levels: 4, levels: [{ level: 'easy', label: 'Easy', xp: 50, passed: false, best_score: null, active_session_id: 'ses-sqli-1', current_step: 'pahami' }] },
            { id: 'iot-esp32-gpio', track: 'iot', owasp_code: null, title: 'ESP32-C3: Kontrol GPIO, LED & Proteksi Resistor', subtitle: 'Rangkai LED, resistor 220Ω, dan pushbutton', objective: 'Proteksi GPIO 3.3V', cwe_id: 'CWE-665', wstg_ref: 'IOT-HW-01', asvs_ref: 'IoTSVS HW-1', estimated_minutes: 15, prerequisite: 'Tidak ada', publication_status: 'Terbit', version: '2.0.0', passed_levels: 0, total_levels: 4, levels: [{ level: 'easy', label: 'Easy', xp: 50, passed: false, best_score: null, active_session_id: null, current_step: null }] },
          ],
          recent_session: { id: 'ses-sqli-1', lab_id: 'a05-sqli', level_id: 'easy', current_step: 'pahami', updated_at: '2026-11-15T10:00:00Z' },
        },
      }),
    )

    await page.route('**/api/labs/sessions/ses-sqli-1', r => r.fulfill({ json: sessionPayload() }))

    await page.route('**/api/labs/sessions/ses-sqli-1/step', async r => {
      const body = JSON.parse(r.request().postData() ?? '{}')
      rowVersion++
      if (body.current_step) currentStep = body.current_step
      if (body.hypothesis) hypothesis = body.hypothesis
      if (body.diagnosis) diagnosis = body.diagnosis
      if (body.selected_patch) selectedPatch = body.selected_patch
      await r.fulfill({ json: { row_version: rowVersion, current_step: currentStep, selected_patch: selectedPatch } })
    })

    await page.route('**/api/labs/sessions/ses-sqli-1/probe', async r => {
      const body = JSON.parse(r.request().postData() ?? '{}')
      rowVersion++
      const p = String(body.input?.payload ?? '')
      const isExploit = p.includes('OR')
      if (isExploit) exploitProved = true
      else baselineRecorded = true
      await r.fulfill({
        json: {
          row_version: rowVersion,
          baseline_recorded: baselineRecorded,
          exploit_proved: exploitProved,
          outcome: {
            request: { method: 'GET', path: `/api/products?q=${p}`, headers: [], body: '' },
            response: { status: 200, status_text: 'OK', headers: [], body: JSON.stringify({ count: isExploit ? 3 : 1, leaked_private: isExploit }), correlation_id: 'cid-123' },
            events: [{ stage: 'Database', component: 'SqlParser', decision: isExploit ? 'SQL INJECTION' : 'OK', detail: isExploit ? 'Data rahasia bocor!' : 'Query normal', tone: isExploit ? 'bad' : 'good' }],
            visual_data: {
              kind: 'sqli',
              ast_tokens: isExploit ? ['SELECT', 'FROM products', 'OR 1=1'] : ['SELECT', 'FROM products', 'WHERE is_public=true'],
              leaked_private: isExploit,
              rows: [{ name: isExploit ? 'Modul Firmware Rahasia' : "Kabel'Pro", price: 50000, is_public: !isExploit }],
            },
            baseline_captured: !isExploit,
            exploit_proved: isExploit,
            is_legitimate: !isExploit,
            updated_state: { level: 'easy' },
          },
        },
      })
    })

    await page.route('**/api/labs/sessions/ses-sqli-1/hint', r => {
      rowVersion++
      hintsOpened = 1
      return r.fulfill({ json: { row_version: rowVersion, hints_opened: 1, unlocked_hints: ['Petunjuk 1: Uji tanda kutip tunggal dan OR 1=1.'] } })
    })

    await page.route('**/api/labs/sessions/ses-sqli-1/verify', r => {
      rowVersion++
      verificationPassed = true
      verificationRows = [
        { case_id: 'A05-POS', category: 'Positif', scenario: 'Pencarian sah', input: "Kabel'Pro", expected: '200 OK', before_result: 'HTTP 200', after_result: 'HTTP 200', evidence: 'KabelPro tampil', passed: true },
        { case_id: 'A05-NEG', category: 'Negatif', scenario: 'Payload SQLi ditahan', input: "' OR '1'='1", expected: 'Tidak bocor', before_result: 'Bocor', after_result: 'Aman', evidence: 'Bind parameter mengikat literal', passed: true },
      ]
      return r.fulfill({ json: { row_version: rowVersion, report: { rows: verificationRows, all_passed: true, passed_count: 2, total_count: 2 } } })
    })

    await page.route('**/api/labs/sessions/ses-sqli-1/reflect', async r => {
      const body = JSON.parse(r.request().postData() ?? '{}')
      rowVersion++
      reflectionSubmitted = true
      score = 100
      passed = true
      const rubric = { pahami: 15, uji: 25, perbaiki: 25, verifikasi: 25, refleksi: 10, total: 100, passed: true }
      reflectionJson = { ...body, rubric }
      await r.fulfill({
        json: {
          row_version: rowVersion,
          rubric,
          xp_awarded_now: 70,
          badges_unlocked_now: ['Perbaikan Teruji'],
          official_summary: 'Gunakan bind parameter dan allowlist kolom sortir.',
          key_takeaways: ['Data terpisah dari kode SQL via $1'],
        },
      })
    })
  }
}

test('alur lengkap pentester simulator 5 tahap pada SQL Injection', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: student }))
  await buildMockSimulatorRoutes(page)()
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/lab')
  await expect(page.getByText('SQL Injection & Query Builder Aman')).toBeVisible()
  await page.getByRole('button', { name: 'Lanjutkan Sesi' }).click()
  await expect(page).toHaveURL(/\/lab\/sesi\/ses-sqli-1$/)

  // Stage 1: Pahami -> Diagram Trust Boundary + Hipotesis
  await expect(page.getByLabel('Diagram Topologi & Batas Kepercayaan')).toBeVisible()
  await page.getByLabel('Karena input mengubah struktur AST SQL').check()
  await page.getByRole('button', { name: /Simpan Hipotesis/ }).click()

  // Stage 2: Uji Celah -> Baseline + Exploit + Hint
  await page.getByRole('button', { name: /Baseline: Cari Kabel'Pro/ }).click()
  await page.getByRole('button', { name: /Uji SQLi:/ }).click()
  await expect(page.getByText('SQL Injection Tembus')).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Buka Petunjuk Berikutnya' }).click()
  await expect(page.getByText(/Petunjuk 1:/)).toBeVisible()
  await page.getByRole('button', { name: /Lanjut Diagnosis/ }).click()

  // Stage 3: Perbaiki -> Pembanding Lintas Stack + Diagnosis + Patch
  await expect(page.getByText('RENTAN · src/products.rs')).toBeVisible()
  await page.getByRole('button', { name: 'Node.js (Express + pg)' }).click()
  await expect(page.getByText('RENTAN · routes/products.js')).toBeVisible()
  await page.getByLabel('SQL concatenation tanpa bind parameter').check()
  await page.getByLabel(/Parameterized Query \+ Sort Allowlist/).check()
  await page.getByRole('button', { name: /Terapkan Kontrol/ }).click()

  // Stage 4: Verifikasi
  await page.getByRole('button', { name: 'Jalankan Matriks Verifikasi' }).click()
  await expect(page.getByText('Semua 2 kasus uji LULUS!')).toBeVisible()
  await page.getByRole('button', { name: /Lanjut ke Refleksi/ }).click()

  // Stage 5: Refleksi -> Rubrik 100/100 + XP
  await page.locator('#refl-root').fill('Input user digabungkan ke string query SQL tanpa bind parameter.')
  await page.locator('#refl-evidence').fill('Sebelum patch OR 1=1 membocorkan produk rahasia; sesudah patch aman.')
  await page.locator('#refl-transfer').fill('Gunakan enum atau allowlist eksplisit di server untuk ORDER BY.')
  await page.getByRole('button', { name: /Kirim Refleksi/ }).click()
  await expect(page.getByText('Total Skor: 100/100')).toBeVisible()
  await expect(page.getByText(/\+70 XP ditambahkan!/)).toBeVisible()
})

test('dosen meninjau bukti dan menggunakan mode presentasi', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: lecturer }))
  await page.route('**/api/latihan/dosen', r => r.fulfill({ json: { levels: [], tracks: [] } }))
  await page.route('**/api/dashboard/instructor*', r =>
    r.fulfill({
      json: {
        classes: [{ id: 'IF-3A', name: 'Kelas IF-3A', course: 'Keamanan Web & IoT', semester: 'Ganjil', timezone: 'Asia/Jakarta' }],
        selected_class: 'IF-3A',
        kpis: { students_enrolled: 32, active_students: 28, assignments_passed: 21, assignments_total: 32, avg_score: 88.5 },
        assignments: [{ id: 'a1', title: 'Praktikum SQLi', lab_id: 'a05-sqli', required_level: 'easy', due_at: '2026-11-22T10:00:00Z', pass_threshold: 80, not_started: 4, running: 7, passed: 21, denominator: 32 }],
        score_histogram: [{ label: '0–59', count: 1 }, { label: '60–79', count: 3 }, { label: '80–89', count: 12 }, { label: '90–100', count: 16 }],
        ungraded_count: 7,
        student_rows: [{ session_id: 'ses-sqli-1', user_id: 'u1', name: 'Bima Pratama', email: 'bima@student.itera.ac.id', lab_id: 'a05-sqli', level_id: 'easy', current_step: 'refleksi', score: 95, passed: true, reflection_submitted: true, updated_at: '2026-11-15T10:00:00Z' }],
      },
    }),
  )
  await buildMockSimulatorRoutes(page)()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/dosen')

  await expect(page.getByText('Bima Pratama')).toBeVisible()
  await page.getByRole('button', { name: 'Mode presentasi' }).click()
  await expect(page.getByText('Bima Pratama')).toHaveCount(0)
  await expect(page.getByText('Mahasiswa #1')).toBeVisible()

  await page.getByRole('button', { name: 'Tinjau Bukti' }).click()
  await expect(page.getByRole('dialog', { name: 'Tinjau Bukti & Umpan Balik Mahasiswa' })).toBeVisible()
})

test('responsif seluler 390px pada ruang praktikum tanpa overflow horizontal', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: student }))
  await buildMockSimulatorRoutes(page)()
  await page.setViewportSize({ width: 390, height: 844 })

  for (const route of ['/lab', '/lab/web', '/lab/iot', '/lab/sesi/ses-sqli-1']) {
    await page.goto(route)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('admin melihat data langsung dari database', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: admin }))
  await page.route('**/api/dashboard/admin', r =>
    r.fulfill({
      json: {
        kpis: { active_accounts: 42, total_accounts: 45, active_classes: 3, published_labs: 15, owasp_covered: 10, total_sessions: 98 },
        role_counts: { mahasiswa: 40, dosen: 3, admin: 2 },
        users: [{ id: 'u1', name: 'Rani Mahasiswa', email: '123140001@student.itera.ac.id', active: true, roles: ['mahasiswa'], created_at: '2026-11-01T00:00:00Z' }],
        classes: [{ id: 'IF-3A', name: 'Kelas IF-3A', course: 'Keamanan Web & IoT', semester: 'Ganjil', timezone: 'Asia/Jakarta', leaderboard_enabled: true, active: true }],
        modules: [{ lab_id: 'a05-sqli', title: 'SQL Injection', track: 'web', owasp_code: 'A05', status: 'Terbit', version: '1.0.0' }],
        audit_logs: [{ id: 'aud-1', kind: 'Publikasi', title: 'Terbitkan A05', target: 'a05-sqli', result: 'Berhasil', created_at: '2026-11-15T10:00:00Z' }],
      },
    }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/admin')
  await expect(page.getByText('Data langsung')).toBeVisible()
  await expect(page.getByText('98 total sesi simulator')).toBeVisible()
})

test('mahasiswa melihat levelling bertahap (Easy terbuka, Medium–Impossible terkunci)', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: student }))
  await buildMockSimulatorRoutes(page)()
  await page.route('**/api/labs/a05-sqli', r =>
    r.fulfill({
      json: {
        id: 'a05-sqli',
        track: 'web',
        owasp_code: 'A05',
        title: 'SQL Injection & Query Builder Aman',
        subtitle: 'Pencarian katalog produk yang menggabungkan string query mentah.',
        objective: 'Mengamankan query pencarian dari manipulasi sintaks SQL.',
        context: 'Fitur pencarian hanya boleh menampilkan produk publik.',
        cwe_id: 'CWE-89',
        wstg_ref: 'WSTG-INPV-05',
        asvs_ref: 'ASVS V5.3',
        estimated_minutes: 20,
        prerequisite: 'Tidak ada',
        fixture_actors: ['pengunjung'],
        trust_nodes: [],
        trust_edges: [],
        code_stacks: [],
        gamification_enabled: true,
        solution_unlocked: false,
        official_summary: null,
        levels: [
          { level: 'easy', label: 'Easy', xp: 50, title: 'Level Low', scenario: 'Tanpa proteksi', initial_control: 'Kosong', expected_baseline: '1 baris', expected_exploit: 'Semua baris', passed: false, unlocked: true, unlock_requirement: null, best_score: null, active_session_id: null, current_step: null },
          { level: 'medium', label: 'Medium', xp: 100, title: 'Level Medium', scenario: 'Filter parsial', initial_control: 'Blacklist', expected_baseline: '1 baris', expected_exploit: 'Bypass', passed: false, unlocked: false, unlock_requirement: 'Selesaikan level Easy terlebih dahulu untuk membuka level Medium.', best_score: null, active_session_id: null, current_step: null },
          { level: 'hard', label: 'Hard', xp: 150, title: 'Level High', scenario: 'ORDER BY dinamis', initial_control: 'Bind WHERE', expected_baseline: '1 baris', expected_exploit: 'Sort SQLi', passed: false, unlocked: false, unlock_requirement: 'Selesaikan level Medium terlebih dahulu untuk membuka level Hard.', best_score: null, active_session_id: null, current_step: null },
          { level: 'impossible', label: 'Impossible', xp: 200, title: 'Referensi Aman', scenario: 'Audit lengkap', initial_control: 'Allowlist penuh', expected_baseline: '1 baris', expected_exploit: 'Aman', passed: false, unlocked: false, unlock_requirement: 'Selesaikan level Hard terlebih dahulu untuk membuka level Impossible.', best_score: null, active_session_id: null, current_step: null },
        ],
      },
    }),
  )

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/web/A05/a05-sqli')

  await expect(page.getByText('Mode Levelling Bertahap')).toBeVisible()
  await expect(page.getByText(/\+50 XP/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mulai Level' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Terkunci' })).toHaveCount(3)
  await expect(page.getByText('Selesaikan level Easy terlebih dahulu untuk membuka level Medium.')).toBeVisible()
})

test('dosen menjalankan simulator OWASP Top 10 dengan semua level terbuka dan tanpa gamifikasi', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: lecturer }))
  await page.route('**/api/latihan/dosen', r => r.fulfill({ json: { levels: [], tracks: [] } }))
  await buildMockSimulatorRoutes(page)()
  await page.route('**/api/labs/a05-sqli', r =>
    r.fulfill({
      json: {
        id: 'a05-sqli',
        track: 'web',
        owasp_code: 'A05',
        title: 'SQL Injection & Query Builder Aman',
        subtitle: 'Pencarian katalog produk yang menggabungkan string query mentah.',
        objective: 'Mengamankan query pencarian dari manipulasi sintaks SQL.',
        context: 'Fitur pencarian hanya boleh menampilkan produk publik.',
        cwe_id: 'CWE-89',
        wstg_ref: 'WSTG-INPV-05',
        asvs_ref: 'ASVS V5.3',
        estimated_minutes: 20,
        prerequisite: 'Tidak ada',
        fixture_actors: ['pengunjung'],
        trust_nodes: [],
        trust_edges: [],
        code_stacks: [],
        gamification_enabled: false,
        solution_unlocked: true,
        official_summary: 'Gunakan bind parameter.',
        levels: [
          { level: 'easy', label: 'Easy', xp: 0, title: 'Level Low', scenario: 'Tanpa proteksi', initial_control: 'Kosong', expected_baseline: '1 baris', expected_exploit: 'Semua baris', passed: false, unlocked: true, unlock_requirement: null, best_score: null, active_session_id: null, current_step: null },
          { level: 'medium', label: 'Medium', xp: 0, title: 'Level Medium', scenario: 'Filter parsial', initial_control: 'Blacklist', expected_baseline: '1 baris', expected_exploit: 'Bypass', passed: false, unlocked: true, unlock_requirement: null, best_score: null, active_session_id: null, current_step: null },
          { level: 'hard', label: 'Hard', xp: 0, title: 'Level High', scenario: 'ORDER BY dinamis', initial_control: 'Bind WHERE', expected_baseline: '1 baris', expected_exploit: 'Sort SQLi', passed: false, unlocked: true, unlock_requirement: null, best_score: null, active_session_id: null, current_step: null },
          { level: 'impossible', label: 'Impossible', xp: 0, title: 'Referensi Aman', scenario: 'Audit lengkap', initial_control: 'Allowlist penuh', expected_baseline: '1 baris', expected_exploit: 'Aman', passed: false, unlocked: true, unlock_requirement: null, best_score: null, active_session_id: null, current_step: null },
        ],
      },
    }),
  )
  await page.route('**/api/labs/sessions', async r => {
    const body = JSON.parse(r.request().postData() ?? '{}')
    expect(body.level_id).toBe('hard')
    await r.fulfill({ json: { session_id: 'ses-sqli-1', resumed: false } })
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/dosen/web')
  await expect(page.getByRole('heading', { level: 1, name: /OWASP Top 10:2025/ })).toBeVisible()
  await page.getByRole('button', { name: /Buka Lab/ }).first().click()

  await expect(page).toHaveURL(/\/lab\/dosen\/web\/A05\/a05-sqli$/)
  await expect(page.getByText('Semua Level Terbuka')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Terkunci' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mulai Level' })).toHaveCount(4)
  await expect(page.locator('text=/\\+\\d+ XP/')).toHaveCount(0)
  await expect(page.locator('.xp-pill, .rank-card, .tag-xp')).toHaveCount(0)

  // Dosen dapat langsung memilih level Hard tanpa harus lulus Easy/Medium terlebih dahulu
  await page.getByRole('button', { name: 'Mulai Level' }).nth(2).click()
  await expect(page).toHaveURL(/\/lab\/dosen\/sesi\/ses-sqli-1$/)
  await expect(page.getByText(/Mode Simulasi Dosen/)).toBeVisible()
  await expect(page.locator('text=/\\+\\d+ XP/')).toHaveCount(0)

  await page.getByRole('button', { name: 'Mode presentasi' }).click()
  await expect(page.getByRole('button', { name: 'Mode presentasi aktif' })).toBeVisible()
})

test('peta trust boundary tidak terpotong atau tumpang tindih pada mode default maupun layar penuh', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: student }))
  await buildMockSimulatorRoutes(page)()
  // Uji 4-node chain (IDOR) sekaligus karena paling rawan terpotong/tumpang tindih
  await page.route('**/api/labs/a01-idor', r =>
    r.fulfill({
      json: {
        id: 'a01-idor',
        track: 'web',
        owasp_code: 'A01',
        title: 'IDOR Detail & Invoice Pesanan',
        subtitle: 'Uji otorisasi horizontal.',
        objective: 'Kebijakan kepemilikan seragam.',
        context: 'Simulasi toko.',
        cwe_id: 'CWE-639',
        wstg_ref: 'WSTG-ATHZ-04',
        asvs_ref: 'ASVS V4.2',
        estimated_minutes: 15,
        prerequisite: 'Tidak ada',
        fixture_actors: ['rani', 'bima'],
        trust_nodes: [
          { id: 'actor', label: 'Browser (Rani)', zone: 'Untrusted Client', role: 'Mengirim parameter id/uuid' },
          { id: 'api', label: 'API Detail & Invoice', zone: 'Server Boundary', role: 'Validasi sesi & Actor' },
          { id: 'policy', label: 'OrderPolicy Check', zone: 'Authorization Gate', role: 'order.owner_id == actor.id' },
          { id: 'db', label: 'PostgreSQL Orders', zone: 'Trusted Store', role: 'Data pesanan #101 & #102' },
        ],
        trust_edges: [
          { from: 'actor', to: 'api', label: 'GET /orders/:id atau /invoices/:id', crosses_boundary: true },
          { from: 'api', to: 'policy', label: 'Ekstrak actor dari sesi', crosses_boundary: false },
          { from: 'policy', to: 'db', label: 'Query berparameter + cek owner_id', crosses_boundary: false },
        ],
        code_stacks: [],
        gamification_enabled: true,
        solution_unlocked: false,
        official_summary: null,
        levels: [
          { level: 'easy', label: 'Easy', xp: 25, title: 'IDOR', scenario: 'Tanpa check', initial_control: 'Kosong', expected_baseline: '101', expected_exploit: '102', passed: false, unlocked: true, unlock_requirement: null, best_score: null, active_session_id: null, current_step: null },
        ],
      },
    }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/web/A01/a01-idor')

  const assertNoOverlapOrClip = async (scope: import('@playwright/test').Locator | Page) => {
    const canvasBox = await scope.locator('.sim-flow-canvas').first().boundingBox()
    expect(canvasBox).not.toBeNull()
    const nodeBoxes = await scope.locator('.sim-flow-node').evaluateAll(els =>
      els.map(el => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }
      }),
    )
    const pillBoxes = await scope.locator('.sim-edge-pill').evaluateAll(els =>
      els.map(el => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }
      }),
    )
    expect(nodeBoxes.length).toBe(4)
    expect(pillBoxes.length).toBe(3)
    for (const nb of nodeBoxes) {
      expect(nb.x).toBeGreaterThanOrEqual(canvasBox!.x - 2)
      expect(nb.right).toBeLessThanOrEqual(canvasBox!.x + canvasBox!.width + 2)
    }
    for (const pb of pillBoxes) {
      for (const nb of nodeBoxes) {
        const overlaps = !(pb.right <= nb.x || pb.x >= nb.right || pb.bottom <= nb.y || pb.y >= nb.bottom)
        expect(overlaps).toBe(false)
      }
    }
  }

  await expect(page.getByText('Aliran Paket Aktif')).toBeVisible()
  await expect.poll(async () => {
    try {
      await assertNoOverlapOrClip(page)
      return true
    } catch {
      return false
    }
  }).toBe(true)

  await page.getByRole('button', { name: 'Buka peta tampilan penuh' }).click()
  const dialog = page.getByRole('dialog', { name: /Peta Interaktif Trust Boundary/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('animateMotion').first()).toBeAttached()
  await expect.poll(async () => {
    try {
      await assertNoOverlapOrClip(dialog)
      return true
    } catch {
      return false
    }
  }).toBe(true)

  await dialog.getByRole('button', { name: 'Jeda Animasi' }).click()
  await expect(dialog.getByRole('button', { name: 'Putar Animasi' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Tutup peta tampilan penuh' }).click()
  await expect(dialog).toHaveCount(0)
})

test('badge panjang di tahap pahami tidak keluar dari kartu atau menumpuk kolom kanan', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: student }))
  await buildMockSimulatorRoutes(page)()
  await page.route('**/api/labs/sessions/ses-sqli-1', r =>
    r.fulfill({
      json: {
        session: {
          id: 'ses-sqli-1',
          lab_id: 'a05-sqli',
          level_id: 'easy',
          level_label: 'Easy',
          xp_reward: 70,
          gamification_enabled: true,
          scenario_version: '2.0',
          current_step: 'pahami',
          selected_patch: null,
          hypothesis: null,
          diagnosis: null,
          hints_opened: 0,
          baseline_recorded: false,
          exploit_proved: false,
          verification_passed: false,
          reflection_submitted: false,
          score: null,
          passed: false,
          state: {},
          verification: [],
          reflection: {},
          row_version: 1,
          started_at: '2026-11-15T10:00:00Z',
          updated_at: '2026-11-15T10:00:00Z',
          completed_at: null,
        },
        lab: {
          id: 'a05-sqli',
          track: 'web',
          owasp_code: 'A05',
          title: 'Security Misconfiguration Sandbox',
          subtitle: 'Subjudul singkat.',
          objective: 'Tujuan.',
          context: 'Konteks.',
          cwe_id: 'CWE-16',
          wstg_ref: 'WSTG-CONF-01',
          asvs_ref: 'ASVS V14',
          fixture_actors: ['pengunjung'],
          trust_nodes: [],
          trust_edges: [],
          code_stacks: [],
          patch_options: [],
          unlocked_hints: [],
          total_hints: 0,
          level_spec: {
            title: 'Level Low',
            scenario: 'Skenario uji badge panjang.',
            initial_control: 'Aplikasi aman; reverse proxy masih menampilkan detail server_tokens & upstream',
            pahami_prompt: 'Pilih hipotesis:',
            hypothesis_options: ['Opsi 1', 'Opsi 2'],
            probe_instruction: 'Jalankan',
            diagnosis_options: ['Diag 1'],
            expected_baseline: 'Baseline',
            expected_exploit: 'Exploit',
            correct_hypothesis: null,
            correct_diagnosis: null,
          },
          reflection_spec: {
            root_cause_prompt: 'Akar',
            evidence_prompt: 'Bukti',
            transfer_question: 'Transfer',
            official_summary: null,
            key_takeaways: null,
          },
        },
      },
    }),
  )
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/lab/sesi/ses-sqli-1')

  const longBadge = page.getByText(/Aplikasi aman; reverse proxy masih menampilkan/)
  await expect(longBadge).toBeVisible()
  const bounds = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.sim-pane .card'))
    const firstCard = cards[0]?.getBoundingClientRect()
    const badge = Array.from(document.querySelectorAll('.sim-pane .card .badge')).find(el =>
      el.textContent?.includes('server_tokens'),
    )?.getBoundingClientRect()
    return firstCard && badge ? { cardRight: firstCard.right, badgeRight: badge.right } : null
  })
  expect(bounds).not.toBeNull()
  expect(bounds!.badgeRight).toBeLessThanOrEqual(bounds!.cardRight + 1)
})

test('halaman error konsisten memiliki tombol kembali ke halaman sekarang dan beranda serta switch EN', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: student }))
  await buildMockSimulatorRoutes(page)()
  await page.route('**/api/labs/sessions/tidak-ada', r =>
    r.fulfill({ status: 404, json: { status: 404, code: 'NOT_FOUND', message: 'Not found' } }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/sesi/tidak-ada')

  await expect(page.getByText('HTTP 404')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Coba Lagi' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kembali ke Beranda' })).toBeVisible()

  await page.getByRole('button', { name: 'Bahasa' }).click()
  await page.getByRole('menuitemradio', { name: 'English' }).click()
  await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back to Home' })).toBeVisible()
})

test('target form login SQL injection dan leaderboard dosen berfungsi', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: student }))
  await buildMockSimulatorRoutes(page)()
  await page.route('**/api/labs/sessions/ses-sqli-1/probe', async r => {
    const body = JSON.parse(r.request().postData() ?? '{}')
    expect(body.input.action).toBe('login_form')
    expect(body.input.payload).toBe("admin' --")
    await r.fulfill({
      json: {
        row_version: 2,
        baseline_recorded: true,
        exploit_proved: true,
        outcome: {
          request: { method: 'POST', path: '/api/target/login', headers: [], body: JSON.stringify(body.input) },
          response: { status: 200, status_text: 'OK', headers: [], body: '{"authenticated":true,"role":"admin"}', correlation_id: 'cid-login' },
          events: [{ stage: 'SQL Engine', component: 'Login Query', decision: 'Bypass', detail: 'Komentar -- memotong password', tone: 'bad' }],
          visual_data: { kind: 'sqli', mode: 'login_form', bypassed_auth: true, leaked_private: true, ast_tokens: ['SELECT', 'FROM users', "username='admin'", '--'], sql_preview: "SELECT * FROM users WHERE username='admin' --'", rows: [] },
          baseline_captured: true,
          exploit_proved: true,
          is_legitimate: false,
          updated_state: {},
        },
      },
    })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/sesi/ses-sqli-1')
  await page.getByRole('button', { name: /2\s+Uji Celah/ }).click()
  await page.getByRole('button', { name: "Payload: admin' --" }).click()
  await page.getByRole('button', { name: 'Kirim Login Target' }).click()
  await expect(page.getByText('Hasil Eksekusi Login SQLi & Token AST')).toBeVisible()
  await expect(page.getByText('SQL Injection Tembus')).toBeVisible({ timeout: 10000 })

  // Cek Leaderboard Dosen + filter
  await page.unroute('**/api/me')
  await page.route('**/api/me', r => r.fulfill({ json: lecturer }))
  await page.route('**/api/latihan/dosen', r => r.fulfill({ json: { levels: [], tracks: [] } }))
  await page.route('**/api/dashboard/instructor*', r =>
    r.fulfill({
      json: {
        classes: [{ id: 'IF-3A', name: 'Kelas IF-3A', course: 'Keamanan Web & IoT', semester: 'Ganjil', timezone: 'Asia/Jakarta' }],
        selected_class: 'IF-3A',
        kpis: { students_enrolled: 12, active_students: 10, assignments_passed: 8, assignments_total: 12, avg_score: 91.2 },
        assignments: [],
        score_histogram: [{ label: '90–100', count: 8 }],
        ungraded_count: 2,
        leaderboard: [
          { rank: 1, user_id: 's1', name: 'Aulia Putri', email: '122140001@student.itera.ac.id', nim: '122140001', class_id: 'IF-3A', xp: 420, badges_count: 4, levels_passed: 7, web_passed: 5, iot_passed: 2, sessions_completed: 7, avg_score: 96.5, last_active: '2026-11-15T10:00:00Z' },
          { rank: 2, user_id: 's2', name: 'Dimas Saputra', email: '122140002@student.itera.ac.id', nim: '122140002', class_id: 'IF-3A', xp: 340, badges_count: 3, levels_passed: 5, web_passed: 4, iot_passed: 1, sessions_completed: 5, avg_score: 91.0, last_active: '2026-11-15T10:00:00Z' },
        ],
        student_rows: [],
      },
    }),
  )
  await page.goto('/lab/dosen/leaderboard')
  await expect(page.getByText('122140001@student.itera.ac.id').first()).toBeVisible()
  await page.getByLabel('Cari mahasiswa di leaderboard').fill('122140002')
  await expect(page.getByText('122140002@student.itera.ac.id').first()).toBeVisible()
  await expect(page.getByText('122140001@student.itera.ac.id')).toHaveCount(0)
})

test('peringkat mahasiswa, anti-NaN & anti-HTTP 500 dengan avg_score null, serta visual & penjelasan pembelajaran', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: student }))
  await buildMockSimulatorRoutes(page)()
  await page.route('**/api/student/leaderboard*', r =>
    r.fulfill({
      json: {
        classes: [{ id: 'IF-3A', name: 'Kelas IF-3A', course: 'Keamanan Web & IoT' }],
        selected_class: 'ALL',
        my_rank: { rank: 2, total_students: 12, xp: 150, avg_score: 92, levels_passed: 2, badges_count: 1 },
        entries: [
          {
            rank: 1,
            user_id: 'u1',
            name: 'Aulia Putri',
            email: '122140001@student.itera.ac.id',
            nim: '122140001',
            class_id: 'IF-3A',
            xp: 420,
            total_xp: 420,
            badges_count: 4,
            levels_passed: 7,
            web_passed: 5,
            iot_passed: 2,
            sessions_completed: 7,
            avg_score: 96.5,
            graded_count: 7,
            last_active: '2026-11-15T10:00:00Z',
            is_self: false,
          },
          {
            rank: 2,
            user_id: student.id,
            name: student.name,
            email: student.email,
            nim: '123140001',
            class_id: 'IF-3A',
            xp: 150,
            total_xp: 150,
            badges_count: 1,
            levels_passed: 2,
            web_passed: 2,
            iot_passed: 0,
            sessions_completed: 2,
            avg_score: null,
            graded_count: 0,
            last_active: '2026-11-15T10:05:00Z',
            is_self: true,
          },
        ],
      },
    }),
  )

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab')
  await expect(page.getByText('Peringkat #2 dari 12 mahasiswa')).toBeVisible()
  await page.getByRole('link', { name: 'Lihat Peringkat Kelas' }).click()
  await expect(page.getByRole('heading', { name: 'Peringkat & Leaderboard Kelas' })).toBeVisible()
  await expect(page.getByText('Anda').first()).toBeVisible()
  await expect(page.getByText(/\bNaN\b/)).toHaveCount(0)

  // Cek workspace pembelajaran & ilustrasi visual target
  await page.goto('/lab/sesi/ses-sqli-1')
  await expect(page.getByText('Penjelasan Pembelajaran & Arahan Praktikum')).toBeVisible()
  await expect(page.getByText('Maksud Pertanyaan')).toBeVisible()
  await expect(page.getByText(/Ilustrasi Visual Target/)).toBeVisible()
  await page.getByRole('button', { name: /2\. Skenario Serangan/ }).click()
  await expect(page.getByText(/Celah Terbuka/)).toBeVisible()

  // Cek leaderboard dosen tahan terhadap avg_score null & data kosong tanpa HTTP 500 / NaN
  await page.unroute('**/api/me')
  await page.route('**/api/me', r => r.fulfill({ json: lecturer }))
  await page.route('**/api/latihan/dosen', r => r.fulfill({ json: { levels: [], tracks: [] } }))
  await page.route('**/api/dashboard/instructor*', r =>
    r.fulfill({
      json: {
        classes: [{ id: 'IF-3A', name: 'Kelas IF-3A', course: 'Keamanan Web & IoT', semester: 'Ganjil', timezone: 'Asia/Jakarta' }],
        selected_class: 'IF-3A',
        kpis: { students_enrolled: 12, active_students: 2, assignments_passed: 0, assignments_total: 4, avg_score: null },
        assignments: [],
        score_histogram: [{ label: '90–100', count: 0 }],
        ungraded_count: 0,
        weekly_activity: [{ label: '15 Nov', value: 0 }],
        track_breakdown: { web_sessions: 0, iot_sessions: 0, web_passed: 0, iot_passed: 0 },
        owasp_mastery: [],
        leaderboard: [
          {
            rank: 1,
            user_id: 'u-null',
            name: 'Nadia ITERA',
            email: '122140009@student.itera.ac.id',
            nim: '122140009',
            class_id: 'IF-3A',
            total_xp: 200,
            xp: 200,
            badges_count: 2,
            levels_passed: 3,
            web_passed: 2,
            iot_passed: 1,
            sessions_completed: 3,
            avg_score: null,
            graded_count: 0,
            last_active: null,
          },
        ],
        student_rows: [],
      },
    }),
  )
  await page.goto('/lab/dosen/leaderboard')
  await expect(page.getByText('HTTP 500')).toHaveCount(0)
  await expect(page.getByText('122140009@student.itera.ac.id').first()).toBeVisible()
  await expect(page.getByText(/\bNaN\b/)).toHaveCount(0)
})

test('simulator hardware IoT & ESP32-C3 berjalan interaktif dengan Serial Monitor, Plotter & verifikasi misi', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: student }))
  await buildMockSimulatorRoutes(page)()
  await page.route('**/api/iot/projects', async r => {
    if (r.request().method() === 'POST') {
      return r.fulfill({ json: { id: 'proj-1', title: 'Misi 1 · ESP32-C3 LED Blink & Resistor 220Ω', board: 'esp32-c3', saved: true } })
    }
    return r.fulfill({ json: { projects: [], completed_missions: [] } })
  })
  await page.route('**/api/iot/missions/submit', r =>
    r.fulfill({ json: { session_id: 'ses-iot-1', mission_id: 'iot-esp32-gpio', score: 100, passed: true, xp_awarded: 50 } }),
  )

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/iot')

  await expect(page.getByRole('heading', { level: 1, name: 'Simulator Hardware IoT & ESP32' })).toBeVisible()
  await expect(page.getByText('ESP32-C3', { exact: true }).first()).toBeVisible()

  // Background kode putih pada mode terang + syntax highlighting C++ (.ino)
  const codeBg = await page.locator('.iot-code-wrap').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(codeBg).toBe('rgb(255, 255, 255)')
  await expect(page.locator('.iot-code-highlight .tok-comment').first()).toBeVisible()
  await expect(page.locator('.iot-code-highlight .tok-preproc').first()).toBeVisible()
  await expect(page.locator('.iot-code-highlight .tok-type').first()).toBeVisible()
  await expect(page.locator('.iot-code-highlight .tok-builtin').first()).toBeVisible()
  await expect(page.locator('.iot-code-highlight .tok-string').first()).toBeVisible()
  const preprocColor = await page.locator('.iot-code-highlight .tok-preproc').first().evaluate((el) => getComputedStyle(el).color)
  const commentColor = await page.locator('.iot-code-highlight .tok-comment').first().evaluate((el) => getComputedStyle(el).color)
  expect(preprocColor).not.toBe('rgb(30, 41, 59)')
  expect(commentColor).not.toBe(preprocColor)

  // Autocomplete suggestion muncul saat mengetik kode C++/Arduino dan dapat disisipkan via Enter
  const codeEditor = page.getByLabel('Kode program mikrokontroler')
  const originalCode = await codeEditor.inputValue()
  await codeEditor.click()
  await codeEditor.evaluate((el: HTMLTextAreaElement) => {
    el.selectionStart = el.value.length
    el.selectionEnd = el.value.length
  })
  await page.keyboard.type('\n  dig')
  const acBox = page.getByRole('listbox', { name: 'Saran kode C++' })
  await expect(acBox).toBeVisible()
  await expect(acBox.getByRole('option', { name: /digitalWrite/ })).toBeVisible()
  await expect(acBox).toContainText('2 parameter')
  await expect(acBox).toContainText('uint8_t pin')
  await page.keyboard.press('Enter')
  await expect(acBox).toHaveCount(0)
  await expect(codeEditor).toHaveValue(/digitalWrite\(\)/)
  // Signature Help seperti VS Code muncul saat mengetik parameter di dalam (...)
  const sigBox = page.getByRole('status', { name: 'Info parameter fungsi' })
  await expect(sigBox).toBeVisible()
  await expect(sigBox).toContainText('Parameter 1 dari 2')
  await page.keyboard.type('2, ')
  await expect(sigBox).toContainText('Parameter 2 dari 2')

  // Uji auto-indentation saat Enter di dalam blok `{` serta tombol Rapikan (Format)
  await codeEditor.fill('void loop() {\ndigitalWrite(2, HIGH);\n}')
  await page.getByRole('button', { name: 'Rapikan' }).click()
  await expect(codeEditor).toHaveValue('void loop() {\n  digitalWrite(2, HIGH);\n}')
  await codeEditor.focus()
  await codeEditor.evaluate((el: HTMLTextAreaElement) => {
    const idx = el.value.indexOf('{') + 1
    el.selectionStart = idx
    el.selectionEnd = idx
  })
  await page.keyboard.press('Enter')
  await page.keyboard.type('delay(100);')
  await expect(codeEditor).toHaveValue('void loop() {\n  delay(100);\n  digitalWrite(2, HIGH);\n}')
  // Undo & Redo via keyboard di editor kode
  await page.keyboard.press('ControlOrMeta+z')
  await expect(codeEditor).toHaveValue('void loop() {\n  delay()\n  digitalWrite(2, HIGH);\n}')
  await page.keyboard.press('ControlOrMeta+y')
  await expect(codeEditor).toHaveValue('void loop() {\n  delay(100);\n  digitalWrite(2, HIGH);\n}')
  await codeEditor.fill(originalCode)

  // Cek tab Components lengkap dengan Microcontrollers, Sensors, Input Devices, Displays, Actuators, Passive & 3 ukuran Breadboard
  await page.getByRole('tab', { name: 'Components' }).click()
  await expect(page.getByRole('button', { name: 'Microcontrollers' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sensors' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Input Devices' })).toBeVisible()
  await expect(page.getByText('Arduino Mega', { exact: true })).toBeVisible()
  await expect(page.getByText('Mini Breadboard (170-Pt)', { exact: true })).toBeVisible()
  await expect(page.getByText('Medium Breadboard (Half 400-Pt)', { exact: true })).toBeVisible()
  await expect(page.getByText('Large Breadboard (Full 830-Pt)', { exact: true })).toBeVisible()

  // Klik kabel memilih kabel (tidak langsung menghapus) dan mendukung tarik kabel langsung dari pin
  const wireCountBefore = await page.locator('.iot-wire-group').count()
  await page.locator('.iot-wire-group').first().dispatchEvent('click')
  await expect(page.locator('.iot-wire-group')).toHaveCount(wireCountBefore)
  await expect(page.getByRole('button', { name: 'Hapus Kabel' })).toBeVisible()

  const pinFrom = page.locator('.iot-pin[data-node-id="board"][data-pin-id="GPIO5"] .iot-pin-hit')
  const pinTo = page.locator('.iot-pin[data-node-id="res-1"][data-pin-id="P2"] .iot-pin-hit')
  await pinFrom.scrollIntoViewIfNeeded()
  const boxFrom = await pinFrom.boundingBox()
  const boxTo = await pinTo.boundingBox()
  expect(boxFrom && boxTo).toBeTruthy()
  if (boxFrom && boxTo) {
    await page.mouse.move(boxFrom.x + boxFrom.width / 2, boxFrom.y + boxFrom.height / 2)
    await page.mouse.down()
    await page.mouse.move(boxTo.x + boxTo.width / 2, boxTo.y + boxTo.height / 2, { steps: 6 })
    await page.mouse.up()
  }
  await expect(page.locator('.iot-wire-group')).toHaveCount(wireCountBefore + 1)
  // Uji Undo & Redo kabel via tombol toolbar maupun keyboard (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
  await page.getByRole('button', { name: 'Undo (Ctrl+Z)' }).click()
  await expect(page.locator('.iot-wire-group')).toHaveCount(wireCountBefore)
  await page.getByRole('button', { name: 'Redo (Ctrl+Y)' }).click()
  await expect(page.locator('.iot-wire-group')).toHaveCount(wireCountBefore + 1)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.iot-wire-group')).toHaveCount(wireCountBefore)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(page.locator('.iot-wire-group')).toHaveCount(wireCountBefore + 1)

  // Uji batalkan tarikan pin/kabel yang belum selesai menggunakan keyboard Ctrl+Z
  await pinFrom.dispatchEvent('pointerdown', { clientX: boxFrom ? boxFrom.x + boxFrom.width / 2 : 0, clientY: boxFrom ? boxFrom.y + boxFrom.height / 2 : 0 })
  await pinFrom.dispatchEvent('pointerup')
  await expect(page.getByText(/Menarik kabel dari board:GPIO5/)).toBeVisible()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.getByText(/Menarik kabel dari board:GPIO5/)).toHaveCount(0)
  await expect(page.locator('.iot-wire-group')).toHaveCount(wireCountBefore + 1)

  await page.locator('.iot-wire-group').last().dispatchEvent('click')
  await expect(page.locator('.iot-wire-group')).toHaveCount(wireCountBefore + 1)
  // Kabel terpilih menampilkan pegangan colokan cabut-pindah & multi titik belok
  await expect(page.locator('.iot-wire-plug-handle')).toHaveCount(2)
  await expect(page.locator('.iot-wire-vertex-handle').first()).toBeVisible()
  await page.getByRole('button', { name: 'Hapus Kabel' }).click()
  await expect(page.locator('.iot-wire-group')).toHaveCount(wireCountBefore)

  // Klik badan resistor membuka pop-up gelang warna inline di kanvas
  const resistorBody = page.locator('.iot-resistor-body')
  const rBox = await resistorBody.boundingBox()
  expect(rBox).toBeTruthy()
  if (rBox) {
    await page.mouse.click(rBox.x + rBox.width / 2, rBox.y + rBox.height / 2)
  }
  await expect(page.getByRole('dialog', { name: 'Pengaturan komponen' })).toBeVisible()
  await page.getByRole('button', { name: '1kΩ', exact: true }).click()
  await expect(page.getByText('R1 (1kΩ)')).toBeVisible()
  await page.getByRole('button', { name: '220Ω', exact: true }).click()
  await page.getByRole('button', { name: 'Tutup', exact: true }).click()

  // Bisa menambah lebih dari 1 mikrokontroler (2 atau 3 MCU sekaligus) di 1 kanvas, masing-masing punya sketch & simulasi
  await expect(page.getByText('MQ2 Gas Sensor', { exact: true })).toBeVisible()
  await expect(page.getByText('Keypad 4×4 Matrix', { exact: true })).toBeVisible()
  await expect(page.getByText('Arduino Nano', { exact: true })).toBeVisible()
  await expect(page.getByText('Pi Pico', { exact: true })).toBeVisible()
  const bottomPart = page.getByText('Clock Generator', { exact: true })
  await bottomPart.scrollIntoViewIfNeeded()
  await expect(bottomPart).toBeVisible()
  await page.getByRole('button', { name: 'Tambah Arduino Uno ke kanvas' }).click()
  await expect(page.getByText('Arduino Uno #2', { exact: true })).toBeVisible()
  await expect(page.getByText('ATMEGA328P-PU', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Tambah Pi Pico ke kanvas' }).click()
  await expect(page.getByText('Pi Pico #3', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Main.ino' }).click()
  const mcuGroup = page.getByRole('group', { name: 'Pilih firmware MCU' })
  await expect(mcuGroup.getByRole('button', { name: /MCU 1/ })).toBeVisible()
  await expect(mcuGroup.getByRole('button', { name: /Arduino Uno #2/ })).toBeVisible()
  await expect(mcuGroup.getByRole('button', { name: /Pi Pico #3/ })).toBeVisible()
  await mcuGroup.getByRole('button', { name: /Arduino Uno #2/ }).click()
  await expect(page.getByLabel('Kode program mikrokontroler')).toHaveValue(/Firmware Arduino Uno #2/)
  await mcuGroup.getByRole('button', { name: /MCU 1/ }).click()
  await page.getByText('Pi Pico #3', { exact: true }).dispatchEvent('pointerdown')
  await page.getByText('Pi Pico #3', { exact: true }).dispatchEvent('pointerup')
  await page.getByRole('button', { name: 'Hapus Komponen' }).click()
  await expect(page.getByText('Pi Pico #3', { exact: true })).toHaveCount(0)
  await page.getByText('Arduino Uno #2', { exact: true }).dispatchEvent('pointerdown')
  await page.getByText('Arduino Uno #2', { exact: true }).dispatchEvent('pointerup')
  await page.getByRole('button', { name: 'Hapus Komponen' }).click()
  await expect(page.getByText('Arduino Uno #2', { exact: true })).toHaveCount(0)

  // Cek kustomisasi atribut Wokwi pada LED di kanvas & sinkronisasi diagram.json
  await page.getByText('LED Status', { exact: true }).dispatchEvent('pointerdown')
  await page.getByText('LED Status', { exact: true }).dispatchEvent('pointerup')
  await page.getByRole('button', { name: 'ORANGE', exact: true }).click()
  await page.getByLabel(/Balik polaritas kaki horizontal/).check()
  await page.getByRole('tab', { name: 'diagram.json' }).click()
  await expect(page.getByLabel('Wokwi diagram.json editor')).toHaveValue(/"color": "orange"/)
  await expect(page.getByLabel('Wokwi diagram.json editor')).toHaveValue(/"flip": "1"/)
  await page.getByLabel(/Balik polaritas kaki horizontal/).uncheck()
  await page.getByRole('button', { name: 'Tutup', exact: true }).click()

  // Cek Rangkaian & Koding lalu jalankan simulasi Blink + Resistor default & ROM bootloader terminal
  await page.getByRole('button', { name: 'Cek', exact: true }).click()
  await expect(page.getByText('Hasil Pemeriksaan Rangkaian & Koding')).toBeVisible()
  await page.getByRole('button', { name: 'Jalankan' }).click()
  await expect(page.getByLabel('Konsol Serial Monitor')).toContainText('ESP-ROM:esp32c3-api1-20210207')

  // Tab diagram.json (skema Wokwi v1 + linter), Library Manager & Logic Analyzer
  await page.getByRole('tab', { name: 'diagram.json' }).click()
  await expect(page.getByText('wokwi-cli lint: OK (0 errors)')).toBeVisible()
  await expect(page.getByLabel('Wokwi diagram.json editor')).toHaveValue(/wokwi-esp32-c3-devkitm-1/)

  await page.getByRole('tab', { name: 'Libraries' }).click()
  await expect(page.getByText('Adafruit SSD1306')).toBeVisible()
  const lastLibCard = page.locator('.iot-lib-item').last()
  await lastLibCard.scrollIntoViewIfNeeded()
  await expect(lastLibCard).toBeVisible()

  // Uji tambah file header (.h) lewat menu file dropdown & #include "pins.h" di Main.ino
  await page.getByRole('button', { name: 'Menu file sketch' }).click()
  await expect(page.getByRole('menu', { name: 'Menu file' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'New file...' }).click()
  await page.getByLabel(/Nama file baru/).fill('pins.h')
  await page.getByRole('button', { name: 'Buat', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'pins.h' })).toBeVisible()
  await page.getByLabel('Kode program mikrokontroler').fill('#define CUSTOM_LED 2\n')
  await page.getByRole('tab', { name: 'Main.ino' }).click()
  const mainCodeNow = await page.getByLabel('Kode program mikrokontroler').inputValue()
  await page.getByLabel('Kode program mikrokontroler').fill(`#include "pins.h"\n${mainCodeNow}`)
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.getByRole('button', { name: 'Jalankan' }).click()
  await expect(page.locator('.iot-compile-error')).toHaveCount(0)

  // Pastikan area kanvas dapat digeser (panning) & di-reset agar mudah menambah/mengedit banyak komponen
  const svgCanvas = page.locator('.iot-svg-board')
  const svgBox = await svgCanvas.boundingBox()
  expect(svgBox).toBeTruthy()
  if (svgBox) {
    const startX = svgBox.x + 28
    const startY = svgBox.y + 28
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX - 110, startY - 70, { steps: 6 })
    await page.mouse.up()
  }
  await expect(svgCanvas).toHaveAttribute('viewBox', /^(?!0 0 )/)
  await page.getByRole('button', { name: 'Reset zoom' }).click()
  await expect(svgCanvas).toHaveAttribute('viewBox', /^0 0 /)
  // Scroll vertikal di atas kanvas tidak menggeser kanvas secara tidak sengaja
  if (svgBox) {
    await page.mouse.move(svgBox.x + 28, svgBox.y + 28)
    await page.mouse.wheel(2, 140)
  }
  await expect(svgCanvas).toHaveAttribute('viewBox', /^0 0 /)

  // Klik komponen menampilkan simbol putar (handle ↻) di kanvas dan memutar komponen saat diklik
  await page.getByText('LED Status', { exact: true }).dispatchEvent('pointerdown')
  await page.getByText('LED Status', { exact: true }).dispatchEvent('pointerup')
  const rotateHandle = page.locator('.iot-rotate-handle')
  await expect(rotateHandle).toBeVisible()
  await rotateHandle.click()
  await page.getByRole('tab', { name: 'diagram.json' }).click()
  await expect(page.getByLabel('Wokwi diagram.json editor')).toHaveValue(/"rotate": 45/)

  await page.getByRole('tab', { name: 'Terminal' }).click()
  const serialLog = page.getByRole('log')
  await expect(serialLog.getByText('ESP32-C3 GPIO Siap!', { exact: true })).toBeVisible()
  await expect(serialLog.getByText('LED_STATE:1', { exact: true }).first()).toBeVisible()

  await page.getByRole('tab', { name: 'Logic Analyzer' }).click()
  await expect(page.getByRole('button', { name: /Download \.vcd/ })).toBeEnabled()

  await page.getByRole('button', { name: 'Kumpulkan Misi (+50 XP)' }).click()
  await expect(page.getByText(/Misi berhasil diverifikasi! Skor 100\/100 tercatat/)).toBeVisible()

  // Uji ganti preset ke Sensor Suhu DHT22 + OLED SSD1306 + Serial Plotter
  await page.getByLabel('Pilih template atau misi').selectOption('esp32-c3-dht-oled')
  await page.getByRole('button', { name: 'Jalankan' }).click()
  await expect(page.getByText('ESP32 ENV MONITOR', { exact: true })).toBeVisible()
  await expect(page.getByText('Temp: 28 C', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: /Serial Plotter/ }).click()
  await expect(page.locator('.iot-plot-legend')).toContainText('temp:')

  // Uji template Multi-MCU: 2 board berjalan paralel (ESP32-C3 GPIO2 -> Arduino Uno D4 -> LED Node #2)
  await page.getByLabel('Pilih template atau misi').selectOption('multi-mcu-bridge')
  await page.getByRole('button', { name: 'Jalankan' }).click()
  await expect(page.getByLabel('Konsol Serial Monitor')).toContainText('[Arduino Uno #2] RX=HIGH -> LED Node ON')

  // Simpan proyek ke database
  await page.getByRole('button', { name: 'Simpan Proyek' }).click()
  await expect(page.getByText(/berhasil disimpan ke database/)).toBeVisible()

  // Tambah ketiga ukuran Breadboard (Medium 400-Pt, Mini 170-Pt, Large 830-Pt) & uji semua lubang dapat diklik + Mode Fokus + Fullscreen
  await page.getByRole('tab', { name: 'Components' }).click()
  await page.getByRole('button', { name: 'Tambah Medium Breadboard (Half 400-Pt) ke kanvas' }).click()
  await expect(page.locator('.iot-bb-pin')).toHaveCount(400)
  await page.getByRole('button', { name: 'Tambah Mini Breadboard (170-Pt) ke kanvas' }).click()
  await expect(page.locator('.iot-bb-pin')).toHaveCount(570)
  await page.getByRole('button', { name: 'Tambah Large Breadboard (Full 830-Pt) ke kanvas' }).click()
  await expect(page.locator('.iot-bb-pin')).toHaveCount(1400)

  await page.getByRole('group', { name: 'Pilihan mode fokus' }).getByRole('button', { name: 'Fokus Studio' }).click()
  await expect(page.locator('.iot-studio')).toHaveClass(/is-focus-focus/)
  await expect(page.getByLabel('Bar Mode Fokus')).toBeVisible()

  await page.getByRole('group', { name: 'Pilihan mode fokus' }).getByRole('button', { name: 'Fokus Kanvas' }).click()
  await expect(page.locator('.iot-studio')).toHaveClass(/is-focus-canvas/)
  await expect(page.locator('.iot-left-panel')).toHaveCount(0)

  await page.getByLabel('Bar Mode Fokus').getByRole('button', { name: 'Layar Penuh' }).click()
  await expect(page.locator('.iot-studio')).toHaveClass(/is-fullscreen/)
  await page.getByLabel('Bar Mode Fokus').getByRole('button', { name: 'Keluar Layar Penuh' }).click()
  await expect(page.locator('.iot-studio')).not.toHaveClass(/is-fullscreen/)
  await page.getByRole('group', { name: 'Pilihan mode fokus' }).getByRole('button', { name: 'Normal' }).click()
  await expect(page.locator('.iot-left-panel')).toBeVisible()
})

test('halaman simulator web bersih dari label DVWA dan WebGoat', async ({ page }) => {
  await page.route('**/api/me', r => r.fulfill({ json: student }))
  await buildMockSimulatorRoutes(page)()
  await page.route('**/api/labs/a05-sqli', r =>
    r.fulfill({
      json: {
        id: 'a05-sqli',
        track: 'web',
        owasp_code: 'A05',
        title: 'SQL Injection & Query Builder Aman',
        subtitle: 'Pencarian katalog produk.',
        objective: 'Mengamankan query pencarian.',
        context: 'Katalog produk publik.',
        cwe_id: 'CWE-89',
        wstg_ref: 'WSTG-INPV-05',
        asvs_ref: 'ASVS V5.3',
        estimated_minutes: 20,
        prerequisite: 'Tidak ada',
        fixture_actors: ['pengunjung'],
        trust_nodes: [],
        trust_edges: [],
        code_stacks: [],
        gamification_enabled: true,
        solution_unlocked: false,
        official_summary: null,
        levels: [
          { level: 'easy', label: 'Easy', xp: 50, title: 'Level Low', scenario: 'Tanpa proteksi', initial_control: 'Kosong', expected_baseline: '1 baris', expected_exploit: 'Semua baris', passed: false, unlocked: true, unlock_requirement: null, best_score: null, active_session_id: null, current_step: null },
        ],
      },
    }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab')
  await expect(page.getByRole('heading', { name: /OWASP Top 10/ })).toBeVisible()
  const catalogBody = await page.locator('main').innerText()
  expect(catalogBody).not.toMatch(/dvwa|webgoat/i)

  await page.goto('/lab/web/A05/a05-sqli')
  await expect(page.getByRole('heading', { name: 'Pilih Tingkat Kesulitan (4 Level Bertahap)' })).toBeVisible()
  const detailBody = await page.locator('main').innerText()
  expect(detailBody).not.toMatch(/dvwa|webgoat/i)
})
