import { expect, test } from '@playwright/test'

const student = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Rani Mahasiswa',
  email: '123140001@student.itera.ac.id',
  role: 'mahasiswa' as const,
  allowed_roles: ['mahasiswa'],
  home_route: '/lab',
  csrf_token: 'csrf-student-test',
  expires_at: '2026-11-30T20:00:00Z',
}

const dosen = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Budi Dosen',
  email: 'budi@if.itera.ac.id',
  role: 'dosen' as const,
  allowed_roles: ['mahasiswa', 'dosen'],
  home_route: '/lab/dosen',
  csrf_token: 'csrf-dosen-test',
  expires_at: '2026-11-30T20:00:00Z',
}

const admin = {
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Rani Admin',
  email: 'admin@if.itera.ac.id',
  role: 'admin' as const,
  allowed_roles: ['dosen', 'admin'],
  home_route: '/lab/admin',
  csrf_token: 'csrf-admin-test',
  expires_at: '2026-11-30T20:00:00Z',
}

const LEVELS = [
  { level: 1, name: 'Mudah', points: 10 },
  { level: 2, name: 'Menengah', points: 20 },
  { level: 3, name: 'Sulit', points: 35 },
  { level: 4, name: 'Ahli', points: 50 },
]

function mockSecurityRoutes(page: Parameters<typeof test>[0] extends never ? never : import('@playwright/test').Page, email: string) {
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
  ])
}

