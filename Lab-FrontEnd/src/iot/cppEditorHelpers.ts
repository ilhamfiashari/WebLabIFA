const INDENT_UNIT = '  '

const PAIRS: Record<string, string> = {
  '{': '}',
  '(': ')',
  '[': ']',
  '"': '"',
  "'": "'",
}

const CLOSERS = new Set(Object.values(PAIRS))

export function getLineCol(code: string, cursor: number): { line: number; col: number } {
  const safeCursor = Math.max(0, Math.min(cursor, code.length))
  const before = code.slice(0, safeCursor)
  const lines = before.split('\n')
  return {
    line: lines.length,
    col: (lines[lines.length - 1]?.length ?? 0) + 1,
  }
}

/** Smart Enter: preserves indentation, adds +2 spaces after `{`, and expands `{|}` blocks cleanly. */
export function handleSmartEnter(
  code: string,
  start: number,
  end: number,
): { nextCode: string; nextCursor: number } {
  const lineStart = code.lastIndexOf('\n', start - 1) + 1
  const currentLineBefore = code.slice(lineStart, start)
  const indentMatch = /^([ \t]*)/.exec(currentLineBefore)
  const baseIndent = indentMatch ? indentMatch[1] : ''

  const trimmedBefore = currentLineBefore.trimEnd()
  const nextChar = code[end] ?? ''
  const opensBlock = trimmedBefore.endsWith('{')
  const betweenBraces = opensBlock && nextChar === '}'

  if (betweenBraces) {
    const insertion = `\n${baseIndent}${INDENT_UNIT}\n${baseIndent}`
    const nextCode = code.slice(0, start) + insertion + code.slice(end)
    const nextCursor = start + 1 + baseIndent.length + INDENT_UNIT.length
    return { nextCode, nextCursor }
  }

  const nextIndent = opensBlock ? `${baseIndent}${INDENT_UNIT}` : baseIndent
  const insertion = `\n${nextIndent}`
  const nextCode = code.slice(0, start) + insertion + code.slice(end)
  return { nextCode, nextCursor: start + insertion.length }
}

/** Tab / Shift+Tab smart indentation for single cursor or multi-line selection. */
export function handleSmartIndent(
  code: string,
  start: number,
  end: number,
  outdent: boolean,
): { nextCode: string; nextSelStart: number; nextSelEnd: number } {
  if (start === end && !outdent) {
    const nextCode = code.slice(0, start) + INDENT_UNIT + code.slice(end)
    const pos = start + INDENT_UNIT.length
    return { nextCode, nextSelStart: pos, nextSelEnd: pos }
  }

  const blockStart = code.lastIndexOf('\n', start - 1) + 1
  const endLineBreak = code.indexOf('\n', end)
  const blockEnd = endLineBreak === -1 ? code.length : endLineBreak
  const selectedLines = code.slice(blockStart, blockEnd).split('\n')

  let firstDelta = 0
  let totalDelta = 0

  const updatedLines = selectedLines.map((line, idx) => {
    if (!outdent) {
      if (idx === 0) firstDelta = INDENT_UNIT.length
      totalDelta += INDENT_UNIT.length
      return `${INDENT_UNIT}${line}`
    }
    let remove = 0
    if (line.startsWith(INDENT_UNIT)) remove = INDENT_UNIT.length
    else if (line.startsWith('\t') || line.startsWith(' ')) remove = 1
    if (idx === 0) firstDelta = -remove
    totalDelta -= remove
    return line.slice(remove)
  })

  const nextCode = code.slice(0, blockStart) + updatedLines.join('\n') + code.slice(blockEnd)
  const nextSelStart = Math.max(blockStart, start + firstDelta)
  const nextSelEnd = Math.max(nextSelStart, end + totalDelta)
  return { nextCode, nextSelStart, nextSelEnd }
}

