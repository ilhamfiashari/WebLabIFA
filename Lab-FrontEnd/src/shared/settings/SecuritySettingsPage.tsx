import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import {
  Check,
  Copy,
  Download,
  Fingerprint,
  KeyRound,
  Laptop,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react'
import type { Identity } from '../../api'
import { Badge, Kpi, LoadState } from '../../portal/ui'
import { simApi } from '../../simulator/api'
import { useI18n } from '../i18n'

function hexToUint8(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

export function SecuritySettingsPage({ user }: { user: Identity }) {
  const { lang } = useI18n()
  const qc = useQueryClient()
  const secQ = useQuery({
    queryKey: ['account-security'],
    queryFn: () => simApi.getSecuritySettings(),
    retry: false,
  })

  const data = secQ.data
  const [secondaryEmail, setSecondaryEmail] = useState<string | null>(null)
  const [notifyAssign, setNotifyAssign] = useState<boolean | null>(null)
  const [notifyFeed, setNotifyFeed] = useState<boolean | null>(null)
  const [notifySec, setNotifySec] = useState<boolean | null>(null)
  const [prefsMsg, setPrefsMsg] = useState('')

  const [totpEnroll, setTotpEnroll] = useState<{ secret: string; otpauth_uri: string; qrUrl: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [mfaMsg, setMfaMsg] = useState('')
  const [mfaVerifyCode, setMfaVerifyCode] = useState('')

  const [passkeyName, setPasskeyName] = useState('Perangkat Utama')
  const [passkeyMsg, setPasskeyMsg] = useState('')

  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const refresh = () => void qc.invalidateQueries({ queryKey: ['account-security'] })

  const copyText = (text: string, id: string) => {
    void navigator.clipboard?.writeText(text)
    setCopiedKey(id)
    window.setTimeout(() => setCopiedKey(null), 1800)
  }

  const prefsMut = useMutation({
    mutationFn: () =>
      simApi.updateEmailPrefs(user.csrf_token, {
        secondary_email: (secondaryEmail ?? data?.secondary_email ?? '').trim() || null,
        notify_assignments: notifyAssign ?? data?.notify_assignments ?? true,
        notify_feedback: notifyFeed ?? data?.notify_feedback ?? true,
        notify_security_alerts: notifySec ?? data?.notify_security_alerts ?? true,
      }),
    onSuccess: () => {
      setPrefsMsg(lang === 'en' ? 'Email & notification preferences saved.' : 'Preferensi email & notifikasi berhasil disimpan.')
      refresh()
    },
    onError: () => {
      setPrefsMsg(lang === 'en' ? 'Check secondary email format.' : 'Periksa format email cadangan.')
    },
  })

  const enrollTotpMut = useMutation({
    mutationFn: async () => {
      const res = await simApi.enrollTotp(user.csrf_token)
      const qrUrl = await QRCode.toDataURL(res.otpauth_uri, {
        width: 192,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f2318', light: '#ffffff' },
      }).catch(() => '')
      return { ...res, qrUrl }
    },
    onSuccess: (res) => {
      setTotpEnroll(res)
      setMfaMsg('')
    },
  })

  const verifyTotpMut = useMutation({
    mutationFn: () => simApi.verifyTotpEnable(user.csrf_token, totpCode),
    onSuccess: () => {
      setTotpEnroll(null)
      setTotpCode('')
      setMfaMsg(lang === 'en' ? 'Authenticator App enabled.' : 'Authenticator App berhasil diaktifkan.')
      refresh()
    },
    onError: () => {
      setMfaMsg(lang === 'en' ? 'Invalid 6-digit TOTP code.' : 'Kode 6 digit TOTP tidak cocok.')
    },
  })

  const disableTotpMut = useMutation({
    mutationFn: () => simApi.disableTotp(user.csrf_token),
    onSuccess: () => {
      setMfaMsg(lang === 'en' ? 'Authenticator App disabled.' : 'Authenticator App dinonaktifkan.')
      refresh()
    },
  })

  const verifyMfaMut = useMutation({
    mutationFn: () => simApi.verifyMfaCode(user.csrf_token, mfaVerifyCode),
    onSuccess: (res) => {
      setMfaVerifyCode('')
      setMfaMsg(
        lang === 'en'
          ? `Session verified via ${res.method}.`
          : `Sesi berhasil diverifikasi menggunakan ${res.method === 'totp' ? 'Authenticator App' : 'Backup Code'}.`,
      )
      refresh()
    },
    onError: () => {
      setMfaMsg(lang === 'en' ? 'Invalid TOTP or backup code.' : 'Kode TOTP atau backup code tidak valid.')
    },
  })

  const regenCodesMut = useMutation({
    mutationFn: () => simApi.regenerateBackupCodes(user.csrf_token),
    onSuccess: (res) => {
      setGeneratedCodes(res.codes)
      refresh()
    },
  })

  const addPasskeyMut = useMutation({
    mutationFn: async () => {
      const challenge = await simApi.challengePasskey(user.csrf_token)
      let credId = ''
      let transports = 'internal'
      if (typeof window !== 'undefined' && window.PublicKeyCredential && navigator.credentials?.create) {
        try {
          const cred = (await navigator.credentials.create({
            publicKey: {
              challenge: hexToUint8(challenge.challenge).buffer as ArrayBuffer,
              rp: { name: challenge.rp_name },
              user: {
                id: new TextEncoder().encode(challenge.user_id),
                name: challenge.user_name,
                displayName: challenge.user_display_name,
              },
              pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
              timeout: 20000,
              authenticatorSelection: { userVerification: 'preferred' },
            },
          })) as PublicKeyCredential | null
          if (cred?.id) credId = cred.id
        } catch {
          credId = `passkey-${crypto.randomUUID()}`
          transports = 'hybrid'
        }
      } else {
        credId = `passkey-${crypto.randomUUID()}`
        transports = 'hybrid'
      }
      return simApi.registerPasskey(user.csrf_token, {
        credential_id: credId,
        device_name: passkeyName.trim() || 'Perangkat WebAuthn',
        transports,
      })
    },
    onSuccess: (res) => {
      setPasskeyMsg(
        lang === 'en' ? `Passkey "${res.device_name}" registered.` : `Passkey "${res.device_name}" berhasil didaftarkan.`,
      )
      refresh()
    },
    onError: () => {
      setPasskeyMsg(lang === 'en' ? 'Unable to register passkey.' : 'Gagal mendaftarkan passkey.')
    },
  })

  const deletePasskeyMut = useMutation({
    mutationFn: (id: string) => simApi.deletePasskey(user.csrf_token, id),
    onSuccess: refresh,
  })

  const revokeSessionMut = useMutation({
    mutationFn: (sessionId: string) => simApi.revokeMySession(user.csrf_token, sessionId),
    onSuccess: refresh,
  })

  if (!data) {
    return <LoadState error={secQ.isError} onRetry={() => void secQ.refetch()} />
  }

  const effSecondary = secondaryEmail ?? data.secondary_email ?? ''
  const effAssign = notifyAssign ?? data.notify_assignments
  const effFeed = notifyFeed ?? data.notify_feedback
  const effSec = notifySec ?? data.notify_security_alerts

  const downloadBackupCodes = (codes: string[]) => {
    const content = `WebLabIFA MFA Backup Codes (${data.primary_email})\nSimpan di tempat aman. Setiap kode hanya dapat dipakai satu kali.\n\n${codes.join('\n')}\n`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'weblabifa-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div className="kpi-grid" style={{ minWidth: 0 }}>
        <Kpi
          label={lang === 'en' ? 'MFA Protection' : 'Status MFA'}
          value={data.mfa_enabled ? (lang === 'en' ? 'Enabled' : 'Aktif') : lang === 'en' ? 'Not Set' : 'Belum Aktif'}
          note={data.totp_verified ? 'Authenticator App TOTP aktif' : 'Aktifkan TOTP atau Passkey'}
          icon={ShieldCheck}
        />
        <Kpi
          label="Passkeys"
          value={data.passkeys.length}
          note={lang === 'en' ? 'Registered security keys' : 'Perangkat FIDO2 / WebAuthn'}
          icon={Fingerprint}
        />
        <Kpi
          label="Backup Codes"
          value={`${data.backup_codes_remaining} / 8`}
          note={lang === 'en' ? 'Single-use recovery codes' : 'Kode cadangan tersisa'}
          icon={KeyRound}
        />
        <Kpi
          label={lang === 'en' ? 'Active Sessions' : 'Sesi Aktif'}
          value={data.sessions.length}
          note={lang === 'en' ? 'Tracked device & IP' : 'Terpantau perangkat & IP'}
          icon={Laptop}
        />
      </div>

      <div className="grid-2" style={{ minWidth: 0 }}>
        <section className="card" aria-labelledby="sec-emails" style={{ minWidth: 0 }}>
          <header className="card-head">
            <div>
              <h2 id="sec-emails">
                <Mail size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                {lang === 'en' ? 'Emails & Notification Delivery' : 'Email & Notifikasi Otomatis'}
              </h2>
              <p>
                {lang === 'en'
                  ? 'Manage primary & secondary email addresses and alerts for tasks, feedback, and logins.'
                  : 'Atur alamat email cadangan dan langganan notifikasi tugas, umpan balik, serta anomali login.'}
              </p>
            </div>
          </header>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label className="field-label">{lang === 'en' ? 'Primary Google Email' : 'Email Utama (OIDC)'}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap', minWidth: 0 }}>
                <input className="input" readOnly value={data.primary_email} style={{ flex: '1 1 180px', minWidth: 0, width: '100%', boxSizing: 'border-box' }} />
                <Badge tone="good">{lang === 'en' ? 'Verified' : 'Terverifikasi'}</Badge>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="secondary-email-input">
                {lang === 'en' ? 'Secondary / Notification Email' : 'Email Cadangan / Tujuan Notifikasi'}
              </label>
              <input
                id="secondary-email-input"
                className="input"
                type="email"
                placeholder="cadangan@student.itera.ac.id"
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                value={effSecondary}
                onChange={(e) => setSecondaryEmail(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={effAssign} onChange={(e) => setNotifyAssign(e.target.checked)} />
                {lang === 'en' ? 'Email notifications when lecturer publishes new assignments' : 'Notifikasi email saat dosen menerbitkan tugas baru'}
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={effFeed} onChange={(e) => setNotifyFeed(e.target.checked)} />
                {lang === 'en' ? 'Email notifications for lecturer session feedback & grades' : 'Notifikasi email saat ada umpan balik & nilai dosen'}
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={effSec} onChange={(e) => setNotifySec(e.target.checked)} />
                {lang === 'en' ? 'Security alerts on new device, location, or login anomaly' : 'Peringatan keamanan saat login perangkat/lokasi baru atau anomali'}
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                disabled={prefsMut.isPending}
                onClick={() => prefsMut.mutate()}
              >
                <Check size={15} />
                {prefsMut.isPending ? 'Menyimpan…' : lang === 'en' ? 'Save Email Settings' : 'Simpan Pengaturan Email'}
              </button>
              {prefsMsg ? <small className="subtle-note">{prefsMsg}</small> : null}
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="sec-totp" style={{ minWidth: 0 }}>
          <header className="card-head">
            <div>
              <h2 id="sec-totp">
                <Smartphone size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                Authenticator App (TOTP)
              </h2>
              <p>
                {lang === 'en'
                  ? 'Use Google Authenticator, Microsoft Authenticator, 1Password, or Bitwarden for 6-digit codes.'
                  : 'Hubungkan Google Authenticator, Microsoft Authenticator, atau Bitwarden (RFC 6238).'}
              </p>
            </div>
            <Badge tone={data.totp_verified ? 'good' : 'warn'}>
              {data.totp_verified ? (lang === 'en' ? 'Active' : 'Terhubung') : lang === 'en' ? 'Inactive' : 'Belum Aktif'}
            </Badge>
          </header>

          <div style={{ display: 'grid', gap: 12 }}>
            {totpEnroll ? (
              <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--line)', display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>
                    {lang === 'en'
                      ? '1. Scan QR Code or Copy Secret Key'
                      : '1. Pindai QR Code atau Salin Secret Key'}
                  </strong>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => copyText(totpEnroll.secret, 'totp-secret')}
                    >
                      <Copy size={14} /> {copiedKey === 'totp-secret' ? 'Tersalin!' : 'Salin Secret'}
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => {
                        setTotpEnroll(null)
                        setTotpCode('')
                      }}
                    >
                      {lang === 'en' ? 'Cancel' : 'Batal'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  {totpEnroll.qrUrl ? (
                    <div
                      style={{
                        padding: 8,
                        background: '#ffffff',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        display: 'inline-flex',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={totpEnroll.qrUrl}
                        alt="QR Code Authenticator App"
                        width={168}
                        height={168}
                        style={{ display: 'block', borderRadius: 4 }}
                      />
                    </div>
                  ) : null}
                  <div style={{ display: 'grid', gap: 6, minWidth: 0, flex: '1 1 200px' }}>
                    <small style={{ color: 'var(--muted)' }}>
                      {lang === 'en'
                        ? 'Open Google Authenticator, Microsoft Authenticator, or Bitwarden and scan the QR code, or enter this Base32 key manually:'
                        : 'Buka Google Authenticator, Microsoft Authenticator, atau Bitwarden lalu pindai QR code di samping, atau masukkan kunci Base32 berikut secara manual:'}
                    </small>
                    <code style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>{totpEnroll.secret}</code>
                    <small style={{ wordBreak: 'break-all', color: 'var(--muted)', fontSize: '0.75rem' }}>
                      {totpEnroll.otpauth_uri}
                    </small>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    className="input"
                    placeholder={lang === 'en' ? 'Enter 6-digit TOTP code' : 'Masukkan 6 digit kode TOTP'}
                    aria-label="Kode verifikasi TOTP"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    style={{ maxWidth: 220 }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={verifyTotpMut.isPending || totpCode.trim().length < 6}
                    onClick={() => verifyTotpMut.mutate()}
                  >
                    {lang === 'en' ? 'Verify & Enable' : 'Verifikasi & Aktifkan'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={enrollTotpMut.isPending}
                  onClick={() => enrollTotpMut.mutate()}
                >
                  <Smartphone size={15} />
                  {data.totp_verified
                    ? lang === 'en' ? 'Rotate Authenticator Secret' : 'Ganti Kunci Authenticator'
                    : lang === 'en' ? 'Setup Authenticator App' : 'Siapkan Authenticator App'}
                </button>
                {data.totp_verified ? (
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={disableTotpMut.isPending}
                    onClick={() => disableTotpMut.mutate()}
                  >
                    Nonaktifkan TOTP
                  </button>
                ) : null}
              </div>
            )}

            {data.mfa_enabled ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--line)' }}>
                <input
                  className="input"
                  placeholder="Verifikasi sesi dengan TOTP atau Backup Code"
                  value={mfaVerifyCode}
                  onChange={(e) => setMfaVerifyCode(e.target.value)}
                  style={{ maxWidth: 260 }}
                />
                <button
                  type="button"
                  className="btn-outline"
                  disabled={verifyMfaMut.isPending || !mfaVerifyCode.trim()}
                  onClick={() => verifyMfaMut.mutate()}
                >
                  Uji / Verifikasi Sesi MFA
                </button>
              </div>
            ) : null}

            {mfaMsg ? <small className="subtle-note">{mfaMsg}</small> : null}
          </div>
        </section>

        <section className="card" aria-labelledby="sec-passkeys" style={{ minWidth: 0 }}>
          <header className="card-head">
            <div>
              <h2 id="sec-passkeys">
                <Fingerprint size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                Passkeys (WebAuthn / FIDO2)
              </h2>
              <p>
                {lang === 'en'
                  ? 'Register Touch ID, Face ID, Windows Hello, or hardware security keys.'
                  : 'Daftarkan autentikator biometrik perangkat atau security key fisik.'}
              </p>
            </div>
          </header>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="input"
                aria-label="Nama perangkat Passkey"
                placeholder="Mis. MacBook Touch ID"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                style={{ flex: '1 1 200px' }}
              />
              <button
                type="button"
                className="btn-primary"
                disabled={addPasskeyMut.isPending}
                onClick={() => addPasskeyMut.mutate()}
              >
                <Fingerprint size={15} />
                {addPasskeyMut.isPending ? 'Mendaftarkan…' : lang === 'en' ? 'Add Passkey' : 'Tambah Passkey'}
              </button>
            </div>
            {passkeyMsg ? <small className="subtle-note">{passkeyMsg}</small> : null}
            {data.passkeys.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Perangkat</th>
                      <th>Transport</th>
                      <th>Terdaftar</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.passkeys.map((pk) => (
                      <tr key={pk.id}>
                        <td className="strong">{pk.device_name}</td>
                        <td><Badge tone="muted">{pk.transports}</Badge></td>
                        <td>{new Date(pk.created_at).toLocaleDateString('id-ID')}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-outline"
                            onClick={() => deletePasskeyMut.mutate(pk.id)}
                          >
                            <Trash2 size={14} /> Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="subtle-note">{lang === 'en' ? 'No passkeys registered yet.' : 'Belum ada passkey terdaftar.'}</p>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="sec-backup" style={{ minWidth: 0 }}>
          <header className="card-head">
            <div>
              <h2 id="sec-backup">
                <KeyRound size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                Backup Codes
              </h2>
              <p>
                {lang === 'en'
                  ? 'Single-use recovery codes hashed with SHA-256 on the server.'
                  : 'Kode pemulihan sekali pakai yang hanya disimpan sebagai hash SHA-256 di server.'}
              </p>
            </div>
            <Badge tone={data.backup_codes_remaining > 2 ? 'good' : 'warn'}>
              {data.backup_codes_remaining} tersisa
            </Badge>
          </header>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                disabled={regenCodesMut.isPending}
                onClick={() => regenCodesMut.mutate()}
              >
                <RefreshCw size={15} />
                {regenCodesMut.isPending
                  ? 'Membuat Kode…'
                  : lang === 'en' ? 'Generate 8 Backup Codes' : 'Buat Ulang 8 Backup Codes'}
              </button>
              {generatedCodes ? (
                <>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => copyText(generatedCodes.join('\n'), 'backup-codes')}
                  >
                    <Copy size={14} /> {copiedKey === 'backup-codes' ? 'Tersalin!' : 'Salin Semua'}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => downloadBackupCodes(generatedCodes)}
                  >
                    <Download size={14} /> Unduh .txt
                  </button>
                </>
              ) : null}
            </div>
            {generatedCodes ? (
              <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--warn-line, var(--line))', display: 'grid', gap: 8 }}>
                <strong style={{ fontSize: '0.88rem' }}>
                  Salin kode ini sekarang — kode tidak dapat ditampilkan ulang setelah halaman ditutup:
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                  {generatedCodes.map((c) => (
                    <code key={c} style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-soft, rgba(0,0,0,0.04))', textAlign: 'center', fontWeight: 700 }}>
                      {c}
                    </code>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="card table-card" aria-labelledby="sec-sessions" style={{ minWidth: 0 }}>
        <header className="table-head">
          <div>
            <h2 id="sec-sessions">
              <Laptop size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              {lang === 'en' ? 'Active Sessions & Device Locations' : 'Sesi Aktif & Lokasi Perangkat Saya'}
            </h2>
          </div>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Perangkat</th>
                <th>Lokasi & IP</th>
                <th>Posisi Halaman</th>
                <th>Peran</th>
                <th>MFA</th>
                <th>Aktivitas Terakhir</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.session_id}>
                  <td>
                    <p className="strong">{s.device_label ?? 'Browser Web'}</p>
                    {s.is_current ? <Badge tone="good">Sesi Ini</Badge> : null}
                  </td>
                  <td>
                    <p>{s.location_label ?? '-'}</p>
                    <small className="mono">{s.ip_address ?? '-'}</small>
                  </td>
                  <td><code>{s.current_path ?? '/lab'}</code></td>
                  <td><Badge tone="muted">{s.active_role}</Badge></td>
                  <td><Badge tone={s.mfa_verified ? 'good' : 'muted'}>{s.mfa_verified ? 'Terverifikasi' : 'OIDC'}</Badge></td>
                  <td>{new Date(s.last_seen_at).toLocaleString('id-ID')}</td>
                  <td>
                    {!s.is_current ? (
                      <button
                        type="button"
                        className="btn-outline"
                        disabled={revokeSessionMut.isPending}
                        onClick={() => revokeSessionMut.mutate(s.session_id)}
                      >
                        Cabut Sesi
                      </button>
                    ) : (
                      <small className="subtle-note">Aktif sekarang</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card table-card" aria-labelledby="sec-notif-history" style={{ minWidth: 0 }}>
        <header className="table-head">
          <h2>
            <ShieldAlert size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
            {lang === 'en' ? 'Recent Email & Security Notifications' : 'Riwayat Notifikasi Email & Peringatan Keamanan'}
          </h2>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Tujuan Email</th>
                <th>Kategori</th>
                <th>Subjek & Ringkasan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.notifications.map((n) => (
                <tr key={n.id}>
                  <td className="nowrap">{new Date(n.created_at).toLocaleString('id-ID')}</td>
                  <td><code>{n.recipient_email}</code></td>
                  <td>
                    <Badge tone={n.category === 'security_alert' ? 'warn' : n.category === 'assignment' ? 'good' : 'muted'}>
                      {n.category}
                    </Badge>
                  </td>
                  <td>
                    <p className="strong">{n.subject}</p>
                    <small>{n.body_preview}</small>
                  </td>
                  <td><Badge tone={n.status === 'sent' ? 'good' : 'muted'}>{n.status}</Badge></td>
                </tr>
              ))}
              {!data.notifications.length ? (
                <tr>
                  <td colSpan={5} className="empty">Belum ada email notifikasi terkirim.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
