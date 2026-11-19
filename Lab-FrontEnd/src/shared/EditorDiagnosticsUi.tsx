import { Fragment } from 'react'
import {
  groupHighlightTokensByLine,
  splitLeadingLineSpaces,
  type CodeDiagnostic,
  type HighlightTokenLike,
} from './editorDiagnostics'

/** Render syntax-highlighted tokens line-by-line with wavy red underline on faulty lines. */
export function HighlightedCodeLines({
  tokens,
  classPrefix,
  errorLines,
}: {
  tokens: HighlightTokenLike[]
  classPrefix: 'tok-' | 'wd-tok-'
  errorLines: Set<number>
}) {
  const tokenLines = groupHighlightTokensByLine(tokens)
  return (
    <>
      {tokenLines.map((lineToks, idx) => {
        const lineNo = idx + 1
        const suffix = idx < tokenLines.length - 1 ? '\n' : '\n '
        if (!errorLines.has(lineNo)) {
          return (
            <Fragment key={lineNo}>
              {lineToks.map((tok, ti) => (
                <span key={ti} className={`${classPrefix}${tok.type}`}>
                  {tok.text}
                </span>
              ))}
              {suffix}
            </Fragment>
          )
        }

        const { indent, rest } = splitLeadingLineSpaces(lineToks)
        return (
          <Fragment key={lineNo}>
            {indent}
            <span className="ed-code-error-squiggle" data-error-line={lineNo}>
              {rest.map((tok, ti) => (
                <span key={ti} className={`${classPrefix}${tok.type}`}>
                  {tok.text}
                </span>
              ))}
            </span>
            {suffix}
          </Fragment>
        )
      })}
    </>
  )
}

/** Clickable diagnostic summary list inside editor error banner. */
export function EditorDiagnosticsList({
  diagnostics,
  extraError,
  en,
  onJump,
}: {
  diagnostics: CodeDiagnostic[]
  extraError?: string | null
  en: boolean
  onJump: (diag: CodeDiagnostic) => void
}) {
  return (
    <div className="ed-diag-list">
      {diagnostics.slice(0, 4).map((d) => (
        <button
          key={`${d.line}:${d.col}`}
          type="button"
          className="ed-diag-item"
          onClick={() => onJump(d)}
        >
          <span className="ed-diag-line-badge">
            {en ? `Line ${d.line}` : `Baris ${d.line}`}
          </span>
          <span>{en ? d.messageEn : d.messageId}</span>
        </button>
      ))}
      {diagnostics.length === 0 && extraError ? <div>{extraError}</div> : null}
    </div>
  )
}

/** Compact VS Code status-bar diagnostic counter & quick-jump pill. */
export function EditorStatusDiagnosticPill({
  diagnostics,
  en,
  onJump,
}: {
  diagnostics: CodeDiagnostic[]
  en: boolean
  onJump: (diag: CodeDiagnostic) => void
}) {
  if (diagnostics.length === 0) {
    return (
      <span className="ed-status-ok-pill">
        ✓ {en ? '0 Errors' : '0 Error'}
      </span>
    )
  }
  const first = diagnostics[0]
  return (
    <button
      type="button"
      className="ed-status-err-btn"
      onClick={() => onJump(first)}
      title={en ? first.messageEn : first.messageId}
    >
      <span>⊗</span>
      <span>
        {diagnostics.length} {en ? (diagnostics.length === 1 ? 'Error' : 'Errors') : 'Error'} ·{' '}
        Ln {first.line}: {en ? first.messageEn : first.messageId}
      </span>
    </button>
  )
}
