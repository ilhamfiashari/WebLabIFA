import type { CSSProperties } from 'react'
import {
  createJsSandboxSession,
  type JsElementPatch,
  type JsSandboxSession,
  type VirtualElementDescriptor,
} from './jsRuntime'
import type { WebDevFastApiRoute, WebDevFile, WebDevSqlTable } from './types'

const ALLOWED_CSS_PROPS = new Map<string, keyof CSSProperties>([
  ['accent-color', 'accentColor'],
  ['align-content', 'alignContent'],
  ['align-items', 'alignItems'],
  ['align-self', 'alignSelf'],
  ['aspect-ratio', 'aspectRatio'],
  ['backdrop-filter', 'backdropFilter'],
  ['background', 'background'],
  ['background-clip', 'backgroundClip'],
  ['background-color', 'backgroundColor'],
  ['background-image', 'backgroundImage'],
  ['background-position', 'backgroundPosition'],
  ['background-repeat', 'backgroundRepeat'],
  ['background-size', 'backgroundSize'],
  ['border', 'border'],
  ['border-bottom', 'borderBottom'],
  ['border-bottom-color', 'borderBottomColor'],
  ['border-bottom-left-radius', 'borderBottomLeftRadius'],
  ['border-bottom-right-radius', 'borderBottomRightRadius'],
  ['border-bottom-style', 'borderBottomStyle'],
  ['border-bottom-width', 'borderBottomWidth'],
  ['border-collapse', 'borderCollapse'],
  ['border-color', 'borderColor'],
  ['border-left', 'borderLeft'],
  ['border-radius', 'borderRadius'],
  ['border-right', 'borderRight'],
  ['border-spacing', 'borderSpacing'],
  ['border-style', 'borderStyle'],
  ['border-top', 'borderTop'],
  ['border-top-left-radius', 'borderTopLeftRadius'],
  ['border-top-right-radius', 'borderTopRightRadius'],
  ['border-width', 'borderWidth'],
  ['bottom', 'bottom'],
  ['box-shadow', 'boxShadow'],
  ['box-sizing', 'boxSizing'],
  ['caret-color', 'caretColor'],
  ['clear', 'clear'],
  ['clip-path', 'clipPath'],
  ['color', 'color'],
  ['color-scheme', 'colorScheme'],
  ['column-gap', 'columnGap'],
  ['cursor', 'cursor'],
  ['direction', 'direction'],
  ['display', 'display'],
  ['fill', 'fill'],
  ['filter', 'filter'],
  ['flex', 'flex'],
  ['flex-basis', 'flexBasis'],
  ['flex-direction', 'flexDirection'],
  ['flex-flow', 'flexFlow'],
  ['flex-grow', 'flexGrow'],
  ['flex-shrink', 'flexShrink'],
  ['flex-wrap', 'flexWrap'],
  ['float', 'float'],
  ['font', 'font'],
  ['font-family', 'fontFamily'],
  ['font-size', 'fontSize'],
  ['font-style', 'fontStyle'],
  ['font-variant', 'fontVariant'],
  ['font-variant-numeric', 'fontVariantNumeric'],
  ['font-weight', 'fontWeight'],
  ['gap', 'gap'],
  ['grid', 'grid'],
  ['grid-area', 'gridArea'],
  ['grid-auto-columns', 'gridAutoColumns'],
  ['grid-auto-flow', 'gridAutoFlow'],
  ['grid-auto-rows', 'gridAutoRows'],
  ['grid-column', 'gridColumn'],
  ['grid-row', 'gridRow'],
  ['grid-template-areas', 'gridTemplateAreas'],
  ['grid-template-columns', 'gridTemplateColumns'],
  ['grid-template-rows', 'gridTemplateRows'],
  ['height', 'height'],
  ['inset', 'inset'],
  ['isolation', 'isolation'],
  ['justify-content', 'justifyContent'],
  ['justify-items', 'justifyItems'],
  ['justify-self', 'justifySelf'],
  ['left', 'left'],
  ['letter-spacing', 'letterSpacing'],
  ['line-height', 'lineHeight'],
  ['list-style', 'listStyle'],
  ['list-style-position', 'listStylePosition'],
  ['list-style-type', 'listStyleType'],
  ['margin', 'margin'],
  ['margin-block', 'marginBlock'],
  ['margin-bottom', 'marginBottom'],
  ['margin-inline', 'marginInline'],
  ['margin-left', 'marginLeft'],
  ['margin-right', 'marginRight'],
  ['margin-top', 'marginTop'],
  ['max-height', 'maxHeight'],
  ['max-width', 'maxWidth'],
  ['min-height', 'minHeight'],
  ['min-width', 'minWidth'],
  ['mix-blend-mode', 'mixBlendMode'],
  ['object-fit', 'objectFit'],
  ['object-position', 'objectPosition'],
  ['opacity', 'opacity'],
  ['order', 'order'],
  ['outline', 'outline'],
  ['outline-offset', 'outlineOffset'],
  ['overflow', 'overflow'],
  ['overflow-wrap', 'overflowWrap'],
  ['overflow-x', 'overflowX'],
  ['overflow-y', 'overflowY'],
  ['padding', 'padding'],
  ['padding-block', 'paddingBlock'],
  ['padding-bottom', 'paddingBottom'],
  ['padding-inline', 'paddingInline'],
  ['padding-left', 'paddingLeft'],
  ['padding-right', 'paddingRight'],
  ['padding-top', 'paddingTop'],
  ['place-content', 'placeContent'],
  ['place-items', 'placeItems'],
  ['place-self', 'placeSelf'],
  ['pointer-events', 'pointerEvents'],
  ['position', 'position'],
  ['resize', 'resize'],
  ['right', 'right'],
  ['rotate', 'rotate'],
  ['row-gap', 'rowGap'],
  ['scale', 'scale'],
  ['scroll-behavior', 'scrollBehavior'],
  ['stroke', 'stroke'],
  ['stroke-width', 'strokeWidth'],
  ['table-layout', 'tableLayout'],
  ['text-align', 'textAlign'],
  ['text-decoration', 'textDecoration'],
  ['text-indent', 'textIndent'],
  ['text-overflow', 'textOverflow'],
  ['text-shadow', 'textShadow'],
  ['text-transform', 'textTransform'],
  ['text-underline-offset', 'textUnderlineOffset'],
  ['text-wrap', 'textWrap'],
  ['top', 'top'],
  ['transform', 'transform'],
  ['transform-origin', 'transformOrigin'],
  ['transition', 'transition'],
  ['translate', 'translate'],
  ['user-select', 'userSelect'],
  ['vertical-align', 'verticalAlign'],
  ['visibility', 'visibility'],
  ['white-space', 'whiteSpace'],
  ['width', 'width'],
  ['word-break', 'wordBreak'],
  ['word-spacing', 'wordSpacing'],
  ['writing-mode', 'writingMode'],
  ['z-index', 'zIndex'],
])

