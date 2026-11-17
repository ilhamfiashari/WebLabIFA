import { Component, useEffect, type ReactNode } from 'react'
import { Globe, Home, RefreshCw } from 'lucide-react'
import { useI18n } from '../i18n'
import { ErrorIllustration } from './ErrorIllustration'
import { resolveStatusKey } from './error-status'
import './error-layout.css'

export interface ErrorViewProps {
  status: number
  title?: string
  subtitle?: string
  homeHref?: string
  onStayCurrent?: () => void
  onGoHome?: () => void
  extraActions?: ReactNode
}

export function ErrorPage(props: ErrorViewProps) {
  const { lang, setLang, tr } = useI18n()
  const title = props.title ?? tr.errors[resolveStatusKey(props.status)].title
  useEffect(() => { document.title = `${title} · IFA Lab` }, [title])
  return <main className="err-document" id="main">
    <header className="err-header"><a className="err-brand" href="/" aria-label={tr.brand.homeAria}><span><svg width="32" height="32" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 5L32 10V20C32 28 27 33 20 36C13 33 8 28 8 20V10Z" fill="#229b70" stroke="#e0f8ea" strokeWidth="1.5" /><rect x="14" y="19" width="12" height="9" rx="2" fill="#fff" /><path d="M16 19V16A4 4 0 0 1 24 16V19" stroke="#fff" strokeWidth="2" /><circle cx="20" cy="23" r="1.3" fill="#146045" /></svg></span>IFA Lab</a><button type="button" className="err-language" onClick={() => setLang(lang === 'en' ? 'id' : 'en')} aria-label={lang === 'en' ? 'Ganti bahasa ke Indonesia' : 'Switch language to English'}><Globe size={18} aria-hidden="true" />{lang === 'en' ? 'EN → ID' : 'ID → EN'}</button></header>
    <ErrorView {...props} />
    <svg className="err-waves" viewBox="0 0 1440 230" preserveAspectRatio="none" aria-hidden="true"><path d="M0 80C180 0 270 245 532 142S880 240 1105 80S1340 10 1440 0V230H0Z" fill="#e5f4ec" /><path d="M0 153C170 94 258 232 520 197S849 133 1040 185S1320 98 1440 113V230H0Z" fill="#cce9dc" /></svg>
  </main>
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
        <ErrorIllustration status={status} />

        <span className="err-code-pill">
          <span className={`err-code-dot ${toneClass}`} aria-hidden="true" />
          HTTP {status}
        </span>

        <h1 className="err-title">{title ?? copy.title}</h1>
        <p className="err-desc">{subtitle ?? copy.subtitle}</p>

        <div className="err-actions">
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
          <button type="button" className="btn-outline" onClick={handleStayCurrent}>
            <RefreshCw size={18} aria-hidden="true" />
            {tr.errors.retry}
          </button>
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
          <ErrorPage
            status={500}
            homeHref="/"
            onStayCurrent={() => {
              this.setState({ hasError: false })
            }}
          />
      )
    }
    return this.props.children
  }
}
