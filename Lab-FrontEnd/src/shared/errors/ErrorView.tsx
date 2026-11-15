import { Component, type ReactNode } from 'react'
import { AlertTriangle, FileWarning, Home, LockKeyhole, RefreshCw, RotateCcw, ServerCrash, ShieldAlert } from 'lucide-react'
import { useI18n } from '../i18n'
import './errors.css'

export interface ErrorViewProps {
  status: number
  title?: string
  subtitle?: string
  homeHref?: string
  onStayCurrent?: () => void
  onGoHome?: () => void
  extraActions?: ReactNode
}

function resolveStatusKey(status: number): 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 {
  if (status === 400) return 400
  if (status === 401) return 401
  if (status === 403) return 403
  if (status === 404) return 404
  if (status === 409) return 409
  if (status === 422) return 422
  if (status === 429) return 429
  return 500
}

function StatusIcon({ code }: { code: number }) {
  if (code === 401 || code === 403) return <LockKeyhole size={28} aria-hidden="true" />
  if (code === 404) return <FileWarning size={28} aria-hidden="true" />
  if (code === 400 || code === 422 || code === 409) return <AlertTriangle size={28} aria-hidden="true" />
  if (code >= 500) return <ServerCrash size={28} aria-hidden="true" />
  return <ShieldAlert size={28} aria-hidden="true" />
}

export function ErrorView({
  status,
  title,
  subtitle,
  homeHref = '/',
  onStayCurrent,
  onGoHome,
  extraActions,
}: ErrorViewProps) {
  const { tr } = useI18n()
  const key = resolveStatusKey(status)
  const copy = tr.errors[key]
  const isDanger = status === 403 || status >= 500
  const toneClass = isDanger ? 'is-danger' : 'is-warn'

  const handleStayCurrent = () => {
    if (onStayCurrent) {
      onStayCurrent()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="err-page">
      <section className="err-card" role="alert" aria-live="polite">
        <div className="err-emblem" aria-hidden="true">
          <div className={`err-ring ${toneClass}`} />
          <div className={`err-shield-float ${toneClass}`}>
            <StatusIcon code={key} />
          </div>
        </div>

        <span className="err-code-pill">
          <span className={`err-code-dot ${toneClass}`} aria-hidden="true" />
          HTTP {status}
        </span>

        <h1 className="err-title">{title ?? copy.title}</h1>
        <p className="err-desc">{subtitle ?? copy.subtitle}</p>

        <div className="err-actions">
          <button type="button" className="btn-outline" onClick={handleStayCurrent}>
            <RotateCcw size={16} aria-hidden="true" />
            {tr.errors.backCurrent}
          </button>
          {onGoHome ? (
            <button type="button" className="btn-primary" onClick={onGoHome}>
              <Home size={16} aria-hidden="true" />
              {tr.errors.backHome}
            </button>
          ) : (
            <a className="btn-primary" href={homeHref}>
              <Home size={16} aria-hidden="true" />
              {tr.errors.backHome}
            </a>
          )}
          {extraActions}
        </div>
      </section>
    </div>
  )
}

export function InlineErrorAlert({
  status = 400,
  message,
  onRetry,
  onGoHome,
}: {
  status?: number
  message?: string
  onRetry?: () => void
  onGoHome?: () => void
}) {
  const { tr } = useI18n()
  const key = resolveStatusKey(status)
  const copy = tr.errors[key]
  return (
    <div className="err-banner" role="alert">
      <div className="err-banner-meta">
        <span className="err-code-pill">
          <span className="err-code-dot is-danger" aria-hidden="true" />
          {status}
        </span>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', fontSize: 14 }}>{copy.title}</strong>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{message || copy.subtitle}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {onRetry ? (
          <button type="button" className="btn-outline" style={{ minHeight: 34, fontSize: 13 }} onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" />
            {tr.errors.backCurrent}
          </button>
        ) : null}
        {onGoHome ? (
          <button type="button" className="btn-primary" style={{ minHeight: 34, fontSize: 13 }} onClick={onGoHome}>
            <Home size={14} aria-hidden="true" />
            {tr.errors.backHome}
          </button>
        ) : null}
      </div>
    </div>
  )
}

interface BoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { hasError: false }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="document" id="main">
          <ErrorView
            status={500}
            homeHref="/"
            onStayCurrent={() => {
              this.setState({ hasError: false })
            }}
          />
        </main>
      )
    }
    return this.props.children
  }
}
