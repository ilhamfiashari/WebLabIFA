import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, AlertTriangle, CheckCircle2, Eye, Laptop, MailCheck, ShieldAlert, Trash2 } from 'lucide-react'
import { Badge, Kpi, LoadState } from '../portal/ui'
import { simApi } from '../simulator/api'
import { useI18n } from '../shared/i18n'

export function AdminSecurityMonitorPanel({ csrf }: { csrf: string }) {
  const { lang } = useI18n()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [onlyAnomaly, setOnlyAnomaly] = useState(false)

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

  if (!monQ.data) {
    return <LoadState error={monQ.isError} onRetry={() => void monQ.refetch()} />
  }

  const data = monQ.data
  const q = search.trim().toLowerCase()
  const logs = data.activity_logs.filter((l) => {
    if (onlyAnomaly && !l.anomaly_flag) return false
    if (!q) return true
    return `${l.user_name ?? ''} ${l.actor_email ?? ''} ${l.action} ${l.detail} ${l.route_path ?? ''}`
      .toLowerCase()
      .includes(q)
  })

  return (
    <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div className="kpi-grid" style={{ minWidth: 0 }}>
        <Kpi
          label={lang === 'en' ? 'Active Live Sessions' : 'Sesi Aktif Sekarang'}
          value={data.summary.active_sessions}
          note={lang === 'en' ? 'Tracked sessions with route & IP' : 'Terpantau posisi, perangkat & IP'}
          icon={Laptop}
        />
        <Kpi
          label={lang === 'en' ? 'Unreviewed Anomalies' : 'Anomali Belum Ditinjau'}
          value={data.summary.unacknowledged_anomalies}
          note={lang === 'en' ? 'New device / location / rejected logins' : 'Perangkat/lokasi baru atau akses ditolak'}
          icon={ShieldAlert}
        />
        <Kpi
          label={lang === 'en' ? 'MFA Enrolled Accounts' : 'Akun dengan MFA'}
          value={data.summary.mfa_enabled_users}
          note="TOTP / Passkey / Backup Codes"
          icon={CheckCircle2}
        />
        <Kpi
          label={lang === 'en' ? 'Email Notifications Sent' : 'Notifikasi Email Terkirim'}
          value={data.summary.emails_sent_total}
          note={lang === 'en' ? 'Assignment, feedback & security alerts' : 'Tugas, umpan balik & alert anomali'}
          icon={MailCheck}
        />
      </div>

      <section className="card table-card" aria-labelledby="mon-anomalies" style={{ minWidth: 0 }}>
        <header className="table-head">
          <div>
            <h2 id="mon-anomalies">
              <AlertTriangle size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              {lang === 'en' ? 'Login, Location & Device Anomaly Alerts' : 'Peringatan Anomali Login, Lokasi & Perangkat'}
            </h2>
          </div>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Tingkat</th>
                <th>Kategori</th>
                <th>Ringkasan & Akun</th>
                <th>Perangkat / Lokasi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.anomalies.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{new Date(a.created_at).toLocaleString('id-ID')}</td>
                  <td>
                    <Badge tone={a.severity === 'high' ? 'bad' : a.severity === 'medium' ? 'warn' : 'muted'}>
                      {a.severity.toUpperCase()}
                    </Badge>
                  </td>
                  <td><code>{a.kind}</code></td>
                  <td>
                    <p className="strong">{a.summary}</p>
                    <small>{a.user_name ?? 'Akun Eksternal'} ({a.actor_email ?? 'tidak terotorisasi'})</small>
                  </td>
                  <td>
                    <p>{a.device_label ?? '-'}</p>
                    <small>{a.location_label ?? '-'} · <code>{a.ip_address ?? '-'}</code></small>
                  </td>
                  <td>
                    {a.acknowledged ? (
                      <Badge tone="good">Ditinjau</Badge>
                    ) : (
                      <button
                        type="button"
                        className="btn-outline"
                        disabled={ackMut.isPending}
                        onClick={() => ackMut.mutate(a.id)}
                      >
                        <CheckCircle2 size={14} /> Tandai Ditinjau
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!data.anomalies.length ? (
                <tr>
                  <td colSpan={6} className="empty">Belum ada anomali login atau perangkat baru terdeteksi.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card table-card" aria-labelledby="mon-sessions" style={{ minWidth: 0 }}>
        <header className="table-head">
          <div>
            <h2 id="mon-sessions">
              <Eye size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              {lang === 'en' ? 'Active User Sessions & Live Route Position' : 'Sesi Aktif & Posisi Pengguna Real-Time'}
            </h2>
          </div>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Peran Aktif</th>
                <th>Posisi Saat Ini</th>
                <th>Perangkat & Lokasi</th>
                <th>Terakhir Aktif</th>
                <th>Kontrol</th>
              </tr>
            </thead>
            <tbody>
              {data.active_sessions.map((s) => (
                <tr key={s.session_id}>
                  <td>
                    <p className="strong">{s.user_name ?? 'Pengguna'}</p>
                    <small>{s.email}</small>
                  </td>
                  <td><Badge tone="muted">{s.active_role}</Badge></td>
                  <td><code>{s.current_path ?? '/lab'}</code></td>
                  <td>
                    <p>{s.device_label ?? 'Browser Web'}</p>
                    <small>{s.location_label ?? '-'} · <code>{s.ip_address ?? '-'}</code></small>
                  </td>
                  <td>{new Date(s.last_seen_at).toLocaleString('id-ID')}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={revokeMut.isPending}
                      onClick={() => revokeMut.mutate(s.session_id)}
                    >
                      <Trash2 size={14} /> Cabut Sesi
                    </button>
                  </td>
                </tr>
              ))}
              {!data.active_sessions.length ? (
                <tr>
                  <td colSpan={6} className="empty">Belum ada sesi pengguna aktif saat ini.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card table-card" aria-labelledby="mon-activity" style={{ minWidth: 0 }}>
        <header className="table-head">
          <div>
            <h2 id="mon-activity">
              <Activity size={17} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              {lang === 'en' ? 'Per-User Activity Log' : 'Log Aktivitas Pengguna'}
            </h2>
          </div>
          <div className="filters" style={{ minWidth: 0, maxWidth: '100%' }}>
            <input
              className="input"
              type="search"
              placeholder="Cari email, nama, rute, aksi…"
              aria-label="Filter log aktivitas"
              style={{ width: '100%', minWidth: 0, maxWidth: 260, boxSizing: 'border-box' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="chip"
              aria-pressed={onlyAnomaly}
              onClick={() => setOnlyAnomaly((v) => !v)}
            >
              {onlyAnomaly ? 'Menampilkan Anomali Saja' : 'Semua Aktivitas'}
            </button>
          </div>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Aksi & Rute</th>
                <th>Detail</th>
                <th>Lokasi / Perangkat</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="nowrap">{new Date(l.created_at).toLocaleString('id-ID')}</td>
                  <td>
                    <p className="strong">{l.user_name ?? 'Anonim'}</p>
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
                  <td colSpan={5} className="empty">Tidak ada log aktivitas yang cocok dengan filter.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
