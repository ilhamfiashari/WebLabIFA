import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  ClipboardPlus,
  Code2,
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
  Settings,
  ShieldAlert,
  Trophy,
  Users,
} from 'lucide-react'
import type { Identity } from '../api'
import { BarChart, ChartCard, HBarList, SegmentBar } from '../admin/charts'
import { getLecturerCatalog, type Catalog } from '../latihan/api'
import { ExercisePlayer, LevelMap } from '../latihan/components'
import { MoodleBankPanel } from '../latihan/MoodleBankPanel'
import { Shell, type NavPage } from '../portal/Shell'
import { Pagination } from '../portal/Pagination'
import { store, usePath, useTheme } from '../portal/hooks'
import { Badge, Drawer, Kpi, LoadState, NavLink, PageHead, Select, SessionCard, TrackTabs } from '../portal/ui'
import { AnimatedMeterRow, AnimatedNumber, AnimatedProgressRing } from '../shared/charts/AnimatedCharts'
import { ErrorView } from '../shared/errors/ErrorView'
import { useI18n } from '../shared/i18n'
import { SecuritySettingsPage } from '../shared/settings/SecuritySettingsPage'
import { StudentAccessApprovalPanel } from '../shared/StudentAccessApprovalPanel'
import { IotDocsPage } from '../iot/IotDocsPage'
import { IotSimulatorStudio } from '../iot/IotSimulatorStudio'
import { WebDevStudio } from '../webdev/WebDevStudio'
import { LabDetailPage, PanduanPage, WebCatalogPage } from '../simulator/CatalogViews'
import { LabWorkspace } from '../simulator/LabWorkspace'
import { simApi, type InstructorDashboardResponse, type LevelId } from '../simulator/api'
import { LeaderboardSection } from './LeaderboardSection'

