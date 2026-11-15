import { useEffect, useState } from 'react'

export function AnimatedNumber({ value: rawValue, duration = 650 }: { value: number; duration?: number }) {
  const value = Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const startVal = 0
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(startVal + (value - startVal) * eased))
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <>{display}</>
}

export function AnimatedProgressRing({
  value,
  max,
  size = 128,
  stroke = 11,
  label,
  sublabel,
}: {
  value: number
  max: number
  size?: number
  stroke?: number
  label: string
  sublabel?: string
}) {
  const safeVal = Number.isFinite(Number(value)) ? Number(value) : 0
  const safeMax = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 0
  const pct = safeMax > 0 ? Math.min(100, Math.max(0, Math.round((safeVal / safeMax) * 100))) : 0
  const [animatedPct, setAnimatedPct] = useState(0)
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimatedPct(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])

  const offset = circ - (animatedPct / 100) * circ

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${pct}%`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--brand)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.85s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div>
            <strong style={{ fontSize: 22, lineHeight: 1, display: 'block', fontVariantNumeric: 'tabular-nums' }}>
              {pct}%
            </strong>
            <small className="muted" style={{ fontSize: 11 }}>
              {value}/{max}
            </small>
          </div>
        </div>
      </div>
      <div style={{ minWidth: 0, flex: '1 1 160px', display: 'grid', gap: 4 }}>
        <strong style={{ fontSize: 15 }}>{label}</strong>
        {sublabel ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {sublabel}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function AnimatedMeterRow({
  label,
  value,
  max,
  tone = 'brand',
  note,
}: {
  label: string
  value: number
  max: number
  tone?: 'brand' | 'good' | 'warn'
  note?: string
}) {
  const safeVal = Number.isFinite(Number(value)) ? Number(value) : 0
  const safeMax = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 0
  const pct = safeMax > 0 ? Math.min(100, Math.max(0, Math.round((safeVal / safeMax) * 100))) : 0
  const [fillWidth, setFillWidth] = useState(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setFillWidth(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])

  const colorVar = tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn)' : 'var(--brand)'

  return (
    <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
        <strong>{label}</strong>
        <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {note ?? `${value}/${max} (${pct}%)`}
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: 'var(--surface-2)',
          overflow: 'hidden',
          border: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.max(fillWidth > 0 ? 4 : 0, fillWidth)}%`,
            borderRadius: 999,
            background: colorVar,
            transition: 'width 0.75s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
    </div>
  )
}
