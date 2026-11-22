import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import {
  CloudRain,
  CloudSnow,
  Cpu,
  LoaderCircle,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Wifi,
} from 'lucide-react'
import { getIdentity } from '../api'
import { useI18n } from '../shared/i18n'
import { type LoginSceneKey, useRealtimeAtmosphere } from './weatherTime'
import { LOGIN_SCENES, resolveTimeScene } from './weatherTime'
import { LabScene } from './LabScene'
import { LaptopMenu } from './LaptopMenu'
import { laptopSceneAt } from './lab-animation'
import { StudioControls } from './StudioControls'
import { resolveLabWeather, sensorSample, studioScene, useStudioSettings, WEATHER_LABELS } from './studio-model'
import './login.css'

const messagesId: Record<string, string> = {
  cancelled: 'Login dibatalkan. Anda bisa mencoba lagi saat siap.',
  expired: 'Waktu login habis atau tautan sudah digunakan. Mulai login kembali.',
  temporary: 'Login belum dapat diproses. Tunggu sebentar, lalu coba lagi.',
  unauthorized: 'Akun Google ini belum memiliki akses. Gunakan akun yang telah diizinkan.',
}

const messagesEn: Record<string, string> = {
  cancelled: 'Sign-in cancelled. You can try again whenever ready.',
  expired: 'Sign-in expired or link was already used. Please start again.',
  temporary: 'Sign-in could not be processed right now. Wait a moment and retry.',
  unauthorized: 'This Google account does not have access. Use an authorized account.',
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
  const { now, weather } = useRealtimeAtmosphere()
  const [settings, setSettings] = useStudioSettings()
  const [seconds, setSeconds] = useState(0)
  const [preview, setPreview] = useState(false)
  const activeWeather = settings.weather === 'auto' ? resolveLabWeather(weather) : settings.weather
  const scene = LOGIN_SCENES[studioScene(settings.time === 'auto' ? resolveTimeScene(now, weather) : settings.time, activeWeather)]
  const sample = sensorSample(seconds, activeWeather, settings.distance, settings.network)

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
  const sceneLabel = settings.weather !== 'auto' ? WEATHER_LABELS[activeWeather][lang === 'en' ? 1 : 0] : lang === 'en' ? scene.labelEn : scene.labelId
  const tempLabel =
    settings.weather !== 'auto' ? ` · ${Math.round(sample.temperature)}°C · ${lang === 'en' ? 'Simulation' : 'Simulasi'}` : typeof weather?.temperature_c === 'number' ? ` · ${Math.round(weather.temperature_c)}°C` : ''

  return (
    <main className="login-v2-shell" id="main" data-theme={settings.theme} data-paused={settings.paused} data-preview={preview}>
      <header className="login-v2-header">
        <a className="brand" href="/" aria-label={tr.brand.homeAria}>
          <BrandLogoMark />
          <span>IFA Lab</span>
        </a>

        <div
          className="login-v2-lang-pill"
          role="group"
          aria-label={lang === 'en' ? 'Language selection' : 'Pilihan bahasa'}
        >
          <button
            type="button"
            className="login-v2-lang-btn"
            aria-pressed={lang === 'id'}
            onClick={() => setLang('id')}
          >
            ID
          </button>
          <button
            type="button"
            className="login-v2-lang-btn"
            aria-pressed={lang === 'en'}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
      </header>

      <section className="login-v2-left" aria-labelledby="login-title">
        <div className="login-v2-main">
          <h1 id="login-title" className="login-v2-title">{tr.brand.loginTitle}</h1>
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
            {redirecting ? (
              <LoaderCircle className="spin" size={24} aria-hidden="true" />
            ) : (
              <img src="/assets/google-g.svg" width="24" height="24" alt="" />
            )}
            <span>{redirecting ? tr.brand.redirecting : tr.brand.googleBtn}</span>
          </button>

          <p className="login-v2-account-note">{tr.brand.accountNote}</p>

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
        </div>

        <StudioControls
          settings={settings}
          setSettings={setSettings}
          en={lang === 'en'}
          preview={preview}
          onPreview={() => setPreview(value => !value)}
        />

        <footer className="login-v2-footer">
          <span>© {now.getFullYear()}</span>
          <nav aria-label={lang === 'en' ? 'Information' : 'Informasi'}>
            <a href="/privasi">{tr.brand.privacyShort}</a>
            <a href="/bantuan">{tr.brand.help}</a>
          </nav>
        </footer>
      </section>

      <aside className="login-v2-right" aria-label={tr.brand.heroTop} data-scene={scene.key}>
        <div className="login-lab-stage">
          <img
            className="hero-image"
            src={scene.src}
            width="1446"
            height="1087"
            alt=""
            fetchPriority="high"
          />
          <LabScene scene={scene} weather={activeWeather} settings={settings} en={lang === 'en'} onSample={setSeconds} />
          <LaptopMenu time={scene.key} selected={laptopSceneAt(seconds, settings.program).mode} onSelect={program => setSettings(s => ({ ...s, program }))} />
        </div>

        <div className="login-v2-cards-stack">
          <div className="login-v2-glass-card">
            <div className="login-v2-card-head">
              <span className="login-v2-card-title">
                <Wifi size={14} className="login-v2-card-icon" aria-hidden="true" />
                <span>{tr.brand.cardNetTitle}</span>
              </span>
            </div>
            <div className="login-v2-net-body">
              <svg className="login-v2-wave" viewBox="0 0 140 38" fill="none" aria-hidden="true">
                <path
                  d={Array.from({ length: 36 }, (_, i) => `${i ? 'L' : 'M'}${i * 4},${settings.network === 0 ? 30 : 22 + Math.sin(i * .6 - seconds * 1.7) * 7 + Math.sin(i * .23 + seconds) * 5}`).join(' ')}
                  stroke="#5eead4"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <div className="login-v2-net-metrics">
                <span className="login-v2-net-up">↑ {sample.upload.toFixed(1)} Mbps</span>
                <span>↓ {sample.download.toFixed(1)} Mbps</span>
              </div>
            </div>
          </div>

          <div className="login-v2-glass-card">
            <div className="login-v2-card-head">
              <span className="login-v2-card-title">
                <Cpu size={14} className="login-v2-card-icon" aria-hidden="true" />
                <span>{tr.brand.cardIotTitle}</span>
              </span>
            </div>
            <div className="login-v2-iot-body">
              <span className="login-v2-iot-active">
                <span className="login-v2-iot-dot" aria-hidden="true" />
                {tr.brand.cardIotActive}
              </span>
              <span>{sample.temperature.toFixed(1)}°C · {sample.humidity.toFixed(0)}% RH</span>
            </div>
            <p className="login-sensor-note">HC-SR04 · {sample.distance.toFixed(1)} cm · {lang === 'en' ? 'Simulation' : 'Simulasi'}</p>
          </div>

          <div className="login-v2-atmosphere-pill" data-testid="login-atmosphere">
            <SceneWeatherIcon scene={scene.key} />
            <span>
              {timeLabel} · {sceneLabel}
              {tempLabel}
            </span>
          </div>
        </div>
      </aside>
    </main>
  )
}
