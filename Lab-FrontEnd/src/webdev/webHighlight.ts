import type { WebDevFileLang } from './types'

export interface HighlightToken {
  text: string
  type: 'plain' | 'comment' | 'preproc' | 'keyword' | 'type' | 'builtin' | 'string' | 'number' | 'punct'
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
  'ORDER',
  'BY',
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
  'getElementById',
  'querySelector',
  'addEventListener',
  'textContent',
  'innerText',
  'map',
  'filter',
  'display',
  'flex',
  'grid',
  'padding',
  'margin',
  'color',
  'background',
  'background-color',
  'border',
  'border-radius',
  'box-shadow',
  'gap',
  'flex-direction',
  'grid-template-columns',
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

    if ((lang === 'html' || lang === 'jsx') && ch === '<' && /[A-Za-z/!]/.test(next)) {
      let end = i + 1
      while (end < len && /[A-Za-z0-9_/:!-]/.test(code[end])) end++
      tokens.push({ text: code.slice(i, end), type: 'preproc' })
      i = end
      continue
    }

    if (lang === 'python' && ch === '@') {
      let end = i + 1
      while (end < len && /[A-Za-z0-9_.]/.test(code[end])) end++
      tokens.push({ text: code.slice(i, end), type: 'preproc' })
      i = end
      continue
    }

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

