import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight, ArrowRightLeft, BookOpenCheck, CalendarDays, Check, ClipboardList, Database, Download, Ellipsis, FlaskConical, GraduationCap,
  House, KeyRound, Layers, Monitor, Moon, Search, Settings, ShieldCheck, Sun, UserCog, Users,
} from 'lucide-react'
import type { Identity } from '../api'
import { useI18n } from '../shared/i18n'
import { SecuritySettingsPage } from '../shared/settings/SecuritySettingsPage'
import { simApi, type AdminDashboardResponse } from '../simulator/api'
import { AdminSecurityMonitorPanel } from './SecurityMonitorPanel'
import {
  AUDIT, AUDIT_DAILY, CLASSES, HEAT, HEAT_DAYS, HEAT_SLOTS, MODULES, NOTIFICATIONS, OWASP, RANGES, ROLE_TOTALS, STATUS_TOTALS, USERS,
  activitySeries, kpis, owaspCoverage, type AccessStatus, type AuditKind, type PubStatus, type RangeKey, type Role, type Track, type User,
} from './data'
import { BarChart, ChartCard, HBarList, Heatmap, LineChart, SegmentBar } from './charts'
import { ADMIN_BASE, fmt } from './routes'
import { Shell } from '../portal/Shell'
import { usePath, useTheme, type Theme } from '../portal/hooks'
import { Badge, Drawer, Kpi, NavLink, Popover, Select, type Tone } from '../portal/ui'

const BASE = ADMIN_BASE
type PageKey = 'beranda' | 'pengguna' | 'kelas' | 'katalog' | 'audit' | 'pengaturan'
const PAGES: Array<{ key: PageKey; path: string; label: string; icon: typeof House; description: string }> = [
  { key: 'beranda', path: BASE, label: 'Beranda', icon: House, description: 'Ringkasan aktivitas dan publikasi IFA Lab.' },
  { key: 'pengguna', path: `${BASE}/pengguna`, label: 'Pengguna & Akses', icon: Users, description: 'Kelola akun, peran, dan status akses IFA Lab.' },
  { key: 'kelas', path: `${BASE}/kelas`, label: 'Kelas', icon: GraduationCap, description: 'Kelas aktif, dosen pengampu, dan progres praktikum.' },
  { key: 'katalog', path: `${BASE}/katalog`, label: 'Katalog & Publikasi', icon: Layers, description: 'Modul lab, alur review, dan cakupan OWASP Top 10:2025.' },
  { key: 'audit', path: `${BASE}/audit`, label: 'Audit Log', icon: ClipboardList, description: 'Jejak perubahan akses, kelas, publikasi, dan sesi.' },
  { key: 'pengaturan', path: `${BASE}/pengaturan`, label: 'Pengaturan', icon: Settings, description: 'Kebijakan sesi, akses, dan preferensi tampilan.' },
]

const statusTone: Record<AccessStatus, Tone> = { Aktif: 'good', Nonaktif: 'muted', Ditangguhkan: 'warn' }
const pubTone: Record<PubStatus, Tone> = { Terbit: 'good', Review: 'warn', Draft: 'muted' }
function SampleTag({ live }: { live?: boolean }) {
  return live ? (
    <span className="sample-tag" style={{ background: 'var(--good-soft)', color: 'var(--good)' }}>
      Data langsung
    </span>
  ) : (
    <span className="sample-tag" title="Backend belum menyediakan API admin. Angka pada halaman ini adalah data contoh.">
      Data contoh
    </span>
  )
}

// ---------------------------------------------------------------- Halaman

