import { syntaxTree } from '@codemirror/language'
import { pickedCompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { Facet, StateEffect, StateField, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  keymap,
  MatchDecorator,
  showTooltip,
  ViewPlugin,
  type DecorationSet,
  type Tooltip,
  type ViewUpdate,
} from '@codemirror/view'
import {
  formatSuggestionSignature,
  getArduinoAutocomplete,
  getArduinoSignatureHelp,
  type AcSuggestion,
  type SignatureHelpResult,
} from './cppAutocomplete'
import { classifyArduinoWord } from './cppHighlight'
import type { CompletionConfig } from '../shared/codemirrorSetup'

const KIND_GLYPHS: Record<AcSuggestion['kind'], string> = {
  fn: 'ƒ',
  method: '𝑚',
  kw: 'k',
  type: '𝑡',
  const: '𝑐',
  var: '𝑥',
  hdr: '#',
  snip: '□',
}

const NON_CODE_NODE = /Comment|String|Char|Preproc|SystemLib|RawString/

interface ArduinoEditorContext {
  files: Array<{ name: string; content: string }>
  en: boolean
}

export const arduinoContext = Facet.define<ArduinoEditorContext, ArduinoEditorContext>({
  combine: (contexts) => contexts[0] ?? { files: [], en: false },
})

const wordMarks = {
  type: Decoration.mark({ class: 'tok-type' }),
  builtin: Decoration.mark({ class: 'tok-builtin' }),
  const: Decoration.mark({ class: 'tok-const' }),
}

const wordDecorator = new MatchDecorator({
  regexp: /\b[A-Za-z_][A-Za-z0-9_]*\b/g,
  decoration: (match, view, pos) => {
    const node = syntaxTree(view.state).resolveInner(pos, 1)
    if (NON_CODE_NODE.test(node.name)) return null
    const afterDot = pos > 0 && view.state.doc.sliceString(pos - 1, pos) === '.'
    const kind = classifyArduinoWord(match[0], afterDot)
    return kind === 'builtin' || kind === 'const' || kind === 'type' ? wordMarks[kind] : null
  },
})

/** Arduino-aware coloring on top of the C++ grammar: Serial, pinMode, HIGH, Servo, DHT, ... */
export const arduinoSyntaxExtras: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = wordDecorator.createDeco(view)
    }
    update(update: ViewUpdate) {
      this.decorations = wordDecorator.updateDeco(update, this.decorations)
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function buildCompletionInfo(item: AcSuggestion, en: boolean): HTMLElement {
  const root = el('div', 'iot-ac-doc')
  const sig = formatSuggestionSignature(item)
  if (sig) {
    const row = el('div', 'iot-ac-doc-sig')
    row.append(el('code', undefined, sig))
    row.append(
      el('span', 'iot-ac-param-badge', `${item.params?.length ?? 0} ${en ? 'params' : 'parameter'}`),
    )
    root.append(row)
  }
  root.append(el('div', 'iot-ac-doc-summary', en ? item.detailEn : item.detailId))
  if (item.params && item.params.length > 0) {
    const list = el('ul', 'iot-ac-param-list')
    for (const p of item.params) {
      const li = el('li')
      li.append(el('code', undefined, `${p.type} ${p.name}`))
      li.append(el('span', undefined, en ? p.descEn : p.descId))
      list.append(li)
    }
    root.append(list)
  }
  return root
}

function toCompletion(item: AcSuggestion, en: boolean): Completion {
  const hasParams = Boolean(item.params)
  return {
    label: item.label,
    type: item.kind,
    detail: hasParams ? `${item.params?.length ?? 0} ${en ? 'params' : 'parameter'}` : item.kind,
    info: () => buildCompletionInfo(item, en),
    apply: (view, completion, from, to) => {
      const line = view.state.doc.lineAt(from)
      const indent = /^[ \t]*/.exec(line.text)?.[0] ?? ''
      const text = item.insertText.replace(/\n/g, `\n${indent}`)
      const marker = text.indexOf('$0')
      const insert = marker >= 0 ? text.replace('$0', '') : text
      view.dispatch({
        changes: { from, to, insert },
        annotations: pickedCompletion.of(completion),
        selection: { anchor: from + (marker >= 0 ? marker : insert.length) },
        scrollIntoView: true,
        userEvent: 'input.complete',
      })
    },
  }
}

/** Autocomplete source backed by the Arduino API/symbol catalog (Serial., oled., #include, project symbols). */
export const arduinoCompletion: CompletionConfig = {
  override: [(context: CompletionContext): CompletionResult | null => {
    const { files, en } = context.state.facet(arduinoContext)
    const result = getArduinoAutocomplete(
      context.state.doc.toString(),
      context.pos,
      context.explicit,
      files,
    )
    if (!result) return null
    return {
      from: result.replaceStart,
      to: result.replaceEnd,
      filter: false,
      options: result.items.map((item) => toCompletion(item, en)),
    }
  }],
  addToOptions: [
    {
      position: 20,
      render: (completion) => {
        const kind = completion.type as AcSuggestion['kind']
        return el('span', `iot-ac-kind is-${kind}`, KIND_GLYPHS[kind] ?? '')
      },
    },
  ],
}

interface SigState {
  key: string
  tooltip: Tooltip
}

const dismissSignature = StateEffect.define<null>()

function buildSignatureDom(sig: SignatureHelpResult, en: boolean): HTMLElement {
  const root = el('div', 'iot-sig-popup')
  root.setAttribute('role', 'status')
  root.setAttribute('aria-label', en ? 'Function parameter hints' : 'Info parameter fungsi')

  const head = el('div', 'iot-sig-head')
  const code = el('code', 'iot-sig-code')
  code.append(el('span', 'iot-sig-ret', sig.returnType), ' ', el('strong', undefined, sig.fnName), '(')
  if (sig.params.length === 0) {
    code.append(el('span', 'muted', 'void'))
  } else {
    sig.params.forEach((p, idx) => {
      if (idx > 0) code.append(', ')
      code.append(
        el('span', idx === sig.activeParam ? 'iot-sig-active-param' : undefined, `${p.type} ${p.name}`),
      )
    })
  }
  code.append(')')
  head.append(code)
  head.append(
    el(
      'span',
      'iot-ac-param-badge',
      sig.params.length === 0
        ? en ? '0 params' : '0 parameter'
        : en
          ? `Param ${sig.activeParam + 1} of ${sig.params.length}`
          : `Parameter ${sig.activeParam + 1} dari ${sig.params.length}`,
    ),
  )
  root.append(head)

  const active = sig.params[sig.activeParam]
  if (active) {
    const desc = el('div', 'iot-sig-param-desc')
    desc.append(el('strong', undefined, `${active.type} ${active.name}:`), ' ')
    desc.append(el('span', undefined, en ? active.descEn : active.descId))
    root.append(desc)
  }
  root.append(el('div', 'iot-sig-summary', en ? sig.summaryEn : sig.summaryId))
  return root
}

/** VS Code-style parameter hints shown above the caret while typing inside `fn(...)`. */
export const arduinoSignatureHelp: Extension = (() => {
  const field = StateField.define<SigState | null>({
    create: () => null,
    update(value, tr) {
      if (tr.effects.some((e) => e.is(dismissSignature))) return null
      if (!tr.docChanged && !tr.selection) return value
      const sel = tr.state.selection.main
      if (!sel.empty) return null
      const sig = getArduinoSignatureHelp(tr.state.doc.toString(), sel.head)
      if (!sig) return null
      const { en } = tr.state.facet(arduinoContext)
      const key = `${en ? 'en' : 'id'}|${sig.fnName}|${sig.activeParam}`
      // Reusing `create` keeps the same tooltip DOM while only the caret moves within one argument.
      const create = value?.key === key ? value.tooltip.create : () => ({ dom: buildSignatureDom(sig, en) })
      return {
        key,
        tooltip: { pos: sel.head, above: true, strictSide: false, arrow: false, create },
      }
    },
    provide: (f) => showTooltip.compute([f], (state) => state.field(f)?.tooltip ?? null),
  })

  return [
    field,
    keymap.of([
      {
        key: 'Escape',
        run: (view) => {
          if (!view.state.field(field)) return false
          view.dispatch({ effects: dismissSignature.of(null) })
          return true
        },
      },
    ]),
  ]
})()
