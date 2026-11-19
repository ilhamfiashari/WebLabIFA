import type { WebDevFileLang } from './types'

export interface HighlightToken {
  text: string
  type: 'plain' | 'comment' | 'preproc' | 'keyword' | 'type' | 'builtin' | 'string' | 'number'
}

const CODE_KEYWORDS = new Set([
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'import',
  'from',
  'export',
  'default',
  'async',
  'await',
  'class',
  'def',
  'self',
  'in',
  'and',
  'or',
  'not',
  'true',
  'false',
  'null',
  'None',
  'True',
  'False',
  'CREATE',
  'TABLE',
  'INSERT',
  'INTO',
  'VALUES',
  'SELECT',
  'FROM',
  'WHERE',
  'UPDATE',
  'SET',
  'DELETE',
  'PRIMARY',
  'KEY',
  'SERIAL',
  'TEXT',
  'INTEGER',
  'NUMERIC',
  'BOOLEAN',
  'NOT',
  'NULL',
])

const BUILTINS = new Set([
  'document',
  'window',
  'console',
  'fetch',
  'useState',
  'useEffect',
  'FastAPI',
  'print',
  'len',
  'str',
  'int',
  'float',
  'dict',
  'list',
  'JSON',
  'display',
  'flex',
  'grid',
  'padding',
  'margin',
  'color',
  'background',
  'border-radius',
])

export function detectFileLanguage(name: string): WebDevFileLang {
  const lower = name.toLowerCase()
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.jsx') || lower.endsWith('.tsx')) return 'jsx'
  if (lower.endsWith('.js') || lower.endsWith('.ts')) return 'js'
  if (lower.endsWith('.py')) return 'python'
  if (lower.endsWith('.sql')) return 'sql'
  if (lower.endsWith('.json')) return 'json'
  return 'text'
}

export function tokenizeWebDevCode(code: string, lang: WebDevFileLang): HighlightToken[] {
  const tokens: HighlightToken[] = []
  let i = 0
  const len = code.length

  while (i < len) {
    const ch = code[i]
    const next = code[i + 1] ?? ''

    // Comments (# for python, -- for sql, // or /* for js/css, <!-- for html)
    if (
      (lang === 'python' && ch === '#') ||
      (lang === 'sql' && ch === '-' && next === '-') ||
      ((lang === 'js' || lang === 'jsx' || lang === 'css') && ch === '/' && next === '/')
    ) {
      let end = code.indexOf('\n', i)
      if (end === -1) end = len
      tokens.push({ text: code.slice(i, end), type: 'comment' })
      i = end
      continue
    }

    if (ch === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2)
      const cut = end === -1 ? len : end + 2
      tokens.push({ text: code.slice(i, cut), type: 'comment' })
      i = cut
      continue
    }

    if (lang === 'html' && code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i + 4)
      const cut = end === -1 ? len : end + 3
      tokens.push({ text: code.slice(i, cut), type: 'comment' })
      i = cut
      continue
    }

    // HTML / JSX tags (<div, </section)
    if ((lang === 'html' || lang === 'jsx') && ch === '<' && /[A-Za-z/!]/.test(next)) {
      let end = i + 1
      while (end < len && /[A-Za-z0-9_/:!-]/.test(code[end])) end++
      tokens.push({ text: code.slice(i, end), type: 'preproc' })
      i = end
      continue
    }

    // Decorators (@app.get)
    if (lang === 'python' && ch === '@') {
      let end = i + 1
      while (end < len && /[A-Za-z0-9_.]/.test(code[end])) end++
      tokens.push({ text: code.slice(i, end), type: 'preproc' })
      i = end
      continue
    }

    // Strings ("...", '...', `...`)
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      let end = i + 1
      while (end < len) {
        if (code[end] === '\\') {
          end += 2
          continue
        }
        if (code[end] === quote || (quote !== '`' && code[end] === '\n')) {
          if (code[end] === quote) end++
          break
        }
        end++
      }
      tokens.push({ text: code.slice(i, end), type: 'string' })
      i = end
      continue
    }

    // Numbers
    if (/[0-9]/.test(ch) && (i === 0 || !/[A-Za-z_]/.test(code[i - 1]))) {
      let end = i + 1
      while (end < len && /[0-9.pxrem%a-fA-Fx]/.test(code[end])) end++
      tokens.push({ text: code.slice(i, end), type: 'number' })
      i = end
      continue
    }

    // Identifiers & keywords
    if (/[A-Za-z_]/.test(ch)) {
      let end = i + 1
      while (end < len && /[A-Za-z0-9_-]/.test(code[end])) end++
      const word = code.slice(i, end)
      if (CODE_KEYWORDS.has(word) || CODE_KEYWORDS.has(word.toUpperCase())) {
        tokens.push({ text: word, type: 'keyword' })
      } else if (BUILTINS.has(word)) {
        tokens.push({ text: word, type: 'builtin' })
      } else if (/^[A-Z][A-Za-z0-9_]*$/.test(word)) {
        tokens.push({ text: word, type: 'type' })
      } else {
        tokens.push({ text: word, type: 'plain' })
      }
      i = end
      continue
    }

    // Plain chars
    let end = i + 1
    while (
      end < len &&
      !/[A-Za-z0-9_"'`<@#/-]/.test(code[end])
    ) {
      end++
    }
    tokens.push({ text: code.slice(i, end), type: 'plain' })
    i = end
  }

  return tokens
}

