import { parse, type DefaultTreeAdapterTypes as HtmlAst } from 'parse5'
import type { VirtualElementDescriptor } from './jsRuntime'

export const ALLOWED_WEB_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup',
  'p', 'div', 'section', 'header', 'nav', 'main', 'footer', 'article', 'aside', 'search',
  'span', 'strong', 'em', 'b', 'i', 'u', 's', 'small', 'mark', 'time', 'abbr', 'address',
  'cite', 'q', 'del', 'ins', 'sub', 'sup', 'kbd', 'samp', 'var', 'dfn', 'bdi', 'bdo',
  'ruby', 'rt', 'rp', 'data', 'code', 'pre',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'caption', 'colgroup', 'col', 'tr', 'th', 'td',
  'form', 'fieldset', 'legend', 'label', 'input', 'textarea', 'select', 'optgroup', 'option',
  'datalist', 'button', 'output', 'progress', 'meter',
  'details', 'summary', 'dialog',
  'a', 'hr', 'br', 'wbr', 'blockquote', 'figure', 'figcaption', 'img', 'picture',
  'svg', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'g', 'defs', 'text', 'tspan',
])

export const VOID_TAGS = new Set(['br', 'hr', 'input', 'img', 'wbr', 'col'])

export const SVG_TAGS = new Set([
  'svg', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'g', 'defs', 'text', 'tspan',
])

export interface MarkupAstNode {
  kind: 'text' | 'element'
  text?: string
  tag?: string
  attrs?: Record<string, string>
  hasReactClick?: boolean
  children?: MarkupAstNode[]
}

/** Convert visible HTML body into preview nodes while extracting `<style>` and inline `<script>`. */
export function parseHtmlPreview(markup: string): {
  nodes: MarkupAstNode[]
  styles: string[]
  scripts: string[]
} {
  const findElement = (children: HtmlAst.ChildNode[], name: string) =>
    children.find((child): child is HtmlAst.Element => 'tagName' in child && child.tagName === name)
  const document = parse(markup)
  const html = findElement(document.childNodes, 'html')
  const head = html && findElement(html.childNodes, 'head')
  const body = html && findElement(html.childNodes, 'body')
  const styles: string[] = []
  const scripts: string[] = []

  const convert = (children: HtmlAst.ChildNode[]): MarkupAstNode[] =>
    children.flatMap((child): MarkupAstNode[] => {
      if (child.nodeName === '#text' && 'value' in child) return [{ kind: 'text', text: child.value }]
      if (!('tagName' in child)) return []
      const isHtmlNs = child.namespaceURI === 'http://www.w3.org/1999/xhtml'
      const isSvgNs = child.namespaceURI === 'http://www.w3.org/2000/svg' && SVG_TAGS.has(child.tagName)
      if (!isHtmlNs && !isSvgNs) return []
      if (child.tagName === 'style') {
        for (const text of child.childNodes) {
          if (text.nodeName === '#text' && 'value' in text) styles.push(text.value)
        }
        return []
      }
      if (child.tagName === 'script') {
        const hasExternalSrc = child.attrs.some((a) => a.name.toLowerCase() === 'src')
        if (!hasExternalSrc) {
          const inlineCode = child.childNodes
            .map((t) => (t.nodeName === '#text' && 'value' in t ? t.value : ''))
            .join('\n')
          if (inlineCode.trim()) scripts.push(inlineCode)
        }
        return []
      }
      if (['title', 'template', 'iframe', 'object', 'noscript'].includes(child.tagName)) return []
      const visibleChildren = convert(child.childNodes)
      if (!ALLOWED_WEB_TAGS.has(child.tagName)) return visibleChildren
      return [{
        kind: 'element',
        tag: child.tagName,
        attrs: Object.fromEntries(child.attrs.map(({ name, value }) => [name, value])),
        children: visibleChildren,
      }]
    })

  if (head) convert(head.childNodes)
  const nodes = body ? convert(body.childNodes) : []
  return { nodes, styles, scripts }
}

export function parseTagAttrs(rawAttrs: string): { attrs: Record<string, string>; hasReactClick: boolean } {
  const attrs: Record<string, string> = {}
  let hasReactClick = false
  let i = 0
  const len = rawAttrs.length
  while (i < len) {
    while (i < len && /\s/.test(rawAttrs[i])) i++
    if (i >= len) break
    let name = ''
    while (i < len && /[a-zA-Z0-9_:-]/.test(rawAttrs[i])) {
      name += rawAttrs[i]
      i++
    }
    if (!name) {
      i++
      continue
    }
    while (i < len && /\s/.test(rawAttrs[i])) i++
    if (rawAttrs[i] !== '=') {
      attrs[name.toLowerCase()] = ''
      continue
    }
    i++
    while (i < len && /\s/.test(rawAttrs[i])) i++
    if (i >= len) break
    const ch = rawAttrs[i]
    if (ch === '"' || ch === "'") {
      const q = ch
      i++
      let val = ''
      while (i < len && rawAttrs[i] !== q) {
        val += rawAttrs[i]
        i++
      }
      if (rawAttrs[i] === q) i++
      attrs[name.toLowerCase()] = val
    } else if (ch === '{') {
      let depth = 1
      i++
      while (i < len && depth > 0) {
        if (rawAttrs[i] === '{') depth++
        else if (rawAttrs[i] === '}') depth--
        i++
      }
      if (name === 'onClick' || name === 'onclick') hasReactClick = true
    } else {
      let val = ''
      while (i < len && !/\s/.test(rawAttrs[i])) {
        val += rawAttrs[i]
        i++
      }
      attrs[name.toLowerCase()] = val
    }
  }
  return { attrs, hasReactClick }
}

