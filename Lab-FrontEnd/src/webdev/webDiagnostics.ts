import type { CodeDiagnostic } from '../shared/editorDiagnostics'
import type { WebDevFileLang } from './types'

const HTML_VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

function dedupByLine(diags: CodeDiagnostic[]): CodeDiagnostic[] {
  const seen = new Set<number>()
  return diags
    .sort((a, b) => a.line - b.line || a.col - b.col)
    .filter((d) => {
      if (seen.has(d.line)) return false
      seen.add(d.line)
      return true
    })
}

function lintHtmlCode(code: string): CodeDiagnostic[] {
  const lines = code.replace(/\r\n/g, '\n').split('\n')
  const diags: CodeDiagnostic[] = []
  const tagStack: Array<{ name: string; line: number; col: number }> = []

  let inComment = false
  let inTag = false
  let tagBuf = ''
  let tagLine = 1
  let tagCol = 1
  let tagQuote: '"' | "'" | null = null

  const flushTag = () => {
    const raw = tagBuf.trim()
    inTag = false
    tagBuf = ''
    tagQuote = null
    if (!raw || raw.startsWith('!') || raw.startsWith('?')) return

    if (raw.startsWith('/')) {
      const m = /^\/\s*([A-Za-z][A-Za-z0-9-]*)$/.exec(raw)
      if (!m) {
        diags.push({
          line: tagLine,
          col: tagCol,
          severity: 'error',
          messageId: `Tag penutup '<${raw}>' tidak valid.`,
          messageEn: `Invalid closing tag '<${raw}>'.`,
        })
        return
      }
      const closeName = m[1].toLowerCase()
      const top = tagStack[tagStack.length - 1]
      if (!top) {
        diags.push({
          line: tagLine,
          col: tagCol,
          severity: 'error',
          messageId: `Tag penutup '</${m[1]}>' tidak memiliki pasangan pembuka.`,
          messageEn: `Closing tag '</${m[1]}>' has no matching opening tag.`,
        })
        return
      }
      if (top.name.toLowerCase() === closeName) {
        tagStack.pop()
        return
      }
      const matchIdx = tagStack.map((t) => t.name.toLowerCase()).lastIndexOf(closeName)
      diags.push({
        line: tagLine,
        col: tagCol,
        severity: 'error',
        messageId: `Tag '</${m[1]}>' tidak cocok; diharapkan '</${top.name}>' (dibuka di baris ${top.line}).`,
        messageEn: `Unexpected '</${m[1]}>'; expected '</${top.name}>' opened at line ${top.line}.`,
      })
      if (matchIdx !== -1) {
        tagStack.length = matchIdx
      }
      return
    }

    const nameM = /^([A-Za-z][A-Za-z0-9-]*)/.exec(raw)
    if (!nameM) return
    const tagName = nameM[1]
    const selfClosing = raw.endsWith('/') || HTML_VOID_TAGS.has(tagName.toLowerCase())
    if (!selfClosing) {
      tagStack.push({ name: tagName, line: tagLine, col: tagCol })
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]
      if (inComment) {
        if (line.slice(c, c + 3) === '-->') {
          inComment = false
          c += 2
        }
        continue
      }
      if (!inTag && line.slice(c, c + 4) === '<!--') {
        inComment = true
        c += 3
        continue
      }
      if (inTag) {
        if (tagQuote) {
          tagBuf += ch
          if (ch === tagQuote && line[c - 1] !== '\\') tagQuote = null
          continue
        }
        if (ch === '"' || ch === "'") {
          tagQuote = ch
          tagBuf += ch
          continue
        }
        if (ch === '>') {
          flushTag()
          continue
        }
        if (ch === '<') {
          diags.push({
            line: tagLine,
            col: tagCol,
            severity: 'error',
            messageId: "Tag HTML '<...' belum ditutup dengan '>'.",
            messageEn: "HTML tag '<...' missing closing '>'.",
          })
          tagBuf = ''
          tagLine = lineNo
          tagCol = c + 1
          continue
        }
        tagBuf += ch
        continue
      }
      if (ch === '<') {
        const rest = line.slice(c + 1)
        if (/^(?:[A-Za-z/!])/.test(rest)) {
          inTag = true
          tagBuf = ''
          tagLine = lineNo
          tagCol = c + 1
        }
      }
    }
    if (inTag && tagQuote) {
      diags.push({
        line: lineNo,
        col: tagCol,
        severity: 'error',
        messageId: 'Nilai atribut HTML belum ditutup tanda kutip.',
        messageEn: 'Unterminated HTML attribute quote.',
      })
      tagQuote = null
    }
  }

  if (inTag) {
    diags.push({
      line: tagLine,
      col: tagCol,
      severity: 'error',
      messageId: "Tag HTML belum ditutup dengan '>'.",
      messageEn: "Unclosed HTML tag missing '>'.",
    })
  }
  if (inComment) {
    diags.push({
      line: lines.length,
      col: 1,
      severity: 'error',
      messageId: "Komentar HTML '<!--' belum ditutup dengan '-->'.",
      messageEn: "Unclosed HTML comment missing '-->'.",
    })
  }
  for (const unclosed of tagStack) {
    diags.push({
      line: unclosed.line,
      col: unclosed.col,
      severity: 'error',
      messageId: `Tag '<${unclosed.name}>' di baris ${unclosed.line} belum ditutup dengan '</${unclosed.name}>'.`,
      messageEn: `Tag '<${unclosed.name}>' at line ${unclosed.line} is missing closing '</${unclosed.name}>'.`,
    })
  }

  return dedupByLine(diags)
}