function HomePage({ go, live, csrf }: { go: (to: string) => void; live?: AdminDashboardResponse; csrf: string }) {
  const qc = useQueryClient()
  const { lang } = useI18n()
  const [range, setRange] = useState<RangeKey>('4w')
  const [cls, setCls] = useState('all')
  const [seedMsg, setSeedMsg] = useState<string | null>(null)
  const seedMut = useMutation({
    mutationFn: () => simApi.triggerAdminSeed(csrf),
    onSuccess: async (res) => {
      setSeedMsg(res.message)
      await qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
  })
  const series = activitySeries(range, cls)
  const k = kpis(range, cls)
  const coverage = owaspCoverage()
  const published = MODULES.filter(m => m.passRate !== null)
  const filters = <div className="filters">
    {live ? (
      <button type="button" className="btn-outline" disabled={seedMut.isPending} onClick={() => seedMut.mutate()}>
        <Database size={15} aria-hidden="true" />
        {seedMut.isPending ? (lang === 'en' ? 'Seeding...' : 'Mengisi Seed...') : (lang === 'en' ? 'Trigger Seed (12 Students)' : 'Isi Seed Demo (12 Mhs)')}
      </button>
    ) : null}
    <Select label="Rentang waktu" icon={CalendarDays} value={range} onChange={setRange} options={RANGES.map(r => ({ value: r.key, label: r.label }))} />
    <Select label="Kelas" icon={Layers} value={cls} onChange={setCls} options={[{ value: 'all', label: 'Semua kelas' }, ...CLASSES.map(c => ({ value: c.id, label: `${c.name} · ${c.course}` }))]} />
  </div>
  return <>
    <PageHead page="beranda" live={Boolean(live)} actions={filters} />
    {seedMsg ? (
      <div className="card" style={{ borderColor: 'var(--good)', background: 'var(--good-soft)', padding: '12px 16px' }}>
        <strong style={{ color: 'var(--good)' }}>{seedMsg}</strong>
      </div>
    ) : null}
    <div className="kpi-grid">
      <Kpi label="Akun aktif" value={fmt(live ? live.kpis.active_accounts : k.activeAccounts)} icon={Users} note={live ? `Total ${live.kpis.total_accounts} akun DB` : cls === 'all' ? 'Mahasiswa, dosen, dan admin' : `Anggota ${cls}`} />
      <Kpi label="Kelas aktif" value={live ? live.kpis.active_classes : k.activeClasses} icon={GraduationCap} note="Semester ganjil 2026/2027" />
      <Kpi label="Lab web terbit" value={live ? live.kpis.published_labs : k.publishedLabs} icon={FlaskConical} note={live ? `${live.kpis.total_sessions} total sesi simulator` : `${MODULES.filter(m => m.status === 'Review').length} modul menunggu review`} />
      <Kpi label="Cakupan OWASP" value={<>{live ? live.kpis.owasp_covered : k.owaspCovered} <small>dari 10</small></>} icon={ShieldCheck} note="Kategori dengan lab terbit" />
    </div>
    <div className="grid-2">
      <ChartCard title="Akun unik beraktivitas" subtitle="Akun per minggu" columns={['Minggu', 'Akun']} rows={series.accounts.map(d => [d.label, fmt(d.value)])}>
        <LineChart data={series.accounts} unit="akun" />
      </ChartCard>
      <ChartCard title="Sesi praktikum dimulai" subtitle={`Sesi per minggu · total ${fmt(k.sessionsTotal)}, ${k.sessionsTrend >= 0 ? 'naik' : 'turun'} ${Math.abs(k.sessionsTrend)}% dibanding paruh awal`} columns={['Minggu', 'Sesi']} rows={series.sessions.map(d => [d.label, fmt(d.value)])}>
        <BarChart data={series.sessions} unit="sesi" />
      </ChartCard>
    </div>
    <div className="grid-2">
      <section className="card" aria-labelledby="owasp-title">
        <header className="card-head"><div><h2 id="owasp-title">Cakupan OWASP Top 10:2025</h2></div><NavLink to={`${BASE}/katalog`} go={go} className="card-link">Lihat katalog <ArrowRight size={15} aria-hidden="true" /></NavLink></header>
        <ul className="owasp-list">{coverage.map(o => <li key={o.code} title={o.name}><strong>{o.code}</strong><span className="owasp-name">{o.name}</span><Badge tone={pubTone[o.state]}>{o.published ? `${o.published} terbit` : o.state}</Badge></li>)}</ul>
      </section>
      <section className="card" aria-labelledby="audit-title">
        <header className="card-head"><div><h2 id="audit-title">Aktivitas audit terbaru</h2></div><NavLink to={`${BASE}/audit`} go={go} className="card-link">Lihat audit <ArrowRight size={15} aria-hidden="true" /></NavLink></header>
        <AuditList events={AUDIT.slice(0, 5)} />
      </section>
    </div>
    <div className="grid-3">
      <ChartCard title="Waktu praktikum terpadat" subtitle="Rata-rata sesi per minggu menurut hari dan jam" className="span-2">
        <Heatmap rows={HEAT_DAYS} cols={HEAT_SLOTS} values={HEAT} unit="sesi" />
      </ChartCard>
      <ChartCard title="Komposisi akun" subtitle="Menurut peran aktif" columns={['Peran', 'Akun']} rows={ROLE_TOTALS.map(r => [r.label, fmt(r.value)])}>
        <HBarList items={ROLE_TOTALS} unit="Akun menurut peran" />
        <div className="divider" />
        <p className="mini-title">Status akses</p>
        <SegmentBar unit="Status akses akun" items={STATUS_TOTALS.map(s => ({ ...s, tone: statusTone[s.label] }))} />
      </ChartCard>
    </div>
    <div className="grid-2">
      <ChartCard title="Progres praktikum per kelas" subtitle="Rata-rata modul diselesaikan mahasiswa" columns={['Kelas', 'Selesai']} rows={CLASSES.map(c => [c.name, `${c.completion}%`])}>
        <HBarList items={CLASSES.map(c => ({ label: c.name, note: c.course, value: c.completion }))} max={100} format={n => `${n}%`} unit="Progres per kelas" />
      </ChartCard>
      <ChartCard title="Tingkat lulus modul terbit" subtitle="Persentase percobaan yang mencapai bukti eksploitasi dan perbaikan" columns={['Modul', 'Lulus']} rows={published.map(m => [m.title, `${m.passRate}%`])}>
        <HBarList items={published.map(m => ({ label: m.title, note: `${m.track} · ${fmt(m.attempts)} percobaan`, value: m.passRate! }))} max={100} format={n => `${n}%`} unit="Tingkat lulus" />
      </ChartCard>
    </div>
  </>
}

function AuditList({ events }: { events: typeof AUDIT }) {
  const icon: Record<AuditKind, typeof House> = { Publikasi: FlaskConical, Kelas: Users, Akun: ShieldCheck, Sesi: ArrowRightLeft, Akses: KeyRound }
  return <ul className="audit-list">{events.map(e => { const Icon = icon[e.kind]; return <li key={e.id}><span className="audit-icon"><Icon size={18} aria-hidden="true" /></span><div><p className="audit-title">{e.title}</p><p className="audit-meta">{e.actor} · {e.date === '15 Nov 2026' ? e.at : `${e.date}, ${e.at}`}</p></div>{e.result === 'Ditolak' && <Badge tone="bad">Ditolak</Badge>}</li> })}</ul>
}

function UsersPage({ live, csrf }: { live?: AdminDashboardResponse; csrf: string }) {
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<'all' | Role>('all')
  const [status, setStatus] = useState<'all' | AccessStatus>('all')
  const [detail, setDetail] = useState<User | null>(null)
  const [policy, setPolicy] = useState(false)
  const toggleMut = useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) => simApi.setUserStatus(csrf, userId, active),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
  })
  const q = query.trim().toLowerCase()
  const list = USERS.filter(u => (role === 'all' || u.role === role) && (status === 'all' || u.status === status) && (!q || u.name.toLowerCase().includes(q) || (u.nim ?? '').includes(q)))
  return <>
    <PageHead page="pengguna" live={Boolean(live)} actions={<button type="button" className="btn-primary" onClick={() => setPolicy(true)}><KeyRound size={17} aria-hidden="true" />Kelola akses</button>} />
    {live ? (
      <section className="card table-card" aria-labelledby="live-users-title">
        <header className="table-head">
          <h2 id="live-users-title">Akun Pengguna Basis Data ({live.users.length})</h2>
        </header>
        <div className="sim-table-wrap"><table className="sim-table">
          <thead><tr><th scope="col">Nama</th><th scope="col">Email</th><th scope="col">Peran</th><th scope="col">Status</th><th scope="col">Aksi</th></tr></thead>
          <tbody>{live.users.map(u => <tr key={u.id}>
            <td><strong>{u.name}</strong></td>
            <td>{u.email}</td>
            <td>{u.roles.join(', ') || 'mahasiswa'}</td>
            <td><Badge tone={u.active ? 'good' : 'muted'}>{u.active ? 'Aktif' : 'Nonaktif'}</Badge></td>
            <td>
              <button type="button" className="btn-outline" style={{ minHeight: 30, fontSize: 12.5 }} disabled={toggleMut.isPending} onClick={() => toggleMut.mutate({ userId: u.id, active: !u.active })}>
                {u.active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </td>
          </tr>)}</tbody>
        </table></div>
      </section>
    ) : null}
    <div className="kpi-grid">
      <Kpi label="Total akun" value="128" icon={Users} note="Terdaftar di portal" />
      <Kpi label="Akun aktif" value="118" icon={ShieldCheck} note="92% dari total" />
      <Kpi label="Login ditolak" value="5" icon={KeyRound} note="7 hari terakhir" />
      <Kpi label="Pemegang grant Admin" value="2" icon={UserCog} note="Minimal satu Admin aktif" />
    </div>
    <section className="card table-card" aria-labelledby="users-title">
      <header className="table-head">
        <h2 id="users-title">Daftar pengguna</h2>
        <div className="filters">
          <label className="search"><Search size={16} aria-hidden="true" /><span className="sr-only">Cari pengguna</span><input type="search" placeholder="Cari nama atau NIM" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <Select label="Peran" icon={Users} value={role} onChange={setRole} options={[{ value: 'all', label: 'Semua peran' }, ...(['Mahasiswa', 'Dosen', 'Admin'] as Role[]).map(r => ({ value: r, label: r }))]} />
          <Select label="Status" icon={ShieldCheck} value={status} onChange={setStatus} options={[{ value: 'all', label: 'Semua status' }, ...(['Aktif', 'Nonaktif', 'Ditangguhkan'] as AccessStatus[]).map(s => ({ value: s, label: s }))]} />
        </div>
      </header>
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th scope="col">Pengguna</th><th scope="col">Peran</th><th scope="col">Kelas</th><th scope="col">Status akses</th><th scope="col">Terakhir aktif</th><th scope="col" className="center">Aksi</th></tr></thead>
        <tbody>{list.map(u => <tr key={u.id}>
          <td><div className="person"><span className="avatar">{u.initials}</span><div><p>{u.name}</p>{u.nim && <small>{u.nim}</small>}</div></div></td>
          <td>{u.role}</td><td>{u.classId ?? '—'}</td><td><Badge tone={statusTone[u.status]}>{u.status}</Badge></td><td>{u.lastActive}</td>
          <td className="center"><RowMenu user={u} onDetail={() => setDetail(u)} /></td>
        </tr>)}
        {!list.length && <tr><td colSpan={6} className="empty">Tidak ada pengguna yang cocok dengan filter.</td></tr>}</tbody>
      </table></div>
      <p className="table-foot">{list.length} dari {USERS.length} pengguna contoh</p>
    </section>
    <div className="grid-2">
      <ChartCard title="Login per hari" subtitle="Login berhasil, 7 hari terakhir" columns={['Tanggal', 'Login']} rows={AUDIT_DAILY.map(d => [d.label, fmt(d.value * 3)])}>
        <BarChart data={AUDIT_DAILY.map(d => ({ ...d, value: d.value * 3 }))} unit="login" labelPrefix="" />
      </ChartCard>
      <ChartCard title="Status akses akun" subtitle="Seluruh akun portal" columns={['Status', 'Akun']} rows={STATUS_TOTALS.map(s => [s.label, fmt(s.value)])}>
        <SegmentBar unit="Status akses akun" items={STATUS_TOTALS.map(s => ({ ...s, tone: statusTone[s.label] }))} />
        <div className="divider" />
        <HBarList items={ROLE_TOTALS} unit="Akun menurut peran" />
      </ChartCard>
    </div>
    {detail && <Drawer title={detail.name} onClose={() => setDetail(null)}>
      <div className="person large"><span className="avatar">{detail.initials}</span><div><p>{detail.name}</p><small>{detail.nim ? `NIM ${detail.nim}` : 'Akun allowlist Dosen+Admin'}</small></div></div>
      <dl className="detail-list">
        <div><dt>Peran aktif</dt><dd>{detail.role}</dd></div>
        <div><dt>Grant</dt><dd>{detail.grants.join(', ')}</dd></div>
        <div><dt>Status akses</dt><dd><Badge tone={statusTone[detail.status]}>{detail.status}</Badge></dd></div>
        <div><dt>Kelas</dt><dd>{detail.classId ?? '—'}</dd></div>
        <div><dt>Terakhir aktif</dt><dd>{detail.lastActive}</dd></div>
      </dl>
      <h3 className="mini-title">Riwayat akses</h3>
      <ul className="timeline"><li><strong>Login berhasil</strong><span>{detail.lastActive}, 08.12</span></li><li><strong>Grant diinisialisasi</strong><span>Login pertama sesuai kebijakan</span></li></ul>
      <ApiNotice />
    </Drawer>}
    {policy && <Drawer title="Kebijakan akses" onClose={() => setPolicy(false)}>
      <p className="drawer-lead">Akses ditentukan oleh identitas Google terverifikasi dan grant yang tersimpan.</p>
      <div className="table-wrap compact"><table className="data-table"><thead><tr><th scope="col">Identitas</th><th scope="col">Grant awal</th></tr></thead><tbody>
        <tr><td>Allowlist Dosen+Admin (<code>ALLOWED_EMAILS</code>)</td><td>Dosen, Admin</td></tr>
        <tr><td>NIM sembilan digit, posisi 4–6 <code>140</code>, domain mahasiswa</td><td>Mahasiswa</td></tr>
        <tr><td>Akun lain atau nonaktif</td><td>Ditolak</td></tr>
      </tbody></table></div>
      <ul className="check-list"><li><Check size={15} aria-hidden="true" />Email wajib terverifikasi dan dinormalisasi huruf kecil.</li><li><Check size={15} aria-hidden="true" />Pencabutan grant mencabut seluruh sesi akun.</li><li><Check size={15} aria-hidden="true" />Peralihan peran merotasi cookie dan token CSRF.</li></ul>
      <ApiNotice />
    </Drawer>}
  </>
}

