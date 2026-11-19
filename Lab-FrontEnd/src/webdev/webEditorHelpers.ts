import {
  getLineCol,
  handleSmartBackspace,
  handleSmartClosingBrace,
  handleSmartEnter,
  handleSmartIndent,
  handleSmartPairOrClose,
} from '../iot/cppEditorHelpers'
import type { WebDevFileLang } from './types'

export {
  getLineCol,
  handleSmartBackspace,
  handleSmartClosingBrace,
  handleSmartIndent,
  handleSmartPairOrClose,
}

const VOID_HTML_TAGS = new Set([
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

/** Auto-close HTML/JSX opening tags (`<header>` -> `<header>|</header>`) when pressing `>`. */
export function handleHtmlAutoCloseTag(
  code: string,
  start: number,
  end: number,
  lang: WebDevFileLang,
): { nextCode: string; nextCursor: number } | null {
  if ((lang !== 'html' && lang !== 'jsx') || start !== end) return null
  const before = code.slice(0, start)
  // Ignore arrow functions (`=>`), comparisons, self-closing `/>`, comments `-->`
  if (before.endsWith('=') || before.endsWith('/') || before.endsWith('-')) return null

  const lastLt = before.lastIndexOf('<')
  const lastGt = before.lastIndexOf('>')
  if (lastLt === -1 || lastGt > lastLt) return null

  const tagExpr = before.slice(lastLt + 1)
  if (!tagExpr || tagExpr.startsWith('/') || tagExpr.startsWith('!') || tagExpr.startsWith('?')) {
    return null
  }
  const tagNameM = /^([A-Za-z][A-Za-z0-9-]*)(?:\s|$)/.exec(tagExpr)
  if (!tagNameM) return null

  const tagName = tagNameM[1]
  if (VOID_HTML_TAGS.has(tagName.toLowerCase())) return null

  // Do not double-close if closing tag immediately follows cursor
  const after = code.slice(end)
  if (new RegExp(`^\\s*</${tagName}>`, 'i').test(after)) return null

  const insertion = `></${tagName}>`
  const nextCode = before + insertion + after
  return {
    nextCode,
    nextCursor: start + 1,
  }
}

/** Auto-complete closing tag if user types `/` right after `</` inside HTML/JSX. */
export function handleHtmlClosingSlash(
  code: string,
  start: number,
  end: number,
  lang: WebDevFileLang,
): { nextCode: string; nextCursor: number } | null {
  if ((lang !== 'html' && lang !== 'jsx') || start !== end) return null
  const before = code.slice(0, start)
  if (!before.endsWith('<')) return null

  // Find nearest unclosed tag on the stack before `<`
  const snippet = before.slice(0, -1)
  const stack: string[] = []
  const tagRe = /<(\/?)([A-Za-z][A-Za-z0-9-]*)([^<>]*)>/g
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(snippet)) !== null) {
    const isClose = m[1] === '/'
    const tName = m[2]
    const attrs = m[3] ?? ''
    if (VOID_HTML_TAGS.has(tName.toLowerCase()) || attrs.trimEnd().endsWith('/')) continue
    if (!isClose) {
      stack.push(tName)
    } else {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].toLowerCase() === tName.toLowerCase()) {
          stack.length = i
          break
        }
      }
    }
  }
  const openTag = stack[stack.length - 1]
  if (!openTag) return null
  // Avoid duplicating if cursor is already inside `</tag>`
  const after = code.slice(end)
  if (after.toLowerCase().startsWith(`${openTag.toLowerCase()}>`)) return null

  const insertion = `/${openTag}>`
  return {
    nextCode: before + insertion + after,
    nextCursor: start + insertion.length,
  }
}