test('Bank latihan Dosen hanya menampilkan 2 jalur (Cyber Security & IoT) serta mendukung impor Moodle XML', async ({
  page,
}) => {
  await page.route('**/api/me', (r) => r.fulfill({ json: dosen }))
  await mockSecurityRoutes(page, dosen.email)

  let importedAdded = false
  const importPayloads: Array<Record<string, unknown>> = []

  await page.route('**/api/dosen/latihan', (r) =>
    r.fulfill({
      json: {
        levels: LEVELS,
        policy: {
          enforce_sequential_unlock: true,
          allow_student_hints: true,
          hide_answer_explanations_until_due: true,
          allow_dosen_question_import: true,
          max_import_questions: 100,
        },
        tracks: [
          {
            id: 'web',
            title: 'Cyber Security',
            description: 'Pemahaman celah aplikasi web OWASP Top 10:2025 dan teknik perbaikannya.',
            exercises: [
              {
                id: 'web-1-1',
                level: 1,
                title: 'Batasi Parameter Redirect',
                owasp: 'A01',
                points: 10,
                status: 'terbuka',
                estimated_minutes: 5,
                tags: ['OWASP-A01'],
                source_format: 'json',
                content: {
                  scenario: 'Endpoint /login memakai ?next=.',
                  code: null,
                  code_lang: null,
                  question: 'Kontrol apa yang aman?',
                  kind: 'pilihan',
                  options: [
                    { key: 'a', text: 'Validasi allowlist host internal' },
                    { key: 'b', text: 'Terima semua URL penuh' },
                  ],
                  hint: 'Gunakan allowlist.',
                  explanation: 'Allowlist mencegah open redirect.',
                },
                key: { answers: ['a'] },
              },
              ...(importedAdded
                ? [
                    {
                      id: 'imp-web-moodle-1',
                      level: 2,
                      title: 'Validasi Parameter Redirect',
                      owasp: 'OWASP-A01',
                      points: 20,
                      status: 'terbuka',
                      estimated_minutes: 10,
                      tags: ['OWASP-A01', 'Redirect'],
                      source_format: 'moodle_xml',
                      content: {
                        scenario: 'Impor Moodle XML',
                        code: null,
                        code_lang: null,
                        question: 'Mengapa URL parameter ?next= perlu divalidasi?',
                        kind: 'pilihan',
                        options: [{ key: 'a', text: 'Mencegah Open Redirect' }],
                        hint: 'Gunakan allowlist.',
                        explanation: 'Mencegah situs phishing eksternal.',
                      },
                      key: { answers: ['a'] },
                    },
                  ]
                : []),
            ],
          },
          {
            id: 'iot',
            title: 'IoT',
            description: 'Praktik pengamanan firmware mikrokontroler, pin GPIO, komunikasi UART/MQTT.',
            exercises: [
              {
                id: 'iot-1-1',
                level: 1,
                title: 'Ganti PIN Standar Perangkat',
                owasp: 'A07',
                points: 10,
                status: 'terbuka',
                estimated_minutes: 6,
                tags: ['IoT'],
                source_format: 'json',
                content: {
                  scenario: 'Perangkat sensor memakai PIN default 0000.',
                  code: null,
                  code_lang: null,
                  question: 'Apa perbaikan yang tepat?',
                  kind: 'pilihan',
                  options: [
                    { key: 'a', text: 'Buat PIN unik per perangkat saat provisioning' },
                    { key: 'b', text: 'Pakai PIN sama di pabrik' },
                  ],
                  hint: 'Kredensial bawaan harus diganti.',
                  explanation: 'Mencegah kompromi massal.',
                },
                key: { answers: ['a'] },
              },
            ],
          },
        ],
      },
    }),
  )

  await page.route('**/api/dosen/latihan/import', (r) => {
    const req = JSON.parse(r.request().postData() || '{}') as Record<string, unknown>
    importPayloads.push(req)
    if (!req.dry_run) {
      importedAdded = true
      return r.fulfill({
        json: {
          dry_run: false,
          imported: 1,
          format: 'moodle_xml',
          previews: [
            {
              title: 'Validasi Parameter Redirect',
              track: 'web',
              level: 2,
              kind: 'pilihan',
              question: 'Mengapa URL parameter ?next= perlu divalidasi memakai allowlist domain internal?',
              options_count: 3,
              answer_preview: ['a'],
              tags: ['OWASP-A01', 'Redirect'],
              source_format: 'moodle_xml',
            },
          ],
        },
      })
    }
    return r.fulfill({
      json: {
        dry_run: true,
        format: 'moodle_xml',
        track: 'web',
        count: 1,
        previews: [
          {
            title: 'Validasi Parameter Redirect',
            track: 'web',
            level: 2,
            kind: 'pilihan',
            question: 'Mengapa URL parameter ?next= perlu divalidasi memakai allowlist domain internal?',
            options_count: 3,
            answer_preview: ['a'],
            tags: ['OWASP-A01', 'Redirect'],
            source_format: 'moodle_xml',
          },
        ],
      },
    })
  })

  let deletedCalled = false
  await page.route('**/api/dosen/latihan/imp-web-moodle-1', (r) => {
    if (r.request().method() === 'DELETE') {
      deletedCalled = true
      importedAdded = false
      return r.fulfill({ json: { deleted: 'imp-web-moodle-1' } })
    }
    return r.fulfill({ status: 405 })
  })

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/lab/dosen/latihan')

  await expect(page.getByRole('tab', { name: /Cyber Security/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^IoT/ })).toBeVisible()
  await expect(page.getByText('Keamanan IoT')).toHaveCount(0)

  await page.getByRole('button', { name: 'Impor Soal Moodle LMS' }).click()
  const bankTrackSelect = page.getByLabel('Jalur target soal')
  await expect(bankTrackSelect).toBeVisible()
  const trackOptions = await bankTrackSelect.locator('option').allInnerTexts()
  expect(trackOptions).toEqual(['Cyber Security', 'IoT'])

  await page.getByRole('button', { name: 'Contoh Moodle XML' }).click()
  await page.getByRole('button', { name: 'Pratinjau Soal' }).click()

  await expect(page.getByText('Pratinjau siap: 1 soal terdeteksi (format: moodle_xml).')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'moodle_xml' })).toBeVisible()

  await page.getByRole('button', { name: 'Simpan ke Bank Soal' }).click()
  await expect(page.getByText('Berhasil mengimpor 1 soal (moodle_xml) ke Bank Latihan.')).toBeVisible()
  expect(importPayloads.some((p) => p.dry_run === true)).toBe(true)
  expect(importPayloads.some((p) => p.dry_run === false && p.track === 'web')).toBe(true)

  const importedLink = page.getByRole('link', { name: /Validasi Parameter Redirect/i })
  await expect(importedLink).toBeVisible()
  await importedLink.click()

  await expect(page.getByText('Impor MOODLE_XML')).toBeVisible()
  await page.getByRole('button', { name: 'Hapus soal impor' }).click()
  await expect.poll(() => deletedCalled).toBe(true)
})

