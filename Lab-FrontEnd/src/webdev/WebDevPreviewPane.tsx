import {
  Database,
  Globe,
  Laptop,
  Play,
  RefreshCw,
  Server,
  Smartphone,
  Tablet,
  Terminal,
} from 'lucide-react'
import { Fragment, createElement, useCallback, useMemo, useState, type ReactNode } from 'react'
import { Badge } from '../portal/ui'
import {
  invokeVirtualFastApi,
  matchElementCss,
  parseSafeCssRules,
  type JsDomBinding,
  type ParsedCssRule,
  type ReactComponentModel,
} from './sandboxEngine'
import type {
  WebDevFastApiRoute,
  WebDevFile,
  WebDevHttpLog,
  WebDevSqlTable,
} from './types'

export type PreviewSubTab = 'preview' | 'console' | 'api' | 'db'

const ALLOWED_WEB_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'div',
  'section',
  'header',
  'nav',
  'main',
  'footer',
  'article',
  'aside',
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
  'form',
  'label',
  'input',
  'textarea',
  'select',
  'option',
  'button',
  'a',
  'hr',
  'br',
  'blockquote',
])

const VOID_TAGS = new Set(['br', 'hr', 'input'])

interface MarkupAstNode {
  kind: 'text' | 'element'
  text?: string
  tag?: string
  attrs?: Record<string, string>
  hasReactClick?: boolean
  children?: MarkupAstNode[]
}

function parseTagAttrs(rawAttrs: string): { attrs: Record<string, string>; hasReactClick: boolean } {
  const attrs: Record<string, string> = {}
  let hasReactClick = false
  let i = 0
  const len = rawAttrs.length
  while (i < len) {
    while (i < len && /\s/.test(rawAttrs[i])) i++
    if (i >= len) break
    let name = ''
    while (i < len && /[a-zA-Z0-9_:-]/.test(rawAttrs[i])) {
      name += rawAttrs[i]
      i++
    }
    if (!name) {
      i++
      continue
    }
    while (i < len && /\s/.test(rawAttrs[i])) i++
    if (rawAttrs[i] !== '=') {
      attrs[name.toLowerCase()] = ''
      continue
    }
    i++
    while (i < len && /\s/.test(rawAttrs[i])) i++
    if (i >= len) break
    const ch = rawAttrs[i]
    if (ch === '"' || ch === "'") {
      const q = ch
      i++
      let val = ''
      while (i < len && rawAttrs[i] !== q) {
        val += rawAttrs[i]
        i++
      }
      if (rawAttrs[i] === q) i++
      attrs[name.toLowerCase()] = val
    } else if (ch === '{') {
      let depth = 1
      i++
      while (i < len && depth > 0) {
        if (rawAttrs[i] === '{') depth++
        else if (rawAttrs[i] === '}') depth--
        i++
      }
      if (name === 'onClick' || name === 'onclick') hasReactClick = true
    } else {
      let val = ''
      while (i < len && !/\s/.test(rawAttrs[i])) {
        val += rawAttrs[i]
        i++
      }
      attrs[name.toLowerCase()] = val
    }
  }
  return { attrs, hasReactClick }
}

/**
 * Pure TypeScript HTML/JSX tokenizer into an immutable AST without DOMParser/innerHTML,
 * ensuring DOM text is never reinterpreted as browser HTML.
 */
