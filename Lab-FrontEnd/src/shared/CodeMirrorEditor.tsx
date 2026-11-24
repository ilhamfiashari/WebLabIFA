import { useEffectEvent, useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'
import { setDiagnostics } from '@codemirror/lint'
import { openSearchPanel } from '@codemirror/search'
import { EditorView } from '@codemirror/view'
import type { EditorState, Extension, StateEffect } from '@codemirror/state'
import editorSurfaceUrl from './codemirrorSurface.css?url&no-inline'
import type { CodeDiagnostic } from './editorDiagnostics'
import {
  buildEditorState,
  contextCompartment,
  cursorPosOf,
  darkCompartment,
  diffReplace,
  editorLocale,
  ExternalChange,
  localeCompartment,
  setErrorLines,
  toLintDiagnostic,
  type CompletionConfig,
  type EditorCursorPos,
  type EditorLanguage,
} from './codemirrorSetup'

export interface CodeMirrorHandle {
  find: () => void
  /** Move the caret to a 1-based line and column and scroll it into view. */
  jumpTo: (line: number, col: number) => void
}

export interface CodeMirrorEditorProps {
  /** Identity of the open document. Switching it swaps editor state and keeps undo history per document. */
  docKey: string
  value: string
  onChange: (next: string) => void
  onCursorChange?: (pos: EditorCursorPos) => void
  onFormat?: () => void
  language: EditorLanguage
  dark: boolean
  ariaLabel: string
  diagnostics: CodeDiagnostic[]
  en: boolean
  /** Read when a document is opened; changing it later takes effect on the next docKey switch. */
  completion?: CompletionConfig
  /** Read when a document is opened; changing it later takes effect on the next docKey switch. */
  extensions?: Extension[]
  context?: Extension
  className?: string
  ref?: Ref<CodeMirrorHandle>
}

/**
 * CodeMirror 6 editor with line numbers, syntax highlighting, autocomplete and inline error markers.
 * `value` is the source of truth owned by the parent; edits flow out through `onChange`.
 */
export function CodeMirrorEditor({
  docKey, value, onChange, onCursorChange, onFormat,
  language, dark, en, ariaLabel, diagnostics, completion, extensions, context, className, ref,
}: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const statesRef = useRef(new Map<string, { state: EditorState; scroll: StateEffect<unknown> }>())
  const change = useEffectEvent((next: string) => onChange(next))
  const cursor = useEffectEvent((pos: EditorCursorPos) => onCursorChange?.(pos))
  const format = useEffectEvent(() => onFormat?.())
  const editorOptions = useEffectEvent(() => ({
    doc: value.replace(/\r\n?/g, '\n'), language, dark, en, ariaLabel, completion, extensions, context,
  }))

  useImperativeHandle(
    ref,
    () => ({
      find: () => {
        const view = viewRef.current
        if (view) openSearchPanel(view)
      },
      jumpTo: (line, col) => {
        const view = viewRef.current
        if (!view) return
        const doc = view.state.doc
        const target = doc.line(Math.min(Math.max(1, line), doc.lines))
        const pos = target.from + Math.min(Math.max(0, col - 1), target.length)
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        })
        view.focus()
      },
    }),
    [],
  )

  // Each document has its own selection, scroll position and undo stack.
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    // CodeMirror uses adopted stylesheets in a shadow root, compatible with style-src 'self'.
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    if (!root.querySelector('link[rel="stylesheet"]')) {
      const stylesheet = host.ownerDocument.createElement('link')
      stylesheet.rel = 'stylesheet'
      stylesheet.href = editorSurfaceUrl
      root.append(stylesheet)
    }
    const options = editorOptions()
    const states = statesRef.current
    const cached = states.get(docKey)
    const restored = cached && cached.state.doc.toString() === options.doc ? cached : undefined
    const state = restored?.state ?? buildEditorState({
      ...options,
      hooks: {
        change: (next) => change(next),
        cursor: (pos) => cursor(pos),
        format: () => format(),
      },
    })
    const view = new EditorView({ state, root, parent: root, scrollTo: restored?.scroll })
    viewRef.current = view
    cursor(cursorPosOf(state.doc, state.selection.main.head))
    return () => {
      states.set(docKey, { state: view.state, scroll: view.scrollSnapshot() })
      view.destroy()
      viewRef.current = null
    }
  }, [docKey])

  // Parent-driven text changes (format, presets, loaded projects) are applied as one minimal replacement.
  useLayoutEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    const next = value.replace(/\r\n?/g, '\n')
    if (current === next) return
    view.dispatch({
      changes: diffReplace(current, next),
      annotations: ExternalChange.of(true),
      userEvent: 'input.external',
    })
  }, [value, docKey])

  useLayoutEffect(() => {
    viewRef.current?.dispatch({
      effects: [
        darkCompartment.reconfigure(EditorView.darkTheme.of(dark)),
        localeCompartment.reconfigure(editorLocale(en, ariaLabel)),
      ],
    })
  }, [dark, ariaLabel, docKey, en])

  useLayoutEffect(() => {
    viewRef.current?.dispatch({ effects: contextCompartment.reconfigure(context ?? []) })
  }, [context, docKey])

  useLayoutEffect(() => {
    const view = viewRef.current
    if (!view) return
    const doc = view.state.doc
    view.dispatch(
      setDiagnostics(
        view.state,
        diagnostics.map((d) => toLintDiagnostic(doc, d, en)),
      ),
      { effects: setErrorLines.of(diagnostics.filter((d) => d.severity === 'error').map((d) => d.line)) },
    )
  }, [diagnostics, en, docKey, value])

  return <div ref={hostRef} className={`cm-host${className ? ` ${className}` : ''}`} />
}
