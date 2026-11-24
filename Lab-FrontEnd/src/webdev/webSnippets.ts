import { languageForFileName } from '../shared/codemirrorSetup'
import {
  ALL_HTML_TAG_NAMES,
  ALL_SVG_TAG_NAMES,
  HTML_TAG_DESCRIPTIONS,
  HTML_VOID_TAG_SET,
  JSX_REACT_ATTR_SPECS,
} from './webLanguageSpecs'

export type SnippetLanguage = 'html' | 'css' | 'js' | 'jsx' | 'python' | 'sql' | 'json' | 'text'

export interface WebDevAcSuggestion {
  label: string
  insertText: string
  detailId: string
  detailEn: string
  kind: 'tag' | 'attr' | 'css' | 'js' | 'react' | 'py' | 'sql' | 'snip'
  params?: Array<{ name: string; type: string }>
}

const CURATED_HTML_TAG_SNIPPETS: Record<string, { label?: string; insertText: string; params?: Array<{ name: string; type: string }> }> = {
  html: { insertText: '<html lang="id">\n  $0\n</html>' },
  head: { insertText: '<head>\n  <meta charset="UTF-8">\n  <title>$0</title>\n</head>' },
  body: { insertText: '<body>\n  $0\n</body>' },
  meta: { label: '<meta />', insertText: '<meta name="$0" content="" />' },
  link: { label: '<link />', insertText: '<link rel="stylesheet" href="$0" />' },
  header: { insertText: '<header class="$0">\n  \n</header>' },
  nav: { insertText: '<nav class="$0">\n  <a href="/">Beranda</a>\n</nav>' },
  main: { insertText: '<main class="$0">\n  \n</main>' },
  section: { insertText: '<section class="card">\n  <h2>$0</h2>\n  <p></p>\n</section>' },
  article: { insertText: '<article>\n  <h2>$0</h2>\n  <p></p>\n</article>' },
  aside: { insertText: '<aside class="$0">\n  \n</aside>' },
  footer: { insertText: '<footer class="foot">\n  <small>$0</small>\n</footer>' },
  div: { insertText: '<div class="$0"></div>' },
  span: { insertText: '<span class="$0"></span>' },
  button: {
    insertText: '<button id="$0" type="button">Klik</button>',
    params: [{ name: 'id', type: 'string' }, { name: 'type', type: 'button|submit' }],
  },
  form: { insertText: '<form id="app-form">\n  <input id="$0" type="text" placeholder="..." />\n  <button type="submit">Kirim</button>\n</form>' },
  input: {
    label: '<input />',
    insertText: '<input id="$0" type="text" placeholder="Ketik nilai..." />',
    params: [{ name: 'type', type: 'text|number|email' }, { name: 'placeholder', type: 'string' }],
  },
  textarea: { insertText: '<textarea id="$0" rows="4" placeholder="Tulis pesan..."></textarea>' },
  select: { insertText: '<select id="$0">\n  <option value="1">Pilihan 1</option>\n</select>' },
  option: { insertText: '<option value="$0"></option>' },
  label: { insertText: '<label for="$0"></label>' },
  img: { label: '<img />', insertText: '<img src="$0" alt="Deskripsi gambar" />' },
  picture: { insertText: '<picture>\n  <source srcset="$0" type="image/webp" />\n  <img src="" alt="" />\n</picture>' },
  table: { insertText: '<table>\n  <thead>\n    <tr><th>Kolom</th><th>Status</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>$0</td><td>Aktif</td></tr>\n  </tbody>\n</table>' },
  ul: { insertText: '<ul>\n  <li>$0</li>\n</ul>' },
  ol: { insertText: '<ol>\n  <li>$0</li>\n</ol>' },
  a: { insertText: '<a href="$0">Tautan</a>' },
  style: { insertText: '<style>\n  $0\n</style>' },
  script: { insertText: '<script>\n  $0\n</script>' },
  video: { insertText: '<video src="$0" controls></video>' },
  audio: { insertText: '<audio src="$0" controls></audio>' },
  source: { label: '<source />', insertText: '<source src="$0" type="" />' },
  canvas: { insertText: '<canvas id="$0" width="320" height="180"></canvas>' },
  svg: { insertText: '<svg viewBox="0 0 24 24" width="24" height="24">\n  $0\n</svg>' },
  path: { label: '<path />', insertText: '<path d="$0" />' },
  circle: { label: '<circle />', insertText: '<circle cx="$0" cy="12" r="10" />' },
  rect: { label: '<rect />', insertText: '<rect x="$0" y="0" width="24" height="24" />' },
  iframe: { insertText: '<iframe src="$0" title="" loading="lazy"></iframe>' },
  details: { insertText: '<details>\n  <summary>$0</summary>\n  <p></p>\n</details>' },
  dialog: { insertText: '<dialog id="$0">\n  \n</dialog>' },
  figure: { insertText: '<figure>\n  $0\n  <figcaption></figcaption>\n</figure>' },
  fieldset: { insertText: '<fieldset>\n  <legend>$0</legend>\n</fieldset>' },
  progress: { insertText: '<progress value="$0" max="100"></progress>' },
  meter: { insertText: '<meter value="$0" min="0" max="100"></meter>' },
  time: { insertText: '<time datetime="$0"></time>' },
  br: { label: '<br />', insertText: '<br />' },
  hr: { label: '<hr />', insertText: '<hr />' },
  wbr: { label: '<wbr />', insertText: '<wbr />' },
}

