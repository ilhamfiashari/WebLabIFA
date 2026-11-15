import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Award,
  BookOpen,
  BookOpenCheck,
  Check,
  ClipboardList,
  Cpu,
  Flame,
  History,
  House,
  Lock,
  Play,
  Settings,
  ShieldAlert,
  Star,
  Target,
  Trophy,
} from 'lucide-react'
import type { Identity } from '../api'
import { BarChart, ChartCard, HBarList, LineChart } from '../admin/charts'
import { RANKS, badges, getStudentCatalog, levelName, nextOpen, rankOf, summary, type Catalog } from '../latihan/api'
import { ExercisePlayer, LevelMap } from '../latihan/components'
import { Shell, type NavPage } from '../portal/Shell'
import { store, usePath, useTheme } from '../portal/hooks'
import { Badge, Kpi, LoadState, NavLink, PageHead, SessionCard, TrackTabs } from '../portal/ui'
import { AnimatedMeterRow, AnimatedNumber, AnimatedProgressRing } from '../shared/charts/AnimatedCharts'
import { ErrorView } from '../shared/errors/ErrorView'
import { useI18n } from '../shared/i18n'
import { SecuritySettingsPage } from '../shared/settings/SecuritySettingsPage'
import { IotCatalogPage, LabDetailPage, PanduanPage, WebCatalogPage } from '../simulator/CatalogViews'
import { LeaderboardSection } from '../lecturer/LeaderboardSection'
import { LabWorkspace } from '../simulator/LabWorkspace'
import { simApi, type LevelId, type StudentDashboardResponse, type StudentLeaderboardResponse } from '../simulator/api'

const PAGES: NavPage[] = [
  { key: 'beranda', path: '/lab', label: 'Beranda', icon: House },
  { key: 'web', path: '/lab/web', label: 'Keamanan Web', icon: ShieldAlert },
  { key: 'iot', path: '/lab/iot', label: 'IoT Studio', icon: Cpu },
  { key: 'tugas', path: '/lab/tugas', label: 'Tugas & Nilai', icon: ClipboardList },
  { key: 'progres', path: '/lab/pencapaian', label: 'Pencapaian', icon: Award },
  { key: 'peringkat', path: '/lab/peringkat', label: 'Peringkat', icon: Trophy },
  { key: 'riwayat', path: '/lab/riwayat', label: 'Riwayat', icon: History },
  { key: 'latihan', path: '/lab/latihan', label: 'Latihan', icon: BookOpenCheck },
  { key: 'panduan', path: '/lab/panduan', label: 'Panduan', icon: BookOpen },
  { key: 'pengaturan', path: '/lab/pengaturan', label: 'Pengaturan', icon: Settings },
]

interface Props {
  user: Identity
  onLogout: () => void
  loggingOut: boolean
  onSwitchRole: (role: string) => void
  switching: boolean
  error?: React.ReactNode
}