export interface WebDevAcSuggestion {
  label: string
  insertText: string
  detailId: string
  detailEn: string
  kind: 'tag' | 'css' | 'js' | 'react' | 'py' | 'sql'
}

const WEBDEV_SNIPPETS: Record<WebDevFileLang, WebDevAcSuggestion[]> = {
  html: [
    { label: '<section class="card">', insertText: '<section class="card">\n  <h2>$0</h2>\n  <p></p>\n</section>', detailId: 'Blok konten HTML5 semantik', detailEn: 'Semantic section card', kind: 'tag' },
    { label: '<form id="app-form">', insertText: '<form id="app-form">\n  <input id="item-input" placeholder="Ketik item..." />\n  <button type="submit">Kirim</button>\n</form>', detailId: 'Formulir HTML dengan input & tombol submit', detailEn: 'Form with input and submit button', kind: 'tag' },
    { label: '<table>', insertText: '<table>\n  <thead><tr><th>Kolom</th><th>Nilai</th></tr></thead>\n  <tbody><tr><td>Data</td><td>OK</td></tr></tbody>\n</table>', detailId: 'Tabel HTML dengan thead & tbody', detailEn: 'HTML table', kind: 'tag' },
    { label: '<nav>', insertText: '<nav>\n  <a href="/">Beranda</a>\n  <a href="/api/items">API</a>\n</nav>', detailId: 'Navigasi utama situs Web', detailEn: 'Semantic navigation bar', kind: 'tag' },
  ],
  css: [
    { label: 'display: flex;', insertText: 'display: flex;\n  gap: 12px;\n  align-items: center;', detailId: 'Layout Flexbox sejajar horisontal', detailEn: 'Flexbox horizontal layout', kind: 'css' },
    { label: 'display: grid;', insertText: 'display: grid;\n  grid-template-columns: repeat(2, 1fr);\n  gap: 12px;', detailId: 'Layout CSS Grid 2 kolom', detailEn: '2-column CSS grid layout', kind: 'css' },
    { label: 'border-radius: 10px;', insertText: 'border-radius: 10px;', detailId: 'Membulatkan sudut elemen', detailEn: 'Rounded corners', kind: 'css' },
    { label: 'box-shadow', insertText: 'box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);', detailId: 'Efek bayangan kartu modern', detailEn: 'Subtle card shadow', kind: 'css' },
  ],
  js: [
    { label: 'document.getElementById', insertText: 'document.getElementById("$0")', detailId: 'Ambil elemen DOM berdasarkan atribut id', detailEn: 'Select DOM element by id', kind: 'js' },
    { label: 'addEventListener', insertText: 'addEventListener("click", () => {\n  console.log("Clicked!");\n});', detailId: 'Pasang pendengar event interaktif DOM', detailEn: 'Attach click event listener', kind: 'js' },
    { label: 'fetch("/api/...")', insertText: 'const res = await fetch("/api/items");\nconsole.log(res);', detailId: 'Panggil endpoint REST API FastAPI', detailEn: 'Call REST API endpoint', kind: 'js' },
    { label: 'console.log', insertText: 'console.log($0);', detailId: 'Cetak output debug ke panel Console', detailEn: 'Print debug output to console', kind: 'js' },
  ],
  jsx: [
    { label: 'useState', insertText: 'const [count, setCount] = useState(0);', detailId: 'Hook state komponen React JS', detailEn: 'React state hook', kind: 'react' },
    { label: 'function App()', insertText: 'function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <main class="card">\n      <h2>React Counter: {count}</h2>\n      <button onClick={() => setCount(count + 1)}>Tambah</button>\n    </main>\n  );\n}', detailId: 'Kerangka komponen utama React dengan state', detailEn: 'Stateful React App component', kind: 'react' },
  ],
  python: [
    { label: 'class Model:', insertText: 'class Produk:\n    def __init__(self, nama, harga):\n        self.nama = nama\n        self.harga = harga\n\n    def info(self):\n        return f"{self.nama} - Rp{self.harga}"', detailId: 'Kelas OOP Python dengan konstruktor __init__', detailEn: 'Python class with constructor', kind: 'py' },
    { label: '@app.get', insertText: '@app.get("/api/items")\ndef get_items():\n    return {"status": "ok", "items": ["Buku", "Sensor"]}', detailId: 'Endpoint HTTP GET FastAPI', detailEn: 'FastAPI GET route decorator', kind: 'py' },
    { label: '@app.post', insertText: '@app.post("/api/items")\ndef create_item():\n    return {"created": True, "id": 101}', detailId: 'Endpoint HTTP POST FastAPI', detailEn: 'FastAPI POST route decorator', kind: 'py' },
    { label: 'print()', insertText: 'print($0)', detailId: 'Cetak hasil eksekusi Python ke Console', detailEn: 'Print output to Python runner console', kind: 'py' },
  ],
  sql: [
    { label: 'CREATE TABLE', insertText: 'CREATE TABLE mahasiswa (\n  id INTEGER PRIMARY KEY,\n  nama TEXT NOT NULL,\n  nilai INTEGER\n);', detailId: 'Buat skema tabel PostgreSQL baru', detailEn: 'Create PostgreSQL table schema', kind: 'sql' },
    { label: 'INSERT INTO', insertText: "INSERT INTO mahasiswa (id, nama, nilai) VALUES (1, 'Budi', 92);", detailId: 'Tambah baris data ke tabel PostgreSQL', detailEn: 'Insert row into PostgreSQL table', kind: 'sql' },
    { label: 'SELECT * FROM', insertText: 'SELECT * FROM mahasiswa WHERE nilai >= 80;', detailId: 'Kueri pembacaan data PostgreSQL', detailEn: 'Query rows from table', kind: 'sql' },
  ],
  json: [],
  text: [],
}

export function getWebDevAutocomplete(
  code: string,
  cursorPos: number,
  fileName: string,
): { replaceStart: number; replaceEnd: number; items: WebDevAcSuggestion[] } | null {
  const lang = detectFileLanguage(fileName)
  const pool = WEBDEV_SNIPPETS[lang]
  if (!pool || pool.length === 0) return null

  const before = code.slice(0, cursorPos)
  const m = /([<@A-Za-z_][A-Za-z0-9_.:-]{1,32})$/.exec(before)
  if (!m) return null
  const prefix = m[1].toLowerCase()
  const items = pool.filter(
    (s) => s.label.toLowerCase().includes(prefix) || s.insertText.toLowerCase().startsWith(prefix),
  )
  if (items.length === 0) return null
  return {
    replaceStart: cursorPos - m[1].length,
    replaceEnd: cursorPos,
    items: items.slice(0, 8),
  }
}
