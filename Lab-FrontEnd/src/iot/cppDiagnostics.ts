import type { CodeDiagnostic } from '../shared/editorDiagnostics'

const CPP_DECL_KEYWORDS = new Set([
  'void',
  'int',
  'float',
  'double',
  'long',
  'short',
  'char',
  'byte',
  'bool',
  'boolean',
  'String',
  'const',
  'unsigned',
  'signed',
  'static',
  'volatile',
  'extern',
  'uint8_t',
  'uint16_t',
  'uint32_t',
  'int8_t',
  'int16_t',
  'int32_t',
  'size_t',
  'struct',
  'enum',
  'class',
  'typename',
  'return',
  'else',
  'new',
  'delete',
  'case',
  'sizeof',
])

interface DelimFrame {
  ch: '{' | '(' | '['
  line: number
  col: number
  isInitializer?: boolean
  isControlParen?: boolean
}

const MATCHING_CLOSE: Record<DelimFrame['ch'], string> = {
  '{': '}',
  '(': ')',
  '[': ']',
}

function isContinuationOpEnd(s: string): boolean {
  if (/(\+\+|--)$/.test(s)) return false
  return /(?:&&|\|\||<<|>>|->|[+\-*/%=<>!&|^.,?(])$/.test(s)
}

function isContinuationStart(s: string): boolean {
  return /^(?:&&|\|\||<<|>>|->|\.|[+\-*/%?:)\]}>])/.test(s)
}

function isControlHeaderLine(trimmed: string): boolean {
  if (/^(?:if|else\s+if|for|while|switch|catch)\s*\([\s\S]*\)$/.test(trimmed)) return true
  if (/^\}\s*else(?:\s+if\s*\([\s\S]*\))?$/.test(trimmed)) return true
  if (/^(?:else|do)$/.test(trimmed)) return true
  return false
}

