import type { CSSProperties } from 'react'

export interface VirtualElementDescriptor {
  key: string
  tag: string
  id: string | null
  classes: string[]
  text: string
  value: string
  ancestors: Array<{ tag: string; id: string | null; classes: string[] }>
}

export interface JsElementPatch {
  text?: string
  innerHtml?: string
  styles: Record<string, string>
  classes: string[]
  value?: string
  hidden?: boolean
}

export interface JsRunEffects {
  patches: Record<string, JsElementPatch>
  logs: string[]
  alerts: string[]
  fetchPaths: string[]
}

export interface JsListenerEntry {
  targetKey: string
  event: 'click' | 'submit' | 'input' | 'change'
}

export interface JsSandboxSession {
  initialEffects: JsRunEffects
  listeners: JsListenerEntry[]
  hasClickHandler: (key: string, onclickAttr?: string) => boolean
  triggerEvent: (
    key: string,
    event: 'click' | 'submit' | 'input' | 'change',
    liveValues?: Record<string, string>,
    onclickAttr?: string,
  ) => JsRunEffects
}

type TokenKind =
  | 'ident'
  | 'number'
  | 'string'
  | 'template'
  | 'op'
  | 'punc'
  | 'eof'

interface Token {
  kind: TokenKind
  value: string
}

type StmtNode =
  | { type: 'block'; body: StmtNode[] }
  | { type: 'var'; name: string; init: ExprNode | null }
  | { type: 'fn'; name: string; params: string[]; body: StmtNode[] }
  | { type: 'if'; test: ExprNode; consequent: StmtNode; alternate: StmtNode | null }
  | { type: 'for'; init: StmtNode | null; test: ExprNode | null; update: ExprNode | null; body: StmtNode }
  | { type: 'forOf'; name: string; iterable: ExprNode; body: StmtNode }
  | { type: 'while'; test: ExprNode; body: StmtNode }
  | { type: 'return'; argument: ExprNode | null }
  | { type: 'expr'; expression: ExprNode }

type ExprNode =
  | { type: 'lit'; value: unknown }
  | { type: 'template'; parts: Array<{ kind: 'str'; value: string } | { kind: 'expr'; raw: string }> }
  | { type: 'ident'; name: string }
  | { type: 'array'; elements: ExprNode[] }
  | { type: 'object'; entries: Array<{ key: string; value: ExprNode }> }
  | { type: 'fn'; params: string[]; body: StmtNode[] }
  | { type: 'member'; object: ExprNode; property: string; computed: boolean; indexExpr?: ExprNode }
  | { type: 'call'; callee: ExprNode; args: ExprNode[] }
  | { type: 'unary'; op: string; argument: ExprNode }
  | { type: 'update'; op: '++' | '--'; argument: ExprNode; prefix: boolean }
  | { type: 'binary'; op: string; left: ExprNode; right: ExprNode }
  | { type: 'assign'; op: string; left: ExprNode; right: ExprNode }
  | { type: 'cond'; test: ExprNode; consequent: ExprNode; alternate: ExprNode }

const MAX_STEPS = 2000

const SAFE_CSS_STYLE_PROPS = new Map<string, keyof CSSProperties>([
  ['accentColor', 'accentColor'], ['accent-color', 'accentColor'],
  ['alignItems', 'alignItems'], ['align-items', 'alignItems'],
  ['background', 'background'],
  ['backgroundColor', 'backgroundColor'], ['background-color', 'backgroundColor'],
  ['border', 'border'], ['borderColor', 'borderColor'], ['border-color', 'borderColor'],
  ['borderRadius', 'borderRadius'], ['border-radius', 'borderRadius'],
  ['boxShadow', 'boxShadow'], ['box-shadow', 'boxShadow'],
  ['color', 'color'],
  ['cursor', 'cursor'],
  ['display', 'display'],
  ['filter', 'filter'],
  ['flexDirection', 'flexDirection'], ['flex-direction', 'flexDirection'],
  ['fontFamily', 'fontFamily'], ['font-family', 'fontFamily'],
  ['fontSize', 'fontSize'], ['font-size', 'fontSize'],
  ['fontStyle', 'fontStyle'], ['font-style', 'fontStyle'],
  ['fontWeight', 'fontWeight'], ['font-weight', 'fontWeight'],
  ['gap', 'gap'],
  ['height', 'height'],
  ['justifyContent', 'justifyContent'], ['justify-content', 'justifyContent'],
  ['letterSpacing', 'letterSpacing'], ['letter-spacing', 'letterSpacing'],
  ['lineHeight', 'lineHeight'], ['line-height', 'lineHeight'],
  ['margin', 'margin'], ['marginTop', 'marginTop'], ['marginBottom', 'marginBottom'],
  ['marginLeft', 'marginLeft'], ['marginRight', 'marginRight'],
  ['maxWidth', 'maxWidth'], ['max-width', 'maxWidth'],
  ['minHeight', 'minHeight'], ['min-height', 'minHeight'],
  ['opacity', 'opacity'],
  ['outline', 'outline'],
  ['overflow', 'overflow'],
  ['padding', 'padding'], ['paddingTop', 'paddingTop'], ['paddingBottom', 'paddingBottom'],
  ['paddingLeft', 'paddingLeft'], ['paddingRight', 'paddingRight'],
  ['position', 'position'],
  ['textAlign', 'textAlign'], ['text-align', 'textAlign'],
  ['textDecoration', 'textDecoration'], ['text-decoration', 'textDecoration'],
  ['textTransform', 'textTransform'], ['text-transform', 'textTransform'],
  ['transform', 'transform'],
  ['transition', 'transition'],
  ['visibility', 'visibility'],
  ['whiteSpace', 'whiteSpace'], ['white-space', 'whiteSpace'],
  ['width', 'width'],
  ['zIndex', 'zIndex'], ['z-index', 'zIndex'],
])

