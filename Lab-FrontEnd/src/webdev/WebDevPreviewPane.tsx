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
import { Fragment, createElement, useCallback, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { Badge } from '../portal/ui'
import {
  parseHtmlPreview,
  parseMarkupToAst,
  parseTagAttrs,
  SVG_TAGS,
  VOID_TAGS,
  type MarkupAstNode,
} from './htmlAst'
import type { JsElementPatch, JsSandboxSession } from './jsRuntime'
import {
  invokeVirtualFastApi,
  matchElementCss,
  matchElementStyles,
  parseSafeCssRules,
  parseSafeInlineStyle,
  type AncestorDescriptor,
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

function isSafeImageSrc(src: string | undefined): boolean {
  if (!src) return false
  const trimmed = src.trim()
  return /^(?:https?:\/\/|\/|data:image\/(?:png|jpeg|jpg|gif|webp);base64,)/i.test(trimmed)
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
      const safeTag = tag.toLowerCase()
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

interface AstRenderContext {
  cssRules: ParsedCssRule[]
  domOverrides: Record<string, string>
  domPatches: Record<string, JsElementPatch>
  jsSession?: JsSandboxSession | null
  bindings: JsDomBinding[]
  hoveredKey: string | null
  onHoverKey: (key: string | null) => void
  onInputValueChange: (key: string, idAttr: string | null, value: string) => void
  onInvokeElementEvent: (key: string, event: 'click' | 'submit', onclickAttr?: string) => void
  onInvokeBinding: (binding: JsDomBinding) => void
  onNavigatePath: (path: string) => void
  reactOpts?: {
    arrayVars: Record<string, string[]>
    stateVal: string | number | boolean | unknown[]
    onReactClick: () => void
  }
}

function renderAstNodes(
  nodes: MarkupAstNode[],
  keyPrefix: string,
  ctx: AstRenderContext,
  ancestors: AncestorDescriptor[] = [],
): ReactNode[] {
  const {
    cssRules,
    domOverrides,
    domPatches,
    jsSession,
    bindings,
    hoveredKey,
    onHoverKey,
    onInputValueChange,
    onInvokeElementEvent,
    onInvokeBinding,
    onNavigatePath,
    reactOpts,
  } = ctx

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
    const patch = domPatches[key]
    const classAttr = patch
      ? patch.classes.join(' ') || null
      : attrs.class || attrs.classname || null
    const { style: matchedStyle, hoverStyle } = matchElementStyles(
      cssRules,
      tag,
      classAttr,
      idAttr,
      ancestors,
    )
    const hasHover = Object.keys(hoverStyle).length > 0
    const isHovered = hasHover && hoveredKey === key
    const computedStyle: Record<string, unknown> = {
      ...matchedStyle,
      ...parseSafeInlineStyle(attrs.style),
      ...(isHovered ? hoverStyle : {}),
      ...(patch?.styles ?? {}),
    }

    const commonProps: Record<string, unknown> = {
      key,
      id: idAttr || undefined,
      style: computedStyle,
      title: attrs.title || undefined,
      dir: attrs.dir === 'ltr' || attrs.dir === 'rtl' || attrs.dir === 'auto' ? attrs.dir : undefined,
      lang: attrs.lang || undefined,
      role: attrs.role || undefined,
      hidden: patch?.hidden ?? ('hidden' in attrs ? true : undefined),
    }
    if (hasHover) {
      commonProps.onMouseEnter = () => onHoverKey(key)
      commonProps.onMouseLeave = () => onHoverKey(null)
    }
    for (const [k, v] of Object.entries(attrs)) {
      if (/^aria-[a-z-]+$/.test(k)) commonProps[k] = v
    }

    if (VOID_TAGS.has(tag)) {
      if (tag === 'input') {
        return createElement('input', {
          ...commonProps,
          className: classAttr ? `wd-el ${classAttr}` : 'wd-el',
          type: attrs.type || 'text',
          name: attrs.name || undefined,
          placeholder: attrs.placeholder || undefined,
          defaultValue: attrs.value || undefined,
          defaultChecked: 'checked' in attrs ? true : undefined,
          disabled: 'disabled' in attrs ? true : undefined,
          required: 'required' in attrs ? true : undefined,
          readOnly: 'readonly' in attrs ? true : undefined,
          min: attrs.min || undefined,
          max: attrs.max || undefined,
          step: attrs.step || undefined,
          onChange: (e: ChangeEvent<HTMLInputElement>) =>
            onInputValueChange(key, idAttr, e.target.value),
        })
      }
      if (tag === 'img') {
        return createElement('img', {
          ...commonProps,
          className: classAttr ? `wd-el ${classAttr}` : 'wd-el',
          src: isSafeImageSrc(attrs.src) ? attrs.src : undefined,
          alt: attrs.alt ?? '',
          width: attrs.width || undefined,
          height: attrs.height || undefined,
        })
      }
      return createElement(tag, commonProps)
    }

    const nextAncestors = [...ancestors, { tag, classAttr, idAttr }]
    const overrideText = patch?.text !== undefined
      ? patch.text
      : idAttr && idAttr in domOverrides
        ? domOverrides[idAttr]
        : null
    const children =
      patch?.innerHtml !== undefined
        ? renderAstNodes(parseMarkupToAst(patch.innerHtml), `${key}-ih`, ctx, nextAncestors)
        : overrideText !== null
          ? overrideText
          : renderAstNodes(node.children ?? [], key, ctx, nextAncestors)

    const onclickAttr = attrs.onclick
    const hasJsClick = jsSession?.hasClickHandler(key, onclickAttr) ?? false

    if (tag === 'button') {
      const bound = idAttr ? bindings.find((b) => b.targetId === idAttr && b.event === 'click') : undefined
      return (
        <button
          key={key}
          id={idAttr || undefined}
          type="button"
          className={classAttr ? `wd-btn ${classAttr}` : 'wd-btn'}
          style={computedStyle}
          onMouseEnter={hasHover ? () => onHoverKey(key) : undefined}
          onMouseLeave={hasHover ? () => onHoverKey(null) : undefined}
          onClick={() => {
            if (node.hasReactClick && reactOpts) {
              reactOpts.onReactClick()
            } else if (hasJsClick) {
              onInvokeElementEvent(key, 'click', onclickAttr)
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
          onMouseEnter={hasHover ? () => onHoverKey(key) : undefined}
          onMouseLeave={hasHover ? () => onHoverKey(null) : undefined}
          onClick={() => {
            if (hasJsClick) onInvokeElementEvent(key, 'click', onclickAttr)
            else if (href.startsWith('/')) onNavigatePath(href)
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
            if (jsSession) onInvokeElementEvent(key, 'submit')
            if (bound) onInvokeBinding(bound)
          }}
        >
          {children}
        </form>
      )
    }

    const extraProps: Record<string, unknown> = {}
    if (tag === 'label' && (attrs.for || attrs.htmlfor)) extraProps.htmlFor = attrs.for || attrs.htmlfor
    if (tag === 'textarea') {
      if (attrs.rows) extraProps.rows = Number(attrs.rows) || undefined
      if (attrs.cols) extraProps.cols = Number(attrs.cols) || undefined
      if (attrs.placeholder) extraProps.placeholder = attrs.placeholder
      if (attrs.name) extraProps.name = attrs.name
      if ('disabled' in attrs) extraProps.disabled = true
      if ('required' in attrs) extraProps.required = true
      if ('readonly' in attrs) extraProps.readOnly = true
      extraProps.onChange = (e: ChangeEvent<HTMLTextAreaElement>) =>
        onInputValueChange(key, idAttr, e.target.value)
    }
    if (tag === 'select' || tag === 'option') {
      if (attrs.name) extraProps.name = attrs.name
      if (attrs.value) extraProps.defaultValue = attrs.value
      if ('disabled' in attrs) extraProps.disabled = true
      if ('multiple' in attrs) extraProps.multiple = true
      if (tag === 'select') {
        extraProps.onChange = (e: ChangeEvent<HTMLSelectElement>) =>
          onInputValueChange(key, idAttr, e.target.value)
      }
    }
    if (tag === 'th' || tag === 'td') {
      if (attrs.colspan) extraProps.colSpan = Number(attrs.colspan) || undefined
      if (attrs.rowspan) extraProps.rowSpan = Number(attrs.rowspan) || undefined
    }
    if ((tag === 'details' || tag === 'dialog') && 'open' in attrs) extraProps.open = true
    if (tag === 'progress' || tag === 'meter') {
      if (attrs.value) extraProps.value = Number(attrs.value)
      if (attrs.max) extraProps.max = Number(attrs.max)
      if (attrs.min) extraProps.min = Number(attrs.min)
    }
    if (SVG_TAGS.has(tag)) {
      const svgMap: Record<string, string> = {
        viewbox: 'viewBox', width: 'width', height: 'height', fill: 'fill', stroke: 'stroke',
        'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin',
        d: 'd', cx: 'cx', cy: 'cy', r: 'r', rx: 'rx', ry: 'ry', x: 'x', y: 'y',
        x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', points: 'points', transform: 'transform', opacity: 'opacity',
      }
      for (const [k, v] of Object.entries(attrs)) {
        const mapped = svgMap[k.toLowerCase()]
        if (mapped) extraProps[mapped] = v
      }
    }
    if (hasJsClick) {
      extraProps.onClick = () => onInvokeElementEvent(key, 'click', onclickAttr)
      if (!computedStyle.cursor) computedStyle.cursor = 'pointer'
    }

    return createElement(
      tag,
      {
        ...commonProps,
        ...extraProps,
        className: classAttr ? `wd-el ${classAttr}` : 'wd-el',
      },
      children,
    )
  })
}

export interface WebDevPreviewPaneProps {
  files: WebDevFile[]
  lang: 'id' | 'en'
  execRunId?: number
  renderReady: boolean
  activeSubTab: PreviewSubTab
  onSubTabChange: (tab: PreviewSubTab) => void
  consoleLines: string[]
  pythonLines: string[]
  initialDomUpdates: Record<string, string>
  initialPatches?: Record<string, JsElementPatch>
  jsSession?: JsSandboxSession | null
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
  execRunId = 0,
  renderReady,
  activeSubTab,
  onSubTabChange,
  consoleLines,
  pythonLines,
  initialDomUpdates,
  initialPatches,
  jsSession = null,
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
  const [patchState, setPatchState] = useState<{
    runId: number
    patches: Record<string, JsElementPatch>
    alertMsg: string | null
  }>(() => ({ runId: execRunId, patches: initialPatches ?? {}, alertMsg: null }))
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [liveInputValues, setLiveInputValues] = useState<Record<string, string>>({})
  const [reactCounter, setReactCounter] = useState<string | number | boolean | unknown[]>(
    () => reactModel?.initialValue ?? 0,
  )
  const [apiJsonView, setApiJsonView] = useState<{ status: number; path: string; body: unknown } | null>(null)
  const [aiPrompt, setAiPrompt] = useState('Optimasi query PostgreSQL dan komponen React')

  const activePatches = useMemo(
    () => (patchState.runId === execRunId ? patchState.patches : (initialPatches ?? {})),
    [execRunId, initialPatches, patchState.patches, patchState.runId],
  )
  const activeAlertMsg = patchState.runId === execRunId
    ? patchState.alertMsg
    : jsSession?.initialEffects.alerts.at(-1) ?? null

  const cssText = useMemo(
    () =>
      files
        .filter((f) => f.name.toLowerCase().endsWith('.css'))
        .map((f) => f.content)
        .join('\n'),
    [files],
  )
  const htmlFile = useMemo(
    () =>
      files.find((f) => f.name.toLowerCase() === 'index.html') ??
      files.find((f) => /\.html?$/i.test(f.name)) ??
      null,
    [files],
  )
  const jsxFile = useMemo(
    () => files.find((f) => f.name.toLowerCase().endsWith('.jsx') || f.name.toLowerCase().endsWith('.tsx')) ?? null,
    [files],
  )
  const htmlPreview = useMemo(() => htmlFile ? parseHtmlPreview(htmlFile.content) : null, [htmlFile])
  const cssRules = useMemo(
    () => parseSafeCssRules([cssText, ...(htmlPreview?.styles ?? [])].join('\n')),
    [cssText, htmlPreview],
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

  const handleInputValueChange = useCallback(
    (key: string, idAttr: string | null, value: string) => {
      setLiveInputValues((prev) => ({
        ...prev,
        [key]: value,
        ...(idAttr ? { [idAttr]: value } : {}),
      }))
    },
    [],
  )

  const handleInvokeElementEvent = useCallback(
    (key: string, event: 'click' | 'submit', onclickAttr?: string) => {
      if (!jsSession) return
      const effects = jsSession.triggerEvent(key, event, liveInputValues, onclickAttr)
      setPatchState({
        runId: execRunId,
        patches: effects.patches,
        alertMsg: effects.alerts.at(-1) ?? null,
      })
      for (const line of effects.logs) onConsoleLogAdded(line)
      for (const path of effects.fetchPaths) {
        handleTestRoute(path.includes('/ai') ? 'POST' : 'GET', path, true)
      }
    },
    [execRunId, handleTestRoute, jsSession, liveInputValues, onConsoleLogAdded],
  )

  const combinedDom = useMemo(
    () => ({ ...initialDomUpdates, ...domOverrides }),
    [initialDomUpdates, domOverrides],
  )

  const renderedNodes = useMemo(() => {
    if (!renderReady) return null

    const navigatePath = (p: string) => {
      if (p === '/') {
        setActivePath('/')
        setApiJsonView(null)
        setUrlInput('http://localhost:3000/')
      } else {
        handleTestRoute('GET', p, false)
      }
    }

    const baseCtx: AstRenderContext = {
      cssRules,
      domOverrides: combinedDom,
      domPatches: activePatches,
      jsSession,
      bindings,
      hoveredKey,
      onHoverKey: setHoveredKey,
      onInputValueChange: handleInputValueChange,
      onInvokeElementEvent: handleInvokeElementEvent,
      onInvokeBinding: handleInvokeBinding,
      onNavigatePath: navigatePath,
    }

    if (jsxFile && reactModel) {
      const ast = parseMarkupToAst(reactModel.jsxTemplate)
      const arrayVars = extractReactArrays(jsxFile.content)
      return renderAstNodes(ast, 'wd-react', {
        ...baseCtx,
        reactOpts: {
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
      })
    }

    if (!htmlPreview) return null
    return renderAstNodes(htmlPreview.nodes, 'wd-html', baseCtx)
  }, [
    activePatches,
    bindings,
    combinedDom,
    cssRules,
    handleInputValueChange,
    handleInvokeBinding,
    handleInvokeElementEvent,
    handleTestRoute,
    hoveredKey,
    htmlPreview,
    jsSession,
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
                    ? 'View HTML and CSS alongside simulated JavaScript, React, FastAPI, and PostgreSQL output.'
                    : 'Lihat tampilan HTML dan CSS serta hasil simulasi JavaScript, React, FastAPI, dan PostgreSQL.'}
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
                {activeAlertMsg && (
                  <div className="wd-last-http-banner" role="status">
                    <span>alert(): {activeAlertMsg}</span>
                  </div>
                )}
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