function ApiNotice() { return <p className="api-notice">Perubahan grant, status akun, dan kelas belum dapat disimpan dari halaman ini karena API admin belum tersedia.</p> }

function RowMenu({ user, onDetail }: { user: User; onDetail: () => void }) {
  return <Popover label={`Aksi untuk ${user.name}`} className="icon-btn" trigger={<Ellipsis size={18} aria-hidden="true" />}>
    {close => <div className="menu" role="menu">
      <button type="button" role="menuitem" onClick={() => { close(); onDetail() }}>Lihat detail</button>
      <button type="button" role="menuitem" disabled title="Membutuhkan API admin">Ubah status akses</button>
      <button type="button" role="menuitem" disabled title="Membutuhkan API admin">Cabut grant</button>
    </div>}
  </Popover>
}

function ClassesPage({ live, csrf }: { live?: AdminDashboardResponse; csrf: string }) {
  const qc = useQueryClient()
  const [clsId, setClsId] = useState('')
  const [clsName, setClsName] = useState('')
  const [clsCourse, setClsCourse] = useState('Keamanan Web & IoT')
  const clsSemester = 'Ganjil 2026/2027'
  const saveMut = useMutation({
    mutationFn: () => simApi.saveClass(csrf, { id: clsId, name: clsName, course: clsCourse, semester: clsSemester }),
    onSuccess: async () => {
      setClsId('')
      setClsName('')
      await qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
  })
  const total = CLASSES.reduce((t, c) => t + c.students, 0)
  const avg = Math.round(CLASSES.reduce((t, c) => t + c.completion * c.students, 0) / total)
  return <>
    <PageHead page="kelas" live={Boolean(live)} />
    {live ? (
      <section className="card" style={{ display: 'grid', gap: 12 }}>
        <div className="card-head"><div><h2>Kelola Kelas Terdaftar ({live.classes.length})</h2></div></div>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Kode</th><th>Nama</th><th>Mata Kuliah</th><th>Semester</th><th>Status</th></tr></thead>
          <tbody>{live.classes.map(c => <tr key={c.id}><td><strong>{c.id}</strong></td><td>{c.name}</td><td>{c.course}</td><td>{c.semester}</td><td><Badge tone={c.active ? 'good' : 'muted'}>{c.active ? 'Aktif' : 'Arsip'}</Badge></td></tr>)}</tbody>
        </table></div>
        <form style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }} onSubmit={e => { e.preventDefault(); saveMut.mutate() }}>
          <input className="sim-input" placeholder="Kode (mis. IF-4B)" value={clsId} onChange={e => setClsId(e.target.value)} required />
          <input className="sim-input" placeholder="Nama kelas" value={clsName} onChange={e => setClsName(e.target.value)} required />
          <input className="sim-input" placeholder="Mata kuliah" value={clsCourse} onChange={e => setClsCourse(e.target.value)} required />
          <button type="submit" className="btn-primary" disabled={saveMut.isPending}>Simpan Kelas</button>
        </form>
      </section>
    ) : null}
    <div className="kpi-grid">
      <Kpi label="Kelas aktif" value={CLASSES.length} icon={GraduationCap} note="Semester ganjil 2026/2027" />
      <Kpi label="Mahasiswa terdaftar" value={total} icon={Users} note="Seluruh kelas aktif" />
      <Kpi label="Dosen pengampu" value={new Set(CLASSES.map(c => c.lecturer)).size} icon={UserCog} note="Ditugaskan ke kelas" />
      <Kpi label="Rata-rata progres" value={`${avg}%`} icon={BookOpenCheck} note="Tertimbang jumlah mahasiswa" />
    </div>
    <div className="grid-2">
      <ChartCard title="Progres praktikum per kelas" subtitle="Rata-rata modul diselesaikan" columns={['Kelas', 'Selesai']} rows={CLASSES.map(c => [c.name, `${c.completion}%`])}>
        <HBarList items={CLASSES.map(c => ({ label: c.name, note: c.course, value: c.completion }))} max={100} format={n => `${n}%`} unit="Progres per kelas" />
      </ChartCard>
      <ChartCard title="Mahasiswa per kelas" subtitle="Jumlah anggota terdaftar" columns={['Kelas', 'Mahasiswa']} rows={CLASSES.map(c => [c.name, fmt(c.students)])}>
        <BarChart data={CLASSES.map(c => ({ label: c.name, value: c.students }))} unit="mahasiswa" labelPrefix="Kelas" />
      </ChartCard>
    </div>
    <section aria-labelledby="class-list" className="section">
      <h2 id="class-list" className="section-title">Daftar kelas</h2>
      <div className="class-grid">{CLASSES.map(c => <article key={c.id} className="card class-card">
        <header><span className="class-code">{c.name}</span><Badge tone="good">Aktif</Badge></header>
        <h3>{c.course}</h3>
        <dl><div><dt>Dosen</dt><dd>{c.lecturer}</dd></div><div><dt>Jadwal</dt><dd>{c.schedule}</dd></div><div><dt>Mahasiswa</dt><dd>{c.students}</dd></div></dl>
        <div className="progress"><div className="progress-meta"><span>Progres</span><strong>{c.completion}%</strong></div><div className="hbar-track" role="progressbar" aria-valuenow={c.completion} aria-valuemin={0} aria-valuemax={100} aria-label={`Progres ${c.name}`}><div className="hbar-fill" style={{ width: `${c.completion}%` }} /></div></div>
      </article>)}</div>
    </section>
  </>
}