/** Lint Arduino C++ / C / header code line-by-line for missing semicolons, quotes, brackets, and syntax errors. */
export function lintArduinoCpp(code: string): CodeDiagnostic[] {
  const lines = code.replace(/\r\n/g, '\n').split('\n')
  const diagnostics: CodeDiagnostic[] = []
  const stack: DelimFrame[] = []

  const syntaxLines: string[] = Array(lines.length).fill('')
  const rawTrimmedEndCol: number[] = Array(lines.length).fill(1)
  const endedInStrErr: boolean[] = Array(lines.length).fill(false)
  const parenAfter: number[] = Array(lines.length).fill(0)
  const bracketAfter: number[] = Array(lines.length).fill(0)
  const inInitializerAfter: boolean[] = Array(lines.length).fill(false)
  const closedInitializerLine: boolean[] = Array(lines.length).fill(false)
  const closedControlParenLine: boolean[] = Array(lines.length).fill(false)
  const isPreprocessorLine: boolean[] = Array(lines.length).fill(false)

  let inBlockComment = false
  let inMacroCont = false

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const lineNo = i + 1
    let inStr: '"' | "'" | null = null
    let strStartCol = 1
    let syn = ''
    let prevSignificant = ''

    const trimmedRaw = rawLine.trimEnd()
    rawTrimmedEndCol[i] = Math.max(1, trimmedRaw.length)

    if (!inBlockComment && !inStr && (inMacroCont || /^\s*#/.test(rawLine))) {
      isPreprocessorLine[i] = true
      inMacroCont = trimmedRaw.endsWith('\\')
      const incClean = rawLine.trim()
      if (/^#include\s*</.test(incClean) && !/^#include\s*<[^<>]+>/.test(incClean)) {
        diagnostics.push({
          line: lineNo,
          col: 1,
          severity: 'error',
          messageId: "Direktif '#include <...>' belum ditutup dengan '>'.",
          messageEn: "Missing closing '>' in '#include' directive.",
        })
      } else if (/^#include\s*"/.test(incClean) && !/^#include\s*"[^"]+"/.test(incClean)) {
        diagnostics.push({
          line: lineNo,
          col: 1,
          severity: 'error',
          messageId: 'Direktif \'#include "..."\' belum ditutup tanda kutip.',
          messageEn: 'Unterminated quote in \'#include\' directive.',
        })
      }
      parenAfter[i] = stack.filter((f) => f.ch === '(').length
      bracketAfter[i] = stack.filter((f) => f.ch === '[').length
      inInitializerAfter[i] = stack.some((f) => f.isInitializer)
      continue
    }
    inMacroCont = false

    for (let c = 0; c < rawLine.length; c++) {
      const ch = rawLine[c]
      const next = rawLine[c + 1] ?? ''

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
        if (ch === inStr) {
          inStr = null
          syn += ch
        }
        continue
      }

      if (ch === '/' && next === '/') {
        break
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true
        c++
        continue
      }

      if (ch === '"' || ch === "'") {
        inStr = ch
        strStartCol = c + 1
        syn += ch === '"' ? '"_' : "'_"
        prevSignificant = ch
        continue
      }

      syn += ch

      if (ch === '{' || ch === '(' || ch === '[') {
        const prefixBeforeParen = rawLine.slice(0, c).trim()
        const isControlParen =
          ch === '(' && /\b(?:if|else\s+if|for|while|switch|catch)$/.test(prefixBeforeParen)
        const isInitializer =
          ch === '{' && (prevSignificant === '=' || prevSignificant === ',' || prevSignificant === ']')
        stack.push({ ch, line: lineNo, col: c + 1, isInitializer, isControlParen })
      } else if (ch === '}' || ch === ')' || ch === ']') {
        const top = stack.pop()
        if (!top) {
          diagnostics.push({
            line: lineNo,
            col: c + 1,
            severity: 'error',
            messageId: `Tanda tutup '${ch}' tidak memiliki pasangan pembuka.`,
            messageEn: `Unexpected closing '${ch}' with no matching opener.`,
          })
        } else if (MATCHING_CLOSE[top.ch] !== ch) {
          diagnostics.push({
            line: lineNo,
            col: c + 1,
            severity: 'error',
            messageId: `Tanda '${ch}' tidak cocok dengan '${top.ch}' di baris ${top.line}.`,
            messageEn: `Mismatched '${ch}', expected '${MATCHING_CLOSE[top.ch]}' for '${top.ch}' at line ${top.line}.`,
          })
        } else {
          if (top.ch === '{' && top.isInitializer) closedInitializerLine[i] = true
          if (top.ch === '(' && top.isControlParen) closedControlParenLine[i] = true
        }
      }

      if (!/\s/.test(ch)) {
        prevSignificant = ch
      }
    }

    if (inStr && !trimmedRaw.endsWith('\\')) {
      endedInStrErr[i] = true
      diagnostics.push({
        line: lineNo,
        col: strStartCol,
        severity: 'error',
        messageId:
          inStr === '"'
            ? 'Teks string ("...") belum ditutup pada baris ini.'
            : "Literal karakter ('...') belum ditutup pada baris ini.",
        messageEn: inStr === '"' ? 'Unterminated string literal.' : 'Unterminated character literal.',
      })
    }

    syntaxLines[i] = syn
    parenAfter[i] = stack.filter((f) => f.ch === '(').length
    bracketAfter[i] = stack.filter((f) => f.ch === '[').length
    inInitializerAfter[i] = stack.some((f) => f.isInitializer)
  }

  for (const unclosed of stack) {
    diagnostics.push({
      line: unclosed.line,
      col: unclosed.col,
      severity: 'error',
      messageId: `Tanda '${unclosed.ch}' pada baris ${unclosed.line} belum ditutup dengan '${MATCHING_CLOSE[unclosed.ch]}'.`,
      messageEn: `Unclosed '${unclosed.ch}' from line ${unclosed.line}, expected '${MATCHING_CLOSE[unclosed.ch]}'.`,
    })
  }

  const nextCodeIdx = (from: number): number => {
    for (let j = from + 1; j < lines.length; j++) {
      if (isPreprocessorLine[j]) continue
      if (syntaxLines[j].trim().length > 0) return j
    }
    return -1
  }

  for (let i = 0; i < lines.length; i++) {
    if (isPreprocessorLine[i] || endedInStrErr[i]) continue
    const trimmed = syntaxLines[i].trim()
    if (!trimmed) continue
    const lineNo = i + 1

    // 1. Structural inline C++ syntax errors
    if (/\(\s*,|,\s*\)/.test(trimmed)) {
      diagnostics.push({
        line: lineNo,
        col: rawTrimmedEndCol[i],
        severity: 'error',
        messageId: 'Argumen fungsi tidak lengkap di sekitar tanda koma.',
        messageEn: 'Unexpected comma in argument list.',
      })
      continue
    }

    if (/\b(?:if|else\s+if|while)\s*\(\s*\)/.test(trimmed)) {
      diagnostics.push({
        line: lineNo,
        col: rawTrimmedEndCol[i],
        severity: 'error',
        messageId: 'Kondisi di dalam if/while tidak boleh kosong.',
        messageEn: 'Condition inside if/while cannot be empty.',
      })
      continue
    }

    if (/(?:&&|\|\||[^=!<>]=|[+\-*/,])\s*;(?:\s*\})?$/.test(trimmed)) {
      diagnostics.push({
        line: lineNo,
        col: rawTrimmedEndCol[i],
        severity: 'error',
        messageId: "Ekspresi belum lengkap sebelum tanda ';'.",
        messageEn: "Incomplete expression before ';'.",
      })
      continue
    }

    // Detect missing comma inside parenthesized call arguments, e.g. pinMode(LED_PIN OUTPUT)
    if (!/^(?:for|if|else\s+if|while|switch)\s*\(/.test(trimmed) && !trimmed.endsWith('{')) {
      const nextI = nextCodeIdx(i)
      const isFuncDefSignature =
        nextI !== -1 &&
        syntaxLines[nextI].trim().startsWith('{') &&
        /^[A-Za-z_]\w*(?:\s*\*)?\s+[A-Za-z_~]\w*\s*\([^)]*\)$/.test(trimmed)
      if (!isFuncDefSignature) {
        const parenM = /\(([^()]+)\)/.exec(trimmed)
        if (parenM) {
          const inner = parenM[1]
          const adjRe = /\b([A-Za-z_]\w*|\d+(?:\.\d+)?)\s+([A-Za-z_]\w*|\d+(?:\.\d+)?)\b/g
          let am: RegExpExecArray | null
          let adjError = false
          while ((am = adjRe.exec(inner)) !== null) {
            if (!CPP_DECL_KEYWORDS.has(am[1]) && !CPP_DECL_KEYWORDS.has(am[2])) {
              adjError = true
              break
            }
          }
          if (adjError) {
            diagnostics.push({
              line: lineNo,
              col: rawTrimmedEndCol[i],
              severity: 'error',
              messageId: "Kurang koma (',') atau operator di dalam tanda kurung.",
              messageEn: "Missing ',' or operator inside parentheses.",
            })
            continue
          }
        }
      }
    }

    // Same-line `{ stmt }` missing semicolon before closing brace
    const singleBlockM = /\{([^{}]+)\}$/.exec(trimmed)
    if (singleBlockM && !trimmed.includes('= {')) {
      const innerBody = singleBlockM[1].trim()
      if (
        innerBody &&
        !innerBody.endsWith(';') &&
        !innerBody.endsWith(':') &&
        !isControlHeaderLine(innerBody)
      ) {
        diagnostics.push({
          line: lineNo,
          col: rawTrimmedEndCol[i],
          severity: 'error',
          messageId: "Kurang tanda titik koma (';') sebelum '}'.",
          messageEn: "Missing ';' before closing '}'.",
        })
        continue
      }
    }

    // 2. Trailing semicolon check
    if (lines[i].trimEnd().endsWith('\\')) continue
    if (parenAfter[i] > 0 || bracketAfter[i] > 0) continue
    if (inInitializerAfter[i]) continue

    if (trimmed.endsWith(';') || trimmed.endsWith(',')) continue
    if (trimmed.endsWith('{')) continue
    if (trimmed.endsWith('}')) {
      if (closedInitializerLine[i]) {
        diagnostics.push({
          line: lineNo,
          col: rawTrimmedEndCol[i],
          severity: 'error',
          messageId: "Kurang tanda ';' setelah deklarasi array/blok '{...}'.",
          messageEn: "Missing ';' after initializer list.",
        })
      }
      continue
    }
    if (/^(?:case\b.*|default|public|private|protected)\s*:$/.test(trimmed)) continue

    if (isControlHeaderLine(trimmed) || closedControlParenLine[i]) continue

    const nextI = nextCodeIdx(i)
    const nextTrimmed = nextI !== -1 ? syntaxLines[nextI].trim() : ''

    // Allman brace style (void setup()\n{ ... })
    if (nextTrimmed.startsWith('{')) continue

    if (isContinuationOpEnd(trimmed)) {
      const nextStartsNewStmt =
        !nextTrimmed ||
        nextTrimmed.startsWith('}') ||
        /^(?:void|int|float|double|long|bool|boolean|char|byte|String|const|if|else|for|while|return|break|continue|Serial|pinMode|digitalWrite|analogWrite|delay|tone|noTone)\b/.test(
          nextTrimmed,
        )
      if (nextStartsNewStmt) {
        diagnostics.push({
          line: lineNo,
          col: rawTrimmedEndCol[i],
          severity: 'error',
          messageId: "Ekspresi pada baris ini belum lengkap atau kurang ';'.",
          messageEn: "Incomplete expression or missing ';' on this line.",
        })
      }
      continue
    }

    if (nextTrimmed && isContinuationStart(nextTrimmed)) continue

    // Complete expression/declaration/call line that forgot ';'
    diagnostics.push({
      line: lineNo,
      col: rawTrimmedEndCol[i],
      severity: 'error',
      messageId: "Kurang tanda titik koma (';') di akhir baris ini.",
      messageEn: "Missing semicolon (';') at end of statement.",
    })
  }

  // Deduplicate keeping first diagnostic per line for crisp gutter/row presentation
  const seenLine = new Set<number>()
  return diagnostics
    .sort((a, b) => a.line - b.line || a.col - b.col)
    .filter((d) => {
      if (seenLine.has(d.line)) return false
      seenLine.add(d.line)
      return true
    })
}
