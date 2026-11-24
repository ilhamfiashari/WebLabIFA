import {
  pickedCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import { cssLanguage } from '@codemirror/lang-css'
import { htmlLanguage } from '@codemirror/lang-html'
import {
  completionPath,
  javascriptLanguage,
  jsxLanguage,
  tsxLanguage,
  typescriptLanguage,
} from '@codemirror/lang-javascript'
import { syntaxTree } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import { editorLanguageSupport, languageForFileName } from '../shared/codemirrorSetup'
import {
  inferReceiverProfile,
  JS_EXTRA_KEYWORDS,
  JS_STANDARD_GLOBALS,
  JSX_REACT_ATTR_SPECS,
  membersForProfile,
  REACT_API_GLOBALS,
  resolveStandardJsPath,
  TS_EXTRA_KEYWORDS,
  type JsApiInfo,
} from './webLanguageSpecs'
import {
  CSS_BLOCK_SNIPPETS,
  CSS_TOP_LEVEL_SNIPPETS,
  getWebDevAutocomplete,
  HTML_BOILERPLATE_SUGGESTION,
  HTML_TAG_SUGGESTIONS,
  JS_COMMON_METHOD_SUGGESTIONS,
  JS_MEMBER_SUGGESTIONS,
  JS_SNIPPETS,
  REACT_COMPONENT_SNIPPETS,
  snippetLanguageForFile,
  type SnippetLanguage,
  type WebDevAcSuggestion,
} from './webSnippets'

function applySnippet(insertText: string): Completion['apply'] {
  return (view, completion, from, to) => {
    const line = view.state.doc.lineAt(from)
    const indent = /^[ \t]*/.exec(line.text)?.[0] ?? ''
    const source = insertText.replace(/\n/g, `\n${indent}`)
    const placeholder = source.indexOf('$0')
    const insert = placeholder < 0 ? source : source.replace('$0', '')
    view.dispatch({
      changes: { from, to, insert },
      annotations: pickedCompletion.of(completion),
      selection: { anchor: from + (placeholder < 0 ? insert.length : placeholder) },
      userEvent: 'input.complete',
      scrollIntoView: true,
    })
  }
}

function toCmOption(item: WebDevAcSuggestion, en: boolean, boost?: number): Completion {
  return {
    label: item.label,
    type: item.kind,
    info: en ? item.detailEn : item.detailId,
    boost,
    apply: applySnippet(item.insertText),
  }
}

function apiInfoToOption(item: JsApiInfo, en: boolean, boost?: number): Completion {
  const base: Completion = {
    label: item.label,
    type: item.kind,
    info: en ? item.detailEn : item.detailId,
    boost,
  }
  if (item.insertText) {
    base.apply = applySnippet(item.insertText)
  }
  return base
}

function activeSubLanguage(state: EditorState, pos: number, fileName: string): SnippetLanguage {
  if (cssLanguage.isActiveAt(state, pos)) return 'css'
  if (jsxLanguage.isActiveAt(state, pos) || tsxLanguage.isActiveAt(state, pos)) return 'jsx'
  if (javascriptLanguage.isActiveAt(state, pos) || typescriptLanguage.isActiveAt(state, pos)) return 'js'
  if (htmlLanguage.isActiveAt(state, pos)) return 'html'
  return snippetLanguageForFile(fileName)
}

function findAncestor(node: SyntaxNode | null, name: string): SyntaxNode | null {
  for (let cur = node; cur; cur = cur.parent) {
    if (cur.name === name) return cur
  }
  return null
}

function completeHtmlTags(context: CompletionContext, en: boolean): CompletionResult | null {
  const { state, pos } = context
  const tree = syntaxTree(state).resolveInner(pos, -1)

  // Let @codemirror/lang-html's enriched schema handle open-tag attributes, values, and close tags cleanly.
  if (
    tree.name === 'Comment' ||
    tree.name === 'OpenTag' ||
    tree.name === 'SelfClosingTag' ||
    tree.name === 'AttributeName' ||
    tree.name === 'AttributeValue' ||
    tree.name === 'UnquotedAttributeValue' ||
    tree.name === 'Is' ||
    tree.name === 'CloseTag' ||
    tree.name === 'StartCloseTag' ||
    tree.name === 'IncompleteCloseTag' ||
    (tree.name === 'TagName' && tree.parent && /CloseTag$/.test(tree.parent.name))
  ) {
    return null
  }

  const line = state.doc.lineAt(pos)
  const beforeOnLine = line.text.slice(0, pos - line.from)
  const tokenM = /(?:^|[\s>])(<[A-Za-z][A-Za-z0-9-]*|<|!html5?|!|[A-Za-z][A-Za-z0-9-]*)$/.exec(beforeOnLine)
  const rawToken = tokenM?.[1] ?? ''
  if (!rawToken && !context.explicit) return null

  const startsWithAngle = rawToken.startsWith('<')
  const startsWithBang = rawToken.startsWith('!')
  if (!context.explicit && !startsWithAngle && !startsWithBang && rawToken.length < 2) {
    return null
  }

  const query = (startsWithAngle ? rawToken.slice(1) : rawToken).toLowerCase()
  const options: Completion[] = []

  if (startsWithBang || (!startsWithAngle && (context.explicit || 'html5'.startsWith(query)))) {
    options.push(toCmOption(HTML_BOILERPLATE_SUGGESTION, en, startsWithBang ? 30 : 5))
  }

  if (!startsWithBang) {
    for (const item of HTML_TAG_SUGGESTIONS) {
      const tagName = item.label.replace(/^<|[\s/>]+$/g, '').toLowerCase()
      if (!query || tagName.startsWith(query)) {
        options.push(toCmOption(item, en, tagName === query ? 25 : 15))
      }
    }
  }

  if (options.length === 0) return null
  return {
    from: pos - rawToken.length,
    to: pos,
    filter: false,
    options: options.slice(0, 40),
  }
}

function completeCssSnippets(context: CompletionContext, en: boolean): CompletionResult | null {
  const { state, pos } = context
  const node = syntaxTree(state).resolveInner(pos, -1)
  if (/Comment|StringLiteral/.test(node.name)) return null

  // Do not inject multi-property snippets inside declaration values or pseudo-class selectors.
  const decl = findAncestor(node, 'Declaration')
  if (decl) {
    const colon = decl.getChild(':')
    if (colon && pos >= colon.to) return null
  }
  if (node.name === 'PseudoClassName' || node.name === 'PseudoOp') return null

  const line = state.doc.lineAt(pos)
  const beforeOnLine = line.text.slice(0, pos - line.from)

  const inBlock = Boolean(findAncestor(node, 'Block') || findAncestor(node, 'Styles'))
  if (inBlock) {
    const wordM = /([A-Za-z-]*)$/.exec(beforeOnLine)
    const prefix = wordM?.[1] ?? ''
    if (!prefix && !context.explicit) return null
    if (!context.explicit && prefix.length < 2) return null

    const blockSnips = CSS_BLOCK_SNIPPETS.map((item) => toCmOption(item, en, 4))
    return {
      from: pos - prefix.length,
      to: pos,
      options: blockSnips,
      validFor: /^[A-Za-z-]*$/,
    }
  }

  const selM = /([@:][A-Za-z0-9_-]*)$/.exec(beforeOnLine)
  const raw = selM?.[1] ?? ''
  if (!raw && !context.explicit) return null

  const topSnips = CSS_TOP_LEVEL_SNIPPETS.map((item) => toCmOption(item, en, 10))
  return {
    from: pos - raw.length,
    to: pos,
    options: topSnips,
    validFor: /^[@:A-Za-z0-9_-]*$/,
  }
}

const JS_KEYWORD_OPTIONS: Completion[] = JS_EXTRA_KEYWORDS.map((kw) => ({
  label: kw,
  type: 'keyword',
  boost: 6,
}))

const TS_KEYWORD_OPTIONS: Completion[] = TS_EXTRA_KEYWORDS.map((kw) => ({
  label: kw,
  type: /^[A-Z]/.test(kw) ? 'type' : 'keyword',
  boost: 4,
}))

function completeJsAndJsx(
  context: CompletionContext,
  en: boolean,
  isJsx: boolean,
  isTs: boolean,
): CompletionResult | null {
  const { state, pos } = context
  const node = syntaxTree(state).resolveInner(pos, -1)
  if (/Comment|RegExp|String/.test(node.name)) return null

  // 1. JSX / TSX tag & attribute completions
  if (isJsx) {
    const line = state.doc.lineAt(pos)
    const beforeOnLine = line.text.slice(0, pos - line.from)

    const jsxOpen = findAncestor(node, 'JSXOpenTag') ?? findAncestor(node, 'JSXSelfClosingTag')
    if (jsxOpen && node.name !== 'JSXStartTag') {
      const openText = state.sliceDoc(jsxOpen.from, pos)
      if (/^<[A-Za-z][A-Za-z0-9_.-]*\s+/.test(openText) && !/=\s*["'][^"']*$/.test(openText)) {
        const attrM = /([A-Za-z-]*)$/.exec(beforeOnLine)
        const prefix = attrM?.[1] ?? ''
        if (prefix || context.explicit) {
          const options: Completion[] = JSX_REACT_ATTR_SPECS.map((attr) => ({
            label: attr.label,
            type: 'property',
            info: en ? attr.detailEn : attr.detailId,
            apply: applySnippet(attr.insertText),
            boost: 10,
          }))
          return {
            from: pos - prefix.length,
            to: pos,
            options,
            validFor: /^[A-Za-z-]*$/,
          }
        }
      }
    }

    const jsxTagM = /(<[A-Za-z][A-Za-z0-9-]*|<)$/.exec(beforeOnLine)
    if (jsxTagM) {
      const raw = jsxTagM[1]
      const query = raw.slice(1).toLowerCase()
      const options = HTML_TAG_SUGGESTIONS.filter((item) => {
        const tag = item.label.replace(/^<|[\s/>]+$/g, '').toLowerCase()
        return !query || tag.startsWith(query)
      }).map((item) => toCmOption(item, en, 15))
      if (options.length > 0) {
        return {
          from: pos - raw.length,
          to: pos,
          filter: false,
          options: options.slice(0, 40),
        }
      }
    }
  }

  // 2. Dot-member completions (`document.`, `console.`, `el.`, `arr.`, `event.`, `window.location.`, ...)
  const member = completionPath(context)
  if (member && member.path.length > 0) {
    const owner = member.path[member.path.length - 1]
    const seen = new Set<string>()
    const options: Completion[] = []

    const pushCurated = (items: WebDevAcSuggestion[], boost: number) => {
      for (const item of items) {
        if (seen.has(item.label)) continue
        seen.add(item.label)
        options.push(toCmOption(item, en, boost))
      }
    }

    const pushRuntime = (items: Array<{ label: string; type: string; boost?: number }>, baseBoost: number) => {
      for (const item of items) {
        if (seen.has(item.label)) continue
        seen.add(item.label)
        options.push({
          label: item.label,
          type: item.type,
          boost: baseBoost + (item.boost ?? 0),
        })
      }
    }

    if (JS_MEMBER_SUGGESTIONS[owner]) {
      pushCurated(JS_MEMBER_SUGGESTIONS[owner], 25)
    }

    const runtimePathMembers = resolveStandardJsPath(member.path)
    if (runtimePathMembers && runtimePathMembers.length > 0) {
      pushRuntime(runtimePathMembers, 10)
    } else {
      const inferred = inferReceiverProfile(state.doc.toString(), member.path)
      if (inferred) {
        pushRuntime(membersForProfile(inferred), 12)
      }
    }

    if (options.length === 0) {
      pushCurated(JS_COMMON_METHOD_SUGGESTIONS, 15)
      pushRuntime(membersForProfile('element'), 2)
      pushRuntime(membersForProfile('array'), 2)
      pushRuntime(membersForProfile('string'), 2)
      pushRuntime(membersForProfile('event'), 1)
    }

    if (options.length > 0) {
      return {
        from: pos - member.name.length,
        to: pos,
        options,
        validFor: /^[\w$]*$/,
      }
    }
  }

  // 3. General JS / TS / React global APIs, missing keywords, and snippets
  if (!member) return null
  if (!context.explicit && member.name.length < 2) return null

  const seen = new Set<string>()
  const options: Completion[] = []
  const addUnique = (opt: Completion) => {
    if (seen.has(opt.label)) return
    seen.add(opt.label)
    options.push(opt)
  }

  for (const kw of JS_KEYWORD_OPTIONS) addUnique(kw)
  if (isTs) {
    for (const kw of TS_KEYWORD_OPTIONS) addUnique(kw)
  }
  for (const api of JS_STANDARD_GLOBALS) addUnique(apiInfoToOption(api, en, 8))
  if (isJsx) {
    for (const api of REACT_API_GLOBALS) addUnique(apiInfoToOption(api, en, 12))
    for (const snip of REACT_COMPONENT_SNIPPETS) addUnique(toCmOption(snip, en, 5))
  }
  for (const snip of JS_SNIPPETS) addUnique(toCmOption(snip, en, 4))

  return {
    from: pos - member.name.length,
    to: pos,
    options,
    validFor: /^[\w$.]*$/,
  }
}

/**
 * Context-aware HTML5, CSS3/4, JS/TS/DOM, JSX/React, Python, and SQL completions that complement
 * CodeMirror's built-in language sources — including embedded `<style>`, `<script>`, inline `style="..."`,
 * and inline `on*="..."` event attributes inside HTML.
 */
export function webDevSnippets(fileName: string, en: boolean): Extension {
  const fileSupport = editorLanguageSupport(languageForFileName(fileName))
  const source = (context: CompletionContext): CompletionResult | null => {
    const activeLang = activeSubLanguage(context.state, context.pos, fileName)

    if (activeLang === 'html') {
      return completeHtmlTags(context, en)
    }
    if (activeLang === 'css') {
      return completeCssSnippets(context, en)
    }
    if (activeLang === 'js' || activeLang === 'jsx') {
      const isTs =
        typescriptLanguage.isActiveAt(context.state, context.pos) ||
        tsxLanguage.isActiveAt(context.state, context.pos)
      return completeJsAndJsx(context, en, activeLang === 'jsx', isTs)
    }

    const node = syntaxTree(context.state).resolveInner(context.pos, -1)
    if (/Comment|String/.test(node.name)) return null
    const result = getWebDevAutocomplete(
      context.state.doc.toString(),
      context.pos,
      fileName,
      context.explicit,
      activeLang,
    )
    if (!result) return null
    return {
      from: result.replaceStart,
      to: result.replaceEnd,
      filter: false,
      options: result.items.map((item) => toCmOption(item, en)),
    }
  }

  return EditorState.languageData.of((state, pos) => {
    const isSupported =
      fileSupport?.language.isActiveAt(state, pos) ||
      cssLanguage.isActiveAt(state, pos) ||
      javascriptLanguage.isActiveAt(state, pos) ||
      htmlLanguage.isActiveAt(state, pos)
    return isSupported ? [{ autocomplete: source }] : []
  })
}