function tokenizeJs(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const len = src.length
  const twoOps = new Set(['+=', '-=', '*=', '/=', '==', '!=', '<=', '>=', '&&', '||', '++', '--', '=>', '?.'])
  const threeOps = new Set(['===', '!=='])
  const puncs = new Set(['(', ')', '{', '}', '[', ']', ',', ';', ':', '.'])

  while (i < len) {
    const ch = src[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < len && src[i] !== '\n') i++
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end === -1 ? len : end + 2
      continue
    }
    if (ch === '"' || ch === "'") {
      const q = ch
      i++
      let val = ''
      while (i < len && src[i] !== q) {
        if (src[i] === '\\' && i + 1 < len) {
          const esc = src[i + 1]
          val += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc
          i += 2
        } else {
          val += src[i++]
        }
      }
      if (src[i] === q) i++
      tokens.push({ kind: 'string', value: val })
      continue
    }
    if (ch === '`') {
      i++
      let raw = ''
      while (i < len && src[i] !== '`') {
        if (src[i] === '\\' && i + 1 < len) {
          raw += src[i] + src[i + 1]
          i += 2
        } else {
          raw += src[i++]
        }
      }
      if (src[i] === '`') i++
      tokens.push({ kind: 'template', value: raw })
      continue
    }
    if (/[0-9]/.test(ch)) {
      let num = ''
      while (i < len && /[0-9.]/.test(src[i])) num += src[i++]
      tokens.push({ kind: 'number', value: num })
      continue
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      let id = ''
      while (i < len && /[a-zA-Z0-9_$]/.test(src[i])) id += src[i++]
      tokens.push({ kind: 'ident', value: id })
      continue
    }
    const t3 = src.slice(i, i + 3)
    if (threeOps.has(t3)) {
      tokens.push({ kind: 'op', value: t3 })
      i += 3
      continue
    }
    const t2 = src.slice(i, i + 2)
    if (twoOps.has(t2)) {
      tokens.push({ kind: 'op', value: t2 })
      i += 2
      continue
    }
    if (puncs.has(ch)) {
      tokens.push({ kind: 'punc', value: ch })
      i++
      continue
    }
    if ('+-*/%<>=!?'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch })
      i++
      continue
    }
    i++
  }

  tokens.push({ kind: 'eof', value: '' })
  return tokens
}

function parseTemplateParts(raw: string): Array<{ kind: 'str'; value: string } | { kind: 'expr'; raw: string }> {
  const parts: Array<{ kind: 'str'; value: string } | { kind: 'expr'; raw: string }> = []
  let i = 0
  let buf = ''
  while (i < raw.length) {
    if (raw[i] === '$' && raw[i + 1] === '{') {
      if (buf) {
        parts.push({ kind: 'str', value: buf })
        buf = ''
      }
      i += 2
      let depth = 1
      let expr = ''
      while (i < raw.length && depth > 0) {
        if (raw[i] === '{') depth++
        else if (raw[i] === '}') depth--
        if (depth > 0) expr += raw[i]
        i++
      }
      parts.push({ kind: 'expr', raw: expr })
    } else {
      buf += raw[i++]
    }
  }
  if (buf) parts.push({ kind: 'str', value: buf })
  return parts
}

