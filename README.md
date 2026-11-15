# WebLabIFA (IFA Lab)

Platform pembelajaran keamanan web dan Internet of Things (IoT) berbasis eksperimen terbimbing untuk perkuliahan Informatika. Aplikasi ini dirancang dengan prinsip *secure-by-design*, pemisahan peran (*role-based access control*), simulator interaktif terisolasi, serta pemantauan keamanan akun dan sesi secara real-time.

---

## Gambaran Umum Aplikasi

WebLabIFA menyediakan lingkungan praktikum aman (*sandboxed laboratory*) yang memisahkan peran **Mahasiswa**, **Dosen**, dan **Admin**:

- **Portal Mahasiswa (`/lab`)**:
  - **Keamanan Web & OWASP Simulator**: Modul eksperimen bertingkat (Pahami → Uji Celah → Perbaiki → Verifikasi → Refleksi) dengan visualisasi skenario interaktif, peta *trust boundary*, petunjuk bertahap, serta penjelasan maksud soal dan pembahasan perbaikan.
  - **IoT Studio**: Simulasi keamanan perangkat tertanam (*embedded*), autentikasi MQTT/API, dan analisis kerentanan firmware secara terkontrol.
  - **Tugas, Progres & Peringkat**: Daftar penugasan dari dosen, grafik animasi progres kompetensi OWASP, lencana pencapaian, serta papan peringkat (*leaderboard*) kelas.
  - **Notifikasi Email & Kotak Masuk**: Pemberitahuan otomatis untuk penugasan baru, umpan balik dosen, dan peringatan aktivitas keamanan akun.
- **Portal Dosen (`/lab/dosen`)**:
  - **Mode Simulator Tanpa Kunci**: Akses langsung ke seluruh tingkat modul simulator disertai mode presentasi di kelas.
  - **Manajemen Kelas, Penugasan & Umpan Balik**: Pembuatan tugas berbatas waktu (otomatis memicu notifikasi mahasiswa), peninjauan sesi kerja mahasiswa, pemberian umpan balik, serta ekspor rekap CSV.
  - **Analitik & Leaderboard Kelas**: Grafik distribusi penguasaan materi dan peringkat mahasiswa terfilter per kelas.
- **Portal Admin (`/lab/admin`)**:
  - **Tata Kelola Pengguna, Kelas & Katalog Modul**: Pengelolaan status aktif akun, kelas, dan siklus publikasi modul praktikum (`Draft` → `Review` → `Terbit`).
  - **Pemantauan Sesi, Posisi & Anomali Keamanan**: Pemantauan sesi aktif secara langsung (*IP/device/location/rute aktif*), log aktivitas setiap pengguna, deteksi anomali login/perangkat/lokasi, serta pencabutan sesi instan.
- **Pengaturan Keamanan Akun (Semua Peran)**:
  - Manajemen email utama dan email notifikasi cadangan serta preferensi notifikasi email.
  - **Multi-Factor Authentication (MFA)**: Dukungan aplikasi Authenticator (**TOTP RFC 6238**), **Passkeys (WebAuthn / FIDO2)**, dan **Backup Codes** sekali pakai.
  - Manajemen mandiri seluruh sesi dan perangkat aktif.

---

## Struktur Proyek

```text
WebLabIFA/
├── Lab-FrontEnd/                   # Aplikasi web React + TypeScript + Vite
│   ├── src/
│   │   ├── admin/                  # Antarmuka Admin (pengguna, kelas, katalog, monitor keamanan)
│   │   ├── lecturer/               # Antarmuka Dosen (penugasan, leaderboard, ekspor, penilaian)
│   │   ├── student/                # Antarmuka Mahasiswa (dashboard, progres, peringkat, riwayat)
│   │   ├── simulator/              # Engine UI simulator, peta trust boundary & skenario visual SVG
│   │   ├── portal/                 # Shell aplikasi, topbar notifikasi, switcher peran, guard rute
│   │   └── shared/                 # Komponen bersama (i18n ID/EN, error views, pengaturan MFA & akun)
│   ├── tests/                      # Pengujian end-to-end Playwright
│   └── Dockerfile                  # Container frontend (build Vite + unprivileged Nginx)
│
├── Lab-Backend/                    # API Server Rust (Axum + SQLx + PostgreSQL)
│   ├── migrations/                 # Skema migrasi database SQL terversi (0001 s.d. 0007+)
│   ├── src/
│   │   ├── main.rs                 # Entrypoint server, migrator CLI, dan pembersih sesi periodik
│   │   ├── lib.rs                  # Router HTTP, middleware keamanan, alur OIDC & manajemen sesi
│   │   ├── config.rs               # Validasi konfigurasi lingkungan secara fail-closed
│   │   ├── portal/                 # Handler peran mahasiswa, dosen, admin, dan audit
│   │   ├── security_account.rs     # Pengaturan MFA (TOTP, Passkey, Backup Codes), notifikasi & monitor anomali
│   │   └── simulator/              # Katalog skenario, mesin evaluasi payload, dan sandbox terisolasi
│   ├── tests/                      # Uji integrasi backend & autentikasi
│   └── Dockerfile                  # Multi-stage build Rust & runtime non-root distroless/minimal
│
├── deploy/                         # Orkestrasi produksi & konfigurasi reverse proxy
│   ├── compose.prod.yaml           # Definisi stack container produksi
│   ├── nginx.conf                  # Header keamanan HTTP & reverse proxy
│   ├── nginx-container.conf        # Konfigurasi Nginx internal untuk container frontend
│   ├── database-roles.sql          # Prinsip least-privilege untuk role migrasi & runtime DB
│   └── production.env.example      # Contoh variabel lingkungan produksi (tanpa kredensial)
│
├── security/                       # Aturan & konfigurasi pemindaian keamanan otomatis
│   ├── semgrep/                    # Aturan SAST kustom
│   ├── dast/                       # Konfigurasi pemindaian DAST (OWASP ZAP)
│   └── .secrets.baseline           # Baseline deteksi kredensial agar repo bebas rahasia
│
├── docs/                           # Dokumentasi kebijakan akses, arsitektur, dan panduan deploy
├── .github/workflows/              # Pipeline CI/CD, SAST, SCA, container scan, dan DAST
├── compose.yaml                    # Orkestrasi container penuh untuk pengembangan lokal
└── README.md
```

