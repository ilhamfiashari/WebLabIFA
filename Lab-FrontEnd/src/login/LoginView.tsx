import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  CloudRain,
  CloudSnow,
  Cpu,
  FlaskConical,
  Globe,
  Info,
  Layers,
  LoaderCircle,
  Monitor,
  Moon,
  Share2,
  ShieldCheck,
  Sun,
  Sunrise,
  Sunset,
  Wifi,
} from 'lucide-react'
import { getIdentity } from '../api'
import { useI18n } from '../shared/i18n'
import { type LoginSceneKey, useRealtimeAtmosphere } from './weatherTime'
import './login.css'

const messagesId: Record<string, string> = {
  cancelled: 'Login dibatalkan. Anda bisa mencoba lagi saat siap.',
  expired: 'Waktu login habis atau tautan sudah digunakan. Mulai login kembali.',
  temporary: 'Login belum dapat diproses. Tunggu sebentar, lalu coba lagi.',
  unauthorized: 'Akun Google ini tidak memiliki akses ke IFA Lab. Gunakan akun yang telah diizinkan.',
}

const messagesEn: Record<string, string> = {
  cancelled: 'Sign-in cancelled. You can try again whenever ready.',
  expired: 'Sign-in expired or link was already used. Please start again.',
  temporary: 'Sign-in could not be processed right now. Wait a moment and retry.',
  unauthorized: 'This Google account does not have access to IFA Lab. Use an authorized account.',
}

function SceneWeatherIcon({ scene }: { scene: LoginSceneKey }) {
  switch (scene) {
    case 'sunrise':
      return <Sunrise size={13} className="login-v2-card-icon" aria-hidden="true" />
    case 'day':
      return <Sun size={13} className="login-v2-card-icon" aria-hidden="true" />
    case 'sunset':
      return <Sunset size={13} className="login-v2-card-icon" aria-hidden="true" />
    case 'rainy':
      return <CloudRain size={13} className="login-v2-card-icon" aria-hidden="true" />
    case 'snowy':
      return <CloudSnow size={13} className="login-v2-card-icon" aria-hidden="true" />
    default:
      return <Moon size={13} className="login-v2-card-icon" aria-hidden="true" />
  }
}

export function BrandLogoMark() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="ifaBrandBg" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#146341" />
          <stop offset="100%" stopColor="#093d26" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#ifaBrandBg)" />
      <path
        d="M20 8.5 29.5 12.3v7.2c0 6.2-4.1 10.4-9.5 12.3-5.4-1.9-9.5-6.1-9.5-12.3v-7.2L20 8.5Z"
        fill="#34d399"
        fillOpacity="0.14"
        stroke="#e6f7ee"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="15.2" y="19.2" width="9.6" height="7" rx="1.6" fill="#ffffff" />
      <path d="M17.3 19.2v-1.9a2.7 2.7 0 0 1 5.4 0v1.9" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="20" cy="22.7" r="1.15" fill="#0c442b" />
    </svg>
  )
}