export function StudentApp(props: Props) {
  const [path, go] = usePath()
  const [theme, setTheme] = useTheme()
  const { tr } = useI18n()

  const pages: NavPage[] = PAGES.map((p) => {
    const labelMap: Record<string, string> = {
      beranda: tr.nav.student.beranda,
      web: tr.nav.student.web,
      iot: tr.nav.student.iot,
      tugas: tr.nav.student.tugas,
      progres: tr.nav.student.progres,
      peringkat: tr.nav.student.peringkat,
      riwayat: tr.nav.student.riwayat,
      latihan: tr.nav.student.latihan,
      panduan: tr.nav.student.panduan,
      pengaturan: tr.nav.student.pengaturan,
    }
    return { ...p, label: labelMap[p.key] ?? p.label }
  })

  const sessionMatch = path.startsWith('/lab/sesi/') ? path.slice('/lab/sesi/'.length).split('/')[0] : null
  const webParts = path.startsWith('/lab/web/') ? path.slice('/lab/web/'.length).split('/').filter(Boolean) : []
  const iotLabId = path.startsWith('/lab/iot/') ? path.slice('/lab/iot/'.length).split('/')[0] : null
  const legacyDetailId = path.startsWith('/lab/latihan/') ? path.slice('/lab/latihan/'.length) : null

  const active =
    path === '/lab'
      ? 'beranda'
      : path.startsWith('/lab/web')
        ? 'web'
        : path.startsWith('/lab/iot')
          ? 'iot'
          : path === '/lab/tugas'
            ? 'tugas'
            : path === '/lab/progres' || path === '/lab/pencapaian'
              ? 'progres'
              : path === '/lab/peringkat'
                ? 'peringkat'
                : path === '/lab/riwayat'
                  ? 'riwayat'
                  : path.startsWith('/lab/panduan')
                    ? 'panduan'
                    : path.startsWith('/lab/pengaturan')
                      ? 'pengaturan'
                      : path.startsWith('/lab/latihan')
                        ? 'latihan'
                        : 'beranda'

  const dashQ = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => simApi.getStudentDashboard(),
    enabled: active === 'beranda' || active === 'tugas' || active === 'progres',
    retry: false,
  })

  const leaderboardQ = useQuery({
    queryKey: ['student-leaderboard'],
    queryFn: () => simApi.getStudentLeaderboard('ALL'),
    enabled: active === 'beranda' || active === 'peringkat' || active === 'progres',
    retry: false,
  })

  const legacyQ = useQuery({
    queryKey: ['latihan', 'mahasiswa'],
    queryFn: getStudentCatalog,
    enabled: active === 'latihan' || path === '/lab/pencapaian' || dashQ.isError,
  })

  const legacyData = legacyQ.data
  const legacyDetail =
    legacyData && legacyDetailId
      ? legacyData.tracks.flatMap((t) => t.exercises.map((e) => ({ track: t, exercise: e }))).find((x) => x.exercise.id === legacyDetailId)
      : undefined

  return (
    <Shell
      {...props}
      pages={pages}
      active={active}
      go={go}
      theme={theme}
      setTheme={setTheme}
      crumb={legacyDetail?.exercise.title}
      accountExtra={(close) => (
        <button type="button" role="menuitem" onClick={() => { close(); go('/lab/pengaturan') }}>
          <Settings size={15} aria-hidden="true" />
          {tr.nav.student.pengaturan}
        </button>
      )}
    >
      {sessionMatch ? (
        <LabWorkspace sessionId={sessionMatch} csrf={props.user.csrf_token} theme={theme} go={go} />
      ) : path.startsWith('/lab/web') ? (
        webParts.length >= 2 ? (
          <LabDetailPage labId={webParts[1]} csrf={props.user.csrf_token} theme={theme} go={go} />
        ) : (
          <WebCatalogPage categoryFilter={webParts[0]} go={go} />
        )
      ) : path.startsWith('/lab/iot') ? (
        iotLabId ? (
          <LabDetailPage labId={iotLabId} csrf={props.user.csrf_token} theme={theme} go={go} />
        ) : (
          <IotCatalogPage go={go} />
        )
      ) : active === 'tugas' ? (
        <StudentAssignmentsPage dashQ={dashQ} csrf={props.user.csrf_token} go={go} />
      ) : active === 'riwayat' ? (
        <StudentHistoryPage go={go} />
      ) : active === 'panduan' ? (
        <PanduanPage role="mahasiswa" />
      ) : active === 'pengaturan' ? (
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <PageHead
            title="Pengaturan Keamanan Akun"
            description="Kelola MFA, Passkeys, Authenticator App (TOTP), Backup Codes, email notifikasi, dan sesi perangkat aktif."
          />
          <SecuritySettingsPage user={props.user} />
        </div>
      ) : path === '/lab/pencapaian' ? (
        dashQ.data ? (
          <StudentProgressPage dashQ={dashQ} go={go} />
        ) : legacyData ? (
          <Achievements catalog={legacyData} go={go} />
        ) : (
          <LoadState error={legacyQ.isError} onRetry={() => void legacyQ.refetch()} />
        )
      ) : active === 'progres' ? (
        <StudentProgressPage dashQ={dashQ} go={go} />
      ) : active === 'peringkat' ? (
        <StudentLeaderboardPage lbQ={leaderboardQ} go={go} />
      ) : active === 'latihan' ? (
        !legacyData ? (
          <LoadState error={legacyQ.isError} onRetry={() => void legacyQ.refetch()} />
        ) : legacyDetailId ? (
          legacyDetail ? (
            <ExercisePlayer
              catalog={legacyData}
              track={legacyDetail.track}
              exercise={legacyDetail.exercise}
              mode="mahasiswa"
              go={go}
              csrf={props.user.csrf_token}
            />
          ) : (
            <NotFound go={go} />
          )
        ) : (
          <Exercises catalog={legacyData} go={go} />
        )
      ) : dashQ.data ? (
        <StudentSimulatorHome
          dash={dashQ.data}
          myRank={leaderboardQ.data?.my_rank ?? null}
          user={props.user}
          csrf={props.user.csrf_token}
          go={go}
        />
      ) : dashQ.isError && legacyData ? (
        <LegacyHome catalog={legacyData} user={props.user} go={go} />
      ) : (
        <>
          <Welcome user={props.user} />
          <LoadState error={dashQ.isError && legacyQ.isError} onRetry={() => void dashQ.refetch()} />
          <SessionCard name={props.user.name} email={props.user.email} role={props.user.role} expiresAt={props.user.expires_at} />
        </>
      )}
    </Shell>
  )
}

