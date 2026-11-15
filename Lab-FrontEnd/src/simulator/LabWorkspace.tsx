import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Code2,
  FlaskConical,
  HelpCircle,
  RotateCcw,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { Badge, LoadState, PageHead, extractErrorStatus } from '../portal/ui'
import { ErrorView } from '../shared/errors/ErrorView'
import { useI18n } from '../shared/i18n'
import { TrustTopology } from './IotTopology'
import { ProbeConsole } from './Visualizers'
import { VisualScenarioPanel } from './VisualScenarios'
import {
  simApi,
  type ProbeInput,
  type ProbeOutcome,
  type RubricBreakdown,
  type StepId,
  type VerificationReport,
} from './api'

const STEPS: Array<{ id: StepId; num: number; label: string; sub: string }> = [
  { id: 'pahami', num: 1, label: 'Pahami', sub: 'Batas Kepercayaan & Hipotesis' },
  { id: 'uji', num: 2, label: 'Uji Celah', sub: 'Baseline & Bukti Eksploitasi' },
  { id: 'perbaiki', num: 3, label: 'Perbaiki', sub: 'Diagnosis & Patch Kode' },
  { id: 'verifikasi', num: 4, label: 'Verifikasi', sub: 'Matriks Positif / Negatif / Regresi' },
  { id: 'refleksi', num: 5, label: 'Refleksi', sub: 'Rubrik, Ringkasan & XP' },
]

function CodeLines({ code }: { code: string }) {
  const lines = code.split('\n')
  return (
    <div className="sim-code-lines">
      {lines.map((line, i) => (
        <div key={i} className="sim-code-line">
          <span className="sim-line-no">{i + 1}</span>
          <span>{line || ' '}</span>
        </div>
      ))}
    </div>
  )
}

