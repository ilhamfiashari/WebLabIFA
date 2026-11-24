import { Text } from '@codemirror/state'
import { parse } from 'pgsql-ast-parser'
import { editorLanguageLabel, editorLanguageSupport, type EditorLanguage } from '../shared/codemirrorSetup'
import type { CodeDiagnostic } from '../shared/editorDiagnostics'

// HTML permits these end tags to be omitted in context. The grammar handles the implicit closes.
const OPTIONAL_END_TAGS = new Set([
  'html', 'head', 'body', 'li', 'dt', 'dd', 'p', 'rt', 'rp', 'optgroup', 'option',
  'colgroup', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
])

export function lintWebDevCode(code: string, language: EditorLanguage): CodeDiagnostic[] {
  if (!code.trim() || language === 'plain' || language === 'cpp') return []
  const doc = Text.of(code.split(/\r\n?|\n/))
  const source = doc.toString()
  const diagnostics = new Map<number, CodeDiagnostic>()

  const add = (from: number, to: number, messageId: string, messageEn: string) => {
    const position = Math.max(0, Math.min(from, doc.length))
    const line = doc.lineAt(position)
    if (!diagnostics.has(line.number)) diagnostics.set(line.number, {
      line: line.number,
      col: position - line.from + 1,
      length: Math.max(1, to - from),
      severity: 'error',
      messageId,
      messageEn,
    })
  }

  if (language === 'sql') {
    try {
      parse(source)
    } catch (error) {
      const token = (error as { token?: { offset: number; text?: string } }).token
      const from = token?.offset ?? source.trimEnd().length
      add(from, from + (token?.text?.length ?? 1),
        'Sintaks ini tidak dikenali oleh pemeriksa PostgreSQL.',
        'The PostgreSQL checker could not parse this statement.')
    }
    return [...diagnostics.values()]
  }

  const tree = editorLanguageSupport(language)?.language.parser.parse(source)
  const label = editorLanguageLabel(language, true)
  tree?.iterate({
    enter(node) {
      if (node.type.isError) {
        add(node.from, node.to, `Periksa sintaks ${label} di bagian ini.`, `Check the ${label} syntax here.`)
        // Recovery nodes may contain more errors with the same cause.
        return false
      }
      if (node.name === 'MismatchedCloseTag') {
        const raw = doc.sliceString(node.from, node.to)
        add(
          node.from,
          node.to,
          `Tag penutup '${raw}' tidak cocok dengan tag pembuka.`,
          `Closing tag '${raw}' does not match any open tag.`,
        )
        return false
      }
      if (node.name === 'IncompleteCloseTag') {
        add(node.from, node.to, 'Tag penutup HTML belum lengkap.', 'Incomplete HTML closing tag.')
        return false
      }
      if (node.name === 'Declaration') {
        const prop = node.node.getChild('PropertyName')
        const colon = node.node.getChild(':')
        if (colon && !colon.nextSibling && (!prop || !doc.sliceString(prop.from, prop.to).startsWith('--'))) {
          add(
            node.from,
            node.to,
            'Nilai properti CSS belum diisi setelah tanda ":".',
            'CSS property value is missing after ":".',
          )
          return false
        }
      }
      if (language !== 'html' || node.name !== 'Element') return
      const syntax = node.node
      const open = syntax.getChild('OpenTag')?.getChild('TagName')
      if (!open || syntax.getChild('CloseTag')) return
      const mismatch = syntax.getChild('MismatchedCloseTag')
      if (mismatch && doc.lineAt(mismatch.from).number === doc.lineAt(open.from).number) return
      const tag = doc.sliceString(open.from, open.to)
      if (OPTIONAL_END_TAGS.has(tag.toLowerCase())) return
      add(open.from, open.to, `Tag '<${tag}>' belum ditutup dengan '</${tag}>'.`, `Tag '<${tag}>' needs a closing '</${tag}>'.`)
    },
  })

  return [...diagnostics.values()].sort((a, b) => a.line - b.line)
}