function resolveCssVars(val: string, cssVars: Record<string, string>, depth = 0): string {
  if (depth > 4 || !val.includes('var(')) return val
  return val.replace(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)/g, (_m, varName: string, fallback?: string) => {
    const resolved = cssVars[varName] ?? fallback?.trim() ?? ''
    return resolved ? resolveCssVars(resolved, cssVars, depth + 1) : ''
  })
}

export function parseSafeInlineStyle(
  rawStyle: string | undefined,
  cssVars: Record<string, string> = {},
): CSSProperties {
  if (!rawStyle) return {}
  const styleObj: Record<string, string> = {}
  for (const decl of rawStyle.split(';')) {
    const colonIdx = decl.indexOf(':')
    if (colonIdx <= 0) continue
    const prop = decl.slice(0, colonIdx).trim().toLowerCase()
    const rawVal = decl.slice(colonIdx + 1).trim()
    if (!rawVal) continue
    if (prop.startsWith('--')) {
      cssVars[prop] = resolveCssVars(rawVal, cssVars)
      continue
    }
    const val = resolveCssVars(rawVal, cssVars)
    if (!val || /url\s*\(|expression\s*\(|javascript:/i.test(val)) continue
    const camelProp = ALLOWED_CSS_PROPS.get(prop)
    if (camelProp) styleObj[camelProp] = val
  }
  return styleObj as CSSProperties
}

export interface ParsedCssRule {
  selector: string
  style: CSSProperties
  isHover?: boolean
  specificity?: [number, number, number]
}

export interface AncestorDescriptor {
  tag: string
  classAttr: string | null
  idAttr: string | null
}

function collectRawCssBlocks(cssText: string, parentSelector = ''): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = []
  let i = 0
  const len = cssText.length
  while (i < len) {
    while (i < len && /\s/.test(cssText[i])) i++
    if (i >= len) break
    const braceOpen = cssText.indexOf('{', i)
    if (braceOpen === -1) break
    const header = cssText.slice(i, braceOpen).trim()
    let depth = 1
    let j = braceOpen + 1
    while (j < len && depth > 0) {
      if (cssText[j] === '{') depth++
      else if (cssText[j] === '}') depth--
      j++
    }
    const inner = cssText.slice(braceOpen + 1, Math.max(braceOpen + 1, j - 1))
    i = j
    if (!header) continue
    if (/^@(?:keyframes|-webkit-keyframes|font-face|import|charset|namespace)/i.test(header)) {
      continue
    }
    if (/^@(?:media|layer|container|supports)/i.test(header)) {
      out.push(...collectRawCssBlocks(inner, parentSelector))
      continue
    }
    const resolvedHeaders = header.split(',').map((h) => h.trim()).filter(Boolean).map((h) => {
      if (!parentSelector) return h
      return h.includes('&') ? h.replace(/&/g, parentSelector) : `${parentSelector} ${h}`
    })
    let declText = ''
    let scan = 0
    while (scan < inner.length) {
      const nextBrace = inner.indexOf('{', scan)
      const nextSemi = inner.indexOf(';', scan)
      if (nextBrace !== -1 && (nextSemi === -1 || nextBrace < nextSemi)) {
        let subDepth = 1
        let k = nextBrace + 1
        while (k < inner.length && subDepth > 0) {
          if (inner[k] === '{') subDepth++
          else if (inner[k] === '}') subDepth--
          k++
        }
        const nestedRaw = inner.slice(scan, k)
        for (const rh of resolvedHeaders) {
          out.push(...collectRawCssBlocks(nestedRaw, rh))
        }
        scan = k
      } else {
        const end = nextSemi === -1 ? inner.length : nextSemi + 1
        declText += inner.slice(scan, end)
        scan = end
      }
    }
    if (declText.trim()) {
      for (const rh of resolvedHeaders) {
        out.push({ selector: rh, body: declText })
      }
    }
  }
  return out
}

function selectorSpecificity(selector: string): [number, number, number] {
  const cleaned = selector.replace(/:{1,2}[a-zA-Z-]+(?:\([^)]*\))?/g, '')
  const ids = (cleaned.match(/#[a-zA-Z0-9_-]+/g) ?? []).length
  const classes = (cleaned.match(/\.[a-zA-Z0-9_-]+/g) ?? []).length + (selector.includes(':hover') ? 1 : 0)
  const tags = (cleaned
    .split(/[\s>+~]+/)
    .map((p) => p.replace(/[#.][a-zA-Z0-9_-]+/g, '').trim())
    .filter((t) => t && t !== '*')).length
  return [ids, classes, tags]
}

export function parseSafeCssRules(cssText: string): ParsedCssRule[] {
  const cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  const rawBlocks = collectRawCssBlocks(cleaned)
  const cssVars: Record<string, string> = {}
  const rules: ParsedCssRule[] = []

  for (const blk of rawBlocks) {
    if (/^(?::root|html|body|\*)$/i.test(blk.selector.trim())) {
      parseSafeInlineStyle(blk.body, cssVars)
    }
  }

  for (const blk of rawBlocks) {
    const styleObj = parseSafeInlineStyle(blk.body, cssVars)
    if (Object.keys(styleObj).length === 0) continue
    const sel = blk.selector.trim()
    if (/^(?::root|html)$/i.test(sel)) continue
    if (/:{2}|:(?:focus|active|visited|before|after|placeholder)/i.test(sel)) continue
    const isHover = /:hover\b/i.test(sel)
    rules.push({
      selector: sel,
      style: styleObj,
      isHover,
      specificity: selectorSpecificity(sel),
    })
  }
  return rules
}

function matchesSingleCompound(
  compound: string,
  tag: string,
  classes: Set<string>,
  idAttr: string | null,
): boolean {
  const leaf = compound.replace(/:{1,2}[a-zA-Z-]+(?:\([^)]*\))?/g, '').trim()
  if (!leaf) return false
  if (leaf === '*') return true
  const tagMatch = /^[a-zA-Z0-9-]+/.exec(leaf)?.[0]?.toLowerCase() ?? ''
  if (tagMatch && tag !== tagMatch) return false
  for (const idM of leaf.matchAll(/#([a-zA-Z0-9_-]+)/g)) {
    if (!idAttr || idM[1] !== idAttr) return false
  }
  for (const clsM of leaf.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
    if (!classes.has(clsM[1])) return false
  }
  return true
}

function matchesSelectorWithAncestors(
  selector: string,
  tag: string,
  classes: Set<string>,
  idAttr: string | null,
  ancestors: AncestorDescriptor[],
): boolean {
  const tokens = selector.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  const leaf = tokens[tokens.length - 1]
  if (!matchesSingleCompound(leaf, tag, classes, idAttr)) return false
  if (tokens.length === 1) return true

  let ancIdx = ancestors.length - 1
  for (let i = tokens.length - 2; i >= 0; i--) {
    const part = tokens[i]
    if (part === '>') {
      i--
      if (i < 0 || ancIdx < 0) return false
      const parent = ancestors[ancIdx--]
      const pClasses = new Set((parent.classAttr ?? '').split(/\s+/).filter(Boolean))
      if (!matchesSingleCompound(tokens[i], parent.tag, pClasses, parent.idAttr)) return false
      continue
    }
    let matchedAnc = false
    while (ancIdx >= 0) {
      const anc = ancestors[ancIdx--]
      const aClasses = new Set((anc.classAttr ?? '').split(/\s+/).filter(Boolean))
      if (matchesSingleCompound(part, anc.tag, aClasses, anc.idAttr)) {
        matchedAnc = true
        break
      }
    }
    if (!matchedAnc) return false
  }
  return true
}

export function matchElementStyles(
  rules: ParsedCssRule[],
  tag: string,
  classAttr: string | null,
  idAttr: string | null,
  ancestors: AncestorDescriptor[] = [],
): { style: CSSProperties; hoverStyle: CSSProperties } {
  const classes = new Set((classAttr ?? '').split(/\s+/).filter(Boolean))
  const matched = rules
    .map((rule, order) => ({ rule, order }))
    .filter(({ rule }) => matchesSelectorWithAncestors(rule.selector, tag, classes, idAttr, ancestors))
    .sort((a, b) => {
      const sa = a.rule.specificity ?? [0, 0, 0]
      const sb = b.rule.specificity ?? [0, 0, 0]
      if (sa[0] !== sb[0]) return sa[0] - sb[0]
      if (sa[1] !== sb[1]) return sa[1] - sb[1]
      if (sa[2] !== sb[2]) return sa[2] - sb[2]
      return a.order - b.order
    })

  const baseStyle: Record<string, unknown> = {}
  const hoverStyle: Record<string, unknown> = {}
  for (const { rule } of matched) {
    Object.assign(rule.isHover ? hoverStyle : baseStyle, rule.style)
  }
  return {
    style: baseStyle as CSSProperties,
    hoverStyle: hoverStyle as CSSProperties,
  }
}

export function matchElementCss(
  rules: ParsedCssRule[],
  tag: string,
  classAttr: string | null,
  idAttr: string | null,
  ancestors: AncestorDescriptor[] = [],
): CSSProperties {
  return matchElementStyles(rules, tag, classAttr, idAttr, ancestors).style
}

function splitTopLevelValues(raw: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  let depth = 0
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (quote) {
      if (ch === quote && raw[i - 1] !== '\\') quote = null
      cur += ch
      continue
    }
    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch
      cur += ch
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1)
    else if (ch === ',' && depth === 0) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function parseSqlScalar(raw: string): string | number | boolean | null {
  const t = raw.trim()
  if (/^null$/i.test(t)) return null
  if (/^true$/i.test(t)) return true
  if (/^false$/i.test(t)) return false
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1)
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  return t
}

export function executeSafeSql(sqlText: string): {
  tables: WebDevSqlTable[]
  logs: string[]
  selectResults: Array<{ table: string; columns: string[]; rows: Array<Record<string, string | number | boolean | null>> }>
} {
  const tables = new Map<string, WebDevSqlTable>()
  const logs: string[] = []
  const selectResults: Array<{
    table: string
    columns: string[]
    rows: Array<Record<string, string | number | boolean | null>>
  }> = []

  const cleaned = sqlText.replace(/--.*$/gm, '')
  const statements = cleaned
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const stmt of statements) {
    const createM = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_]\w*)\s*\(([\s\S]+)\)$/i.exec(stmt)
    if (createM) {
      const name = createM[1]
      const cols = splitTopLevelValues(createM[2])
        .map((def) => def.trim().split(/\s+/)[0])
        .filter((c) => c && !/^(PRIMARY|FOREIGN|CONSTRAINT|UNIQUE|CHECK)$/i.test(c))
      tables.set(name.toLowerCase(), { name, columns: cols, rows: [] })
      logs.push(`CREATE TABLE ${name} (${cols.join(', ')})`)
      continue
    }

    const insertM = /^INSERT\s+INTO\s+([a-zA-Z_]\w*)\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+)$/i.exec(stmt)
    if (insertM) {
      const tblName = insertM[1]
      const tbl = tables.get(tblName.toLowerCase())
      if (!tbl) {
        logs.push(`WARN: Tabel '${tblName}' belum didefinisikan sebelum INSERT`)
        continue
      }
      const cols = insertM[2].split(',').map((c) => c.trim())
      const tuplesRaw = insertM[3].trim()
      const tupleMatches = Array.from(tuplesRaw.matchAll(/\(([^)]+)\)/g))
      let insertedCount = 0
      for (const tm of tupleMatches) {
        const vals = splitTopLevelValues(tm[1]).map(parseSqlScalar)
        const row: Record<string, string | number | boolean | null> = {}
        cols.forEach((col, idx) => {
          row[col] = vals[idx] ?? null
        })
        tbl.rows.push(row)
        insertedCount++
      }
      logs.push(`INSERT INTO ${tblName}: +${insertedCount} baris`)
      continue
    }

    const selectM = /^SELECT\s+([\s\S]+?)\s+FROM\s+([a-zA-Z_]\w*)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+))?$/i.exec(stmt)
    if (selectM) {
      const projRaw = selectM[1].trim()
      const tblName = selectM[2]
      const whereRaw = selectM[3]?.trim()
      const tbl = tables.get(tblName.toLowerCase())
      if (!tbl) {
        logs.push(`WARN: SELECT pada tabel tidak dikenal '${tblName}'`)
        continue
      }
      const selectedCols =
        projRaw === '*'
          ? [...tbl.columns]
          : projRaw.split(',').map((c) => c.trim())
      let filtered = [...tbl.rows]
      if (whereRaw) {
        const condM = /^([a-zA-Z_]\w*)\s*(=|!=|>=|<=|>|<)\s*(.+)$/.exec(whereRaw)
        if (condM) {
          const [, col, op, rhsRaw] = condM
          const rhs = parseSqlScalar(rhsRaw)
          filtered = filtered.filter((row) => {
            const lhs = row[col]
            if (op === '=') return lhs == rhs
            if (op === '!=') return lhs != rhs
            if (op === '>=') return Number(lhs) >= Number(rhs)
            if (op === '<=') return Number(lhs) <= Number(rhs)
            if (op === '>') return Number(lhs) > Number(rhs)
            return Number(lhs) < Number(rhs)
          })
        }
      }
      const projectedRows = filtered.map((r) => {
        const next: Record<string, string | number | boolean | null> = {}
        for (const col of selectedCols) next[col] = r[col] ?? null
        return next
      })
      selectResults.push({ table: tbl.name, columns: selectedCols, rows: projectedRows })
      logs.push(`SELECT ${tbl.name}: ${projectedRows.length} baris ditemukan`)
      continue
    }

    const updateM = /^UPDATE\s+([a-zA-Z_]\w*)\s+SET\s+([a-zA-Z_]\w*)\s*=\s*([^\s]+)(?:\s+WHERE\s+([a-zA-Z_]\w*)\s*=\s*(.+))?$/i.exec(stmt)
    if (updateM) {
      const [, tblName, setCol, setValRaw, whereCol, whereValRaw] = updateM
      const tbl = tables.get(tblName.toLowerCase())
      if (tbl) {
        const setVal = parseSqlScalar(setValRaw)
        const whereVal = whereValRaw ? parseSqlScalar(whereValRaw) : undefined
        let updated = 0
        for (const row of tbl.rows) {
          if (!whereCol || row[whereCol] == whereVal) {
            row[setCol] = setVal
            updated++
          }
        }
        logs.push(`UPDATE ${tbl.name}: ${updated} baris diperbarui`)
      }
    }
  }

  return { tables: Array.from(tables.values()), logs, selectResults }
}