function lintCssCode(code: string): CodeDiagnostic[] {
  const lines = code.replace(/\r\n/g, '\n').split('\n')
  const diags: CodeDiagnostic[] = []
  const braceStack: Array<{ line: number; col: number }> = []
  let inBlockComment = false
  let commentStartLine = 1

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const lineNo = i + 1
    let inStr: '"' | "'" | null = null
    let syn = ''
    const depthBefore = braceStack.length

    for (let c = 0; c < raw.length; c++) {
      const ch = raw[c]
      const next = raw[c + 1] ?? ''
      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false
          c++
        }
        continue
      }
      if (inStr) {
        if (ch === '\\') {
          c++
          continue
        }
        if (ch === inStr) inStr = null
        syn += ch === inStr ? ch : '_'
        continue
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true
        commentStartLine = lineNo
        c++
        continue
      }
      if (ch === '"' || ch === "'") {
        inStr = ch
        syn += ch
        continue
      }
      if (ch === '{') {
        braceStack.push({ line: lineNo, col: c + 1 })
      } else if (ch === '}') {
        if (braceStack.length === 0) {
          diags.push({
            line: lineNo,
            col: c + 1,
            severity: 'error',
            messageId: "Kurung kurawal '}' berlebih di CSS.",
            messageEn: "Unexpected '}' in CSS.",
          })
        } else {
          braceStack.pop()
        }
      }
      syn += ch
    }

    if (inStr) {
      diags.push({
        line: lineNo,
        col: 1,
        severity: 'error',
        messageId: 'String CSS belum ditutup tanda kutip.',
        messageEn: 'Unterminated string literal in CSS.',
      })
      continue
    }

    const trimmed = syn.trim()
    if (!trimmed) continue

    // Analyze single-line CSS rule or property declaration
    if (trimmed.includes('{') && trimmed.includes('}')) {
      const bodyM = /\{([^{}]+)\}/.exec(trimmed)
      if (bodyM) {
        const inner = bodyM[1].trim()
        if (inner && inner.includes(':') && !inner.endsWith(';')) {
          diags.push({
            line: lineNo,
            col: raw.trimEnd().length,
            severity: 'error',
            messageId: "Kurang tanda titik koma (';') pada deklarasi CSS.",
            messageEn: "Missing ';' at end of CSS declaration.",
          })
        }
      }
      continue
    }

    if (trimmed.includes('{') || trimmed.includes('}')) continue
    if (trimmed.startsWith('@') || trimmed.endsWith(',')) continue

    if (depthBefore > 0) {
      if (!trimmed.includes(':')) {
        diags.push({
          line: lineNo,
          col: 1,
          severity: 'error',
          messageId: "Deklarasi CSS tidak valid (format: 'properti: nilai;').",
          messageEn: "Invalid CSS declaration (expected 'property: value;').",
        })
      } else if (!trimmed.endsWith(';') && !trimmed.endsWith('(') && !trimmed.endsWith(':')) {
        diags.push({
          line: lineNo,
          col: raw.trimEnd().length,
          severity: 'error',
          messageId: "Kurang tanda titik koma (';') di akhir properti CSS.",
          messageEn: "Missing semicolon (';') after CSS property.",
        })
      }
    } else if (trimmed.endsWith(';') && trimmed.includes(':')) {
      diags.push({
        line: lineNo,
        col: 1,
        severity: 'error',
        messageId: 'Properti CSS harus berada di dalam blok selector { ... }.',
        messageEn: 'CSS property must be inside a { ... } selector block.',
      })
    }
  }

  if (inBlockComment) {
    diags.push({
      line: commentStartLine,
      col: 1,
      severity: 'error',
      messageId: "Komentar CSS '/*' belum ditutup '*/'.",
      messageEn: "Unclosed CSS block comment.",
    })
  }
  for (const unclosed of braceStack) {
    diags.push({
      line: unclosed.line,
      col: unclosed.col,
      severity: 'error',
      messageId: `Blok '{' CSS di baris ${unclosed.line} belum ditutup '}'.`,
      messageEn: `Unclosed CSS '{' from line ${unclosed.line}.`,
    })
  }

  return dedupByLine(diags)
}