function StudentSimulatorHome({
  dash,
  myRank,
  user,
  csrf,
  go,
}: {
  dash: StudentDashboardResponse
  myRank: StudentLeaderboardResponse['my_rank'] | null
  user: Identity
  csrf: string
  go: (to: string) => void
}) {
  const { lang } = useI18n()
  const startMut = useMutation({
    mutationFn: ({ labId, levelId }: { labId: string; levelId: LevelId }) => simApi.startSession(csrf, labId, levelId),
    onSuccess: (res) => go(`/lab/sesi/${res.session_id}`),
  })

  const scorePoints = dash.score_series.map((s) => ({
    label: `${s.lab_id.slice(0, 6)} (${s.date})`,
    value: s.score,
  }))
  const earnedBadges = dash.badges.filter((b) => b.earned).length
  const rank = rankOf(dash.kpis.xp)
  const webDone = dash.owasp_map.reduce((s, c) => s + c.done_levels, 0)
  const webTotal = Math.max(1, dash.owasp_map.reduce((s, c) => s + c.total_levels, 0))

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <PageHead
        title={lang === 'en' ? `Hello, ${user.name.split(/\s+/)[0] || user.name}` : `Halo, ${user.name.split(/\s+/)[0] || user.name}`}
        description={
          lang === 'en'
            ? 'Test vulnerabilities, patch multi-stack code, and verify defenses inside the Web & IoT Security Simulator.'
            : 'Uji celah, perbaiki kode lintas stack, dan verifikasi pertahanan pada Simulator Keamanan Web & IoT.'
        }
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <NavLink to="/lab/web" go={go} className="btn-primary">
              {lang === 'en' ? 'Explore Web Security' : 'Jelajahi Keamanan Web'} <ArrowRight size={15} />
            </NavLink>
            <NavLink to="/lab/iot" go={go} className="btn-outline">
              {lang === 'en' ? 'Open IoT Studio' : 'Buka IoT Studio'}
            </NavLink>
          </div>
        }
      />

      <section className="card sim-dash-hero" aria-label={lang === 'en' ? 'Learning Progress Summary' : 'Ringkasan Progres Belajar'}>
        <AnimatedProgressRing
          value={dash.kpis.levels_passed}
          max={Math.max(1, dash.kpis.levels_total)}
          label={lang === 'en' ? 'Mastery' : 'Ketuntasan'}
          sublabel={`${dash.kpis.levels_passed}/${dash.kpis.levels_total} lvl`}
        />
        <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <span className="rank-kicker">
                {lang === 'en' ? 'Active Security Rank' : 'Peringkat Pentester'}
              </span>
              <h2 style={{ margin: '2px 0' }}>{rank.current.name}</h2>
            </div>
            <Badge tone="info">
              <Award size={13} /> {dash.kpis.xp} XP · {earnedBadges}/{dash.badges.length} {lang === 'en' ? 'badges' : 'lencana'}
            </Badge>
          </div>
          <AnimatedMeterRow
            label={lang === 'en' ? 'XP Toward Next Rank' : 'Progres XP Peringkat'}
            value={rank.next ? dash.kpis.xp - rank.current.min : 100}
            max={rank.next ? Math.max(1, rank.next.min - rank.current.min) : 100}
            tone="brand"
            note={rank.next ? `${dash.kpis.xp}/${rank.next.min} XP → ${rank.next.name}` : 'Max Rank'}
          />
          <AnimatedMeterRow
            label={lang === 'en' ? 'OWASP Top 10:2025 Mastery' : 'Penguasaan OWASP Top 10:2025'}
            value={webDone}
            max={webTotal}
            tone="good"
          />
          <AnimatedMeterRow
            label={lang === 'en' ? 'Class Assignments Passed' : 'Tugas Kelas Lulus'}
            value={dash.kpis.assignments_done}
            max={Math.max(1, dash.kpis.assignments_total)}
            tone="warn"
          />
        </div>
      </section>

      {dash.continue_session ? (
        <section className="card" style={{ borderColor: 'var(--brand)', background: 'var(--brand-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span className="rank-kicker">Lanjutkan Praktikum Terakhir</span>
              <h2 style={{ margin: '2px 0' }}>{dash.continue_session.lab_title}</h2>
              <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
                Level: <strong>{dash.continue_session.level_id}</strong> · Tahap aktif:{' '}
                <strong>{dash.continue_session.current_step}</strong>
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => go(`/lab/sesi/${dash.continue_session!.id}`)}
            >
              <Play size={16} /> Lanjutkan Sesi
            </button>
          </div>
        </section>
      ) : null}

      <div className="kpi-grid">
        <Kpi
          label={lang === 'en' ? 'Labs Completed' : 'Lab Tuntas Penuh'}
          value={
            <>
              <AnimatedNumber value={dash.kpis.labs_completed} /> <small>/ {dash.kpis.labs_total}</small>
            </>
          }
          icon={ShieldAlert}
          note={lang === 'en' ? '4 levels passed per lab' : '4 level lulus per lab'}
        />
        <Kpi
          label={lang === 'en' ? 'Levels Passed' : 'Level Lulus'}
          value={
            <>
              <AnimatedNumber value={dash.kpis.levels_passed} /> <small>/ {dash.kpis.levels_total}</small>
            </>
          }
          icon={Target}
          note={lang === 'en' ? 'Score >= 80 + verified' : 'Skor >= 80 + verifikasi'}
        />
        <Kpi
          label={lang === 'en' ? 'Class Assignments' : 'Tugas Kelas'}
          value={
            <>
              <AnimatedNumber value={dash.kpis.assignments_done} /> <small>/ {dash.kpis.assignments_total}</small>
            </>
          }
          icon={ClipboardList}
          note={lang === 'en' ? 'Active assignments' : 'Penugasan aktif'}
        />
        <Kpi
          label="Total XP"
          value={<AnimatedNumber value={dash.kpis.xp} />}
          icon={Star}
          note={`${earnedBadges}/${dash.badges.length} ${lang === 'en' ? 'badges' : 'lencana'}`}
        />
      </div>

      <div className="grid-2">
        <ChartCard
          title="Aktivitas Penyelesaian 7 Hari"
          subtitle="Jumlah level yang pertama kali lulus per hari"
          columns={['Tanggal', 'Level lulus']}
          rows={dash.activity_series.map((p) => [p.label, String(p.value)])}
        >
          <BarChart data={dash.activity_series} unit="level lulus" labelPrefix="" height={190} />
        </ChartCard>

        <ChartCard
          title="Perkembangan Skor Rubrik"
          subtitle="Riwayat skor sesi praktikum terbaru (0–100)"
          columns={['Sesi', 'Skor']}
          rows={scorePoints.map((p) => [p.label, String(p.value)])}
        >
          {scorePoints.length > 0 ? (
            <LineChart data={scorePoints} unit="skor" height={190} />
          ) : (
            <p className="muted" style={{ fontSize: 13.5 }}>
              Belum ada sesi yang menyelesaikan refleksi dan penilaian rubrik.
            </p>
          )}
        </ChartCard>
      </div>

      <div className="grid-2">
        <section className="card" style={{ display: 'grid', gap: 12 }}>
          <div className="card-head">
            <div>
              <h2>Peta Kompetensi OWASP Top 10:2025</h2>
              <p>Klik kategori untuk menelusuri modul dan membuka level.</p>
            </div>
            <NavLink to="/lab/web" go={go} className="card-link">
              Lihat Katalog
            </NavLink>
          </div>
          <HBarList
            unit="Level tuntas"
            max={8}
            items={dash.owasp_map.map((c) => ({
              label: `${c.code} · ${c.name}`,
              value: c.done_levels,
              note: `${c.done_levels}/${c.total_levels} level · ${c.status}`,
            }))}
          />
        </section>

        <section className="card" style={{ display: 'grid', gap: 12 }}>
          <div className="card-head">
            <div>
              <h2>Tugas &amp; Tenggat Kelas</h2>
              <p>Kerjakan level target sesuai ambang minimal dosen.</p>
            </div>
            <NavLink to="/lab/tugas" go={go} className="card-link">
              Semua Tugas
            </NavLink>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {dash.assignments.map((a) => (
              <div key={a.id} className="sim-vis-box" style={{ background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{a.title}</strong>
                  <Badge tone={a.status === 'Tuntas' ? 'good' : a.status === 'Berjalan' ? 'warn' : 'muted'}>
                    {a.status}
                  </Badge>
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  Lab: <code>{a.lab_id}</code> ({a.required_level}) · Ambang {a.pass_threshold} · Tenggat{' '}
                  {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(a.due_at))}
                </div>
                <div>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ minHeight: 34, fontSize: 13 }}
                    disabled={startMut.isPending}
                    onClick={() =>
                      a.session_id
                        ? go(`/lab/sesi/${a.session_id}`)
                        : startMut.mutate({ labId: a.lab_id, levelId: a.required_level })
                    }
                  >
                    <Play size={13} /> {a.session_id ? 'Lanjutkan Tugas' : 'Mulai Tugas'}
                  </button>
                </div>
              </div>
            ))}
            {dash.assignments.length === 0 ? <p className="muted">Belum ada penugasan aktif.</p> : null}
          </div>
        </section>
      </div>

      <section className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span className="rank-kicker">
            <Trophy size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} aria-hidden="true" />
            {lang === 'en' ? 'Class Leaderboard Standing' : 'Peringkat Kelas Anda'}
          </span>
          <strong style={{ fontSize: 18 }}>
            {myRank?.rank
              ? lang === 'en'
                ? `Rank #${myRank.rank} of ${myRank.total_students} students`
                : `Peringkat #${myRank.rank} dari ${myRank.total_students} mahasiswa`
              : lang === 'en'
                ? 'Leaderboard ready — complete labs to climb ranks'
                : 'Papan peringkat aktif — selesaikan modul untuk naik peringkat'}
          </strong>
          <span className="muted" style={{ fontSize: 13 }}>
            {myRank
              ? `${myRank.xp} XP · ${myRank.levels_passed} ${lang === 'en' ? 'levels passed' : 'level lulus'} · Avg ${Number.isFinite(Number(myRank.avg_score)) ? Number(myRank.avg_score).toFixed(1) : '0.0'}`
              : lang === 'en'
                ? 'Compare XP, badges, and mastery across classes.'
                : 'Lihat posisi XP, jumlah lencana, dan skor rata-rata kelas.'}
          </span>
        </div>
        <NavLink to="/lab/peringkat" go={go} className="btn-outline">
          {lang === 'en' ? 'Open Leaderboard' : 'Lihat Peringkat Kelas'} <ArrowRight size={15} />
        </NavLink>
      </section>

      <SessionCard name={user.name} email={user.email} role={user.role} expiresAt={user.expires_at} />
    </div>
  )
}

