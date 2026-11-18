import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, BookOpen, Clock, Cpu, Lock, Play, Search, Shield, Unlock } from 'lucide-react'
import { Badge, LoadState, PageHead, extractErrorStatus } from '../portal/ui'
import { ErrorView } from '../shared/errors/ErrorView'
import { useI18n } from '../shared/i18n'
import { TrustTopology } from './IotTopology'
import { simApi, type LabSummary, type LevelId } from './api'

const SECURITY_MODE_TAG: Record<LevelId, string> = {
  easy: 'Low · Rentan Langsung',
  medium: 'Medium · Filter Parsial',
  hard: 'High · Celah Halus',
  impossible: 'Impossible · Referensi Aman',
}

export function WebCatalogPage({
  categoryFilter,
  go,
  mode = 'mahasiswa',
  presentationToggle,
}: {
  categoryFilter?: string
  go: (to: string) => void
  mode?: 'mahasiswa' | 'dosen'
  presentationToggle?: React.ReactNode
}) {
  const [searchText, setSearchText] = useState('')
  const [activeCat, setActiveCat] = useState(categoryFilter ?? '')
  const basePath = mode === 'dosen' ? '/lab/dosen' : '/lab'

  const catQ = useQuery({
    queryKey: ['labs-catalog', mode, 'web', activeCat, searchText],
    queryFn: () => simApi.getCatalog({ track: 'web', category: activeCat || undefined, q: searchText || undefined }),
  })

  if (catQ.isLoading || catQ.isError || !catQ.data) {
    return <LoadState error={catQ.isError} onRetry={() => void catQ.refetch()} />
  }

  const { categories, labs, recent_session } = catQ.data
  const totalLevelsPassed = labs.reduce((acc, l) => acc + l.passed_levels, 0)
  const totalLevels = labs.reduce((acc, l) => acc + l.total_levels, 0)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHead
        title="Laboratorium Keamanan Web · OWASP Top 10:2025"
        description={
          mode === 'dosen'
            ? '11 modul OWASP A01–A10 mode simulasi Dosen: seluruh 4 level kesulitan (Low hingga Impossible) terbuka langsung tanpa gamifikasi.'
            : '11 lab interaktif mencakup kategori A01–A10 dengan 4 level kesulitan bertahap (Low hingga Impossible).'
        }
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {presentationToggle}
            {recent_session ? (
              <button type="button" className="btn-primary" onClick={() => go(`${basePath}/sesi/${recent_session.id}`)}>
                <Play size={15} /> Lanjutkan Sesi Terakhir
              </button>
            ) : null}
          </div>
        }
      />

      <div className="sim-catalog-filters">
        <div className="search" style={{ flex: '1 1 260px', maxWidth: 360 }}>
          <Search size={16} />
          <input
            aria-label="Cari modul lab"
            placeholder="Cari modul (IDOR, SQLi, XSS, CWE...)"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="sim-chip-row" role="group" aria-label="Filter kategori OWASP">
          <button
            type="button"
            className="sim-chip"
            aria-pressed={activeCat === ''}
            onClick={() => {
              setActiveCat('')
              go(`${basePath}/web`)
            }}
          >
            Semua (A01–A10)
          </button>
          {categories.map((cat) => (
            <button
              key={cat.code}
              type="button"
              className="sim-chip"
              aria-pressed={activeCat === cat.code}
              onClick={() => {
                setActiveCat(cat.code)
                go(`${basePath}/web/${cat.code}`)
              }}
            >
              {cat.code}
            </button>
          ))}
        </div>
      </div>

      <div className="sim-catalog-layout">
        <div className="sim-lab-grid">
          {labs.map((lab) => (
            <LabCatalogCard
              key={lab.id}
              lab={lab}
              mode={mode}
              onOpen={() => go(`${basePath}/web/${lab.owasp_code ?? 'A01'}/${lab.id}`)}
            />
          ))}
          {labs.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <p className="muted" style={{ margin: 0 }}>
                Tidak ada lab yang cocok dengan filter pencarian saat ini.
              </p>
            </div>
          ) : null}
        </div>

        <aside style={{ display: 'grid', gap: 14 }}>
          <div className="card">
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              {mode === 'dosen' ? 'Cakupan Simulasi Dosen' : 'Cakupan Belajar Web'}
            </h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              {mode === 'dosen'
                ? `${labs.length} modul OWASP siap didemonstrasikan langsung di seluruh level.`
                : `${totalLevelsPassed} dari ${totalLevels} kombinasi level tuntas.`}
            </p>
            {mode !== 'dosen' ? (
              <div className="hbar-track" style={{ marginBottom: 12 }}>
                <div
                  className="hbar-fill"
                  style={{ width: `${totalLevels ? Math.round((totalLevelsPassed / totalLevels) * 100) : 0}%` }}
                />
              </div>
            ) : null}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, fontSize: 12.5 }}>
              {categories.map((c) => (
                <li key={c.code} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>
                    <strong>{c.code}</strong> · {c.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

function LabCatalogCard({
  lab,
  mode = 'mahasiswa',
  onOpen,
}: {
  lab: LabSummary
  mode?: 'mahasiswa' | 'dosen'
  onOpen: () => void
}) {
  return (
    <article className="card sim-lab-card">
      <div style={{ display: 'grid', gap: 8 }}>
        <div className="sim-lab-head">
          <span className="sim-owasp-pill">
            {lab.track === 'iot' ? <Cpu size={13} /> : <Shield size={13} />}
            {lab.owasp_code ?? 'IoT Studio'} · {lab.cwe_id}
          </span>
          <span className="muted" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> {lab.estimated_minutes} mnt
          </span>
        </div>
        <div>
          <h2 style={{ fontSize: 16.5, marginBottom: 4 }}>{lab.title}</h2>
          <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
            {lab.subtitle}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div className="sim-level-dots">
          {lab.levels.map((lv) => {
            const isLocked = mode === 'mahasiswa' && lv.unlocked === false
            return (
              <span
                key={lv.level}
                className={`sim-level-pill ${
                  lv.passed ? 'is-done' : isLocked ? 'is-locked' : lv.active_session_id ? 'is-running' : ''
                }`}
              >
                {isLocked ? <Lock size={11} aria-hidden="true" style={{ marginRight: 3, verticalAlign: '-1px' }} /> : null}
                {lv.label} {lv.passed ? '✓' : isLocked ? '' : lv.active_session_id ? '•' : ''}
              </span>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {mode === 'dosen' ? '4 level siap dijalankan' : `${lab.passed_levels}/${lab.total_levels} level lulus`}
          </span>
          <button type="button" className="btn-primary" style={{ minHeight: 36, fontSize: 13.5 }} onClick={onOpen}>
            Buka Lab <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </article>
  )
}

export function LabDetailPage({
  labId,
  csrf,
  theme,
  go,
  mode = 'mahasiswa',
  presentationToggle,
}: {
  labId: string
  csrf: string
  theme: 'light' | 'dark' | 'system'
  go: (to: string) => void
  mode?: 'mahasiswa' | 'dosen'
  presentationToggle?: React.ReactNode
}) {
  const { lang } = useI18n()
  const basePath = mode === 'dosen' ? '/lab/dosen' : '/lab'
  const detailQ = useQuery({
    queryKey: ['lab-detail', mode, labId],
    queryFn: () => simApi.getLabDetail(labId),
  })

  const startMut = useMutation({
    mutationFn: ({ levelId, forceNew }: { levelId: LevelId; forceNew?: boolean }) =>
      simApi.startSession(csrf, labId, levelId, forceNew),
    onSuccess: (res) => {
      go(`${basePath}/sesi/${res.session_id}`)
    },
  })

  if (detailQ.isLoading) return <LoadState error={false} onRetry={() => void detailQ.refetch()} />
  if (detailQ.isError || !detailQ.data) {
    return (
      <ErrorView
        status={extractErrorStatus(detailQ.error) ?? 404}
        title={lang === 'en' ? 'Lab Module Not Found' : 'Modul Laboratorium Tidak Ditemukan'}
        subtitle={
          lang === 'en'
            ? 'This OWASP or IoT lab module does not exist or is not currently published for your account.'
            : 'Modul laboratorium OWASP atau IoT tidak ditemukan atau belum diterbitkan untuk akun Anda.'
        }
        homeHref={basePath}
        onStayCurrent={() => void detailQ.refetch()}
        onGoHome={() => go(basePath)}
      />
    )
  }

  const lab = detailQ.data
  const showGamification = mode !== 'dosen' && lab.gamification_enabled !== false
  const backPath = lab.track === 'iot' ? `${basePath}/iot` : `${basePath}/web/${lab.owasp_code ?? ''}`

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHead
        title={`${lab.owasp_code ? `${lab.owasp_code} · ` : 'IoT Studio · '}${lab.title}`}
        description={lab.subtitle}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {presentationToggle}
            <button type="button" className="btn-outline" onClick={() => go(backPath)}>
              <ArrowLeft size={15} /> Kembali ke Katalog
            </button>
          </div>
        }
      />

      <div className="sim-workbench">
        <section className="card" style={{ display: 'grid', gap: 10 }}>
          <div className="card-head">
            <div>
              <h2>Tujuan &amp; Konteks Skenario</h2>
              <p>
                {lab.cwe_id} · {lab.wstg_ref} · {lab.asvs_ref}
              </p>
            </div>
            <Badge tone="muted">{lab.estimated_minutes} menit</Badge>
          </div>
          <p style={{ margin: 0 }}>{lab.objective}</p>
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            {lab.context}
          </p>
          <div className="sim-vis-box">
            <strong style={{ fontSize: 13 }}>Aktor &amp; Prasyarat</strong>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {lab.fixture_actors.map((a) => (
                <Badge key={a} tone="muted">
                  {a}
                </Badge>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 12.5 }}>
              Prasyarat: {lab.prerequisite}
            </span>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Peta Trust Boundary</h2>
              <p>Komponen dan batas verifikasi otorisasi pada sistem target.</p>
            </div>
          </div>
          <TrustTopology nodes={lab.trust_nodes} edges={lab.trust_edges} theme={theme} compact />
        </section>
      </div>

      <section className="card" style={{ display: 'grid', gap: 12 }}>
        <div className="card-head">
          <div>
            <h2>Pilih Tingkat Kesulitan (4 Level Bertahap)</h2>
            <p>
              {mode === 'dosen'
                ? 'Mode Dosen: seluruh level dari Low hingga Impossible terbuka langsung tanpa penguncian dan tanpa gamifikasi.'
                : 'Selesaikan tiap tingkat dari Low hingga Impossible untuk membuka tantangan keamanan berikutnya.'}
            </p>
          </div>
          <Badge tone={mode === 'dosen' ? 'info' : 'muted'}>
            {mode === 'dosen' ? (
              <>
                <Unlock size={13} /> Semua Level Terbuka
              </>
            ) : (
              'Mode Levelling Bertahap'
            )}
          </Badge>
        </div>

        <div className="sim-mode-bar" role="group" aria-label="Peta Level Keamanan">
          {lab.levels.map((lv) => {
            const locked = mode !== 'dosen' && lv.unlocked === false
            return (
              <div
                key={`bar-${lv.level}`}
                className={`sim-mode-pill ${lv.passed ? 'is-done' : locked ? 'is-locked' : 'is-open'}`}
              >
                {locked ? <Lock size={13} aria-hidden="true" /> : <Unlock size={13} aria-hidden="true" />}
                <span>{SECURITY_MODE_TAG[lv.level] ?? lv.label}</span>
              </div>
            )
          })}
        </div>

        {startMut.isError ? (
          <div className="card" style={{ borderColor: 'var(--warn)', background: 'var(--warn-soft)', padding: '10px 14px' }}>
            <strong style={{ color: 'var(--warn)', fontSize: 13.5 }}>
              Level belum terbuka. Selesaikan level sebelumnya terlebih dahulu.
            </strong>
          </div>
        ) : null}

        <div className="sim-lab-grid">
          {lab.levels.map((lv) => {
            const locked = mode !== 'dosen' && lv.unlocked === false
            return (
              <div
                key={lv.level}
                className={`sim-vis-box sim-level-card ${locked ? 'is-locked' : ''}`}
                style={{ background: 'var(--surface)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong>
                    {lv.label}
                    {showGamification ? ` · +${lv.xp} XP` : ''}
                  </strong>
                  <Badge tone={lv.passed ? 'good' : locked ? 'muted' : lv.active_session_id ? 'warn' : mode === 'dosen' ? 'info' : 'muted'}>
                    {lv.passed
                      ? `Lulus (${lv.best_score ?? 100})`
                      : locked
                        ? 'Terkunci'
                        : lv.active_session_id
                          ? `Sesi: ${lv.current_step}`
                          : mode === 'dosen'
                            ? 'Terbuka'
                            : 'Belum mulai'}
                  </Badge>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>
                  {SECURITY_MODE_TAG[lv.level] ?? lv.label}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{lv.title}</div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {lv.scenario}
                </p>
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Kontrol awal: {lv.initial_control}</div>
                {locked ? (
                  <div style={{ fontSize: 12, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock size={13} aria-hidden="true" />
                    <span>{lv.unlock_requirement ?? 'Selesaikan level sebelumnya terlebih dahulu.'}</span>
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ minHeight: 36, fontSize: 13.5 }}
                    disabled={locked || startMut.isPending}
                    onClick={() => startMut.mutate({ levelId: lv.level, forceNew: false })}
                  >
                    {locked ? <Lock size={14} /> : <Play size={14} />}
                    {locked ? 'Terkunci' : lv.active_session_id ? 'Lanjutkan Sesi' : 'Mulai Level'}
                  </button>
                  {!locked && lv.active_session_id ? (
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ minHeight: 36, fontSize: 13 }}
                      disabled={startMut.isPending}
                      onClick={() => startMut.mutate({ levelId: lv.level, forceNew: true })}
                    >
                      Mulai Ulang
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export function PanduanPage({ role }: { role: 'mahasiswa' | 'dosen' | 'admin' }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHead
        title="Panduan Etika, Batas Sandbox & Alur Belajar"
        description="Pedoman praktikum keamanan aplikasi web dan sistem IoT secara aman, terstruktur, dan bertanggung jawab."
      />
      <div className="sim-workbench">
        <section className="card" style={{ display: 'grid', gap: 10 }}>
          <div className="card-head">
            <div>
              <h2><BookOpen size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} /> Aturan Keselamatan Praktikum</h2>
            </div>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8, fontSize: 14 }}>
            <li>Semua uji coba eksploitasi hanya dijalankan terhadap state simulator terisolasi milik sesi Anda sendiri.</li>
            <li>Dilarang memindai atau menyerang domain eksternal maupun infrastruktur kampus menggunakan teknik yang dipelajari tanpa izin tertulis.</li>
            <li>Setiap bukti celah wajib diikuti perbaikan kode serta verifikasi Positif, Negatif, dan Regresi agar sistem tetap berfungsi untuk pengguna sah.</li>
          </ul>
        </section>

        <section className="card" style={{ display: 'grid', gap: 10 }}>
          <div className="card-head">
            <div>
              <h2>Alur 5 Tahap Laboratorium ({role === 'dosen' ? 'Panduan Dosen' : 'Panduan Mahasiswa'})</h2>
            </div>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8, fontSize: 14 }}>
            <li><strong>Pahami:</strong> Pelajari peta Trust Boundary dan pilih hipotesis sebelum mengirim request.</li>
            <li><strong>Uji Celah:</strong> Rekam respons baseline yang sah terlebih dahulu, lalu buktikan penyimpangan otorisasi/validasi.</li>
            <li><strong>Perbaiki:</strong> Bandingkan implementasi Rentan vs Perbaikan pada lintas stack dan pilih patch server yang tepat.</li>
            <li><strong>Verifikasi:</strong> Jalankan matriks kasus uji Positif, Negatif, dan Regresi hingga seluruh baris lulus.</li>
            <li>
              <strong>Refleksi:</strong> Tulis akar masalah dan bukti untuk mendapatkan nilai rubrik (ambang lulus 80)
              {role === 'dosen' ? '.' : ' serta XP.'}
            </li>
          </ol>
        </section>
      </div>
    </div>
  )
}