function lintJsOrJsxCode(code: string, isJsx: boolean): CodeDiagnostic[] {
  const lines = code.replace(/\r\n/g, '\n').split('\n')
  const diags: CodeDiagnostic[] = []
  const stack: Array<{ ch: '{' | '(' | '['; line: number; col: number }> = []
  const MATCH: Record<'{' | '(' | '[', string> = { '{': '}', '(': ')', '[': ']' }

  let inBlockComment = false
  let inTemplate: { line: number; col: number } | null = null
  const synLines: string[] = Array(lines.length).fill('')
  const parenBefore: number[] = Array(lines.length).fill(0)
  const parenAfter: number[] = Array(lines.length).fill(0)
  const bracketAfter: number[] = Array(lines.length).fill(0)
  const strErr: boolean[] = Array(lines.length).fill(false)

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const lineNo = i + 1
    let inStr: '"' | "'" | null = null
    let syn = ''
    parenBefore[i] = stack.filter((f) => f.ch === '(').length

    for (let c = 0; c < raw.length; c++) {
      const ch = raw[c]
      const next = raw[c + 1] ?? ''
      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false
          c++
        }
        continue
      }
      if (inTemplate) {
        if (ch === '\\') {
          c++
          continue
        }
        if (ch === '`') {
          inTemplate = null
          syn += '`'
        }
        continue
      }
      if (inStr) {
        if (ch === '\\') {
          c++
          continue
        }
        if (ch === inStr) {
          inStr = null
          syn += ch
        }
        continue
      }
      if (ch === '/' && next === '/') break
      if (ch === '/' && next === '*') {
        inBlockComment = true
        c++
        continue
      }
      if (ch === '`') {
        inTemplate = { line: lineNo, col: c + 1 }
        syn += '`_'
        continue
      }
      if (ch === '"' || ch === "'") {
        inStr = ch
        syn += ch === '"' ? '"_' : "'_"
        continue
      }
      syn += ch

      if (ch === '{' || ch === '(' || ch === '[') {
        stack.push({ ch, line: lineNo, col: c + 1 })
      } else if (ch === '}' || ch === ')' || ch === ']') {
        const top = stack.pop()
        if (!top) {
          diags.push({
            line: lineNo,
            col: c + 1,
            severity: 'error',
            messageId: `Tanda tutup '${ch}' tidak memiliki pasangan pembuka.`,
            messageEn: `Unexpected '${ch}' with no matching opener.`,
          })
        } else if (MATCH[top.ch] !== ch) {
          diags.push({
            line: lineNo,
            col: c + 1,
            severity: 'error',
            messageId: `Tanda '${ch}' tidak cocok dengan '${top.ch}' di baris ${top.line}.`,
            messageEn: `Mismatched '${ch}', expected '${MATCH[top.ch]}' for '${top.ch}' from line ${top.line}.`,
          })
        }
      }
    }

    if (inStr) {
      strErr[i] = true
      diags.push({
        line: lineNo,
        col: 1,
        severity: 'error',
        messageId: 'String JavaScript belum ditutup tanda kutip.',
        messageEn: 'Unterminated string literal.',
      })
    }

    synLines[i] = syn
    parenAfter[i] = stack.filter((f) => f.ch === '(').length
    bracketAfter[i] = stack.filter((f) => f.ch === '[').length
  }

  if (inTemplate) {
    diags.push({
      line: inTemplate.line,
      col: inTemplate.col,
      severity: 'error',
      messageId: 'Template literal backtick (`) belum ditutup.',
      messageEn: 'Unterminated template literal (`).',
    })
  }
  for (const unclosed of stack) {
    diags.push({
      line: unclosed.line,
      col: unclosed.col,
      severity: 'error',
      messageId: `Tanda '${unclosed.ch}' di baris ${unclosed.line} belum ditutup '${MATCH[unclosed.ch]}'.`,
      messageEn: `Unclosed '${unclosed.ch}' at line ${unclosed.line}.`,
    })
  }

  const nextLine = (idx: number): string => {
    for (let j = idx + 1; j < lines.length; j++) {
      const t = synLines[j].trim()
      if (t) return t
    }
    return ''
  }

  for (let i = 0; i < lines.length; i++) {
    if (strErr[i]) continue
    const trimmed = synLines[i].trim()
    if (!trimmed) continue
    const lineNo = i + 1

    if (/^(?:const|let|var)\s*=/.test(trimmed) || /(?:&&|\|\||[^=!<>]=)\s*;$/.test(trimmed)) {
      diags.push({
        line: lineNo,
        col: 1,
        severity: 'error',
        messageId: 'Sintaks pernyataan JavaScript tidak lengkap.',
        messageEn: 'Incomplete JavaScript expression.',
      })
      continue
    }

    if (parenBefore[i] > 0 && isJsx) continue
    if (parenAfter[i] > 0 || bracketAfter[i] > 0) continue
    if (isJsx && trimmed.startsWith('<')) continue
    if (trimmed.endsWith(';') || trimmed.endsWith('{') || trimmed.endsWith('}') || trimmed.endsWith(',') || trimmed.endsWith(':')) {
      continue
    }
    if (/^(?:if|else\s+if|for|while|switch|catch)\s*\(.*\)$/.test(trimmed) || /^(?:else|try|finally)$/.test(trimmed)) {
      continue
    }
    if (/^(?:async\s+)?function\b.*\)$/.test(trimmed)) continue

    const nxt = nextLine(i)
    if (nxt.startsWith('{') || nxt.startsWith('.') || /^[+\-*/?)]/.test(nxt)) continue
    if (/(=>|[+\-*/%=<>!&|.?])$/.test(trimmed) && nxt && !nxt.startsWith('}')) continue

    diags.push({
      line: lineNo,
      col: lines[i].trimEnd().length,
      severity: 'error',
      messageId: "Kurang tanda titik koma (';') di akhir pernyataan JS.",
      messageEn: "Missing ';' at end of JS statement.",
    })
  }

  return dedupByLine(diags)
}

