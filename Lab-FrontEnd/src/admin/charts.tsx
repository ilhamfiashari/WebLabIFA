import { useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent } from 'react'
import { Table2, LineChart as LineIcon } from 'lucide-react'
import type { WeekPoint } from './data'
import { fmt } from './routes'


function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(560)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(Math.max(240, Math.floor(el.getBoundingClientRect().width)))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

function niceScale(max: number, ticks = 4) {
  const raw = Math.max(1, max) / ticks
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)!
  return { top: step * ticks, ticks: Array.from({ length: ticks + 1 }, (_, i) => i * step) }
}

/** Kartu grafik dengan judul, sub-judul, dan sakelar tampilan tabel. */
export function ChartCard({ title, subtitle, columns, rows, children, action, className }: { title: string; subtitle?: string; columns?: [string, string]; rows?: Array<[string, string]>; children: ReactNode; action?: ReactNode; className?: string }) {
  const [table, setTable] = useState(false)
  const id = useId()
  return <section className={`card chart-card ${className ?? ''}`} aria-labelledby={id}>
    <header className="card-head">
      <div><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      <div className="card-tools">
        {action}
        {rows && <button type="button" className="icon-toggle" aria-pressed={table} onClick={() => setTable(v => !v)} title={table ? 'Tampilkan grafik' : 'Tampilkan tabel'}>
          {table ? <LineIcon size={15} aria-hidden="true" /> : <Table2 size={15} aria-hidden="true" />}<span className="sr-only">{table ? 'Tampilkan grafik' : 'Tampilkan tabel'}</span>
        </button>}
      </div>
    </header>
    {table && rows ? <div className="table-wrap compact"><table className="data-table"><thead><tr><th scope="col">{columns?.[0] ?? 'Label'}</th><th scope="col" className="num">{columns?.[1] ?? 'Nilai'}</th></tr></thead><tbody>{rows.map(([a, b]) => <tr key={a}><td>{a}</td><td className="num">{b}</td></tr>)}</tbody></table></div> : children}
  </section>
}

interface Tip { x: number; y: number; label: string; value: string }
function Tooltip({ tip, unit }: { tip: Tip | null; unit: string }) {
  if (!tip) return null
  return <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status"><strong>{tip.value}</strong><span><i aria-hidden="true" />{unit} · {tip.label}</span></div>
}

const M = { top: 12, right: 16, bottom: 28, left: 40 }

/** Grafik garis berisi area untuk satu seri. Crosshair menempel ke minggu terdekat. */
export function LineChart({ data, unit, height = 200 }: { data: WeekPoint[]; unit: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const safeVals = data.map(d => (Number.isFinite(Number(d.value)) ? Number(d.value) : 0))
  const { top, ticks } = niceScale(Math.max(1, ...safeVals))
  const w = width - M.left - M.right, h = height - M.top - M.bottom
  const x = (i: number) => M.left + (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w)
  const y = (v: number) => M.top + h - ((Number.isFinite(Number(v)) ? Number(v) : 0) / (top || 1)) * h
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join('')
  const area = `${line}L${x(data.length - 1)},${M.top + h}L${x(0)},${M.top + h}Z`
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(w / 70)))
  const pick = (clientX: number) => {
    const box = ref.current!.getBoundingClientRect()
    const rel = (clientX - box.left - M.left) / w
    setActive(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive(a => Math.min(data.length - 1, (a ?? -1) + 1)) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(a => Math.max(0, (a ?? data.length) - 1)) }
    if (e.key === 'Escape') setActive(null)
  }
  const tip = active === null ? null : { x: x(active), y: y(data[active].value), label: `Minggu ${data[active].label}`, value: fmt(data[active].value) }
  return <div className="chart" ref={ref}>
    <svg width={width} height={height} role="img" aria-label={`Grafik garis ${unit} per minggu. Gunakan panah kiri dan kanan untuk membaca nilai.`} tabIndex={0}
      onPointerMove={e => pick(e.clientX)} onPointerLeave={() => setActive(null)} onKeyDown={onKey} onBlur={() => setActive(null)}>
      {ticks.map(t => <g key={t}><line className="grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} /><text className="axis" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{fmt(t)}</text></g>)}
      {data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1) && <text key={d.label} className="axis" x={x(i)} y={height - 8} textAnchor="middle">{d.label}</text>)}
      <path className="series-area" d={area} />
      <path className="series-line" d={line} />
      {active !== null && <line className="crosshair" x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + h} />}
      {data.map((d, i) => <circle key={d.label} className={`series-dot ${i === active ? 'is-active' : ''}`} cx={x(i)} cy={y(d.value)} r={i === active ? 5.5 : 4} />)}
    </svg>
    <Tooltip tip={tip} unit={unit} />
  </div>
}

