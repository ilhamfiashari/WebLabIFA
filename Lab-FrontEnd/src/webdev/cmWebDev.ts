import type { Extension } from '@codemirror/state'

/** Base hook for Web Dev language-specific completions (extended with full HTML/CSS/JS specs in follow-up). */
export function webDevSnippets(_fileName: string, _en: boolean): Extension {
  void _fileName
  void _en
  return []
}
