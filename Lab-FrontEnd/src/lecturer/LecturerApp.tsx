import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  ClipboardPlus,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  House,
  Layers,
  ListChecks,
  Lock,
  MessageSquare,
  Search,
  ShieldAlert,
  Trophy,
  Users,
} from 'lucide-react'
import type { Identity } from '../api'
import { BarChart, ChartCard, HBarList, SegmentBar } from '../admin/charts'
import { getLecturerCatalog, type Catalog } from '../latihan/api'
import { ExercisePlayer, LevelMap } from '../latihan/components'
import { Shell, type NavPage } from '../portal/Shell'
import { store, usePath, useTheme } from '../portal/hooks'
import { Badge, Drawer, Kpi, LoadState, NavLink, PageHead, Select, SessionCard, TrackTabs } from '../portal/ui'
import { AnimatedMeterRow, AnimatedNumber, AnimatedProgressRing } from '../shared/charts/AnimatedCharts'
import { ErrorView } from '../shared/errors/ErrorView'
import { useI18n } from '../shared/i18n'
import { IotCatalogPage, LabDetailPage, PanduanPage, WebCatalogPage } from '../simulator/CatalogViews'
import { LabWorkspace } from '../simulator/LabWorkspace'
import { simApi, type InstructorDashboardResponse, type LevelId } from '../simulator/api'
import { LeaderboardSection } from './LeaderboardSection'