function StudentLeaderboardPage({
  lbQ,
  go,
}: {
  lbQ: ReturnType<typeof useQuery<StudentLeaderboardResponse>>
  go: (to: string) => void
}) {
  const { lang } = useI18n()
  if (lbQ.isLoading || lbQ.isError || !lbQ.data) {
    return <LoadState error={lbQ.isError} onRetry={() => void lbQ.refetch()} />
  }
  const lb = lbQ.data
  const avgVal = Number.isFinite(Number(lb.my_rank.avg_score)) ? Number(lb.my_rank.avg_score) : 0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHead
        title={lang === 'en' ? 'Class Leaderboard & Ranking' : 'Peringkat & Leaderboard Kelas'}
        description={
          lang === 'en'
            ? 'Your live standing among enrolled students based on XP, OWASP/IoT level mastery, and rubric scores.'
            : 'Posisi peringkat Anda secara langsung berdasarkan total XP, ketuntasan level OWASP/IoT, dan skor rubrik.'
        }
        actions={
          <NavLink to="/lab/web" go={go} className="btn-outline">
            {lang === 'en' ? 'Practice Modules' : 'Kerjakan Modul'} <ArrowRight size={15} />
          </NavLink>
        }
      />

      <div className="kpi-grid">
        <Kpi
          label={lang === 'en' ? 'Your Rank' : 'Peringkat Anda'}
          value={lb.my_rank.rank ? `#${lb.my_rank.rank}` : '—'}
          icon={Trophy}
          note={
            lang === 'en'
              ? `of ${lb.my_rank.total_students} students`
              : `dari ${lb.my_rank.total_students} mahasiswa`
          }
        />
        <Kpi
          label="Total XP"
          value={<AnimatedNumber value={lb.my_rank.xp} />}
          icon={Star}
          note={`${lb.my_rank.badges_count} ${lang === 'en' ? 'badges' : 'lencana'}`}
        />
        <Kpi
          label={lang === 'en' ? 'Levels Passed' : 'Level Lulus'}
          value={<AnimatedNumber value={lb.my_rank.levels_passed} />}
          icon={Target}
          note="Web & IoT"
        />
        <Kpi
          label={lang === 'en' ? 'Average Score' : 'Rata-rata Skor'}
          value={avgVal > 0 ? avgVal.toFixed(1) : '—'}
          icon={Flame}
          note={lang === 'en' ? 'Graded sessions' : 'Sesi ternilai'}
        />
      </div>

      <LeaderboardSection entries={lb.entries} classes={lb.classes} hide={false} highlightSelf />
    </div>
  )
}