test('Admin menyimpan kebijakan anti-kecurangan dan Mahasiswa tidak dapat mengakses kontrol Admin atau hint saat dinonaktifkan', async ({
  page,
}) => {
  await page.route('**/api/me', (r) => r.fulfill({ json: admin }))
  await mockSecurityRoutes(page, admin.email)
  await page.route('**/api/dashboard/admin', (r) => r.fulfill({ json: null }))
  await page.route('**/api/admin/security-monitor', (r) =>
    r.fulfill({
      json: {
        summary: { active_sessions: 1, unacknowledged_anomalies: 0, mfa_enabled_users: 2, emails_sent_total: 4 },
        active_sessions: [],
        activity_logs: [],
        anomalies: [],
      },
    }),
  )

  let savedSettings: Record<string, unknown> | null = null
  await page.route('**/api/admin/settings', (r) => {
    if (r.request().method() === 'POST') {
      savedSettings = JSON.parse(r.request().postData() || '{}') as Record<string, unknown>
      return r.fulfill({ json: { settings: savedSettings } })
    }
    return r.fulfill({
      json: {
        settings: {
          active_tracks: ['web', 'iot'],
          enforce_sequential_unlock: true,
          strict_deadline_lock: true,
          block_concurrent_attempts: true,
          max_import_questions: 100,
          allow_dosen_question_import: true,
          allow_student_hints: true,
          hide_answer_explanations_until_due: true,
        },
      },
    })
  })

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/lab/admin/pengaturan')

  await page.getByLabel('Batas soal Moodle LMS per impor (10–500)').fill('150')
  await page.getByLabel(/Izinkan Petunjuk \(Hint\) Mahasiswa/).uncheck()
  await page.getByRole('button', { name: 'Simpan Kebijakan Platform' }).click()

  await expect(page.getByText('Kebijakan keamanan, jalur, dan anti-kecurangan berhasil disimpan.')).toBeVisible()
  expect(savedSettings).toMatchObject({
    active_tracks: ['web', 'iot'],
    max_import_questions: 150,
    allow_student_hints: false,
  })

  // Verifikasi sesi Mahasiswa diblokir dari halaman Admin & hint dinonaktifkan
  await page.unroute('**/api/me')
  await page.route('**/api/me', (r) => r.fulfill({ json: student }))
  await page.route('**/api/latihan', (r) =>
    r.fulfill({
      json: {
        levels: LEVELS,
        policy: {
          enforce_sequential_unlock: true,
          allow_student_hints: false,
          hide_answer_explanations_until_due: true,
          allow_dosen_question_import: true,
          max_import_questions: 150,
        },
        tracks: [
          {
            id: 'web',
            title: 'Cyber Security',
            description: 'Jalur keamanan aplikasi web.',
            exercises: [
              {
                id: 'web-1-1',
                level: 1,
                title: 'Validasi Parameter Redirect',
                owasp: 'A01',
                points: 10,
                status: 'terbuka',
                estimated_minutes: 5,
                tags: ['OWASP-A01'],
                source_format: 'json',
                content: {
                  scenario: 'Endpoint /login memakai ?next=.',
                  code: null,
                  code_lang: null,
                  question: 'Kontrol apa yang aman?',
                  kind: 'pilihan',
                  options: [{ key: 'a', text: 'Validasi allowlist host internal' }],
                  hint: null,
                  explanation: null,
                },
              },
            ],
          },
          {
            id: 'iot',
            title: 'IoT',
            description: 'Jalur keamanan perangkat IoT.',
            exercises: [],
          },
        ],
      },
    }),
  )

  await page.goto('/lab/admin/pengaturan')
  await expect(page.getByText('Kebijakan Platform, Jalur Aktif & Anti-Kecurangan')).toHaveCount(0)

  await page.goto('/lab/latihan/web-1-1')
  await expect(page.getByText('Petunjuk dinonaktifkan oleh kebijakan Admin.')).toBeVisible()
})