const PAGES: NavPage[] = [
  { key: 'beranda', path: '/lab/dosen', label: 'Beranda', icon: House },
  { key: 'leaderboard', path: '/lab/dosen/leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'web', path: '/lab/dosen/web', label: 'Simulasi OWASP Web', icon: ShieldAlert },
  { key: 'webdev', path: '/lab/dosen/web-dev', label: 'Pengembangan Web', icon: Code2 },
  { key: 'iot', path: '/lab/dosen/iot', label: 'IoT Simulator', icon: Cpu },
  { key: 'kelas', path: '/lab/dosen/kelas', label: 'Kelas & Ekspor', icon: Users },
  { key: 'penugasan', path: '/lab/dosen/penugasan', label: 'Penugasan', icon: ClipboardPlus },
  { key: 'progres', path: '/lab/dosen/progres', label: 'Progres & Nilai', icon: BarChart3 },
  { key: 'latihan', path: '/lab/dosen/latihan', label: 'Bank latihan', icon: BookOpenCheck },
  { key: 'panduan', path: '/lab/dosen/panduan', label: 'Panduan', icon: BookOpen },
  { key: 'dokumentasi', path: '/lab/dosen/dokumentasi', label: 'Dokumentasi', icon: BookOpen },
  { key: 'pengaturan', path: '/lab/dosen/pengaturan', label: 'Pengaturan', icon: Settings },
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
      webdev: tr.nav.lecturer.webdev,
      iot: tr.nav.lecturer.iot,
      kelas: tr.nav.lecturer.kelas,
      penugasan: tr.nav.lecturer.penugasan,
      progres: tr.nav.lecturer.progres,
      latihan: tr.nav.lecturer.latihan,
      panduan: tr.nav.lecturer.panduan,
      dokumentasi: tr.nav.lecturer.dokumentasi,
      pengaturan: tr.nav.lecturer.pengaturan,
    }
    return { ...p, label: labelMap[p.key] ?? p.label }
  })

  const simSessionId = path.startsWith('/lab/dosen/sesi/') ? path.slice('/lab/dosen/sesi/'.length).split('/')[0] : null
  const webParts = path.startsWith('/lab/dosen/web/') ? path.slice('/lab/dosen/web/'.length).split('/').filter(Boolean) : []
  const webDevLabId = path.startsWith('/lab/dosen/web-dev/') ? path.slice('/lab/dosen/web-dev/'.length).split('/')[0] : null
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
  const active = path.startsWith('/lab/dosen/web-dev')
    ? 'webdev'
    : path.startsWith('/lab/dosen/web') || Boolean(simSessionId)
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
                  : path.startsWith('/lab/dosen/dokumentasi')
                    ? 'dokumentasi'
                    : path.startsWith('/lab/dosen/pengaturan')
                      ? 'pengaturan'
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
    <Shell
      {...props}
      pages={pages}
      active={active}
      go={go}
      theme={theme}
      setTheme={setTheme}
      crumb={detail?.exercise.title}
      accountExtra={(close) => (
        <button type="button" role="menuitem" onClick={() => { close(); go('/lab/dosen/pengaturan') }}>
          <Settings size={15} aria-hidden="true" />
          {tr.nav.lecturer.pengaturan}
        </button>
      )}
    >
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
      ) : active === 'webdev' ? (
        <WebDevStudio csrf={props.user.csrf_token} initialLabId={webDevLabId} mode="dosen" />
      ) : active === 'iot' ? (
        <IotSimulatorStudio csrf={props.user.csrf_token} initialLabId={iotLabId} mode="dosen" />
      ) : active === 'panduan' ? (
        <PanduanPage role="dosen" />
      ) : active === 'dokumentasi' ? (
        <IotDocsPage role="dosen" onOpenStudio={() => go('/lab/dosen/iot')} />
      ) : active === 'pengaturan' ? (
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <PageHead
            title="Pengaturan Keamanan Akun"
            description="Kelola MFA, Passkeys, Authenticator App (TOTP), Backup Codes, email notifikasi, dan sesi perangkat aktif."
          />
          <SecuritySettingsPage user={props.user} />
        </div>
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
                csrf={props.user.csrf_token}
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
          <Bank catalog={data} go={go} actions={presentation} csrf={props.user.csrf_token} />
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
  const [rowsPage, setRowsPage] = useState(1)
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
  const pagedRows = filteredRows.slice((rowsPage - 1) * 10, rowsPage * 10)

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

      {mode === 'kelas' ? (
        <StudentAccessApprovalPanel
          csrf={user.csrf_token}
          defaultClassId={selectedClass && selectedClass !== 'ALL' ? selectedClass : (dash.classes[0]?.id ?? '')}
        />
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
                label="Cyber Security Track"
                value={trackBreak.web_passed}
                max={Math.max(1, trackBreak.web_sessions)}
                tone="brand"
                note={`${trackBreak.web_passed}/${trackBreak.web_sessions} lulus`}
              />
              <AnimatedMeterRow
                label="IoT Track"
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
          <h2>{lang === 'en' ? 'Student Progress & Practice Evidence' : 'Daftar Progres & Bukti Praktikum Mahasiswa'}</h2>
          <div className="sim-filter-bar" style={{ marginLeft: 'auto' }}>
            <div className="search" style={{ minWidth: 200 }}>
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setRowsPage(1) }}
                placeholder={lang === 'en' ? 'Filter name / ID / lab...' : 'Filter nama / NIM / lab...'}
                aria-label={lang === 'en' ? 'Filter students' : 'Filter mahasiswa'}
              />
            </div>
            <Select
              label={lang === 'en' ? 'Filter track' : 'Filter track'}
              icon={ShieldAlert}
              value={trackFilter}
              onChange={(v) => { setTrackFilter(v as 'all' | 'web' | 'iot'); setRowsPage(1) }}
              options={[
                { value: 'all', label: lang === 'en' ? 'All Tracks' : 'Semua Track' },
                { value: 'web', label: 'Cyber Security' },
                { value: 'iot', label: 'IoT' },
              ]}
            />
            <Select
              label={lang === 'en' ? 'Filter status' : 'Filter status'}
              icon={ListChecks}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v as 'all' | 'passed' | 'running' | 'not_started'); setRowsPage(1) }}
              options={[
                { value: 'all', label: lang === 'en' ? 'All Statuses' : 'Semua Status' },
                { value: 'passed', label: lang === 'en' ? 'Passed' : 'Lulus' },
                { value: 'running', label: lang === 'en' ? 'In Progress' : 'Berjalan' },
                { value: 'not_started', label: lang === 'en' ? 'Not Started' : 'Belum mulai' },
              ]}
            />
          </div>
        </header>
        <div className="sim-table-wrap">
          <table className="sim-table">
            <thead>
              <tr>
                <th>{lang === 'en' ? 'Student' : 'Mahasiswa'}</th>
                <th>{lang === 'en' ? 'Lab & Level' : 'Lab & Level'}</th>
                <th>{lang === 'en' ? 'Step' : 'Tahap'}</th>
                <th>{lang === 'en' ? 'Score' : 'Skor'}</th>
                <th>Status</th>
                <th>{lang === 'en' ? 'Inspect Evidence' : 'Tinjau Bukti'}</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r, idx) => (
                <tr key={`${r.user_id}-${r.session_id ?? idx}`}>
                  <td>
                    <strong>{hide ? `${lang === 'en' ? 'Student' : 'Mahasiswa'} #${(rowsPage - 1) * 10 + idx + 1}` : r.name}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {hide ? '••••••••' : r.email}
                    </div>
                  </td>
                  <td>{r.lab_id ? `${r.lab_id} (${r.level_id})` : '-'}</td>
                  <td>{r.current_step ?? '-'}</td>
                  <td>{r.score ?? '-'}</td>
                  <td>
                    <Badge tone={r.passed ? 'good' : r.session_id ? 'warn' : 'muted'}>
                      {r.passed ? (lang === 'en' ? 'Passed' : 'Lulus') : r.session_id ? (lang === 'en' ? 'Running' : 'Berjalan') : (lang === 'en' ? 'Not Started' : 'Belum mulai')}
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
                        <MessageSquare size={13} /> {lang === 'en' ? 'Inspect' : 'Tinjau Bukti'}
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
                    {lang === 'en' ? 'No student rows match this filter.' : 'Belum ada baris mahasiswa yang cocok dengan filter ini.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={filteredRows.length} page={rowsPage} pageSize={10} onPageChange={setRowsPage} />
      </section>

      <SessionCard name={user.name} email={user.email} role={user.role} expiresAt={user.expires_at} />
    </div>
  )
}

