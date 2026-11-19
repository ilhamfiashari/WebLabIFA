import type { CSSProperties } from 'react'
import type { WebDevFastApiRoute, WebDevFile, WebDevSqlTable } from './types'

const ALLOWED_CSS_PROPS = new Map<string, keyof CSSProperties>([
  ['color', 'color'],
  ['background', 'background'],
  ['background-color', 'backgroundColor'],
  ['padding', 'padding'],
  ['padding-top', 'paddingTop'],
  ['padding-bottom', 'paddingBottom'],
  ['padding-left', 'paddingLeft'],
  ['padding-right', 'paddingRight'],
  ['margin', 'margin'],
  ['margin-top', 'marginTop'],
  ['margin-bottom', 'marginBottom'],
  ['margin-left', 'marginLeft'],
  ['margin-right', 'marginRight'],
  ['display', 'display'],
  ['flex-direction', 'flexDirection'],
  ['justify-content', 'justifyContent'],
  ['align-items', 'alignItems'],
  ['flex-wrap', 'flexWrap'],
  ['gap', 'gap'],
  ['grid-template-columns', 'gridTemplateColumns'],
  ['border', 'border'],
  ['border-bottom', 'borderBottom'],
  ['border-top', 'borderTop'],
  ['border-radius', 'borderRadius'],
  ['font-size', 'fontSize'],
  ['font-weight', 'fontWeight'],
  ['font-family', 'fontFamily'],
  ['text-align', 'textAlign'],
  ['width', 'width'],
  ['max-width', 'maxWidth'],
  ['min-width', 'minWidth'],
  ['min-height', 'minHeight'],
  ['height', 'height'],
  ['box-shadow', 'boxShadow'],
  ['line-height', 'lineHeight'],
  ['list-style', 'listStyle'],
  ['border-collapse', 'borderCollapse'],
  ['cursor', 'cursor'],
  ['opacity', 'opacity'],
])

export interface ParsedCssRule {
  selector: string
  style: CSSProperties
}

