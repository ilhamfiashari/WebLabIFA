import { Activity, Globe, Radio, RefreshCw, Send, Wifi, WifiOff } from 'lucide-react'
import { Fragment, createElement, useCallback, useMemo, useState, type ReactNode } from 'react'
import { interpolateWebTemplate, normalizeWebPath, type SketchFile } from './firmwareVm'
import type { PlacedComponent, SimulationState } from './types'

export interface WebBrowserPanelProps {
  sim: SimulationState
  components: PlacedComponent[]
  extraFiles?: SketchFile[]
  lang: 'id' | 'en'
  initialUrl?: string
  onRequestRoute?: (
    method: 'GET' | 'POST',
    rawUrl: string,
  ) => { status: number; contentType: string; body: string; path: string } | void
}

const ALLOWED_HTML_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'div',
  'section',
  'header',
  'main',
  'footer',
  'span',
  'strong',
  'em',
  'b',
  'i',
  'small',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'a',
  'button',
  'hr',
  'br',
  'blockquote',
  'dl',
  'dt',
  'dd',
])

const SAFE_CLASS_RE = /^[a-zA-Z0-9 _-]+$/

function sanitizeClassName(raw: string | null): string | undefined {
  if (!raw) return undefined
  const filtered = raw
    .split(/\s+/)
    .filter((token) => SAFE_CLASS_RE.test(token) && (token.startsWith('wb-') || token.startsWith('badge') || token.startsWith('btn') || token === 'card' || token === 'grid'))
    .join(' ')
  return filtered || undefined
}

function renderSafeHtmlNodes(
  nodes: NodeListOf<ChildNode>,
  keyPrefix: string,
  onTriggerAction: (path: string, stayOnPage: boolean) => void,
): ReactNode[] {
  const out: ReactNode[] = []
  nodes.forEach((node, index) => {
    const key = `${keyPrefix}-${index}`
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent ?? ''
      if (txt) out.push(<Fragment key={key}>{txt}</Fragment>)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (!ALLOWED_HTML_TAGS.has(tag)) return

    const children = renderSafeHtmlNodes(el.childNodes, key, onTriggerAction)
    const cls = sanitizeClassName(el.getAttribute('class'))
    const title = el.getAttribute('title') || undefined

    if (tag === 'br') {
      out.push(<br key={key} />)
      return
    }
    if (tag === 'hr') {
      out.push(<hr key={key} className={cls} />)
      return
    }
    if (tag === 'button') {
      const action = el.getAttribute('data-iot-action') || el.getAttribute('formaction')
      const stay = el.getAttribute('data-iot-stay') !== 'false'
      out.push(
        <button
          key={key}
          type="button"
          className={cls ? `iot-wb-btn ${cls}` : 'iot-wb-btn'}
          title={title}
          onClick={() => {
            if (action) onTriggerAction(action, stay)
          }}
        >
          {children}
        </button>,
      )
      return
    }
    if (tag === 'a') {
      const href = el.getAttribute('href') || '/'
      const safePath = href.startsWith('/') ? href : el.getAttribute('data-iot-action') || '/'
      out.push(
        <button
          key={key}
          type="button"
          className={cls ? `iot-wb-link ${cls}` : 'iot-wb-link'}
          title={title}
          onClick={() => onTriggerAction(safePath, false)}
        >
          {children}
        </button>,
      )
      return
    }

    out.push(
      createElement(tag, { key, className: cls, title }, children),
    )
  })
  return out
}

function tryParseJsonRecord(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }
  return null
}

