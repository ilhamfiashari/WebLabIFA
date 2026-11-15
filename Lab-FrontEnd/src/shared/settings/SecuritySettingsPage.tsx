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
import { Pagination } from '../../portal/Pagination'
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
  const [backupMsg, setBackupMsg] = useState('')
  const [passkeyPage, setPasskeyPage] = useState(1)
  const [sessionPage, setSessionPage] = useState(1)
  const [notifPage, setNotifPage] = useState(1)

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

  const accountBackupMut = useMutation({
    mutationFn: () => simApi.exportAccountBackup(),
    onSuccess: (payload) => {
      const jsonText = JSON.stringify(payload, null, 2)
      const url = URL.createObjectURL(new Blob([jsonText], { type: 'application/json;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `weblabifa-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setBackupMsg(
        lang === 'en'
          ? 'Account & progress backup downloaded (.json).'
          : 'Cadangan data akun & progres belajar berhasil diunduh (.json).',
      )
      refresh()
    },
    onError: () => {
      setBackupMsg(lang === 'en' ? 'Unable to download account backup.' : 'Gagal mengunduh cadangan akun.')
    },
  })

  if (!data) {
    return <LoadState error={secQ.isError} onRetry={() => void secQ.refetch()} />
  }

  const effSecondary = secondaryEmail ?? data.secondary_email ?? ''
  const effAssign = notifyAssign ?? data.notify_assignments
  const effFeed = notifyFeed ?? data.notify_feedback
  const effSec = notifySec ?? data.notify_security_alerts

  const dateLocale = lang === 'en' ? 'en-US' : 'id-ID'
  const pagedPasskeys = data.passkeys.slice((passkeyPage - 1) * 10, passkeyPage * 10)
  const pagedSessions = data.sessions.slice((sessionPage - 1) * 10, sessionPage * 10)
  const pagedNotifications = data.notifications.slice((notifPage - 1) * 10, notifPage * 10)

  const downloadBackupCodes = (codes: string[]) => {
    const header =
      lang === 'en'
        ? `WebLabIFA MFA Backup Codes (${data.primary_email})\nKeep in a safe place. Each code works once.`
        : `Kode Cadangan MFA WebLabIFA (${data.primary_email})\nSimpan di tempat aman. Setiap kode hanya bisa dipakai satu kali.`
    const content = `${header}\n\n${codes.join('\n')}\n`
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
          label={lang === 'en' ? 'MFA Status' : 'Perlindungan MFA'}
          value={data.mfa_enabled ? (lang === 'en' ? 'Enabled' : 'Aktif') : lang === 'en' ? 'Off' : 'Belum Aktif'}
          note={
            data.totp_verified
              ? lang === 'en'
                ? 'Authenticator App is active'
                : 'Aplikasi Authenticator aktif'
              : lang === 'en'
                ? 'Turn on Authenticator or Passkey'
                : 'Aktifkan Authenticator atau Passkey'
          }
          icon={ShieldCheck}
        />
        <Kpi
          label="Passkeys"
          value={data.passkeys.length}
          note={lang === 'en' ? 'Saved biometric or security keys' : 'Kunci perangkat (sidik jari / kunci fisik)'}
          icon={Fingerprint}
        />
        <Kpi
          label={lang === 'en' ? 'Backup Codes' : 'Kode Cadangan'}
          value={`${data.backup_codes_remaining} / 8`}
          note={
            lang === 'en'
              ? `Protected with ${data.backup_hash_algorithm ?? 'Argon2id'}`
              : `Dilindungi dengan ${data.backup_hash_algorithm ?? 'Argon2id'}`
          }
          icon={KeyRound}
        />
        <Kpi
          label={lang === 'en' ? 'Active Logins' : 'Perangkat Masuk'}
          value={data.sessions.length}
          note={lang === 'en' ? 'Signed-in browsers & locations' : 'Perangkat & lokasi yang sedang login'}
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
                <input className="input" readOnly value={data.primary_email} style={{ flex: '1 1 200px', minWidth: 0 }} />
                <Badge tone="good">{lang === 'en' ? 'Verified' : 'Terverifikasi'}</Badge>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="secondary-email-input">
                {lang === 'en' ? 'Secondary / Notification Email' : 'Email Tambahan / Tujuan Notifikasi'}
              </label>
              <input
                id="secondary-email-input"
                className="input"
                type="email"
                placeholder="cadangan@student.itera.ac.id"
                value={effSecondary}
                onChange={(e) => setSecondaryEmail(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={effAssign} onChange={(e) => setNotifyAssign(e.target.checked)} />
                {lang === 'en' ? 'Email notifications when lecturer publishes new assignments' : 'Kirim email saat dosen membagikan tugas baru'}
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={effFeed} onChange={(e) => setNotifyFeed(e.target.checked)} />
                {lang === 'en' ? 'Email notifications for lecturer session feedback & grades' : 'Kirim email saat ada catatan atau nilai dari dosen'}
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={effSec} onChange={(e) => setNotifySec(e.target.checked)} />
                {lang === 'en' ? 'Security alerts on new device, location, or login anomaly' : 'Kirim peringatan keamanan jika ada login mencurigakan'}
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
                {prefsMut.isPending
                  ? lang === 'en' ? 'Saving…' : 'Menyimpan…'
                  : lang === 'en' ? 'Save Email Settings' : 'Simpan Pengaturan Email'}
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
                      <Copy size={14} />
                      {copiedKey === 'totp-secret'
                        ? lang === 'en' ? 'Copied!' : 'Tersalin!'
                        : lang === 'en' ? 'Copy Secret' : 'Salin Secret'}
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
                    <small style={{ color: 'var(--ink-2)' }}>
                      {lang === 'en'
                        ? 'Open Google Authenticator, Microsoft Authenticator, or Bitwarden and scan the QR code, or enter this Base32 key manually:'
                        : 'Buka Google Authenticator, Microsoft Authenticator, atau Bitwarden lalu pindai QR code di samping, atau ketik kunci Base32 ini secara manual:'}
                    </small>
                    <code style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>{totpEnroll.secret}</code>
                    <small style={{ wordBreak: 'break-all', color: 'var(--ink-3)', fontSize: '0.75rem' }}>
                      {totpEnroll.otpauth_uri}
                    </small>
                  </div>
                </div>
                <div className="input-row">
                  <input
                    className="input"
                    placeholder={lang === 'en' ? 'Enter 6-digit code' : 'Masukkan kode 6 digit'}
                    aria-label={lang === 'en' ? 'TOTP verification code' : 'Kode verifikasi TOTP'}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
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
                    {lang === 'en' ? 'Disable TOTP' : 'Matikan Authenticator'}
                  </button>
                ) : null}
              </div>
            )}

            {data.mfa_enabled ? (
              <div className="input-row" style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                <input
                  className="input"
                  placeholder={lang === 'en' ? 'TOTP or Backup Code' : 'Kode TOTP atau Kode Cadangan'}
                  aria-label={lang === 'en' ? 'MFA verification code' : 'Kode verifikasi sesi MFA'}
                  value={mfaVerifyCode}
                  onChange={(e) => setMfaVerifyCode(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-outline"
                  disabled={verifyMfaMut.isPending || !mfaVerifyCode.trim()}
                  onClick={() => verifyMfaMut.mutate()}
                >
                  {lang === 'en' ? 'Verify MFA Session' : 'Verifikasi Sesi MFA'}
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
            <div className="input-row">
              <input
                className="input"
                aria-label={lang === 'en' ? 'Passkey device name' : 'Nama perangkat Passkey'}
                placeholder={lang === 'en' ? 'e.g. MacBook Touch ID' : 'Contoh: MacBook Touch ID'}
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary"
                disabled={addPasskeyMut.isPending}
                onClick={() => addPasskeyMut.mutate()}
              >
                <Fingerprint size={15} />
                {addPasskeyMut.isPending
                  ? lang === 'en' ? 'Registering…' : 'Mendaftarkan…'
                  : lang === 'en' ? 'Add Passkey' : 'Tambah Passkey'}
              </button>
            </div>
            {passkeyMsg ? <small className="subtle-note">{passkeyMsg}</small> : null}
            {data.passkeys.length ? (
              <div className="table-wrap compact">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{lang === 'en' ? 'Device' : 'Perangkat'}</th>
                      <th>{lang === 'en' ? 'Method' : 'Jalur'}</th>
                      <th>{lang === 'en' ? 'Added' : 'Ditambahkan'}</th>
                      <th>{lang === 'en' ? 'Action' : 'Aksi'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPasskeys.map((pk) => (
                      <tr key={pk.id}>
                        <td className="strong">{pk.device_name}</td>
                        <td><Badge tone="muted">{pk.transports}</Badge></td>
                        <td>{new Date(pk.created_at).toLocaleDateString(dateLocale)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-outline"
                            onClick={() => deletePasskeyMut.mutate(pk.id)}
                          >
                            <Trash2 size={14} /> {lang === 'en' ? 'Remove' : 'Hapus'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination totalItems={data.passkeys.length} page={passkeyPage} pageSize={10} onPageChange={setPasskeyPage} />
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
                {lang === 'en' ? 'Backup Codes & Account Backup' : 'Kode Cadangan & Fitur Backup'}
              </h2>
              <p>
                {lang === 'en'
                  ? `Single-use recovery codes hashed with ${data.backup_hash_algorithm ?? 'Argon2id'} on the server, plus account backup export.`
                  : `Kode pemulihan sekali pakai dilindungi hash ${data.backup_hash_algorithm ?? 'Argon2id'}, dilengkapi unduhan cadangan data akun.`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Badge tone="info">{data.backup_hash_algorithm ?? 'Argon2id'}</Badge>
              <Badge tone={data.backup_codes_remaining > 2 ? 'good' : 'warn'}>
                {lang === 'en' ? `${data.backup_codes_remaining} left` : `${data.backup_codes_remaining} tersisa`}
              </Badge>
            </div>
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
                  ? lang === 'en' ? 'Generating…' : 'Membuat Kode…'
                  : lang === 'en' ? 'Generate 8 Backup Codes' : 'Buat Ulang 8 Backup Codes'}
              </button>
              <button
                type="button"
                className="btn-outline"
                disabled={accountBackupMut.isPending}
                onClick={() => accountBackupMut.mutate()}
              >
                <Download size={15} />
                {accountBackupMut.isPending
                  ? lang === 'en' ? 'Preparing Backup…' : 'Menyiapkan Cadangan…'
                  : lang === 'en' ? 'Download Account Backup (.json)' : 'Unduh Cadangan Akun (.json)'}
              </button>
              {generatedCodes ? (
                <>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => copyText(generatedCodes.join('\n'), 'backup-codes')}
                  >
                    <Copy size={14} />{' '}
                    {copiedKey === 'backup-codes'
                      ? lang === 'en' ? 'Copied!' : 'Tersalin!'
                      : lang === 'en' ? 'Copy All' : 'Salin Semua'}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => downloadBackupCodes(generatedCodes)}
                  >
                    <Download size={14} /> {lang === 'en' ? 'Save .txt' : 'Unduh .txt'}
                  </button>
                </>
              ) : null}
            </div>
            {backupMsg ? <small className="subtle-note">{backupMsg}</small> : null}
            {generatedCodes ? (
              <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--warn-line, var(--line))', display: 'grid', gap: 8 }}>
                <strong style={{ fontSize: '0.88rem' }}>
                  {lang === 'en'
                    ? 'Save these codes now — they cannot be displayed again after closing this page:'
                    : 'Simpan kode ini sekarang — kode tidak dapat ditampilkan lagi setelah halaman ditutup:'}
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
              {lang === 'en' ? 'Active Sessions & Device Locations' : 'Perangkat Aktif & Lokasi Login'}
            </h2>
          </div>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{lang === 'en' ? 'Device' : 'Perangkat'}</th>
                <th>{lang === 'en' ? 'Location & IP' : 'Lokasi & IP'}</th>
                <th>{lang === 'en' ? 'Current Page' : 'Posisi Halaman'}</th>
                <th>{lang === 'en' ? 'Role' : 'Peran'}</th>
                <th>MFA</th>
                <th>{lang === 'en' ? 'Last Activity' : 'Aktivitas Terakhir'}</th>
                <th>{lang === 'en' ? 'Action' : 'Aksi'}</th>
              </tr>
            </thead>
            <tbody>
              {pagedSessions.map((s) => (
                <tr key={s.session_id}>
                  <td>
                    <p className="strong">{s.device_label ?? (lang === 'en' ? 'Web Browser' : 'Browser Web')}</p>
                    {s.is_current ? <Badge tone="good">{lang === 'en' ? 'This Device' : 'Perangkat Ini'}</Badge> : null}
                  </td>
                  <td>
                    <p>{s.location_label ?? '-'}</p>
                    <small className="mono">{s.ip_address ?? '-'}</small>
                  </td>
                  <td><code>{s.current_path ?? '/lab'}</code></td>
                  <td><Badge tone="muted">{s.active_role}</Badge></td>
                  <td>
                    <Badge tone={s.mfa_verified ? 'good' : 'muted'}>
                      {s.mfa_verified ? (lang === 'en' ? 'Verified' : 'Terverifikasi') : 'OIDC'}
                    </Badge>
                  </td>
                  <td>{new Date(s.last_seen_at).toLocaleString(dateLocale)}</td>
                  <td>
                    {!s.is_current ? (
                      <button
                        type="button"
                        className="btn-outline"
                        disabled={revokeSessionMut.isPending}
                        onClick={() => revokeSessionMut.mutate(s.session_id)}
                      >
                        {lang === 'en' ? 'Revoke Session' : 'Cabut Sesi'}
                      </button>
                    ) : (
                      <small className="subtle-note">{lang === 'en' ? 'Active now' : 'Sedang digunakan'}</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={data.sessions.length} page={sessionPage} pageSize={10} onPageChange={setSessionPage} />
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
                <th>{lang === 'en' ? 'Time' : 'Waktu'}</th>
                <th>{lang === 'en' ? 'Recipient' : 'Email Tujuan'}</th>
                <th>{lang === 'en' ? 'Category' : 'Jenis'}</th>
                <th>{lang === 'en' ? 'Subject & Summary' : 'Judul & Ringkasan'}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedNotifications.map((n) => (
                <tr key={n.id}>
                  <td className="nowrap">{new Date(n.created_at).toLocaleString(dateLocale)}</td>
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
                  <td colSpan={5} className="empty">
                    {lang === 'en' ? 'No email notifications sent yet.' : 'Belum ada email notifikasi yang terkirim.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={data.notifications.length} page={notifPage} pageSize={10} onPageChange={setNotifPage} />
      </section>
    </div>
  )
}