function buildAllHtmlTagSuggestions(): WebDevAcSuggestion[] {
  const seen = new Set<string>()
  const list: WebDevAcSuggestion[] = []
  for (const tag of [...ALL_HTML_TAG_NAMES, ...ALL_SVG_TAG_NAMES]) {
    if (seen.has(tag)) continue
    seen.add(tag)
    const curated = CURATED_HTML_TAG_SNIPPETS[tag]
    const isVoid = HTML_VOID_TAG_SET.has(tag)
    const desc = HTML_TAG_DESCRIPTIONS[tag]
    list.push({
      label: curated?.label ?? (isVoid ? `<${tag} />` : `<${tag}>`),
      insertText: curated?.insertText ?? (isVoid ? `<${tag} $0/>` : `<${tag}>$0</${tag}>`),
      detailId: desc?.[0] ?? `Elemen HTML <${tag}>`,
      detailEn: desc?.[1] ?? `HTML <${tag}> element`,
      kind: 'tag',
      params: curated?.params,
    })
  }
  return list
}

export const HTML_TAG_SUGGESTIONS: WebDevAcSuggestion[] = buildAllHtmlTagSuggestions()

export const HTML_BOILERPLATE_SUGGESTION: WebDevAcSuggestion = {
  label: '!html5 (Boilerplate)',
  insertText:
    '<!DOCTYPE html>\n<html lang="id">\n  <head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Halaman Web</title>\n  </head>\n  <body>\n    <main>\n      <h1>$0</h1>\n    </main>\n  </body>\n</html>',
  detailId: 'Dokumen HTML5 lengkap',
  detailEn: 'Complete HTML5 document',
  kind: 'snip',
}

export const HTML_ATTR_SUGGESTIONS: WebDevAcSuggestion[] = JSX_REACT_ATTR_SPECS.map((attr) => ({
  label: attr.label,
  insertText: attr.insertText,
  detailId: attr.detailId,
  detailEn: attr.detailEn,
  kind: 'attr',
}))