test('Penugasan Praktikum Dosen & Mahasiswa terperinci serta mengunci tugas lewat tenggat', async ({ page }) => {
  await page.route('**/api/me', (r) => r.fulfill({ json: dosen }))
  await mockSecurityRoutes(page, dosen.email)

  const labsFixture = [
    {
      id: 'a05-sqli',
      track: 'web',
      owasp_code: 'A05',
      title: 'SQL Injection & Query Builder Aman',
      subtitle: 'Query aman',
      objective: 'Mencegah SQLi',
      cwe_id: 'CWE-89',
      wstg_ref: 'WSTG-INPV-05',
      asvs_ref: 'ASVS V5.3',
      estimated_minutes: 20,
      prerequisite: 'Tidak ada',
      publication_status: 'Terbit',
      version: '1.0.0',
      passed_levels: 0,
      total_levels: 4,
      levels: [],
    },
    {
      id: 'iot-esp32-gpio',
      track: 'iot',
      owasp_code: null,
      title: 'Autentikasi Perangkat & UART Sensor',
      subtitle: 'PIN ESP32',
      objective: 'Mengamankan pin',
      cwe_id: 'CWE-798',
      wstg_ref: 'WSTG-IOT-01',
      asvs_ref: 'ASVS V2',
      estimated_minutes: 25,
      prerequisite: 'Tidak ada',
      publication_status: 'Terbit',
      version: '1.0.0',
      passed_levels: 0,
      total_levels: 4,
      levels: [],
    },
  ]

  let createdBody: Record<string, unknown> | null = null
  const publishedAssignments = [
    {
      id: 'asg-existing-1',
      class_id: 'IF-4A',
      title: 'Praktikum MQTT & Sensor IoT',
      lab_id: 'iot-esp32-gpio',
      lab_title: 'Autentikasi Perangkat & UART Sensor',
      track: 'iot',
      track_label: 'IoT',
      required_level: 'medium',
      due_at: '2026-11-30T23:59:00Z',
      pass_threshold: 80,
      allow_hints: true,
      description: 'Validasi kredensial perangkat & konfigurasi sensor ESP32.',
      instructions: '1. Periksa koneksi VCC-GND\n2. Uji telemetri aman',
      rubric: [{ criterion: 'Wiring & Firmware Aman', weight: 100 }],
      attachment_url: null,
      max_attempts: 3,
      allow_late: false,
      not_started: 0,
      running: 1,
      passed: 1,
      denominator: 2,
      student_details: [
        {
          user_id: student.id,
          name: student.name,
          email: student.email,
          status: 'Berjalan',
          score: 75,
          session_id: 'ses-1',
        },
      ],
    },
  ]

  await page.route('**/api/labs/catalog**', (r) =>
    r.fulfill({ json: { categories: [], labs: labsFixture, recent_session: null } }),
  )
  await page.route('**/api/dashboard/instructor**', (r) =>
    r.fulfill({
      json: {
        classes: [{ id: 'IF-4A', name: 'Kelas IF-4A · IoT', course: 'IoT & Cyber Security', semester: 'Ganjil', timezone: 'Asia/Jakarta' }],
        selected_class: 'IF-4A',
        kpis: { students_enrolled: 2, active_students: 2, assignments_passed: 1, assignments_total: 2, avg_score: 75 },
        assignments: publishedAssignments,
        score_histogram: [],
        ungraded_count: 0,
        student_rows: [],
      },
    }),
  )
  await page.route('**/api/dosen/assignments', (r) => {
    createdBody = JSON.parse(r.request().postData() || '{}') as Record<string, unknown>
    return r.fulfill({ json: { id: 'asg-new-iot', class_id: 'IF-4A', title: createdBody.title, track: 'iot' } })
  })

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/lab/dosen/penugasan')

  const trackSelect = page.getByLabel('Jalur Praktikum')
  await expect(trackSelect).toBeVisible()
  expect(await trackSelect.locator('option').allInnerTexts()).toEqual(['Cyber Security', 'IoT'])
  await trackSelect.selectOption('iot')
  await expect(page.getByLabel('Modul Lab (IoT)')).toBeVisible()

  await page.getByLabel('Judul Penugasan').fill('Audit Telemetry ESP32 & Buzzer Alert')
  await page.getByLabel('Deskripsi Tugas & Skenario').fill('Pastikan payload MQTT tervalidasi sebelum menyalakan aktuator.')
  await page.getByLabel('Instruksi Langkah Pengerjaan').fill('1. Cek PIN default\n2. Uji sensor DHT22')
  await page.getByRole('button', { name: 'Terbitkan Penugasan' }).click()

  await expect(page.getByText('Penugasan "Audit Telemetry ESP32 & Buzzer Alert" untuk kelas IF-4A tersimpan.')).toBeVisible()
  expect(createdBody).toMatchObject({
    track: 'iot',
    lab_id: 'iot-esp32-gpio',
    description: 'Pastikan payload MQTT tervalidasi sebelum menyalakan aktuator.',
  })

  await page.getByRole('button', { name: 'Lihat Detail' }).first().click()
  await expect(page.getByRole('dialog')).toContainText('Wiring & Firmware Aman — 100%')
  await expect(page.getByRole('dialog')).toContainText('Rani Mahasiswa')

  // Beralih ke tampilan Mahasiswa untuk Tugas Kelas terperinci & penguncian tenggat
  await page.unroute('**/api/me')
  await page.route('**/api/me', (r) => r.fulfill({ json: student }))
  await page.route('**/api/dashboard/student', (r) =>
    r.fulfill({
      json: {
        kpis: { labs_completed: 1, labs_total: 15, levels_passed: 2, levels_total: 60, assignments_done: 0, assignments_total: 2, xp: 40 },
        continue_session: null,
        activity_series: [],
        score_series: [],
        owasp_map: [],
        badges: [],
        recent_sessions: [],
        assignments: [
          {
            id: 'stu-asg-open',
            class_id: 'IF-4A',
            title: 'Praktikum Telemetry IoT Aktif',
            lab_id: 'iot-esp32-gpio',
            lab_title: 'Autentikasi Perangkat & UART Sensor',
            track: 'iot',
            track_label: 'IoT',
            required_level: 'easy',
            due_at: '2026-12-01T12:00:00Z',
            pass_threshold: 80,
            allow_hints: true,
            description: 'Implementasi pembacaan aman pin IoT.',
            instructions: '1. Sambungkan GPIO\n2. Verifikasi serial',
            rubric: [{ criterion: 'Validasi Rangkaian & Kode', weight: 100 }],
            attachment_url: 'https://example.edu/modul-iot.pdf',
            max_attempts: 3,
            attempts_used: 1,
            allow_late: false,
            overdue: false,
            locked_by_deadline: false,
            locked_by_attempts: false,
            best_score: 70,
            status: 'Berjalan',
            session_id: null,
          },
          {
            id: 'stu-asg-locked',
            class_id: 'IF-3A',
            title: 'Audit SQLi Lewat Tenggat',
            lab_id: 'a05-sqli',
            lab_title: 'SQL Injection & Query Builder Aman',
            track: 'web',
            track_label: 'Cyber Security',
            required_level: 'medium',
            due_at: '2026-10-01T12:00:00Z',
            pass_threshold: 85,
            allow_hints: false,
            description: 'Harus terkunci otomatis saat tenggat lewat.',
            instructions: 'Tenggat sudah berakhir.',
            rubric: [{ criterion: 'Parameterized Query', weight: 100 }],
            attachment_url: null,
            max_attempts: 2,
            attempts_used: 1,
            allow_late: false,
            overdue: true,
            locked_by_deadline: true,
            locked_by_attempts: false,
            best_score: null,
            status: 'Terlambat',
            session_id: null,
          },
        ],
      },
    }),
  )

  await page.goto('/lab/tugas')
  await expect(page.getByText('Audit SQLi Lewat Tenggat')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Terkunci Tenggat' })).toBeDisabled()

  await page.getByRole('button', { name: 'IoT', exact: true }).click()
  await expect(page.getByText('Praktikum Telemetry IoT Aktif')).toBeVisible()
  await expect(page.getByText('Audit SQLi Lewat Tenggat')).toHaveCount(0)

  await page.getByRole('button', { name: 'Detail' }).click()
  const stuDrawer = page.getByRole('dialog')
  await expect(stuDrawer).toContainText('Validasi Rangkaian & Kode — 100%')
  await expect(stuDrawer).toContainText('1 dari 3 percobaan')
  await expect(stuDrawer.getByRole('link', { name: 'Buka Lampiran Referensi' })).toHaveAttribute(
    'href',
    'https://example.edu/modul-iot.pdf',
  )
})

test('Mahasiswa melihat 10 misi IoT Studio, achievement badge, dan mengirim bukti rangkaian lengkap ke server', async ({
  page,
}) => {
  await page.route('**/api/me', (r) => r.fulfill({ json: student }))
  await mockSecurityRoutes(page, student.email)

  const submittedPayloads: Array<Record<string, unknown>> = []
  let mission10Done = false

  await page.route('**/api/iot/projects', (r) =>
    r.fulfill({
      json: {
        projects: [],
        completed_missions: mission10Done
          ? [{ mission_id: 'iot-esp32-secure-telemetry', score: 100, completed_at: '2026-11-19T12:00:00Z' }]
          : [],
        achievements: [
          {
            id: 'iot-perintis',
            key: 'badge:iot-perintis',
            title: 'Perintis IoT Studio',
            detail: 'Menyelesaikan misi simulasi perangkat keras IoT pertama.',
            xp: 25,
            earned: mission10Done,
          },
          {
            id: 'iot-telemetri-tls',
            key: 'badge:iot-telemetri-tls',
            title: 'Penjaga Telemetri TLS',
            detail: 'Menuntaskan misi komunikasi IoT terenkripsi mqtts:// TLS.',
            xp: 40,
            earned: mission10Done,
          },
        ],
        iot_xp: mission10Done ? 145 : 0,
      },
    }),
  )

  await page.route('**/api/iot/missions/submit', (r) => {
    submittedPayloads.push(JSON.parse(r.request().postData() || '{}') as Record<string, unknown>)
    mission10Done = true
    return r.fulfill({
      json: {
        session_id: 'ses-iot-10',
        mission_id: 'iot-esp32-secure-telemetry',
        score: 100,
        passed: true,
        xp_awarded: 145,
        newly_unlocked: ['Perintis IoT Studio', 'Penjaga Telemetri TLS'],
      },
    })
  })

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/lab/iot')

  await expect(page.getByText('Misi Praktikum IoT (0/10 Tuntas)')).toBeVisible()
  await expect(page.getByText('0/2 Achievement IoT')).toBeVisible()
  await expect(page.locator('.iot-mission-pill')).toHaveCount(10)

  await page.getByRole('button', { name: /Misi 10 · Guard Sensor Suhu/ }).click()
  await page.getByRole('button', { name: 'Jalankan' }).click()

  const submitBtn = page.getByRole('button', { name: 'Kumpulkan Misi (+80 XP)' })
  await expect(submitBtn).toBeEnabled()
  await submitBtn.click()

  await expect(page.getByText(/Lencana terbuka: Perintis IoT Studio, Penjaga Telemetri TLS/)).toBeVisible()
  await expect(page.getByText('Misi Praktikum IoT (1/10 Tuntas)')).toBeVisible()
  await expect(page.getByText('2/2 Achievement IoT')).toBeVisible()

  const submittedPayload = submittedPayloads[0]
  expect(submittedPayload).toMatchObject({
    mission_id: 'iot-esp32-secure-telemetry',
    mqtt_tls_verified: true,
    has_hardware_alerts: false,
  })
  expect(Array.isArray(submittedPayload?.components)).toBe(true)
  expect(Array.isArray(submittedPayload?.wires)).toBe(true)
  expect(Number(submittedPayload?.loop_iterations)).toBeGreaterThanOrEqual(1)
})