function lintPythonCode(code: string): CodeDiagnostic[] {
  const lines = code.replace(/\r\n/g, '\n').split('\n')
  const diags: CodeDiagnostic[] = []
  const stack: Array<{ ch: '(' | '[' | '{'; line: number; col: number }> = []
  const MATCH: Record<'(' | '[' | '{', string> = { '(': ')', '[': ']', '{': '}' }
  let tripleQuote: { q: '"""' | "'''"; line: number } | null = null

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const lineNo = i + 1
    let inStr: '"' | "'" | null = null
    let syn = ''
    const depthBefore = stack.length

    for (let c = 0; c < raw.length; c++) {
      const ch = raw[c]
      if (tripleQuote) {
        if (raw.slice(c, c + 3) === tripleQuote.q) {
          tripleQuote = null
          c += 2
        }
        continue
      }
      if (inStr) {
        if (ch === '\\') {
          c++
          continue
        }
        if (ch === inStr) {
          inStr = null
          syn += ch
        }
        continue
      }
      if (ch === '#') break
      if (raw.slice(c, c + 3) === '"""' || raw.slice(c, c + 3) === "'''") {
        tripleQuote = { q: raw.slice(c, c + 3) as '"""' | "'''", line: lineNo }
        syn += '"'
        c += 2
        continue
      }
      if (ch === '"' || ch === "'") {
        inStr = ch
        syn += ch === '"' ? '"_' : "'_"
        continue
      }
      syn += ch
      if (ch === '(' || ch === '[' || ch === '{') {
        stack.push({ ch, line: lineNo, col: c + 1 })
      } else if (ch === ')' || ch === ']' || ch === '}') {
        const top = stack.pop()
        if (!top || MATCH[top.ch] !== ch) {
          diags.push({
            line: lineNo,
            col: c + 1,
            severity: 'error',
            messageId: top
              ? `Tanda '${ch}' tidak cocok dengan '${top.ch}' di baris ${top.line}.`
              : `Tanda tutup '${ch}' tidak memiliki pasangan pembuka.`,
            messageEn: top ? `Mismatched '${ch}'.` : `Unexpected '${ch}'.`,
          })
        }
      }
    }

    if (inStr && !raw.trimEnd().endsWith('\\')) {
      diags.push({
        line: lineNo,
        col: 1,
        severity: 'error',
        messageId: 'String Python belum ditutup tanda kutip.',
        messageEn: 'Unterminated Python string literal.',
      })
      continue
    }

    const trimmed = syn.trim()
    if (!trimmed || trimmed.startsWith('@')) continue

    if (
      depthBefore === 0 &&
      stack.length === 0 &&
      /^(?:def|class|elif|else|for|while|try|except|finally|with|if)\b/.test(trimmed) &&
      !trimmed.endsWith(':') &&
      !trimmed.endsWith('\\')
    ) {
      diags.push({
        line: lineNo,
        col: raw.trimEnd().length,
        severity: 'error',
        messageId: "Kurang tanda titik dua (':') di akhir header blok Python.",
        messageEn: "Expected ':' at end of Python block header.",
      })
      continue
    }

    if (stack.length === 0 && trimmed.endsWith(':')) {
      const curIndent = /^([ \t]*)/.exec(raw)?.[1].length ?? 0
      for (let j = i + 1; j < lines.length; j++) {
        const nxtTrim = lines[j].trim()
        if (!nxtTrim || nxtTrim.startsWith('#')) continue
        const nxtIndent = /^([ \t]*)/.exec(lines[j])?.[1].length ?? 0
        if (nxtIndent <= curIndent) {
          diags.push({
            line: j + 1,
            col: 1,
            severity: 'error',
            messageId: "Baris isi blok Python setelah ':' harus di-indent ke kanan.",
            messageEn: "Expected an indented block after ':'.",
          })
        }
        break
      }
    }
  }

  if (tripleQuote) {
    diags.push({
      line: tripleQuote.line,
      col: 1,
      severity: 'error',
      messageId: `String multiline ${tripleQuote.q} belum ditutup.`,
      messageEn: `Unterminated ${tripleQuote.q} string.`,
    })
  }
  for (const unclosed of stack) {
    diags.push({
      line: unclosed.line,
      col: unclosed.col,
      severity: 'error',
      messageId: `Tanda '${unclosed.ch}' di baris ${unclosed.line} belum ditutup '${MATCH[unclosed.ch]}'.`,
      messageEn: `Unclosed '${unclosed.ch}'.`,
    })
  }

  return dedupByLine(diags)
}