function parseMarkupToAst(markup: string): MarkupAstNode[] {
  const root: MarkupAstNode[] = []
  const stack: Array<{ tag: string; children: MarkupAstNode[] }> = [{ tag: '__root__', children: root }]
  let i = 0
  const len = markup.length

  const pushNode = (node: MarkupAstNode) => {
    stack[stack.length - 1].children.push(node)
  }

  while (i < len) {
    if (markup.startsWith('<!--', i)) {
      const endComment = markup.indexOf('-->', i + 4)
      i = endComment === -1 ? len : endComment + 3
      continue
    }
    if (markup[i] === '<') {
      if (markup[i + 1] === '/') {
        const closeEnd = markup.indexOf('>', i + 2)
        if (closeEnd === -1) break
        const closeTag = markup.slice(i + 2, closeEnd).trim().toLowerCase()
        for (let s = stack.length - 1; s >= 1; s--) {
          if (stack[s].tag === closeTag) {
            stack.length = s
            break
          }
        }
        i = closeEnd + 1
        continue
      }
      if (/[a-zA-Z]/.test(markup[i + 1] ?? '')) {
        let j = i + 1
        let quote: string | null = null
        let braceDepth = 0
        while (j < len) {
          const ch = markup[j]
          if (quote) {
            if (ch === quote && markup[j - 1] !== '\\') quote = null
          } else {
            if (ch === '"' || ch === "'") quote = ch
            else if (ch === '{') braceDepth++
            else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1)
            else if (ch === '>' && braceDepth === 0) break
          }
          j++
        }
        if (j >= len) break
        let tagHeader = markup.slice(i + 1, j).trim()
        const selfClosing = tagHeader.endsWith('/')
        if (selfClosing) tagHeader = tagHeader.slice(0, -1).trim()
        const spaceIdx = tagHeader.search(/\s/)
        const tag = (spaceIdx === -1 ? tagHeader : tagHeader.slice(0, spaceIdx)).toLowerCase()
        const rawAttrs = spaceIdx === -1 ? '' : tagHeader.slice(spaceIdx + 1)
        const { attrs, hasReactClick } = parseTagAttrs(rawAttrs)
        const children: MarkupAstNode[] = []
        if (ALLOWED_WEB_TAGS.has(tag)) {
          pushNode({ kind: 'element', tag, attrs, hasReactClick, children })
          if (!selfClosing && !VOID_TAGS.has(tag)) {
            stack.push({ tag, children })
          }
        }
        i = j + 1
        continue
      }
    }

    const nextLt = markup.indexOf('<', i + 1)
    const cut = nextLt === -1 ? len : nextLt
    const txt = markup.slice(i, cut)
    if (txt) pushNode({ kind: 'text', text: txt })
    i = cut
  }

  return root
}

function extractReactArrays(fullSource: string): Record<string, string[]> {
  const arrMatch = /const\s+([a-zA-Z_]\w*)\s*=\s*\[([^\]]+)\]/g
  const arrayVars: Record<string, string[]> = {}
  let am: RegExpExecArray | null
  while ((am = arrMatch.exec(fullSource)) !== null) {
    arrayVars[am[1]] = am[2]
      .split(',')
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  }
  return arrayVars
}

function renderReactTextChunks(
  rawText: string,
  keyPrefix: string,
  arrayVars: Record<string, string[]>,
  stateVal: string | number | boolean | unknown[],
  cssRules: ParsedCssRule[],
): ReactNode {
  if (!rawText.includes('{')) return rawText
  const parts: ReactNode[] = []
  const exprRe = /\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g
  let lastIdx = 0
  let match: RegExpExecArray | null
  let chunkIdx = 0
  while ((match = exprRe.exec(rawText)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<Fragment key={`${keyPrefix}-t-${chunkIdx++}`}>{rawText.slice(lastIdx, match.index)}</Fragment>)
    }
    const expr = match[1].trim()
    const mapM = /^([a-zA-Z_]\w*)\.map\(\(\s*([a-zA-Z_]\w*)\s*\)\s*=>\s*<([a-zA-Z0-9-]+)([^>]*)>\{\s*\2\s*\}<\/\3>\)$/.exec(expr)
    if (mapM) {
      const [, arrName, , tag, rawAttrs] = mapM
      const items = arrayVars[arrName] ?? []
      const safeTag = ALLOWED_WEB_TAGS.has(tag.toLowerCase()) ? tag.toLowerCase() : 'span'
      const { attrs } = parseTagAttrs(rawAttrs)
      const cls = attrs.class || attrs.classname
      const style = matchElementCss(cssRules, safeTag, cls || null, attrs.id || null)
      items.forEach((item, idx) => {
        parts.push(
          createElement(
            safeTag,
            { key: `${keyPrefix}-m-${chunkIdx}-${idx}`, className: cls ? `wd-el ${cls}` : 'wd-el', style },
            item,
          ),
        )
      })
    } else if (expr.endsWith('.length') && expr.slice(0, -7) in arrayVars) {
      parts.push(<Fragment key={`${keyPrefix}-len-${chunkIdx++}`}>{arrayVars[expr.slice(0, -7)].length}</Fragment>)
    } else if (expr in arrayVars) {
      parts.push(<Fragment key={`${keyPrefix}-arr-${chunkIdx++}`}>{arrayVars[expr].join(', ')}</Fragment>)
    } else {
      parts.push(<Fragment key={`${keyPrefix}-s-${chunkIdx++}`}>{String(stateVal)}</Fragment>)
    }
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < rawText.length) {
    parts.push(<Fragment key={`${keyPrefix}-tail-${chunkIdx}`}>{rawText.slice(lastIdx)}</Fragment>)
  }
  return parts
}