const PAGES: NavPage[] = [
  { key: 'beranda', path: '/lab/dosen', label: 'Beranda', icon: House },
  { key: 'leaderboard', path: '/lab/dosen/leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'web', path: '/lab/dosen/web', label: 'Simulasi OWASP Web', icon: ShieldAlert },
  { key: 'iot', path: '/lab/dosen/iot', label: 'IoT Studio', icon: Cpu },
  { key: 'kelas', path: '/lab/dosen/kelas', label: 'Kelas & Ekspor', icon: Users },
  { key: 'penugasan', path: '/lab/dosen/penugasan', label: 'Penugasan', icon: ClipboardPlus },
  { key: 'progres', path: '/lab/dosen/progres', label: 'Progres & Nilai', icon: BarChart3 },
  { key: 'latihan', path: '/lab/dosen/latihan', label: 'Bank latihan', icon: BookOpenCheck },
  { key: 'panduan', path: '/lab/dosen/panduan', label: 'Panduan', icon: BookOpen },
]

interface Props {
  user: Identity
  onLogout: () => void
  loggingOut: boolean
  onSwitchRole: (role: string) => void
  switching: boolean
  error?: React.ReactNode
}

export function LecturerApp(props: Props) {
  const [path, go] = usePath()
  const [theme, setTheme] = useTheme()
  const { tr } = useI18n()
  const [hide, setHide] = useState(() => store.get('ifa-presentasi') === '1')
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [inspectSessionId, setInspectSessionId] = useState<string | null>(null)
  const toggleHide = () =>
    setHide((v) => {
      store.set('ifa-presentasi', v ? '0' : '1')
      return !v
    })

  const pages: NavPage[] = PAGES.map((p) => {
    const labelMap: Record<string, string> = {
      beranda: tr.nav.lecturer.beranda,
      leaderboard: tr.nav.lecturer.leaderboard,
      web: tr.nav.lecturer.web,
      iot: tr.nav.lecturer.iot,
      kelas: tr.nav.lecturer.kelas,
      penugasan: tr.nav.lecturer.penugasan,
      progres: tr.nav.lecturer.progres,
      latihan: tr.nav.lecturer.latihan,
      panduan: tr.nav.lecturer.panduan,
    }
    return { ...p, label: labelMap[p.key] ?? p.label }
  })

  const simSessionId = path.startsWith('/lab/dosen/sesi/') ? path.slice('/lab/dosen/sesi/'.length).split('/')[0] : null
  const webParts = path.startsWith('/lab/dosen/web/') ? path.slice('/lab/dosen/web/'.length).split('/').filter(Boolean) : []
  const iotLabId = path.startsWith('/lab/dosen/iot/') ? path.slice('/lab/dosen/iot/'.length).split('/')[0] : null

  const dashQ = useQuery({
    queryKey: ['instructor-dashboard', selectedClass],
    queryFn: () => simApi.getInstructorDashboard(selectedClass || undefined),
    enabled: !simSessionId && !path.startsWith('/lab/dosen/web') && !path.startsWith('/lab/dosen/iot'),
    retry: false,
  })

  const catalogQ = useQuery({
    queryKey: ['latihan', 'dosen'],
    queryFn: getLecturerCatalog,
    enabled: path.startsWith('/lab/dosen/latihan') || dashQ.isError,
  })

  const detailId = path.startsWith('/lab/dosen/latihan/') ? path.slice('/lab/dosen/latihan/'.length) : null
  const active = path.startsWith('/lab/dosen/web') || Boolean(simSessionId)
    ? 'web'
    : path.startsWith('/lab/dosen/iot')
      ? 'iot'
      : path.startsWith('/lab/dosen/leaderboard')
        ? 'leaderboard'
        : path.startsWith('/lab/dosen/latihan')
          ? 'latihan'
          : path.startsWith('/lab/dosen/kelas')
            ? 'kelas'
            : path.startsWith('/lab/dosen/penugasan')
              ? 'penugasan'
              : path.startsWith('/lab/dosen/progres')
                ? 'progres'
                : path.startsWith('/lab/dosen/panduan')
                  ? 'panduan'
                  : 'beranda'

  const data = catalogQ.data
  const detail =
    data && detailId
      ? data.tracks.flatMap((t) => t.exercises.map((e) => ({ track: t, exercise: e }))).find((x) => x.exercise.id === detailId)
      : undefined

  const presentation = (
    <button type="button" className="btn-outline" aria-pressed={hide} onClick={toggleHide}>
      {hide ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      {hide ? 'Mode presentasi aktif' : 'Mode presentasi'}
    </button>
  )

  return (
    <Shell {...props} pages={pages} active={active} go={go} theme={theme} setTheme={setTheme} crumb={detail?.exercise.title}>
      {simSessionId ? (
        <LabWorkspace
          sessionId={simSessionId}
          csrf={props.user.csrf_token}
          theme={theme}
          go={go}
          mode="dosen"
          hideAnswers={hide}
          presentationToggle={presentation}
        />
      ) : active === 'web' ? (
        webParts.length >= 2 ? (
          <LabDetailPage
            labId={webParts[1]}
            csrf={props.user.csrf_token}
            theme={theme}
            go={go}
            mode="dosen"
            presentationToggle={presentation}
          />
        ) : (
          <WebCatalogPage
            categoryFilter={webParts[0]}
            go={go}
            mode="dosen"
            presentationToggle={presentation}
          />
        )
      ) : active === 'iot' ? (
        iotLabId ? (
          <LabDetailPage
            labId={iotLabId}
            csrf={props.user.csrf_token}
            theme={theme}
            go={go}
            mode="dosen"
            presentationToggle={presentation}
          />
        ) : (
          <IotCatalogPage go={go} mode="dosen" presentationToggle={presentation} />
        )
      ) : active === 'panduan' ? (
        <PanduanPage role="dosen" />
      ) : active === 'latihan' ? (
        !data ? (
          <LoadState error={catalogQ.isError} onRetry={() => void catalogQ.refetch()} />
        ) : detailId ? (
          detail ? (
            <>
              <div className="player-toolbar">{presentation}</div>
              <ExercisePlayer
                catalog={data}
                track={detail.track}
                exercise={detail.exercise}
                mode="dosen"
                go={go}
                hideAnswers={hide}
              />
            </>
          ) : (
            <ErrorView
              status={404}
              title="Latihan Tidak Ditemukan"
              subtitle="Latihan yang Anda buka tidak tersedia pada bank soal."
              homeHref="/lab/dosen"
              onStayCurrent={() => go('/lab/dosen/latihan')}
              onGoHome={() => go('/lab/dosen')}
            />
          )
        ) : (
          <Bank catalog={data} go={go} actions={presentation} />
        )
      ) : dashQ.data ? (
        <>
          {active === 'penugasan' ? (
            <AssignmentsCreatePage dash={dashQ.data} csrf={props.user.csrf_token} />
          ) : active === 'leaderboard' ? (
            <div style={{ display: 'grid', gap: 18 }}>
              <PageHead
                title="Leaderboard Mahasiswa"
                description="Peringkat pencapaian XP, penguasaan OWASP/IoT, dan skor praktikum lintas kelas."
                actions={
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {presentation}
                    <NavLink to="/lab/dosen" go={go} className="btn-outline">
                      Kembali ke Beranda
                    </NavLink>
                  </div>
                }
              />
              <LeaderboardSection
                entries={dashQ.data.leaderboard ?? []}
                classes={dashQ.data.classes}
                hide={hide}
              />
            </div>
          ) : (
            <InstructorSimulatorView
              dash={dashQ.data}
              user={props.user}
              mode={active as 'beranda' | 'kelas' | 'progres'}
              hide={hide}
              presentation={presentation}
              selectedClass={selectedClass || dashQ.data.selected_class}
              onSelectClass={setSelectedClass}
              onInspectSession={setInspectSessionId}
              go={go}
            />
          )}
          {inspectSessionId ? (
            <EvidenceReviewDrawer
              sessionId={inspectSessionId}
              csrf={props.user.csrf_token}
              onClose={() => setInspectSessionId(null)}
            />
          ) : null}
        </>
      ) : dashQ.isError && data ? (
        <LegacyLecturerHome
          catalog={data}
          user={props.user}
          go={go}
          loading={<LoadState error={catalogQ.isError} onRetry={() => void catalogQ.refetch()} />}
        />
      ) : (
        <LoadState error={dashQ.isError && catalogQ.isError} onRetry={() => void dashQ.refetch()} />
      )}
    </Shell>
  )
}

function InstructorSimulatorView({
  dash,
  user,
  mode,
  hide,
  presentation,
  selectedClass,
  onSelectClass,
  onInspectSession,
  go,
}: {
  dash: InstructorDashboardResponse
  user: Identity
  mode: 'beranda' | 'kelas' | 'progres'
  hide: boolean
  presentation: React.ReactNode
  selectedClass: string
  onSelectClass: (id: string) => void
  onInspectSession: (sessionId: string) => void
  go: (to: string) => void
}) {
  const { lang } = useI18n()
  const qc = useQueryClient()
  const [searchText, setSearchText] = useState('')
  const [trackFilter, setTrackFilter] = useState<'all' | 'web' | 'iot'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'running' | 'not_started'>('all')
  const [seedNotice, setSeedNotice] = useState<string | null>(null)

  const seedMut = useMutation({
    mutationFn: () => simApi.triggerDosenSeed(user.csrf_token),
    onSuccess: async (res) => {
      setSeedNotice(res.message)
      await qc.invalidateQueries({ queryKey: ['instructor-dashboard'] })
    },
  })

  const histData = dash.score_histogram.map((b) => ({ label: b.label, value: b.count }))
  const weeklyData = dash.weekly_activity ?? []
  const owaspMastery = dash.owasp_mastery ?? []
  const trackBreak = dash.track_breakdown
  const passRatePct =
    dash.kpis.assignments_total > 0
      ? Math.round((dash.kpis.assignments_passed / dash.kpis.assignments_total) * 100)
      : 0

  const filteredRows = dash.student_rows.filter((r) => {
    if (trackFilter !== 'all' && r.track !== trackFilter) return false
    if (statusFilter === 'passed' && !r.passed) return false
    if (statusFilter === 'running' && (r.passed || !r.session_id)) return false
    if (statusFilter === 'not_started' && r.session_id) return false
    const q = searchText.trim().toLowerCase()
    if (!q) return true
    return (
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.lab_id ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <PageHead
        title={
          mode === 'kelas'
            ? lang === 'en'
              ? 'Class Management & Export'
              : 'Manajemen Kelas & Ekspor'
            : mode === 'progres'
              ? lang === 'en'
                ? 'Student Progress & Evidence'
                : 'Progres & Penilaian Bukti'
              : `Selamat datang, ${user.name.split(/\s+/)[0] || user.name}`
        }
        description={
          lang === 'en'
            ? 'Monitor OWASP & IoT simulator completion, inspect student reflections, compare leaderboard ranks, and export safe CSV.'
            : 'Pantau ketuntasan praktikum simulator OWASP & IoT, tinjau refleksi mahasiswa, peringkat leaderboard, dan ekspor nilai aman.'
        }
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {dash.classes.length > 0 ? (
              <Select
                label={lang === 'en' ? 'Select class' : 'Pilih kelas'}
                value={selectedClass}
                onChange={onSelectClass}
                icon={Users}
                options={[
                  { value: 'ALL', label: lang === 'en' ? 'ALL · All Classes' : 'ALL · Semua Kelas' },
                  ...dash.classes.map((c) => ({ value: c.id, label: `${c.id} · ${c.course}` })),
                ]}
              />
            ) : null}
            {presentation}
            <button
              type="button"
              className="btn-outline"
              disabled={seedMut.isPending}
              onClick={() => seedMut.mutate()}
            >
              <Database size={15} />
              {seedMut.isPending
                ? lang === 'en'
                  ? 'Seeding...'
                  : 'Mengisi Seed...'
                : lang === 'en'
                  ? 'Seed Demo (12 Students)'
                  : 'Isi Seed Demo (12 Mhs)'}
            </button>
            <NavLink to="/lab/dosen/web" go={go} className="btn-outline">
              <ShieldAlert size={15} /> Simulator OWASP
            </NavLink>
            <a className="btn-outline" href={`/api/dosen/export?class_id=${encodeURIComponent(selectedClass)}`}>
              <Download size={15} /> Ekspor CSV Aman
            </a>
            <NavLink to="/lab/dosen/penugasan" go={go} className="btn-primary">
              <ClipboardPlus size={15} /> Buat Tugas
            </NavLink>
          </div>
        }
      />

      {seedNotice ? (
        <div className="card" style={{ borderColor: 'var(--good)', background: 'var(--good-soft)', padding: '12px 16px' }}>
          <strong style={{ color: 'var(--good)' }}>{seedNotice}</strong>
        </div>
      ) : null}

      <section className="card sim-dash-hero" aria-label="Ringkasan Kelas & Ketuntasan">
        <AnimatedProgressRing
          value={passRatePct}
          max={100}
          label={lang === 'en' ? 'Pass Rate' : 'Kelulusan'}
          sublabel={`${dash.kpis.assignments_passed}/${dash.kpis.assignments_total}`}
        />
        <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <span className="rank-kicker">
                {lang === 'en' ? 'Class Cohort Overview' : 'Ringkasan Analitik Kelas'}
              </span>
              <h2 style={{ margin: '2px 0' }}>
                {selectedClass === 'ALL' ? (lang === 'en' ? 'All Classes' : 'Semua Kelas Terpadu') : selectedClass}
              </h2>
            </div>
            <Badge tone="info">
              {dash.kpis.active_students}/{dash.kpis.students_enrolled} {lang === 'en' ? 'active students' : 'mahasiswa aktif'}
            </Badge>
          </div>
          {trackBreak ? (
            <>
              <AnimatedMeterRow
                label="Web OWASP Track"
                value={trackBreak.web_passed}
                max={Math.max(1, trackBreak.web_sessions)}
                tone="brand"
                note={`${trackBreak.web_passed}/${trackBreak.web_sessions} lulus`}
              />
              <AnimatedMeterRow
                label="IoT Studio Track"
                value={trackBreak.iot_passed}
                max={Math.max(1, trackBreak.iot_sessions)}
                tone="good"
                note={`${trackBreak.iot_passed}/${trackBreak.iot_sessions} lulus`}
              />
            </>
          ) : (
            <AnimatedMeterRow
              label={lang === 'en' ? 'Assignment Completion' : 'Ketuntasan Penugasan'}
              value={dash.kpis.assignments_passed}
              max={Math.max(1, dash.kpis.assignments_total)}
              tone="good"
            />
          )}
        </div>
      </section>

      <div className="kpi-grid">
        <Kpi
          label="Mahasiswa Terdaftar"
          value={<AnimatedNumber value={dash.kpis.students_enrolled} />}
          icon={Users}
          note={`Kelas ${selectedClass}`}
        />
        <Kpi
          label="Mahasiswa Aktif"
          value={<AnimatedNumber value={dash.kpis.active_students} />}
          icon={ListChecks}
          note="Pernah membuka sesi"
        />
        <Kpi
          label="Penyelesaian Tugas"
          value={
            <>
              <AnimatedNumber value={dash.kpis.assignments_passed} /> <small>/ {dash.kpis.assignments_total}</small>
            </>
          }
          icon={Layers}
        />
        <Kpi
          label="Rata-rata Skor"
          value={dash.kpis.avg_score !== null ? dash.kpis.avg_score : '-'}
          icon={BarChart3}
          note={`${dash.ungraded_count} sesi berjalan`}
        />
      </div>

      <div className="grid-2">
        <section className="card" style={{ display: 'grid', gap: 12 }}>
          <div className="card-head">
            <div>
              <h2>Progres Penugasan Kelas</h2>
              <p>Distribusi mahasiswa: Lulus, Berjalan, Belum Mulai</p>
            </div>
          </div>
          {dash.assignments.map((a) => {
            const hasAny = a.passed + a.running + a.not_started > 0
            return (
              <div key={a.id} style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, gap: 8, flexWrap: 'wrap' }}>
                  <strong>{a.title}</strong>
                  <span className="muted">
                    {a.lab_id} ({a.required_level})
                  </span>
                </div>
                {hasAny ? (
                  <SegmentBar
                    unit="Mahasiswa"
                    items={[
                      { label: 'Lulus', value: a.passed, tone: 'good' },
                      { label: 'Berjalan', value: a.running, tone: 'warn' },
                      { label: 'Belum mulai', value: a.not_started, tone: 'muted' },
                    ]}
                  />
                ) : (
                  <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
                    Belum ada peserta terdaftar di kelas ini.
                  </p>
                )}
              </div>
            )
          })}
          {dash.assignments.length === 0 ? <p className="muted">Belum ada penugasan di kelas ini.</p> : null}
        </section>

        <ChartCard
          title="Sebaran Skor Rubrik Mahasiswa"
          subtitle="Histogram 0–59, 60–79, 80–89, dan 90–100"
          columns={['Rentang Skor', 'Jumlah']}
          rows={histData.map((d) => [d.label, String(d.value)])}
        >
          <BarChart data={histData} unit="sesi" labelPrefix="Skor" height={195} />
        </ChartCard>
      </div>

      {weeklyData.length > 0 || owaspMastery.length > 0 ? (
        <div className="grid-2">
          {weeklyData.length > 0 ? (
            <ChartCard
              title={lang === 'en' ? '7-Day Lab Activity Trend' : 'Tren Aktivitas Praktikum 7 Hari'}
              subtitle={lang === 'en' ? 'Sessions updated per day across selected cohort' : 'Jumlah sesi aktif dan selesai per hari'}
              columns={['Tanggal', 'Sesi']}
              rows={weeklyData.map((d) => [d.label, String(d.value)])}
            >
              <BarChart data={weeklyData} unit="sesi" labelPrefix="" height={185} />
            </ChartCard>
          ) : null}
          {owaspMastery.length > 0 ? (
            <section className="card" style={{ display: 'grid', gap: 12 }}>
              <div className="card-head">
                <div>
                  <h2>{lang === 'en' ? 'Module Mastery Breakdown' : 'Penguasaan per Modul OWASP & IoT'}</h2>
                  <p>{lang === 'en' ? 'Passed sessions vs total attempts per module' : 'Perbandingan sesi lulus terhadap total percobaan'}</p>
                </div>
              </div>
              <HBarList
                unit="Sesi lulus"
                items={owaspMastery.map((m) => ({
                  label: `${m.code} · ${m.title}`,
                  value: m.passed_count,
                  note: `${m.passed_count}/${m.total_attempts} lulus`,
                }))}
              />
            </section>
          ) : null}
        </div>
      ) : null}

      {Array.isArray(dash.leaderboard) && dash.leaderboard.length > 0 ? (
        <LeaderboardSection
          entries={dash.leaderboard}
          classes={dash.classes}
          hide={hide}
          limit={6}
          onOpenFull={() => go('/lab/dosen/leaderboard')}
        />
      ) : null}

      <section className="card table-card">
        <header className="table-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>Daftar Progres &amp; Bukti Praktikum Mahasiswa</h2>
          <div className="sim-filter-bar" style={{ marginLeft: 'auto' }}>
            <div className="search" style={{ minWidth: 200 }}>
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Filter nama / NIM / lab..."
                aria-label="Filter mahasiswa"
              />
            </div>
            <Select
              label="Filter track"
              icon={ShieldAlert}
              value={trackFilter}
              onChange={(v) => setTrackFilter(v as 'all' | 'web' | 'iot')}
              options={[
                { value: 'all', label: 'Semua Track' },
                { value: 'web', label: 'Web OWASP' },
                { value: 'iot', label: 'IoT Studio' },
              ]}
            />
            <Select
              label="Filter status"
              icon={ListChecks}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as 'all' | 'passed' | 'running' | 'not_started')}
              options={[
                { value: 'all', label: 'Semua Status' },
                { value: 'passed', label: 'Lulus' },
                { value: 'running', label: 'Berjalan' },
                { value: 'not_started', label: 'Belum mulai' },
              ]}
            />
          </div>
        </header>
        <div className="sim-table-wrap">
          <table className="sim-table">
            <thead>
              <tr>
                <th>Mahasiswa</th>
                <th>Lab &amp; Level</th>
                <th>Tahap</th>
                <th>Skor</th>
                <th>Status</th>
                <th>Tinjau Bukti</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, idx) => (
                <tr key={`${r.user_id}-${r.session_id ?? idx}`}>
                  <td>
                    <strong>{hide ? `Mahasiswa #${idx + 1}` : r.name}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {hide ? '••••••••' : r.email}
                    </div>
                  </td>
                  <td>{r.lab_id ? `${r.lab_id} (${r.level_id})` : '-'}</td>
                  <td>{r.current_step ?? '-'}</td>
                  <td>{r.score ?? '-'}</td>
                  <td>
                    <Badge tone={r.passed ? 'good' : r.session_id ? 'warn' : 'muted'}>
                      {r.passed ? 'Lulus' : r.session_id ? 'Berjalan' : 'Belum mulai'}
                    </Badge>
                  </td>
                  <td>
                    {r.session_id ? (
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ minHeight: 32, fontSize: 12.5 }}
                        onClick={() => onInspectSession(r.session_id!)}
                      >
                        <MessageSquare size={13} /> Tinjau Bukti
                      </button>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    Belum ada baris mahasiswa yang cocok dengan filter ini.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <SessionCard name={user.name} email={user.email} role={user.role} expiresAt={user.expires_at} />
    </div>
  )
}