/** Pure TypeScript JSX/HTML tokenizer into an immutable AST without DOMParser/innerHTML. */
export function parseMarkupToAst(markup: string): MarkupAstNode[] {
  const root: MarkupAstNode[] = []
  const stack: Array<{ tag: string; children: MarkupAstNode[] }> = [{ tag: '__root__', children: root }]
  let i = 0
  const len = markup.length

  const pushNode = (node: MarkupAstNode) => {
    stack[stack.length - 1].children.push(node)
  }

  while (i < len) {
    if (markup.startsWith('<!--', i)) {
      const endComment = markup.indexOf('-->', i + 4)
      i = endComment === -1 ? len : endComment + 3
      continue
    }
    if (markup[i] === '<') {
      if (markup[i + 1] === '/') {
        const closeEnd = markup.indexOf('>', i + 2)
        if (closeEnd === -1) break
        const closeTag = markup.slice(i + 2, closeEnd).trim().toLowerCase()
        for (let s = stack.length - 1; s >= 1; s--) {
          if (stack[s].tag === closeTag) {
            stack.length = s
            break
          }
        }
        i = closeEnd + 1
        continue
      }
      if (/[a-zA-Z]/.test(markup[i + 1] ?? '')) {
        let j = i + 1
        let quote: string | null = null
        let braceDepth = 0
        while (j < len) {
          const ch = markup[j]
          if (quote) {
            if (ch === quote && markup[j - 1] !== '\\') quote = null
          } else {
            if (ch === '"' || ch === "'") quote = ch
            else if (ch === '{') braceDepth++
            else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1)
            else if (ch === '>' && braceDepth === 0) break
          }
          j++
        }
        if (j >= len) break
        let tagHeader = markup.slice(i + 1, j).trim()
        const selfClosing = tagHeader.endsWith('/')
        if (selfClosing) tagHeader = tagHeader.slice(0, -1).trim()
        const spaceIdx = tagHeader.search(/\s/)
        const tag = (spaceIdx === -1 ? tagHeader : tagHeader.slice(0, spaceIdx)).toLowerCase()
        const rawAttrs = spaceIdx === -1 ? '' : tagHeader.slice(spaceIdx + 1)
        const { attrs, hasReactClick } = parseTagAttrs(rawAttrs)
        const children: MarkupAstNode[] = []
        if (ALLOWED_WEB_TAGS.has(tag)) {
          pushNode({ kind: 'element', tag, attrs, hasReactClick, children })
          if (!selfClosing && !VOID_TAGS.has(tag)) {
            stack.push({ tag, children })
          }
        }
        i = j + 1
        continue
      }
    }

    const nextLt = markup.indexOf('<', i + 1)
    const cut = nextLt === -1 ? len : nextLt
    const txt = markup.slice(i, cut)
    if (txt) pushNode({ kind: 'text', text: txt })
    i = cut
  }

  return root
}

function collectNodeText(nodes: MarkupAstNode[]): string {
  return nodes
    .map((n) => (n.kind === 'text' ? (n.text ?? '') : collectNodeText(n.children ?? [])))
    .join('')
}

export function collectVirtualElements(
  nodes: MarkupAstNode[],
  keyPrefix = 'wd-html',
  ancestors: Array<{ tag: string; id: string | null; classes: string[] }> = [],
): VirtualElementDescriptor[] {
  const out: VirtualElementDescriptor[] = []
  nodes.forEach((node, idx) => {
    if (node.kind !== 'element') return
    const key = `${keyPrefix}-${idx}`
    const attrs = node.attrs ?? {}
    const tag = node.tag ?? 'div'
    const id = attrs.id || null
    const classes = (attrs.class || attrs.classname || '').split(/\s+/).filter(Boolean)
    out.push({
      key,
      tag,
      id,
      classes,
      text: collectNodeText(node.children ?? []),
      value: attrs.value ?? '',
      ancestors,
    })
    if (node.children && node.children.length > 0) {
      out.push(
        ...collectVirtualElements(node.children, key, [...ancestors, { tag, id, classes }]),
      )
    }
  })
  return out
}
