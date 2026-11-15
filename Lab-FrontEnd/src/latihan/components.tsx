import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, CircleCheck, Eye, EyeOff, KeyRound, Lightbulb, Lock, LoaderCircle, Sparkles, Star, X } from 'lucide-react'
import { NavLink } from '../portal/ui'
import './latihan.css'
import { errorText, levelName, revealHint, submitAnswer, type AnswerResult, type Catalog, type Exercise, type Track } from './api'

type Mode = 'mahasiswa' | 'dosen'
const basePath = (mode: Mode) => mode === 'dosen' ? '/lab/dosen/latihan' : '/lab/latihan'

/** Peta langkah satu jalur. Mahasiswa melihat kunci; Dosen melihat semua langkah terbuka. */
export function LevelMap({ catalog, track, mode, go }: { catalog: Catalog; track: Track; mode: Mode; go: (to: string) => void }) {
  return <ol className="level-map">
    {catalog.levels.map((level, li) => {
      const list = track.exercises.filter(e => e.level === level.level)
      const done = list.filter(e => e.status === 'selesai').length
      const locked = mode === 'mahasiswa' && list.every(e => e.status === 'terkunci')
      const complete = mode === 'mahasiswa' && done === list.length
      const previous = catalog.levels[li - 1]
      return <li key={level.level} className={`level ${locked ? 'is-locked' : ''} ${complete ? 'is-complete' : ''}`}>
        <header className="level-head">
          <span className="level-badge" aria-hidden="true">{locked ? <Lock size={16} /> : complete ? <Check size={16} /> : level.level}</span>
          <div><h3>Level {level.name}</h3><p>{mode === 'dosen' ? `${list.length} latihan · ${level.points} poin per latihan bagi mahasiswa` : locked ? `Terkunci. Tuntaskan level ${previous?.name ?? ''} untuk membuka.` : `${done} dari ${list.length} selesai · ${level.points} XP per latihan`}</p></div>
          {mode === 'mahasiswa' && !locked && <div className="level-progress" aria-hidden="true"><span style={{ width: `${(done / list.length) * 100}%` }} /></div>}
        </header>
        <ol className="steps">{list.map((e, i) => {
          const current = mode === 'mahasiswa' && e.status === 'terbuka'
          const inner = <>
            <span className={`step-node status-${mode === 'dosen' ? 'terbuka' : e.status}`} aria-hidden="true">{e.status === 'selesai' && mode === 'mahasiswa' ? <Check size={15} /> : e.status === 'terkunci' ? <Lock size={13} /> : i + 1}</span>
            <span className="step-text"><strong>{e.title}</strong><small>{e.owasp ? `OWASP ${e.owasp} · ` : ''}{mode === 'mahasiswa' ? e.status === 'selesai' ? `+${e.progress?.earned ?? 0} XP` : e.status === 'terkunci' ? 'Terkunci' : `${e.points} XP` : e.content?.kind === 'pilihan' ? 'Pilihan ganda' : 'Isian singkat'}</small></span>
            {current && <span className="step-cta">Mulai <ArrowRight size={14} aria-hidden="true" /></span>}
          </>
          return <li key={e.id} className={current ? 'is-current' : ''}>
            {e.status === 'terkunci' && mode === 'mahasiswa'
              ? <span className="step is-locked" aria-disabled="true">{inner}<span className="sr-only"> (terkunci)</span></span>
              : <NavLink to={`${basePath(mode)}/${e.id}`} go={go} className="step">{inner}</NavLink>}
          </li>
        })}</ol>
      </li>
    })}
  </ol>
}

function CodeBlock({ code, lang }: { code: string; lang: string | null }) {
  return <figure className="code-block"><figcaption>{lang ?? 'kode'}</figcaption><pre><code>{code}</code></pre></figure>
}