export const JS_MEMBER_SUGGESTIONS: Record<string, WebDevAcSuggestion[]> = {
  document: [
    { label: 'getElementById', insertText: 'getElementById("$0")', detailId: 'Cari elemen DOM berdasarkan id', detailEn: 'Find DOM element by id', kind: 'js' },
    { label: 'querySelector', insertText: 'querySelector("$0")', detailId: 'Cari elemen pertama sesuai selector CSS', detailEn: 'Find first element matching CSS selector', kind: 'js' },
    { label: 'querySelectorAll', insertText: 'querySelectorAll("$0")', detailId: 'Cari semua elemen sesuai selector CSS', detailEn: 'Find all elements matching CSS selector', kind: 'js' },
    { label: 'createElement', insertText: 'createElement("$0")', detailId: 'Buat node elemen HTML baru', detailEn: 'Create a new HTML element node', kind: 'js' },
    { label: 'addEventListener', insertText: 'addEventListener("$0", (event) => {\n  \n})', detailId: 'Pasang event listener pada dokumen', detailEn: 'Attach event listener to document', kind: 'js' },
    { label: 'body', insertText: 'body', detailId: 'Elemen <body> dokumen', detailEn: 'Document <body> element', kind: 'js' },
    { label: 'title', insertText: 'title', detailId: 'Judul tab dokumen HTML', detailEn: 'Document title string', kind: 'js' },
    { label: 'documentElement', insertText: 'documentElement', detailId: 'Elemen akar <html>', detailEn: 'Root <html> element', kind: 'js' },
  ],
  window: [
    { label: 'addEventListener', insertText: 'addEventListener("$0", (event) => {\n  \n})', detailId: 'Pasang event listener global (resize, scroll, keydown)', detailEn: 'Attach global window event listener', kind: 'js' },
    { label: 'fetch', insertText: 'fetch("$0")', detailId: 'Kirim HTTP request asinkron', detailEn: 'Send asynchronous HTTP request', kind: 'js' },
    { label: 'setTimeout', insertText: 'setTimeout(() => {\n  $0\n}, 1000)', detailId: 'Jalankan fungsi setelah jeda milidetik', detailEn: 'Run callback after delay in ms', kind: 'js' },
    { label: 'setInterval', insertText: 'setInterval(() => {\n  $0\n}, 1000)', detailId: 'Jalankan fungsi berulang tiap interval', detailEn: 'Run callback repeatedly every interval', kind: 'js' },
    { label: 'localStorage', insertText: 'localStorage', detailId: 'Penyimpanan key-value lokal browser', detailEn: 'Persistent browser key-value storage', kind: 'js' },
    { label: 'location', insertText: 'location', detailId: 'Informasi & navigasi URL halaman', detailEn: 'Current URL and navigation info', kind: 'js' },
    { label: 'requestAnimationFrame', insertText: 'requestAnimationFrame(() => {\n  $0\n})', detailId: 'Jadwalkan frame animasi browser', detailEn: 'Schedule next browser animation frame', kind: 'js' },
  ],
  console: [
    { label: 'log', insertText: 'log($0)', detailId: 'Cetak nilai debug ke Console', detailEn: 'Print debug output to console', kind: 'js' },
    { label: 'warn', insertText: 'warn($0)', detailId: 'Cetak peringatan kuning ke Console', detailEn: 'Print warning message to console', kind: 'js' },
    { label: 'error', insertText: 'error($0)', detailId: 'Cetak pesan kesalahan merah ke Console', detailEn: 'Print error message to console', kind: 'js' },
    { label: 'info', insertText: 'info($0)', detailId: 'Cetak informasi ke Console', detailEn: 'Print info message to console', kind: 'js' },
    { label: 'table', insertText: 'table($0)', detailId: 'Tampilkan array/objek sebagai tabel di Console', detailEn: 'Display array or object as table', kind: 'js' },
  ],
  JSON: [
    { label: 'stringify', insertText: 'stringify($0, null, 2)', detailId: 'Ubah objek JavaScript menjadi teks JSON', detailEn: 'Serialize JS value to JSON string', kind: 'js' },
    { label: 'parse', insertText: 'parse($0)', detailId: 'Urai string JSON menjadi objek JavaScript', detailEn: 'Parse JSON string into JS value', kind: 'js' },
  ],
  Math: [
    { label: 'round', insertText: 'round($0)', detailId: 'Bulatkan ke bilangan bulat terdekat', detailEn: 'Round to nearest integer', kind: 'js' },
    { label: 'floor', insertText: 'floor($0)', detailId: 'Bulatkan ke bawah', detailEn: 'Round down to integer', kind: 'js' },
    { label: 'ceil', insertText: 'ceil($0)', detailId: 'Bulatkan ke atas', detailEn: 'Round up to integer', kind: 'js' },
    { label: 'random', insertText: 'random()', detailId: 'Angka acak rentang 0 sampai < 1', detailEn: 'Random float in [0, 1)', kind: 'js' },
    { label: 'max', insertText: 'max($0)', detailId: 'Nilai maksimum dari argumen', detailEn: 'Largest value of arguments', kind: 'js' },
    { label: 'min', insertText: 'min($0)', detailId: 'Nilai minimum dari argumen', detailEn: 'Smallest value of arguments', kind: 'js' },
    { label: 'abs', insertText: 'abs($0)', detailId: 'Nilai absolut (positif)', detailEn: 'Absolute numeric value', kind: 'js' },
  ],
  localStorage: [
    { label: 'getItem', insertText: 'getItem("$0")', detailId: 'Ambil data tersimpan berdasarkan kunci', detailEn: 'Read stored value by key', kind: 'js' },
    { label: 'setItem', insertText: 'setItem("$0", "")', detailId: 'Simpan pasangan kunci dan nilai string', detailEn: 'Store key-value string pair', kind: 'js' },
    { label: 'removeItem', insertText: 'removeItem("$0")', detailId: 'Hapus satu kunci dari penyimpanan', detailEn: 'Delete key from storage', kind: 'js' },
    { label: 'clear', insertText: 'clear()', detailId: 'Kosongkan seluruh data penyimpanan', detailEn: 'Clear all stored items', kind: 'js' },
  ],
  sessionStorage: [
    { label: 'getItem', insertText: 'getItem("$0")', detailId: 'Ambil data sesi tab berdasarkan kunci', detailEn: 'Read session value by key', kind: 'js' },
    { label: 'setItem', insertText: 'setItem("$0", "")', detailId: 'Simpan data sementara sesi tab', detailEn: 'Store session key-value pair', kind: 'js' },
    { label: 'removeItem', insertText: 'removeItem("$0")', detailId: 'Hapus kunci dari sessionStorage', detailEn: 'Delete key from sessionStorage', kind: 'js' },
  ],
  Object: [
    { label: 'keys', insertText: 'keys($0)', detailId: 'Daftar nama properti objek sebagai array', detailEn: 'Return array of object keys', kind: 'js' },
    { label: 'values', insertText: 'values($0)', detailId: 'Daftar nilai properti objek sebagai array', detailEn: 'Return array of object values', kind: 'js' },
    { label: 'entries', insertText: 'entries($0)', detailId: 'Daftar pasangan [key, value] objek', detailEn: 'Return array of [key, value] pairs', kind: 'js' },
    { label: 'assign', insertText: 'assign({}, $0)', detailId: 'Salin & gabungkan properti objek', detailEn: 'Copy enumerable properties to target', kind: 'js' },
  ],
  Array: [
    { label: 'isArray', insertText: 'isArray($0)', detailId: 'Periksa apakah nilai merupakan Array', detailEn: 'Check whether value is an Array', kind: 'js' },
    { label: 'from', insertText: 'from($0)', detailId: 'Konversi iterable/NodeList menjadi Array', detailEn: 'Create Array from iterable or array-like', kind: 'js' },
  ],
  Promise: [
    { label: 'all', insertText: 'all([$0])', detailId: 'Tunggu seluruh promise selesai paralel', detailEn: 'Await multiple promises in parallel', kind: 'js' },
    { label: 'allSettled', insertText: 'allSettled([$0])', detailId: 'Tunggu semua promise dengan status masing-masing', detailEn: 'Wait for all promises to settle', kind: 'js' },
    { label: 'resolve', insertText: 'resolve($0)', detailId: 'Buat promise yang langsung terpenuhi', detailEn: 'Create a resolved Promise', kind: 'js' },
  ],
  classList: [
    { label: 'add', insertText: 'add("$0")', detailId: 'Tambahkan class CSS pada elemen', detailEn: 'Add CSS class to element', kind: 'js' },
    { label: 'remove', insertText: 'remove("$0")', detailId: 'Hapus class CSS dari elemen', detailEn: 'Remove CSS class from element', kind: 'js' },
    { label: 'toggle', insertText: 'toggle("$0")', detailId: 'Aktif/nonaktifkan class CSS secara bergantian', detailEn: 'Toggle CSS class on element', kind: 'js' },
    { label: 'contains', insertText: 'contains("$0")', detailId: 'Cek apakah elemen memiliki class tertentu', detailEn: 'Check if element has CSS class', kind: 'js' },
  ],
  style: [
    { label: 'color', insertText: 'color = "$0";', detailId: 'Ubah warna teks elemen via JS', detailEn: 'Set inline text color', kind: 'css' },
    { label: 'backgroundColor', insertText: 'backgroundColor = "$0";', detailId: 'Ubah warna latar elemen via JS', detailEn: 'Set inline background color', kind: 'css' },
    { label: 'display', insertText: 'display = "$0";', detailId: 'Ubah mode tampilan (block, flex, none)', detailEn: 'Set inline CSS display', kind: 'css' },
    { label: 'opacity', insertText: 'opacity = "$0";', detailId: 'Ubah transparansi elemen (0 sampai 1)', detailEn: 'Set element opacity', kind: 'css' },
  ],
}