interface PyClassDef {
  params: string[]
  methods: Record<string, string>
}

function evalPythonExpr(
  raw: string,
  env: Record<string, unknown>,
  classes: Record<string, PyClassDef>,
): unknown {
  const t = raw.trim()
  if ((t.startsWith('f"') && t.endsWith('"')) || (t.startsWith("f'") && t.endsWith("'"))) {
    const inner = t.slice(2, -1)
    return inner.replace(/\{([^}]+)\}/g, (_m, expr: string) =>
      String(evalPythonExpr(expr, env, classes) ?? ''),
    )
  }
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  if (t === 'True') return true
  if (t === 'False') return false
  if (t === 'None') return null
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1).trim()
    return inner ? splitTopLevelValues(inner).map((item) => evalPythonExpr(item, env, classes)) : []
  }
  if (t.startsWith('{') && t.endsWith('}')) {
    const inner = t.slice(1, -1).trim()
    if (!inner) return {}
    const out: Record<string, unknown> = {}
    for (const pair of splitTopLevelValues(inner)) {
      const cIdx = pair.indexOf(':')
      if (cIdx <= 0) continue
      const k = String(evalPythonExpr(pair.slice(0, cIdx), env, classes) ?? '')
      out[k] = evalPythonExpr(pair.slice(cIdx + 1), env, classes)
    }
    return out
  }
  if (t in env) return env[t]

  const attrCallM = /^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\(\)$/.exec(t)
  if (attrCallM) {
    const obj = env[attrCallM[1]] as { __class?: string; [k: string]: unknown } | undefined
    if (obj?.__class && classes[obj.__class]) {
      const retExpr = classes[obj.__class].methods[attrCallM[2]]
      if (retExpr) {
        const localEnv = { ...env }
        for (const [k, v] of Object.entries(obj)) localEnv[`self.${k}`] = v
        return evalPythonExpr(retExpr, localEnv, classes)
      }
    }
  }

  const attrM = /^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)$/.exec(t)
  if (attrM) {
    const obj = env[attrM[1]] as Record<string, unknown> | undefined
    if (obj && typeof obj === 'object') return obj[attrM[2]] ?? ''
  }

  const instM = /^([A-Z][a-zA-Z0-9_]*)\((.*)\)$/.exec(t)
  if (instM && classes[instM[1]]) {
    const cls = classes[instM[1]]
    const args = instM[2].trim()
      ? splitTopLevelValues(instM[2]).map((a) => evalPythonExpr(a, env, classes))
      : []
    const instance: Record<string, unknown> = { __class: instM[1] }
    cls.params.forEach((p, idx) => {
      instance[p] = args[idx] ?? null
    })
    return instance
  }

  if (t.includes('+')) {
    const parts = splitTopLevelValues(t.replace(/\+/g, ','))
    if (parts.length > 1) {
      const vals = parts.map((p) => evalPythonExpr(p, env, classes))
      if (vals.every((v) => typeof v === 'number')) {
        return vals.reduce((acc, n) => Number(acc) + Number(n), 0)
      }
      return vals.map((v) => String(v)).join('')
    }
  }

  return t
}

