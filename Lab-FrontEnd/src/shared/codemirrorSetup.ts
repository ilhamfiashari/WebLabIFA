import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab, redo } from '@codemirror/commands'
import { cpp } from '@codemirror/lang-cpp'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { PostgreSQL, sql } from '@codemirror/lang-sql'
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import { linter, lintGutter, lintKeymap, type Diagnostic } from '@codemirror/lint'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import {
  Annotation,
  Compartment,
  EditorState,
  StateEffect,
  StateField,
  type Extension,
  type Range,
  type Text,
} from '@codemirror/state'
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
  type DecorationSet,
} from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import type { CodeDiagnostic } from './editorDiagnostics'

export type EditorLanguage = 'cpp' | 'html' | 'css' | 'javascript' | 'jsx' | 'typescript' | 'tsx' | 'python' | 'sql' | 'json' | 'plain'
export type CompletionConfig = NonNullable<Parameters<typeof autocompletion>[0]>

export interface EditorCursorPos {
  line: number
  col: number
}

export interface EditorHooks {
  change: (next: string) => void
  cursor: (pos: EditorCursorPos) => void
  format: () => void
}

export interface BuildStateOptions {
  doc: string
  language: EditorLanguage
  dark: boolean
  en: boolean
  ariaLabel: string
  completion?: CompletionConfig
  extensions?: Extension[]
  context?: Extension
  hooks: EditorHooks
}

/** Marks a transaction as originating from the host (props), so it is not echoed back through onChange. */
export const ExternalChange = Annotation.define<boolean>()

/** Replaces the set of 1-based line numbers that should carry the red error band. */
export const setErrorLines = StateEffect.define<number[]>()

export const darkCompartment = new Compartment()
export const localeCompartment = new Compartment()
export const contextCompartment = new Compartment()

export function editorLocale(en: boolean, ariaLabel: string): Extension {
  return [
    EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
    EditorState.phrases.of(en ? {} : {
      Completions: 'Saran kode',
      Find: 'Cari',
      Replace: 'Ganti',
      next: 'berikutnya',
      previous: 'sebelumnya',
      all: 'pilih semua',
      'match case': 'huruf persis',
      regexp: 'regex',
      'by word': 'kata utuh',
      replace: 'ganti',
      'replace all': 'ganti semua',
      close: 'tutup',
      'Go to line': 'Ke baris',
      go: 'buka',
      'Fold line': 'Lipat baris',
      'Unfold line': 'Buka lipatan',
    }),
  ]
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

/** Pick the grammar from the filename, including the distinct JSX and TypeScript variants. */
export function languageForFileName(name: string | null | undefined): EditorLanguage {
  const lower = (name ?? 'Main.ino').toLowerCase()
  if (/\.html?$/.test(lower)) return 'html'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.tsx')) return 'tsx'
  if (lower.endsWith('.jsx')) return 'jsx'
  if (/\.(ts|mts|cts)$/.test(lower)) return 'typescript'
  if (/\.(js|mjs|cjs)$/.test(lower)) return 'javascript'
  if (lower.endsWith('.py')) return 'python'
  if (lower.endsWith('.sql')) return 'sql'
  if (lower.endsWith('.json')) return 'json'
  if (/\.(ino|cpp|cc|c|h|hpp|pde)$/.test(lower)) return 'cpp'
  return 'plain'
}

const languageSupports = {
  cpp: cpp(),
  html: html({ matchClosingTags: true, autoCloseTags: true, selfClosingTags: true }),
  css: css(),
  javascript: javascript(),
  jsx: javascript({ jsx: true }),
  typescript: javascript({ typescript: true }),
  tsx: javascript({ typescript: true, jsx: true }),
  python: python(),
  sql: sql({ dialect: PostgreSQL, upperCaseKeywords: true }),
  json: json(),
  plain: null,
}

export function editorLanguageSupport(language: EditorLanguage) {
  return languageSupports[language]
}

export function editorLanguageLabel(language: EditorLanguage, en: boolean): string {
  return {
    cpp: 'C++', html: 'HTML', css: 'CSS', javascript: 'JavaScript', jsx: 'JSX',
    typescript: 'TypeScript', tsx: 'TSX', python: 'Python', sql: 'PostgreSQL', json: 'JSON',
    plain: en ? 'Plain text' : 'Teks biasa',
  }[language]
}

export function editorIndentSize(language: EditorLanguage) {
  return language === 'python' ? 4 : 2
}

/** Class-based highlight style covering C++, HTML5, CSS3, JS/TS/JSX/TSX, Python, SQL, and JSON. */
const highlightStyle = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], class: 'tok-comment' },
  {
    tag: [t.processingInstruction, t.meta, t.documentMeta, t.special(t.brace), t.constant(t.className)],
    class: 'tok-preproc',
  },
  {
    tag: [t.string, t.character, t.special(t.string), t.regexp, t.attributeValue],
    class: 'tok-string',
  },
  { tag: [t.number, t.integer, t.float, t.unit], class: 'tok-number' },
  { tag: [t.typeName, t.className, t.tagName, t.namespace], class: 'tok-type' },
  {
    tag: [
      t.keyword,
      t.controlKeyword,
      t.definitionKeyword,
      t.modifier,
      t.operatorKeyword,
      t.moduleKeyword,
      t.self,
      t.null,
      t.bool,
    ],
    class: 'tok-keyword',
  },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: 'tok-fn' },
  { tag: [t.definition(t.variableName), t.special(t.variableName), t.variableName], class: 'tok-var' },
  { tag: [t.macroName, t.atom, t.color, t.escape, t.constant(t.variableName)], class: 'tok-const' },
  { tag: [t.attributeName, t.propertyName, t.labelName], class: 'tok-builtin' },
  {
    tag: [t.punctuation, t.operator, t.bracket, t.angleBracket, t.separator],
    class: 'tok-punct',
  },
  { tag: t.invalid, class: 'tok-invalid' },
])