function CatalogPage({ live, csrf }: { live?: AdminDashboardResponse; csrf: string }) {
  const qc = useQueryClient()
  const modMut = useMutation({
    mutationFn: ({ labId, status }: { labId: string; status: string }) => simApi.setModuleStatus(csrf, labId, status),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
  })
  const [track, setTrack] = useState<'all' | Track>('all')
  const [status, setStatus] = useState<'all' | PubStatus>('all')
  const list = MODULES.filter(m => (track === 'all' || m.track === track) && (status === 'all' || m.status === status))
  const coverage = owaspCoverage()
  const count = (s: PubStatus, t?: Track) => MODULES.filter(m => m.status === s && (!t || m.track === t)).length
  return <>
    <PageHead page="katalog" live={Boolean(live)} />
    {live ? (
      <section className="card table-card">
        <header className="table-head"><h2>Kontrol Publikasi Modul Simulator ({live.modules.length})</h2></header>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Lab ID</th><th>Judul</th><th>Jalur</th><th>Status</th><th>Ubah Status</th></tr></thead>
          <tbody>{live.modules.map(m => <tr key={m.lab_id}>
            <td><code>{m.lab_id}</code></td>
            <td><strong>{m.title}</strong></td>
            <td>{m.owasp_code ?? m.track.toUpperCase()}</td>
            <td><Badge tone={m.status === 'Terbit' ? 'good' : m.status === 'Review' ? 'warn' : 'muted'}>{m.status}</Badge></td>
            <td>
              <select className="sim-select-full" style={{ maxWidth: 140 }} value={m.status} disabled={modMut.isPending} onChange={e => modMut.mutate({ labId: m.lab_id, status: e.target.value })}>
                <option value="Draft">Draft</option>
                <option value="Review">Review</option>
                <option value="Terbit">Terbit</option>
              </select>
            </td>
          </tr>)}</tbody>
        </table></div>
      </section>
    ) : null}
    <div className="kpi-grid">
      <Kpi label="Total modul" value={MODULES.length} icon={Layers} note={`${MODULES.filter(m => m.track === 'Web').length} web · ${MODULES.filter(m => m.track === 'IoT').length} IoT`} />
      <Kpi label="Terbit" value={count('Terbit')} icon={FlaskConical} note="Tersedia untuk mahasiswa" />
      <Kpi label="Menunggu review" value={count('Review')} icon={BookOpenCheck} note="Perlu persetujuan Admin" />
      <Kpi label="Cakupan OWASP" value={<>{coverage.filter(c => c.published).length} <small>dari 10</small></>} icon={ShieldCheck} note="Kategori dengan lab terbit" />
    </div>
    <div className="grid-2">
      <ChartCard title="Alur publikasi" subtitle="Jumlah modul pada setiap tahap" columns={['Tahap', 'Modul']} rows={(['Draft', 'Review', 'Terbit'] as PubStatus[]).map(s => [s, String(count(s))])}>
        <div className="pipeline">{(['Draft', 'Review', 'Terbit'] as PubStatus[]).map((s, i) => <div key={s} className="pipeline-step">
          <Badge tone={pubTone[s]}>{s}</Badge><p className="pipeline-value">{count(s)}</p><p className="pipeline-note">Web {count(s, 'Web')} · IoT {count(s, 'IoT')}</p>{i < 2 && <ArrowRight className="pipeline-arrow" size={16} aria-hidden="true" />}
        </div>)}</div>
      </ChartCard>
      <ChartCard title="Percobaan per modul terbit" subtitle="Total sejak modul diterbitkan" columns={['Modul', 'Percobaan']} rows={MODULES.filter(m => m.attempts).map(m => [m.title, fmt(m.attempts)])}>
        <HBarList items={MODULES.filter(m => m.attempts).sort((a, b) => b.attempts - a.attempts).map(m => ({ label: m.title, note: m.track, value: m.attempts }))} unit="Percobaan per modul" />
      </ChartCard>
    </div>
    <section className="card" aria-labelledby="owasp-matrix">
      <header className="card-head"><div><h2 id="owasp-matrix">Matriks OWASP Top 10:2025</h2><p>Modul jalur web menurut kategori</p></div></header>
      <div className="owasp-grid">{coverage.map(o => <div key={o.code} className={`owasp-tile state-${o.state.toLowerCase()}`}>
        <div className="owasp-tile-head"><strong>{o.code}</strong><Badge tone={pubTone[o.state]}>{o.published ? `${o.published} terbit` : o.state}</Badge></div>
        <p>{o.name}</p><small>{o.total ? `${o.total} modul` : 'Belum ada modul'}</small>
      </div>)}</div>
    </section>
    <section className="card table-card" aria-labelledby="module-title">
      <header className="table-head"><h2 id="module-title">Daftar modul</h2>
        <div className="filters">
          <Select label="Jalur" icon={Layers} value={track} onChange={setTrack} options={[{ value: 'all', label: 'Semua jalur' }, { value: 'Web', label: 'Keamanan web' }, { value: 'IoT', label: 'Keamanan IoT' }]} />
          <Select label="Status publikasi" icon={ShieldCheck} value={status} onChange={setStatus} options={[{ value: 'all', label: 'Semua status' }, ...(['Draft', 'Review', 'Terbit'] as PubStatus[]).map(s => ({ value: s, label: s }))]} />
        </div>
      </header>
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th scope="col">Modul</th><th scope="col">Jalur</th><th scope="col">OWASP</th><th scope="col">Tingkat</th><th scope="col">Status</th><th scope="col">Penulis</th><th scope="col">Diperbarui</th></tr></thead>
        <tbody>{list.map(m => <tr key={m.id}><td><p className="strong">{m.title}</p><small className="mono">{m.id}</small></td><td>{m.track}</td><td>{m.owasp ? <span title={OWASP.find(o => o.code === m.owasp)?.name}>{m.owasp}</span> : '—'}</td><td>{m.level}</td><td><Badge tone={pubTone[m.status]}>{m.status}</Badge></td><td>{m.author}</td><td>{m.updated}</td></tr>)}
        {!list.length && <tr><td colSpan={7} className="empty">Tidak ada modul yang cocok dengan filter.</td></tr>}</tbody>
      </table></div>
      <p className="table-foot">{list.length} modul</p>
    </section>
  </>
}