function AssignmentsCreatePage({ dash, csrf }: { dash: InstructorDashboardResponse; csrf: string }) {
  const qc = useQueryClient()
  const labsQ = useQuery({ queryKey: ['labs-catalog', 'dosen'], queryFn: () => simApi.getCatalog() })
  const [classId, setClassId] = useState(dash.selected_class)
  const [title, setTitle] = useState('')
  const [labId, setLabId] = useState('a05-sqli')
  const [levelId, setLevelId] = useState<LevelId>('medium')
  const [dueInDays, setDueInDays] = useState(7)
  const [threshold, setThreshold] = useState(80)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: () =>
      simApi.createAssignment(csrf, {
        class_id: classId,
        title,
        lab_id: labId,
        required_level: levelId,
        due_in_days: dueInDays,
        pass_threshold: threshold,
      }),
    onSuccess: async (res) => {
      setTitle('')
      setSavedMsg(`Penugasan "${res.title}" untuk kelas ${res.class_id} tersimpan.`)
      await qc.invalidateQueries({ queryKey: ['instructor-dashboard'] })
    },
  })

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHead
        title="Kelola Penugasan Praktikum"
        description="Buat tugas lab simulator OWASP Web atau IoT Studio untuk kelas yang Anda ampu."
      />
      <div className="sim-workbench">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Buat Penugasan Baru</h2>
            </div>
          </div>
          {savedMsg ? (
            <div className="sim-vis-box" style={{ background: 'var(--good-soft)', borderColor: 'var(--good)', marginBottom: 12 }}>
              <strong style={{ color: 'var(--good)' }}>{savedMsg}</strong>
            </div>
          ) : null}
          <form
            style={{ display: 'grid', gap: 12 }}
            onSubmit={(e) => {
              e.preventDefault()
              createMut.mutate()
            }}
          >
            <div className="sim-form-field">
              <label htmlFor="asg-class">Kelas</label>
              <select id="asg-class" className="sim-select-full" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {dash.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} · {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sim-form-field">
              <label htmlFor="asg-title">Judul Penugasan</label>
              <input
                id="asg-title"
                className="sim-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mis. Praktikum SQL Injection & Parameterized Query"
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="sim-form-field">
                <label htmlFor="asg-lab">Modul Lab</label>
                <select id="asg-lab" className="sim-select-full" value={labId} onChange={(e) => setLabId(e.target.value)}>
                  {(labsQ.data?.labs ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.owasp_code ?? 'IoT'} · {l.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sim-form-field">
                <label htmlFor="asg-level">Level Wajib</label>
                <select
                  id="asg-level"
                  className="sim-select-full"
                  value={levelId}
                  onChange={(e) => setLevelId(e.target.value as LevelId)}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="impossible">Impossible</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="sim-form-field">
                <label htmlFor="asg-days">Tenggat (hari ke depan)</label>
                <input
                  id="asg-days"
                  type="number"
                  min={1}
                  max={180}
                  className="sim-input"
                  value={dueInDays}
                  onChange={(e) => setDueInDays(Number(e.target.value))}
                />
              </div>
              <div className="sim-form-field">
                <label htmlFor="asg-pass">Ambang Lulus (1–100)</label>
                <input
                  id="asg-pass"
                  type="number"
                  min={1}
                  max={100}
                  className="sim-input"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={createMut.isPending || !title.trim()}>
              <ClipboardPlus size={16} /> Terbitkan Penugasan
            </button>
          </form>
        </section>

        <section className="card" style={{ display: 'grid', gap: 10 }}>
          <div className="card-head">
            <div>
              <h2>Daftar Tugas Terbit ({dash.assignments.length})</h2>
            </div>
          </div>
          {dash.assignments.map((a) => (
            <div key={a.id} className="sim-vis-box">
              <strong>{a.title}</strong>
              <span className="muted" style={{ fontSize: 13 }}>
                {a.lab_id} ({a.required_level}) · Lulus: {a.passed}/{a.denominator} mahasiswa
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

function EvidenceReviewDrawer({
  sessionId,
  csrf,
  onClose,
}: {
  sessionId: string
  csrf: string
  onClose: () => void
}) {
  const detailQ = useQuery({
    queryKey: ['sim-session', sessionId],
    queryFn: () => simApi.getSession(sessionId),
  })
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState<string | null>(null)

  const fbMut = useMutation({
    mutationFn: () => simApi.addFeedback(csrf, sessionId, comment),
    onSuccess: (res) => {
      setComment('')
      setSent(`Umpan balik terkirim: "${res.comment}"`)
    },
  })

  return (
    <Drawer title="Tinjau Bukti & Umpan Balik Mahasiswa" onClose={onClose}>
      {detailQ.isLoading || !detailQ.data ? (
        <LoadState error={detailQ.isError} onRetry={() => void detailQ.refetch()} />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <strong>{detailQ.data.lab.title}</strong>
            <div className="muted" style={{ fontSize: 13 }}>
              Level {detailQ.data.session.level_label} · Skor: {detailQ.data.session.score ?? '-'} · Patch:{' '}
              <code>{detailQ.data.session.selected_patch ?? '-'}</code>
            </div>
          </div>

          <div className="sim-vis-box">
            <strong style={{ fontSize: 13 }}>Hasil Refleksi Mahasiswa</strong>
            <div style={{ fontSize: 13 }}>
              <div>
                <strong>Akar Masalah:</strong> {detailQ.data.session.reflection?.root_cause ?? '(belum diisi)'}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Bukti:</strong> {detailQ.data.session.reflection?.evidence ?? '(belum diisi)'}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Transfer Konsep:</strong> {detailQ.data.session.reflection?.transfer ?? '(belum diisi)'}
              </div>
            </div>
          </div>

          {sent ? (
            <div className="sim-vis-box" style={{ background: 'var(--good-soft)', borderColor: 'var(--good)' }}>
              <strong style={{ color: 'var(--good)' }}>{sent}</strong>
            </div>
          ) : null}

          <form
            style={{ display: 'grid', gap: 10 }}
            onSubmit={(e) => {
              e.preventDefault()
              fbMut.mutate()
            }}
          >
            <div className="sim-form-field">
              <label htmlFor="dosen-feedback">Catatan / Umpan Balik Dosen</label>
              <textarea
                id="dosen-feedback"
                className="sim-textarea"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Berikan catatan terkait kualitas bukti atau pilihan kontrol..."
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={fbMut.isPending || !comment.trim()}>
              Kirim Umpan Balik
            </button>
          </form>
        </div>
      )}
    </Drawer>
  )
}

function LegacyLecturerHome({
  catalog,
  user,
  go,
  loading,
}: {
  catalog?: Catalog
  user: Identity
  go: (to: string) => void
  loading: React.ReactNode
}) {
  const all = catalog?.tracks.flatMap((t) => t.exercises) ?? []
  return (
    <>
      <PageHead
        title={`Selamat datang, ${user.name.split(/\s+/)[0] || user.name}`}
        description="Bank latihan lengkap dengan kunci jawaban dan pembahasan untuk mendampingi kelas."
        actions={
          <NavLink to="/lab/dosen/latihan" go={go} className="btn-primary">
            Buka bank latihan
            <ArrowRight size={16} aria-hidden="true" />
          </NavLink>
        }
      />
      {!catalog ? (
        loading
      ) : (
        <>
          <div className="kpi-grid">
            <Kpi label="Total latihan" value={all.length} icon={ListChecks} note={`${catalog.tracks.length} jalur`} />
            {catalog.tracks.map((t) => (
              <Kpi key={t.id} label={t.title} value={t.exercises.length} icon={Layers} note={`${catalog.levels.length} level`} />
            ))}
            <Kpi
              label="Pilihan ganda"
              value={all.filter((e) => e.content?.kind === 'pilihan').length}
              icon={BookOpenCheck}
              note={`${all.filter((e) => e.content?.kind === 'isian').length} isian singkat`}
            />
          </div>
          <section className="card table-card" aria-labelledby="matrix-title">
            <header className="table-head">
              <h2 id="matrix-title">Sebaran latihan per level</h2>
            </header>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Level</th>
                    {catalog.tracks.map((t) => (
                      <th key={t.id} scope="col" className="num">
                        {t.title}
                      </th>
                    ))}
                    <th scope="col" className="num">
                      Poin mahasiswa
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.levels.map((l) => (
                    <tr key={l.level}>
                      <td className="strong">{l.name}</td>
                      {catalog.tracks.map((t) => (
                        <td key={t.id} className="num">
                          {t.exercises.filter((e) => e.level === l.level).length}
                        </td>
                      ))}
                      <td className="num">{l.points} XP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card" aria-labelledby="flow-title">
            <header className="card-head">
              <div>
                <h2 id="flow-title">Alur yang dilihat mahasiswa</h2>
                <p>Perbedaan tampilan Mahasiswa dan Dosen</p>
              </div>
            </header>
            <ul className="check-list">
              <li>
                <Lock size={15} aria-hidden="true" />
                Mahasiswa mengerjakan langkah berurutan. Level berikutnya terbuka setelah semua latihan pada level sebelumnya benar.
              </li>
              <li>
                <Lock size={15} aria-hidden="true" />
                Jawaban mahasiswa diperiksa server. Kunci jawaban tidak pernah dikirim ke akun Mahasiswa.
              </li>
              <li>
                <Lock size={15} aria-hidden="true" />
                Mahasiswa memperoleh XP, peringkat, dan lencana. Petunjuk memotong XP setengahnya dan setiap jawaban salah mengurangi 10%.
              </li>
              <li>
                <Eye size={15} aria-hidden="true" />
                Dosen melihat semua level terbuka beserta kunci, pembahasan, dan petunjuk. Mode presentasi menyembunyikan jawaban saat dibahas di kelas.
              </li>
            </ul>
          </section>
        </>
      )}
      <SessionCard name={user.name} email={user.email} role={user.role} expiresAt={user.expires_at} />
    </>
  )
}

function Bank({ catalog, go, actions }: { catalog: Catalog; go: (to: string) => void; actions: React.ReactNode }) {
  const [tab, setTab] = useState(() => store.get('ifa-track') ?? catalog.tracks[0].id)
  const track = catalog.tracks.find((t) => t.id === tab) ?? catalog.tracks[0]
  const select = (id: string) => {
    setTab(id)
    store.set('ifa-track', id)
  }
  return (
    <>
      <PageHead
        title="Bank latihan"
        description="Semua level terbuka. Pilih latihan untuk melihat soal, kunci jawaban, dan pembahasan."
        actions={actions}
      />
      <TrackTabs
        tracks={catalog.tracks.map((t) => ({ id: t.id, title: t.title, note: `${t.exercises.length} latihan` }))}
        value={track.id}
        onChange={select}
      />
      <p className="track-desc">{track.description}</p>
      <LevelMap catalog={catalog} track={track} mode="dosen" go={go} />
    </>
  )
}