export const JS_COMMON_METHOD_SUGGESTIONS: WebDevAcSuggestion[] = [
  { label: 'addEventListener', insertText: 'addEventListener("$0", () => {\n  \n})', detailId: 'Pasang event listener pada elemen DOM', detailEn: 'Attach event listener to DOM element', kind: 'js' },
  { label: 'textContent', insertText: 'textContent = "$0"', detailId: 'Baca atau ubah teks elemen secara aman', detailEn: 'Read or set safe text content', kind: 'js' },
  { label: 'classList', insertText: 'classList.$0', detailId: 'Kelola daftar class CSS elemen', detailEn: 'Manage element CSS classes', kind: 'js' },
  { label: 'style', insertText: 'style.$0', detailId: 'Akses properti CSS inline elemen', detailEn: 'Access inline CSS style properties', kind: 'js' },
  { label: 'preventDefault', insertText: 'preventDefault()', detailId: 'Cegah aksi bawaan event browser', detailEn: 'Prevent default browser event action', kind: 'js' },
  { label: 'map', insertText: 'map(($0) => )', detailId: 'Transformasi setiap item array ke array baru', detailEn: 'Map array items to a new array', kind: 'js' },
  { label: 'filter', insertText: 'filter(($0) => )', detailId: 'Saring item array sesuai kondisi', detailEn: 'Filter array items matching predicate', kind: 'js' },
  { label: 'forEach', insertText: 'forEach(($0) => {\n  \n})', detailId: 'Iterasi setiap elemen array', detailEn: 'Iterate over each array item', kind: 'js' },
  { label: 'reduce', insertText: 'reduce((acc, cur) => acc + cur, $0)', detailId: 'Reduksi array menjadi satu nilai', detailEn: 'Reduce array items into one value', kind: 'js' },
  { label: 'find', insertText: 'find(($0) => )', detailId: 'Cari elemen pertama yang cocok di array', detailEn: 'Find first matching array element', kind: 'js' },
  { label: 'includes', insertText: 'includes($0)', detailId: 'Cek apakah array/string memuat nilai tertentu', detailEn: 'Check if array or string includes value', kind: 'js' },
  { label: 'json', insertText: 'json()', detailId: 'Urai body HTTP Response menjadi objek JSON', detailEn: 'Parse HTTP Response body as JSON', kind: 'js' },
]