export function LoginView() {
  const { tr, lang, setLang } = useI18n()
  const session = useQuery({ queryKey: ['identity'], queryFn: getIdentity })
  const [redirecting, setRedirecting] = useState(false)
  const { now, scene, weather } = useRealtimeAtmosphere()

  const status = new URLSearchParams(window.location.search).get('status') ?? ''
  const messages = lang === 'en' ? messagesEn : messagesId

  useEffect(() => {
    if (session.data) window.location.replace('/lab')
  }, [session.data])

  useEffect(() => {
    const reset = () => setRedirecting(false)
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  const timeLabel = now.toLocaleTimeString(lang === 'en' ? 'en-US' : 'id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const sceneLabel = lang === 'en' ? scene.labelEn : scene.labelId
  const tempLabel =
    typeof weather?.temperature_c === 'number' ? ` · ${Math.round(weather.temperature_c)}°C` : ''

  return (
    <main className="login-v2-shell" id="main">
      <section className="login-v2-left" aria-labelledby="login-title">
        <svg
          className="login-v2-hills"
          viewBox="0 0 600 220"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,145 C120,105 220,175 360,128 C465,92 535,115 600,98 L600,220 L0,220 Z"
            fill="#e9ede4"
          />
          <path
            d="M0,178 C150,152 290,202 440,162 C515,142 560,156 600,148 L600,220 L0,220 Z"
            fill="#eef1ea"
          />
        </svg>

        <svg
          className="login-v2-curve"
          viewBox="0 0 100 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,0 L64,0 C88,240 98,520 72,800 C62,900 62,955 68,1000 L0,1000 Z"
            fill="#f7f6f1"
          />
        </svg>

        <header className="login-v2-header">
          <div className="login-v2-brand-group">
            <a className="brand" href="/" aria-label={tr.brand.homeAria}>
              <BrandLogoMark />
              <span>
                IFA<span className="brand-lab"> Lab</span>
              </span>
            </a>
            <span className="login-v2-brand-divider" aria-hidden="true" />
            <div className="login-v2-brand-sub">
              <span>{tr.brand.subtitleLine1}</span>
              <span>{tr.brand.subtitleLine2}</span>
            </div>
          </div>

          <div
            className="login-v2-lang-pill"
            role="group"
            aria-label={lang === 'en' ? 'Language selection' : 'Pilihan bahasa'}
          >
            <span className="login-v2-lang-globe" aria-hidden="true">
              <Globe size={13} />
            </span>
            <button
              type="button"
              className={`login-v2-lang-btn${lang === 'id' ? ' is-active' : ''}`}
              aria-pressed={lang === 'id'}
              onClick={() => setLang('id')}
            >
              ID
            </button>
            <button
              type="button"
              className={`login-v2-lang-btn${lang === 'en' ? ' is-active' : ''}`}
              aria-pressed={lang === 'en'}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>
        </header>

        <div className="login-v2-main">
          <div className="login-v2-eyebrow-row">
            <span className="login-v2-eyebrow-line" aria-hidden="true" />
            <p className="login-v2-eyebrow">{tr.brand.eyebrow}</p>
          </div>

          <h1 id="login-title" className="login-v2-title">
            {tr.brand.loginTitleLine1} <br />
            {tr.brand.loginTitleLine2}
          </h1>

          <p className="login-v2-desc">{tr.brand.loginDesc}</p>

          <button
            type="button"
            className="login-v2-google-btn"
            disabled={redirecting}
            onClick={() => {
              setRedirecting(true)
              window.location.assign('/api/auth/google/start')
            }}
          >
            <span className="login-v2-google-left">
              {redirecting ? (
                <LoaderCircle className="spin" size={20} aria-hidden="true" />
              ) : (
                <img src="/assets/google-g.svg" width="20" height="20" alt="" />
              )}
              <span>{redirecting ? tr.brand.redirecting : tr.brand.googleBtn}</span>
            </span>
            <ArrowRight size={17} className="login-v2-google-arrow" aria-hidden="true" />
          </button>

          <div aria-live="polite" className="login-feedback">
            {messages[status] && (
              <p role="status" className="notice">
                {messages[status]}
              </p>
            )}
            {session.isError && (
              <p className="notice">
                {lang === 'en'
                  ? 'Session status could not be checked.'
                  : 'Status sesi belum dapat diperiksa.'}{' '}
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => void session.refetch()}
                >
                  {lang === 'en' ? 'Retry' : 'Coba lagi'}
                </button>
              </p>
            )}
            {redirecting && <p role="status">{tr.brand.openingGoogle}</p>}
          </div>

          <div className="login-v2-features">
            <div className="login-v2-feature-item">
              <ShieldCheck size={17} className="login-v2-feature-icon" aria-hidden="true" />
              <span>{tr.brand.featureSafe}</span>
            </div>
            <div className="login-v2-feature-item">
              <FlaskConical size={17} className="login-v2-feature-icon" aria-hidden="true" />
              <span>{tr.brand.featureScenario}</span>
            </div>
            <div className="login-v2-feature-item">
              <Layers size={17} className="login-v2-feature-icon" aria-hidden="true" />
              <span>{tr.brand.featureModule}</span>
            </div>
          </div>

          <div className="login-v2-divider" role="separator" />

          <div className="login-v2-info-note">
            <Info size={15} className="login-v2-info-icon" aria-hidden="true" />
            <span>{tr.brand.accountNote}</span>
          </div>
        </div>

        <footer className="login-v2-footer">
          <span>
            © {new Date().getFullYear()} IFA Lab. {tr.brand.rightsReserved}
          </span>
          <nav aria-label={lang === 'en' ? 'Information' : 'Informasi'}>
            <a href="/privasi">{tr.brand.privacy}</a>
            <a href="/bantuan">
              {tr.brand.help} <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </nav>
        </footer>
      </section>

      <aside className="login-v2-right" aria-label={tr.brand.heroTop} data-scene={scene.key}>
        <img
          className="hero-image"
          src={scene.src}
          width="1446"
          height="1087"
          alt=""
          fetchPriority="high"
        />

        <div className="login-v2-cards-stack">
          <div className="login-v2-glass-card">
            <div className="login-v2-card-head">
              <span className="login-v2-card-title">
                <Wifi size={14} className="login-v2-card-icon" aria-hidden="true" />
                <span>{tr.brand.cardNetTitle}</span>
              </span>
              <ChevronRight size={14} opacity={0.75} aria-hidden="true" />
            </div>
            <div className="login-v2-net-body">
              <svg className="login-v2-wave" viewBox="0 0 140 38" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="netWaveFill" x1="0" y1="0" x2="0" y2="38" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#4ade80" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path
                  d="M2,33 C18,32 24,25 38,24 C52,23 64,10 78,11 C92,12 102,24 116,22 C126,20 132,27 138,26 L138,37 L2,37 Z"
                  fill="url(#netWaveFill)"
                />
                <path
                  d="M2,33 C18,32 24,25 38,24 C52,23 64,10 78,11 C92,12 102,24 116,22 C126,20 132,27 138,26"
                  stroke="#5eead4"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <div className="login-v2-net-metrics">
                <span className="login-v2-net-up">↑ 24.8 Mbps</span>
                <span>↓ 3.6 Mbps</span>
              </div>
            </div>
          </div>

          <div className="login-v2-glass-card">
            <div className="login-v2-card-head">
              <span className="login-v2-card-title">
                <Cpu size={14} className="login-v2-card-icon" aria-hidden="true" />
                <span>{tr.brand.cardIotTitle}</span>
              </span>
              <ChevronRight size={14} opacity={0.75} aria-hidden="true" />
            </div>
            <div className="login-v2-iot-body">
              <span className="login-v2-iot-active">
                <span className="login-v2-iot-dot" aria-hidden="true" />
                {tr.brand.cardIotActive}
              </span>
              <span>{tr.brand.cardIotNew}</span>
            </div>
          </div>

          <div className="login-v2-atmosphere-pill" data-testid="login-atmosphere">
            <SceneWeatherIcon scene={scene.key} />
            <span>
              {timeLabel} · {sceneLabel}
              {tempLabel}
            </span>
          </div>
        </div>

        <div className="login-v2-hero-bottom">
          <h2 className="login-v2-hero-heading">
            {tr.brand.heroTitlePrefix} <br />
            <span className="login-v2-hero-accent">{tr.brand.heroTitleAccent}</span>
          </h2>

          <div className="login-v2-pills-row">
            <span className="login-v2-hero-pill">
              <Monitor size={14} aria-hidden="true" />
              <span>{tr.brand.pillWeb}</span>
            </span>
            <span className="login-v2-hero-pill">
              <Cpu size={14} aria-hidden="true" />
              <span>{tr.brand.pillIot}</span>
            </span>
            <span className="login-v2-hero-pill">
              <Share2 size={14} aria-hidden="true" />
              <span>{tr.brand.pillNetwork}</span>
            </span>
          </div>

          <p className="login-v2-hero-quote">{tr.brand.heroSub}</p>
        </div>
      </aside>
    </main>
  )
}