/** Grafik batang vertikal satu seri dengan ujung atas membulat 4px. */
export function BarChart({ data, unit, height = 200, labelPrefix = 'Minggu' }: { data: WeekPoint[]; unit: string; height?: number; labelPrefix?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const safeVals = data.map(d => (Number.isFinite(Number(d.value)) ? Number(d.value) : 0))
  const { top, ticks } = niceScale(Math.max(1, ...safeVals))
  const w = width - M.left - M.right, h = height - M.top - M.bottom
  const band = w / Math.max(1, data.length)
  const barW = Math.min(96, band * 0.72)
  const y = (v: number) => M.top + h - (v / top) * h
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(w / 64)))
  const bar = (i: number, v: number) => {
    const x0 = M.left + band * i + (band - barW) / 2, y0 = y(v), base = M.top + h, r = Math.min(4, (base - y0) / 2, barW / 2)
    return `M${x0},${base}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + barW - r}Q${x0 + barW},${y0} ${x0 + barW},${y0 + r}V${base}Z`
  }
  const tip = active === null ? null : { x: M.left + band * active + band / 2, y: y(data[active].value), label: `${labelPrefix} ${data[active].label}`.trim(), value: fmt(data[active].value) }
  return <div className="chart" ref={ref}>
    <svg width={width} height={height} role="group" aria-label={`Grafik batang ${unit}`} onPointerLeave={() => setActive(null)}>
      {ticks.map(t => <g key={t}><line className="grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} /><text className="axis" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{fmt(t)}</text></g>)}
      {data.map((d, i) => <g key={d.label}>
        <path className={`series-bar ${i === active ? 'is-active' : ''}`} d={bar(i, d.value)} />
        <rect className="hit" x={M.left + band * i} y={M.top} width={band} height={h} tabIndex={0} role="img" aria-label={`${labelPrefix} ${d.label}: ${fmt(d.value)} ${unit}`}
          onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} />
        {(i % labelEvery === 0 || i === data.length - 1) && <text className="axis" x={M.left + band * i + band / 2} y={height - 8} textAnchor="middle">{d.label}</text>}
      </g>)}
    </svg>
    <Tooltip tip={tip} unit={unit} />
  </div>
}

/** Batang horizontal berbasis HTML untuk perbandingan kategori dengan label langsung. */
export function HBarList({ items, max, format = fmt, unit }: { items: Array<{ label: string; value: number; note?: string }>; max?: number; format?: (n: number) => string; unit: string }) {
  const top = Math.max(1, max ?? Math.max(1, ...items.map(i => (Number.isFinite(Number(i.value)) ? Number(i.value) : 0))))
  return <ul className="hbar-list" aria-label={unit}>
    {items.map(item => { const val = Number.isFinite(Number(item.value)) ? Number(item.value) : 0; return <li key={item.label}>
      <div className="hbar-meta"><span>{item.label}{item.note && <small>{item.note}</small>}</span><strong>{format(val)}</strong></div>
      <div className="hbar-track" aria-hidden="true"><div className="hbar-fill" style={{ width: `${Math.max(1.5, Math.min(100, (val / top) * 100))}%` }} /></div>
    </li> })}
  </ul>
}

/** Heatmap sekuensial satu hue: hari × blok jam. */
export function Heatmap({ rows, cols, values, unit }: { rows: string[]; cols: string[]; values: number[][]; unit: string }) {
  const max = Math.max(1, ...values.flat().map(v => (Number.isFinite(Number(v)) ? Number(v) : 0)))
  const steps = 5
  const level = (v: number) => Math.min(steps - 1, Math.max(0, Math.floor(((Number.isFinite(Number(v)) ? Number(v) : 0) / max) * steps)))
  const [active, setActive] = useState<string | null>(null)
  return <div className="heatmap-wrap">
    <table className="heatmap" aria-label={`${unit} per hari dan jam`}>
      <thead><tr><td />{cols.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, ri) => <tr key={r}><th scope="row">{r}</th>{values[ri].map((v, ci) => {
        const key = `${r}-${ci}`
        return <td key={key}><span className={`heat-cell heat-${level(v)} ${active === key ? 'is-active' : ''}`} tabIndex={0} title={`${r} ${cols[ci]}: ${v} ${unit}`}
          onPointerEnter={() => setActive(key)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(key)} onBlur={() => setActive(null)}>
          <span className={active === key ? 'heat-value is-on' : 'heat-value'}>{v}</span><span className="sr-only">{`${r} ${cols[ci]}: ${v} ${unit}`}</span>
        </span></td>
      })}</tr>)}</tbody>
    </table>
    <div className="heat-legend" aria-hidden="true"><span>Sedikit</span>{Array.from({ length: steps }, (_, i) => <i key={i} className={`heat-cell heat-${i}`} />)}<span>Banyak</span></div>
  </div>
}

/** Batang tersegmentasi untuk komposisi bagian-dari-keseluruhan (maks. 3 segmen, label langsung). */
export function SegmentBar({ items, unit }: { items: Array<{ label: string; value: number; tone: string }>; unit: string }) {
  const total = items.reduce((t, i) => t + (Number.isFinite(Number(i.value)) ? Number(i.value) : 0), 0)
  return <div className="segment">
    <div className="segment-bar" role="img" aria-label={`${unit}: ${items.map(i => `${i.label} ${i.value}`).join(', ')}`}>
      {items.map(i => <span key={i.label} className={`seg seg-${i.tone}`} style={{ flexGrow: i.value }} title={`${i.label}: ${fmt(i.value)}`} />)}
    </div>
    <ul className="segment-legend">{items.map(i => { const val = Number.isFinite(Number(i.value)) ? Number(i.value) : 0; return <li key={i.label}><i className={`seg seg-${i.tone}`} aria-hidden="true" /><span>{i.label}</span><strong>{fmt(val)}</strong><small>{total > 0 ? Math.round((val / total) * 100) : 0}%</small></li> })}</ul>
  </div>
}