function renderAstNodes(
  nodes: MarkupAstNode[],
  keyPrefix: string,
  cssRules: ParsedCssRule[],
  domOverrides: Record<string, string>,
  bindings: JsDomBinding[],
  onInvokeBinding: (binding: JsDomBinding) => void,
  onNavigatePath: (path: string) => void,
  reactOpts?: {
    arrayVars: Record<string, string[]>
    stateVal: string | number | boolean | unknown[]
    onReactClick: () => void
  },
): ReactNode[] {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`
    if (node.kind === 'text') {
      const rawText = node.text ?? ''
      if (reactOpts) {
        return <Fragment key={key}>{renderReactTextChunks(rawText, key, reactOpts.arrayVars, reactOpts.stateVal, cssRules)}</Fragment>
      }
      return <Fragment key={key}>{rawText}</Fragment>
    }

    const tag = node.tag ?? 'div'
    const attrs = node.attrs ?? {}
    const idAttr = attrs.id || null
    const classAttr = attrs.class || attrs.classname || null
    const computedStyle = matchElementCss(cssRules, tag, classAttr, idAttr)

    if (VOID_TAGS.has(tag)) {
      if (tag === 'input') {
        return createElement('input', {
          key,
          id: idAttr || undefined,
          className: classAttr ? `wd-el ${classAttr}` : 'wd-el',
          style: computedStyle,
          type: attrs.type || 'text',
          placeholder: attrs.placeholder || undefined,
        })
      }
      return createElement(tag, { key, style: computedStyle })
    }

    const overrideText = idAttr && idAttr in domOverrides ? domOverrides[idAttr] : null
    const children =
      overrideText !== null
        ? overrideText
        : renderAstNodes(
            node.children ?? [],
            key,
            cssRules,
            domOverrides,
            bindings,
            onInvokeBinding,
            onNavigatePath,
            reactOpts,
          )

    if (tag === 'button') {
      const bound = idAttr ? bindings.find((b) => b.targetId === idAttr && b.event === 'click') : undefined
      return (
        <button
          key={key}
          id={idAttr || undefined}
          type="button"
          className={classAttr ? `wd-btn ${classAttr}` : 'wd-btn'}
          style={computedStyle}
          onClick={() => {
            if (node.hasReactClick && reactOpts) {
              reactOpts.onReactClick()
            } else if (bound) {
              onInvokeBinding(bound)
            }
          }}
        >
          {children}
        </button>
      )
    }

    if (tag === 'a') {
      const href = attrs.href || '/'
      return (
        <button
          key={key}
          type="button"
          className={classAttr ? `wd-link ${classAttr}` : 'wd-link'}
          style={computedStyle}
          onClick={() => {
            if (href.startsWith('/')) onNavigatePath(href)
          }}
        >
          {children}
        </button>
      )
    }

    if (tag === 'form') {
      const bound = idAttr ? bindings.find((b) => b.targetId === idAttr && b.event === 'submit') : undefined
      return (
        <form
          key={key}
          id={idAttr || undefined}
          className={classAttr ? `wd-form ${classAttr}` : 'wd-form'}
          style={computedStyle}
          onSubmit={(e) => {
            e.preventDefault()
            if (bound) onInvokeBinding(bound)
          }}
        >
          {children}
        </form>
      )
    }

    return createElement(
      tag,
      {
        key,
        id: idAttr || undefined,
        className: classAttr ? `wd-el ${classAttr}` : 'wd-el',
        style: computedStyle,
      },
      children,
    )
  })
}

export interface WebDevPreviewPaneProps {
  files: WebDevFile[]
  lang: 'id' | 'en'
  renderReady: boolean
  activeSubTab: PreviewSubTab
  onSubTabChange: (tab: PreviewSubTab) => void
  consoleLines: string[]
  pythonLines: string[]
  initialDomUpdates: Record<string, string>
  bindings: JsDomBinding[]
  reactModel: ReactComponentModel | null
  apiRoutes: WebDevFastApiRoute[]
  sqlTables: WebDevSqlTable[]
  sqlLogs: string[]
  httpLogs: WebDevHttpLog[]
  onExecuteAll: () => void
  onHttpTested: (log: WebDevHttpLog) => void
  onConsoleLogAdded: (line: string) => void
}

export function WebDevPreviewPane({
  files,
  lang,
  renderReady,
  activeSubTab,
  onSubTabChange,
  consoleLines,
  pythonLines,
  initialDomUpdates,
  bindings,
  reactModel,
  apiRoutes,
  sqlTables,
  sqlLogs,
  httpLogs,
  onExecuteAll,
  onHttpTested,
  onConsoleLogAdded,
}: WebDevPreviewPaneProps) {
  const en = lang === 'en'
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [method, setMethod] = useState<'GET' | 'POST'>('GET')
  const [urlInput, setUrlInput] = useState('http://localhost:3000/')
  const [activePath, setActivePath] = useState('/')
  const [domOverrides, setDomOverrides] = useState<Record<string, string>>({})
  const [reactCounter, setReactCounter] = useState<string | number | boolean | unknown[]>(
    () => reactModel?.initialValue ?? 0,
  )
  const [apiJsonView, setApiJsonView] = useState<{ status: number; path: string; body: unknown } | null>(null)
  const [aiPrompt, setAiPrompt] = useState('Optimasi query PostgreSQL dan komponen React')

  const cssText = useMemo(
    () =>
      files
        .filter((f) => f.name.toLowerCase().endsWith('.css'))
        .map((f) => f.content)
        .join('\n'),
    [files],
  )
  const cssRules = useMemo(() => parseSafeCssRules(cssText), [cssText])

  const htmlFile = useMemo(
    () =>
      files.find((f) => f.name.toLowerCase() === 'index.html') ??
      files.find((f) => f.name.toLowerCase().endsWith('.html')) ??
      null,
    [files],
  )
  const jsxFile = useMemo(
    () => files.find((f) => f.name.toLowerCase().endsWith('.jsx') || f.name.toLowerCase().endsWith('.tsx')) ?? null,
    [files],
  )

  const handleTestRoute = useCallback(
    (reqMethod: 'GET' | 'POST', targetUrl: string, stayPreview = false) => {
      const res = invokeVirtualFastApi(apiRoutes, reqMethod, targetUrl, sqlTables, aiPrompt)
      const bodyStr = JSON.stringify(res.body, null, 2)
      const entry: WebDevHttpLog = {
        id: `http-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        method: reqMethod,
        path: res.path,
        status: res.status,
        body: bodyStr,
        at: new Date().toLocaleTimeString(),
      }
      onHttpTested(entry)
      setApiJsonView(res)
      if (!stayPreview) {
        setActivePath(res.path)
        setUrlInput(`http://localhost:8000${res.path}`)
      }
      return res
    },
    [aiPrompt, apiRoutes, onHttpTested, sqlTables],
  )

  const handleInvokeBinding = useCallback(
    (b: JsDomBinding) => {
      setDomOverrides((prev) => ({ ...prev, ...b.domUpdates }))
      if (b.logMessage) {
        onConsoleLogAdded(b.logMessage)
      }
      if (b.fetchPath) {
        handleTestRoute(b.fetchPath.includes('/ai') ? 'POST' : 'GET', b.fetchPath, true)
      }
    },
    [handleTestRoute, onConsoleLogAdded],
  )

  const combinedDom = useMemo(
    () => ({ ...initialDomUpdates, ...domOverrides }),
    [initialDomUpdates, domOverrides],
  )

  const renderedNodes = useMemo(() => {
    if (!renderReady) return null

    if (jsxFile && reactModel) {
      const ast = parseMarkupToAst(reactModel.jsxTemplate)
      const arrayVars = extractReactArrays(jsxFile.content)
      return renderAstNodes(
        ast,
        'wd-react',
        cssRules,
        combinedDom,
        bindings,
        handleInvokeBinding,
        (p) => {
          if (p === '/') {
            setActivePath('/')
            setApiJsonView(null)
            setUrlInput('http://localhost:3000/')
          } else {
            handleTestRoute('GET', p, false)
          }
        },
        {
          arrayVars,
          stateVal: reactCounter,
          onReactClick: () => {
            onConsoleLogAdded('React setState updated')
            setReactCounter((cur) => {
              if (typeof cur === 'number') return cur + 1
              if (typeof cur === 'boolean') return !cur
              return cur
            })
          },
        },
      )
    }

    if (!htmlFile) return null
    const ast = parseMarkupToAst(htmlFile.content)
    return renderAstNodes(
      ast,
      'wd-html',
      cssRules,
      combinedDom,
      bindings,
      handleInvokeBinding,
      (p) => {
        if (p === '/') {
          setActivePath('/')
          setApiJsonView(null)
          setUrlInput('http://localhost:3000/')
        } else {
          handleTestRoute('GET', p, false)
        }
      },
    )
  }, [
    bindings,
    combinedDom,
    cssRules,
    handleInvokeBinding,
    handleTestRoute,
    htmlFile,
    jsxFile,
    onConsoleLogAdded,
    reactCounter,
    reactModel,
    renderReady,
  ])

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onExecuteAll()
    const clean = urlInput.trim()
    if (clean === '/' || clean.endsWith(':3000/')) {
      setActivePath('/')
      setApiJsonView(null)
      onSubTabChange('preview')
      return
    }
    handleTestRoute(method, clean, false)
    onSubTabChange('preview')
  }

  const frameWidth =
    viewport === 'mobile' ? '390px' : viewport === 'tablet' ? '768px' : '100%'

  return (
    <section className="card wd-preview-pane" aria-label={en ? 'Web Render & Inspector' : 'Hasil Render Aplikasi Web'}>
      <header className="wd-preview-toolbar">
        <div className="wd-viewport-btns" role="group" aria-label={en ? 'Preview viewport size' : 'Ukuran layar preview'}>
          <button
            type="button"
            className={`wd-vp-btn ${viewport === 'desktop' ? 'is-active' : ''}`}
            onClick={() => setViewport('desktop')}
            title="Desktop (100%)"
            aria-label="Desktop"
          >
            <Laptop size={14} />
          </button>
          <button
            type="button"
            className={`wd-vp-btn ${viewport === 'tablet' ? 'is-active' : ''}`}
            onClick={() => setViewport('tablet')}
            title="Tablet (768px)"
            aria-label="Tablet"
          >
            <Tablet size={14} />
          </button>
          <button
            type="button"
            className={`wd-vp-btn ${viewport === 'mobile' ? 'is-active' : ''}`}
            onClick={() => setViewport('mobile')}
            title="Mobile (390px)"
            aria-label="Mobile"
          >
            <Smartphone size={14} />
          </button>
        </div>

        <form className="wd-url-bar" onSubmit={handleAddressSubmit}>
          <select
            className="wd-method-sel"
            aria-label={en ? 'HTTP method' : 'Metode HTTP'}
            value={method}
            onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
          <div className="wd-url-input-wrap">
            <Globe size={13} />
            <input
              type="text"
              className="wd-url-input"
              aria-label={en ? 'Preview URL' : 'Alamat URL Render Web'}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary iot-mini-btn">
            <Play size={12} /> {en ? 'Run' : 'Jalankan'}
          </button>
          <button
            type="button"
            className="btn-outline iot-mini-btn"
            title={en ? 'Refresh live preview' : 'Muat ulang preview'}
            onClick={() => {
              onExecuteAll()
              setActivePath('/')
              setApiJsonView(null)
              setUrlInput('http://localhost:3000/')
            }}
          >
            <RefreshCw size={12} />
          </button>
        </form>

        <Badge tone={renderReady ? 'good' : 'muted'}>
          {renderReady ? (apiJsonView ? `${apiJsonView.status} JSON` : '200 OK') : en ? 'Idle' : 'Siaga'}
        </Badge>
      </header>

      <div className="wd-preview-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'preview'}
          className={`iot-tab ${activeSubTab === 'preview' ? 'is-active' : ''}`}
          onClick={() => onSubTabChange('preview')}
        >
          <Globe size={13} /> Web Preview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'console'}
          className={`iot-tab ${activeSubTab === 'console' ? 'is-active' : ''}`}
          onClick={() => onSubTabChange('console')}
        >
          <Terminal size={13} /> Console / Output
          {consoleLines.length + pythonLines.length > 0 ? (
            <span className="iot-count-pill">{consoleLines.length + pythonLines.length}</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'api'}
          className={`iot-tab ${activeSubTab === 'api' ? 'is-active' : ''}`}
          onClick={() => onSubTabChange('api')}
        >
          <Server size={13} /> FastAPI Routes
          {apiRoutes.length > 0 ? <span className="iot-count-pill">{apiRoutes.length}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'db'}
          className={`iot-tab ${activeSubTab === 'db' ? 'is-active' : ''}`}
          onClick={() => onSubTabChange('db')}
        >
          <Database size={13} /> PostgreSQL DB
          {sqlTables.length > 0 ? <span className="iot-count-pill">{sqlTables.length}</span> : null}
        </button>
      </div>

      <div className="wd-preview-stage">
        {activeSubTab === 'preview' ? (
          <div className="wd-browser-frame" style={{ width: frameWidth }} data-testid="webdev-rendered-preview">
            {!renderReady ? (
              <div className="wd-empty-state">
                <strong>{en ? 'Click Run to render your Web app' : 'Klik Jalankan untuk merender aplikasi Web Anda'}</strong>
                <p>
                  {en
                    ? 'HTML, CSS, JavaScript ES6+, React JSX, Python/FastAPI, and PostgreSQL output are evaluated live in this sandbox.'
                    : 'Hasil HTML, CSS, JavaScript ES6+, React JSX, FastAPI, dan PostgreSQL akan langsung di-render di area ini.'}
                </p>
              </div>
            ) : activePath !== '/' && apiJsonView ? (
              <div className="wd-json-response">
                <div className="wd-json-head">
                  <strong>
                    {method} {apiJsonView.path}
                  </strong>
                  <Badge tone={apiJsonView.status < 400 ? 'good' : 'bad'}>HTTP {apiJsonView.status}</Badge>
                </div>
                <pre>{JSON.stringify(apiJsonView.body, null, 2)}</pre>
                <button
                  type="button"
                  className="btn-outline iot-mini-btn"
                  onClick={() => {
                    setActivePath('/')
                    setApiJsonView(null)
                    setUrlInput('http://localhost:3000/')
                  }}
                >
                  {en ? 'Back to HTML View (/)' : 'Kembali ke Halaman Utama (/)'}
                </button>
              </div>
            ) : renderedNodes ? (
              <div className="wd-rendered-dom">
                {renderedNodes}
                {httpLogs.length > 0 && (
                  <div className="wd-last-http-banner">
                    <span>
                      {httpLogs[0].method} {httpLogs[0].path} -&gt; HTTP {httpLogs[0].status}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="wd-empty-state">
                <strong>{en ? 'No HTML / JSX file active' : 'Belum ada file index.html atau App.jsx'}</strong>
                <p>{en ? 'Add an HTML or JSX file or inspect Console / FastAPI / PostgreSQL tabs.' : 'Tambahkan file HTML/JSX atau lihat tab Console, FastAPI Routes, dan PostgreSQL DB.'}</p>
              </div>
            )}
          </div>
        ) : activeSubTab === 'console' ? (
          <div className="wd-inspector-panel" data-testid="webdev-console-output">
            <div className="wd-inspector-block">
              <h4>JavaScript Console</h4>
              {consoleLines.length === 0 ? (
                <p className="wd-muted">{en ? 'No console.log() output yet.' : 'Belum ada output console.log().'}</p>
              ) : (
                <pre className="wd-log-pre">{consoleLines.join('\n')}</pre>
              )}
            </div>
            <div className="wd-inspector-block">
              <h4>Python Runner Output (main.py)</h4>
              {pythonLines.length === 0 ? (
                <p className="wd-muted">{en ? 'No Python print() output yet.' : 'Belum ada output print() Python.'}</p>
              ) : (
                <pre className="wd-log-pre">{pythonLines.join('\n')}</pre>
              )}
            </div>
            <div className="wd-inspector-block">
              <h4>HTTP Network Log</h4>
              {httpLogs.length === 0 ? (
                <p className="wd-muted">{en ? 'No HTTP requests triggered yet.' : 'Belum ada request HTTP.'}</p>
              ) : (
                <div className="wd-http-log-list">
                  {httpLogs.map((l) => (
                    <div key={l.id} className="wd-http-log-row">
                      <Badge tone={l.status < 400 ? 'good' : 'bad'}>{l.status}</Badge>
                      <code>{l.method} {l.path}</code>
                      <span className="wd-muted">{l.at}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeSubTab === 'api' ? (
          <div className="wd-inspector-panel" data-testid="webdev-api-panel">
            <div className="wd-ai-prompt-row">
              <label htmlFor="wd-ai-prompt-input">{en ? 'Test Payload / AI Prompt:' : 'Payload Uji / Prompt AI:'}</label>
              <input
                id="wd-ai-prompt-input"
                type="text"
                className="input"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
            </div>
            {apiRoutes.length === 0 ? (
              <div className="wd-empty-state">
                <strong>{en ? 'No FastAPI endpoints detected' : 'Belum ada endpoint FastAPI ditemukan'}</strong>
                <p>{en ? 'Define @app.get("/api/...") or @app.post("/api/...") inside api.py.' : 'Tambahkan decorator @app.get("/api/...") atau @app.post("/api/...") di file .py.'}</p>
              </div>
            ) : (
              <div className="wd-routes-list">
                {apiRoutes.map((route) => (
                  <div key={`${route.method}:${route.path}`} className="wd-route-card">
                    <div className="wd-route-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge tone={route.method === 'GET' ? 'info' : 'good'}>{route.method}</Badge>
                        <code>{route.path}</code>
                        <span className="wd-muted">def {route.handlerName}()</span>
                      </div>
                      <button
                        type="button"
                        className="btn-primary iot-mini-btn"
                        onClick={() => handleTestRoute(route.method === 'GET' ? 'GET' : 'POST', route.path, true)}
                      >
                        <Play size={12} /> {en ? 'Test Endpoint' : 'Uji Endpoint'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {apiJsonView && (
              <div className="wd-json-response">
                <div className="wd-json-head">
                  <strong>Response: {apiJsonView.path}</strong>
                  <Badge tone={apiJsonView.status < 400 ? 'good' : 'bad'}>HTTP {apiJsonView.status}</Badge>
                </div>
                <pre>{JSON.stringify(apiJsonView.body, null, 2)}</pre>
              </div>
            )}
          </div>
        ) : (
          <div className="wd-inspector-panel" data-testid="webdev-db-panel">
            {sqlLogs.length > 0 && (
              <div className="wd-inspector-block">
                <h4>PostgreSQL Execution Log</h4>
                <pre className="wd-log-pre">{sqlLogs.join('\n')}</pre>
              </div>
            )}
            {sqlTables.length === 0 ? (
              <div className="wd-empty-state">
                <strong>{en ? 'No PostgreSQL tables created yet' : 'Belum ada tabel PostgreSQL'}</strong>
                <p>{en ? 'Write CREATE TABLE, INSERT INTO, and SELECT statements in schema.sql then click Run.' : 'Tulis sintaks CREATE TABLE, INSERT INTO, dan SELECT pada file schema.sql lalu klik Jalankan.'}</p>
              </div>
            ) : (
              sqlTables.map((tbl) => (
                <div key={tbl.name} className="wd-sql-table-card">
                  <div className="wd-sql-table-head">
                    <strong>TABLE: {tbl.name}</strong>
                    <Badge tone="info">{tbl.rows.length} baris</Badge>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {tbl.columns.map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tbl.rows.length === 0 ? (
                          <tr>
                            <td colSpan={Math.max(1, tbl.columns.length)} className="wd-muted">
                              (Tabel kosong)
                            </td>
                          </tr>
                        ) : (
                          tbl.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {tbl.columns.map((col) => (
                                <td key={col}>{String(row[col] ?? 'NULL')}</td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  )
}