---

## Arsitektur Keamanan & Isolasi

WebLabIFA dirancang agar tetap aman saat kode sumber tersedia secara publik (*open-source / public repository*):

1. **Zero Secrets in Repository**: Tidak ada API key, client secret, koneksi database produksi, atau token sesi yang disimpan di dalam kode maupun riwayat commit. Seluruh konfigurasi sensitif disuntikkan melalui variabel lingkungan server saat *runtime*.
2. **Autentikasi Terfederasi & Fail-Closed**: Login menggunakan OpenID Connect (OIDC) dengan *Authorization Code Flow* + PKCE (`S256`), verifikasi ketat `issuer`, `audience`, `nonce`, `email_verified`, dan pembatasan peran dari sisi server.
3. **Sesi & Proteksi Mutasi**: Token sesi disimpan sebagai hash kriptografis satu arah (*opaque cookie* `HttpOnly`, `SameSite=Lax`, `Secure` di HTTPS), disertai rotasi token saat peralihan peran dan verifikasi `Origin` + `X-CSRF-Token` pada seluruh permintaan mutasi.
4. **MFA & Pemantauan Anomali**: Dukungan TOTP, Passkey, backup codes ter-hash SHA-256, pencatatan telemetri sesi (*IP, perangkat, lokasi, posisi rute*), serta peringatan otomatis ketika terjadi anomali login atau perangkat baru.
5. **Keamanan Simulator**: Seluruh skenario praktikum (seperti injeksi, kontrol akses, dan kesalahan konfigurasi) disimulasikan melalui *state machine* terisolasi di aplikasi tanpa mengeksekusi payload mentah terhadap database portal utama atau host OS.
6. **Container & Supply Chain Hardening**: Image Docker frontend dan backend berjalan sebagai pengguna *non-root*, dilengkapi pemindaian SAST, DAST, audit dependensi, dan pemindaian kerentanan container.

---

## Menjalankan Secara Lokal

### Opsi 1: Full Stack Docker Compose (Direkomendasikan)

1. Siapkan file environment dari template:
   ```bash
   cp Lab-Backend/.env.example Lab-Backend/.env
   ```
   Isi kredensial OIDC pengembangan lokal dan konfigurasi database Anda di `Lab-Backend/.env` (file `.env` diabaikan oleh Git).
2. Jalankan PostgreSQL, migrasi skema, backend, dan frontend dalam container:
   ```bash
   docker compose --profile app up -d --build
   ```
3. Akses portal di `http://localhost:5173` (atau port Nginx/frontend yang dikonfigurasi).

### Opsi 2: Pengembangan Manual (PostgreSQL Container + Cargo + Vite)

1. Jalankan PostgreSQL dan eksekusi migrasi serta seed data contoh:
   ```bash
   docker compose up -d postgres
   cargo run --manifest-path Lab-Backend/Cargo.toml -- migrate
   cargo run --manifest-path Lab-Backend/Cargo.toml -- seed
   ```
2. Jalankan backend dan frontend di terminal terpisah:
   ```bash
   cargo run --manifest-path Lab-Backend/Cargo.toml
   npm --prefix Lab-FrontEnd install
   npm --prefix Lab-FrontEnd run dev
   ```

---

## Verifikasi & Pengujian

```bash
# Backend Rust (formatting, linter ketat, unit & integration tests)
cargo fmt --manifest-path Lab-Backend/Cargo.toml --check
cargo clippy --manifest-path Lab-Backend/Cargo.toml --locked --all-targets -- -D warnings
cargo test --manifest-path Lab-Backend/Cargo.toml --locked

# Frontend React/TypeScript (typecheck, ESLint, production build)
npm --prefix Lab-FrontEnd run typecheck
npm --prefix Lab-FrontEnd run lint
npm --prefix Lab-FrontEnd run build
```

Pengujian end-to-end berbasis Playwright tersedia di `Lab-FrontEnd/tests/`.
