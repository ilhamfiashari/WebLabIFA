import { useState } from 'react'
import { CheckCircle2, Compass, Globe, Play, ShieldAlert, ShieldCheck, Zap } from 'lucide-react'
import { Badge } from '../portal/ui'
import type { ProbeInput, ProbeOutcome } from './api'
import {
  WebGoatAuthTarget,
  WebGoatMisconfigCodeTarget,
  WebGoatSqliTarget,
  WebGoatXssCommentFileTarget,
} from './WebGoatSandboxes'

interface ProbeConsoleProps {
  labId: string
  sessionState: Record<string, unknown>
  outcome: ProbeOutcome | null
  busy: boolean
  onProbe: (input: ProbeInput) => void
}

interface PresetBtn {
  label: string
  hint: string
  tone?: 'baseline' | 'attack' | 'neutral'
  input: ProbeInput
}

interface WebGoatMissionSpec {
  badge: string
  goal: string
  lessonTip: string
}

function getMissionSpec(labId: string): WebGoatMissionSpec {
  switch (labId) {
    case 'a01-idor':
      return {
        badge: 'Lab Interaktif · Broken Access Control (IDOR)',
        goal: 'Ubah ID pesanan/invoice pada URL API milik pengguna Bima (102 atau 9c4e-102) saat login memakai sesi Rani.',
        lessonTip: 'Uji baseline milik sendiri (#101), lalu ganti parameter ID atau berpindah ke rute /invoices/:id.',
      }
    case 'a02-misconfig':
      return {
        badge: 'Lab Interaktif · Security Misconfiguration',
        goal: 'Picu parse error atau telusuri jalur proxy fallback dan berkas cadangan (/backup.sql.bak) yang bocor.',
        lessonTip: 'Bandingkan endpoint /api/health yang sah dengan respons error debug & file statis.',
      }
    case 'a03-supply-chain':
      return {
        badge: 'Lab Interaktif · Supply Chain & SBOM Gate',
        goal: 'Uji apakah gerbang rilis meloloskan artefak dengan CVE langsung, CVE transitif SBOM, atau builder asing.',
        lessonTip: 'Amati bagaimana lockfile & provenance SLSA menahan artefak bermasalah sebelum produksi.',
      }
    case 'a04-crypto':
      return {
        badge: 'Lab Interaktif · Cryptographic Failures',
        goal: 'Periksa tabel kredensial untuk membuktikan hash lemah/tanpa salt atau migrasi hash saat login gagal.',
        lessonTip: 'Bandingkan hash milik rani_demo dan bima_demo bila memakai password yang sama.',
      }
    case 'a05-sqli':
      return {
        badge: 'Lab Interaktif · SQL Injection & Dynamic Sort',
        goal: 'Gunakan pencarian produk atau parameter ORDER BY untuk mengekstrak baris produk rahasia (is_public=false).',
        lessonTip: 'Coba baseline normal dengan kutip ("Kabel\'Pro"), lalu masukkan tautologi SQL atau CASE WHEN pada kolom sortir.',
      }
    case 'a05-xss':
      return {
        badge: 'Lab Interaktif · Cross-Site Scripting (XSS)',
        goal: 'Kirim payload HTML/event handler ke forum komentar dan amati pemicu sink DOM pada browser korban/moderator.',
        lessonTip: 'Semua simulasi aman di React sandbox tanpa mengeksekusi JavaScript nyata.',
      }
    case 'a06-coupon':
      return {
        badge: 'Lab Interaktif · Race Condition & Logika Bisnis',
        goal: 'Kirim klaim kupon satu kali secara paralel agar kupon terpakai dua kali sebelum transaksi terkunci.',
        lessonTip: 'Gunakan skenario race paralel lalu bandingkan terhadap kupon kedaluwarsa.',
      }
    case 'a07-auth':
      return {
        badge: 'Lab Interaktif · Auth, Rate Limit & Enumeration',
        goal: 'Uji rotasi IP untuk melewati rate limiter atau deteksi enumerasi akun lewat perbedaan status 404 vs 200.',
        lessonTip: 'Manfaatkan tombol +15 menit jam virtual untuk melihat reset jendela blokir.',
      }
    case 'a08-webhook':
      return {
        badge: 'Lab Interaktif · Webhook HMAC & Replay Integrity',
        goal: 'Kirim payload webhook tanpa tanda tangan HMAC atau replay event lama untuk mengubah status order.',
        lessonTip: 'Pastikan raw bytes body dan jendela timestamp diverifikasi server.',
      }
    case 'a09-logging':
      return {
        badge: 'Lab Interaktif · Security Logging & Alerting',
        goal: 'Simulasikan credential spraying, injeksi baris log CRLF (\\n), dan kegagalan sink SIEM.',
        lessonTip: 'Periksa apakah alert tetap terpicu dan field sensitif tetap teredaksi.',
      }
    case 'a10-checkout':
      return {
        badge: 'Lab Interaktif · Mishandling Exceptional Conditions',
        goal: 'Picu kegagalan transaksi setelah reservasi stok atau timeout + retry untuk mendeteksi stok hilang / double order.',
        lessonTip: 'Bandingkan mode non-atomik terhadap transaksi DB atomik + idempotency key.',
      }
    default:
      return {
        badge: 'Lab Interaktif · Interactive Security Lab',
        goal: 'Jalankan skenario baseline yang sah terlebih dahulu, lalu buktikan celah pada skenario serangan.',
        lessonTip: 'Amati Trace Events untuk melihat komponen mana yang menahan atau meloloskan request.',
      }
  }
}