export function parseSafeCssRules(cssText: string): ParsedCssRule[] {
  const cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: ParsedCssRule[] = []
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = ruleRe.exec(cleaned)) !== null) {
    const selectorsRaw = m[1].trim()
    const body = m[2].trim()
    if (!selectorsRaw || !body) continue
    const styleObj: Record<string, string> = {}
    for (const decl of body.split(';')) {
      const colonIdx = decl.indexOf(':')
      if (colonIdx <= 0) continue
      const prop = decl.slice(0, colonIdx).trim().toLowerCase()
      const val = decl.slice(colonIdx + 1).trim()
      if (!val || /url\s*\(|expression\s*\(|javascript:/i.test(val)) continue
      const camelProp = ALLOWED_CSS_PROPS.get(prop)
      if (camelProp) {
        styleObj[camelProp] = val
      }
    }
    if (Object.keys(styleObj).length === 0) continue
    for (const sel of selectorsRaw.split(',')) {
      const trimmed = sel.trim()
      if (trimmed) {
        rules.push({ selector: trimmed, style: styleObj as CSSProperties })
      }
    }
  }
  return rules
}

export function matchElementCss(
  rules: ParsedCssRule[],
  tag: string,
  classAttr: string | null,
  idAttr: string | null,
): CSSProperties {
  const classes = new Set((classAttr ?? '').split(/\s+/).filter(Boolean))
  const merged: Record<string, unknown> = {}
  for (const r of rules) {
    const parts = r.selector.trim().split(/\s+/)
    const leaf = parts[parts.length - 1]
    if (!leaf) continue
    let matched = false
    if (leaf === tag || leaf === '*') {
      matched = true
    } else if (leaf.startsWith('.') && classes.has(leaf.slice(1))) {
      matched = true
    } else if (leaf.startsWith('#') && idAttr && leaf.slice(1) === idAttr) {
      matched = true
    } else if (leaf.includes('.')) {
      const [lTag, lCls] = leaf.split('.')
      if ((lTag === '' || lTag === tag) && classes.has(lCls)) matched = true
    }
    if (matched) {
      Object.assign(merged, r.style)
    }
  }
  return merged as CSSProperties
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
): {
  consoleLines: string[]
  initialDomUpdates: Record<string, string>
  bindings: JsDomBinding[]
  reactModel: ReactComponentModel | null
} {
  const consoleLines: string[] = []
  const initialDomUpdates: Record<string, string> = {}
  const bindings: JsDomBinding[] = []
  const env: Record<string, unknown> = {}

  const evalSimpleJs = (raw: string): unknown => {
    const s = raw.trim().replace(/;$/, '')
    if (s.startsWith('`') && s.endsWith('`')) {
      return s.slice(1, -1).replace(/\$\{([^}]+)\}/g, (_m, expr: string) =>
        String(evalSimpleJs(expr) ?? ''),
      )
    }
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1)
    }
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
    if (s === 'true') return true
    if (s === 'false') return false
    if (s in env) return env[s]
    if (s.startsWith('[') && s.endsWith(']')) {
      const inner = s.slice(1, -1).trim()
      return inner ? splitTopLevelValues(inner).map((item) => evalSimpleJs(item)) : []
    }
    const mapM = /^([a-zA-Z_]\w*)\.map\(\(\s*([a-zA-Z_]\w*)\s*\)\s*=>\s*(.+)\)$/.exec(s)
    if (mapM && Array.isArray(env[mapM[1]])) {
      const arr = env[mapM[1]] as unknown[]
      return arr.map((el) => {
        env[mapM[2]] = el
        return evalSimpleJs(mapM[3])
      })
    }
    if (s.includes('+')) {
      const parts = splitTopLevelValues(s.replace(/\+/g, ','))
      if (parts.length > 1) {
        const vals = parts.map(evalSimpleJs)
        if (vals.every((v) => typeof v === 'number')) {
          return vals.reduce((a, b) => Number(a) + Number(b), 0)
        }
        return vals.map((v) => String(v)).join('')
      }
    }
    return s
  }

  for (const jf of jsFiles) {
    const text = jf.content
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('//')) continue
      const varM = /^(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*(.+?);?$/.exec(t)
      if (varM && !varM[2].includes('addEventListener') && !varM[2].startsWith('document.')) {
        env[varM[1]] = evalSimpleJs(varM[2])
        continue
      }
      const logM = /^console\.log\((.+)\);?$/.exec(t)
      if (logM) {
        const v = evalSimpleJs(logM[1])
        consoleLines.push(typeof v === 'object' ? JSON.stringify(v) : String(v))
        continue
      }
      const domDirectM = /^document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)\.(?:textContent|innerText)\s*=\s*(.+);?$/.exec(t)
      if (domDirectM) {
        initialDomUpdates[domDirectM[1]] = String(evalSimpleJs(domDirectM[2]))
      }
    }

    // Parse simple interactive listeners: btn?.addEventListener("click", () => { ... })
    // or document.getElementById("btn")?.addEventListener("click", ...)
    const listenerRe = /(?:document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)|([a-zA-Z_]\w*))\s*(?:\?\.)?addEventListener\(\s*['"](click|submit)['"]\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g
    let lm: RegExpExecArray | null
    while ((lm = listenerRe.exec(text)) !== null) {
      let targetId = lm[1]
      if (!targetId && lm[2]) {
        const declRe = new RegExp(`(?:const|let|var)\\s+${lm[2]}\\s*=\\s*document\\.getElementById\\(\\s*['"]([^'"]+)['"]\\s*\\)`)
        targetId = declRe.exec(text)?.[1] ?? lm[2]
      }
      const event = lm[3] as 'click' | 'submit'
      const body = lm[4]
      const domUpdates: Record<string, string> = {}
      let logMessage: string | undefined
      let fetchPath: string | undefined

      for (const stmt of body.split('\n')) {
        const dM = /document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)\.(?:textContent|innerText)\s*=\s*(.+?);?$/.exec(stmt.trim())
        if (dM) domUpdates[dM[1]] = String(evalSimpleJs(dM[2]))
        const cM = /console\.log\((.+)\);?$/.exec(stmt.trim())
        if (cM) logMessage = String(evalSimpleJs(cM[1]))
        const fM = /fetch\(\s*['"]([^'"]+)['"]/.exec(stmt.trim())
        if (fM) fetchPath = fM[1]
      }
      bindings.push({ targetId, event, domUpdates, logMessage, fetchPath })
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

  return { consoleLines, initialDomUpdates, bindings, reactModel }
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