export function executeSafePython(pyText: string): {
  outputLines: string[]
  routes: WebDevFastApiRoute[]
} {
  const outputLines: string[] = []
  const routes: WebDevFastApiRoute[] = []
  const env: Record<string, unknown> = {}
  const classes: Record<string, PyClassDef> = {}

  const lines = pyText.split('\n')
  let idx = 0
  let pendingDecorator: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string } | null = null

  while (idx < lines.length) {
    const rawLine = lines[idx]
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('from ') || trimmed.startsWith('import ')) {
      idx++
      continue
    }

    const decoM = /^@app\.(get|post|put|delete)\(\s*["']([^"']+)["']/.exec(trimmed)
    if (decoM) {
      pendingDecorator = {
        method: decoM[1].toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE',
        path: decoM[2],
      }
      idx++
      continue
    }

    // Class definition (OOP Python P10)
    const clsM = /^class\s+([A-Z][a-zA-Z0-9_]*)\s*(?:\([^)]*\))?:\s*$/.exec(trimmed)
    if (clsM) {
      const clsName = clsM[1]
      const clsDef: PyClassDef = { params: [], methods: {} }
      idx++
      let curMethod: string | null = null
      while (idx < lines.length && (/^\s+/.test(lines[idx]) || !lines[idx].trim())) {
        const sub = lines[idx].trim()
        if (!sub) {
          idx++
          continue
        }
        const initM = /^def\s+__init__\(\s*self(?:\s*,\s*([^)]*))?\)\s*:/.exec(sub)
        if (initM) {
          curMethod = '__init__'
          clsDef.params = (initM[1] ?? '')
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
          idx++
          continue
        }
        const mM = /^def\s+([a-zA-Z_]\w*)\(\s*self[^)]*\)\s*:/.exec(sub)
        if (mM) {
          curMethod = mM[1]
          idx++
          continue
        }
        if (curMethod && sub.startsWith('return ')) {
          clsDef.methods[curMethod] = sub.slice('return '.length).trim()
        }
        idx++
      }
      classes[clsName] = clsDef
      continue
    }

    // Top-level def handler (FastAPI routes or Python helper functions)
    const defM = /^(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\([^)]*\)\s*:/.exec(trimmed)
    if (defM) {
      const fnName = defM[1]
      const bodyLines: string[] = []
      idx++
      while (idx < lines.length && (/^\s+/.test(lines[idx]) || !lines[idx].trim())) {
        if (lines[idx].trim()) bodyLines.push(lines[idx].trim())
        idx++
      }
      const retLine = bodyLines.find((b) => b.startsWith('return '))
      const sampleResponse = retLine
        ? evalPythonExpr(retLine.slice('return '.length).trim(), env, classes)
        : { status: 'ok' }

      if (pendingDecorator) {
        routes.push({
          method: pendingDecorator.method,
          path: pendingDecorator.path,
          handlerName: fnName,
          summary: `${pendingDecorator.method} ${pendingDecorator.path} -> ${fnName}()`,
          sampleResponse,
        })
        pendingDecorator = null
      }
      continue
    }

    // For-loop statement
    const forM = /^for\s+([a-zA-Z_]\w*)\s+in\s+(.+):$/.exec(trimmed)
    if (forM) {
      const iterVar = forM[1]
      const iterVal = evalPythonExpr(forM[2], env, classes)
      const block: string[] = []
      idx++
      while (idx < lines.length && (/^\s+/.test(lines[idx]) || !lines[idx].trim())) {
        if (lines[idx].trim()) block.push(lines[idx].trim())
        idx++
      }
      if (Array.isArray(iterVal)) {
        for (const el of iterVal) {
          env[iterVar] = el
          for (const stmt of block) {
            const pM = /^print\((.+)\)$/.exec(stmt)
            if (pM) {
              outputLines.push(String(evalPythonExpr(pM[1], env, classes)))
            }
          }
        }
      }
      continue
    }

    // Assignment
    const assignM = /^([a-zA-Z_]\w*)\s*=\s*(.+)$/.exec(trimmed)
    if (assignM && !trimmed.includes('==')) {
      env[assignM[1]] = evalPythonExpr(assignM[2], env, classes)
      idx++
      continue
    }

    // Top-level print(...)
    const printM = /^print\((.+)\)$/.exec(trimmed)
    if (printM) {
      const val = evalPythonExpr(printM[1], env, classes)
      outputLines.push(typeof val === 'object' ? JSON.stringify(val) : String(val))
    }

    idx++
  }

  return { outputLines, routes }
}