function getPresets(labId: string): PresetBtn[] {
  switch (labId) {
    case 'a01-idor':
      return [
        {
          label: 'Baseline: Baca Order #101 (Rani)',
          hint: 'Akses objek sah milik sendiri',
          tone: 'baseline',
          input: { action: 'orders', actor: 'rani', target: '101' },
        },
        {
          label: 'Uji IDOR: Baca Order #102 (Bima)',
          hint: 'Ganti ID numerik lintas pemilik',
          tone: 'attack',
          input: { action: 'orders', actor: 'rani', target: '102' },
        },
        {
          label: 'Uji Endpoint Invoice: #9c4e-102 (Bima)',
          hint: 'Uji rute /api/invoices/:id pada level Hard',
          tone: 'attack',
          input: { action: 'invoice', actor: 'rani', target: '9c4e-102' },
        },
      ]
    case 'a02-misconfig':
      return [
        {
          label: 'Baseline: GET /api/health',
          hint: 'Respons sehat tanpa detail sensitif',
          tone: 'baseline',
          input: { action: 'health' },
        },
        {
          label: 'Uji Stack Trace: POST /api/items/parse',
          hint: 'Kirim JSON rusak untuk memicu error 500',
          tone: 'attack',
          input: { action: 'parse_error' },
        },
        {
          label: 'Uji Proxy Fallback: GET /proxy-fallback-test',
          hint: 'Cek versi Nginx & upstream internal',
          tone: 'attack',
          input: { action: 'proxy_fallback' },
        },
        {
          label: 'Uji File Cadangan: GET /backup.sql.bak',
          hint: 'Uji paparan dump SQL & rute debug',
          tone: 'attack',
          input: { action: 'backup_probe' },
        },
      ]
    case 'a03-supply-chain':
      return [
        {
          label: 'Baseline: Promote core-clean',
          hint: 'Artefak resmi dengan SBOM & SLSA bersih',
          tone: 'baseline',
          input: { target: 'core-clean' },
        },
        {
          label: 'Uji CVE Langsung: direct-cve',
          hint: 'Paket langsung dengan CVE kritis',
          tone: 'attack',
          input: { target: 'direct-cve' },
        },
        {
          label: 'Uji CVE Transitif: transitive-cve',
          hint: 'Dependensi anak di SBOM ber-CVE',
          tone: 'attack',
          input: { target: 'transitive-cve' },
        },
        {
          label: 'Uji Provenance Asing: untrusted-builder',
          hint: 'Dibangun oleh CI fork tidak tepercaya',
          tone: 'attack',
          input: { target: 'untrusted-builder' },
        },
      ]
    case 'a04-crypto':
      return [
        {
          label: 'Baseline: Login sah (rani)',
          hint: 'Autentikasi normal pengguna terdaftar',
          tone: 'baseline',
          input: { action: 'login_valid' },
        },
        {
          label: 'Uji Inspeksi Dump Password',
          hint: 'Cek apakah plaintext / hash kembar bocor',
          tone: 'attack',
          input: { action: 'inspect_dump' },
        },
        {
          label: 'Uji Migrasi Salah Password (legacy)',
          hint: 'Uji bug rehash saat login gagal',
          tone: 'neutral',
          input: { action: 'login_wrong_legacy' },
        },
      ]
    case 'a05-sqli':
      return [
        {
          label: "Baseline: Cari Kabel'Pro",
          hint: 'Keyword sah yang mengandung kutip tunggal',
          tone: 'baseline',
          input: { payload: "Kabel'Pro", target: 'name_asc' },
        },
        {
          label: "Uji SQLi: ' OR '1'='1",
          hint: 'Bypass filter is_public pada WHERE',
          tone: 'attack',
          input: { payload: "' OR '1'='1", target: 'name_asc' },
        },
        {
          label: "Uji Login SQLi: admin' --",
          hint: 'Suntik form login target tanpa password valid',
          tone: 'attack',
          input: { action: 'login_form', payload: "admin' --", secondary: 'salah123' },
        },
        {
          label: 'Uji Dynamic Sort: ORDER BY CASE WHEN',
          hint: 'Injeksi ekspresi sortir (level Hard)',
          tone: 'attack',
          input: { payload: 'ESP32', target: '(CASE WHEN 1=1)' },
        },
      ]
    case 'a05-xss':
      return [
        {
          label: 'Baseline: Komentar 5 < 10 & aman',
          hint: 'Karakter sudut HTML harus tampil sebagai teks biasa',
          tone: 'baseline',
          input: { payload: '5 < 10 & aman', target: 'reader' },
        },
        {
          label: 'Uji Event XSS: <img onerror>',
          hint: 'Simulasi eksekusi sink DOM pembaca',
          tone: 'attack',
          input: { payload: '<img src=x onerror=demoAlert()>', target: 'reader' },
        },
        {
          label: 'Uji Preview Moderator: <svg onload>',
          hint: 'Celah innerHTML di panel moderator (level Hard)',
          tone: 'attack',
          input: { payload: '<svg onload=demoAlert()>', target: 'moderator' },
        },
      ]
    case 'a06-coupon':
      return [
        {
          label: 'Baseline: Klaim 1x (Bima)',
          hint: 'Penukaran kupon tunggal yang sah',
          tone: 'baseline',
          input: { actor: 'bima', target: 'cart-b' },
        },
        {
          label: 'Uji Parallel Race 2x (Rani)',
          hint: 'Dua request serentak sebelum DB lock',
          tone: 'attack',
          input: { actor: 'rani', target: 'cart-a', parallel: true },
        },
        {
          label: 'Uji Kupon Kedaluwarsa',
          hint: 'Validasi status kadaluarsa server',
          tone: 'attack',
          input: { action: 'expired', actor: 'rani' },
        },
      ]
    case 'a07-auth':
      return [
        {
          label: 'Baseline: Login sah (bima)',
          hint: 'Login normal dengan kredensial valid',
          tone: 'baseline',
          input: { action: 'login_valid', actor: '10.0.1.9', target: 'bima@demo.local' },
        },
        {
          label: 'Uji Burst IP 10.0.1.2 (Rotasi IP)',
          hint: 'Bypass limiter berbasis IP tunggal',
          tone: 'attack',
          input: { action: 'login_burst', actor: '10.0.1.2', target: 'rani@demo.local' },
        },
        {
          label: 'Uji Enumerasi Akun (Recovery)',
          hint: 'Bandingkan respons akun ada vs tidak ada',
          tone: 'attack',
          input: { action: 'recovery_probe', target: 'tidak-ada@demo' },
        },
        {
          label: 'Jam Virtual +15 menit',
          hint: 'Majukan waktu virtual jendela rate limit',
          tone: 'neutral',
          input: { action: 'login_valid', actor: '10.0.1.9', target: 'rani@demo.local', advance_minutes: 15 },
        },
      ]
    case 'a08-webhook':
      return [
        {
          label: 'Baseline: Webhook sah (spaced JSON)',
          hint: 'Validasi HMAC di atas raw bytes asli',
          tone: 'baseline',
          input: { action: 'spaced_valid_json' },
        },
        {
          label: 'Uji Unsigned Tamper',
          hint: 'Payload PAID tanpa signature HMAC valid',
          tone: 'attack',
          input: { action: 'unsigned_tamper' },
        },
        {
          label: 'Uji Replay Event Lama',
          hint: 'Kirim ulang event_id yang sudah diproses',
          tone: 'attack',
          input: { action: 'replay_event' },
        },
        {
          label: 'Uji Timestamp/Nominal Salah',
          hint: 'Uji validasi timestamp replay window',
          tone: 'attack',
          input: { action: 'expired_or_mismatch' },
        },
      ]
    case 'a09-logging':
      return [
        {
          label: 'Baseline: Aktivitas Normal',
          hint: 'Operasi normal tercatat terstruktur',
          tone: 'baseline',
          input: { action: 'normal' },
        },
        {
          label: 'Uji Credential Spraying',
          hint: 'Deteksi anomali gagal login massal',
          tone: 'attack',
          input: { action: 'spray' },
        },
        {
          label: 'Uji CRLF Log Injection (\\n)',
          hint: 'Suntikkan baris log palsu via newline',
          tone: 'attack',
          input: { action: 'log_injection' },
        },
        {
          label: 'Uji SIEM Sink Down',
          hint: 'Simulasikan kegagalan buffer log eksternal',
          tone: 'attack',
          input: { action: 'sink_down' },
        },
      ]
    case 'a10-checkout':
      return [
        {
          label: 'Baseline: Checkout Normal',
          hint: '1 stok berkurang untuk tepat 1 order',
          tone: 'baseline',
          input: { action: 'normal', target: 'idem-demo' },
        },
        {
          label: 'Uji Fault Setelah Reserve',
          hint: 'Server gagal di tengah transaksi tanpa rollback',
          tone: 'attack',
          input: { action: 'fail_after_reserve', target: 'idem-fault' },
        },
        {
          label: 'Uji Timeout + Retry Klien',
          hint: 'Kirim ulang request tanpa idempotency key',
          tone: 'attack',
          input: { action: 'timeout_retry', target: 'idem-demo' },
        },
      ]
    default:
      return []
  }
}

