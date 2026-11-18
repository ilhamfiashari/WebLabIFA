import { useState } from 'react'
import { Clock, FileCode2, KeyRound, Lock, MessageSquarePlus, Play, ShieldAlert, Terminal } from 'lucide-react'
import { useI18n } from '../shared/i18n'
import type { ProbeInput } from './api'

interface SandboxProps {
  busy: boolean
  sessionState: Record<string, unknown>
  onProbe: (input: ProbeInput) => void
}

export function WebGoatSqliTarget({
  busy,
  onProbe,
  payload,
  setPayload,
  target,
  setTarget,
}: SandboxProps & {
  payload: string
  setPayload: (v: string) => void
  target: string
  setTarget: (v: string) => void
}) {
  const { lang } = useI18n()
  const [mode, setMode] = useState<'login' | 'search'>('login')
  const [username, setUsername] = useState("' OR '1'='1")
  const [password, setPassword] = useState('apa_saja')

  return (
    <div className="sim-vis-box" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
          <Terminal size={14} aria-hidden="true" />
          {lang === 'en'
            ? 'Interactive Target: SQL Injection'
            : 'Target Interaktif: SQL Injection'}
        </div>
        <div className="sim-tabs" style={{ gap: 6 }}>
          <button
            type="button"
            className={`sim-tab ${mode === 'login' ? 'is-active' : ''}`}
            onClick={() => setMode('login')}
          >
            <KeyRound size={13} />
            {lang === 'en' ? 'Login Form Target' : 'Form Login Target (SQLi)'}
          </button>
          <button
            type="button"
            className={`sim-tab ${mode === 'search' ? 'is-active' : ''}`}
            onClick={() => setMode('search')}
          >
            <Terminal size={13} />
            {lang === 'en' ? 'Catalog Search & Sort' : 'Pencarian Katalog'}
          </button>
        </div>
      </div>

      {mode === 'login' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onProbe({ action: 'login_form', payload: username, secondary: password })
          }}
          style={{ display: 'grid', gap: 10 }}
        >
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            {lang === 'en'
              ? 'Try logging in as baseline user (rani / praktikum2026) or inject SQL payloads into the username field to bypass authentication safely inside the sandbox.'
              : 'Coba login normal sebagai user valid (rani / praktikum2026) atau sisipkan payload SQL pada kolom username untuk memintas autentikasi di sandbox.'}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 11.5, padding: '4px 10px' }}
              onClick={() => {
                setUsername('rani')
                setPassword('praktikum2026')
              }}
            >
              {lang === 'en' ? 'Fill Valid Baseline (rani)' : 'Isi Login Sah (rani)'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 11.5, padding: '4px 10px' }}
              onClick={() => {
                setUsername("' OR '1'='1")
                setPassword('anything')
              }}
            >
              Payload: &apos; OR &apos;1&apos;=&apos;1
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 11.5, padding: '4px 10px' }}
              onClick={() => {
                setUsername("admin' --")
                setPassword('random123')
              }}
            >
              Payload: admin&apos; --
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
            <div className="sim-form-field">
              <label htmlFor="sqli-login-user">Username / Payload SQL</label>
              <input
                id="sqli-login-user"
                className="sim-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="rani atau ' OR '1'='1"
              />
            </div>
            <div className="sim-form-field">
              <label htmlFor="sqli-login-pass">Password</label>
              <input
                id="sqli-login-pass"
                type="text"
                className="sim-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="praktikum2026"
              />
            </div>
          </div>
          <div className="sim-http-pre" style={{ padding: '8px 10px', fontSize: 11.5 }}>
            {lang === 'en' ? 'Live SQL preview: ' : 'Preview SQL di server target: '}
            <code>{`SELECT id, username, role FROM lab_accounts WHERE username = '${username}' AND password_hash = '${password}'`}</code>
          </div>
          <div>
            <button type="submit" className="btn-primary" disabled={busy}>
              <Lock size={14} /> {lang === 'en' ? 'Submit Target Login' : 'Kirim Login Target'}
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onProbe({ payload, target })
          }}
          style={{ display: 'grid', gap: 10 }}
        >
          <div className="sim-form-field">
            <label htmlFor="sim-custom-payload">
              {lang === 'en' ? 'Search Input / SQL Payload' : 'Input Pencarian / Payload SQL'}
            </label>
            <input
              id="sim-custom-payload"
              className="sim-input"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="Masukkan keyword atau ' OR '1'='1"
            />
          </div>
          <div className="sim-form-field">
            <label htmlFor="sim-sort-col">
              {lang === 'en' ? 'Sort Column (sort)' : 'Kolom Sortir (sort)'}
            </label>
            <input
              id="sim-sort-col"
              className="sim-input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="name_asc atau (CASE WHEN 1=1)"
            />
          </div>
          <div className="sim-http-pre" style={{ padding: '7px 10px', fontSize: 11.5 }}>
            Preview SQL simulasi:{' '}
            <code>{`SELECT name, price FROM products WHERE is_public = true AND name LIKE '%${payload}%' ORDER BY ${target}`}</code>
          </div>
          <div>
            <button type="submit" className="btn-primary" disabled={busy}>
              <Play size={15} /> {lang === 'en' ? 'Run Test Request' : 'Jalankan Request Uji'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

const TARGET_FILES: Array<{ file: string; line: string; code: string; noteId: string; noteEn: string }> = [
  {
    file: 'laporan-audit-kampus.md',
    line: 'Baris 14 · Review Catatan Lab',
    code: '## Ringkasan Keamanan\n// TODO(reviewer): Pastikan komentar mahasiswa tidak memakai dangerouslySetInnerHTML',
    noteId: 'Komentar disimpan ke thread file dan ditampilkan kepada pembaca atau moderator.',
    noteEn: 'Comments are stored onto this file thread and rendered for readers or moderators.',
  },
  {
    file: 'src/components/FileCommentBox.tsx',
    line: 'Baris 28 · Render Komentar File',
    code: '<div className="comment-body">{/* DOM Sink uji XSS */} {comment.html}</div>',
    noteId: 'Uji apakah tag <script>, <img onerror=...>, atau atribut event lolos sanitasi HTML.',
    noteEn: 'Test whether <script>, <img onerror=...>, or event handlers bypass HTML sanitization.',
  },
  {
    file: 'src/pages/BioLink.tsx',
    line: 'Baris 44 · Tautan Profil Penulis',
    code: '<a href={userProvidedUrl}>Lihat Profil</a> // Periksa skema javascript: pada level Hard',
    noteId: 'Pada level tinggi, tag <script> disaring, namun atribut href berpotensi menerima skema javascript:.',
    noteEn: 'At higher levels <script> is stripped, yet href attributes may still accept javascript: URIs.',
  },
]

export function WebGoatXssCommentFileTarget({
  busy,
  sessionState,
  onProbe,
  payload,
  setPayload,
}: SandboxProps & {
  payload: string
  setPayload: (v: string) => void
}) {
  const { lang } = useI18n()
  const [selectedFile, setSelectedFile] = useState(TARGET_FILES[0].file)
  const [viewerRole, setViewerRole] = useState<'reader' | 'moderator'>('reader')
  const fileSpec = TARGET_FILES.find((f) => f.file === selectedFile) ?? TARGET_FILES[0]
  const comments = Array.isArray(sessionState.comments) ? (sessionState.comments as string[]) : []

  return (
    <form
      className="sim-vis-box"
      style={{ display: 'grid', gap: 10 }}
      onSubmit={(e) => {
        e.preventDefault()
        onProbe({ target: viewerRole, payload, secondary: selectedFile })
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
          <MessageSquarePlus size={14} aria-hidden="true" />
          {lang === 'en'
            ? 'File Comment & Stored XSS Sandbox'
            : 'Komentar File & Forum Stored XSS'}
        </div>
        <span className="pill" style={{ fontSize: 11 }}>{selectedFile}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TARGET_FILES.map((f) => (
          <button
            key={f.file}
            type="button"
            className={`sim-tab ${selectedFile === f.file ? 'is-active' : ''}`}
            onClick={() => setSelectedFile(f.file)}
          >
            <FileCode2 size={13} />
            {f.file}
          </button>
        ))}
      </div>

      <div className="sim-code-pane" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
        <div className="sim-code-head is-bad">
          <span>{fileSpec.line}</span>
          <span>{selectedFile}</span>
        </div>
        <pre>{fileSpec.code}</pre>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        {lang === 'en' ? fileSpec.noteEn : fileSpec.noteId}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
        <div className="sim-form-field">
          <label htmlFor="sim-xss-role">
            {lang === 'en' ? 'Target Context' : 'Konteks Tampilan Komentar'}
          </label>
          <select
            id="sim-xss-role"
            className="sim-select-full"
            value={viewerRole}
            onChange={(e) => setViewerRole(e.target.value === 'moderator' ? 'moderator' : 'reader')}
          >
            <option value="reader">reader ({lang === 'en' ? 'Student Reader' : 'Pembaca Umum'})</option>
            <option value="moderator">moderator ({lang === 'en' ? 'Moderator Panel' : 'Panel Moderator'})</option>
          </select>
        </div>
        <div className="sim-form-field">
          <label htmlFor="sim-custom-payload">
            {lang === 'en' ? 'File Comment / HTML Payload' : 'Komentar pada File / Payload XSS'}
          </label>
          <input
            id="sim-custom-payload"
            className="sim-input"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder="<img src=x onerror=demoAlert()>"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { label: lang === 'en' ? 'Safe Review Comment' : 'Komentar Aman', val: 'Penjelasan batas kepercayaan sudah jelas dan rapi.' },
          { label: '<script>demoAlert()</script>', val: '<script>demoAlert()</script>' },
          { label: '<img onerror>', val: '<img src=x onerror=demoAlert()>' },
          { label: 'javascript: URI', val: '<a href="javascript:demoAlert()">Lihat lampiran</a>' },
        ].map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="btn-ghost"
            style={{ fontSize: 11.5, padding: '4px 10px' }}
            onClick={() => setPayload(chip.val)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {comments.length > 0 ? (
        <div style={{ display: 'grid', gap: 4 }}>
          <div className="mini-title">
            {lang === 'en' ? `Comments attached to file (${comments.length})` : `Daftar Komentar Tersimpan (${comments.length})`}
          </div>
          {comments.slice(-4).map((c, idx) => (
            <div key={idx} className="sim-http-pre" style={{ padding: '6px 10px', fontSize: 12 }}>
              [{selectedFile}] {c}
            </div>
          ))}
        </div>
      ) : null}

      <div>
        <button type="submit" className="btn-primary" disabled={busy}>
          <Play size={15} /> {lang === 'en' ? 'Post Comment to File' : 'Kirim Komentar ke File'}
        </button>
      </div>
    </form>
  )
}

const CONFIG_FILES = [
  {
    name: 'nginx.conf',
    probeAction: 'proxy_fallback',
    actionLabelId: 'Uji /proxy-fallback-test',
    actionLabelEn: 'Probe /proxy-fallback-test',
    snippet: `server {\n  listen 443 ssl;\n  # FIXME(ops): Lupa set server_tokens off; versi Nginx bocor di header\n  server_tokens on;\n  location / {\n    proxy_pass http://127.0.0.1:3008;\n  }\n}`,
  },
  {
    name: '.env.staging (Simulasi)',
    probeAction: 'backup_probe',
    actionLabelId: 'Uji /backup.sql.bak',
    actionLabelEn: 'Probe /backup.sql.bak',
    snippet: `# Komentar lama yang tertinggal di webroot publik!\nAPP_DEBUG=true\n# DB_DUMP=/var/www/html/backup.sql.bak  <-- Terbuka oleh HTTP GET\nJWT_FALLBACK_HINT=dev-secret-2025`,
  },
  {
    name: 'error_handler.rs',
    probeAction: 'parse_error',
    actionLabelId: 'Picu Error 500 JSON',
    actionLabelEn: 'Trigger Malformed JSON 500',
    snippet: `// TODO: Ganti format error mentah menjadi respons terstandar {status, code, message}\nif let Err(err) = serde_json::from_str::<Payload>(&body) {\n  return (StatusCode::INTERNAL_SERVER_ERROR, format!("PANIC backtrace: {err:?}"));\n}`,
  },
]

export function WebGoatMisconfigCodeTarget({ busy, onProbe }: SandboxProps) {
  const { lang } = useI18n()
  const [activeIdx, setActiveIdx] = useState(0)
  const file = CONFIG_FILES[activeIdx]

  return (
    <div className="sim-vis-box" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
          <ShieldAlert size={14} aria-hidden="true" />
          {lang === 'en'
            ? 'Code & Config Comment Inspector'
            : 'Inspektor Komentar File & Konfigurasi Server'}
        </div>
        <div className="sim-tabs" style={{ gap: 6 }}>
          {CONFIG_FILES.map((f, i) => (
            <button
              key={f.name}
              type="button"
              className={`sim-tab ${i === activeIdx ? 'is-active' : ''}`}
              onClick={() => setActiveIdx(i)}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <div className="sim-code-pane" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
        <div className="sim-code-head is-bad">
          <span>{lang === 'en' ? 'Inspected Target File' : 'Berkas Target yang Dikomentari'}</span>
          <span>{file.name}</span>
        </div>
        <pre>{file.snippet}</pre>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => onProbe({ action: file.probeAction })}
        >
          <Play size={14} /> {lang === 'en' ? file.actionLabelEn : file.actionLabelId}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => onProbe({ action: 'health' })}
        >
          {lang === 'en' ? 'Baseline: GET /api/health' : 'Baseline: GET /api/health'}
        </button>
      </div>
    </div>
  )
}

export function WebGoatAuthTarget({ busy, onProbe }: SandboxProps) {
  const { lang } = useI18n()
  const [actor, setActor] = useState('rani')
  const [password, setPassword] = useState('salah-123')
  const [advanceMin, setAdvanceMin] = useState(0)

  return (
    <form
      className="sim-vis-box"
      style={{ display: 'grid', gap: 10 }}
      onSubmit={(e) => {
        e.preventDefault()
        onProbe({ action: 'login', actor, payload: password, advance_minutes: advanceMin })
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
        <KeyRound size={14} aria-hidden="true" />
        {lang === 'en' ? 'Target Auth Form & Virtual Clock' : 'Form Target Autentikasi & Jam Virtual'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
        <div className="sim-form-field">
          <label htmlFor="auth-actor">Username</label>
          <input id="auth-actor" className="sim-input" value={actor} onChange={(e) => setActor(e.target.value)} />
        </div>
        <div className="sim-form-field">
          <label htmlFor="auth-pass">Password</label>
          <input id="auth-pass" className="sim-input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="sim-form-field">
          <label htmlFor="auth-clock">{lang === 'en' ? 'Advance Clock (min)' : 'Majukan Jam (menit)'}</label>
          <input
            id="auth-clock"
            type="number"
            min={0}
            max={120}
            className="sim-input"
            value={advanceMin}
            onChange={(e) => setAdvanceMin(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" className="btn-primary" disabled={busy}>
          <Play size={14} /> {lang === 'en' ? 'Attempt Login' : 'Kirim Percobaan Login'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => onProbe({ action: 'login', actor, payload: 'salah', advance_minutes: 15 })}
        >
          <Clock size={14} /> +15 {lang === 'en' ? 'min' : 'menit'}
        </button>
      </div>
    </form>
  )
}