/** Outdent line when typing closing `}` on an indented whitespace-only line. */
export function handleSmartClosingBrace(
  code: string,
  start: number,
  end: number,
): { nextCode: string; nextCursor: number } | null {
  if (start !== end) return null
  const lineStart = code.lastIndexOf('\n', start - 1) + 1
  const before = code.slice(lineStart, start)
  if (!/^[ ]{2,}$/.test(before)) return null
  const nextChar = code[end] ?? ''
  if (nextChar === '}') {
    // Skip over existing auto-closed `}` and outdent if empty
    return { nextCode: code, nextCursor: end + 1 }
  }
  const outdented = before.slice(INDENT_UNIT.length)
  const nextCode = code.slice(0, lineStart) + `${outdented}}` + code.slice(end)
  return { nextCode, nextCursor: lineStart + outdented.length + 1 }
}

/** Auto-pair delimiters or skip existing closer when typing right before it. */
export function handleSmartPairOrClose(
  code: string,
  start: number,
  end: number,
  key: string,
): { nextCode: string; nextCursor: number } | null {
  if (start !== end) {
    if (key in PAIRS) {
      const selected = code.slice(start, end)
      const close = PAIRS[key]
      const nextCode = code.slice(0, start) + key + selected + close + code.slice(end)
      return { nextCode, nextCursor: end + 2 }
    }
    return null
  }

  const nextChar = code[start] ?? ''
  if (CLOSERS.has(key) && nextChar === key) {
    return { nextCode: code, nextCursor: start + 1 }
  }

  if (key in PAIRS) {
    if (nextChar && !/[\s)}\];,]/.test(nextChar)) {
      return null
    }
    const close = PAIRS[key]
    const nextCode = code.slice(0, start) + key + close + code.slice(end)
    return { nextCode, nextCursor: start + 1 }
  }

  return null
}

/** Remove matching empty pair when pressing Backspace inside `{}`, `()`, `[]`, `""`, `''`. */
export function handleSmartBackspace(
  code: string,
  start: number,
  end: number,
): { nextCode: string; nextCursor: number } | null {
  if (start !== end || start <= 0) return null
  const prevChar = code[start - 1]
  const nextChar = code[start] ?? ''
  if (PAIRS[prevChar] === nextChar) {
    const nextCode = code.slice(0, start - 1) + code.slice(start + 1)
    return { nextCode, nextCursor: start - 1 }
  }
  return null
}

function countBracesOutsideLiterals(
  line: string,
  inBlockComment: boolean,
): { open: number; close: number; leadingCloses: number; inBlockComment: boolean } {
  let open = 0
  let close = 0
  let leadingCloses = 0
  let sawNonCloseCode = false
  let inStr: '"' | "'" | null = null
  let block = inBlockComment

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    const next = line[i + 1] ?? ''

    if (block) {
      if (ch === '*' && next === '/') {
        block = false
        i++
      }
      continue
    }

    if (inStr) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === inStr) {
        inStr = null
      }
      continue
    }

    if (ch === '/' && next === '/') break
    if (ch === '/' && next === '*') {
      block = true
      i++
      continue
    }

    if (ch === '"' || ch === "'") {
      sawNonCloseCode = true
      inStr = ch
      continue
    }

    if (ch === '{') {
      sawNonCloseCode = true
      open++
    } else if (ch === '}') {
      close++
      if (!sawNonCloseCode) leadingCloses++
    } else if (!/\s/.test(ch)) {
      sawNonCloseCode = true
    }
  }

  return { open, close, leadingCloses, inBlockComment: block }
}

/** Auto-indent an entire Arduino C++ sketch cleanly using 2-space indentation per brace depth. */
export function formatArduinoCpp(code: string): string {
  const lines = code.replace(/\r\n/g, '\n').split('\n')
  let depth = 0
  let inBlockComment = false
  let prevWasBlank = false
  const out: string[] = []

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed) {
      if (out.length > 0 && !prevWasBlank) {
        out.push('')
      }
      prevWasBlank = true
      continue
    }
    prevWasBlank = false

    const stats = countBracesOutsideLiterals(trimmed, inBlockComment)
    inBlockComment = stats.inBlockComment

    const effectiveDepth = Math.max(0, depth - stats.leadingCloses)
    out.push(`${INDENT_UNIT.repeat(effectiveDepth)}${trimmed}`)
    depth = Math.max(0, depth + stats.open - stats.close)
  }

  while (out.length > 0 && out[out.length - 1] === '') {
    out.pop()
  }
  return out.join('\n')
}
