import type { WebDevFile, WebDevMissionSpec } from './types'

export const BLANK_WEBDEV_FILES: WebDevFile[] = [
  {
    name: 'index.html',
    content: `<main class="card">\n  <h1>Blank Canvas Web</h1>\n  <p>Edit index.html dan style.css lalu lihat hasil rendernya di sebelah kanan.</p>\n</main>\n`,
  },
  {
    name: 'style.css',
    content: `.card {\n  padding: 16px;\n  border-radius: 12px;\n  border: 1px solid #cbd5e1;\n  background: #ffffff;\n}\n`,
  },
]

const combinedLower = (files: WebDevFile[]) =>
  files.map((f) => `${f.name}\n${f.content}`).join('\n').toLowerCase()

export const WEBDEV_MISSIONS: WebDevMissionSpec[] = [
  {
    id: 'webdev-p01-http',
    order: 1,
    codeTag: 'P1',
    titleId: 'P1 · Cara Kerja Web & HTTP',
    titleEn: 'P1 · How Web & HTTP Works',
    stackBadge: 'HTML · HTTP Client-Server',
    xp: 50,
    requiredXp: 0,
    prerequisiteId: null,
    objectiveId: 'Pahami alur HTTP Request-Response (GET) dan struktur halaman dasar menggunakan header & tombol uji request.',
    objectiveEn: 'Understand HTTP Request-Response flow with semantic header and interactive button.',
    defaultFocusTab: 'preview',
    starterFiles: [
      {
        name: 'index.html',
        content: `<header class="hero">\n  <h1>Arsitektur Web & HTTP</h1>\n  <span class="badge">HTTP GET /index.html -> 200 OK</span>\n</header>\n<main class="card">\n  <p>Client (Browser) mengirim HTTP Request ke Server, lalu Server membalas dengan dokumen HTML.</p>\n  <button id="http-btn" type="button">Kirim HTTP GET Test</button>\n  <p id="http-status">Status: Menunggu request...</p>\n</main>\n`,
      },
      {
        name: 'style.css',
        content: `.hero {\n  padding: 14px;\n  border-radius: 10px;\n  background: #ecfdf5;\n  margin-bottom: 12px;\n}\n.badge {\n  color: #047857;\n  font-weight: 700;\n}\n.card {\n  padding: 14px;\n  border: 1px solid #cbd5e1;\n  border-radius: 10px;\n}\n`,
      },
      {
        name: 'app.js',
        content: `document.getElementById("http-btn").addEventListener("click", () => {\n  document.getElementById("http-status").textContent = "Status: 200 OK · Response diterima dari server!";\n  console.log("HTTP GET / -> 200 OK");\n});\n`,
      },
    ],
    evaluate: ({ files, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'hdr', labelId: 'Memiliki elemen <header> & HTTP info', labelEn: 'Has <header> & HTTP label', passed: text.includes('<header') && text.includes('http') },
        { id: 'btn', labelId: 'Ada tombol interaktif <button>', labelEn: 'Has interactive <button>', passed: text.includes('<button') },
        { id: 'run', labelId: 'Preview aplikasi Web dijalankan', labelEn: 'Live web preview executed', passed: renderReady },
      ]
    },
  },
  {
    id: 'webdev-p02-html',
    order: 2,
    codeTag: 'P2',
    titleId: 'P2 · Mengenal HTML5 Semantik',
    titleEn: 'P2 · Semantic HTML5 Structure',
    stackBadge: 'HTML5 Semantik',
    xp: 50,
    requiredXp: 50,
    prerequisiteId: 'webdev-p01-http',
    objectiveId: 'Susun struktur halaman menggunakan tag HTML5 semantik (<nav>, <main>, <article>, dan <footer>).',
    objectiveEn: 'Build accessible semantic document layout with <nav>, <main>, <article>, and <footer>.',
    defaultFocusTab: 'preview',
    starterFiles: [
      {
        name: 'index.html',
        content: `<nav class="topnav">\n  <strong>Portal Berita Kampus</strong>\n  <a href="/">Beranda</a>\n  <a href="#artikel">Artikel</a>\n</nav>\n<main class="card">\n  <article>\n    <h1>Mengenal HTML5 Semantik</h1>\n    <p>Tag semantik memberi makna struktur kepada browser dan pembaca layar.</p>\n  </article>\n</main>\n<footer class="foot">\n  <small>Praktikum P2 · Dasar HTML5</small>\n</footer>\n`,
      },
      {
        name: 'style.css',
        content: `.topnav {\n  display: flex;\n  gap: 12px;\n  padding: 10px 14px;\n  background: #f1f5f9;\n  border-radius: 8px;\n  margin-bottom: 10px;\n}\n.card {\n  padding: 14px;\n  border: 1px solid #cbd5e1;\n  border-radius: 8px;\n}\n.foot {\n  margin-top: 10px;\n  color: #64748b;\n}\n`,
      },
    ],
    evaluate: ({ files, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'nav', labelId: 'Tag <nav> & <main> tersedia', labelEn: '<nav> & <main> present', passed: text.includes('<nav') && text.includes('<main') },
        { id: 'art', labelId: 'Memuat <article> & <footer>', labelEn: 'Includes <article> & <footer>', passed: text.includes('<article') && text.includes('<footer') },
        { id: 'run', labelId: 'Hasil render web tampil', labelEn: 'Web rendered cleanly', passed: renderReady },
      ]
    },
  },
  {
    id: 'webdev-p03-css',
    order: 3,
    codeTag: 'P3',
    titleId: 'P3 · Mengenal CSS Flexbox & Tema',
    titleEn: 'P3 · CSS Flexbox & Styling',
    stackBadge: 'CSS3 · Flexbox',
    xp: 60,
    requiredXp: 100,
    prerequisiteId: 'webdev-p02-html',
    objectiveId: 'Terapkan layout Flexbox (`display: flex`), `padding`, dan `border-radius` untuk menata kartu profil Web.',
    objectiveEn: 'Style responsive profile cards using display: flex, padding, and border-radius.',
    defaultFocusTab: 'preview',
    starterFiles: [
      {
        name: 'index.html',
        content: `<main class="flex-row">\n  <section class="profile-card">\n    <h2>Frontend Track</h2>\n    <p>HTML5 + CSS3 Flexbox</p>\n  </section>\n  <section class="profile-card">\n    <h2>Backend Track</h2>\n    <p>Python FastAPI + PostgreSQL</p>\n  </section>\n</main>\n`,
      },
      {
        name: 'style.css',
        content: `.flex-row {\n  display: flex;\n  gap: 12px;\n  flex-wrap: wrap;\n}\n.profile-card {\n  padding: 16px;\n  border-radius: 12px;\n  border: 1px solid #16a34a;\n  background: #f0fdf4;\n}\n`,
      },
    ],
    evaluate: ({ files, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'flex', labelId: 'CSS menggunakan display: flex', labelEn: 'Uses display: flex', passed: text.includes('display') && text.includes('flex') },
        { id: 'box', labelId: 'Mengatur padding & border-radius', labelEn: 'Configures padding & border-radius', passed: text.includes('padding') && text.includes('border-radius') },
        { id: 'run', labelId: 'Preview CSS ter-render', labelEn: 'CSS rendered cleanly', passed: renderReady },
      ]
    },
  },
  {
    id: 'webdev-p04-form-media',
    order: 4,
    codeTag: 'P4',
    titleId: 'P4 · Tabel, Formulir, Layout & Media',
    titleEn: 'P4 · Tables, Forms, Grid Layout & Media',
    stackBadge: 'HTML Forms · CSS Grid',
    xp: 60,
    requiredXp: 160,
    prerequisiteId: 'webdev-p03-css',
    objectiveId: 'Buat daftar nilai menggunakan `<table>`, formulir `<form>` dengan `<input>`, serta tata letak CSS Grid.',
    objectiveEn: 'Build data <table>, interactive <form> with <input>, and CSS Grid layout.',
    defaultFocusTab: 'preview',
    starterFiles: [
      {
        name: 'index.html',
        content: `<main class="layout-grid">\n  <section class="card">\n    <h2>Formulir Registrasi Praktikum</h2>\n    <form id="reg-form">\n      <label>Nama Mahasiswa</label>\n      <input id="nama-input" type="text" placeholder="Contoh: Raka Pratama" />\n      <button id="daftar-btn" type="button">Simpan Data</button>\n    </form>\n    <p id="form-msg">Isi nama lalu klik Simpan Data.</p>\n  </section>\n  <section class="card">\n    <h2>Tabel Kehadiran P4</h2>\n    <table>\n      <thead><tr><th>NIM</th><th>Nama</th><th>Status</th></tr></thead>\n      <tbody><tr><td>12314001</td><td>Rani</td><td>Hadir</td></tr></tbody>\n    </table>\n  </section>\n</main>\n`,
      },
      {
        name: 'style.css',
        content: `.layout-grid {\n  display: grid;\n  grid-template-columns: repeat(2, 1fr);\n  gap: 12px;\n}\n.card {\n  padding: 12px;\n  border: 1px solid #cbd5e1;\n  border-radius: 10px;\n}\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\n`,
      },
      {
        name: 'app.js',
        content: `document.getElementById("daftar-btn").addEventListener("click", () => {\n  document.getElementById("form-msg").textContent = "Data mahasiswa berhasil divalidasi!";\n  console.log("Form P4 submitted");\n});\n`,
      },
    ],
    evaluate: ({ files, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'tbl', labelId: 'Memuat elemen <table> terstruktur', labelEn: 'Has structured <table>', passed: text.includes('<table') },
        { id: 'frm', labelId: 'Ada <form> & <input> interaktif', labelEn: 'Has <form> & <input>', passed: text.includes('<form') && text.includes('<input') },
        { id: 'grd', labelId: 'Layout CSS Grid & preview aktif', labelEn: 'CSS Grid & preview active', passed: text.includes('grid') && renderReady },
      ]
    },
  },
  {
    id: 'webdev-p05-js-dom',
    order: 5,
    codeTag: 'P5',
    titleId: 'P5 · Pemrograman JavaScript & DOM',
    titleEn: 'P5 · JavaScript DOM & Events',
    stackBadge: 'JavaScript DOM',
    xp: 70,
    requiredXp: 220,
    prerequisiteId: 'webdev-p04-form-media',
    objectiveId: 'Gunakan `document.getElementById`, `addEventListener`, dan `console.log` untuk memperbarui DOM saat tombol diklik.',
    objectiveEn: 'Use getElementById, addEventListener, and console.log for dynamic DOM updates.',
    defaultFocusTab: 'preview',
    starterFiles: [
      {
        name: 'index.html',
        content: `<main class="card">\n  <h2>Manipulasi DOM JavaScript</h2>\n  <p id="status-teks">Belum diklik.</p>\n  <button id="toggle-btn" type="button">Ubah Status DOM</button>\n</main>\n`,
      },
      {
        name: 'style.css',
        content: `.card {\n  padding: 16px;\n  border-radius: 10px;\n  border: 1px solid #cbd5e1;\n}\n`,
      },
      {
        name: 'app.js',
        content: `console.log("Script DOM P5 siap dijalankan");\ndocument.getElementById("toggle-btn").addEventListener("click", () => {\n  document.getElementById("status-teks").textContent = "DOM diperbarui oleh JavaScript!";\n  console.log("Button DOM diklik pengguna");\n});\n`,
      },
    ],
    evaluate: ({ files, consoleLines, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'dom', labelId: 'Menggunakan getElementById & addEventListener', labelEn: 'Uses getElementById & addEventListener', passed: text.includes('getelementbyid') && text.includes('addeventlistener') },
        { id: 'log', labelId: 'Output console.log() terekam', labelEn: 'console.log() output captured', passed: text.includes('console.log') && consoleLines.length > 0 },
        { id: 'run', labelId: 'Render Web aktif', labelEn: 'Web preview active', passed: renderReady },
      ]
    },
  },
  {
    id: 'webdev-p06-js-es6',
    order: 6,
    codeTag: 'P6',
    titleId: 'P6 · JavaScript Generasi Baru (ES6+)',
    titleEn: 'P6 · Modern JavaScript (ES6+)',
    stackBadge: 'ES6 · Arrow & Template Literal',
    xp: 70,
    requiredXp: 290,
    prerequisiteId: 'webdev-p05-js-dom',
    objectiveId: 'Implementasikan `const`, arrow function `=>`, `.map()`, dan template literal backtick dalam `app.js`.',
    objectiveEn: 'Apply const, arrow functions (=>), array .map(), and template literals.',
    defaultFocusTab: 'console',
    starterFiles: [
      {
        name: 'index.html',
        content: `<main class="card">\n  <h2>JavaScript ES6+ Modern</h2>\n  <p id="es6-out">Lihat hasil transformasi array pada panel Console.</p>\n</main>\n`,
      },
      {
        name: 'style.css',
        content: `.card { padding: 14px; border: 1px solid #cbd5e1; border-radius: 10px; }\n`,
      },
      {
        name: 'app.js',
        content: `const modulWeb = ["HTML5", "CSS3", "React", "FastAPI"];\nconst formatBadge = (nama) => \`[Modul: \${nama}]\`;\nconst hasil = modulWeb.map((m) => formatBadge(m));\nconsole.log(hasil);\ndocument.getElementById("es6-out").textContent = \`Total ES6 modul siap: \${modulWeb.length}\`;\n`,
      },
    ],
    evaluate: ({ files, consoleLines, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'arrow', labelId: 'Menggunakan const & arrow function =>', labelEn: 'Uses const & arrow function =>', passed: text.includes('const ') && text.includes('=>') },
        { id: 'map', labelId: 'Transformasi array .map() & template backtick', labelEn: 'Array .map() & template literal', passed: text.includes('.map(') && text.includes('`') },
        { id: 'run', labelId: 'Console & render Web berjalan', labelEn: 'Console & preview running', passed: renderReady && consoleLines.length > 0 },
      ]
    },
  },
  {
    id: 'webdev-p07-react',
    order: 7,
    codeTag: 'P7',
    titleId: 'P7 · Kerangka Kerja React JS & State',
    titleEn: 'P7 · React JS Components & useState',
    stackBadge: 'React JSX · Hooks',
    xp: 80,
    requiredXp: 360,
    prerequisiteId: 'webdev-p06-js-es6',
    objectiveId: 'Buat komponen `function App()` di `App.jsx` menggunakan `useState` dan event `onClick` untuk memperbarui state live.',
    objectiveEn: 'Build function App() using React useState and interactive onClick handler.',
    defaultFocusTab: 'preview',
    starterFiles: [
      {
        name: 'App.jsx',
        content: `function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <main class="card">\n      <h2>Komponen React Counter Interaktif</h2>\n      <p>Jumlah klik state saat ini: {count}</p>\n      <button type="button" onClick={() => setCount(count + 1)}>Tambah Counter (+1)</button>\n    </main>\n  );\n}\n`,
      },
      {
        name: 'style.css',
        content: `.card {\n  padding: 16px;\n  border-radius: 12px;\n  border: 1px solid #2563eb;\n  background: #eff6ff;\n}\n`,
      },
    ],
    evaluate: ({ files, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'hook', labelId: 'Deklarasi hook useState & function App()', labelEn: 'Declares useState & function App()', passed: text.includes('usestate') && text.includes('function app') },
        { id: 'evt', labelId: 'Event handler onClick interaktif terpasang', labelEn: 'Interactive onClick handler bound', passed: text.includes('onclick') },
        { id: 'run', labelId: 'Komponen React ter-render', labelEn: 'React component rendered', passed: renderReady },
      ]
    },
  },
  {
    id: 'webdev-p08-uts',
    order: 8,
    codeTag: 'P8',
    titleId: 'P8 · Evaluasi UTS Frontend Terpadu',
    titleEn: 'P8 · Midterm Project: Interactive Frontend',
    stackBadge: 'UTS · HTML + CSS + React',
    xp: 90,
    requiredXp: 440,
    prerequisiteId: 'webdev-p07-react',
    objectiveId: 'Gabungkan HTML semantik (`<main>`), styling CSS (`display`), serta React `useState` dengan `.map()` pada studi kasus daftar tugas.',
    objectiveEn: 'Combine semantic <main>, CSS display layout, React useState, and list rendering.',
    defaultFocusTab: 'preview',
    starterFiles: [
      {
        name: 'App.jsx',
        content: `function App() {\n  const [doneCount, setDoneCount] = useState(1);\n  const topik = ["HTML5", "CSS3", "ES6+", "React Hooks"];\n  return (\n    <main class="card">\n      <h1>Portofolio UTS Pengembangan Web</h1>\n      <p>Materi Dikuasai: {doneCount} / {topik.length}</p>\n      <div class="pill-row">\n        {topik.map((t) => <span class="badge">{t}</span>)}\n      </div>\n      <button type="button" onClick={() => setDoneCount(doneCount + 1)}>Tandai Progres +1</button>\n    </main>\n  );\n}\n`,
      },
      {
        name: 'style.css',
        content: `.card {\n  padding: 16px;\n  border-radius: 12px;\n  border: 1px solid #cbd5e1;\n}\n.pill-row {\n  display: flex;\n  gap: 8px;\n  margin: 10px 0;\n}\n.badge {\n  padding: 4px 10px;\n  border-radius: 999px;\n  background: #dcfce7;\n  color: #166534;\n}\n`,
      },
    ],
    evaluate: ({ files, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'ui', labelId: 'Struktur <main> + layout CSS display', labelEn: '<main> structure + CSS display', passed: text.includes('<main') && text.includes('display') },
        { id: 'react', labelId: 'React useState & render list map()', labelEn: 'React useState & map() list', passed: text.includes('usestate') && text.includes('map(') },
        { id: 'run', labelId: 'Preview UTS aktif', labelEn: 'Midterm preview running', passed: renderReady },
      ]
    },
  },
  {
    id: 'webdev-p09-python',
    order: 9,
    codeTag: 'P9',
    titleId: 'P9 · Dasar Pemrograman Python',
    titleEn: 'P9 · Python Fundamentals for Server',
    stackBadge: 'Python 3',
    xp: 70,
    requiredXp: 530,
    prerequisiteId: 'webdev-p08-uts',
    objectiveId: 'Tulis fungsi `def`, perulangan `for`, dan cetak keluaran dengan `print()` pada file `main.py`.',
    objectiveEn: 'Write def functions, for loops, and print() output in main.py.',
    defaultFocusTab: 'console',
    starterFiles: [
      {
        name: 'main.py',
        content: `def hitung_rata_rata(skor_list):\n    return 88\n\nmodul_backend = ["Python", "OOP", "FastAPI", "PostgreSQL"]\nfor m in modul_backend:\n    print(f"Belajar modul server: {m}")\n\nnilai = hitung_rata_rata([85, 90, 89])\nprint(f"Rata-rata kesiapan backend: {nilai}")\n`,
      },
      {
        name: 'index.html',
        content: `<main class="card">\n  <h2>Runner Python Backend (P9)</h2>\n  <p>Buka tab <strong>Console / Output</strong> untuk memeriksa hasil eksekusi Python.</p>\n</main>\n`,
      },
    ],
    evaluate: ({ files, pythonLines, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'py', labelId: 'Memuat fungsi def, loop for & print()', labelEn: 'Contains def, for loop & print()', passed: text.includes('def ') && text.includes('for ') && text.includes('print(') },
        { id: 'out', labelId: 'Output Python runner tercetak', labelEn: 'Python console output captured', passed: pythonLines.length > 0 && renderReady },
      ]
    },
  },
  {
    id: 'webdev-p10-oop-py',
    order: 10,
    codeTag: 'P10',
    titleId: 'P10 · OOP di Python',
    titleEn: 'P10 · Object-Oriented Python',
    stackBadge: 'Python OOP · Class & Method',
    xp: 70,
    requiredXp: 600,
    prerequisiteId: 'webdev-p09-python',
    objectiveId: 'Definisikan `class` Python dengan konstruktor `def __init__(self, ...)` dan atribut `self.` serta panggil method-nya.',
    objectiveEn: 'Create a Python class with __init__, self attributes, and method invocation.',
    defaultFocusTab: 'console',
    starterFiles: [
      {
        name: 'main.py',
        content: `class MahasiswaWeb:\n    def __init__(self, nama, prodi):\n        self.nama = nama\n        self.prodi = prodi\n\n    def ringkasan(self):\n        return f"{self.nama} ({self.prodi})"\n\nmhs = MahasiswaWeb("Nadia Putri", "Teknik Informatika")\nprint(mhs.ringkasan())\n`,
      },
      {
        name: 'index.html',
        content: `<main class="card">\n  <h2>OOP Python Model (P10)</h2>\n  <p>Lihat instansiasi objek <code>MahasiswaWeb</code> di tab Console.</p>\n</main>\n`,
      },
    ],
    evaluate: ({ files, pythonLines, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'cls', labelId: 'Definisi class & konstruktor __init__', labelEn: 'Class definition & __init__', passed: text.includes('class ') && text.includes('__init__') },
        { id: 'self', labelId: 'Penggunaan atribut self. & output tampil', labelEn: 'Uses self. & prints output', passed: text.includes('self.') && pythonLines.length > 0 && renderReady },
      ]
    },
  },
  {
    id: 'webdev-p11-fastapi',
    order: 11,
    codeTag: 'P11',
    titleId: 'P11 · Kerangka Kerja FastAPI',
    titleEn: 'P11 · FastAPI REST Endpoints',
    stackBadge: 'Python · FastAPI',
    xp: 80,
    requiredXp: 670,
    prerequisiteId: 'webdev-p10-oop-py',
    requiresApiTest: true,
    objectiveId: 'Bangun REST API FastAPI dengan decorator `@app.get` dan `@app.post`, lalu uji endpoint-nya dari tab FastAPI Routes.',
    objectiveEn: 'Define FastAPI @app.get & @app.post routes and test them in the FastAPI tab.',
    defaultFocusTab: 'api',
    starterFiles: [
      {
        name: 'api.py',
        content: `from fastapi import FastAPI\napp = FastAPI()\n\n@app.get("/api/katalog")\ndef list_katalog():\n    return {"status": "ok", "framework": "FastAPI", "total": 2}\n\n@app.post("/api/katalog")\ndef tambah_item():\n    return {"created": True, "item": "Modul FastAPI"}\n`,
      },
      {
        name: 'index.html',
        content: `<main class="card">\n  <h2>Layanan REST API FastAPI (P11)</h2>\n  <p>Gunakan tab <strong>FastAPI Routes</strong> atau address bar di kanan untuk menguji endpoint JSON.</p>\n</main>\n`,
      },
    ],
    evaluate: ({ files, apiRoutes, apiTested, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'fa', labelId: 'Definisi FastAPI app dengan @app.get & @app.post', labelEn: 'FastAPI @app.get & @app.post', passed: text.includes('fastapi') && text.includes('@app.get') && text.includes('@app.post') },
        { id: 'routes', labelId: 'Minimal 2 endpoint terdeteksi', labelEn: 'At least 2 routes detected', passed: apiRoutes.length >= 2 && renderReady },
        { id: 'test', labelId: 'Minimal 1 endpoint diuji lewat tester API', labelEn: 'Tested at least 1 API route', passed: apiTested },
      ]
    },
  },
  {
    id: 'webdev-p12-postgres',
    order: 12,
    codeTag: 'P12',
    titleId: 'P12 · Basis Data PostgreSQL',
    titleEn: 'P12 · PostgreSQL Relational Queries',
    stackBadge: 'SQL · PostgreSQL',
    xp: 80,
    requiredXp: 750,
    prerequisiteId: 'webdev-p11-fastapi',
    requiresSql: true,
    objectiveId: 'Tulis skema `CREATE TABLE`, `INSERT INTO`, dan kueri `SELECT` di `schema.sql`, lalu jalankan ke PostgreSQL Simulator.',
    objectiveEn: 'Author CREATE TABLE, INSERT INTO, and SELECT queries in schema.sql.',
    defaultFocusTab: 'db',
    starterFiles: [
      {
        name: 'schema.sql',
        content: `CREATE TABLE proyek_web (\n  id INTEGER PRIMARY KEY,\n  judul TEXT NOT NULL,\n  teknologi TEXT,\n  skor INTEGER\n);\n\nINSERT INTO proyek_web (id, judul, teknologi, skor) VALUES\n  (1, 'Portal Akademik', 'React + FastAPI', 95),\n  (2, 'Inventaris Lab', 'PostgreSQL + REST', 90);\n\nSELECT * FROM proyek_web WHERE skor >= 90;\n`,
      },
      {
        name: 'index.html',
        content: `<main class="card">\n  <h2>Basis Data PostgreSQL (P12)</h2>\n  <p>Buka tab <strong>PostgreSQL DB</strong> untuk melihat isi tabel dan hasil kueri.</p>\n</main>\n`,
      },
    ],
    evaluate: ({ files, sqlTables, sqlExecuted, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'ddl', labelId: 'Sintaks CREATE TABLE, INSERT INTO & SELECT', labelEn: 'CREATE TABLE, INSERT INTO & SELECT', passed: text.includes('create table') && text.includes('insert into') && text.includes('select ') },
        { id: 'tbl', labelId: 'Tabel & baris berhasil dibuat di PostgreSQL DB', labelEn: 'Tables & rows populated in DB tab', passed: sqlTables.some((t) => t.rows.length > 0) && sqlExecuted && renderReady },
      ]
    },
  },
  {
    id: 'webdev-p13-ai-web',
    order: 13,
    codeTag: 'P13',
    titleId: 'P13 · AI pada Aplikasi Web',
    titleEn: 'P13 · AI Integration in Web Apps',
    stackBadge: 'AI Endpoint · Fetch + FastAPI',
    xp: 90,
    requiredXp: 830,
    prerequisiteId: 'webdev-p12-postgres',
    requiresApiTest: true,
    objectiveId: 'Hubungkan tombol UI Frontend dengan endpoint `@app.post("/api/ai/chat")` melalui `fetch()` dan uji respons AI JSON.',
    objectiveEn: 'Connect Frontend UI fetch() to FastAPI /api/ai/chat endpoint.',
    defaultFocusTab: 'preview',
    starterFiles: [
      {
        name: 'index.html',
        content: `<main class="card">\n  <h2>Asisten AI Aplikasi Web (P13)</h2>\n  <p>Klik tombol di bawah untuk memanggil endpoint <code>POST /api/ai/chat</code>.</p>\n  <button id="ai-ask-btn" type="button">Tanya Endpoint AI (/api/ai/chat)</button>\n  <p id="ai-reply">Belum ada jawaban AI.</p>\n</main>\n`,
      },
      {
        name: 'app.js',
        content: `document.getElementById("ai-ask-btn").addEventListener("click", async () => {\n  const res = await fetch("/api/ai/chat");\n  document.getElementById("ai-reply").textContent = "Respons AI diterima dari FastAPI!";\n  console.log("AI endpoint called");\n});\n`,
      },
      {
        name: 'api.py',
        content: `from fastapi import FastAPI\napp = FastAPI()\n\n@app.post("/api/ai/chat")\ndef ai_chat():\n    return {"model": "assistant-web-sim", "status": "ok"}\n`,
      },
    ],
    evaluate: ({ files, apiTested, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'ai', labelId: 'Memuat endpoint @app.post /api/ai & fetch()', labelEn: '@app.post /api/ai & client fetch()', passed: text.includes('@app.post') && text.includes('/api/ai') && text.includes('fetch(') },
        { id: 'run', labelId: 'Preview & uji request AI berhasil', labelEn: 'Preview & AI endpoint tested', passed: apiTested && renderReady },
      ]
    },
  },
  {
    id: 'webdev-p14-fullstack',
    order: 14,
    codeTag: 'P14–P16',
    titleId: 'P14–P16 · Proyek Full-Stack & Demo',
    titleEn: 'P14–P16 · Full-Stack Client, Server & Demo',
    stackBadge: 'Full-Stack · HTML + JS + FastAPI + PostgreSQL',
    xp: 120,
    requiredXp: 920,
    prerequisiteId: 'webdev-p13-ai-web',
    requiresApiTest: true,
    requiresSql: true,
    objectiveId: 'Integrasikan Frontend (`<main>` & `fetch()`), REST Server FastAPI (`@app.get` & `@app.post`), dan tabel PostgreSQL (`SELECT`) menjadi aplikasi siap presentasi akhir.',
    objectiveEn: 'Combine Frontend fetch(), FastAPI GET/POST routes, and PostgreSQL schema into a complete app.',
    defaultFocusTab: 'preview',
    starterFiles: [
      {
        name: 'index.html',
        content: `<main class="card">\n  <header>\n    <h1>Sistem Manajemen Tugas Akhir Web</h1>\n    <p>Integrasi Client UI + FastAPI Server + Basis Data PostgreSQL</p>\n  </header>\n  <button id="sync-api-btn" type="button">Sinkronkan Data dari FastAPI (/api/tasks)</button>\n  <p id="sync-status">Siap sinkronisasi Server & DB.</p>\n</main>\n`,
      },
      {
        name: 'style.css',
        content: `.card {\n  padding: 16px;\n  border-radius: 12px;\n  border: 1px solid #16a34a;\n}\n`,
      },
      {
        name: 'app.js',
        content: `document.getElementById("sync-api-btn").addEventListener("click", async () => {\n  await fetch("/api/tasks");\n  document.getElementById("sync-status").textContent = "Tersinkron dengan FastAPI & PostgreSQL!";\n  console.log("Fullstack sync /api/tasks OK");\n});\n`,
      },
      {
        name: 'api.py',
        content: `from fastapi import FastAPI\napp = FastAPI()\n\n@app.get("/api/tasks")\ndef get_tasks():\n    return {"service": "FullStack Lab", "status": "healthy"}\n\n@app.post("/api/tasks")\ndef add_task():\n    return {"created": True, "persisted": "postgresql"}\n`,
      },
      {
        name: 'schema.sql',
        content: `CREATE TABLE tasks (\n  id INTEGER PRIMARY KEY,\n  judul TEXT NOT NULL,\n  status TEXT\n);\nINSERT INTO tasks (id, judul, status) VALUES (1, 'Presentasi Akhir Proyek', 'Siap Demo');\nSELECT * FROM tasks;\n`,
      },
    ],
    evaluate: ({ files, apiTested, sqlExecuted, renderReady }) => {
      const text = combinedLower(files)
      return [
        { id: 'fe', labelId: 'UI <main> + client fetch() tersedia', labelEn: 'UI <main> + client fetch()', passed: text.includes('<main') && text.includes('fetch(') },
        { id: 'be', labelId: 'FastAPI @app.get & @app.post terpasang', labelEn: 'FastAPI @app.get & @app.post', passed: text.includes('@app.get') && text.includes('@app.post') },
        { id: 'db', labelId: 'PostgreSQL SELECT & uji API dieksekusi', labelEn: 'PostgreSQL SELECT & API tested', passed: text.includes('select ') && sqlExecuted && apiTested && renderReady },
      ]
    },
  },
]