export const CSS_BLOCK_SNIPPETS: WebDevAcSuggestion[] = [
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
  { label: 'box-shadow: 0 2px 8px;', insertText: 'box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);', detailId: 'Efek bayangan kartu modern', detailEn: 'Subtle card shadow', kind: 'css' },
  { label: 'font-size: 16px;', insertText: 'font-size: $0px;', detailId: 'Ukuran font teks', detailEn: 'Text font size', kind: 'css' },
  { label: 'font-weight: 700;', insertText: 'font-weight: 700;', detailId: 'Ketebalan huruf teks', detailEn: 'Font weight boldness', kind: 'css' },
  { label: 'position: relative;', insertText: 'position: $0;', detailId: 'Mode posisi elemen (relative, absolute, sticky)', detailEn: 'Element positioning mode', kind: 'css' },
  { label: 'transition: all 0.2s ease;', insertText: 'transition: $0 0.2s ease;', detailId: 'Animasi transisi properti CSS', detailEn: 'Smooth CSS property transition', kind: 'css' },
  { label: 'max-width: 960px;', insertText: 'max-width: $0px;', detailId: 'Lebar maksimum wadah responsif', detailEn: 'Responsive max container width', kind: 'css' },
]

export const CSS_TOP_LEVEL_SNIPPETS: WebDevAcSuggestion[] = [
  { label: '@media (max-width: 768px)', insertText: '@media (max-width: 768px) {\n  $0\n}', detailId: 'Media query responsif layar mobile/tablet', detailEn: 'Responsive viewport media query', kind: 'css' },
  { label: '@container (min-width: 480px)', insertText: '@container (min-width: 480px) {\n  $0\n}', detailId: 'Container query responsif berbasis komponen', detailEn: 'Component-level container query', kind: 'css' },
  { label: '@keyframes fadeIn', insertText: '@keyframes $0 {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}', detailId: 'Definisi animasi keyframe CSS3', detailEn: 'CSS3 keyframe animation', kind: 'css' },
  { label: '@layer base', insertText: '@layer $0 {\n  \n}', detailId: 'Cascade layer CSS modern', detailEn: 'Modern CSS cascade layer', kind: 'css' },
  { label: '@supports (display: grid)', insertText: '@supports ($0) {\n  \n}', detailId: 'Feature query dukungan fitur CSS', detailEn: 'CSS feature support query', kind: 'css' },
  { label: ':root { --brand: ... }', insertText: ':root {\n  --$0: #0284c7;\n}', detailId: 'Deklarasi variabel kustom CSS (--var)', detailEn: 'CSS custom properties declaration', kind: 'css' },
]