/** Satu latihan. Mode Mahasiswa mengirim jawaban ke server; mode Dosen menampilkan kunci dan pembahasan. */
export function ExercisePlayer({ catalog, track, exercise, mode, go, csrf, hideAnswers }: { catalog: Catalog; track: Track; exercise: Exercise; mode: Mode; go: (to: string) => void; csrf?: string; hideAnswers?: boolean }) {
  const index = track.exercises.findIndex(e => e.id === exercise.id)
  const prev = track.exercises[index - 1]
  const next = track.exercises[index + 1]
  const c = exercise.content
  const level = levelName(catalog, exercise.level)
  const position = track.exercises.filter(e => e.level === exercise.level).findIndex(e => e.id === exercise.id) + 1
  const ofLevel = track.exercises.filter(e => e.level === exercise.level).length
  const nav = <nav className="player-nav" aria-label="Navigasi latihan">
    {prev ? <NavLink to={`${basePath(mode)}/${prev.id}`} go={go} className="btn-outline"><ArrowLeft size={16} aria-hidden="true" />Sebelumnya</NavLink> : <span />}
    <NavLink to={basePath(mode)} go={go} className="text-link">Semua level</NavLink>
    {next && (mode === 'dosen' || next.status !== 'terkunci') ? <NavLink to={`${basePath(mode)}/${next.id}`} go={go} className="btn-outline">Berikutnya<ArrowRight size={16} aria-hidden="true" /></NavLink> : <span />}
  </nav>

  return <article className="card player" aria-labelledby="exercise-title">
    <header className="player-head">
      <p className="player-kicker">{track.title} · Level {level} · Langkah {position} dari {ofLevel}</p>
      <h1 id="exercise-title">{exercise.title}</h1>
      <div className="player-tags">
        {exercise.owasp && <span className="tag">OWASP {exercise.owasp}</span>}
        <span className="tag">{c?.kind === 'isian' ? 'Isian singkat' : 'Pilihan ganda'}</span>
        {mode === 'mahasiswa' && <span className="tag tag-xp"><Star size={13} aria-hidden="true" />{exercise.points} XP</span>}
      </div>
    </header>
    {!c ? <LockedNotice track={track} mode={mode} go={go} /> : <>
      <section className="scenario"><h2 className="sr-only">Skenario</h2><p>{c.scenario}</p>{c.code && <CodeBlock code={c.code} lang={c.code_lang} />}</section>
      <div className="explain" style={{ marginBottom: 12 }}>
        <h3><Lightbulb size={15} aria-hidden="true" />Arahan &amp; Maksud Soal</h3>
        <p style={{ margin: 0 }}>
          Amati skenario/potongan kode di atas untuk mengidentifikasi celah keamanan atau kontrol perbaikan yang sesuai standar {exercise.owasp ? `OWASP ${exercise.owasp}` : 'keamanan aplikasi'}. Gunakan petunjuk bila membutuhkan arahan tambahan; setelah menjawab benar, penjelasan lengkap alasan jawaban akan terbuka di bawah.
        </p>
      </div>
      <h2 className="question">{c.question}</h2>
      {mode === 'dosen' ? <LecturerAnswer key={`${exercise.id}-${hideAnswers ? 1 : 0}`} exercise={exercise} hide={!!hideAnswers} /> : <StudentAnswer key={exercise.id} exercise={exercise} csrf={csrf ?? ''} next={next} go={go} />}
    </>}
    {nav}
  </article>
}

function LockedNotice({ track, mode, go }: { track: Track; mode: Mode; go: (to: string) => void }) {
  const open = track.exercises.find(e => e.status === 'terbuka')
  return <div className="locked-notice"><Lock size={28} aria-hidden="true" /><div><h2>Langkah ini masih terkunci</h2><p>Kerjakan latihan secara berurutan. Level berikutnya terbuka setelah semua latihan di level sebelumnya selesai.</p>
    {open && <NavLink to={`${basePath(mode)}/${open.id}`} go={go} className="btn-primary">Lanjutkan: {open.title}<ArrowRight size={16} aria-hidden="true" /></NavLink>}</div></div>
}

function LecturerAnswer({ exercise, hide }: { exercise: Exercise; hide: boolean }) {
  const [reveal, setReveal] = useState(false)
  const c = exercise.content!
  const answers = exercise.key?.answers ?? []
  const shown = !hide || reveal
  return <div className="answer-area">
    {c.kind === 'pilihan'
      ? <ul className="choices static">{c.options.map(o => { const correct = shown && answers.includes(o.key); return <li key={o.key} className={correct ? 'is-correct' : ''}><span className="choice-key">{o.key.toUpperCase()}</span><span>{o.text}</span>{correct && <span className="key-flag"><Check size={14} aria-hidden="true" />Kunci</span>}</li> })}</ul>
      : <div className="key-box">{shown ? <><p className="key-label">Jawaban yang diterima</p><ul className="accepted">{answers.map(a => <li key={a}><code>{a}</code></li>)}</ul><p className="subtle-note">Pencocokan tidak membedakan huruf besar kecil dan mengabaikan spasi berlebih.</p></> : <p className="key-label">Jawaban disembunyikan untuk mode presentasi.</p>}</div>}
    {hide && <button type="button" className="btn-outline reveal-btn" onClick={() => setReveal(v => !v)} aria-pressed={reveal}>{reveal ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}{reveal ? 'Sembunyikan jawaban' : 'Tampilkan jawaban'}</button>}
    {shown && <div className="explain-grid">
      <section className="explain"><h3><KeyRound size={16} aria-hidden="true" />Penjelasan Jawaban &amp; Pembahasan</h3><p>{c.explanation}</p></section>
      <section className="explain hint"><h3><Lightbulb size={16} aria-hidden="true" />Arahan &amp; Petunjuk</h3><p>{c.hint}</p></section>
    </div>}
  </div>
}

