import { useState } from 'react'
import { AlertTriangle, Cpu, Database, Eye, Lock, ShieldCheck, ShoppingBag, Unlock, Wifi } from 'lucide-react'
import { Badge } from '../portal/ui'
import { useI18n } from '../shared/i18n'
import type { ProbeOutcome } from './api'

interface VisualScenarioProps {
  labId: string
  owaspCode: string | null
  track: 'web' | 'iot'
  levelLabel: string
  state: Record<string, unknown>
  exploitProved: boolean
  baselineRecorded: boolean
  lastOutcome: ProbeOutcome | null
}

type SimViewMode = 'normal' | 'attack' | 'patched'

export function VisualScenarioPanel({
  labId,
  owaspCode,
  track,
  levelLabel,
  state,
  exploitProved,
  baselineRecorded,
  lastOutcome,
}: VisualScenarioProps) {
  const { lang } = useI18n()
  const [viewMode, setViewMode] = useState<SimViewMode>(exploitProved ? 'attack' : 'normal')
  const [selectedItem, setSelectedItem] = useState<number>(0)

  const modeBadgeTone = viewMode === 'attack' ? 'bad' : viewMode === 'patched' ? 'good' : 'info'

  return (
    <section
      className="card"
      style={{ display: 'grid', gap: 14 }}
      aria-label={lang === 'en' ? 'Interactive Visual Target Diagram' : 'Visualisasi Interaktif Target'}
    >
      <div className="card-head">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={18} color="var(--brand)" aria-hidden="true" />
            {lang === 'en'
              ? `Visual Target Illustration · ${track === 'iot' ? 'IoT Hardware & Telemetry' : owaspCode ?? 'Web App'}`
              : `Ilustrasi Visual Target · ${track === 'iot' ? 'Perangkat IoT & Telemetri' : owaspCode ?? 'Aplikasi Web'}`}
          </h2>
          <p>
            {lang === 'en'
              ? 'Click simulation modes below to inspect visually how normal traffic, attack vectors, and secure patches behave.'
              : 'Klik mode simulasi di bawah untuk melihat secara visual perbedaan alur normal, serangan, dan kontrol aman.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge tone={modeBadgeTone}>Level {levelLabel}</Badge>
          {baselineRecorded ? <Badge tone="info">Baseline ✓</Badge> : null}
          {exploitProved ? <Badge tone="warn">Eksploit Terbukti</Badge> : null}
        </div>
      </div>

      <div className="sim-chip-row" role="group" aria-label={lang === 'en' ? 'Visual mode selector' : 'Pilih mode visual'}>
        <button
          type="button"
          className="sim-chip"
          aria-pressed={viewMode === 'normal'}
          onClick={() => setViewMode('normal')}
        >
          {lang === 'en' ? '1. Normal Flow' : '1. Alur Normal'}
        </button>
        <button
          type="button"
          className="sim-chip"
          aria-pressed={viewMode === 'attack'}
          onClick={() => setViewMode('attack')}
        >
          {lang === 'en' ? '2. Attack Scenario' : '2. Skenario Serangan'}
        </button>
        <button
          type="button"
          className="sim-chip"
          aria-pressed={viewMode === 'patched'}
          onClick={() => setViewMode('patched')}
        >
          {lang === 'en' ? '3. Secured Defense' : '3. Pertahanan Aman'}
        </button>
      </div>

      {track === 'iot' ? (
        <IotDiorama
          labId={labId}
          mode={viewMode}
          state={state}
          lastOutcome={lastOutcome}
          lang={lang}
          selectedItem={selectedItem}
          onSelectItem={setSelectedItem}
        />
      ) : labId.includes('sqli') || labId.includes('idor') || owaspCode === 'A01' ? (
        <StorefrontVisual
          labId={labId}
          mode={viewMode}
          selectedItem={selectedItem}
          onSelectItem={setSelectedItem}
          lang={lang}
        />
      ) : labId.includes('crypto') || owaspCode === 'A04' ? (
        <CryptoVaultVisual mode={viewMode} lang={lang} />
      ) : (
        <WebPipelineVisual
          labId={labId}
          owaspCode={owaspCode ?? 'WEB'}
          mode={viewMode}
          selectedItem={selectedItem}
          onSelectItem={setSelectedItem}
          lang={lang}
        />
      )}
    </section>
  )
}

function IotDiorama({
  labId,
  mode,
  state,
  lastOutcome,
  lang,
  selectedItem,
  onSelectItem,
}: {
  labId: string
  mode: SimViewMode
  state: Record<string, unknown>
  lastOutcome: ProbeOutcome | null
  lang: 'id' | 'en'
  selectedItem: number
  onSelectItem: (i: number) => void
}) {
  const rawMoisture = Number(state.soil_moisture ?? (mode === 'attack' ? -50 : 28))
  const moisture = Number.isFinite(rawMoisture) ? rawMoisture : 28
  const pumpState = String(state.pump ?? (mode === 'attack' ? 'FORCED_ON' : mode === 'patched' ? 'SAFE_OFF' : 'IDLE'))
  const activeVersion = String(state.active_version ?? (mode === 'attack' ? '1.0.0-unsigned' : '2.1.4-signed'))
  const pumpActive = mode === 'attack' || pumpState === 'ON' || pumpState === 'FORCED_ON'
  const isOta = labId.includes('ota')

  const nodes = isOta
    ? [
        { title: 'Cloud Repo', sub: `v${activeVersion}`, icon: Wifi },
        { title: 'Bootloader Verify', sub: mode === 'attack' ? 'Sig bypassed' : 'ECDSA P-256 OK', icon: Lock },
        { title: 'Flash Partition', sub: mode === 'attack' ? 'Slot B Downgraded' : 'Dual-bank Signed', icon: Cpu },
      ]
    : [
        { title: 'Sensor Kelembapan', sub: `${moisture}% RH`, icon: Cpu },
        { title: 'Broker MQTT', sub: mode === 'attack' ? 'ACL Wildcard #' : 'Topic Scoped + Nonce', icon: Wifi },
        { title: 'Aktuator Pompa', sub: pumpState, icon: AlertTriangle },
      ]

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        className="sim-vis-box"
        style={{
          padding: 16,
          background: 'var(--bg-subtle, var(--surface))',
          borderColor: mode === 'attack' ? 'var(--bad)' : mode === 'patched' ? 'var(--good)' : 'var(--line)',
        }}
      >
        <svg
          viewBox="0 0 760 220"
          width="100%"
          role="img"
          aria-label={lang === 'en' ? 'Smart-Garden IoT Architecture Diagram' : 'Diagram Visual IoT Smart-Garden'}
          style={{ display: 'block', maxHeight: 230 }}
        >
          <defs>
            <marker id="iot-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill={mode === 'attack' ? '#d9483b' : mode === 'patched' ? '#1f8f5f' : '#356ac3'} />
            </marker>
          </defs>

          {/* Background zone boxes */}
          <rect x="16" y="20" width="200" height="170" rx="14" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
          <text x="34" y="46" fontSize="12" fontWeight="700" fill="var(--muted)">
            {isOta ? 'FIRMWARE SOURCE' : 'SENSOR FIELD'}
          </text>
          {/* Gauge / Icon */}
          <circle cx="116" cy="112" r="42" fill="none" stroke="var(--line)" strokeWidth="10" />
          <circle
            cx="116"
            cy="112"
            r="42"
            fill="none"
            stroke={mode === 'attack' ? '#d9483b' : '#1f8f5f'}
            strokeWidth="10"
            strokeDasharray="264"
            strokeDashoffset={mode === 'attack' ? 40 : 120}
            strokeLinecap="round"
            transform="rotate(-90 116 112)"
          />
          <text x="116" y="109" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--ink)">
            {isOta ? 'OTA' : `${moisture}%`}
          </text>
          <text x="116" y="128" textAnchor="middle" fontSize="11" fill="var(--muted)">
            {isOta ? activeVersion : moisture < 0 ? 'OUT-OF-RANGE!' : 'Soil Moisture'}
          </text>

          {/* Arrow 1 -> 2 */}
          <line
            x1="216"
            y1="105"
            x2="276"
            y2="105"
            stroke={mode === 'attack' ? '#d9483b' : mode === 'patched' ? '#1f8f5f' : '#356ac3'}
            strokeWidth="3"
            strokeDasharray={pumpActive ? '7 5' : undefined}
            markerEnd="url(#iot-arrow)"
          />

          {/* Center Controller / Broker */}
          <rect
            x="280"
            y="20"
            width="200"
            height="170"
            rx="14"
            fill="var(--surface)"
            stroke={mode === 'attack' ? '#d9483b' : mode === 'patched' ? '#1f8f5f' : 'var(--brand)'}
            strokeWidth="2"
          />
          <text x="380" y="46" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--muted)">
            {isOta ? 'BOOTLOADER GUARD' : 'MQTT BROKER + INTERLOCK'}
          </text>
          <rect x="304" y="68" width="152" height="44" rx="8" fill={mode === 'attack' ? 'rgba(217,72,59,0.12)' : 'rgba(31,143,95,0.12)'} />
          <text x="380" y="94" textAnchor="middle" fontSize="13" fontWeight="700" fill={mode === 'attack' ? '#d9483b' : '#1f8f5f'}>
            {mode === 'attack'
              ? isOta
                ? 'Bypass: No Signature'
                : 'BYPASS: Spoof / Replay!'
              : mode === 'patched'
                ? isOta
                  ? 'ECDSA + Anti-Rollback ✓'
                  : 'ACL + Nonce + Clamp ✓'
                : 'Telemetry Normal'}
          </text>
          <text x="380" y="138" textAnchor="middle" fontSize="11.5" fill="var(--muted)">
            Topic: greenhouse/1/pump
          </text>
          <text x="380" y="158" textAnchor="middle" fontSize="11.5" fill="var(--muted)">
            {lastOutcome ? `HTTP ${lastOutcome.response.status}` : 'Ready for probe'}
          </text>

          {/* Arrow 2 -> 3 */}
          <line
            x1="480"
            y1="105"
            x2="540"
            y2="105"
            stroke={mode === 'attack' ? '#d9483b' : mode === 'patched' ? '#1f8f5f' : '#356ac3'}
            strokeWidth="3"
            strokeDasharray={pumpActive ? '7 5' : undefined}
            markerEnd="url(#iot-arrow)"
          />

          {/* Actuator / Partition target */}
          <rect x="544" y="20" width="200" height="170" rx="14" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
          <text x="644" y="46" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--muted)">
            {isOta ? 'FLASH MEMORY BANK' : 'WATER PUMP ACTUATOR'}
          </text>
          <rect
            x="576"
            y="72"
            width="136"
            height="58"
            rx="10"
            fill={mode === 'attack' ? 'rgba(217,72,59,0.14)' : mode === 'patched' ? 'rgba(31,143,95,0.14)' : 'rgba(53,106,195,0.1)'}
            stroke={mode === 'attack' ? '#d9483b' : mode === 'patched' ? '#1f8f5f' : '#356ac3'}
            strokeWidth="1.5"
          />
          <text x="644" y="99" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ink)">
            {isOta ? (mode === 'attack' ? 'ROLLBACK!' : 'VERIFIED') : pumpState}
          </text>
          <text x="644" y="119" textAnchor="middle" fontSize="11" fill="var(--muted)">
            {mode === 'attack'
              ? isOta
                ? 'Malicious firmware booted'
                : 'Risiko banjir / kering'
              : mode === 'patched'
                ? 'Safe State Guaranteed'
                : 'Normal cycle'}
          </text>
          <text x="644" y="160" textAnchor="middle" fontSize="11.5" fill="var(--muted)">
            {mode === 'attack' ? 'Status: Rentan' : mode === 'patched' ? 'Status: Terlindungi' : 'Status: Siaga'}
          </text>
        </svg>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {nodes.map((n, idx) => {
          const Icon = n.icon
          const active = selectedItem === idx
          return (
            <button
              key={n.title}
              type="button"
              onClick={() => onSelectItem(idx)}
              className="sim-vis-box"
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                borderColor: active ? 'var(--brand)' : 'var(--line)',
                background: active ? 'var(--brand-soft)' : 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={16} color="var(--brand)" aria-hidden="true" />
                <strong style={{ fontSize: 13.5 }}>{n.title}</strong>
              </div>
              <span className="muted" style={{ fontSize: 12.5 }}>
                {n.sub}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StorefrontVisual({
  labId,
  mode,
  selectedItem,
  onSelectItem,
  lang,
}: {
  labId: string
  mode: SimViewMode
  selectedItem: number
  onSelectItem: (i: number) => void
  lang: 'id' | 'en'
}) {
  const isIdor = labId.includes('idor')
  const cards = isIdor
    ? [
        { title: 'Invoice #101 · Rani (Milik Anda)', owner: 'rani@student.itera.ac.id', total: 'Rp 245.000', locked: false },
        {
          title: 'Invoice #102 · Bima (Pengguna Lain)',
          owner: 'bima@student.itera.ac.id',
          total: 'Rp 1.850.000 · Alamat Rahasia',
          locked: mode !== 'attack',
        },
        {
          title: 'Invoice #103 · Admin Lab',
          owner: 'admin@weblab.local',
          total: 'Lisensi Enterprise + Token',
          locked: mode !== 'attack',
        },
      ]
    : [
        { title: 'Router Lab Pro', owner: 'Katalog Publik · Stok 12', total: 'Rp 650.000', locked: false },
        { title: 'Akun Admin Portal', owner: "Input: admin@lab' OR '1'='1", total: 'Akses Dashboard', locked: mode !== 'attack' },
        { title: 'Tabel rahasia_users', owner: 'Union / Error Leak', total: 'Hash & PII', locked: mode !== 'attack' },
      ]

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        className="sim-vis-box"
        style={{
          borderColor: mode === 'attack' ? 'var(--bad)' : mode === 'patched' ? 'var(--good)' : 'var(--line)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <strong style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={15} aria-hidden="true" />
            {isIdor
              ? lang === 'en'
                ? 'Target Object Access Visualizer (Click cards below)'
                : 'Visualisasi Objek Target (Klik kartu pesanan di bawah)'
              : lang === 'en'
                ? 'Target Storefront & SQL Query Visualizer'
                : 'Visualisasi Toko Target & Eksekusi Query Database'}
          </strong>
          <Badge tone={mode === 'attack' ? 'bad' : mode === 'patched' ? 'good' : 'info'}>
            {mode === 'attack'
              ? 'Celah Terbuka (Unauthorized Data Exposed!)'
              : mode === 'patched'
                ? 'Kontrol Aktif (403 Forbidden / Parameterized)'
                : 'Akses Normal Pengguna Sah'}
          </Badge>
        </div>

        <code style={{ fontSize: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', display: 'block' }}>
          {isIdor
            ? mode === 'attack'
              ? 'GET /api/orders/102  -->  200 OK (Data Bima bocor karena server tidak cek actor.id == order.owner_id!)'
              : mode === 'patched'
                ? 'GET /api/orders/102  -->  403 Forbidden (OrderPolicy memverifikasi session.user_id === order.owner_id)'
                : 'GET /api/orders/101  -->  200 OK (Rani hanya membuka miliknya sendiri)'
            : mode === 'attack'
              ? "SELECT id, role FROM users WHERE email = '' OR '1'='1' --'  -->  Bypass login berhasil!"
              : mode === 'patched'
                ? 'SELECT id, role FROM users WHERE email = $1  -->  Input dianggap string literal, serangan gagal!'
                : "SELECT id, role FROM users WHERE email = 'rani@student.itera.ac.id'"}
        </code>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {cards.map((c, idx) => (
          <button
            key={c.title}
            type="button"
            onClick={() => onSelectItem(idx)}
            className="sim-vis-box"
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              borderColor:
                selectedItem === idx ? 'var(--brand)' : c.locked ? 'var(--line)' : mode === 'attack' && idx > 0 ? 'var(--bad)' : 'var(--line)',
              background: mode === 'attack' && idx > 0 ? 'var(--bad-soft)' : 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <ShoppingBag size={16} color={c.locked ? 'var(--good)' : mode === 'attack' && idx > 0 ? 'var(--bad)' : 'var(--brand)'} />
              {c.locked ? (
                <Badge tone="good">
                  <Lock size={11} /> Terkunci
                </Badge>
              ) : (
                <Badge tone={mode === 'attack' && idx > 0 ? 'bad' : 'info'}>
                  <Unlock size={11} /> Terbuka
                </Badge>
              )}
            </div>
            <strong style={{ fontSize: 13.5 }}>{c.title}</strong>
            <span className="muted" style={{ fontSize: 12 }}>
              {c.owner}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.locked ? 'Diblokir oleh kebijakan otorisasi' : c.total}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function CryptoVaultVisual({ mode, lang }: { mode: SimViewMode; lang: 'id' | 'en' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
      <div className="sim-vis-box" style={{ borderColor: mode === 'attack' ? 'var(--bad)' : 'var(--line)', background: mode === 'attack' ? 'var(--bad-soft)' : 'var(--surface)' }}>
        <Badge tone="bad">Rentan · MD5 / Tanpa Salt</Badge>
        <strong style={{ fontSize: 14 }}>{lang === 'en' ? 'Predictable Digest Leak' : 'Hash Mudah Ditebak Rainbow Table'}</strong>
        <code style={{ fontSize: 12 }}>e10adc3949ba59abbe56e057f20f883e</code>
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          Dua pengguna dengan sandi sama menghasilkan hash identik; GPU memecahkannya dalam hitungan milidetik.
        </p>
      </div>
      <div className="sim-vis-box" style={{ borderColor: 'var(--good)', background: mode === 'patched' ? 'var(--good-soft)' : 'var(--surface)' }}>
        <Badge tone="good">Aman · Argon2id + Random Salt</Badge>
        <strong style={{ fontSize: 14 }}>{lang === 'en' ? 'Memory-Hard Salted Verification' : 'Hash Tahan Brute-Force + Salt Unik'}</strong>
        <code style={{ fontSize: 12 }}>$argon2id$v=19$m=19456,t=2$9fX2...</code>
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          Setiap akun memakai salt acak 16 byte dan biaya memori tinggi sehingga serangan kamus tidak efektif.
        </p>
      </div>
    </div>
  )
}

function WebPipelineVisual({
  labId,
  owaspCode,
  mode,
  selectedItem,
  onSelectItem,
  lang,
}: {
  labId: string
  owaspCode: string
  mode: SimViewMode
  selectedItem: number
  onSelectItem: (i: number) => void
  lang: 'id' | 'en'
}) {
  const stages = [
    {
      label: '1. Input & Klien',
      desc: mode === 'attack' ? `Payload mencurigakan dikirim (${labId})` : 'Permintaan HTTP sah dari browser mahasiswa',
    },
    {
      label: '2. Titik Kontrol',
      desc:
        mode === 'attack'
          ? `Celah ${owaspCode}: validasi terlewati atau konfigurasi terbuka`
          : mode === 'patched'
            ? `Kontrol ${owaspCode} memvalidasi tanda tangan, skema, & otorisasi`
            : 'Filter dasar aktif pada alur standar',
    },
    {
      label: '3. Dampak Sistem',
      desc:
        mode === 'attack'
          ? 'Konfigurasi/file sensitif, DOM sink, atau transaksi berhasil dimanipulasi'
          : mode === 'patched'
            ? 'Sistem menolak eksploitasi dan mencatat log audit terstruktur'
            : 'Operasi normal berjalan sesuai batas kepercayaan',
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {stages.map((st, idx) => (
          <button
            key={st.label}
            type="button"
            onClick={() => onSelectItem(idx)}
            className="sim-vis-box"
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              borderColor:
                selectedItem === idx
                  ? 'var(--brand)'
                  : mode === 'attack' && idx > 0
                    ? 'var(--bad)'
                    : mode === 'patched' && idx > 0
                      ? 'var(--good)'
                      : 'var(--line)',
              background:
                mode === 'attack' && idx === 2
                  ? 'var(--bad-soft)'
                  : mode === 'patched' && idx === 2
                    ? 'var(--good-soft)'
                    : 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <strong style={{ fontSize: 13.5 }}>{st.label}</strong>
              {mode === 'patched' ? (
                <ShieldCheck size={15} color="var(--good)" />
              ) : mode === 'attack' && idx > 0 ? (
                <AlertTriangle size={15} color="var(--bad)" />
              ) : null}
            </div>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {st.desc}
            </span>
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
        {lang === 'en'
          ? `Selected stage ${selectedItem + 1}: compare the attack vector against the defense control before applying the patch in Step 3.`
          : `Tahap dipilih (${selectedItem + 1}/3): bandingkan alur serangan vs kontrol aman sebelum memilih patch pada Tahap 3.`}
      </p>
    </div>
  )
}