const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes)
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLines)) continue
      const ranges: Range<Decoration>[] = []
      const seen = new Set<number>()
      for (const lineNo of effect.value) {
        if (seen.has(lineNo) || lineNo < 1 || lineNo > tr.state.doc.lines) continue
        seen.add(lineNo)
        const line = tr.state.doc.line(lineNo)
        ranges.push(
          Decoration.line({
            class: 'cm-error-line',
            attributes: { 'data-error-line': String(lineNo) },
          }).range(line.from),
        )
      }
      next = Decoration.set(ranges, true)
    }
    return next
  },
  provide: (field) => EditorView.decorations.from(field),
})

/** Theme driven by `--cm-*` CSS variables, defined per host (see iot.css), so it follows light/dark. */
const baseTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12.5px',
    color: 'var(--cm-fg, #1e293b)',
    backgroundColor: 'var(--cm-bg, #ffffff)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: MONO,
    lineHeight: '19.375px',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '12px 0',
    caretColor: 'var(--cm-caret, #0f172a)',
  },
  '.cm-line': { padding: '0 14px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--cm-caret, #0f172a)' },
  '.cm-gutters': {
    backgroundColor: 'var(--cm-gutter-bg, #f8fafc)',
    color: 'var(--cm-gutter-fg, #94a3b8)',
    borderRight: '1px solid var(--cm-gutter-border, #e2e8f0)',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 8px', minWidth: '34px' },
  '.cm-activeLine': { backgroundColor: 'var(--cm-active-line, rgba(14, 165, 233, 0.06))' },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--brand, #325341)',
    fontWeight: '700',
  },
  '&.cm-editor.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':
    { background: 'var(--cm-selection, rgba(59, 130, 246, 0.25))' },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    outline: '1px solid rgba(59, 130, 246, 0.45)',
  },
  '.cm-selectionMatch': { backgroundColor: 'rgba(250, 178, 25, 0.28)' },
  '.cm-error-line': {
    backgroundColor: 'var(--cm-error-bg, rgba(239, 68, 68, 0.11))',
    boxShadow: 'inset 3px 0 0 var(--cm-error-edge, #dc2626)',
  },
  '.cm-gutter-lint': { width: '1.1em' },
  '.cm-tooltip': {
    border: '1px solid var(--line, #e1e7dd)',
    backgroundColor: 'var(--surface, #ffffff)',
    color: 'var(--ink, #1f2a23)',
    borderRadius: '10px',
    boxShadow: '0 14px 36px rgba(15, 23, 42, 0.24)',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: MONO,
    fontSize: '12px',
    maxHeight: '190px',
    minWidth: 'min(240px, 65vw)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '3px 10px',
    lineHeight: '1.5',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--brand-soft, #e6efe3)',
    color: 'var(--ink, #1f2a23)',
  },
  '.cm-tooltip-autocomplete .cm-completionLabel': { fontWeight: '700' },
  '.cm-tooltip-autocomplete .cm-completionDetail': {
    marginLeft: 'auto',
    fontStyle: 'normal',
    fontSize: '10.5px',
    color: 'var(--ink-3, #6b776f)',
  },
  '.cm-tooltip.cm-completionInfo': {
    padding: 0,
    border: '1px solid var(--line, #e1e7dd)',
    maxWidth: '320px',
  },
  '.cm-tooltip.cm-tooltip-hover, .cm-tooltip-lint': {
    fontFamily: 'Inter, sans-serif',
    fontSize: '12px',
  },
  '.cm-panels': {
    backgroundColor: 'var(--cm-gutter-bg)',
    color: 'var(--cm-fg)',
  },
  '.cm-panels-top': { borderBottom: '1px solid var(--cm-gutter-border)' },
  '.cm-panel.cm-search': { padding: '6px 28px 6px 8px', lineHeight: '2' },
  '.cm-panel.cm-search .cm-textfield, .cm-panel.cm-search .cm-button': {
    background: 'var(--cm-bg)',
    color: 'inherit',
    border: '1px solid var(--line)',
    borderRadius: '4px',
  },
})