function AuditPage({ live, csrf }: { live?: AdminDashboardResponse; csrf: string }) {
  const kinds: AuditKind[] = ['Akses', 'Akun', 'Kelas', 'Publikasi', 'Sesi']
  const [kind, setKind] = useState<'all' | AuditKind>('all')
  const [result, setResult] = useState<'all' | 'Berhasil' | 'Ditolak'>('all')
  const list = AUDIT.filter(e => (kind === 'all' || e.kind === kind) && (result === 'all' || e.result === result))
  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = ['tanggal,waktu,jenis,peristiwa,aktor,detail,hasil', ...list.map(e => [e.date, e.at, e.kind, e.title, e.actor, e.detail, e.result].map(esc).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'audit-ifa-lab-contoh.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return <>
    <PageHead page="audit" live={Boolean(live)} actions={<button type="button" className="btn-outline" onClick={exportCsv}><Download size={17} aria-hidden="true" />Unduh CSV</button>} />
    <AdminSecurityMonitorPanel csrf={csrf} />
    {live && live.audit_logs.length > 0 ? (
      <section className="card table-card">
        <header className="table-head"><h2>Log Audit Langsung Basis Data</h2></header>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Waktu</th><th>Jenis</th><th>Peristiwa</th><th>Target</th><th>Hasil</th></tr></thead>
          <tbody>{live.audit_logs.map(a => <tr key={a.id}><td>{new Date(a.created_at).toLocaleString('id-ID')}</td><td>{a.kind}</td><td>{a.title}</td><td><code>{a.target}</code></td><td><Badge tone={a.result === 'Berhasil' ? 'good' : 'bad'}>{a.result}</Badge></td></tr>)}</tbody>
        </table></div>
      </section>
    ) : null}
    <div className="grid-3">
      <ChartCard title="Peristiwa audit per hari" subtitle="7 hari terakhir" columns={['Tanggal', 'Peristiwa']} rows={AUDIT_DAILY.map(d => [d.label, fmt(d.value)])} className="span-2">
        <BarChart data={AUDIT_DAILY} unit="peristiwa" labelPrefix="" />
      </ChartCard>
      <ChartCard title="Menurut jenis" subtitle="Peristiwa pada daftar contoh" columns={['Jenis', 'Peristiwa']} rows={kinds.map(k => [k, String(AUDIT.filter(e => e.kind === k).length)])}>
        <HBarList items={kinds.map(k => ({ label: k, value: AUDIT.filter(e => e.kind === k).length })).sort((a, b) => b.value - a.value)} unit="Peristiwa menurut jenis" />
      </ChartCard>
    </div>
    <section className="card table-card" aria-labelledby="audit-log-title">
      <header className="table-head"><h2 id="audit-log-title">Log peristiwa</h2>
        <div className="filters">
          <div className="chips" role="group" aria-label="Jenis peristiwa">{(['all', ...kinds] as const).map(k => <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'all' ? 'Semua' : k}</button>)}</div>
          <Select label="Hasil" icon={ShieldCheck} value={result} onChange={setResult} options={[{ value: 'all', label: 'Semua hasil' }, { value: 'Berhasil', label: 'Berhasil' }, { value: 'Ditolak', label: 'Ditolak' }]} />
        </div>
      </header>
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th scope="col">Waktu</th><th scope="col">Jenis</th><th scope="col">Peristiwa</th><th scope="col">Aktor</th><th scope="col">Hasil</th></tr></thead>
        <tbody>{list.map(e => <tr key={e.id}><td className="nowrap">{e.date}<small>{e.at} WIB</small></td><td>{e.kind}</td><td><p className="strong">{e.title}</p><small>{e.detail}</small></td><td>{e.actor}</td><td><Badge tone={e.result === 'Berhasil' ? 'good' : 'bad'}>{e.result}</Badge></td></tr>)}
        {!list.length && <tr><td colSpan={5} className="empty">Tidak ada peristiwa yang cocok dengan filter.</td></tr>}</tbody>
      </table></div>
      <p className="table-foot">{list.length} peristiwa · Log tidak menyimpan token, kode otorisasi, atau kata sandi.</p>
    </section>
  </>
}

function SettingsPage({ theme, setTheme, user }: { theme: Theme; setTheme: (t: Theme) => void; user: Identity }) {
  return <>
    <PageHead page="pengaturan" />
    <SecuritySettingsPage user={user} />
    <div className="grid-2" style={{ marginTop: 18 }}>
      <section className="card" aria-labelledby="session-policy">
        <header className="card-head"><div><h2 id="session-policy">Kebijakan sesi</h2><p>Konfigurasi server · baca saja</p></div></header>
        <dl className="detail-list">
          <div><dt>Batas tanpa aktivitas</dt><dd>30 menit</dd></div>
          <div><dt>Batas sesi absolut</dt><dd>8 jam</dd></div>
          <div><dt>Transaksi login</dt><dd>5 menit</dd></div>
          <div><dt>Pembersihan sesi kedaluwarsa</dt><dd>Setiap 5 menit</dd></div>
          <div><dt>Sesi Anda berakhir</dt><dd>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(user.expires_at))}</dd></div>
        </dl>
      </section>
      <section className="card" aria-labelledby="access-policy">
        <header className="card-head"><div><h2 id="access-policy">Kebijakan akses</h2><p>Ditetapkan melalui konfigurasi deployment</p></div></header>
        <ul className="check-list">
          <li><Check size={15} aria-hidden="true" />Login hanya melalui Google dengan email terverifikasi.</li>
          <li><Check size={15} aria-hidden="true" />Dosen dan Admin dibatasi allowlist; Mahasiswa melalui pola NIM.</li>
          <li><Check size={15} aria-hidden="true" />Claim Workspace <code>hd</code> diperiksa untuk akun institusi.</li>
          <li><Check size={15} aria-hidden="true" />Permintaan perubahan memakai Origin exact dan token CSRF.</li>
        </ul>
      </section>
      <section className="card" aria-labelledby="display-pref">
        <header className="card-head"><div><h2 id="display-pref">Tampilan</h2><p>Disimpan di peramban ini</p></div></header>
        <div className="segmented" role="radiogroup" aria-label="Tema">
          {([['light', 'Terang', Sun], ['dark', 'Gelap', Moon], ['system', 'Ikuti sistem', Monitor]] as const).map(([v, label, Icon]) => <button key={v} type="button" role="radio" aria-checked={theme === v} onClick={() => setTheme(v)}><Icon size={16} aria-hidden="true" />{label}</button>)}
        </div>
        <p className="subtle-note">Bahasa antarmuka mendukung Bahasa Indonesia dan English melalui menu akun.</p>
      </section>
      <section className="card" aria-labelledby="retention">
        <header className="card-head"><div><h2 id="retention">Retensi data</h2><p>Menunggu keputusan pengelola</p></div></header>
        <dl className="detail-list">
          <div><dt>Log autentikasi</dt><dd>Jenis peristiwa saja, tanpa token</dd></div>
          <div><dt>Retensi log dan backup</dt><dd><Badge tone="warn">Belum ditetapkan</Badge></dd></div>
          <div><dt>Cookie analitik</dt><dd>Tidak digunakan</dd></div>
        </dl>
      </section>
    </div>
  </>
}