/** Smart Enter for HTML/JSX tags, CSS/JS `{}` blocks, and Python `:` blocks. */
export function handleWebSmartEnter(
  code: string,
  start: number,
  end: number,
  lang: WebDevFileLang,
): { nextCode: string; nextCursor: number } {
  const lineStart = code.lastIndexOf('\n', start - 1) + 1
  const currentLineBefore = code.slice(lineStart, start)
  const baseIndent = (/^([ \t]*)/.exec(currentLineBefore)?.[1]) ?? ''

  if (lang === 'html' || lang === 'jsx') {
    const trimmedBefore = currentLineBefore.trimEnd()
    const afterCursor = code.slice(end)
    const openMatch = /<([A-Za-z][A-Za-z0-9-]*)(?:[^<>]*)>$/.exec(trimmedBefore)
    const closeMatch = /^<\/([A-Za-z][A-Za-z0-9-]*)>/.exec(afterCursor)
    if (
      openMatch &&
      closeMatch &&
      openMatch[1].toLowerCase() === closeMatch[1].toLowerCase()
    ) {
      const insertion = `\n${baseIndent}  \n${baseIndent}`
      const nextCode = code.slice(0, start) + insertion + afterCursor
      return {
        nextCode,
        nextCursor: start + 1 + baseIndent.length + 2,
      }
    }
    if (
      openMatch &&
      !trimmedBefore.endsWith('/>') &&
      !VOID_HTML_TAGS.has(openMatch[1].toLowerCase())
    ) {
      const nextIndent = `${baseIndent}  `
      const insertion = `\n${nextIndent}`
      return {
        nextCode: code.slice(0, start) + insertion + code.slice(end),
        nextCursor: start + insertion.length,
      }
    }
  }

  if (lang === 'python' && currentLineBefore.trimEnd().endsWith(':')) {
    const nextIndent = `${baseIndent}    `
    const insertion = `\n${nextIndent}`
    return {
      nextCode: code.slice(0, start) + insertion + code.slice(end),
      nextCursor: start + insertion.length,
    }
  }

  return handleSmartEnter(code, start, end)
}

/** Extended pair auto-closer including backtick `` ` `` for JS/JSX template literals. */
export function handleWebSmartPairOrClose(
  code: string,
  start: number,
  end: number,
  key: string,
  lang: WebDevFileLang,
): { nextCode: string; nextCursor: number } | null {
  if (key === '`' && (lang === 'js' || lang === 'jsx')) {
    if (start !== end) {
      const next = code.slice(0, start) + '`' + code.slice(start, end) + '`' + code.slice(end)
      return { nextCode: next, nextCursor: end + 2 }
    }
    const nextChar = code[start] ?? ''
    if (nextChar === '`') return { nextCode: code, nextCursor: start + 1 }
    if (!nextChar || /[\s)}\];,]/.test(nextChar)) {
      return { nextCode: code.slice(0, start) + '``' + code.slice(end), nextCursor: start + 1 }
    }
    return null
  }
  return handleSmartPairOrClose(code, start, end, key)
}

/** Neat multi-language formatter for Format button & Shift+Alt+F shortcut. */
export function formatWebDevCode(code: string, lang: WebDevFileLang): string {
  const normalized = code.replace(/\r\n/g, '\n')
  if (lang === 'html') {
    return formatHtmlClean(normalized)
  }
  if (lang === 'css' || lang === 'js' || lang === 'jsx') {
    return formatBraceCode(normalized)
  }
  return normalized
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd() + '\n'
}

function formatBraceCode(src: string): string {
  const lines = src.split('\n')
  let depth = 0
  const out: string[] = []
  for (const raw of lines) {
    const trimmed = raw.trim()
    if (!trimmed) {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('')
      continue
    }
    if (trimmed.startsWith('}') || trimmed.startsWith(')')) {
      depth = Math.max(0, depth - 1)
    }
    out.push(`${'  '.repeat(depth)}${trimmed}`)
    let openDelta = 0
    let inStr: string | null = null
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i]
      if (inStr) {
        if (ch === inStr && trimmed[i - 1] !== '\\') inStr = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') inStr = ch
      else if (ch === '{') openDelta++
      else if (ch === '}') openDelta--
    }
    if (trimmed.startsWith('}')) openDelta += 1
    depth = Math.max(0, depth + openDelta)
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop()
  return out.join('\n') + '\n'
}

function formatHtmlClean(src: string): string {
  // Split jammed `><` boundaries while keeping compact inline elements `<tag>short</tag>` together
  const prepped = src
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  let depth = 0
  const out: string[] = []
  for (const line of prepped) {
    const isClosingOnly = /^<\/[A-Za-z0-9-]+>$/.test(line)
    if (isClosingOnly) {
      depth = Math.max(0, depth - 1)
      out.push(`${'  '.repeat(depth)}${line}`)
      continue
    }

    const inlineCompleteM = /^<([A-Za-z][A-Za-z0-9-]*)(?:[^<>]*)>[^<>]*<\/\1>$/.exec(line)
    if (inlineCompleteM) {
      out.push(`${'  '.repeat(depth)}${line}`)
      continue
    }

    const commentOrDoc = line.startsWith('<!--') || line.startsWith('<!')
    const openM = /^<([A-Za-z][A-Za-z0-9-]*)(?:[^<>]*)>$/.exec(line)
    const isVoidOrSelf =
      line.endsWith('/>') || (openM ? VOID_HTML_TAGS.has(openM[1].toLowerCase()) : false)

    out.push(`${'  '.repeat(depth)}${line}`)
    if (!commentOrDoc && openM && !isVoidOrSelf) {
      depth++
    }
  }
  return out.join('\n') + '\n'
}