export function ProbeConsole({ labId, sessionState, outcome, busy, onProbe }: ProbeConsoleProps) {
  const presets = getPresets(labId)
  const mission = getMissionSpec(labId)
  const [testedLabels, setTestedLabels] = useState<string[]>([])
  const [payload, setPayload] = useState(labId === 'a05-xss' ? '<img src=x onerror=demoAlert()>' : "' OR '1'='1")
  const [target, setTarget] = useState(labId === 'a01-idor' ? '102' : 'name_asc')
  const [actor, setActor] = useState('rani')
  const [action, setAction] = useState(labId === 'a01-idor' ? 'orders' : 'publish')

  const showIdorControls = labId === 'a01-idor'

  const runPreset = (p: PresetBtn) => {
    setTestedLabels((prev) => (prev.includes(p.label) ? prev : [...prev, p.label]))
    if (p.input.payload !== undefined) setPayload(p.input.payload)
    if (p.input.target !== undefined) setTarget(p.input.target)
    if (p.input.actor !== undefined) setActor(p.input.actor)
    if (p.input.action !== undefined) setAction(p.input.action)
    onProbe(p.input)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Misi Terpandu Gaya OWASP WebGoat */}
      <div className="sim-webgoat-mission">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>
            <Compass size={14} aria-hidden="true" />
            {mission.badge}
          </span>
          <Badge tone={testedLabels.length >= Math.min(2, presets.length) ? 'good' : 'muted'}>
            {testedLabels.length}/{presets.length} skenario diuji
          </Badge>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{mission.goal}</div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          Tips belajar: {mission.lessonTip}
        </div>
      </div>

      {/* Daftar Skenario WebGoat Interaktif */}
      <div>
        <div className="mini-title">Skenario Uji Terpandu (Klik untuk Menjalankan Request Aman di Sandbox)</div>
        <div className="sim-scenario-list">
          {presets.map((p, idx) => {
            const done = testedLabels.includes(p.label)
            return (
              <button
                key={p.label}
                type="button"
                disabled={busy}
                className={`sim-scenario-btn ${done ? 'is-done' : ''}`}
                style={{
                  borderColor: done
                    ? 'color-mix(in srgb, var(--good) 50%, var(--line-strong))'
                    : p.tone === 'attack'
                      ? 'color-mix(in srgb, var(--bad) 40%, var(--line-strong))'
                      : p.tone === 'baseline'
                        ? 'color-mix(in srgb, var(--good) 40%, var(--line-strong))'
                        : undefined,
                }}
                onClick={() => runPreset(p)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700 }}>
                    {done ? (
                      <CheckCircle2 size={14} color="var(--good)" />
                    ) : p.tone === 'attack' ? (
                      <Zap size={13} color="var(--bad)" />
                    ) : (
                      <Play size={13} color="var(--good)" />
                    )}
                    {p.label}
                  </span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    #{idx + 1}
                  </span>
                </div>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  {p.hint}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Target Interaktif Gaya WebGoat */}
      {labId === 'a05-sqli' ? (
        <WebGoatSqliTarget
          busy={busy}
          sessionState={sessionState}
          onProbe={onProbe}
          payload={payload}
          setPayload={setPayload}
          target={target}
          setTarget={setTarget}
        />
      ) : null}

      {labId === 'a05-xss' ? (
        <WebGoatXssCommentFileTarget
          busy={busy}
          sessionState={sessionState}
          onProbe={onProbe}
          payload={payload}
          setPayload={setPayload}
        />
      ) : null}

      {labId === 'a02-misconfig' ? (
        <WebGoatMisconfigCodeTarget busy={busy} sessionState={sessionState} onProbe={onProbe} />
      ) : null}

      {labId === 'a07-auth' ? (
        <WebGoatAuthTarget busy={busy} sessionState={sessionState} onProbe={onProbe} />
      ) : null}

      {/* Target Interaktif Gaya WebGoat: URL Repeater IDOR */}
      {showIdorControls ? (
        <form
          className="sim-vis-box"
          onSubmit={(e) => {
            e.preventDefault()
            onProbe({ actor, target, action })
          }}
        >
          <div className="sim-url-bar" aria-label="Pratinjau URL Request IDOR">
            <Globe size={14} aria-hidden="true" />
            <span>GET</span>
            <span>{`https://demo.lab.ifa/api/${action === 'invoice' ? 'invoices' : 'orders'}/${target || '101'}`}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <div className="sim-form-field">
              <label htmlFor="idor-actor">Aktor Sesi</label>
              <select id="idor-actor" className="sim-select-full" value={actor} onChange={(e) => setActor(e.target.value)}>
                <option value="rani">rani (Mahasiswa A)</option>
                <option value="bima">bima (Mahasiswa B)</option>
                <option value="anon">anon (Tanpa Cookie)</option>
              </select>
            </div>
            <div className="sim-form-field">
              <label htmlFor="idor-action">Endpoint API</label>
              <select id="idor-action" className="sim-select-full" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="orders">GET /api/orders/:id</option>
                <option value="invoice">GET /api/invoices/:id</option>
              </select>
            </div>
            <div className="sim-form-field">
              <label htmlFor="idor-target">Target ID / UUID</label>
              <select id="idor-target" className="sim-select-full" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="101">101 (Order Rani)</option>
                <option value="102">102 (Order Bima)</option>
                <option value="7f9a-101">7f9a-101 (UUID Rani)</option>
                <option value="9c4e-102">9c4e-102 (UUID Bima)</option>
              </select>
            </div>
          </div>
          <div>
            <button type="submit" className="btn-primary" disabled={busy}>
              <Play size={15} /> Kirim Request IDOR
            </button>
          </div>
        </form>
      ) : null}

      <LabStateVisualizer labId={labId} sessionState={sessionState} outcome={outcome} />
    </div>
  )
}

function LabStateVisualizer({
  labId,
  sessionState,
  outcome,
}: {
  labId: string
  sessionState: Record<string, unknown>
  outcome: ProbeOutcome | null
}) {
  const vis = outcome?.visual_data ?? {}
  const kind = String(vis.kind ?? '')

  if (labId === 'a05-sqli' || kind === 'sqli') {
    const tokens = Array.isArray(vis.ast_tokens) ? (vis.ast_tokens as string[]) : ['SELECT', 'name, price', 'FROM products', 'WHERE is_public=true']
    const rows = Array.isArray(vis.rows) ? (vis.rows as Array<Record<string, unknown>>) : []
    const leaked = Boolean(vis.leaked_private) || Boolean(vis.bypassed_auth)
    const isLoginMode = vis.mode === 'login_form'
    return (
      <div className="sim-vis-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13 }}>
            {isLoginMode ? 'Hasil Eksekusi Login SQLi & Token AST' : 'Visualizer AST & Bind Parameter SQL'}
          </strong>
          <Badge tone={leaked ? 'bad' : 'good'}>
            {leaked ? 'SQL Injection Tembus' : vis.parameterized ? 'Bind Parameter Terkunci' : 'Query Normal'}
          </Badge>
        </div>
        {typeof vis.sql_preview === 'string' ? (
          <div className="sim-http-pre" style={{ padding: '7px 10px', fontSize: 12 }}>
            {vis.sql_preview}
          </div>
        ) : null}
        <div className="sim-ast-row" aria-label="Token AST Query">
          {tokens.map((t, i) => {
            const isSql = ['SELECT', 'FROM', 'WHERE', 'ORDER BY'].includes(t)
            const isInject = leaked && (t.includes('OR') || t.includes('CASE') || t.includes("'"))
            const isParam = Boolean(vis.parameterized) && t.startsWith('$1')
            return (
              <span
                key={`${i}-${t}`}
                className={`sim-token ${isInject ? 'is-inject' : isParam ? 'is-param' : isSql ? 'is-sql' : ''}`}
              >
                {t}
              </span>
            )
          })}
        </div>
        {rows.length > 0 ? (
          <div className="sim-table-wrap">
            <table className="sim-table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Harga</th>
                  <th>Status Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const isPublic = typeof r.is_public === 'boolean' ? r.is_public : r.visibility === 'public'
                  return (
                    <tr key={idx}>
                      <td>{String(r.name ?? '')}</td>
                      <td>Rp {Number(r.price ?? 0).toLocaleString('id-ID')}</td>
                      <td>
                        <Badge tone={isPublic ? 'good' : 'bad'}>{isPublic ? 'Publik' : 'RAHASIA (Internal)'}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    )
  }

  if (labId === 'a05-xss' || kind === 'xss') {
    const comments = Array.isArray(vis.comments)
      ? (vis.comments as string[])
      : Array.isArray(sessionState.comments)
        ? (sessionState.comments as string[])
        : []
    const triggered = Boolean(vis.dom_alert_triggered)
    return (
      <div className="sim-vis-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 13 }}>DOM Sink &amp; CSP Sandbox Monitor (Simulasi Aman)</strong>
          <Badge tone={triggered ? 'bad' : 'good'}>
            {triggered ? 'Sink Alert Terpicu!' : 'Output Aman (Escaped Text)'}
          </Badge>
        </div>
        {triggered ? (
          <div
            style={{
              border: '1px solid var(--bad)',
              background: 'var(--bad-soft)',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12.5,
              color: 'var(--bad)',
              fontWeight: 600,
            }}
          >
            Simulasi Alert Browser Korban: demoAlert() terpanggil di DOM sandbox (tidak ada skrip asli yang dijalankan).
          </div>
        ) : null}
        <div style={{ display: 'grid', gap: 6 }}>
          {comments.map((c, idx) => (
            <div key={idx} className="sim-http-pre" style={{ padding: '7px 10px' }}>
              {c}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (labId === 'a10-checkout' || kind === 'checkout') {
    const stock = Number(vis.stock ?? sessionState.stock ?? 10)
    const orderCount = Number(vis.order_count ?? (Array.isArray(sessionState.orders) ? sessionState.orders.length : 0))
    return (
      <div className="sim-vis-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13 }}>State Transaksi &amp; Stok Gudang</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <Badge tone="muted">Stok tersisa: {stock}</Badge>
            <Badge tone={orderCount > 1 ? 'bad' : 'good'}>Order tercatat: {orderCount}</Badge>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          Invarian: Setiap 1 transaksi sukses mengurangi tepat 1 stok dan menciptakan tepat 1 order.
        </p>
      </div>
    )
  }

  return (
    <div className="sim-vis-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Status State Sandbox Real-Time</strong>
        {outcome ? (
          outcome.exploit_proved ? (
            <Badge tone="bad">
              <ShieldAlert size={13} /> Celah Terbukti
            </Badge>
          ) : (
            <Badge tone="good">
              <ShieldCheck size={13} /> Kontrol Menahan
            </Badge>
          )
        ) : null}
      </div>
      <pre className="sim-http-pre" style={{ maxHeight: 140 }}>
        {JSON.stringify(Object.keys(vis).length > 0 ? vis : sessionState, null, 2)}
      </pre>
    </div>
  )
}
