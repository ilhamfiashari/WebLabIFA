import { indentRange, indentUnit, syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { editorIndentSize, editorLanguageSupport, type EditorLanguage } from '../shared/codemirrorSetup'

function pythonStructure(state: EditorState): string {
  const tree = syntaxTree(state)
  const literals: string[] = []
  tree.iterate({
    enter(node) {
      if (/^(String|FormatString|Comment)$/.test(node.name)) {
        literals.push(state.sliceDoc(node.from, node.to))
        return false
      }
    },
  })
  return JSON.stringify([tree.toString(), literals])
}

function formatPythonIndentation(code: string): string {
  const indentation = ' '.repeat(editorIndentSize('python'))
  const extensions = [editorLanguageSupport('python')!, indentUnit.of(indentation)]
  const state = EditorState.create({ doc: code, extensions })
  const formatted = state.update({ changes: indentRange(state, 0, state.doc.length) }).state
  // Python whitespace defines blocks. Keep the original if the reindent would alter its parsed structure.
  if (pythonStructure(state) !== pythonStructure(formatted)) return code
  return formatted.doc.toString().replace(/\n*$/, '\n')
}

/** Load formatters only when requested. Plain text and Arduino sketches have their own editing behavior. */
export async function formatWebDevCode(code: string, language: EditorLanguage): Promise<string> {
  if (!code.trim() || language === 'plain' || language === 'cpp') return code
  if (language === 'python') return formatPythonIndentation(code)
  if (language === 'sql') {
    const { format } = await import('sql-formatter')
    return format(code, { language: 'postgresql', tabWidth: 2 }) + '\n'
  }

  const { format } = await import('prettier/standalone')
  const options = { tabWidth: 2, endOfLine: 'lf' as const, embeddedLanguageFormatting: 'off' as const }
  if (language === 'html') {
    return format(code, { ...options, parser: 'html', plugins: [await import('prettier/plugins/html')] })
  }
  if (language === 'css') {
    return format(code, { ...options, parser: 'css', plugins: [await import('prettier/plugins/postcss')] })
  }

  const estree = await import('prettier/plugins/estree')
  if (language === 'typescript' || language === 'tsx') {
    return format(code, {
      ...options, parser: 'typescript', filepath: `editor.${language === 'tsx' ? 'tsx' : 'ts'}`,
      plugins: [await import('prettier/plugins/typescript'), estree],
    })
  }
  return format(code, {
    ...options, parser: language === 'json' ? 'json' : 'babel',
    plugins: [await import('prettier/plugins/babel'), estree],
  })
}