function StudentAssignmentsPage({
  dashQ,
  csrf,
  go,
}: {
  dashQ: ReturnType<typeof useQuery<StudentDashboardResponse>>
  csrf: string
  go: (to: string) => void
}) {
  const startMut = useMutation({
    mutationFn: ({ labId, levelId }: { labId: string; levelId: LevelId }) => simApi.startSession(csrf, labId, levelId),
    onSuccess: (res) => go(`/lab/sesi/${res.session_id}`),
  })

  if (dashQ.isLoading || dashQ.isError || !dashQ.data) {
    return <LoadState error={dashQ.isError} onRetry={() => void dashQ.refetch()} />
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHead title="Tugas Kelas & Status Penilaian" description="Daftar penugasan simulator dari dosen kelas Anda." />
      <section className="card">
        <div className="sim-table-wrap">
          <table className="sim-table">
            <thead>
              <tr>
                <th>Tugas</th>
                <th>Kelas</th>
                <th>Target Lab</th>
                <th>Ambang</th>
                <th>Tenggat</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dashQ.data.assignments.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.title}</strong>
                  </td>
                  <td>{a.class_id}</td>
                  <td>
                    <code>{a.lab_id}</code> · {a.required_level}
                  </td>
                  <td>{a.pass_threshold}</td>
                  <td>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(a.due_at))}</td>
                  <td>
                    <Badge tone={a.status === 'Tuntas' ? 'good' : a.status === 'Berjalan' ? 'warn' : 'muted'}>
                      {a.status}
                    </Badge>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ minHeight: 34, fontSize: 13 }}
                      disabled={startMut.isPending}
                      onClick={() =>
                        a.session_id
                          ? go(`/lab/sesi/${a.session_id}`)
                          : startMut.mutate({ labId: a.lab_id, levelId: a.required_level })
                      }
                    >
                      {a.session_id ? 'Buka Sesi' : 'Mulai'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StudentProgressPage({
  dashQ,
  go,
}: {
  dashQ: ReturnType<typeof useQuery<StudentDashboardResponse>>
  go: (to: string) => void
}) {
  if (dashQ.isLoading || dashQ.isError || !dashQ.data) {
    return <LoadState error={dashQ.isError} onRetry={() => void dashQ.refetch()} />
  }
  const dash = dashQ.data

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHead
        title="Progres & Lencana Kompetensi"
        description="XP dan lencana dihitung otomatis dan idempoten saat modul lulus verifikasi serta refleksi."
        actions={
          <NavLink to="/lab/pencapaian" go={go} className="btn-outline">
            Lihat Pencapaian Latihan
          </NavLink>
        }
      />

      <section className="section">
        <h2 className="section-title">Lencana Simulator ({dash.badges.filter((b) => b.earned).length}/{dash.badges.length})</h2>
        <ul className="badge-grid">
          {dash.badges.map((b) => (
            <li key={b.id} className={`badge-card ${b.earned ? 'is-earned' : ''}`}>
              <span className="badge-icon" aria-hidden="true">
                {b.earned ? <Award size={22} /> : <Lock size={18} />}
              </span>
              <div>
                <p className="strong">{b.title}</p>
                <small>{b.detail}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Penguasaan Kategori OWASP A01–A10</h2>
          </div>
        </div>
        <HBarList
          unit="Level tuntas"
          max={8}
          items={dash.owasp_map.map((c) => ({
            label: `${c.code} · ${c.name}`,
            value: c.done_levels,
            note: `${c.done_levels}/${c.total_levels} level · ${c.status}`,
          }))}
        />
      </section>
    </div>
  )
}

function StudentHistoryPage({ go }: { go: (to: string) => void }) {
  const histQ = useQuery({
    queryKey: ['student-history'],
    queryFn: () => simApi.getStudentHistory(),
  })

  if (histQ.isLoading || histQ.isError || !histQ.data) {
    return <LoadState error={histQ.isError} onRetry={() => void histQ.refetch()} />
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHead
        title="Riwayat Sesi Praktikum"
        description="Log percobaan simulator, patch terpilih, skor rubrik, dan status kelulusan."
      />
      <section className="card">
        <div className="sim-table-wrap">
          <table className="sim-table">
            <thead>
              <tr>
                <th>Modul Lab</th>
                <th>Level</th>
                <th>Tahap</th>
                <th>Patch</th>
                <th>Skor</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {histQ.data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.lab_title}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {item.owasp_code ?? 'IoT Studio'}
                    </div>
                  </td>
                  <td>{item.level_id}</td>
                  <td>{item.current_step}</td>
                  <td>
                    <code>{item.selected_patch ?? '-'}</code>
                  </td>
                  <td>{item.score ?? '-'}</td>
                  <td>
                    <Badge tone={item.passed ? 'good' : 'warn'}>{item.passed ? 'Lulus' : 'Berjalan'}</Badge>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ minHeight: 32, fontSize: 12.5 }}
                      onClick={() => go(`/lab/sesi/${item.id}`)}
                    >
                      Buka
                    </button>
                  </td>
                </tr>
              ))}
              {histQ.data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    Belum ada riwayat sesi simulator. Mulai dari Keamanan Web atau IoT Studio.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Welcome({ user }: { user: Identity }) {
  return (
    <PageHead
      title={`Halo, ${user.name.split(/\s+/)[0] || user.name}`}
      description="Kerjakan latihan berurutan, kumpulkan XP, dan buka level berikutnya."
    />
  )
}

function RankCard({ catalog }: { catalog: Catalog }) {
  const s = summary(catalog)
  const { current, next } = rankOf(s.xp)
  const pct = next ? Math.round(((s.xp - current.min) / (next.min - current.min)) * 100) : 100
  return (
    <section className="card rank-card" aria-labelledby="rank-title">
      <div className="rank-emblem" aria-hidden="true">
        <Award size={30} />
      </div>
      <div className="rank-body">
        <p className="rank-kicker">Peringkat Anda</p>
        <h2 id="rank-title">{current.name}</h2>
        <div
          className="xp-bar"
          role="progressbar"
          aria-valuemin={current.min}
          aria-valuemax={next?.min ?? s.xp}
          aria-valuenow={s.xp}
          aria-label="XP menuju peringkat berikutnya"
        >
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="rank-note">
          <strong>{s.xp} XP</strong>
          {next ? ` · ${next.min - s.xp} XP lagi menuju ${next.name}` : ' · peringkat tertinggi tercapai'}
        </p>
      </div>
    </section>
  )
}

function LegacyHome({ catalog, user, go }: { catalog: Catalog; user: Identity; go: (to: string) => void }) {
  const s = summary(catalog)
  const earned = badges(catalog).filter((b) => b.earned).length
  return (
    <>
      <Welcome user={user} />
      <div className="home-top">
        <RankCard catalog={catalog} />
        <div className="kpi-grid compact-kpi">
          <Kpi label="XP" value={s.xp} icon={Star} note={`dari ${s.maxXp} XP`} />
          <Kpi
            label="Latihan selesai"
            value={
              <>
                {s.completed} <small>/ {s.total}</small>
              </>
            }
            icon={Check}
          />
          <Kpi label="Tepat pertama" value={s.firstTry} icon={Target} note="Tanpa petunjuk" />
          <Kpi
            label="Lencana"
            value={
              <>
                {earned} <small>/ {badges(catalog).length}</small>
              </>
            }
            icon={Trophy}
          />
        </div>
      </div>
      <section className="section" aria-labelledby="continue-title">
        <h2 id="continue-title" className="section-title">
          Lanjutkan belajar
        </h2>
        <div className="grid-2">
          {catalog.tracks.map((t) => {
            const done = t.exercises.filter((e) => e.status === 'selesai').length
            const next = nextOpen(t)
            return (
              <article key={t.id} className="card track-card">
                <header>
                  <h3>{t.title}</h3>
                  <span className="track-count">
                    {done}/{t.exercises.length}
                  </span>
                </header>
                <p>{t.description}</p>
                <div className="level-dots" aria-label={`Progres level ${t.title}`}>
                  {catalog.levels.map((l) => {
                    const list = t.exercises.filter((e) => e.level === l.level)
                    const d = list.filter((e) => e.status === 'selesai').length
                    const locked = list.every((e) => e.status === 'terkunci')
                    return (
                      <div key={l.level} className={`level-dot ${d === list.length ? 'is-done' : locked ? 'is-locked' : 'is-open'}`}>
                        <span>{locked ? <Lock size={12} aria-hidden="true" /> : d === list.length ? <Check size={12} aria-hidden="true" /> : `${d}/${list.length}`}</span>
                        <small>{l.name}</small>
                      </div>
                    )
                  })}
                </div>
                {next ? (
                  <NavLink to={`/lab/latihan/${next.id}`} go={go} className="btn-primary">
                    Lanjutkan: {next.title}
                    <ArrowRight size={16} aria-hidden="true" />
                  </NavLink>
                ) : (
                  <p className="track-done">
                    <Trophy size={16} aria-hidden="true" />
                    Jalur tuntas. Hebat!
                  </p>
                )}
              </article>
            )
          })}
        </div>
      </section>
      <SessionCard name={user.name} email={user.email} role={user.role} expiresAt={user.expires_at} />
    </>
  )
}

function Exercises({ catalog, go }: { catalog: Catalog; go: (to: string) => void }) {
  const [tab, setTab] = useState(() => store.get('ifa-track') ?? catalog.tracks[0].id)
  const track = catalog.tracks.find((t) => t.id === tab) ?? catalog.tracks[0]
  const select = (id: string) => {
    setTab(id)
    store.set('ifa-track', id)
  }
  const s = summary(catalog)
  return (
    <>
      <PageHead
        title="Latihan"
        description="Selesaikan setiap langkah secara berurutan. Level Menengah, Sulit, dan Ahli terbuka setelah level sebelumnya tuntas."
        actions={
          <span className="xp-pill">
            <Flame size={16} aria-hidden="true" />
            {s.xp} XP
          </span>
        }
      />
      <TrackTabs
        tracks={catalog.tracks.map((t) => ({
          id: t.id,
          title: t.title,
          note: `${t.exercises.filter((e) => e.status === 'selesai').length}/${t.exercises.length} selesai`,
        }))}
        value={track.id}
        onChange={select}
      />
      <p className="track-desc">{track.description}</p>
      <LevelMap catalog={catalog} track={track} mode="mahasiswa" go={go} />
    </>
  )
}

function Achievements({ catalog, go }: { catalog: Catalog; go: (to: string) => void }) {
  const s = summary(catalog)
  const list = badges(catalog)
  const done = catalog.tracks.flatMap((t) => t.exercises.filter((e) => e.status === 'selesai').map((e) => ({ t, e })))
  return (
    <>
      <PageHead title="Pencapaian" description="XP, peringkat, dan lencana dihitung dari latihan yang tersimpan di server." />
      <div className="grid-2">
        <RankCard catalog={catalog} />
        <section className="card" aria-labelledby="ladder-title">
          <header className="card-head">
            <div>
              <h2 id="ladder-title">Tangga peringkat</h2>
            </div>
          </header>
          <ol className="ladder">
            {RANKS.map((r) => (
              <li key={r.name} className={s.xp >= r.min ? 'is-reached' : ''}>
                <span aria-hidden="true">{s.xp >= r.min ? <Check size={14} /> : <Lock size={12} />}</span>
                <strong>{r.name}</strong>
                <small>{r.min} XP</small>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <section className="section" aria-labelledby="badge-title">
        <h2 id="badge-title" className="section-title">
          Lencana{' '}
          <small>
            {list.filter((b) => b.earned).length} dari {list.length}
          </small>
        </h2>
        <ul className="badge-grid">
          {list.map((b) => (
            <li key={b.id} className={`badge-card ${b.earned ? 'is-earned' : ''}`}>
              <span className="badge-icon" aria-hidden="true">
                {b.earned ? <Award size={22} /> : <Lock size={18} />}
              </span>
              <div>
                <p className="strong">{b.title}</p>
                <small>{b.detail}</small>
              </div>
              <span className="sr-only">{b.earned ? 'Diperoleh' : 'Belum diperoleh'}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card table-card" aria-labelledby="history-title">
        <header className="table-head">
          <h2 id="history-title">Riwayat latihan</h2>
        </header>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Latihan</th>
                <th scope="col">Jalur</th>
                <th scope="col">Level</th>
                <th scope="col" className="num">
                  Percobaan
                </th>
                <th scope="col">Petunjuk</th>
                <th scope="col" className="num">
                  XP
                </th>
              </tr>
            </thead>
            <tbody>
              {done.map(({ t, e }) => (
                <tr key={e.id}>
                  <td>
                    <NavLink to={`/lab/latihan/${e.id}`} go={go} className="table-link">
                      {e.title}
                    </NavLink>
                  </td>
                  <td>{t.title}</td>
                  <td>{levelName(catalog, e.level)}</td>
                  <td className="num">{e.progress?.attempts ?? 0}</td>
                  <td>{e.progress?.hint_used ? 'Ya' : 'Tidak'}</td>
                  <td className="num">+{e.progress?.earned ?? 0}</td>
                </tr>
              ))}
              {!done.length && (
                <tr>
                  <td colSpan={6} className="empty">
                    Belum ada latihan yang selesai. Mulai dari level Mudah.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function NotFound({ go }: { go: (to: string) => void }) {
  return (
    <ErrorView
      status={404}
      title="Latihan Tidak Ditemukan"
      subtitle="Latihan yang Anda buka tidak tersedia di katalog."
      homeHref="/lab"
      onStayCurrent={() => go('/lab/latihan')}
      onGoHome={() => go('/lab')}
    />
  )
}