function buildKeymap(hooks: EditorHooks): Extension {
  return keymap.of([
    { key: 'Tab', run: acceptCompletion },
    indentWithTab,
    { key: 'Mod-y', run: redo, preventDefault: true },
    {
      key: 'Shift-Alt-f',
      preventDefault: true,
      run: () => {
        hooks.format()
        return true
      },
    },
    {
      key: 'Mod-Shift-f',
      preventDefault: true,
      run: () => {
        hooks.format()
        return true
      },
    },
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...foldKeymap,
    ...historyKeymap,
    ...lintKeymap,
  ])
}

export function buildEditorState(options: BuildStateOptions): EditorState {
  const { hooks } = options
  return EditorState.create({
    doc: options.doc,
    extensions: [
      lineNumbers(),
      foldGutter(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      EditorState.allowMultipleSelections.of(true),
      rectangularSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      search({ top: true }),
      EditorState.tabSize.of(editorIndentSize(options.language)),
      indentUnit.of(' '.repeat(editorIndentSize(options.language))),
      editorLanguageSupport(options.language) ?? [],
      syntaxHighlighting(highlightStyle),
      autocompletion({
        activateOnTyping: true,
        interactionDelay: 0,
        icons: false,
        maxRenderedOptions: 50,
        ...options.completion,
      }),
      linter(null),
      lintGutter(),
      errorLineField,
      baseTheme,
      darkCompartment.of(EditorView.darkTheme.of(options.dark)),
      localeCompartment.of(editorLocale(options.en, options.ariaLabel)),
      contextCompartment.of(options.context ?? []),
      EditorView.contentAttributes.of({
        spellcheck: 'false',
        autocapitalize: 'off',
        autocorrect: 'off',
      }),
      ...(options.extensions ?? []),
      buildKeymap(hooks),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !update.transactions.some((tr) => tr.annotation(ExternalChange))) {
          hooks.change(update.state.doc.toString())
        }
        if (update.docChanged || update.selectionSet) {
          const pos = cursorPosOf(update.state.doc, update.state.selection.main.head)
          const prev = cursorPosOf(update.startState.doc, update.startState.selection.main.head)
          if (pos.line !== prev.line || pos.col !== prev.col) hooks.cursor(pos)
        }
      }),
    ],
  })
}

export function cursorPosOf(doc: Text, head: number): EditorCursorPos {
  const line = doc.lineAt(head)
  return { line: line.number, col: head - line.from + 1 }
}

/** Smallest single replacement turning `oldText` into `newText`, so selection and undo stay precise. */
export function diffReplace(
  oldText: string,
  newText: string,
): { from: number; to: number; insert: string } {
  const max = Math.min(oldText.length, newText.length)
  let start = 0
  while (start < max && oldText.charCodeAt(start) === newText.charCodeAt(start)) start++
  let endOld = oldText.length
  let endNew = newText.length
  while (
    endOld > start &&
    endNew > start &&
    oldText.charCodeAt(endOld - 1) === newText.charCodeAt(endNew - 1)
  ) {
    endOld--
    endNew--
  }
  return { from: start, to: endOld, insert: newText.slice(start, endNew) }
}

/** Map one line-level diagnostic onto a CodeMirror lint range covering the code on that line. */
export function toLintDiagnostic(doc: Text, diag: CodeDiagnostic, en: boolean): Diagnostic {
  const lineNo = Math.min(Math.max(1, diag.line), doc.lines)
  const line = doc.line(lineNo)
  const indent = line.text.length - line.text.trimStart().length
  let from = line.from + Math.min(diag.length === undefined ? indent : Math.max(0, diag.col - 1), line.length)
  let to = diag.length === undefined ? line.to : Math.min(line.to, from + diag.length)
  if (to <= from) {
    to = Math.min(line.to, from + 1)
    if (to === from && from > line.from) from--
  }
  return {
    from,
    to,
    severity: diag.severity,
    message: en ? diag.messageEn : diag.messageId,
    source: 'IFA Lab',
  }
}