export const JS_SNIPPETS: WebDevAcSuggestion[] = [
  { label: 'document.getElementById', insertText: 'document.getElementById("$0")', detailId: 'Ambil elemen DOM berdasarkan atribut id', detailEn: 'Select DOM element by id', kind: 'js', params: [{ name: 'id', type: 'string' }] },
  { label: 'document.querySelector', insertText: 'document.querySelector("$0")', detailId: 'Ambil elemen DOM pertama sesuai selector CSS', detailEn: 'Select first DOM element by CSS selector', kind: 'js', params: [{ name: 'selector', type: 'string' }] },
  { label: 'document.querySelectorAll', insertText: 'document.querySelectorAll("$0")', detailId: 'Ambil seluruh elemen sesuai selector CSS', detailEn: 'Select all matching DOM elements', kind: 'js', params: [{ name: 'selector', type: 'string' }] },
  { label: 'document.createElement', insertText: 'const el = document.createElement("$0");', detailId: 'Buat elemen HTML baru secara dinamis', detailEn: 'Dynamically create an HTML element', kind: 'js' },
  { label: 'addEventListener', insertText: 'addEventListener("click", () => {\n  $0\n});', detailId: 'Pasang pendengar event interaktif DOM', detailEn: 'Attach click event listener', kind: 'js', params: [{ name: 'event', type: 'click|submit' }, { name: 'handler', type: '() => void' }] },
  { label: 'console.log', insertText: 'console.log($0);', detailId: 'Cetak output debug ke panel Console', detailEn: 'Print debug output to console', kind: 'js', params: [{ name: 'value', type: 'any' }] },
  { label: 'fetch("/api/...")', insertText: 'const res = await fetch("$0");\nconst data = await res.json();\nconsole.log(data);', detailId: 'Panggil endpoint REST API & baca JSON', detailEn: 'Call REST API endpoint and parse JSON', kind: 'js', params: [{ name: 'url', type: 'string' }] },
  { label: 'async function', insertText: 'async function $0() {\n  try {\n    \n  } catch (err) {\n    console.error(err);\n  }\n}', detailId: 'Fungsi asinkron ES6 dengan try/catch', detailEn: 'Async function with try/catch block', kind: 'js' },
  { label: 'try / catch', insertText: 'try {\n  $0\n} catch (err) {\n  console.error(err);\n}', detailId: 'Blok penanganan error JavaScript', detailEn: 'Error handling try/catch block', kind: 'js' },
  { label: 'const arrowFn = () =>', insertText: 'const $0 = () => {\n  return ;\n};', detailId: 'Deklarasi fungsi panah ES6 modern', detailEn: 'Modern ES6 arrow function', kind: 'js' },
]