class JsParser {
  private pos = 0
  private readonly tokens: Token[]

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset] ?? { kind: 'eof', value: '' }
  }

  private next(): Token {
    const t = this.peek()
    if (this.pos < this.tokens.length - 1) this.pos++
    return t
  }

  private match(kind: TokenKind, value?: string): boolean {
    const t = this.peek()
    if (t.kind === kind && (value === undefined || t.value === value)) {
      this.next()
      return true
    }
    return false
  }

  private is(kind: TokenKind, value?: string): boolean {
    const t = this.peek()
    return t.kind === kind && (value === undefined || t.value === value)
  }

  parseProgram(): StmtNode[] {
    const stmts: StmtNode[] = []
    while (!this.is('eof')) {
      if (this.match('punc', ';')) continue
      stmts.push(this.parseStmt())
    }
    return stmts
  }

  private parseStmt(): StmtNode {
    const t = this.peek()
    if (t.kind === 'punc' && t.value === '{') return this.parseBlock()
    if (t.kind === 'ident') {
      if (t.value === 'const' || t.value === 'let' || t.value === 'var') return this.parseVarDecl()
      if (t.value === 'async' && this.peek(1).kind === 'ident' && this.peek(1).value === 'function') {
        this.next()
        return this.parseFnDecl()
      }
      if (t.value === 'function') return this.parseFnDecl()
      if (t.value === 'if') return this.parseIf()
      if (t.value === 'for') return this.parseFor()
      if (t.value === 'while') return this.parseWhile()
      if (t.value === 'return') {
        this.next()
        if (this.is('punc', ';') || this.is('punc', '}') || this.is('eof')) {
          this.match('punc', ';')
          return { type: 'return', argument: null }
        }
        const argument = this.parseExpr()
        this.match('punc', ';')
        return { type: 'return', argument }
      }
    }
    const expression = this.parseExpr()
    this.match('punc', ';')
    return { type: 'expr', expression }
  }

  private parseBlock(): StmtNode {
    this.match('punc', '{')
    const body: StmtNode[] = []
    while (!this.is('eof') && !this.is('punc', '}')) {
      if (this.match('punc', ';')) continue
      body.push(this.parseStmt())
    }
    this.match('punc', '}')
    return { type: 'block', body }
  }

  private parseVarDecl(): StmtNode {
    this.next()
    const nameTok = this.next()
    const name = nameTok.value || '_'
    let init: ExprNode | null = null
    if (this.match('op', '=')) {
      init = this.parseExpr()
    }
    this.match('punc', ';')
    return { type: 'var', name, init }
  }

  private parseParamList(): string[] {
    const params: string[] = []
    this.match('punc', '(')
    while (!this.is('eof') && !this.is('punc', ')')) {
      const p = this.next()
      if (p.kind === 'ident') params.push(p.value)
      if (!this.match('punc', ',')) break
    }
    this.match('punc', ')')
    return params
  }

  private parseFnDecl(): StmtNode {
    this.next()
    const name = this.next().value || 'anonymous'
    const params = this.parseParamList()
    const blk = this.parseBlock()
    return { type: 'fn', name, params, body: blk.type === 'block' ? blk.body : [] }
  }

  private parseIf(): StmtNode {
    this.next()
    this.match('punc', '(')
    const test = this.parseExpr()
    this.match('punc', ')')
    const consequent = this.parseStmt()
    let alternate: StmtNode | null = null
    if (this.match('ident', 'else')) {
      alternate = this.parseStmt()
    }
    return { type: 'if', test, consequent, alternate }
  }

  private parseFor(): StmtNode {
    this.next()
    this.match('punc', '(')
    let init: StmtNode | null = null
    if (this.is('ident', 'let') || this.is('ident', 'const') || this.is('ident', 'var')) {
      const declKind = this.next()
      const varName = this.next().value || '_'
      if (this.match('ident', 'of')) {
        const iterable = this.parseExpr()
        this.match('punc', ')')
        const body = this.parseStmt()
        return { type: 'forOf', name: varName, iterable, body }
      }
      this.pos -= 2
      if (declKind.kind === 'ident') {
        init = this.parseVarDecl()
      }
    } else if (!this.match('punc', ';')) {
      const expression = this.parseExpr()
      this.match('punc', ';')
      init = { type: 'expr', expression }
    }
    const test = this.is('punc', ';') ? null : this.parseExpr()
    this.match('punc', ';')
    const update = this.is('punc', ')') ? null : this.parseExpr()
    this.match('punc', ')')
    const body = this.parseStmt()
    return { type: 'for', init, test, update, body }
  }

  private parseWhile(): StmtNode {
    this.next()
    this.match('punc', '(')
    const test = this.parseExpr()
    this.match('punc', ')')
    const body = this.parseStmt()
    return { type: 'while', test, body }
  }

  parseExpr(): ExprNode {
    return this.parseAssign()
  }

  private parseAssign(): ExprNode {
    const left = this.parseCond()
    const t = this.peek()
    if (t.kind === 'op' && (t.value === '=' || t.value === '+=' || t.value === '-=' || t.value === '*=')) {
      this.next()
      const right = this.parseAssign()
      return { type: 'assign', op: t.value, left, right }
    }
    return left
  }

  private parseCond(): ExprNode {
    const test = this.parseOr()
    if (this.match('op', '?')) {
      const consequent = this.parseAssign()
      this.match('punc', ':')
      const alternate = this.parseAssign()
      return { type: 'cond', test, consequent, alternate }
    }
    return test
  }

  private parseOr(): ExprNode {
    let left = this.parseAnd()
    while (this.match('op', '||')) {
      left = { type: 'binary', op: '||', left, right: this.parseAnd() }
    }
    return left
  }

  private parseAnd(): ExprNode {
    let left = this.parseEquality()
    while (this.match('op', '&&')) {
      left = { type: 'binary', op: '&&', left, right: this.parseEquality() }
    }
    return left
  }

  private parseEquality(): ExprNode {
    let left = this.parseRelational()
    while (this.is('op', '===') || this.is('op', '!==') || this.is('op', '==') || this.is('op', '!=')) {
      const op = this.next().value
      left = { type: 'binary', op, left, right: this.parseRelational() }
    }
    return left
  }

  private parseRelational(): ExprNode {
    let left = this.parseAdditive()
    while (this.is('op', '<') || this.is('op', '>') || this.is('op', '<=') || this.is('op', '>=')) {
      const op = this.next().value
      left = { type: 'binary', op, left, right: this.parseAdditive() }
    }
    return left
  }

  private parseAdditive(): ExprNode {
    let left = this.parseMultiplicative()
    while (this.is('op', '+') || this.is('op', '-')) {
      const op = this.next().value
      left = { type: 'binary', op, left, right: this.parseMultiplicative() }
    }
    return left
  }

  private parseMultiplicative(): ExprNode {
    let left = this.parseUnary()
    while (this.is('op', '*') || this.is('op', '/') || this.is('op', '%')) {
      const op = this.next().value
      left = { type: 'binary', op, left, right: this.parseUnary() }
    }
    return left
  }

  private parseUnary(): ExprNode {
    if (this.is('ident', 'await')) {
      this.next()
      return this.parseUnary()
    }
    if (this.is('op', '!') || this.is('op', '-')) {
      const op = this.next().value
      return { type: 'unary', op, argument: this.parseUnary() }
    }
    if (this.is('op', '++') || this.is('op', '--')) {
      const op = this.next().value as '++' | '--'
      return { type: 'update', op, argument: this.parseUnary(), prefix: true }
    }
    return this.parsePostfix()
  }

  private parsePostfix(): ExprNode {
    let expr = this.parsePrimary()
    while (true) {
      if (this.match('punc', '.') || this.match('op', '?.')) {
        const prop = this.next().value
        expr = { type: 'member', object: expr, property: prop, computed: false }
      } else if (this.match('punc', '[')) {
        const indexExpr = this.parseExpr()
        this.match('punc', ']')
        expr = { type: 'member', object: expr, property: '', computed: true, indexExpr }
      } else if (this.match('punc', '(')) {
        const args: ExprNode[] = []
        while (!this.is('eof') && !this.is('punc', ')')) {
          args.push(this.parseExpr())
          if (!this.match('punc', ',')) break
        }
        this.match('punc', ')')
        expr = { type: 'call', callee: expr, args }
      } else if (this.is('op', '++') || this.is('op', '--')) {
        const op = this.next().value as '++' | '--'
        expr = { type: 'update', op, argument: expr, prefix: false }
      } else {
        break
      }
    }
    return expr
  }

  private tryParseArrow(): ExprNode | null {
    const saved = this.pos
    if (this.is('ident', 'async')) this.next()
    const params: string[] = []
    if (this.is('ident') && this.peek(1).kind === 'op' && this.peek(1).value === '=>') {
      params.push(this.next().value)
    } else if (this.match('punc', '(')) {
      while (!this.is('eof') && !this.is('punc', ')')) {
        const p = this.next()
        if (p.kind !== 'ident') {
          this.pos = saved
          return null
        }
        params.push(p.value)
        if (!this.match('punc', ',')) break
      }
      if (!this.match('punc', ')') || !(this.is('op', '=>'))) {
        this.pos = saved
        return null
      }
    } else {
      this.pos = saved
      return null
    }
    this.next()
    if (this.is('punc', '{')) {
      const blk = this.parseBlock()
      return { type: 'fn', params, body: blk.type === 'block' ? blk.body : [] }
    }
    const bodyExpr = this.parseAssign()
    return { type: 'fn', params, body: [{ type: 'return', argument: bodyExpr }] }
  }

  private parsePrimary(): ExprNode {
    const arrow = this.tryParseArrow()
    if (arrow) return arrow

    const t = this.next()
    if (t.kind === 'number') return { type: 'lit', value: Number(t.value) }
    if (t.kind === 'string') return { type: 'lit', value: t.value }
    if (t.kind === 'template') return { type: 'template', parts: parseTemplateParts(t.value) }
    if (t.kind === 'ident') {
      if (t.value === 'true') return { type: 'lit', value: true }
      if (t.value === 'false') return { type: 'lit', value: false }
      if (t.value === 'null') return { type: 'lit', value: null }
      if (t.value === 'undefined') return { type: 'lit', value: undefined }
      return { type: 'ident', name: t.value }
    }
    if (t.kind === 'punc' && t.value === '(') {
      const inner = this.parseExpr()
      this.match('punc', ')')
      return inner
    }
    if (t.kind === 'punc' && t.value === '[') {
      const elements: ExprNode[] = []
      while (!this.is('eof') && !this.is('punc', ']')) {
        elements.push(this.parseExpr())
        if (!this.match('punc', ',')) break
      }
      this.match('punc', ']')
      return { type: 'array', elements }
    }
    if (t.kind === 'punc' && t.value === '{') {
      const entries: Array<{ key: string; value: ExprNode }> = []
      while (!this.is('eof') && !this.is('punc', '}')) {
        const kTok = this.next()
        const key = kTok.value
        let value: ExprNode
        if (this.match('punc', ':')) {
          value = this.parseExpr()
        } else {
          value = { type: 'ident', name: key }
        }
        entries.push({ key, value })
        if (!this.match('punc', ',')) break
      }
      this.match('punc', '}')
      return { type: 'object', entries }
    }
    return { type: 'lit', value: undefined }
  }
}

