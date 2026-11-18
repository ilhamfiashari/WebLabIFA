import { ApiError } from '../api'

export interface Choice { key: string; text: string }
export interface Content {
  scenario: string
  code: string | null
  code_lang: string | null
  question: string
  kind: 'pilihan' | 'isian'
  options: Choice[]
  hint: string | null
  explanation: string | null
}
export type Status = 'terkunci' | 'terbuka' | 'selesai'
export interface Exercise {
  id: string
  level: number
  title: string
  owasp: string | null
  points: number
  status: Status
  estimated_minutes?: number
  tags?: string[]
  source_format?: string
  content?: Content
  progress?: { attempts: number; hint_used: boolean; earned: number }
  key?: { answers: string[] }
}
export interface Track { id: string; title: string; description: string; exercises: Exercise[] }
export interface Level { level: number; name: string; points: number }
export interface CatalogPolicy {
  enforce_sequential_unlock: boolean
  allow_student_hints: boolean
  hide_answer_explanations_until_due: boolean
  allow_dosen_question_import: boolean
  max_import_questions: number
}
export interface Catalog { levels: Level[]; tracks: Track[]; policy?: CatalogPolicy }
export interface AnswerResult { correct: boolean; earned: number; attempts: number; explanation?: string }

export type ImportFormat = 'auto' | 'moodle_xml' | 'moodle_gift' | 'aiken' | 'json'
export interface ImportQuestionPreview {
  title: string
  track: string
  level: number
  kind: string
  question: string
  options_count: number
  answer_preview: string[]
  tags: string[]
  source_format: string
}
export interface ImportQuestionsResult {
  dry_run: boolean
  format: string
  track?: string
  count?: number
  imported?: number
  previews: ImportQuestionPreview[]
}

async function parseErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const data = (await response.json()) as { message?: string }
    return typeof data.message === 'string' ? data.message : undefined
  } catch {
    return undefined
  }
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new ApiError(response.status, await parseErrorMessage(response))
  return response.json() as Promise<T>
}

export const getStudentCatalog = () => fetch('/api/latihan', { credentials: 'same-origin', cache: 'no-store' }).then(r => json<Catalog>(r))
export const getLecturerCatalog = () => fetch('/api/dosen/latihan', { credentials: 'same-origin', cache: 'no-store' }).then(r => json<Catalog>(r))

function post(path: string, csrf: string, body?: unknown) {
  return fetch(path, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'X-CSRF-Token': csrf, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
}
export const submitAnswer = (id: string, answer: string, csrf: string) => post(`/api/latihan/${encodeURIComponent(id)}/jawab`, csrf, { answer }).then(r => json<AnswerResult>(r))
export const revealHint = (id: string, csrf: string) => post(`/api/latihan/${encodeURIComponent(id)}/petunjuk`, csrf).then(r => json<{ hint: string }>(r))
export const importQuestions = (
  csrf: string,
  payload: { format?: ImportFormat; track: 'web' | 'iot'; default_level?: number; content: string; dry_run?: boolean },
) => post('/api/dosen/latihan/import', csrf, payload).then(r => json<ImportQuestionsResult>(r))

export const deleteQuestion = (id: string, csrf: string) =>
  fetch(`/api/dosen/latihan/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'X-CSRF-Token': csrf },
  }).then(r => json<{ deleted: string }>(r))

export const exportQuestionsUrl = (format: 'moodle_xml' | 'gift' | 'json', track: 'all' | 'web' | 'iot' = 'all') =>
  `/api/dosen/latihan/export?format=${encodeURIComponent(format)}&track=${encodeURIComponent(track)}`

export const levelName = (catalog: Catalog, level: number) => catalog.levels.find(l => l.level === level)?.name ?? `Level ${level}`

export function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Langkah ini masih terkunci. Selesaikan latihan sebelumnya terlebih dahulu.'
    if (error.status === 422) return error.message || 'Jawaban kosong atau terlalu panjang.'
    if (error.status === 401) return 'Sesi berakhir. Muat ulang halaman lalu masuk kembali.'
    if (error.status === 403) return error.message || 'Fitur dinonaktifkan oleh kebijakan Admin atau permintaan ditolak.'
    if (error.status === 429) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
    return error.message || 'Layanan belum dapat dihubungi. Coba lagi.'
  }
  return 'Layanan belum dapat dihubungi. Coba lagi.'
}

/** Gamifikasi hanya tampilan: XP dan lencana diturunkan dari progres yang disimpan server. */
export const RANKS = [
  { min: 0, name: 'Pemula' }, { min: 50, name: 'Penjelajah' }, { min: 150, name: 'Analis' }, { min: 300, name: 'Penguji Muda' }, { min: 500, name: 'Pakar Keamanan' },
]
export function rankOf(xp: number) {
  const index = RANKS.reduce((found, r, i) => xp >= r.min ? i : found, 0)
  return { current: RANKS[index], next: RANKS[index + 1] as typeof RANKS[number] | undefined }
}

export function summary(catalog: Catalog) {
  const all = catalog.tracks.flatMap(t => t.exercises)
  const done = all.filter(e => e.status === 'selesai')
  return {
    xp: done.reduce((t, e) => t + (e.progress?.earned ?? 0), 0),
    maxXp: all.reduce((t, e) => t + e.points, 0),
    completed: done.length,
    total: all.length,
    firstTry: done.filter(e => e.progress?.attempts === 1 && !e.progress.hint_used).length,
    noHint: done.filter(e => !e.progress?.hint_used).length,
  }
}

export interface Badge { id: string; title: string; detail: string; earned: boolean }
export function badges(catalog: Catalog): Badge[] {
  const s = summary(catalog)
  const levelBadges = catalog.tracks.flatMap(t => catalog.levels.map(l => {
    const list = t.exercises.filter(e => e.level === l.level)
    return { id: `${t.id}-${l.level}`, title: `${t.title}: ${l.name}`, detail: `Tuntaskan ${list.length} latihan level ${l.name}`, earned: list.length > 0 && list.every(e => e.status === 'selesai') }
  }))
  return [
    { id: 'pertama', title: 'Langkah pertama', detail: 'Selesaikan satu latihan', earned: s.completed >= 1 },
    { id: 'tepat', title: 'Tepat sasaran', detail: 'Lima latihan benar pada percobaan pertama tanpa petunjuk', earned: s.firstTry >= 5 },
    { id: 'mandiri', title: 'Mandiri', detail: 'Sepuluh latihan selesai tanpa petunjuk', earned: s.noHint >= 10 },
    { id: 'dua-jalur', title: 'Dua jalur', detail: 'Tuntaskan level Mudah di semua jalur', earned: catalog.tracks.length > 0 && catalog.tracks.every(t => { const lvl = t.exercises.filter(e => e.level === 1); return lvl.length > 0 && lvl.every(e => e.status === 'selesai') }) },
    ...levelBadges,
  ]
}

/** Latihan berikutnya yang terbuka pada jalur, atau null bila jalur tuntas. */
export const nextOpen = (track: Track) => track.exercises.find(e => e.status === 'terbuka') ?? null