const DEFAULT_RUBRIC = [
  { criterion: 'Identifikasi Skenario & Batas Kepercayaan', weight: 20 },
  { criterion: 'Bukti Pengujian / Simulasi', weight: 25 },
  { criterion: 'Perbaikan Kode / Rangkaian', weight: 30 },
  { criterion: 'Verifikasi & Refleksi', weight: 25 },
]

function AssignmentsCreatePage({ dash, csrf }: { dash: InstructorDashboardResponse; csrf: string }) {
  const qc = useQueryClient()
  const labsQ = useQuery({ queryKey: ['labs-catalog', 'dosen'], queryFn: () => simApi.getCatalog() })
  const [classId, setClassId] = useState(dash.selected_class)
  const [track, setTrack] = useState<'web' | 'iot'>('web')
  const [title, setTitle] = useState('')
  const [labId, setLabId] = useState('a05-sqli')
  const [levelId, setLevelId] = useState<LevelId>('medium')
  const [dueInDays, setDueInDays] = useState(7)
  const [threshold, setThreshold] = useState(80)
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [allowLate, setAllowLate] = useState(false)
  const [allowHints, setAllowHints] = useState(true)
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [rubric, setRubric] = useState(DEFAULT_RUBRIC)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const filteredLabs = (labsQ.data?.labs ?? []).filter((l) => l.track === track)
  const effectiveLabId = filteredLabs.some((l) => l.id === labId)
    ? labId
    : (filteredLabs[0]?.id ?? (track === 'iot' ? 'iot-esp32-gpio' : 'a05-sqli'))
  const detailAssignment = dash.assignments.find((a) => a.id === detailId) ?? null
  const rubricTotal = rubric.reduce((s, r) => s + r.weight, 0)

  const onTrackChange = (nextTrack: 'web' | 'iot') => {
    setTrack(nextTrack)
    const first = (labsQ.data?.labs ?? []).find((l) => l.track === nextTrack)
    setLabId(first?.id ?? (nextTrack === 'iot' ? 'iot-esp32-gpio' : 'a05-sqli'))
  }

  const createMut = useMutation({
    mutationFn: () =>
      simApi.createAssignment(csrf, {
        class_id: classId,
        title,
        lab_id: effectiveLabId,
        track,
        required_level: levelId,
        due_in_days: dueInDays,
        pass_threshold: threshold,
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        attachment_url: attachmentUrl.trim() || undefined,
        max_attempts: maxAttempts,
        allow_late: allowLate,
        allow_hints: allowHints,
        rubric: rubric.filter((r) => r.criterion.trim().length > 0),
      }),
    onSuccess: async (res) => {
      setTitle('')
      setDescription('')
      setInstructions('')
      setAttachmentUrl('')
      setErrMsg(null)
      setSavedMsg(`Penugasan "${res.title}" untuk kelas ${res.class_id} tersimpan.`)
      await qc.invalidateQueries({ queryKey: ['instructor-dashboard'] })
    },
    onError: (err) => {
      setSavedMsg(null)
      setErrMsg(err instanceof Error ? err.message : 'Gagal menerbitkan penugasan.')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => simApi.deleteAssignment(csrf, id),
    onSuccess: async () => {
      setDetailId(null)
      setSavedMsg('Penugasan berhasil dihapus.')
      await qc.invalidateQueries({ queryKey: ['instructor-dashboard'] })
    },
    onError: (err) => {
      setErrMsg(err instanceof Error ? err.message : 'Gagal menghapus penugasan.')
    },
  })

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHead
        title="Kelola Penugasan Praktikum"
        description="Rancang tugas praktikum terperinci (Cyber Security & IoT) lengkap dengan deskripsi, instruksi langkah, rubrik penilaian, dan batas percobaan."
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
          {errMsg ? (
            <p className="feedback wrong" role="alert" style={{ marginBottom: 12 }}>
              {errMsg}
            </p>
          ) : null}
          <form
            style={{ display: 'grid', gap: 12 }}
            onSubmit={(e) => {
              e.preventDefault()
              createMut.mutate()
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="sim-form-field">
                <label htmlFor="asg-class">Kelas</label>
                <select id="asg-class" className="sim-select-full" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  {dash.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.course}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sim-form-field">
                <label htmlFor="asg-track">Jalur Praktikum</label>
                <select
                  id="asg-track"
                  className="sim-select-full"
                  value={track}
                  onChange={(e) => onTrackChange(e.target.value as 'web' | 'iot')}
                >
                  <option value="web">Cyber Security</option>
                  <option value="iot">IoT</option>
                </select>
              </div>
            </div>
            <div className="sim-form-field">
              <label htmlFor="asg-title">Judul Penugasan</label>
              <input
                id="asg-title"
                className="sim-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  track === 'iot'
                    ? 'Mis. Praktikum Validasi CRC & TLS Telemetri ESP32'
                    : 'Mis. Praktikum SQL Injection & Parameterized Query'
                }
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="sim-form-field">
                <label htmlFor="asg-lab">Modul Lab ({track === 'iot' ? 'IoT' : 'Cyber Security'})</label>
                <select
                  id="asg-lab"
                  className="sim-select-full"
                  value={effectiveLabId}
                  onChange={(e) => setLabId(e.target.value)}
                >
                  {filteredLabs.map((l) => (
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div className="sim-form-field">
                <label htmlFor="asg-days">Tenggat (hari)</label>
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
                <label htmlFor="asg-pass">Ambang Lulus</label>
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
              <div className="sim-form-field">
                <label htmlFor="asg-attempts">Batas Percobaan (0 = bebas)</label>
                <input
                  id="asg-attempts"
                  type="number"
                  min={0}
                  max={20}
                  className="sim-input"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={allowHints} onChange={(e) => setAllowHints(e.target.checked)} />
                Izinkan Petunjuk Simulator
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} />
                Izinkan Kumpul Lewat Tenggat
              </label>
            </div>

            <div className="sim-form-field">
              <label htmlFor="asg-desc">Deskripsi Tugas &amp; Skenario</label>
              <textarea
                id="asg-desc"
                rows={2}
                className="sim-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ringkasan capaian keamanan atau arsitektur IoT yang harus diverifikasi mahasiswa."
              />
            </div>

            <div className="sim-form-field">
              <label htmlFor="asg-instr">Instruksi Langkah Pengerjaan</label>
              <textarea
                id="asg-instr"
                rows={3}
                className="sim-input"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="1. Identifikasi kerentanan/pin aktif&#10;2. Jalankan uji eksploitasi atau simulasi sensor&#10;3. Terapkan patch & verifikasi"
              />
            </div>

            <div className="sim-form-field">
              <label htmlFor="asg-url">Tautan Modul / Lampiran (opsional, https://)</label>
              <input
                id="asg-url"
                type="url"
                className="sim-input"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://lms.example.edu/modul-praktikum.pdf"
              />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13 }}>Rubrik Penilaian (Total Bobot: {rubricTotal}%)</strong>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ minHeight: 28, fontSize: 12, padding: '0 8px' }}
                  disabled={rubric.length >= 10}
                  onClick={() => setRubric((prev) => [...prev, { criterion: '', weight: 10 }])}
                >
                  + Tambah Kriteria
                </button>
              </div>
              {rubric.map((row, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 86px auto', gap: 6 }}>
                  <input
                    aria-label={`Kriteria rubrik ${idx + 1}`}
                    className="sim-input"
                    value={row.criterion}
                    onChange={(e) =>
                      setRubric((prev) => prev.map((it, i) => (i === idx ? { ...it, criterion: e.target.value } : it)))
                    }
                    placeholder="Kriteria penilaian"
                  />
                  <input
                    aria-label={`Bobot kriteria ${idx + 1}`}
                    type="number"
                    min={1}
                    max={100}
                    className="sim-input"
                    value={row.weight}
                    onChange={(e) =>
                      setRubric((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, weight: Number(e.target.value) || 1 } : it)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ minHeight: 34, padding: '0 10px' }}
                    disabled={rubric.length <= 1}
                    onClick={() => setRubric((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label={`Hapus kriteria ${idx + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button type="submit" className="btn-primary" disabled={createMut.isPending || !title.trim()}>
              <ClipboardPlus size={16} /> Terbitkan Penugasan
            </button>
          </form>
        </section>

        <section className="card" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <div className="card-head">
            <div>
              <h2>Daftar Tugas Terbit ({dash.assignments.length})</h2>
              <p>Klik Lihat Detail untuk meninjau rubrik dan progres tiap mahasiswa.</p>
            </div>
          </div>
          {dash.assignments.map((a) => (
            <div key={a.id} className="sim-vis-box" style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <strong>{a.title}</strong>
                <Badge tone="good">{a.track_label ?? (a.track === 'iot' ? 'IoT' : 'Cyber Security')}</Badge>
              </div>
              <span className="muted" style={{ fontSize: 13 }}>
                {a.lab_title ?? a.lab_id} ({a.required_level}) · Lulus: {a.passed}/{a.denominator} · Berjalan: {a.running} · Tenggat:{' '}
                {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(a.due_at))}
              </span>
              {a.description && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
                  {a.description.slice(0, 120)}
                  {a.description.length > 120 ? '…' : ''}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ minHeight: 30, fontSize: 12, padding: '0 10px' }}
                  onClick={() => setDetailId(a.id)}
                >
                  Lihat Detail
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ minHeight: 30, fontSize: 12, padding: '0 10px' }}
                  disabled={deleteMut.isPending}
                  onClick={() => deleteMut.mutate(a.id)}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>

      {detailAssignment && (
        <Drawer title={`Detail Penugasan · ${detailAssignment.title}`} onClose={() => setDetailId(null)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge tone="good">
                {detailAssignment.track_label ?? (detailAssignment.track === 'iot' ? 'IoT' : 'Cyber Security')}
              </Badge>
              <Badge tone="muted">{detailAssignment.lab_id}</Badge>
              <Badge tone="warn">Level {detailAssignment.required_level}</Badge>
            </div>
            {detailAssignment.description && (
              <div>
                <strong style={{ fontSize: 13 }}>Deskripsi</strong>
                <p style={{ margin: '4px 0 0', fontSize: 14 }}>{detailAssignment.description}</p>
              </div>
            )}
            {detailAssignment.instructions && (
              <div>
                <strong style={{ fontSize: 13 }}>Instruksi Langkah Pengerjaan</strong>
                <pre
                  style={{
                    margin: '6px 0 0',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    padding: 10,
                    background: 'var(--surface-2)',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                  }}
                >
                  {detailAssignment.instructions}
                </pre>
              </div>
            )}
            {detailAssignment.rubric && detailAssignment.rubric.length > 0 && (
              <div>
                <strong style={{ fontSize: 13 }}>Rubrik Penilaian</strong>
                <ul className="check-list" style={{ marginTop: 6 }}>
                  {detailAssignment.rubric.map((r, i) => (
                    <li key={`${r.criterion}-${i}`}>
                      <span>
                        {r.criterion} — <strong>{r.weight}%</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {detailAssignment.student_details && detailAssignment.student_details.length > 0 && (
              <div>
                <strong style={{ fontSize: 13 }}>Status Pengerjaan Mahasiswa</strong>
                <div className="table-wrap" style={{ marginTop: 6 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Mahasiswa</th>
                        <th>Status</th>
                        <th>Skor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailAssignment.student_details.map((s) => (
                        <tr key={s.user_id}>
                          <td>
                            <div className="strong">{s.name}</div>
                            <small className="subtle-note">{s.email}</small>
                          </td>
                          <td>
                            <Badge tone={s.status === 'Lulus' ? 'good' : s.status === 'Berjalan' ? 'warn' : 'muted'}>
                              {s.status}
                            </Badge>
                          </td>
                          <td>{s.score ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Drawer>
      )}
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

function Bank({
  catalog,
  go,
  actions,
  csrf,
}: {
  catalog: Catalog
  go: (to: string) => void
  actions: React.ReactNode
  csrf: string
}) {
  const [tab, setTab] = useState(() => store.get('ifa-track') ?? catalog.tracks[0].id)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const track = catalog.tracks.find((t) => t.id === tab) ?? catalog.tracks[0]
  const select = (id: string) => {
    setTab(id)
    store.set('ifa-track', id)
  }
  const filteredTrack = {
    ...track,
    exercises: track.exercises.filter((e) => {
      const matchLevel = levelFilter === 'all' || e.level === Number(levelFilter)
      const q = search.trim().toLowerCase()
      const matchText =
        !q ||
        e.title.toLowerCase().includes(q) ||
        (e.owasp ?? '').toLowerCase().includes(q) ||
        (e.tags ?? []).some((t) => t.toLowerCase().includes(q))
      return matchLevel && matchText
    }),
  }
  return (
    <>
      <PageHead
        title="Bank latihan"
        description="Semua level terbuka untuk jalur Cyber Security dan IoT. Kelola bank soal serta impor/ekspor format Moodle LMS."
        actions={actions}
      />
      <MoodleBankPanel
        catalog={catalog}
        csrf={csrf}
        defaultTrack={track.id === 'iot' ? 'iot' : 'web'}
      />
      <TrackTabs
        tracks={catalog.tracks.map((t) => ({ id: t.id, title: t.title, note: `${t.exercises.length} latihan` }))}
        value={track.id}
        onChange={select}
      />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <p className="track-desc" style={{ margin: 0 }}>
          {track.description}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="search"
            aria-label="Cari soal latihan"
            placeholder="Cari judul, OWASP, atau tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              minHeight: 36,
              borderRadius: 8,
              border: '1px solid var(--line-strong)',
              padding: '0 10px',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          />
          <select
            aria-label="Filter level soal"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{
              minHeight: 36,
              borderRadius: 8,
              border: '1px solid var(--line-strong)',
              padding: '0 10px',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          >
            <option value="all">Semua Level</option>
            {catalog.levels.map((l) => (
              <option key={l.level} value={String(l.level)}>
                Level {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <LevelMap catalog={catalog} track={filteredTrack} mode="dosen" go={go} />
    </>
  )
}