export interface JsDomBinding {
  targetId: string
  event: 'click' | 'submit'
  domUpdates: Record<string, string>
  logMessage?: string
  fetchPath?: string
}

export interface ReactComponentModel {
  stateName: string
  setterName: string
  initialValue: string | number | boolean | unknown[]
  jsxTemplate: string
}

export function analyzeJavaScriptAndReact(
  jsFiles: WebDevFile[],
  jsxFiles: WebDevFile[],
  virtualElements: VirtualElementDescriptor[] = [],
  inlineScripts: string[] = [],
): {
  consoleLines: string[]
  initialDomUpdates: Record<string, string>
  initialPatches: Record<string, JsElementPatch>
  jsSession: JsSandboxSession
  bindings: JsDomBinding[]
  reactModel: ReactComponentModel | null
} {
  const jsSources = [...jsFiles.map((f) => f.content), ...inlineScripts]
  const jsSession = createJsSandboxSession(jsSources, virtualElements)
  const consoleLines = [...jsSession.initialEffects.logs]
  const initialPatches = jsSession.initialEffects.patches
  const initialDomUpdates: Record<string, string> = {}
  const elByKey = new Map(virtualElements.map((el) => [el.key, el]))
  for (const [key, patch] of Object.entries(initialPatches)) {
    const id = elByKey.get(key)?.id
    if (id && patch.text !== undefined) {
      initialDomUpdates[id] = patch.text
    }
  }
  const bindings: JsDomBinding[] = []

  // Preserve lightweight legacy bindings metadata for diagnostics & backward compatibility
  for (const jf of jsFiles) {
    const text = jf.content
    const listenerRe = /(?:document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)|([a-zA-Z_]\w*))\s*(?:\?\.)?addEventListener\(\s*['"](click|submit)['"]\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g
    let lm: RegExpExecArray | null
    while ((lm = listenerRe.exec(text)) !== null) {
      let targetId = lm[1]
      if (!targetId && lm[2]) {
        const declRe = new RegExp(`(?:const|let|var)\\s+${lm[2]}\\s*=\\s*document\\.getElementById\\(\\s*['"]([^'"]+)['"]\\s*\\)`)
        targetId = declRe.exec(text)?.[1] ?? lm[2]
      }
      bindings.push({ targetId, event: lm[3] as 'click' | 'submit', domUpdates: {} })
    }
  }

  let reactModel: ReactComponentModel | null = null
  const primaryJsx = jsxFiles[0]
  if (primaryJsx) {
    const src = primaryJsx.content
    const stateM = /const\s*\[\s*([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*\]\s*=\s*useState\(([^)]*)\)/.exec(src)
    const retM = /return\s*\(\s*([\s\S]+?)\s*\)\s*;?\s*\}?\s*$/m.exec(src)
    if (retM) {
      let initVal: string | number | boolean | unknown[] = 0
      if (stateM) {
        const rawInit = stateM[3].trim()
        if (/^-?\d+(\.\d+)?$/.test(rawInit)) initVal = Number(rawInit)
        else if (rawInit === 'true') initVal = true
        else if (rawInit === 'false') initVal = false
        else if ((rawInit.startsWith("'") && rawInit.endsWith("'")) || (rawInit.startsWith('"') && rawInit.endsWith('"'))) {
          initVal = rawInit.slice(1, -1)
        } else if (rawInit.startsWith('[')) {
          const inner = rawInit.slice(1, -1).trim()
          initVal = inner ? splitTopLevelValues(inner).map((x) => x.replace(/^['"]|['"]$/g, '')) : []
        }
      }
      reactModel = {
        stateName: stateM?.[1] ?? 'count',
        setterName: stateM?.[2] ?? 'setCount',
        initialValue: initVal,
        jsxTemplate: retM[1],
      }
    }
  }

  return {
    consoleLines,
    initialDomUpdates,
    initialPatches,
    jsSession,
    bindings,
    reactModel,
  }
}

export function invokeVirtualFastApi(
  routes: WebDevFastApiRoute[],
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  rawUrl: string,
  sqlTables: WebDevSqlTable[],
  promptText?: string,
): { status: number; path: string; body: unknown } {
  let path = rawUrl.trim() || '/'
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname || '/'
    } catch {
      path = '/'
    }
  }
  if (!path.startsWith('/')) path = `/${path}`

  const exact = routes.find((r) => r.path === path && r.method === method)
    ?? routes.find((r) => r.path === path)

  if (path.startsWith('/api/ai') && (exact || routes.some((r) => r.path.includes('/api/ai')))) {
    const q = (promptText || 'Ringkas status aplikasi Web').trim()
    return {
      status: 200,
      path,
      body: {
        ok: true,
        endpoint: path,
        model: 'assistant-web-sim',
        prompt: q,
        answer: `Rekomendasi AI untuk "${q}": pastikan validasi input JSON FastAPI, indeks PostgreSQL aktif, dan state React tersinkron.`,
        tables_connected: sqlTables.map((t) => t.name),
      },
    }
  }

  if (exact) {
    const enriched =
      typeof exact.sampleResponse === 'object' && exact.sampleResponse !== null
        ? {
            ...(exact.sampleResponse as Record<string, unknown>),
            ...(sqlTables.length > 0 ? { db_tables: sqlTables.map((t) => ({ table: t.name, rows: t.rows })) } : {}),
          }
        : exact.sampleResponse
    return { status: method === 'POST' ? 201 : 200, path, body: enriched }
  }

  return {
    status: 404,
    path,
    body: { detail: `Route ${method} ${path} tidak ditemukan di FastAPI app` },
  }
}