function matchesSimpleSelector(el: VirtualElementDescriptor, selPart: string): boolean {
  const cleaned = selPart.replace(/:{1,2}[a-zA-Z-]+(?:\([^)]*\))?/g, '').trim()
  if (!cleaned) return false
  if (cleaned === '*') return true
  const tagMatch = /^[a-zA-Z0-9-]+/.exec(cleaned)?.[0]?.toLowerCase() ?? ''
  if (tagMatch && el.tag !== tagMatch) return false
  for (const idM of cleaned.matchAll(/#([a-zA-Z0-9_-]+)/g)) {
    if (el.id !== idM[1]) return false
  }
  for (const clsM of cleaned.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
    if (!el.classes.includes(clsM[1])) return false
  }
  return true
}

function matchesQuerySelector(el: VirtualElementDescriptor, rawSelector: string): boolean {
  const parts = rawSelector.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return false
  if (!matchesSimpleSelector(el, parts[parts.length - 1])) return false
  if (parts.length === 1) return true
  let ancIdx = el.ancestors.length - 1
  for (let pIdx = parts.length - 2; pIdx >= 0; pIdx--) {
    const part = parts[pIdx]
    if (part === '>') continue
    let found = false
    while (ancIdx >= 0) {
      const anc = el.ancestors[ancIdx--]
      const ancDesc: VirtualElementDescriptor = {
        key: '',
        tag: anc.tag,
        id: anc.id,
        classes: anc.classes,
        text: '',
        value: '',
        ancestors: [],
      }
      if (matchesSimpleSelector(ancDesc, part)) {
        found = true
        break
      }
    }
    if (!found) return false
  }
  return true
}