function formatJsonValue(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function WebBrowserPanel({
  sim,
  components,
  extraFiles = [],
  lang,
  initialUrl,
  onRequestRoute,
}: WebBrowserPanelProps) {
  const isEn = lang === 'en'
  const baseHost = `http://${sim.wifiIp && sim.wifiIp !== '0.0.0.0' ? sim.wifiIp : '10.13.37.2'}`
  const browserComp = components.find((c) => c.kind === 'web-browser')
  const seedUrl = initialUrl || browserComp?.props.browserUrl || `${baseHost}/`

  const [urlDraft, setUrlDraft] = useState<string | null>(initialUrl ?? null)
  const [activePath, setActivePath] = useState(() => normalizeWebPath(seedUrl))
  const [method, setMethod] = useState<'GET' | 'POST'>('GET')
  const [autoSync, setAutoSync] = useState(true)
  const [actionBanner, setActionBanner] = useState<string | null>(null)
  const [lastManualResponse, setLastManualResponse] = useState<{
    status: number
    contentType: string
    body: string
    path: string
  } | null>(null)
  const urlInput = urlDraft ?? `${baseHost}${activePath}`

  const htmlFile = useMemo(
    () =>
      extraFiles.find((f) => f.name.toLowerCase() === 'index.html') ??
      extraFiles.find((f) => f.name.toLowerCase().endsWith('.html')),
    [extraFiles],
  )

  const handleTriggerAction = useCallback(
    (rawTarget: string, stayOnPage: boolean, reqMethod: 'GET' | 'POST' = method) => {
      const targetPath = normalizeWebPath(rawTarget)
      const fullUrl =
        rawTarget.startsWith('http://') || rawTarget.startsWith('https://')
          ? rawTarget
          : `${baseHost}${targetPath}`

      const res = onRequestRoute?.(reqMethod, targetPath)
      if (res) {
        setActionBanner(`${reqMethod} ${res.path} -> ${res.status}`)
        if (!stayOnPage) {
          setActivePath(res.path)
          setUrlDraft(fullUrl)
          setLastManualResponse(res)
        } else {
          setLastManualResponse(null)
        }
        return
      }

      if (!stayOnPage) {
        setActivePath(targetPath)
        setUrlDraft(fullUrl)
      }
    },
    [baseHost, method, onRequestRoute],
  )

  const handleSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault()
    const targetPath = normalizeWebPath(urlInput)
    setActivePath(targetPath)
    const res = onRequestRoute?.(method, urlInput)
    if (res) {
      setActionBanner(`${method} ${res.path} -> ${res.status}`)
      setLastManualResponse(res)
    } else {
      setLastManualResponse(null)
    }
  }

  const activeRoute = sim.webRoutes[activePath]

  const currentView = useMemo(() => {
    if (!autoSync && lastManualResponse && lastManualResponse.path === activePath) {
      return lastManualResponse
    }
    if (activeRoute) {
      const body = activeRoute.contentType.includes('html')
        ? interpolateWebTemplate(activeRoute.body, sim, sim.webSensorReadings)
        : activeRoute.body
      return {
        status: activeRoute.status,
        contentType: activeRoute.contentType,
        body,
        path: activeRoute.path,
      }
    }
    if (activePath === '/' && htmlFile && (sim.running || sim.webServerActive)) {
      return {
        status: 200,
        contentType: 'text/html',
        body: interpolateWebTemplate(htmlFile.content, sim, sim.webSensorReadings),
        path: '/',
      }
    }
    if (lastManualResponse && lastManualResponse.path === activePath) {
      return lastManualResponse
    }
    return null
  }, [activePath, activeRoute, autoSync, htmlFile, lastManualResponse, sim])

  const parsedHtmlTree = useMemo(() => {
    if (!currentView || !currentView.contentType.includes('html')) return null
    const parser = new DOMParser()
    const doc = parser.parseFromString(currentView.body, 'text/html')
    return renderSafeHtmlNodes(doc.body.childNodes, 'wb-root', (p, stay) => handleTriggerAction(p, stay, 'GET'))
  }, [currentView, handleTriggerAction])

  const parsedJson = useMemo(() => {
    if (!currentView) return null
    if (!currentView.contentType.includes('json') && !currentView.body.trim().startsWith('{')) {
      return null
    }
    return tryParseJsonRecord(currentView.body)
  }, [currentView])

  const quickRoutes = useMemo(() => {
    const base = ['/', '/api/sensors']
    const registered = Object.keys(sim.webRoutes)
    const merged = Array.from(new Set([...base, ...registered, '/led/on', '/led/off']))
    return merged.slice(0, 8)
  }, [sim.webRoutes])

  const readingsList = useMemo(
    () =>
      Object.entries(sim.webSensorReadings).filter(
        ([k]) =>
          k === k.toUpperCase() &&
          !['WIFI_CONNECTED'].includes(k),
      ),
    [sim.webSensorReadings],
  )

  return (
    <div className="iot-browser-shell" data-testid="iot-web-browser-panel">
      <div className="iot-browser-toolbar">
        <div className={`iot-browser-net-pill ${sim.webServerActive ? 'online' : ''}`}>
          {sim.webServerActive ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>
            {sim.webServerActive
              ? `LIVE · ${sim.wifiIp !== '0.0.0.0' ? sim.wifiIp : '10.13.37.2'}`
              : isEn
                ? 'SERVER IDLE'
                : 'SERVER NONAKTIF'}
          </span>
        </div>

        <form className="iot-browser-url-form" onSubmit={handleSubmitUrl}>
          <select
            className="iot-browser-method"
            aria-label={isEn ? 'HTTP method' : 'Metode HTTP'}
            value={method}
            onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
          <div className="iot-browser-url-wrap">
            <Globe size={13} />
            <input
              type="text"
              className="iot-browser-url-input"
              aria-label={isEn ? 'Browser URL' : 'Alamat URL Browser'}
              value={urlInput}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="http://10.13.37.2/"
            />
          </div>
          <button type="submit" className="iot-btn tiny primary">
            <Send size={12} /> {isEn ? 'Go' : 'Buka'}
          </button>
          <button
            type="button"
            className="iot-btn tiny"
            title={isEn ? 'Reload active route' : 'Muat ulang halaman'}
            onClick={() => handleTriggerAction(activePath, false, method)}
          >
            <RefreshCw size={12} />
          </button>
        </form>

        <button
          type="button"
          className={`iot-browser-sync-btn ${autoSync ? 'active' : ''}`}
          onClick={() => setAutoSync((v) => !v)}
          title={isEn ? 'Auto-sync live sensor telemetry to Web view' : 'Sinkronkan sensor langsung ke tampilan Web'}
        >
          <Radio size={12} /> {isEn ? 'Live Sync' : 'Live Sync'}
        </button>
      </div>

      <div className="iot-browser-routes-bar">
        <span className="iot-browser-routes-label">{isEn ? 'Routes:' : 'Rute:'}</span>
        {quickRoutes.map((routePath) => (
          <button
            key={routePath}
            type="button"
            className={`iot-browser-route-chip ${activePath === routePath ? 'active' : ''}`}
            onClick={() => handleTriggerAction(routePath, false, 'GET')}
          >
            {routePath}
          </button>
        ))}
        {actionBanner && <span className="iot-browser-status-toast">{actionBanner}</span>}
      </div>

      <div className="iot-browser-content-grid">
        <div className="iot-browser-viewport-card">
          <div className="iot-browser-viewport-head">
            <div className="iot-browser-chrome-dots">
              <span />
              <span />
              <span />
            </div>
            <span className="iot-browser-viewport-path">
              {baseHost}
              {activePath}
            </span>
            {currentView && (
              <span
                className={`iot-browser-http-badge ${
                  currentView.status >= 200 && currentView.status < 300 ? 'ok' : 'err'
                }`}
              >
                {currentView.status} · {currentView.contentType}
              </span>
            )}
          </div>

          <div className="iot-browser-viewport-body" data-testid="iot-browser-rendered-body">
            {!sim.webServerActive && !currentView ? (
              <div className="iot-browser-empty">
                <strong>
                  {isEn
                    ? 'WebServer not active yet'
                    : 'WebServer ESP32 belum berjalan'}
                </strong>
                <p>
                  {isEn
                    ? 'Click Run so firmware calls server.begin() / serves index.html, then live sensor readings from your canvas will render right here.'
                    : 'Klik Jalankan agar firmware memanggil server.begin() atau menyajikan index.html, sehingga pembacaan sensor kanvas tampil langsung di halaman Web ini.'}
                </p>
              </div>
            ) : currentView ? (
              parsedHtmlTree ? (
                <div className="iot-wb-document">{parsedHtmlTree}</div>
              ) : parsedJson ? (
                <div className="iot-browser-json-view">
                  <div className="iot-browser-json-cards">
                    {Object.entries(parsedJson).map(([k, v]) => (
                      <div key={k} className="iot-browser-kv-card">
                        <span>{k}</span>
                        <strong>{formatJsonValue(v)}</strong>
                      </div>
                    ))}
                  </div>
                  <pre className="iot-browser-pre">{JSON.stringify(parsedJson, null, 2)}</pre>
                </div>
              ) : (
                <pre className="iot-browser-pre">{currentView.body}</pre>
              )
            ) : (
              <div className="iot-browser-empty">
                <strong>404 Not Found</strong>
                <p>
                  {isEn
                    ? `Route "${activePath}" is not registered via server.on("${activePath}", ...).`
                    : `Rute "${activePath}" belum didaftarkan dengan server.on("${activePath}", ...).`}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="iot-browser-side-col">
          <div className="iot-browser-telemetry-card">
            <div className="iot-browser-side-title">
              <Activity size={13} />
              <span>{isEn ? 'Live Sensor Template Feed' : 'Feed Sensor Live ke Web'}</span>
            </div>
            <div className="iot-browser-kv-list">
              {readingsList.map(([key, val]) => (
                <div key={key} className="iot-browser-kv-row">
                  <code>{`{{${key}}}`}</code>
                  <strong>{String(val)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="iot-browser-logs-card">
            <div className="iot-browser-side-title">
              <span>{isEn ? 'HTTP Request Log' : 'Log Permintaan HTTP'}</span>
              <span className="iot-muted">{sim.httpLogs.length}</span>
            </div>
            {sim.httpLogs.length === 0 ? (
              <div className="iot-empty">
                {isEn
                  ? 'Click Go or any route button to inspect simulated HTTP requests.'
                  : 'Klik Buka atau tombol rute untuk menguji permintaan HTTP dari Web Browser.'}
              </div>
            ) : (
              <div className="iot-browser-log-list">
                {sim.httpLogs
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <div key={entry.id} className="iot-browser-log-row">
                      <span className="iot-browser-log-method">{entry.method}</span>
                      <code className="iot-browser-log-path">{entry.url}</code>
                      <span
                        className={`iot-browser-http-badge ${
                          entry.status >= 200 && entry.status < 300 ? 'ok' : 'err'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