function StudentAnswer({ exercise, csrf, next, go }: { exercise: Exercise; csrf: string; next?: Exercise; go: (to: string) => void }) {
  const client = useQueryClient()
  const c = exercise.content!
  const [value, setValue] = useState('')
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [hint, setHint] = useState<string | null>(c.hint)
  const [confirmHint, setConfirmHint] = useState(false)
  const [shake, setShake] = useState(0)
  const inputId = useId()
  const refresh = () => client.invalidateQueries({ queryKey: ['latihan', 'mahasiswa'] })
  const answer = useMutation({
    mutationFn: (v: string) => submitAnswer(exercise.id, v, csrf),
    onSuccess: data => { setResult(data); if (data.correct) void refresh(); else setShake(n => n + 1) },
  })
  const hintMutation = useMutation({ mutationFn: () => revealHint(exercise.id, csrf), onSuccess: data => { setHint(data.hint); setConfirmHint(false); void refresh() } })
  const done = exercise.status === 'selesai' || result?.correct
  const attempts = result?.attempts ?? exercise.progress?.attempts ?? 0
  const explanation = result?.explanation ?? c.explanation
  const earned = result?.correct ? result.earned : exercise.progress?.earned ?? 0
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (value.trim()) answer.mutate(value) }

  if (done) return <div className="answer-area">
    <div className="success-panel" role="status"><span className="success-burst" aria-hidden="true"><Sparkles size={22} /></span><div><p className="success-title">{result?.correct ? 'Jawaban tepat!' : 'Latihan selesai'}</p><p>+{earned} XP{attempts > 1 ? ` · ${attempts} percobaan` : ''}{exercise.progress?.hint_used ? ' · memakai petunjuk' : ''}</p></div></div>
    {explanation && <section className="explain"><h3><KeyRound size={16} aria-hidden="true" />Penjelasan Jawaban &amp; Pembahasan</h3><p>{explanation}</p></section>}
    {next && <NavLink to={`/lab/latihan/${next.id}`} go={go} className="btn-primary next-btn">{next.level !== exercise.level ? 'Buka level berikutnya' : 'Lanjut ke langkah berikutnya'}<ArrowRight size={16} aria-hidden="true" /></NavLink>}
  </div>

  return <form className="answer-area" onSubmit={onSubmit}>
    {c.kind === 'pilihan'
      ? <fieldset className="choices" key={shake}><legend className="sr-only">Pilih satu jawaban</legend>{c.options.map(o => <label key={o.key} className={`choice ${value === o.key ? 'is-selected' : ''} ${result && !result.correct && value === o.key ? 'is-wrong' : ''}`}>
        <input type="radio" name={`jawaban-${exercise.id}`} value={o.key} checked={value === o.key} onChange={() => { setValue(o.key); setResult(null) }} /><span className="choice-key">{o.key.toUpperCase()}</span><span>{o.text}</span></label>)}</fieldset>
      : <div className={`text-answer ${result && !result.correct ? 'is-wrong' : ''}`} key={shake}><label htmlFor={inputId}>Jawaban Anda</label><input id={inputId} value={value} maxLength={200} autoComplete="off" spellCheck={false} onChange={e => { setValue(e.target.value); setResult(null) }} placeholder="Ketik jawaban singkat" /></div>}
    <div aria-live="polite">
      {result && !result.correct && <p className="feedback wrong"><X size={16} aria-hidden="true" />Belum tepat. Percobaan ke-{result.attempts}; XP maksimum berkurang 10% per percobaan salah.</p>}
      {answer.isError && <p className="feedback wrong" role="alert">{errorText(answer.error)}</p>}
      {hintMutation.isError && <p className="feedback wrong" role="alert">{errorText(hintMutation.error)}</p>}
    </div>
    {hint ? <section className="explain hint"><h3><Lightbulb size={16} aria-hidden="true" />Petunjuk</h3><p>{hint}</p></section> : null}
    <div className="answer-actions">
      <button type="submit" className="btn-primary" disabled={!value.trim() || answer.isPending}>{answer.isPending ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}Periksa jawaban</button>
      {!hint && (confirmHint
        ? <span className="hint-confirm">XP latihan ini menjadi setengah. <button type="button" className="text-btn" onClick={() => hintMutation.mutate()} disabled={hintMutation.isPending}>Ya, tampilkan</button><button type="button" className="text-btn muted" onClick={() => setConfirmHint(false)}>Batal</button></span>
        : <button type="button" className="btn-outline" onClick={() => setConfirmHint(true)}><Lightbulb size={16} aria-hidden="true" />Petunjuk</button>)}
    </div>
  </form>
}
