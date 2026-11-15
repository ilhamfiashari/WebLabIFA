import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, AlertTriangle, CheckCircle2, Download, Eye, Laptop, MailCheck, ShieldAlert, Trash2 } from 'lucide-react'
import { Pagination } from '../portal/Pagination'
import { Badge, Kpi, LoadState } from '../portal/ui'
import { simApi } from '../simulator/api'
import { useI18n } from '../shared/i18n'

export function AdminSecurityMonitorPanel({ csrf }: { csrf: string }) {
  const { lang } = useI18n()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [onlyAnomaly, setOnlyAnomaly] = useState(false)
  const [anomalyPage, setAnomalyPage] = useState(1)
  const [sessionPage, setSessionPage] = useState(1)
  const [logPage, setLogPage] = useState(1)
  const [backupNotice, setBackupNotice] = useState('')

  const monQ = useQuery({
    queryKey: ['admin-security-monitor'],
    queryFn: () => simApi.getAdminSecurityMonitor(),
    retry: false,
    refetchInterval: 20000,
  })

  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin-security-monitor'] })

  const revokeMut = useMutation({
    mutationFn: (sessionId: string) => simApi.adminRevokeSession(csrf, sessionId),
    onSuccess: refresh,
  })

  const ackMut = useMutation({
    mutationFn: (anomalyId: string) => simApi.adminAckAnomaly(csrf, anomalyId),
    onSuccess: refresh,
  })

  const adminBackupMut = useMutation({
    mutationFn: () => simApi.exportAdminBackup(),
    onSuccess: (payload) => {
      const jsonText = JSON.stringify(payload, null, 2)
      const url = URL.createObjectURL(new Blob([jsonText], { type: 'application/json;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `weblabifa-system-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setBackupNotice(
        lang === 'en'
          ? 'System backup downloaded (.json).'
          : 'Cadangan sistem portal berhasil diunduh (.json).',
      )
      refresh()
    },
    onError: () => {
      setBackupNotice(lang === 'en' ? 'Unable to download system backup.' : 'Gagal mengunduh cadangan sistem.')
    },
  })

  if (!monQ.data) {
    return <LoadState error={monQ.isError} onRetry={() => void monQ.refetch()} />
  }

  const data = monQ.data
  const dateLocale = lang === 'en' ? 'en-US' : 'id-ID'
  const q = search.trim().toLowerCase()
  const logs = data.activity_logs.filter((l) => {
    if (onlyAnomaly && !l.anomaly_flag) return false
    if (!q) return true
    return `${l.user_name ?? ''} ${l.actor_email ?? ''} ${l.action} ${l.detail} ${l.route_path ?? ''}`
      .toLowerCase()
      .includes(q)
  })
  const pagedAnomalies = data.anomalies.slice((anomalyPage - 1) * 10, anomalyPage * 10)
  const pagedSessions = data.active_sessions.slice((sessionPage - 1) * 10, sessionPage * 10)
  const pagedLogs = logs.slice((logPage - 1) * 10, logPage * 10)

  return (
    <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div className="kpi-grid" style={{ minWidth: 0 }}>
        <Kpi
          label={lang === 'en' ? 'Active Live Sessions' : 'Pengguna Aktif Sekarang'}
          value={data.summary.active_sessions}
          note={lang === 'en' ? 'Tracked sessions with route & IP' : 'Terpantau posisi halaman, perangkat & IP'}
          icon={Laptop}
        />
        <Kpi
          label={lang === 'en' ? 'Unreviewed Anomalies' : 'Peringatan Belum Ditinjau'}
          value={data.summary.unacknowledged_anomalies}
          note={lang === 'en' ? 'New device / location / rejected logins' : 'Perangkat/lokasi baru atau akses ditolak'}
          icon={ShieldAlert}
        />
        <Kpi
          label={lang === 'en' ? 'MFA Enrolled Accounts' : 'Akun Pakai MFA'}
          value={data.summary.mfa_enabled_users}
          note={lang === 'en' ? 'TOTP / Passkey / Argon2id Backup' : 'TOTP / Passkey / Kode Cadangan Argon2id'}
          icon={CheckCircle2}
        />
        <Kpi
          label={lang === 'en' ? 'Email Notifications Sent' : 'Email Terkirim'}
          value={data.summary.emails_sent_total}
          note={lang === 'en' ? 'Assignments, feedback & security alerts' : 'Info tugas, nilai dosen & peringatan login'}
          icon={MailCheck}
        />
      </div>

      <section className="card table-card" aria-labelledby="mon-anomalies" style={{ minWidth: 0 }}>
        <header className="table-head">
          <div>
            <h2 id="mon-anomalies">
              <AlertTriangle size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              {lang === 'en' ? 'Login, Location & Device Anomaly Alerts' : 'Peringatan Login Mencurigakan & Perangkat Baru'}
            </h2>
          </div>
          <div className="filters">
            <button
              type="button"
              className="btn-outline"
              disabled={adminBackupMut.isPending}
              onClick={() => adminBackupMut.mutate()}
            >
              <Download size={15} aria-hidden="true" />
              {adminBackupMut.isPending
                ? lang === 'en' ? 'Preparing Backup…' : 'Menyiapkan Cadangan…'
                : lang === 'en' ? 'Download System Backup (.json)' : 'Unduh Cadangan Sistem (.json)'}
            </button>
          </div>
        </header>
        {backupNotice ? <p className="subtle-note" style={{ padding: '0 20px 12px', marginTop: 0 }}>{backupNotice}</p> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{lang === 'en' ? 'Time' : 'Waktu'}</th>
                <th>{lang === 'en' ? 'Severity' : 'Tingkat'}</th>
                <th>{lang === 'en' ? 'Category' : 'Jenis'}</th>
                <th>{lang === 'en' ? 'Summary & Account' : 'Keterangan & Akun'}</th>
                <th>{lang === 'en' ? 'Device / Location' : 'Perangkat / Lokasi'}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedAnomalies.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{new Date(a.created_at).toLocaleString(dateLocale)}</td>
                  <td>
                    <Badge tone={a.severity === 'high' ? 'bad' : a.severity === 'medium' ? 'warn' : 'muted'}>
                      {a.severity.toUpperCase()}
                    </Badge>
                  </td>
                  <td><code>{a.kind}</code></td>
                  <td>
                    <p className="strong">{a.summary}</p>
                    <small>
                      {a.user_name ?? (lang === 'en' ? 'External Account' : 'Akun Luar')} ({a.actor_email ?? (lang === 'en' ? 'unauthorized' : 'tidak diizinkan')})
                    </small>
                  </td>
                  <td>
                    <p>{a.device_label ?? '-'}</p>
                    <small>{a.location_label ?? '-'} · <code>{a.ip_address ?? '-'}</code></small>
                  </td>
                  <td>
                    {a.acknowledged ? (
                      <Badge tone="good">{lang === 'en' ? 'Reviewed' : 'Sudah Ditinjau'}</Badge>
                    ) : (
                      <button
                        type="button"
                        className="btn-outline"
                        disabled={ackMut.isPending}
                        onClick={() => ackMut.mutate(a.id)}
                      >
                        <CheckCircle2 size={14} /> {lang === 'en' ? 'Mark Reviewed' : 'Tandai Ditinjau'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!data.anomalies.length ? (
                <tr>
                  <td colSpan={6} className="empty">
                    {lang === 'en'
                      ? 'No unusual logins or new devices detected yet.'
                      : 'Belum ada peringatan login mencurigakan atau perangkat baru.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={data.anomalies.length} page={anomalyPage} pageSize={10} onPageChange={setAnomalyPage} />
      </section>

      <section className="card table-card" aria-labelledby="mon-sessions" style={{ minWidth: 0 }}>
        <header className="table-head">
          <div>
            <h2 id="mon-sessions">
              <Eye size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              {lang === 'en' ? 'Active User Sessions & Live Route Position' : 'Pengguna Aktif & Posisi Halaman Sekarang'}
            </h2>
          </div>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{lang === 'en' ? 'User' : 'Pengguna'}</th>
                <th>{lang === 'en' ? 'Active Role' : 'Peran Aktif'}</th>
                <th>{lang === 'en' ? 'Current Page' : 'Posisi Halaman'}</th>
                <th>{lang === 'en' ? 'Device & Location' : 'Perangkat & Lokasi'}</th>
                <th>{lang === 'en' ? 'Last Seen' : 'Terakhir Aktif'}</th>
                <th>{lang === 'en' ? 'Control' : 'Kontrol'}</th>
              </tr>
            </thead>
            <tbody>
              {pagedSessions.map((s) => (
                <tr key={s.session_id}>
                  <td>
                    <p className="strong">{s.user_name ?? (lang === 'en' ? 'User' : 'Pengguna')}</p>
                    <small>{s.email}</small>
                  </td>
                  <td><Badge tone="muted">{s.active_role}</Badge></td>
                  <td><code>{s.current_path ?? '/lab'}</code></td>
                  <td>
                    <p>{s.device_label ?? (lang === 'en' ? 'Web Browser' : 'Browser Web')}</p>
                    <small>{s.location_label ?? '-'} · <code>{s.ip_address ?? '-'}</code></small>
                  </td>
                  <td>{new Date(s.last_seen_at).toLocaleString(dateLocale)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={revokeMut.isPending}
                      onClick={() => revokeMut.mutate(s.session_id)}
                    >
                      <Trash2 size={14} /> {lang === 'en' ? 'Revoke Session' : 'Cabut Sesi'}
                    </button>
                  </td>
                </tr>
              ))}
              {!data.active_sessions.length ? (
                <tr>
                  <td colSpan={6} className="empty">
                    {lang === 'en' ? 'No active user sessions at the moment.' : 'Belum ada pengguna yang sedang aktif.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={data.active_sessions.length} page={sessionPage} pageSize={10} onPageChange={setSessionPage} />
      </section>

      <section className="card table-card" aria-labelledby="mon-activity" style={{ minWidth: 0 }}>
        <header className="table-head">
          <div>
            <h2 id="mon-activity">
              <Activity size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              {lang === 'en' ? 'Per-User Activity Log' : 'Catatan Aktivitas Pengguna'}
            </h2>
          </div>
          <div className="filters" style={{ minWidth: 0, maxWidth: '100%' }}>
            <input
              className="input"
              type="search"
              placeholder={lang === 'en' ? 'Search email, name, route, action…' : 'Cari nama, email, halaman, atau kegiatan…'}
              aria-label={lang === 'en' ? 'Filter activity log' : 'Filter catatan aktivitas'}
              style={{ flex: '1 1 220px', maxWidth: 300 }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setLogPage(1)
              }}
            />
            <button
              type="button"
              className="chip"
              aria-pressed={onlyAnomaly}
              onClick={() => {
                setOnlyAnomaly((v) => !v)
                setLogPage(1)
              }}
            >
              {onlyAnomaly
                ? lang === 'en' ? 'Anomalies Only' : 'Hanya Aktivitas Mencurigakan'
                : lang === 'en' ? 'All Activities' : 'Semua Aktivitas'}
            </button>
          </div>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{lang === 'en' ? 'Time' : 'Waktu'}</th>
                <th>{lang === 'en' ? 'User' : 'Pengguna'}</th>
                <th>{lang === 'en' ? 'Action & Page' : 'Kegiatan & Halaman'}</th>
                <th>{lang === 'en' ? 'Details' : 'Keterangan'}</th>
                <th>{lang === 'en' ? 'Location / Device' : 'Lokasi / Perangkat'}</th>
              </tr>
            </thead>
            <tbody>
              {pagedLogs.map((l) => (
                <tr key={l.id}>
                  <td className="nowrap">{new Date(l.created_at).toLocaleString(dateLocale)}</td>
                  <td>
                    <p className="strong">{l.user_name ?? (lang === 'en' ? 'Anonymous' : 'Tanpa Akun')}</p>
                    <small>{l.actor_email ?? '-'}</small>
                  </td>
                  <td>
                    <Badge tone={l.anomaly_flag ? 'warn' : 'muted'}>{l.action}</Badge>
                    {l.route_path ? <div><small><code>{l.route_path}</code></small></div> : null}
                  </td>
                  <td>{l.detail}</td>
                  <td>
                    <p>{l.device_label ?? '-'}</p>
                    <small>{l.location_label ?? '-'} · <code>{l.ip_address ?? '-'}</code></small>
                  </td>
                </tr>
              ))}
              {!logs.length ? (
                <tr>
                  <td colSpan={5} className="empty">
                    {lang === 'en'
                      ? 'No activity entries match your filter.'
                      : 'Tidak ada catatan aktivitas yang cocok dengan pencarian.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={logs.length} page={logPage} pageSize={10} onPageChange={setLogPage} />
      </section>
    </div>
  )
}