interface JsFunctionValue {
  __fn: true
  params: string[]
  body: StmtNode[]
  closure: ScopeFrame
}

interface ScopeFrame {
  vars: Record<string, unknown>
  parent: ScopeFrame | null
}

class ReturnSignal {
  readonly value: unknown
  constructor(value: unknown) {
    this.value = value
  }
}

export function createJsSandboxSession(
  jsSources: string[],
  elements: VirtualElementDescriptor[],
): JsSandboxSession {
  const elementByKey = new Map<string, VirtualElementDescriptor>()
  const patches = new Map<string, JsElementPatch>()
  const listenerMap = new Map<string, Array<{ event: JsListenerEntry['event']; fn: JsFunctionValue }>>()
  let liveValues: Record<string, string> = {}

  for (const el of elements) {
    elementByKey.set(el.key, el)
    patches.set(el.key, {
      styles: {},
      classes: [...el.classes],
    })
  }

  const rootScope: ScopeFrame = { vars: {}, parent: null }
  const currentLogs: string[] = []
  const currentAlerts: string[] = []
  const currentFetches: string[] = []
  let steps = 0

  const lookupScope = (scope: ScopeFrame, name: string): ScopeFrame | null => {
    let cur: ScopeFrame | null = scope
    while (cur) {
      if (Object.prototype.hasOwnProperty.call(cur.vars, name)) return cur
      cur = cur.parent
    }
    return null
  }

  const getVar = (scope: ScopeFrame, name: string): unknown => {
    const owner = lookupScope(scope, name)
    return owner ? owner.vars[name] : undefined
  }

  const setVar = (scope: ScopeFrame, name: string, value: unknown) => {
    const owner = lookupScope(scope, name)
    if (owner) owner.vars[name] = value
    else scope.vars[name] = value
  }

  const currentDescriptor = (key: string): VirtualElementDescriptor | null => {
    const base = elementByKey.get(key)
    if (!base) return null
    const patch = patches.get(key)
    return {
      ...base,
      classes: patch?.classes ?? base.classes,
      text: patch?.text ?? base.text,
      value: liveValues[key] ?? (base.id ? liveValues[base.id] : undefined) ?? patch?.value ?? base.value,
    }
  }

  const makeDomHandle = (key: string) => {
    const getPatch = (): JsElementPatch => {
      let p = patches.get(key)
      if (!p) {
        p = { styles: {}, classes: [] }
        patches.set(key, p)
      }
      return p
    }
    const styleProxy = new Proxy<Record<string, string>>(
      {},
      {
        get(_t, prop) {
          if (typeof prop !== 'string') return ''
          const mapped = SAFE_CSS_STYLE_PROPS.get(prop)
          return mapped ? getPatch().styles[String(mapped)] ?? '' : ''
        },
        set(_t, prop, val) {
          if (typeof prop !== 'string') return true
          const mapped = SAFE_CSS_STYLE_PROPS.get(prop)
          const clean = String(val ?? '').trim()
          if (mapped && !/url\s*\(|expression\s*\(|javascript:/i.test(clean)) {
            getPatch().styles[String(mapped)] = clean
          }
          return true
        },
      },
    )
    const classList = {
      add: (...names: string[]) => {
        const p = getPatch()
        for (const n of names) {
          const clean = String(n).trim()
          if (clean && !p.classes.includes(clean)) p.classes = [...p.classes, clean]
        }
      },
      remove: (...names: string[]) => {
        const p = getPatch()
        const drop = new Set(names.map((n) => String(n).trim()))
        p.classes = p.classes.filter((c) => !drop.has(c))
      },
      toggle: (name: string) => {
        const p = getPatch()
        const clean = String(name).trim()
        if (!clean) return false
        if (p.classes.includes(clean)) {
          p.classes = p.classes.filter((c) => c !== clean)
          return false
        }
        p.classes = [...p.classes, clean]
        return true
      },
      contains: (name: string) => getPatch().classes.includes(String(name).trim()),
    }

    return {
      __domKey: key,
      style: styleProxy,
      classList,
      get textContent() {
        return currentDescriptor(key)?.text ?? ''
      },
      set textContent(v: unknown) {
        getPatch().text = String(v ?? '')
        delete getPatch().innerHtml
      },
      get innerText() {
        return currentDescriptor(key)?.text ?? ''
      },
      set innerText(v: unknown) {
        getPatch().text = String(v ?? '')
        delete getPatch().innerHtml
      },
      get innerHTML() {
        return getPatch().innerHtml ?? currentDescriptor(key)?.text ?? ''
      },
      set innerHTML(v: unknown) {
        getPatch().innerHtml = String(v ?? '')
        delete getPatch().text
      },
      get value() {
        return currentDescriptor(key)?.value ?? ''
      },
      set value(v: unknown) {
        const nextVal = String(v ?? '')
        getPatch().value = nextVal
        liveValues[key] = nextVal
        const id = elementByKey.get(key)?.id
        if (id) liveValues[id] = nextVal
      },
      get hidden() {
        return Boolean(getPatch().hidden)
      },
      set hidden(v: unknown) {
        getPatch().hidden = Boolean(v)
      },
      addEventListener: (event: string, fn: unknown) => {
        if (
          fn &&
          typeof fn === 'object' &&
          '__fn' in fn &&
          (event === 'click' || event === 'submit' || event === 'input' || event === 'change')
        ) {
          const list = listenerMap.get(key) ?? []
          list.push({ event, fn: fn as JsFunctionValue })
          listenerMap.set(key, list)
        }
      },
      setAttribute: (name: string, val: unknown) => {
        if (name === 'hidden') getPatch().hidden = val !== 'false' && val !== false
        if (name === 'class') {
          getPatch().classes = String(val ?? '').split(/\s+/).filter(Boolean)
        }
      },
    }
  }

  const findById = (id: string) => {
    for (const el of elements) {
      if (el.id === id) return makeDomHandle(el.key)
    }
    return null
  }

  const findQuery = (selector: string, all = false) => {
    const matched: ReturnType<typeof makeDomHandle>[] = []
    for (const base of elements) {
      const desc = currentDescriptor(base.key)
      if (desc && matchesQuerySelector(desc, selector)) {
        matched.push(makeDomHandle(base.key))
        if (!all) return matched[0]
      }
    }
    return all ? matched : null
  }

  rootScope.vars.document = {
    getElementById: (id: unknown) => findById(String(id ?? '')),
    querySelector: (sel: unknown) => findQuery(String(sel ?? ''), false),
    querySelectorAll: (sel: unknown) => findQuery(String(sel ?? ''), true),
  }
  rootScope.vars.console = {
    log: (...args: unknown[]) => {
      currentLogs.push(
        args
          .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
          .join(' '),
      )
    },
  }
  rootScope.vars.alert = (msg: unknown) => {
    const txt = String(msg ?? '')
    currentAlerts.push(txt)
    currentLogs.push(`[alert] ${txt}`)
  }
  rootScope.vars.fetch = (url: unknown) => {
    const path = String(url ?? '/')
    currentFetches.push(path)
    return { ok: true, status: 200, url: path, json: () => ({ ok: true, path }) }
  }
  rootScope.vars.Math = Math
  rootScope.vars.Number = Number
  rootScope.vars.String = String
  rootScope.vars.Boolean = Boolean
  rootScope.vars.JSON = JSON
  rootScope.vars.parseInt = parseInt
  rootScope.vars.parseFloat = parseFloat

  const callFunction = (fnVal: JsFunctionValue, args: unknown[]): unknown => {
    const fnScope: ScopeFrame = { vars: {}, parent: fnVal.closure }
    fnVal.params.forEach((p, idx) => {
      fnScope.vars[p] = args[idx]
    })
    try {
      for (const st of fnVal.body) execStmt(st, fnScope)
    } catch (sig) {
      if (sig instanceof ReturnSignal) return sig.value
      throw sig
    }
    return undefined
  }

  const evalExpr = (node: ExprNode, scope: ScopeFrame): unknown => {
    if (++steps > MAX_STEPS) return undefined
    switch (node.type) {
      case 'lit':
        return node.value
      case 'ident':
        return getVar(scope, node.name)
      case 'template':
        return node.parts
          .map((p) => {
            if (p.kind === 'str') return p.value
            const exprAst = new JsParser(tokenizeJs(p.raw)).parseExpr()
            const val = evalExpr(exprAst, scope)
            return val === undefined ? '' : String(val)
          })
          .join('')
      case 'array':
        return node.elements.map((e) => evalExpr(e, scope))
      case 'object': {
        const out: Record<string, unknown> = {}
        for (const ent of node.entries) out[ent.key] = evalExpr(ent.value, scope)
        return out
      }
      case 'fn':
        return { __fn: true, params: node.params, body: node.body, closure: scope } satisfies JsFunctionValue
      case 'unary': {
        const val = evalExpr(node.argument, scope)
        return node.op === '!' ? !val : -Number(val)
      }
      case 'update': {
        const delta = node.op === '++' ? 1 : -1
        if (node.argument.type === 'ident') {
          const prev = Number(getVar(scope, node.argument.name) ?? 0)
          const next = prev + delta
          setVar(scope, node.argument.name, next)
          return node.prefix ? next : prev
        }
        return 0
      }
      case 'binary': {
        if (node.op === '&&') {
          const l = evalExpr(node.left, scope)
          return l ? evalExpr(node.right, scope) : l
        }
        if (node.op === '||') {
          const l = evalExpr(node.left, scope)
          return l ? l : evalExpr(node.right, scope)
        }
        const l = evalExpr(node.left, scope)
        const r = evalExpr(node.right, scope)
        switch (node.op) {
          case '+':
            return typeof l === 'number' && typeof r === 'number'
              ? l + r
              : `${l ?? ''}${r ?? ''}`
          case '-':
            return Number(l) - Number(r)
          case '*':
            return Number(l) * Number(r)
          case '/':
            return Number(r) === 0 ? 0 : Number(l) / Number(r)
          case '%':
            return Number(r) === 0 ? 0 : Number(l) % Number(r)
          case '===':
            return l === r
          case '!==':
            return l !== r
          case '==':
            return l == r
          case '!=':
            return l != r
          case '<':
            return Number(l) < Number(r)
          case '>':
            return Number(l) > Number(r)
          case '<=':
            return Number(l) <= Number(r)
          case '>=':
            return Number(l) >= Number(r)
          default:
            return undefined
        }
      }
      case 'cond':
        return evalExpr(node.test, scope)
          ? evalExpr(node.consequent, scope)
          : evalExpr(node.alternate, scope)
      case 'member': {
        const obj = evalExpr(node.object, scope) as Record<string, unknown> | null | undefined
        if (obj === null || obj === undefined) return undefined
        const key = node.computed && node.indexExpr ? String(evalExpr(node.indexExpr, scope)) : node.property
        if (Array.isArray(obj)) {
          if (key === 'length') return obj.length
          if (key === 'map') {
            return (fn: unknown) =>
              fn && typeof fn === 'object' && '__fn' in fn
                ? obj.map((item, idx) => callFunction(fn as JsFunctionValue, [item, idx]))
                : obj
          }
          if (key === 'filter') {
            return (fn: unknown) =>
              fn && typeof fn === 'object' && '__fn' in fn
                ? obj.filter((item, idx) => Boolean(callFunction(fn as JsFunctionValue, [item, idx])))
                : obj
          }
          if (key === 'join') return (sep = ',') => obj.join(String(sep))
          if (key === 'push') return (...items: unknown[]) => obj.push(...items)
        }
        return obj[key]
      }
      case 'call': {
        const args = node.args.map((a) => evalExpr(a, scope))
        if (node.callee.type === 'member') {
          const target = evalExpr(node.callee.object, scope) as Record<string, unknown> | null | undefined
          if (!target) return undefined
          const fn = target[node.callee.property]
          if (typeof fn === 'function') {
            return (fn as (...callArgs: unknown[]) => unknown).apply(target, args)
          }
          if (fn && typeof fn === 'object' && '__fn' in fn) {
            return callFunction(fn as JsFunctionValue, args)
          }
          return undefined
        }
        const fn = evalExpr(node.callee, scope)
        if (typeof fn === 'function') return (fn as (...callArgs: unknown[]) => unknown)(...args)
        if (fn && typeof fn === 'object' && '__fn' in fn) {
          return callFunction(fn as JsFunctionValue, args)
        }
        return undefined
      }
      case 'assign': {
        const val = evalExpr(node.right, scope)
        if (node.left.type === 'ident') {
          const cur = getVar(scope, node.left.name)
          const next =
            node.op === '='
              ? val
              : node.op === '+='
                ? typeof cur === 'number' && typeof val === 'number'
                  ? cur + val
                  : `${cur ?? ''}${val ?? ''}`
                : node.op === '-='
                  ? Number(cur) - Number(val)
                  : Number(cur) * Number(val)
          setVar(scope, node.left.name, next)
          return next
        }
        if (node.left.type === 'member') {
          const obj = evalExpr(node.left.object, scope) as Record<string, unknown> | null | undefined
          if (!obj) return val
          const key =
            node.left.computed && node.left.indexExpr
              ? String(evalExpr(node.left.indexExpr, scope))
              : node.left.property
          const cur = obj[key]
          const next =
            node.op === '='
              ? val
              : node.op === '+='
                ? typeof cur === 'number' && typeof val === 'number'
                  ? cur + val
                  : `${cur ?? ''}${val ?? ''}`
                : Number(cur) - Number(val)
          obj[key] = next
          return next
        }
        return val
      }
    }
  }

  const execStmt = (stmt: StmtNode, scope: ScopeFrame) => {
    if (++steps > MAX_STEPS) return
    switch (stmt.type) {
      case 'block': {
        const child: ScopeFrame = { vars: {}, parent: scope }
        for (const s of stmt.body) execStmt(s, child)
        return
      }
      case 'var':
        scope.vars[stmt.name] = stmt.init ? evalExpr(stmt.init, scope) : undefined
        return
      case 'fn':
        scope.vars[stmt.name] = {
          __fn: true,
          params: stmt.params,
          body: stmt.body,
          closure: scope,
        } satisfies JsFunctionValue
        return
      case 'expr':
        evalExpr(stmt.expression, scope)
        return
      case 'return':
        throw new ReturnSignal(stmt.argument ? evalExpr(stmt.argument, scope) : undefined)
      case 'if':
        if (evalExpr(stmt.test, scope)) execStmt(stmt.consequent, scope)
        else if (stmt.alternate) execStmt(stmt.alternate, scope)
        return
      case 'for': {
        const loopScope: ScopeFrame = { vars: {}, parent: scope }
        if (stmt.init) execStmt(stmt.init, loopScope)
        let iter = 0
        while (iter++ < 500 && steps <= MAX_STEPS && (!stmt.test || evalExpr(stmt.test, loopScope))) {
          execStmt(stmt.body, loopScope)
          if (stmt.update) evalExpr(stmt.update, loopScope)
        }
        return
      }
      case 'forOf': {
        const arr = evalExpr(stmt.iterable, scope)
        if (!Array.isArray(arr)) return
        let iter = 0
        for (const item of arr) {
          if (iter++ >= 500 || steps > MAX_STEPS) break
          const loopScope: ScopeFrame = { vars: { [stmt.name]: item }, parent: scope }
          execStmt(stmt.body, loopScope)
        }
        return
      }
      case 'while': {
        let iter = 0
        while (iter++ < 500 && steps <= MAX_STEPS && evalExpr(stmt.test, scope)) {
          execStmt(stmt.body, scope)
        }
      }
    }
  }

  const snapshotPatches = (): Record<string, JsElementPatch> => {
    const out: Record<string, JsElementPatch> = {}
    for (const [k, p] of patches.entries()) {
      out[k] = {
        ...p,
        styles: { ...p.styles },
        classes: [...p.classes],
      }
    }
    return out
  }

  for (const src of jsSources) {
    if (!src.trim()) continue
    try {
      const program = new JsParser(tokenizeJs(src)).parseProgram()
      steps = 0
      for (const st of program) execStmt(st, rootScope)
    } catch {
      // Invalid syntax while the user is mid-edit is caught cleanly without crashing preview.
    }
  }

  const initialEffects: JsRunEffects = {
    patches: snapshotPatches(),
    logs: [...currentLogs],
    alerts: [...currentAlerts],
    fetchPaths: [...currentFetches],
  }

  const listeners: JsListenerEntry[] = []
  for (const [targetKey, entries] of listenerMap.entries()) {
    for (const ent of entries) listeners.push({ targetKey, event: ent.event })
  }

  return {
    initialEffects,
    listeners,
    hasClickHandler: (key, onclickAttr) => {
      if ((listenerMap.get(key) ?? []).some((e) => e.event === 'click')) return true
      return Boolean(onclickAttr && onclickAttr.trim())
    },
    triggerEvent: (key, event, nextLiveValues, onclickAttr) => {
      if (nextLiveValues) liveValues = { ...liveValues, ...nextLiveValues }
      currentLogs.length = 0
      currentAlerts.length = 0
      currentFetches.length = 0
      steps = 0
      const eventObj = {
        preventDefault: () => undefined,
        target: makeDomHandle(key),
      }
      const handlers = (listenerMap.get(key) ?? []).filter((e) => e.event === event)
      for (const h of handlers) {
        try {
          callFunction(h.fn, [eventObj])
        } catch {
          // Keep preview interactive even if handler throws on incomplete code.
        }
      }
      if (event === 'click' && onclickAttr && onclickAttr.trim()) {
        try {
          const stmts = new JsParser(tokenizeJs(onclickAttr)).parseProgram()
          for (const st of stmts) execStmt(st, rootScope)
        } catch {
          // Ignore malformed inline handler mid-edit.
        }
      }
      return {
        patches: snapshotPatches(),
        logs: [...currentLogs],
        alerts: [...currentAlerts],
        fetchPaths: [...currentFetches],
      }
    },
  }
}
