import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ChevronDown, X, type LucideIcon } from 'lucide-react'
import { ApiError } from '../api'
import { InlineErrorAlert } from '../shared/errors/ErrorView'
import { useI18n } from '../shared/i18n'
import { useDismiss } from './hooks'

export function Popover({ label, trigger, children, className, align = 'end' }: { label: string; trigger: ReactNode; children: (close: () => void) => ReactNode; className?: string; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const close = useMemo(() => () => setOpen(false), [])
  const ref = useDismiss(open, close)
  return <div className="popover" ref={ref}>
    <button type="button" className={`control ${className ?? ''}`} aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={() => setOpen(v => !v)}>{trigger}</button>
    {open && <div className={`popover-panel align-${align}`}>{children(close)}</div>}
  </div>
}

export function Logo() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="ifaLogoBg" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e563f" />
          <stop offset="100%" stopColor="#0f3324" />
        </linearGradient>
        <linearGradient id="ifaLogoRing" x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#ifaLogoBg)" stroke="url(#ifaLogoRing)" strokeWidth="1.6" />
      <path d="M20 7.5 31 12v8.2c0 7-4.7 11.7-11 13.8-6.3-2.1-11-6.8-11-13.8V12l11-4.5Z" fill="#34d399" fillOpacity="0.16" stroke="url(#ifaLogoRing)" strokeWidth="1.7" strokeLinejoin="round" />
      <rect x="14.5" y="19" width="11" height="8" rx="1.6" fill="#ffffff" />
      <path d="M17 19v-2.2a3 3 0 0 1 6 0V19" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="20" cy="23" r="1.3" fill="#0f3324" />
    </svg>
  )
}

export type Tone = 'good' | 'warn' | 'muted' | 'bad' | 'info'
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) { return <span className={`badge badge-${tone}`}><i aria-hidden="true" />{children}</span> }

export function Select<T extends string>({ label, value, onChange, options, icon: Icon }: { label: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; icon: LucideIcon }) {
  return <label className="select"><Icon size={16} aria-hidden="true" /><span className="sr-only">{label}</span>
    <select value={value} onChange={e => onChange(e.target.value as T)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    <ChevronDown size={16} aria-hidden="true" /></label>
}

export function Kpi({ label, value, note, icon: Icon }: { label: string; value: ReactNode; note?: ReactNode; icon: LucideIcon }) {
  return <div className="card kpi"><div><p className="kpi-label">{label}</p><p className="kpi-value">{value}</p>{note && <p className="kpi-note">{note}</p>}</div><span className="kpi-icon"><Icon size={18} aria-hidden="true" /></span></div>
}

export function NavLink({ to, go, className, children, ...rest }: { to: string; go: (to: string) => void; className?: string; children: ReactNode; 'aria-label'?: string; 'aria-current'?: 'page' | 'step' }) {
  const onClick = (e: MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); go(to) }
  return <a href={to} className={className} onClick={onClick} {...rest}>{children}</a>
}

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [onClose])
  return <div className="drawer-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
      <header><h2>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} aria-hidden="true" /></button></header>
      <div className="drawer-body">{children}</div>
    </div>
  </div>
}

export function PageHead({ title, description, tag, actions }: { title: string; description: string; tag?: ReactNode; actions?: ReactNode }) {
  return <div className="page-head"><div><div className="page-title"><h1>{title}</h1>{tag}</div><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>
}

export function SessionCard({ name, email, role, expiresAt }: { name: string; email: string; role: string; expiresAt: string }) {
  const { tr, lang } = useI18n()
  const locale = lang === 'en' ? 'en-US' : 'id-ID'
  const roleLabel = tr.shell.roles[role as keyof typeof tr.shell.roles] ?? role
  return <section className="card session-card" aria-labelledby="session-title">
    <header className="card-head"><div><h2 id="session-title">{tr.shell.sessionTitle}</h2><p>{tr.shell.sessionDesc}</p></div><span className="session-active"><i aria-hidden="true" />{tr.shell.sessionActive}</span></header>
    <dl className="detail-list"><div><dt>{tr.shell.name}</dt><dd>{name}</dd></div><div><dt>{tr.shell.googleAccount}</dt><dd>{email}</dd></div><div><dt>{tr.shell.role}</dt><dd className="capitalize">{roleLabel}</dd></div><div><dt>{tr.shell.sessionLimit}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(expiresAt))}</dd></div></dl>
  </section>
}

export function TrackTabs({ tracks, value, onChange }: { tracks: Array<{ id: string; title: string; note?: string }>; value: string; onChange: (id: string) => void }) {
  return <div className="track-tabs" role="tablist" aria-label="Jalur latihan">{tracks.map(t => <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}><span>{t.title}</span>{t.note && <small>{t.note}</small>}</button>)}</div>
}

export function LoadState({ error, onRetry, status, homeHref, onGoHome }: { error: boolean; onRetry: () => void; status?: number; homeHref?: string; onGoHome?: () => void }) {
  const { lang } = useI18n()
  if (error) {
    const code = status ?? 500
    return (
      <InlineErrorAlert
        status={code}
        onRetry={onRetry}
        onGoHome={onGoHome ?? (homeHref ? () => window.location.assign(homeHref) : undefined)}
      />
    )
  }
  return <div className="card load-state" role="status"><p>{lang === 'en' ? 'Loading lab content…' : 'Memuat latihan…'}</p></div>
}

export function extractErrorStatus(err: unknown): number {
  if (err instanceof ApiError) return err.status
  return 400
}