export function LabWorkspace({
  sessionId,
  csrf,
  theme,
  go,
  mode = 'mahasiswa',
  hideAnswers = false,
  presentationToggle,
}: {
  sessionId: string
  csrf: string
  theme: 'light' | 'dark' | 'system'
  go: (to: string) => void
  mode?: 'mahasiswa' | 'dosen'
  hideAnswers?: boolean
  presentationToggle?: React.ReactNode
}) {
  const { lang } = useI18n()
  const basePath = mode === 'dosen' ? '/lab/dosen' : '/lab'
  const qc = useQueryClient()
  const sessionQ = useQuery({
    queryKey: ['sim-session', sessionId],
    queryFn: () => simApi.getSession(sessionId),
  })

  const [lastOutcome, setLastOutcome] = useState<ProbeOutcome | null>(null)
  const [inspectorTab, setInspectorTab] = useState<'response' | 'request' | 'timeline'>('response')
  const [stackIdx, setStackIdx] = useState(0)
  const [verifyReport, setVerifyReport] = useState<VerificationReport | null>(null)
  const [reflectResult, setReflectResult] = useState<{
    rubric: RubricBreakdown
    xp_awarded_now: number
    badges_unlocked_now: string[]
    official_summary: string | null
    key_takeaways: string[] | null
  } | null>(null)
  const [hypothesisChoice, setHypothesisDraft] = useState<string | null>(null)
  const [diagnosisChoice, setDiagnosisDraft] = useState<string | null>(null)
  const [patchChoice, setPatchDraft] = useState<string | null>(null)
  const [rootCauseDraft, setRootCause] = useState<string | null>(null)
  const [evidenceDraft, setEvidenceText] = useState<string | null>(null)
  const [transferDraft, setTransferText] = useState<string | null>(null)
  const [showResetModal, setShowResetModal] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const sessionRow = sessionQ.data?.session
  const labRow = sessionQ.data?.lab
  const hypothesisDraft = hypothesisChoice ?? sessionRow?.hypothesis ?? ''
  const diagnosisDraft = diagnosisChoice ?? sessionRow?.diagnosis ?? ''
  const patchDraft = patchChoice ?? sessionRow?.selected_patch ?? ''
  const rootCause = rootCauseDraft ?? sessionRow?.reflection?.root_cause ?? ''
  const evidenceText = evidenceDraft ?? sessionRow?.reflection?.evidence ?? ''
  const transferText = transferDraft ?? sessionRow?.reflection?.transfer ?? ''

  const savedVerifyReport: VerificationReport | null =
    sessionRow && Array.isArray(sessionRow.verification) && sessionRow.verification.length > 0
      ? {
          rows: sessionRow.verification,
          passed_count: sessionRow.verification.filter((r) => r.passed).length,
          total_count: sessionRow.verification.length,
          all_passed: sessionRow.verification.every((r) => r.passed),
        }
      : null
  const activeVerifyReport = verifyReport ?? savedVerifyReport

  const activeReflectResult =
    reflectResult ??
    (sessionRow?.reflection?.rubric && labRow
      ? {
          rubric: sessionRow.reflection.rubric,
          xp_awarded_now: 0,
          badges_unlocked_now: [],
          official_summary: labRow.reflection_spec.official_summary,
          key_takeaways: labRow.reflection_spec.key_takeaways,
        }
      : null)

  const stepMut = useMutation({
    mutationFn: (body: {
      current_step?: StepId
      hypothesis?: string
      diagnosis?: string
      selected_patch?: string
    }) => {
      if (!sessionQ.data) throw new Error('Sesi belum siap')
      return simApi.updateStep(csrf, sessionId, {
        row_version: sessionQ.data.session.row_version,
        ...body,
      })
    },
    onSuccess: async () => {
      setActionError(null)
      await qc.invalidateQueries({ queryKey: ['sim-session', sessionId] })
    },
    onError: async () => {
      setActionError('Gagal menyimpan langkah. Memuat ulang status terbaru sesi...')
      await qc.invalidateQueries({ queryKey: ['sim-session', sessionId] })
    },
  })

  const probeMut = useMutation({
    mutationFn: (input: ProbeInput) => {
      if (!sessionQ.data) throw new Error('Sesi belum siap')
      return simApi.probe(csrf, sessionId, sessionQ.data.session.row_version, input)
    },
    onSuccess: async (res) => {
      setActionError(null)
      setLastOutcome(res.outcome)
      setInspectorTab('response')
      await qc.invalidateQueries({ queryKey: ['sim-session', sessionId] })
    },
    onError: async () => {
      setActionError('Simulasi gagal dieksekusi (kemungkinan versi sesi berubah). Sinkronisasi ulang...')
      await qc.invalidateQueries({ queryKey: ['sim-session', sessionId] })
    },
  })

  const hintMut = useMutation({
    mutationFn: () => {
      if (!sessionQ.data) throw new Error('Sesi belum siap')
      return simApi.unlockHint(csrf, sessionId, sessionQ.data.session.row_version)
    },
    onSuccess: async () => {
      setActionError(null)
      await qc.invalidateQueries({ queryKey: ['sim-session', sessionId] })
    },
  })

  const verifyMut = useMutation({
    mutationFn: () => {
      if (!sessionQ.data) throw new Error('Sesi belum siap')
      return simApi.verify(csrf, sessionId, sessionQ.data.session.row_version)
    },
    onSuccess: async (res) => {
      setActionError(null)
      setVerifyReport(res.report)
      await qc.invalidateQueries({ queryKey: ['sim-session', sessionId] })
    },
  })

  const reflectMut = useMutation({
    mutationFn: () => {
      if (!sessionQ.data) throw new Error('Sesi belum siap')
      return simApi.reflect(csrf, sessionId, {
        row_version: sessionQ.data.session.row_version,
        root_cause: rootCause,
        evidence: evidenceText,
        transfer: transferText,
      })
    },
    onSuccess: async (res) => {
      setActionError(null)
      setReflectResult(res)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['sim-session', sessionId] }),
        qc.invalidateQueries({ queryKey: ['student-dashboard'] }),
        qc.invalidateQueries({ queryKey: ['labs-catalog'] }),
      ])
    },
  })

  const resetMut = useMutation({
    mutationFn: () => {
      if (!sessionQ.data) throw new Error('Sesi belum siap')
      return simApi.resetSession(csrf, sessionId, sessionQ.data.session.row_version)
    },
    onSuccess: async () => {
      setShowResetModal(false)
      setLastOutcome(null)
      setVerifyReport(null)
      setReflectResult(null)
      setHypothesisDraft(null)
      setDiagnosisDraft(null)
      setPatchDraft(null)
      await qc.invalidateQueries({ queryKey: ['sim-session', sessionId] })
    },
  })

  if (sessionQ.isLoading) return <LoadState error={false} onRetry={() => void sessionQ.refetch()} />
  if (sessionQ.isError || !sessionQ.data) {
    const status = extractErrorStatus(sessionQ.error) ?? 404
    return (
      <ErrorView
        status={status}
        title={
          status === 403
            ? lang === 'en'
              ? 'Session Access Denied'
              : 'Akses Sesi Ditolak'
            : lang === 'en'
              ? 'Lab Session Not Found'
              : 'Sesi Praktikum Tidak Ditemukan'
        }
        subtitle={
          lang === 'en'
            ? 'The lab session does not exist or your account does not have permission to inspect it.'
            : 'Sesi praktikum tidak ditemukan atau akun Anda tidak memiliki izin untuk membuka sesi ini.'
        }
        homeHref={basePath}
        onStayCurrent={() => void sessionQ.refetch()}
        onGoHome={() => go(basePath)}
      />
    )
  }

  const { session, lab } = sessionQ.data
  const showGamification = mode !== 'dosen' && session.gamification_enabled !== false
  const activeStep = session.current_step
  const isImpossible = session.level_id === 'impossible'
  const currentStack = lab.code_stacks[stackIdx] ?? lab.code_stacks[0]
  const backUrl = lab.track === 'iot' ? `${basePath}/iot/${lab.id}` : `${basePath}/web/${lab.owasp_code ?? 'A01'}/${lab.id}`

  const stepDoneMap: Record<StepId, boolean> = {
    pahami: Boolean(session.hypothesis),
    uji: session.baseline_recorded && (isImpossible || session.exploit_proved),
    perbaiki: Boolean(session.selected_patch && session.diagnosis),
    verifikasi: session.verification_passed,
    refleksi: session.reflection_submitted && session.passed,
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHead
        title={`${lab.owasp_code ? `${lab.owasp_code} · ` : 'IoT · '}${lab.title}`}
        description={
          showGamification
            ? `${session.level_label} (${lab.cwe_id}) · Hadiah +${session.xp_reward} XP`
            : `${session.level_label} (${lab.cwe_id}) · Mode Simulasi Dosen`
        }
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {presentationToggle}
            <Badge tone={session.passed ? 'good' : 'muted'}>
              {session.passed ? `Lulus · Skor ${session.score ?? 100}` : `Tahap: ${activeStep}`}
            </Badge>
            <button type="button" className="btn-outline" onClick={() => setShowResetModal(true)}>
              <RotateCcw size={15} /> Reset Sesi
            </button>
            <button type="button" className="btn-outline" onClick={() => go(backUrl)}>
              <ArrowLeft size={15} /> Detail Lab
            </button>
          </div>
        }
      />

      {actionError ? (
        <div className="card" style={{ borderColor: 'var(--warn)', background: 'var(--warn-soft)', padding: '12px 16px' }}>
          <strong style={{ color: 'var(--warn)' }}>{actionError}</strong>
        </div>
      ) : null}

      {/* 5-Stage Stepper */}
      <nav className="sim-stepper" aria-label="Tahap Praktikum">
        {STEPS.map((st) => {
          const isCurrent = st.id === activeStep
          const isDone = stepDoneMap[st.id]
          return (
            <button
              key={st.id}
              type="button"
              className={`sim-step-btn ${isCurrent ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
              disabled={stepMut.isPending}
              onClick={() => stepMut.mutate({ current_step: st.id })}
            >
              <span className="sim-step-num">{isDone ? '✓' : st.num}</span>
              <span className="sim-step-text">
                <strong>{st.label}</strong>
                <span>{st.id === 'refleksi' && !showGamification ? 'Rubrik & Ringkasan Pembahasan' : st.sub}</span>
              </span>
            </button>
          )
        })}
      </nav>

      {/* TAHAP 1: PAHAMI */}
      {activeStep === 'pahami' ? (
        <div className="sim-workbench">
          <div className="sim-pane">
            <section className="card">
              <div className="card-head">
                <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                  <h2>{lang === 'en' ? '1. Understand Scenario & Trust Boundary' : '1. Pahami Skenario & Batas Kepercayaan'}</h2>
                  <p>{lab.level_spec.title}</p>
                </div>
                <Badge tone="muted">{lab.level_spec.initial_control}</Badge>
              </div>
              <p style={{ marginTop: 0 }}>{lab.context}</p>
              <div className="sim-vis-box" style={{ background: 'var(--brand-soft)', borderColor: 'var(--brand)' }}>
                <strong style={{ fontSize: 13 }}>
                  {lang === 'en' ? 'Learning Guide & Target Objective' : 'Penjelasan Pembelajaran & Arahan Praktikum'}
                </strong>
                <p style={{ margin: 0, fontSize: 13.5 }}>{lab.objective}</p>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {lang === 'en'
                    ? 'Guide: (1) Predict where the security check is missing below, (2) Send a normal & attack request in Step 2, (3) Choose the safe code fix in Step 3.'
                    : 'Arahan: (1) Pilih dugaan letak celah keamanan di kanan, (2) Uji permintaan normal lalu serangan di Tahap 2, (3) Terapkan patch aman di Tahap 3.'}
                </span>
              </div>
              <div className="sim-vis-box">
                <strong style={{ fontSize: 13 }}>Skenario Level {session.level_label}</strong>
                <p style={{ margin: 0, fontSize: 13.5 }}>{lab.level_spec.scenario}</p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12.5 }}>
                  <span>
                    <strong>Baseline diharapkan:</strong> {lab.level_spec.expected_baseline}
                  </span>
                  <span>
                    <strong>Celah diuji:</strong> {lab.level_spec.expected_exploit}
                  </span>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Arsitektur Trust Boundary</h2>
                  <p>Alur permintaan melewati titik kontrol keamanan sebelum menyentuh aset/aktuator.</p>
                </div>
              </div>
              <TrustTopology
                nodes={lab.trust_nodes}
                edges={lab.trust_edges}
                exploitProved={session.exploit_proved}
                pumpState={String(session.state.pump ?? '') || null}
                activeVersion={String(session.state.active_version ?? '') || null}
                theme={theme}
                compact
              />
            </section>

            <VisualScenarioPanel
              labId={lab.id}
              owaspCode={lab.owasp_code}
              track={lab.track}
              levelLabel={session.level_label}
              state={session.state}
              exploitProved={session.exploit_proved}
              baselineRecorded={session.baseline_recorded}
              lastOutcome={lastOutcome}
            />
          </div>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Hipotesis Awal</h2>
                <p>{lab.level_spec.pahami_prompt}</p>
              </div>
            </div>
            <div className="sim-vis-box" style={{ marginBottom: 10 }}>
              <strong style={{ fontSize: 12.5 }}>
                {lang === 'en' ? 'Question Intent (Why We Ask This)' : 'Maksud Pertanyaan'}
              </strong>
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                {lang === 'en'
                  ? 'Identify which trust boundary or validation check fails before reaching the asset so your exploit test targets the exact weakness.'
                  : 'Pertanyaan ini melatih Anda menemukan titik kontrol mana yang gagal memverifikasi input/otorisasi sebelum menyentuh data atau aktuator.'}
              </p>
            </div>
            {(session.hypothesis !== null || (!showGamification && !hideAnswers)) &&
            lab.level_spec.correct_hypothesis !== null ? (
              <div
                className="sim-vis-box"
                style={{
                  marginBottom: 10,
                  borderColor:
                    session.hypothesis === String(lab.level_spec.correct_hypothesis) ? 'var(--good)' : 'var(--brand)',
                  background:
                    session.hypothesis === String(lab.level_spec.correct_hypothesis) ? 'var(--good-soft)' : 'var(--brand-soft)',
                }}
              >
                <strong style={{ fontSize: 13 }}>
                  {session.hypothesis !== null
                    ? session.hypothesis === String(lab.level_spec.correct_hypothesis)
                      ? '✓ Penjelasan Jawaban: Hipotesis Anda Tepat'
                      : 'ℹ Penjelasan Jawaban & Arah Benar'
                    : 'ℹ Kunci & Penjelasan Hipotesis (Mode Dosen)'}
                </strong>
                <p style={{ margin: 0, fontSize: 13 }}>
                  <strong>Jawaban tepat:</strong>{' '}
                  {lab.level_spec.hypothesis_options[lab.level_spec.correct_hypothesis]}
                </p>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  Alasan: {lab.level_spec.expected_exploit} (Standar acuan: {lab.cwe_id} · {lab.wstg_ref}).
                </span>
              </div>
            ) : null}
            <div style={{ display: 'grid', gap: 10 }}>
              {lab.level_spec.hypothesis_options.map((opt, idx) => {
                const picked = hypothesisDraft === String(idx)
                return (
                  <label key={idx} className={`sim-radio-card ${picked ? 'is-picked' : ''}`}>
                    <input
                      type="radio"
                      name="hypothesis"
                      checked={picked}
                      onChange={() => setHypothesisDraft(String(idx))}
                    />
                    <span style={{ fontSize: 14 }}>{opt}</span>
                  </label>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                type="button"
                className="btn-primary"
                disabled={hypothesisDraft === '' || stepMut.isPending}
                onClick={() =>
                  stepMut.mutate({
                    hypothesis: hypothesisDraft,
                    current_step: 'uji',
                  })
                }
              >
                Simpan Hipotesis &amp; Lanjut Uji Celah <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {/* TAHAP 2: UJI CELAH */}
      {activeStep === 'uji' ? (
        <div className="sim-workbench">
          <div className="sim-pane">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>2. Konsol Pengujian Simulator</h2>
                  <p>{lab.level_spec.probe_instruction}</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Badge tone={session.baseline_recorded ? 'good' : 'muted'}>
                    Baseline {session.baseline_recorded ? '✓' : 'Belum'}
                  </Badge>
                  <Badge tone={session.exploit_proved ? 'good' : isImpossible ? 'muted' : 'warn'}>
                    {isImpossible
                      ? 'Mode Audit Pertahanan'
                      : session.exploit_proved
                        ? 'Celah Terbukti ✓'
                        : 'Celah Belum Terbukti'}
                  </Badge>
                </div>
              </div>

              <ProbeConsole
                labId={lab.id}
                sessionState={session.state}
                outcome={lastOutcome}
                busy={probeMut.isPending}
                onProbe={(inp) => probeMut.mutate(inp)}
              />
            </section>

            {/* Progressive Hints */}
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Petunjuk Bertingkat ({session.hints_opened}/{lab.total_hints})</h2>
                  <p>Gunakan petunjuk bila buntu; membuka petunjuk tidak menggagalkan kelulusan.</p>
                </div>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={hintMut.isPending || session.hints_opened >= lab.total_hints}
                  onClick={() => hintMut.mutate()}
                >
                  <HelpCircle size={15} />
                  {session.hints_opened >= lab.total_hints ? 'Semua Petunjuk Terbuka' : 'Buka Petunjuk Berikutnya'}
                </button>
              </div>
              {lab.unlocked_hints.length > 0 ? (
                <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
                  {lab.unlocked_hints.map((h, i) => (
                    <li key={i} style={{ fontSize: 13.5 }}>
                      {h}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  Belum ada petunjuk yang dibuka pada sesi ini.
                </p>
              )}
            </section>
          </div>

          {/* Right Pane: HTTP Inspector & Security Trace */}
          <div className="sim-pane">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Inspektor HTTP &amp; Security Trace</h2>
                  <p>Bandingkan permintaan keluar, respons server, dan jejak keputusan kontrol.</p>
                </div>
                {lastOutcome ? (
                  <Badge tone={lastOutcome.response.status >= 400 ? 'warn' : lastOutcome.exploit_proved ? 'bad' : 'good'}>
                    HTTP {lastOutcome.response.status} {lastOutcome.response.status_text}
                  </Badge>
                ) : null}
              </div>

              <div className="sim-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className="sim-tab"
                  aria-selected={inspectorTab === 'response'}
                  onClick={() => setInspectorTab('response')}
                >
                  Response
                </button>
                <button
                  type="button"
                  role="tab"
                  className="sim-tab"
                  aria-selected={inspectorTab === 'request'}
                  onClick={() => setInspectorTab('request')}
                >
                  Request
                </button>
                <button
                  type="button"
                  role="tab"
                  className="sim-tab"
                  aria-selected={inspectorTab === 'timeline'}
                  onClick={() => setInspectorTab('timeline')}
                >
                  Timeline Trace ({lastOutcome?.events.length ?? 0})
                </button>
              </div>

              {!lastOutcome ? (
                <div className="sim-vis-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Terminal size={16} />
                    <span style={{ fontSize: 13.5 }}>
                      Jalankan salah satu skenario Baseline atau Uji Celah di panel kiri untuk melihat inspeksi HTTP.
                    </span>
                  </div>
                </div>
              ) : inspectorTab === 'response' ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                    Correlation ID: <code>{lastOutcome.response.correlation_id}</code>
                  </div>
                  <pre className="sim-http-pre">
                    {JSON.stringify(
                      (() => {
                        try {
                          return JSON.parse(lastOutcome.response.body)
                        } catch {
                          return lastOutcome.response.body
                        }
                      })(),
                      null,
                      2,
                    )}
                  </pre>
                </div>
              ) : inspectorTab === 'request' ? (
                <pre className="sim-http-pre">
                  {`${lastOutcome.request.method} ${lastOutcome.request.path}\n` +
                    lastOutcome.request.headers.map(([k, v]) => `${k}: ${v}`).join('\n') +
                    (lastOutcome.request.body ? `\n\n${lastOutcome.request.body}` : '')}
                </pre>
              ) : (
                <ul className="sim-trace-list">
                  {lastOutcome.events.map((ev, i) => (
                    <li key={i} className={`sim-trace-item tone-${ev.tone}`}>
                      <Badge tone={ev.tone === 'bad' ? 'bad' : ev.tone === 'warn' ? 'warn' : ev.tone === 'good' ? 'good' : 'info'}>
                        {ev.decision}
                      </Badge>
                      <div>
                        <strong style={{ display: 'block', fontSize: 13 }}>
                          {ev.stage} · {ev.component}
                        </strong>
                        <span className="muted" style={{ fontSize: 12.5 }}>
                          {ev.detail}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="btn-outline" onClick={() => stepMut.mutate({ current_step: 'pahami' })}>
                  <ArrowLeft size={15} /> Kembali ke Pahami
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={stepMut.isPending}
                  onClick={() => stepMut.mutate({ current_step: 'perbaiki' })}
                >
                  Lanjut Diagnosis &amp; Perbaikan <ArrowRight size={16} />
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {activeStep === 'uji' ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="sim-vis-box" style={{ background: 'var(--brand-soft)', borderColor: 'var(--brand)' }}>
            <strong style={{ fontSize: 13 }}>
              {lang === 'en' ? 'Step-by-Step Exploit Guide' : 'Arahan Uji Celah (2 Langkah Mudah)'}
            </strong>
            <p style={{ margin: 0, fontSize: 13 }}>
              {lab.level_spec.probe_instruction} — Langkah 1: jalankan permintaan normal untuk merekam baseline (
              <code>{lab.level_spec.expected_baseline}</code>). Langkah 2: kirim payload uji untuk membuktikan celah (
              <code>{lab.level_spec.expected_exploit}</code>).
            </p>
          </div>
          <VisualScenarioPanel
            labId={lab.id}
            owaspCode={lab.owasp_code}
            track={lab.track}
            levelLabel={session.level_label}
            state={session.state}
            exploitProved={session.exploit_proved}
            baselineRecorded={session.baseline_recorded}
            lastOutcome={lastOutcome}
          />
        </div>
      ) : null}

      {/* TAHAP 3: PERBAIKI */}
      {activeStep === 'perbaiki' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>3. Pembanding Kode Lintas Stack (Rentan vs Perbaikan)</h2>
                <p>Pelajari pola kode yang rentan dan bagaimana kontrol diterapkan pada stack berbeda.</p>
              </div>
              <div className="sim-chip-row">
                {lab.code_stacks.map((st, idx) => (
                  <button
                    key={st.stack}
                    type="button"
                    className="sim-chip"
                    aria-pressed={stackIdx === idx}
                    onClick={() => setStackIdx(idx)}
                  >
                    <Code2 size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />
                    {st.stack}
                  </button>
                ))}
              </div>
            </div>

            {currentStack ? (
              <div className="sim-code-grid">
                <div className="sim-code-panel is-vuln">
                  <div className="sim-code-head">
                    <span>RENTAN · {currentStack.vulnerable_file}</span>
                    <Badge tone="bad">Rentan</Badge>
                  </div>
                  <CodeLines code={currentStack.vulnerable_code} />
                  <div className="sim-code-explain">{currentStack.vulnerable_explain}</div>
                </div>
                <div className="sim-code-panel is-fix">
                  <div className="sim-code-head">
                    <span>PERBAIKAN · {currentStack.fixed_file}</span>
                    <Badge tone="good">Aman</Badge>
                  </div>
                  <CodeLines code={currentStack.fixed_code} />
                  <div className="sim-code-explain">{currentStack.fixed_explain}</div>
                </div>
              </div>
            ) : null}
          </section>

          <div className="sim-vis-box" style={{ background: 'var(--brand-soft)', borderColor: 'var(--brand)' }}>
            <strong style={{ fontSize: 13 }}>
              {lang === 'en' ? 'Diagnosis Intent & Patch Guide' : 'Maksud Soal Diagnosis & Panduan Memilih Patch'}
            </strong>
            <p style={{ margin: 0, fontSize: 13 }}>
              {lang === 'en'
                ? 'First pinpoint why the bug happened (Root Cause), then pick a patch that enforces server-side verification without breaking legitimate users.'
                : 'Pertama jelaskan akar kegagalan mekanisme kontrol, lalu pilih kandidat patch yang memblokir serangan sambil tetap meloloskan pengguna sah.'}
            </p>
            {(session.diagnosis !== null || session.selected_patch !== null || (!showGamification && !hideAnswers)) &&
            !hideAnswers ? (
              <div style={{ display: 'grid', gap: 4, marginTop: 4, fontSize: 12.5 }}>
                {lab.level_spec.correct_diagnosis !== null ? (
                  <div>
                    <strong>Penjelasan Diagnosis Tepat:</strong>{' '}
                    {lab.level_spec.diagnosis_options[lab.level_spec.correct_diagnosis]}
                  </div>
                ) : null}
                {(() => {
                  const chosen = lab.patch_options.find((p) => p.id === (patchDraft || session.selected_patch))
                  const secure = lab.patch_options.find((p) => p.is_secure === true)
                  if (chosen?.feedback) {
                    return (
                      <div>
                        <strong>Penjelasan Patch ({chosen.label}):</strong> {chosen.feedback}
                      </div>
                    )
                  }
                  if (secure?.feedback) {
                    return (
                      <div>
                        <strong>Solusi Referensi ({secure.label}):</strong> {secure.feedback}
                      </div>
                    )
                  }
                  return null
                })()}
              </div>
            ) : null}
          </div>

          <div className="sim-workbench">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Diagnosis Akar Masalah</h2>
                  <p>Pilih penjelasan mekanisme celah yang paling tepat.</p>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {lab.level_spec.diagnosis_options.map((opt, idx) => {
                  const picked = diagnosisDraft === String(idx)
                  return (
                    <label key={idx} className={`sim-radio-card ${picked ? 'is-picked' : ''}`}>
                      <input
                        type="radio"
                        name="diagnosis"
                        checked={picked}
                        onChange={() => setDiagnosisDraft(String(idx))}
                      />
                      <span style={{ fontSize: 14 }}>{opt}</span>
                    </label>
                  )
                })}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{isImpossible ? 'Mode Referensi & Audit Kontrol' : 'Pilih Kandidat Patch Perbaikan'}</h2>
                  <p>
                    {isImpossible
                      ? 'Pada level Impossible, patch referensi sudah terpasang. Lakukan verifikasi penuh.'
                      : 'Hanya satu patch yang benar-benar menutup seluruh vektor eksploit tanpa merusak fitur sah.'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {lab.patch_options.map((p) => {
                  const picked = patchDraft === p.id
                  return (
                    <label key={p.id} className={`sim-radio-card ${picked ? 'is-picked' : ''}`}>
                      <input
                        type="radio"
                        name="patch"
                        checked={picked}
                        disabled={isImpossible}
                        onChange={() => setPatchDraft(p.id)}
                      />
                      <div>
                        <strong style={{ display: 'block', fontSize: 14 }}>{p.label}</strong>
                        <span className="muted" style={{ fontSize: 13 }}>
                          {p.summary}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="btn-outline" onClick={() => stepMut.mutate({ current_step: 'uji' })}>
                  <ArrowLeft size={15} /> Uji Lagi
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={diagnosisDraft === '' || (!isImpossible && patchDraft === '') || stepMut.isPending}
                  onClick={() =>
                    stepMut.mutate({
                      diagnosis: diagnosisDraft,
                      selected_patch: isImpossible ? undefined : patchDraft,
                      current_step: 'verifikasi',
                    })
                  }
                >
                  Terapkan Kontrol &amp; Lanjut Verifikasi <ArrowRight size={16} />
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {/* TAHAP 4: VERIFIKASI */}
      {activeStep === 'verifikasi' ? (
        <section className="card" style={{ display: 'grid', gap: 14 }}>
          <div className="card-head">
            <div>
              <h2>4. Matriks Verifikasi (Positif / Negatif / Regresi)</h2>
              <p>
                Uji otomatis membandingkan target kondisi rentan (Sebelum) vs kontrol pilihan Anda (Sesudah).
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge tone="muted">Patch: {session.selected_patch ?? 'belum dipilih'}</Badge>
              <button
                type="button"
                className="btn-primary"
                disabled={verifyMut.isPending}
                onClick={() => verifyMut.mutate()}
              >
                <FlaskConical size={16} />
                {verifyMut.isPending ? 'Menjalankan Uji…' : 'Jalankan Matriks Verifikasi'}
              </button>
            </div>
          </div>

          {activeVerifyReport ? (
            <>
              <div
                className="sim-vis-box"
                style={{
                  borderColor: activeVerifyReport.all_passed ? 'var(--good)' : 'var(--bad)',
                  background: activeVerifyReport.all_passed ? 'var(--good-soft)' : 'var(--bad-soft)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <strong style={{ color: activeVerifyReport.all_passed ? 'var(--good)' : 'var(--bad)' }}>
                    {activeVerifyReport.all_passed
                      ? `Semua ${activeVerifyReport.total_count} kasus uji LULUS!`
                      : `${activeVerifyReport.passed_count}/${activeVerifyReport.total_count} kasus uji lulus — patch Anda masih menyisakan celah atau regresi.`}
                  </strong>
                  {!activeVerifyReport.all_passed ? (
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => stepMut.mutate({ current_step: 'perbaiki' })}
                    >
                      Pilih Patch Lain
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="sim-table-wrap">
                <table className="sim-table">
                  <thead>
                    <tr>
                      <th>Kasus</th>
                      <th>Skenario</th>
                      <th>Sebelum (Rentan)</th>
                      <th>Sesudah (Patch Anda)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeVerifyReport.rows.map((r) => (
                      <tr key={r.case_id}>
                        <td>
                          <strong>{r.case_id}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {r.category}
                          </div>
                        </td>
                        <td>
                          <div>{r.scenario}</div>
                          <code style={{ fontSize: 11.5 }}>{r.input}</code>
                        </td>
                        <td style={{ fontSize: 12.5 }}>{r.before_result}</td>
                        <td style={{ fontSize: 12.5 }}>
                          <div>{r.after_result}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {r.evidence}
                          </div>
                        </td>
                        <td>
                          <Badge tone={r.passed ? 'good' : 'bad'}>{r.passed ? 'LULUS' : 'GAGAL'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="sim-vis-box">
              Tekan tombol <strong>Jalankan Matriks Verifikasi</strong> di kanan atas untuk menguji patch Anda terhadap seluruh skenario.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn-outline" onClick={() => stepMut.mutate({ current_step: 'perbaiki' })}>
              <ArrowLeft size={15} /> Kembali ke Perbaiki
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!session.verification_passed || stepMut.isPending}
              onClick={() => stepMut.mutate({ current_step: 'refleksi' })}
            >
              Lanjut ke Refleksi &amp; Penilaian <ArrowRight size={16} />
            </button>
          </div>
        </section>
      ) : null}

      {/* TAHAP 5: REFLEKSI */}
      {activeStep === 'refleksi' ? (
        <div className="sim-workbench">
          <section className="card" style={{ display: 'grid', gap: 12 }}>
            <div className="card-head">
              <div>
                <h2>5. Refleksi Akhir &amp; Penilaian Rubrik</h2>
                <p>Jelaskan akar masalah dan bukti agar sistem menghitung skor serta membuka ringkasan resmi.</p>
              </div>
            </div>

            <div className="sim-vis-box" style={{ background: 'var(--brand-soft)', borderColor: 'var(--brand)' }}>
              <strong style={{ fontSize: 13 }}>
                {lang === 'en' ? 'Purpose of Reflection Questions' : 'Maksud Pertanyaan Refleksi & Tips Lulus (Skor ≥ 80)'}
              </strong>
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                {lang === 'en'
                  ? 'Summarize (1) what check was missing, (2) HTTP status/trace observed before & after patch, and (3) how this same principle protects other endpoints.'
                  : 'Tuliskan secara ringkas: (1) kontrol apa yang hilang pada sistem awal, (2) status HTTP/trace sebelum vs sesudah patch, dan (3) penerapan pola aman ini di fitur lain.'}
              </p>
            </div>

            <form
              style={{ display: 'grid', gap: 12 }}
              onSubmit={(e) => {
                e.preventDefault()
                reflectMut.mutate()
              }}
            >
              <div className="sim-form-field">
                <label htmlFor="refl-root">{lab.reflection_spec.root_cause_prompt}</label>
                <textarea
                  id="refl-root"
                  className="sim-textarea"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Tuliskan akar masalah (minimal 10 karakter)..."
                  required
                />
              </div>
              <div className="sim-form-field">
                <label htmlFor="refl-evidence">{lab.reflection_spec.evidence_prompt}</label>
                <textarea
                  id="refl-evidence"
                  className="sim-textarea"
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  placeholder="Catat bukti HTTP status / trace sebelum & sesudah patch (minimal 10 karakter)..."
                  required
                />
              </div>
              <div className="sim-form-field">
                <label htmlFor="refl-transfer">{lab.reflection_spec.transfer_question}</label>
                <textarea
                  id="refl-transfer"
                  className="sim-textarea"
                  value={transferText}
                  onChange={(e) => setTransferText(e.target.value)}
                  placeholder="Jawaban transfer konsep ke skenario lain (minimal 8 karakter)..."
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-outline" onClick={() => stepMut.mutate({ current_step: 'verifikasi' })}>
                  <ArrowLeft size={15} /> Matriks Verifikasi
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    reflectMut.isPending ||
                    rootCause.trim().length < 10 ||
                    evidenceText.trim().length < 10 ||
                    transferText.trim().length < 8
                  }
                >
                  <ShieldCheck size={16} />
                  {reflectMut.isPending ? 'Menghitung Nilai…' : 'Kirim Refleksi & Hitung Skor'}
                </button>
              </div>
            </form>
          </section>

          <section className="card" style={{ display: 'grid', gap: 14 }}>
            <div className="card-head">
              <div>
                <h2>Rincian Rubrik &amp; Capaian</h2>
                <p>Ambang kelulusan standar modul: 80 poin dan seluruh verifikasi lulus.</p>
              </div>
            </div>

            {activeReflectResult ? (
              <>
                <div
                  className="sim-vis-box"
                  style={{
                    borderColor: activeReflectResult.rubric.passed ? 'var(--good)' : 'var(--warn)',
                    background: activeReflectResult.rubric.passed ? 'var(--good-soft)' : 'var(--warn-soft)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 18 }}>
                      Total Skor: {activeReflectResult.rubric.total}/100
                    </strong>
                    <Badge tone={activeReflectResult.rubric.passed ? 'good' : 'warn'}>
                      {activeReflectResult.rubric.passed ? 'LULUS MODUL' : 'BELUM CAPAI 80'}
                    </Badge>
                  </div>
                  {showGamification && activeReflectResult.xp_awarded_now > 0 ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
                      <Award size={16} /> +{activeReflectResult.xp_awarded_now} XP ditambahkan!
                      {activeReflectResult.badges_unlocked_now.length > 0
                        ? ` Lencana baru: ${activeReflectResult.badges_unlocked_now.join(', ')}`
                        : ''}
                    </div>
                  ) : null}
                </div>

                <div className="sim-rubric-grid">
                  <div className="sim-rubric-cell">
                    <span className="muted" style={{ fontSize: 12 }}>Pahami (15)</span>
                    <strong>{activeReflectResult.rubric.pahami}</strong>
                  </div>
                  <div className="sim-rubric-cell">
                    <span className="muted" style={{ fontSize: 12 }}>Uji Celah (25)</span>
                    <strong>{activeReflectResult.rubric.uji}</strong>
                  </div>
                  <div className="sim-rubric-cell">
                    <span className="muted" style={{ fontSize: 12 }}>Perbaiki (25)</span>
                    <strong>{activeReflectResult.rubric.perbaiki}</strong>
                  </div>
                  <div className="sim-rubric-cell">
                    <span className="muted" style={{ fontSize: 12 }}>Verifikasi (25)</span>
                    <strong>{activeReflectResult.rubric.verifikasi}</strong>
                  </div>
                  <div className="sim-rubric-cell">
                    <span className="muted" style={{ fontSize: 12 }}>Refleksi (10)</span>
                    <strong>{activeReflectResult.rubric.refleksi}</strong>
                  </div>
                </div>

                {hideAnswers ? (
                  <div className="sim-vis-box">
                    <strong>Mode presentasi aktif</strong>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Ringkasan resmi dan poin pembahasan disembunyikan sementara saat ditampilkan di kelas.
                    </p>
                  </div>
                ) : activeReflectResult.official_summary ? (
                  <div className="sim-vis-box">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} color="var(--good)" />
                      <strong>Ringkasan Resmi Pembahasan</strong>
                    </div>
                    <p style={{ margin: 0, fontSize: 13.5 }}>{activeReflectResult.official_summary}</p>
                    {activeReflectResult.key_takeaways && activeReflectResult.key_takeaways.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                        {activeReflectResult.key_takeaways.map((kt, idx) => (
                          <li key={idx}>{kt}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Isi ketiga kolom refleksi dan kirim untuk menghitung nilai rubrik serta membuka ringkasan resmi.
              </p>
            )}
          </section>
        </div>
      ) : null}

      {/* Modal Konfirmasi Reset */}
      {showResetModal ? (
        <div className="sim-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title">
          <div className="sim-modal">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} color="var(--warn)" />
              <h2 id="reset-dialog-title" style={{ margin: 0, fontSize: 18 }}>
                Reset State Simulator?
              </h2>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              State sandbox (data percobaan, burst counter, log broker, dan langkah saat ini) akan dikembalikan ke awal level{' '}
              <strong>{session.level_label}</strong>.{' '}
              {showGamification
                ? 'XP yang sudah Anda peroleh tidak akan hilang.'
                : 'Anda dapat mengulang eksplorasi skenario ini dari awal.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn-outline" onClick={() => setShowResetModal(false)}>
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={resetMut.isPending}
                onClick={() => resetMut.mutate()}
              >
                Ya, Reset State
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