function lintSqlCode(code: string): CodeDiagnostic[] {
  const lines = code.replace(/\r\n/g, '\n').split('\n')
  const diags: CodeDiagnostic[] = []
  let parenDepth = 0
  let inSingleQuote: number | null = null
  let lastCodeLine = 0
  let lastEndedSemi = true

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const lineNo = i + 1
    let syn = ''

    for (let c = 0; c < raw.length; c++) {
      const ch = raw[c]
      const next = raw[c + 1] ?? ''
      if (!inSingleQuote && ch === '-' && next === '-') break
      if (ch === "'" && raw[c - 1] !== '\\') {
        inSingleQuote = inSingleQuote ? null : lineNo
        syn += "'"
        continue
      }
      if (inSingleQuote) continue
      syn += ch
      if (ch === '(') parenDepth++
      else if (ch === ')') {
        if (parenDepth === 0) {
          diags.push({
            line: lineNo,
            col: c + 1,
            severity: 'error',
            messageId: "Tanda ')' berlebih di kueri SQL.",
            messageEn: "Unexpected ')' in SQL.",
          })
        } else {
          parenDepth--
        }
      }
    }

    const trimmed = syn.trim()
    if (!trimmed) continue

    const startsNewStmt = /^(?:CREATE|INSERT|SELECT|UPDATE|DELETE|DROP|ALTER)\b/i.test(trimmed)
    if (startsNewStmt && !lastEndedSemi && lastCodeLine > 0 && parenDepth === 0) {
      diags.push({
        line: lastCodeLine,
        col: 1,
        severity: 'error',
        messageId: "Kurang tanda titik koma (';') sebelum perintah SQL berikutnya.",
        messageEn: "Missing ';' before next SQL statement.",
      })
    }
    lastCodeLine = lineNo
    lastEndedSemi = trimmed.endsWith(';')
  }

  if (inSingleQuote !== null) {
    diags.push({
      line: inSingleQuote,
      col: 1,
      severity: 'error',
      messageId: "String SQL (') belum ditutup.",
      messageEn: 'Unterminated SQL string literal.',
    })
  } else if (parenDepth > 0) {
    diags.push({
      line: lastCodeLine || lines.length,
      col: 1,
      severity: 'error',
      messageId: "Tanda kurung '(' pada kueri SQL belum ditutup ')'.",
      messageEn: "Unclosed '(' in SQL query.",
    })
  } else if (lastCodeLine > 0 && !lastEndedSemi) {
    diags.push({
      line: lastCodeLine,
      col: lines[lastCodeLine - 1]?.trimEnd().length || 1,
      severity: 'error',
      messageId: "Kurang tanda titik koma (';') di akhir kueri SQL.",
      messageEn: "Missing ';' at end of SQL query.",
    })
  }

  return dedupByLine(diags)
}

