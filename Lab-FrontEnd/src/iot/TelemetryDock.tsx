import { useState } from 'react'
import { Activity, Cpu, Lock, Send, ShieldAlert, Terminal, Trash2, Wifi } from 'lucide-react'
import { Badge } from '../portal/ui'
import type { SimulationState } from './types'

const PLOT_COLORS = ['#22c55e', '#38bdf8', '#f59e0b', '#f472b6']

export function TelemetryDock({
  sim,
  hasWifi,
  lang,
  onClearSerial,
  onSendSerial,
}: {
  sim: SimulationState
  hasWifi: boolean
  lang: 'id' | 'en'
  onClearSerial: () => void
  onSendSerial: (text: string) => void
}) {
  const [tab, setTab] = useState<'serial' | 'plotter' | 'gpio' | 'mqtt'>('serial')
  const [txInput, setTxInput] = useState('')

  const seriesKeys = Array.from(
    new Set(sim.plotHistory.flatMap((pt) => Object.keys(pt.series))),
  ).slice(0, 4)

  const allVals = sim.plotHistory.flatMap((pt) => seriesKeys.map((k) => pt.series[k]).filter((v) => v !== undefined))
  const minVal = allVals.length ? Math.min(...allVals) : 0
  const maxVal = allVals.length ? Math.max(...allVals) : 100
  const span = Math.max(1, maxVal - minVal)

  const sendTx = (e: React.FormEvent) => {
    e.preventDefault()
    if (!txInput.trim()) return
    onSendSerial(txInput.trim())
    setTxInput('')
  }

  return (
    <section className="iot-dock card" aria-label={lang === 'en' ? 'Telemetry and Debug Dock' : 'Panel Telemetri & Debug'}>
      <header className="iot-dock-tabs">
        <div className="iot-tab-row" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'serial'} className={`iot-tab ${tab === 'serial' ? 'is-active' : ''}`} onClick={() => setTab('serial')}>
            <Terminal size={14} /> Serial Monitor
            {sim.serialLog.length > 0 ? <span className="iot-count-pill">{sim.serialLog.length}</span> : null}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'plotter'} className={`iot-tab ${tab === 'plotter' ? 'is-active' : ''}`} onClick={() => setTab('plotter')}>
            <Activity size={14} /> Serial Plotter
          </button>
          <button type="button" role="tab" aria-selected={tab === 'gpio'} className={`iot-tab ${tab === 'gpio' ? 'is-active' : ''}`} onClick={() => setTab('gpio')}>
            <Cpu size={14} /> {lang === 'en' ? 'GPIO & Safety' : 'GPIO & Proteksi'}
            {sim.alerts.length > 0 ? <Badge tone="bad">{sim.alerts.length}</Badge> : null}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'mqtt'} className={`iot-tab ${tab === 'mqtt' ? 'is-active' : ''}`} onClick={() => setTab('mqtt')}>
            <Wifi size={14} /> Wi-Fi &amp; MQTT
            {sim.mqttMessages.length > 0 ? <span className="iot-count-pill">{sim.mqttMessages.length}</span> : null}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge tone={sim.running ? 'good' : 'muted'}>
            {sim.running ? (lang === 'en' ? '115200 baud · Live' : '115200 baud · Aktif') : lang === 'en' ? 'Idle' : 'Siaga'}
          </Badge>
          {tab === 'serial' ? (
            <button type="button" className="btn-outline iot-mini-btn" onClick={onClearSerial}>
              <Trash2 size={13} /> {lang === 'en' ? 'Clear' : 'Bersihkan'}
            </button>
          ) : null}
        </div>
      </header>

      {tab === 'serial' ? (
        <div className="iot-serial-pane">
          <div className="iot-serial-log" role="log" aria-live="polite">
            {sim.serialLog.length === 0 ? (
              <span className="iot-muted-mono">
                {lang === 'en'
                  ? '// Click "Run" to execute setup() and loop() and stream Serial output here...'
                  : '// Klik "Jalankan" untuk mengeksekusi setup()/loop() dan melihat output Serial di sini...'}
              </span>
            ) : (
              sim.serialLog.map((item) => (
                <div key={item.id} className={`iot-serial-line ${item.kind === 'tx' ? 'is-tx' : ''}`}>
                  <span className="iot-serial-ts">{(item.timeMs / 1000).toFixed(2)}s</span>
                  <span>{item.kind === 'tx' ? `TX > ${item.text}` : item.text}</span>
                </div>
              ))
            )}
          </div>
          <form className="iot-serial-input-row" onSubmit={sendTx}>
            <input
              className="input"
              value={txInput}
              onChange={(e) => setTxInput(e.target.value)}
              placeholder={lang === 'en' ? 'Send command to Serial.readString()...' : 'Kirim input ke Serial.readString()...'}
            />
            <button type="submit" className="btn-outline iot-mini-btn">
              <Send size={13} /> {lang === 'en' ? 'Send' : 'Kirim'}
            </button>
          </form>
        </div>
      ) : tab === 'plotter' ? (
        <div className="iot-plotter-pane">
          {sim.plotHistory.length < 1 || seriesKeys.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {lang === 'en'
                ? 'Run a sketch printing numeric values (e.g. temp:28.5,hum:62) to plot real-time sensor curves.'
                : 'Jalankan kode yang mencetak angka (mis. temp:28.5,hum:62 atau distance_cm:48) untuk menampilkan grafik gelombang.'}
            </p>
          ) : (
            <>
              <div className="iot-plot-legend">
                {seriesKeys.map((k, idx) => (
                  <span key={k} className="iot-legend-item">
                    <i style={{ background: PLOT_COLORS[idx % PLOT_COLORS.length] }} />
                    {k}: <strong>{sim.plotHistory[sim.plotHistory.length - 1]?.series[k] ?? '-'}</strong>
                  </span>
                ))}
              </div>
              <svg className="iot-plot-svg" viewBox="0 0 600 130" preserveAspectRatio="none">
                <line x1={0} y1={20} x2={600} y2={20} stroke="#334155" strokeDasharray="3 3" />
                <line x1={0} y1={65} x2={600} y2={65} stroke="#334155" strokeDasharray="3 3" />
                <line x1={0} y1={110} x2={600} y2={110} stroke="#334155" strokeDasharray="3 3" />
                {seriesKeys.map((k, sIdx) => {
                  const pts = sim.plotHistory
                    .map((pt, i) => {
                      const val = pt.series[k]
                      if (val === undefined) return null
                      const x = (i / Math.max(1, sim.plotHistory.length - 1)) * 590 + 5
                      const y = 115 - ((val - minVal) / span) * 95
                      return `${x.toFixed(1)},${y.toFixed(1)}`
                    })
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <polyline
                      key={k}
                      fill="none"
                      stroke={PLOT_COLORS[sIdx % PLOT_COLORS.length]}
                      strokeWidth={2.4}
                      points={pts}
                    />
                  )
                })}
              </svg>
            </>
          )}
        </div>
      ) : tab === 'gpio' ? (
        <div className="iot-gpio-pane">
          {sim.alerts.length > 0 ? (
            <div className="iot-alerts-list">
              {sim.alerts.map((a) => (
                <div key={a.id} className={`iot-alert-banner ${a.severity === 'error' ? 'is-error' : 'is-warn'}`}>
                  <ShieldAlert size={15} />
                  <span>{lang === 'en' ? a.messageEn : a.messageId}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
              {lang === 'en' ? 'Circuit safety check passed (no short-circuits or over-voltage detected).' : 'Pemeriksaan keamanan rangkaian bersih (tidak ada korsleting atau over-voltage).'}
            </p>
          )}
          <div className="iot-gpio-grid">
            {Object.values(sim.gpioStates).map((g) => (
              <div key={g.gpio} className={`iot-gpio-chip ${g.digital ? 'is-high' : ''}`}>
                <strong>GP{g.gpio}</strong>
                <span>{g.mode}</span>
                <span>{g.digital ? 'HIGH' : 'LOW'} · {g.voltage.toFixed(1)}V</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="iot-mqtt-pane">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>
              {hasWifi
                ? sim.wifiConnected
                  ? `Wi-Fi Connected · IP ${sim.wifiIp}`
                  : lang === 'en'
                    ? 'Wi-Fi Idle (call WiFi.begin() in setup)'
                    : 'Wi-Fi Siaga (panggil WiFi.begin() pada setup)'
                : lang === 'en'
                  ? 'Selected board has no onboard Wi-Fi radio'
                  : 'Board yang dipilih tidak memiliki modul Wi-Fi internal'}
            </span>
          </div>
          {sim.mqttMessages.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {lang === 'en' ? 'No MQTT messages published yet.' : 'Belum ada paket MQTT yang dipublikasikan.'}
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{lang === 'en' ? 'Time' : 'Waktu'}</th>
                    <th>Broker</th>
                    <th>{lang === 'en' ? 'Channel' : 'Kanal'}</th>
                    <th>Topic</th>
                    <th>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.mqttMessages.slice(-8).reverse().map((m) => (
                    <tr key={m.id}>
                      <td>{(m.timeMs / 1000).toFixed(2)}s</td>
                      <td><code>{m.broker}</code></td>
                      <td>
                        <Badge tone={m.tls ? 'good' : 'bad'}>
                          {m.tls ? <><Lock size={11} /> TLS</> : 'Plaintext'}
                        </Badge>
                      </td>
                      <td><code>{m.topic}</code></td>
                      <td><code>{m.payload}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