    if (/[0-9]/.test(ch) && (i === 0 || !/[A-Za-z_]/.test(code[i - 1]))) {
      let end = i + 1
      while (end < len && /[0-9.pxrem%a-fA-Fx]/.test(code[end])) end++
      tokens.push({ text: code.slice(i, end), type: 'number' })
      i = end
      continue
    }

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
      } else if ((lang === 'html' || lang === 'jsx') && code[end] === '=') {
        tokens.push({ text: word, type: 'type' })
      } else {
        tokens.push({ text: word, type: 'plain' })
      }
      i = end
      continue
    }

    if (/[{}()[\];,.:=<>+\-*/!]/.test(ch)) {
      tokens.push({ text: ch, type: 'punct' })
      i++
      continue
    }

    let end = i + 1
    while (end < len && !/[A-Za-z0-9_"'`<@#/{}()[\];,.:=>+\-*!]/.test(code[end])) {
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
  kind: 'tag' | 'attr' | 'css' | 'js' | 'react' | 'py' | 'sql' | 'snip'
  params?: Array<{ name: string; type: string }>
}

const HTML_TAG_SUGGESTIONS: WebDevAcSuggestion[] = [
  { label: '<header>', insertText: '<header class="$0">\n  \n</header>', detailId: 'Header halaman atau bagian atas', detailEn: 'Page or section header', kind: 'tag' },
  { label: '<nav>', insertText: '<nav class="$0">\n  <a href="/">Beranda</a>\n</nav>', detailId: 'Baris navigasi tautan', detailEn: 'Navigation bar container', kind: 'tag' },
  { label: '<main>', insertText: '<main class="$0">\n  \n</main>', detailId: 'Konten utama dokumen HTML5', detailEn: 'Main document content', kind: 'tag' },
  { label: '<section>', insertText: '<section class="card">\n  <h2>$0</h2>\n  <p></p>\n</section>', detailId: 'Seksi/kartu konten terstruktur', detailEn: 'Structured content section', kind: 'tag' },
  { label: '<article>', insertText: '<article>\n  <h2>$0</h2>\n  <p></p>\n</article>', detailId: 'Konten artikel mandiri', detailEn: 'Self-contained article block', kind: 'tag' },
  { label: '<footer>', insertText: '<footer class="foot">\n  <small>$0</small>\n</footer>', detailId: 'Catatan kaki dokumen HTML5', detailEn: 'Document footer block', kind: 'tag' },
  { label: '<div>', insertText: '<div class="$0"></div>', detailId: 'Wadah blok div umum', detailEn: 'Generic block container', kind: 'tag' },
  { label: '<h1>', insertText: '<h1>$0</h1>', detailId: 'Judul utama tingkat 1', detailEn: 'Heading level 1', kind: 'tag' },
  { label: '<h2>', insertText: '<h2>$0</h2>', detailId: 'Subjudul tingkat 2', detailEn: 'Heading level 2', kind: 'tag' },
  { label: '<p>', insertText: '<p>$0</p>', detailId: 'Paragraf teks', detailEn: 'Text paragraph', kind: 'tag' },
  { label: '<button>', insertText: '<button id="$0" type="button">Klik</button>', detailId: 'Tombol aksi interaktif', detailEn: 'Interactive button element', kind: 'tag', params: [{ name: 'id', type: 'string' }, { name: 'type', type: 'button|submit' }] },
  { label: '<form>', insertText: '<form id="app-form">\n  <input id="$0" type="text" placeholder="..." />\n  <button type="submit">Kirim</button>\n</form>', detailId: 'Formulir input HTML', detailEn: 'HTML form element', kind: 'tag' },
  { label: '<input />', insertText: '<input id="$0" type="text" placeholder="Ketik nilai..." />', detailId: 'Kolom masukan teks/angka (void tag)', detailEn: 'Input field (void tag)', kind: 'tag', params: [{ name: 'type', type: 'text|number|email' }, { name: 'placeholder', type: 'string' }] },
  { label: '<label>', insertText: '<label for="$0"></label>', detailId: 'Label keterangan field formulir', detailEn: 'Form field label', kind: 'tag' },
  { label: '<table>', insertText: '<table>\n  <thead>\n    <tr><th>Kolom</th><th>Status</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>$0</td><td>Aktif</td></tr>\n  </tbody>\n</table>', detailId: 'Tabel HTML dengan thead & tbody', detailEn: 'Structured HTML table', kind: 'tag' },
  { label: '<ul>', insertText: '<ul>\n  <li>$0</li>\n</ul>', detailId: 'Daftar berbutir tak berurut', detailEn: 'Unordered list', kind: 'tag' },
  { label: '<li>', insertText: '<li>$0</li>', detailId: 'Item di dalam <ul> atau <ol>', detailEn: 'List item', kind: 'tag' },
  { label: '<a>', insertText: '<a href="$0">Tautan</a>', detailId: 'Hyperlink navigasi', detailEn: 'Anchor hyperlink', kind: 'tag' },
  { label: '<span>', insertText: '<span class="$0"></span>', detailId: 'Elemen teks sebaris', detailEn: 'Inline text container', kind: 'tag' },
  { label: '<strong>', insertText: '<strong>$0</strong>', detailId: 'Penekanan teks tebal semantik', detailEn: 'Strong emphasis text', kind: 'tag' },
  { label: '<code>', insertText: '<code>$0</code>', detailId: 'Potongan kode inline', detailEn: 'Inline code snippet', kind: 'tag' },
]

const HTML_ATTR_SUGGESTIONS: WebDevAcSuggestion[] = [
  { label: 'class="..."', insertText: 'class="$0"', detailId: 'Kelas CSS untuk styling elemen', detailEn: 'CSS class selector list', kind: 'attr' },
  { label: 'id="..."', insertText: 'id="$0"', detailId: 'Identitas unik DOM untuk getElementById', detailEn: 'Unique element identifier', kind: 'attr' },
  { label: 'type="..."', insertText: 'type="$0"', detailId: 'Tipe tombol/input (button, submit, text)', detailEn: 'Button/input type', kind: 'attr' },
  { label: 'placeholder="..."', insertText: 'placeholder="$0"', detailId: 'Teks petunjuk di dalam input', detailEn: 'Input placeholder hint', kind: 'attr' },
  { label: 'href="..."', insertText: 'href="$0"', detailId: 'Alamat tujuan tautan <a>', detailEn: 'Anchor link URL', kind: 'attr' },
  { label: 'onClick={() => ...}', insertText: 'onClick={() => $0}', detailId: 'Handler klik React JSX', detailEn: 'React click event handler', kind: 'attr' },
]

const WEBDEV_SNIPPETS: Record<WebDevFileLang, WebDevAcSuggestion[]> = {
  html: [
    ...HTML_TAG_SUGGESTIONS,
    { label: '!html5 (Boilerplate)', insertText: '<header class="hero">\n  <h1>$0</h1>\n</header>\n<main class="card">\n  <p>Konten utama web</p>\n</main>\n<footer>\n  <small>IFA Web Lab</small>\n</footer>', detailId: 'Templat lengkap HTML5 Semantik (Emmet !)', detailEn: 'Semantic HTML5 starter layout (Emmet !)', kind: 'snip' },
  ],
  css: [
    { label: 'display: flex;', insertText: 'display: flex;\n  gap: 12px;\n  align-items: center;', detailId: 'Layout Flexbox sejajar horisontal', detailEn: 'Flexbox horizontal layout', kind: 'css' },
    { label: 'display: grid;', insertText: 'display: grid;\n  grid-template-columns: repeat(2, 1fr);\n  gap: 12px;', detailId: 'Layout CSS Grid 2 kolom', detailEn: '2-column CSS grid layout', kind: 'css' },
    { label: 'flex-direction: column;', insertText: 'flex-direction: column;', detailId: 'Susun item flex secara vertikal', detailEn: 'Vertical flex stack', kind: 'css' },
    { label: 'justify-content: space-between;', insertText: 'justify-content: space-between;', detailId: 'Ratakan spasi horisontal item flex', detailEn: 'Distribute flex items horizontally', kind: 'css' },
    { label: 'align-items: center;', insertText: 'align-items: center;', detailId: 'Pusatkan item flex secara vertikal', detailEn: 'Center flex items vertically', kind: 'css' },
    { label: 'gap: 12px;', insertText: 'gap: $0px;', detailId: 'Jarak antar elemen flex/grid', detailEn: 'Flex/grid gap spacing', kind: 'css' },
    { label: 'padding: 16px;', insertText: 'padding: $0px;', detailId: 'Ruang dalam elemen (inner spacing)', detailEn: 'Element inner padding', kind: 'css' },
    { label: 'margin: 12px 0;', insertText: 'margin: $0px;', detailId: 'Jarak luar elemen (outer spacing)', detailEn: 'Element outer margin', kind: 'css' },
    { label: 'background: #ffffff;', insertText: 'background: #$0;', detailId: 'Warna latar belakang elemen', detailEn: 'Background color', kind: 'css' },
    { label: 'color: #0f172a;', insertText: 'color: #$0;', detailId: 'Warna teks foreground', detailEn: 'Text foreground color', kind: 'css' },
    { label: 'border: 1px solid #cbd5e1;', insertText: 'border: 1px solid #$0;', detailId: 'Garis tepi solid elemen', detailEn: 'Element solid border', kind: 'css' },
    { label: 'border-radius: 10px;', insertText: 'border-radius: $0px;', detailId: 'Membulatkan sudut elemen', detailEn: 'Rounded corners', kind: 'css' },
    { label: 'box-shadow', insertText: 'box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);', detailId: 'Efek bayangan kartu modern', detailEn: 'Subtle card shadow', kind: 'css' },
    { label: 'font-size: 16px;', insertText: 'font-size: $0px;', detailId: 'Ukuran font teks', detailEn: 'Text font size', kind: 'css' },
    { label: 'font-weight: 700;', insertText: 'font-weight: 700;', detailId: 'Ketebalan huruf teks', detailEn: 'Font weight boldness', kind: 'css' },
  ],
  js: [
    { label: 'document.getElementById', insertText: 'document.getElementById("$0")', detailId: 'Ambil elemen DOM berdasarkan atribut id', detailEn: 'Select DOM element by id', kind: 'js', params: [{ name: 'id', type: 'string' }] },
    { label: 'addEventListener', insertText: 'addEventListener("click", () => {\n  $0\n});', detailId: 'Pasang pendengar event interaktif DOM', detailEn: 'Attach click event listener', kind: 'js', params: [{ name: 'event', type: 'click|submit' }, { name: 'handler', type: '() => void' }] },
    { label: 'textContent', insertText: 'textContent = "$0";', detailId: 'Ubah isi teks aman pada elemen DOM', detailEn: 'Set element safe text', kind: 'js' },
    { label: 'console.log', insertText: 'console.log($0);', detailId: 'Cetak output debug ke panel Console', detailEn: 'Print debug output to console', kind: 'js', params: [{ name: 'value', type: 'any' }] },
    { label: 'fetch("/api/...")', insertText: 'const res = await fetch("$0");\nconsole.log(res);', detailId: 'Panggil endpoint REST API FastAPI', detailEn: 'Call REST API endpoint', kind: 'js', params: [{ name: 'url', type: 'string' }] },
    { label: '.map((item) => ...)', insertText: '.map(($0) => )', detailId: 'Transformasi array ES6 menjadi daftar baru', detailEn: 'ES6 array map transformation', kind: 'js', params: [{ name: 'callback', type: '(item) => T' }] },
    { label: '.filter((item) => ...)', insertText: '.filter(($0) => true)', detailId: 'Saring elemen array sesuai kondisi', detailEn: 'ES6 array filter', kind: 'js', params: [{ name: 'predicate', type: '(item) => boolean' }] },
    { label: 'const arrowFn = () =>', insertText: 'const $0 = () => {\n  return ;\n};', detailId: 'Deklarasi fungsi panah ES6 modern', detailEn: 'Modern ES6 arrow function', kind: 'js' },
  ],
  jsx: [
    ...HTML_TAG_SUGGESTIONS,
    { label: 'useState', insertText: 'const [count, setCount] = useState($0);', detailId: 'Hook state komponen React JS', detailEn: 'React state hook', kind: 'react', params: [{ name: 'initialState', type: 'any' }] },
    { label: 'function App()', insertText: 'function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <main class="card">\n      <h2>React Counter: {count}</h2>\n      <button type="button" onClick={() => setCount(count + 1)}>Tambah (+1)</button>\n    </main>\n  );\n}', detailId: 'Kerangka komponen utama React dengan state', detailEn: 'Stateful React App component', kind: 'react' },
    { label: '.map((item) => <span>{item}</span>)', insertText: '.map((item) => <span class="badge">{item}</span>)', detailId: 'Render array React JSX ke elemen', detailEn: 'Render list items in JSX', kind: 'react' },
  ],
  python: [
    { label: 'from fastapi import FastAPI', insertText: 'from fastapi import FastAPI\napp = FastAPI()\n\n', detailId: 'Inisialisasi aplikasi REST API FastAPI', detailEn: 'Import & instantiate FastAPI app', kind: 'py' },
    { label: '@app.get', insertText: '@app.get("/api/$0")\ndef get_data():\n    return {"status": "ok"}', detailId: 'Endpoint HTTP GET FastAPI', detailEn: 'FastAPI GET route decorator', kind: 'py', params: [{ name: 'path', type: 'str' }] },
    { label: '@app.post', insertText: '@app.post("/api/$0")\ndef create_data():\n    return {"created": True}', detailId: 'Endpoint HTTP POST FastAPI', detailEn: 'FastAPI POST route decorator', kind: 'py', params: [{ name: 'path', type: 'str' }] },
    { label: 'class Model:', insertText: 'class $0:\n    def __init__(self, nama, nilai):\n        self.nama = nama\n        self.nilai = nilai\n\n    def info(self):\n        return f"{self.nama}: {self.nilai}"', detailId: 'Kelas OOP Python dengan konstruktor __init__', detailEn: 'Python class with __init__ constructor', kind: 'py' },
    { label: 'def function():', insertText: 'def $0():\n    return "ok"', detailId: 'Definisi fungsi Python', detailEn: 'Python function definition', kind: 'py' },
    { label: 'for item in list:', insertText: 'for item in $0:\n    print(item)', detailId: 'Perulangan for Python', detailEn: 'Python for-in loop', kind: 'py' },
    { label: 'print()', insertText: 'print($0)', detailId: 'Cetak hasil eksekusi Python ke Console', detailEn: 'Print output to Python runner console', kind: 'py', params: [{ name: 'value', type: 'any' }] },
  ],
  sql: [
    { label: 'CREATE TABLE', insertText: 'CREATE TABLE $0 (\n  id INTEGER PRIMARY KEY,\n  nama TEXT NOT NULL,\n  skor INTEGER\n);', detailId: 'Buat skema tabel PostgreSQL baru', detailEn: 'Create PostgreSQL table schema', kind: 'sql' },
    { label: 'INSERT INTO', insertText: "INSERT INTO $0 (id, nama, skor) VALUES (1, 'Budi', 92);", detailId: 'Tambah baris data ke tabel PostgreSQL', detailEn: 'Insert row into PostgreSQL table', kind: 'sql' },
    { label: 'SELECT * FROM', insertText: 'SELECT * FROM $0;', detailId: 'Kueri pembacaan data PostgreSQL', detailEn: 'Query rows from table', kind: 'sql' },
    { label: 'UPDATE SET WHERE', insertText: 'UPDATE $0 SET skor = 95 WHERE id = 1;', detailId: 'Perbarui nilai baris PostgreSQL', detailEn: 'Update rows matching WHERE clause', kind: 'sql' },
  ],
  json: [],
  text: [],
}

function isInsideOpenHtmlTag(beforeCursor: string): boolean {
  const lastLt = beforeCursor.lastIndexOf('<')
  const lastGt = beforeCursor.lastIndexOf('>')
  if (lastLt === -1 || lastGt > lastLt) return false
  const inside = beforeCursor.slice(lastLt + 1)
  return /^[A-Za-z][A-Za-z0-9-]*\s+[^<>]*$/.test(inside)
}

export function getWebDevAutocomplete(
  code: string,
  cursorPos: number,
  fileName: string,
  force = false,
): { replaceStart: number; replaceEnd: number; items: WebDevAcSuggestion[] } | null {
  const lang = detectFileLanguage(fileName)
  const before = code.slice(0, cursorPos)

  if ((lang === 'html' || lang === 'jsx') && isInsideOpenHtmlTag(before)) {
    const attrM = /([A-Za-z-]*)$/.exec(before)
    const prefix = (attrM?.[1] ?? '').toLowerCase()
    if (!force && !prefix) return null
    const items = HTML_ATTR_SUGGESTIONS.filter(
      (a) => !prefix || a.label.toLowerCase().includes(prefix),
    )
    if (items.length === 0) return null
    return {
      replaceStart: cursorPos - prefix.length,
      replaceEnd: cursorPos,
      items: items.slice(0, 8),
    }
  }

  const pool = WEBDEV_SNIPPETS[lang]
  if (!pool || pool.length === 0) return null

  const tokenM = /([<@!A-Za-z_][A-Za-z0-9_.:-]{0,36})$/.exec(before)
  const rawToken = tokenM?.[1] ?? ''
  if (!force && rawToken.length < 1) return null
  if (!force && rawToken.length === 1 && !['<', '@', '!'].includes(rawToken)) {
    // Require 2+ chars for ordinary identifier words, or 1 char when starting `<`, `@`, `!`
    return null
  }

  const prefix = rawToken.toLowerCase()
  const items = !prefix
    ? pool
    : pool.filter(
        (s) =>
          s.label.toLowerCase().includes(prefix) ||
          s.insertText.toLowerCase().startsWith(prefix) ||
          (prefix.startsWith('<') && s.label.toLowerCase().startsWith(prefix)),
      )

  if (items.length === 0) return null
  return {
    replaceStart: cursorPos - rawToken.length,
    replaceEnd: cursorPos,
    items: items.slice(0, 10),
  }
}