function PageHead({ page, actions, live }: { page: PageKey; actions?: ReactNode; live?: boolean }) {
  const p = PAGES.find(x => x.key === page)!
  return <div className="page-head"><div><div className="page-title"><h1>{page === 'beranda' ? 'Beranda Admin' : p.label}</h1>{page !== 'pengaturan' && <SampleTag live={live} />}</div><p>{p.description}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>
}

// ---------------------------------------------------------------- Shell

export function AdminApp({ user, onLogout, loggingOut, onSwitchRole, switching, error }: { user: Identity; onLogout: () => void; loggingOut: boolean; onSwitchRole: (role: string) => void; switching: boolean; error?: ReactNode }) {
  const [path, go] = usePath()
  const [theme, setTheme] = useTheme()
  const { tr } = useI18n()
  const adminQ = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => simApi.getAdminDashboard(), retry: false })
  const live = adminQ.data ?? undefined
  const pages = PAGES.map((p) => {
    const labelMap: Record<PageKey, string> = {
      beranda: tr.nav.admin.beranda,
      pengguna: tr.nav.admin.pengguna,
      kelas: tr.nav.admin.kelas,
      katalog: tr.nav.admin.katalog,
      audit: tr.nav.admin.audit,
      pengaturan: tr.nav.admin.pengaturan,
    }
    return { ...p, label: labelMap[p.key] ?? p.label }
  })
  const page = pages.find(p => p.path === path) ?? pages[0]
  return <Shell user={user} pages={pages} active={page.key} go={go} theme={theme} setTheme={setTheme} onLogout={onLogout} loggingOut={loggingOut} onSwitchRole={onSwitchRole} switching={switching}
    notifications={NOTIFICATIONS} error={error}
    accountExtra={close => <button type="button" role="menuitem" onClick={() => { close(); go(`${BASE}/pengaturan`) }}><Settings size={15} aria-hidden="true" />{tr.nav.admin.pengaturan}</button>}>
    {page.key === 'beranda' && <HomePage go={go} live={live} csrf={user.csrf_token} />}
    {page.key === 'pengguna' && <UsersPage live={live} csrf={user.csrf_token} />}
    {page.key === 'kelas' && <ClassesPage live={live} csrf={user.csrf_token} />}
    {page.key === 'katalog' && <CatalogPage live={live} csrf={user.csrf_token} />}
    {page.key === 'audit' && <AuditPage live={live} csrf={user.csrf_token} />}
    {page.key === 'pengaturan' && <SettingsPage theme={theme} setTheme={setTheme} user={user} />}
  </Shell>
}