export const REACT_COMPONENT_SNIPPETS: WebDevAcSuggestion[] = [
  { label: 'function App()', insertText: 'function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <main className="card">\n      <h2>React Counter: {count}</h2>\n      <button type="button" onClick={() => setCount(count + 1)}>Tambah (+1)</button>\n    </main>\n  );\n}', detailId: 'Kerangka komponen utama React dengan state', detailEn: 'Stateful React App component', kind: 'react' },
]

const WEBDEV_SNIPPETS: Record<SnippetLanguage, WebDevAcSuggestion[]> = {
  html: [...HTML_TAG_SUGGESTIONS, HTML_BOILERPLATE_SUGGESTION],
  css: [...CSS_BLOCK_SNIPPETS, ...CSS_TOP_LEVEL_SNIPPETS],
  js: JS_SNIPPETS,
  jsx: [...HTML_TAG_SUGGESTIONS, ...JS_SNIPPETS, ...REACT_COMPONENT_SNIPPETS],
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

export function snippetLanguageForFile(fileName: string): SnippetLanguage {
  const grammar = languageForFileName(fileName)
  if (grammar === 'javascript' || grammar === 'typescript') return 'js'
  if (grammar === 'tsx') return 'jsx'
  if (grammar === 'cpp' || grammar === 'plain') return 'text'
  return grammar
}

export function getWebDevAutocomplete(
  code: string,
  cursorPos: number,
  fileName: string,
  force = false,
  langOverride?: SnippetLanguage,
): { replaceStart: number; replaceEnd: number; items: WebDevAcSuggestion[] } | null {
  const lang = langOverride ?? snippetLanguageForFile(fileName)
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
      items: items.slice(0, 20),
    }
  }

  const pool = WEBDEV_SNIPPETS[lang]
  if (!pool || pool.length === 0) return null

  const tokenM = /([<@!:.A-Za-z_][A-Za-z0-9_.:-]{0,36})$/.exec(before)
  const rawToken = tokenM?.[1] ?? ''
  if (!force && rawToken.length < 1) return null
  if (!force && rawToken.length === 1 && !['<', '@', '!'].includes(rawToken)) {
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
    items: items.slice(0, 20),
  }
}