function lintJsonCode(code: string): CodeDiagnostic[] {
  if (!code.trim()) return []
  try {
    JSON.parse(code)
    return []
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid JSON'
    const posM = /position\s+(\d+)/i.exec(msg)
    let line = 1
    let col = 1
    if (posM) {
      const offset = Number(posM[1])
      const before = code.slice(0, offset).split('\n')
      line = before.length
      col = (before[before.length - 1]?.length ?? 0) + 1
    }
    return [
      {
        line,
        col,
        severity: 'error',
        messageId: `Sintaks JSON tidak valid (${msg}).`,
        messageEn: `Invalid JSON syntax (${msg}).`,
      },
    ]
  }
}

/** Lint web source code line-by-line across HTML, CSS, JS, JSX, Python, SQL, and JSON. */
export function lintWebDevCode(code: string, lang: WebDevFileLang): CodeDiagnostic[] {
  switch (lang) {
    case 'html':
      return lintHtmlCode(code)
    case 'css':
      return lintCssCode(code)
    case 'js':
      return lintJsOrJsxCode(code, false)
    case 'jsx':
      return lintJsOrJsxCode(code, true)
    case 'python':
      return lintPythonCode(code)
    case 'sql':
      return lintSqlCode(code)
    case 'json':
      return lintJsonCode(code)
    default:
      return []
  }
}
