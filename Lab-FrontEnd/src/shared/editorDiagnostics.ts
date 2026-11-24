export interface CodeDiagnostic {
  line: number
  col: number
  length?: number
  severity: 'error' | 'warning'
  messageId: string
  messageEn: string
}

export interface HighlightTokenLike {
  text: string
  type: string
}

/** Split a flat token stream at `\n` boundaries so each editor line can carry line-level decorations. */
export function groupHighlightTokensByLine<T extends HighlightTokenLike>(tokens: T[]): T[][] {
  const lines: T[][] = [[]]
  for (const tok of tokens) {
    if (!tok.text.includes('\n')) {
      lines[lines.length - 1].push(tok)
      continue
    }
    const parts = tok.text.split('\n')
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].length > 0) {
        lines[lines.length - 1].push({ ...tok, text: parts[i] })
      }
      if (i < parts.length - 1) {
        lines.push([])
      }
    }
  }
  return lines
}

/** Split leading horizontal indentation from the first token of an error line so squiggles start on code. */
export function splitLeadingLineSpaces<T extends HighlightTokenLike>(
  lineTokens: T[],
): { indent: string; rest: T[] } {
  if (lineTokens.length === 0) return { indent: '', rest: lineTokens }
  const first = lineTokens[0]
  const wsMatch = /^([ \t]+)(.*)$/.exec(first.text)
  if (!wsMatch) return { indent: '', rest: lineTokens }
  const [, indent, tail] = wsMatch
  const rest = tail ? [{ ...first, text: tail }, ...lineTokens.slice(1)] : lineTokens.slice(1)
  return { indent, rest }
}

/** Convert 1-based line and column to a 0-based textarea character offset. */
export function lineColToOffset(code: string, line: number, col: number): number {
  const lines = code.split('\n')
  const safeLine = Math.max(1, Math.min(line, lines.length))
  let offset = 0
  for (let i = 0; i < safeLine - 1; i++) {
    offset += lines[i].length + 1
  }
  const lineLen = lines[safeLine - 1]?.length ?? 0
  return offset + Math.max(0, Math.min(col - 1, lineLen))
}
