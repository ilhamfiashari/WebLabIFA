import { expect, test } from '@playwright/test'

const student = {
  id: '00000000-0000-0000-0000-000000000101',
  name: 'Rani Mahasiswa',
  email: '123140051@student.itera.ac.id',
  role: 'mahasiswa',
  allowed_roles: ['mahasiswa'],
  home_route: '/lab',
  csrf_token: 'csrf-student',
  expires_at: '2026-11-16T20:00:00Z',
}

const admin = {
  id: '00000000-0000-0000-0000-0000000000a1',
  name: 'Ilham Admin',
  email: 'admin@institution.example',
  role: 'admin',
  allowed_roles: ['dosen', 'admin'],
  home_route: '/lab/admin',
  csrf_token: 'csrf-admin',
  expires_at: '2026-11-16T20:00:00Z',
}

test('pengaturan keamanan akun mahasiswa: email, TOTP, passkey, backup codes, sesi & bel notifikasi', async ({ page }) => {
  let mfaEnabled = false
  let totpVerified = false
  let secondaryEmail: string | null = null
  let passkeys = [
    {
      id: 'pk-1',
      credential_id: 'cred-1',
      device_name: 'Laptop Kampus',
      transports: 'internal',
      created_at: '2026-11-15T08:00:00Z',
      last_used_at: null,
    },
  ]
  let sessions = [
    {
      session_id: 'sess-current',
      active_role: 'mahasiswa',
      ip_address: '10.24.10.21',
      device_label: 'Chrome · macOS',
      location_label: 'Jaringan Lokal / Kampus',
      current_path: '/lab/pengaturan',
      mfa_verified: false,
      created_at: '2026-11-15T09:00:00Z',
      last_seen_at: '2026-11-15T10:00:00Z',
      expires_at: '2026-11-15T17:00:00Z',
      is_current: true,
    },
    {
      session_id: 'sess-other',
      active_role: 'mahasiswa',
      ip_address: '182.10.42.88',
      device_label: 'Firefox · Linux',
      location_label: 'Jaringan Publik (182.10.42.88)',
      current_path: '/lab/web',
      mfa_verified: false,
      created_at: '2026-11-15T07:00:00Z',
      last_seen_at: '2026-11-15T09:15:00Z',
      expires_at: '2026-11-15T15:00:00Z',
      is_current: false,
    },
  ]
  let unreadCount = 1

  await page.route('**/api/me', (route) => route.fulfill({ json: student }))
  await page.route('**/api/account/presence', (route) => route.fulfill({ json: { ok: true, path: '/lab/pengaturan' } }))
  await page.route('**/api/notifications', (route) =>
    route.fulfill({
      json: {
        unread: unreadCount,
        items: [
          {
            id: 'note-1',
            recipient_email: student.email,
            category: 'assignment',
            subject: '[Tugas Baru IF-4A] Audit Celah Akses IDOR',
            body_preview: 'Dosen menerbitkan tugas praktikum Broken Access Control.',
            status: 'sent',
            created_at: '2026-11-15T09:00:00Z',
            sent_at: '2026-11-15T09:00:00Z',
            read_at: unreadCount === 0 ? '2026-11-15T10:05:00Z' : null,
          },
        ],
      },
    }),
  )
  await page.route('**/api/notifications/read', (route) => {
    unreadCount = 0
    return route.fulfill({ json: { ok: true } })
  })
  await page.route('**/api/account/security', (route) =>
    route.fulfill({
      json: {
        primary_email: student.email,
        secondary_email: secondaryEmail,
        notify_assignments: true,
        notify_feedback: true,
        notify_security_alerts: true,
        mfa_enabled: mfaEnabled,
        totp_verified: totpVerified,
        backup_codes_remaining: 8,
        passkeys,
        sessions,
        notifications: [
          {
            id: 'note-1',
            recipient_email: secondaryEmail ?? student.email,
            category: 'assignment',
            subject: '[Tugas Baru IF-4A] Audit Celah Akses IDOR',
            body_preview: 'Dosen menerbitkan tugas praktikum Broken Access Control.',
            status: 'sent',
            created_at: '2026-11-15T09:00:00Z',
            sent_at: '2026-11-15T09:00:00Z',
            read_at: null,
          },
        ],
        recent_activity: [],
      },
    }),
  )
  await page.route('**/api/account/security/preferences', async (route) => {
    const body = route.request().postDataJSON() as { secondary_email?: string | null }
    secondaryEmail = body.secondary_email ?? null
    await route.fulfill({ json: { ok: true, secondary_email: secondaryEmail } })
  })
  await page.route('**/api/account/security/totp/enroll', (route) =>
    route.fulfill({
      json: {
        secret: 'JBSWY3DPEHPK3PXP',
        otpauth_uri: 'otpauth://totp/WebLabIFA:123140051@student.itera.ac.id?secret=JBSWY3DPEHPK3PXP',
        issuer: 'WebLabIFA',
        account: student.email,
      },
    }),
  )
  await page.route('**/api/account/security/totp/verify', (route) => {
    mfaEnabled = true
    totpVerified = true
    return route.fulfill({ json: { mfa_enabled: true, totp_verified: true } })
  })
  await page.route('**/api/account/security/passkeys/challenge', (route) =>
    route.fulfill({
      json: {
        challenge: 'aabbccdd',
        rp_name: 'WebLabIFA',
        user_id: student.id,
        user_name: student.email,
        user_display_name: student.name,
      },
    }),
  )
  await page.route('**/api/account/security/passkeys', async (route) => {
    const body = route.request().postDataJSON() as { device_name: string }
    passkeys = [
      {
        id: 'pk-2',
        credential_id: 'cred-2',
        device_name: body.device_name,
        transports: 'hybrid',
        created_at: '2026-11-15T10:02:00Z',
        last_used_at: null,
      },
      ...passkeys,
    ]
    mfaEnabled = true
    await route.fulfill({ json: { id: 'pk-2', device_name: body.device_name } })
  })
  await page.route('**/api/account/security/backup-codes/regenerate', (route) =>
    route.fulfill({
      json: {
        codes: ['ABCD-1234', 'EFGH-5678', 'IJKL-9012', 'MNOP-3456', 'QRST-7890', 'UVWX-1122', 'YZ23-3344', '4567-5566'],
        remaining: 8,
      },
    }),
  )
  await page.route('**/api/account/sessions/*/revoke', (route) => {
    sessions = sessions.filter((s) => s.is_current)
    return route.fulfill({ json: { revoked: true } })
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/pengaturan')

  await expect(page.getByRole('heading', { level: 1, name: 'Pengaturan Keamanan Akun' })).toBeVisible()

  await page.locator('#secondary-email-input').fill('rani.backup@example.com')
  await page.getByRole('button', { name: 'Simpan Pengaturan Email' }).click()
  await expect(page.getByText('Preferensi email & notifikasi berhasil disimpan.')).toBeVisible()

  await page.getByRole('button', { name: 'Siapkan Authenticator App' }).click()
  await expect(page.getByText('JBSWY3DPEHPK3PXP', { exact: true })).toBeVisible()
  await page.getByLabel('Kode verifikasi TOTP').fill('123456')
  await page.getByRole('button', { name: 'Verifikasi & Aktifkan' }).click()
  await expect(page.getByText('Authenticator App berhasil diaktifkan.')).toBeVisible()

  await page.getByLabel('Nama perangkat Passkey').fill('MacBook Touch ID')
  await page.getByRole('button', { name: 'Tambah Passkey' }).click()
  await expect(page.getByText('Passkey "MacBook Touch ID" berhasil didaftarkan.')).toBeVisible()
  await expect(page.getByText('MacBook Touch ID', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Buat Ulang 8 Backup Codes' }).click()
  await expect(page.getByText('ABCD-1234')).toBeVisible()

  await page.getByRole('button', { name: 'Cabut Sesi' }).click()
  await expect(page.getByText('Firefox · Linux')).toHaveCount(0)

  await page.getByRole('button', { name: /Notifikasi/ }).click()
  await expect(page.getByText('[Tugas Baru IF-4A] Audit Celah Akses IDOR').first()).toBeVisible()
  await page.getByRole('button', { name: 'Tandai dibaca' }).click()
})

test('admin monitor sesi aktif, posisi pengguna, log aktivitas & konfirmasi anomali', async ({ page }) => {
  let acked = false
  let activeSessions = [
    {
      session_id: 'sess-stu-1',
      user_id: student.id,
      user_name: 'Rani Mahasiswa',
      email: '123140051@student.itera.ac.id',
      active_role: 'mahasiswa',
      ip_address: '10.24.10.21',
      device_label: 'Chrome · Windows',
      location_label: 'Jaringan Kampus ITERA',
      current_path: '/lab/web/A01/broken-access-control',
      mfa_verified: true,
      created_at: '2026-11-15T09:00:00Z',
      last_seen_at: '2026-11-15T10:10:00Z',
      expires_at: '2026-11-15T17:00:00Z',
    },
  ]

  await page.route('**/api/me', (route) => route.fulfill({ json: admin }))
  await page.route('**/api/dashboard/admin', (route) => route.fulfill({ json: null }))
  await page.route('**/api/account/presence', (route) => route.fulfill({ json: { ok: true, path: '/lab/admin/audit' } }))
  await page.route('**/api/notifications', (route) => route.fulfill({ json: { items: [], unread: 0 } }))
  await page.route('**/api/admin/security-monitor', (route) =>
    route.fulfill({
      json: {
        summary: {
          active_sessions: activeSessions.length,
          unacknowledged_anomalies: acked ? 0 : 1,
          mfa_enabled_users: 4,
          emails_sent_total: 12,
        },
        active_sessions: activeSessions,
        anomalies: [
          {
            id: 'anom-1',
            user_id: student.id,
            actor_email: '123140051@student.itera.ac.id',
            user_name: 'Rani Mahasiswa',
            kind: 'new_location',
            severity: 'high',
            summary: 'Login lokasi berbeda terdeteksi untuk akun mahasiswa',
            ip_address: '182.10.42.88',
            device_label: 'Firefox · Linux',
            location_label: 'Jaringan Publik (182.10.42.88)',
            acknowledged: acked,
            created_at: '2026-11-15T10:00:00Z',
          },
        ],
        activity_logs: [
          {
            id: 'act-1',
            user_id: student.id,
            actor_email: '123140051@student.itera.ac.id',
            user_name: 'Rani Mahasiswa',
            action: 'login_success',
            route_path: '/lab/web/A01/broken-access-control',
            ip_address: '10.24.10.21',
            device_label: 'Chrome · Windows',
            location_label: 'Jaringan Kampus ITERA',
            anomaly_flag: true,
            detail: 'Login lokasi baru dan membuka skenario IDOR',
            created_at: '2026-11-15T10:00:00Z',
          },
        ],
      },
    }),
  )
  await page.route('**/api/admin/anomalies/*/ack', (route) => {
    acked = true
    return route.fulfill({ json: { acknowledged: true, id: 'anom-1' } })
  })
  await page.route('**/api/admin/sessions/*/revoke', (route) => {
    activeSessions = []
    return route.fulfill({ json: { revoked: true, session_id: 'sess-stu-1' } })
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/lab/admin/audit')

  await expect(page.getByText('Login lokasi berbeda terdeteksi untuk akun mahasiswa')).toBeVisible()
  await expect(page.getByText('/lab/web/A01/broken-access-control').first()).toBeVisible()

  await page.getByRole('button', { name: 'Tandai Ditinjau' }).click()
  await expect(page.getByText('Ditinjau', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Cabut Sesi' }).click()
  await expect(page.getByText('Belum ada sesi pengguna aktif saat ini.')).toBeVisible()
})
