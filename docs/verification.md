# Hasil verifikasi Fase 1

Tanggal: 14 November 2026, Asia/Jakarta. Hasil berikut berasal dari mesin lokal, bukan GitHub Actions, staging, atau production. Lingkungan: Node 22.23.4, Rust 1.99.1, PostgreSQL 17.6 terisolasi di loopback:55432, Chrome lokal. `Lab-Backend/tes.env` dipertahankan dan diabaikan Git; pengujian tidak memuat file tersebut sebagai konfigurasi.

## Pemeriksaan yang dijalankan

Verifikasi Google lokal: callback akun institusi yang sah menghasilkan claim hd terverifikasi `if.itera.ac.id`. Konfigurasi localhost sudah diisi dari nilai tersebut; percobaan awal ditolak sesuai fail-closed saat konfigurasi masih kosong. Login mahasiswa Google nyata dan kesamaan domain Workspace mahasiswa belum dibuktikan. Tidak ada ID token atau kredensial yang disimpan dalam laporan.

Pembaruan kebijakan mahasiswa, 15 November 2026: lima tes Rust biasa, tiga tes integrasi PostgreSQL opt-in, tes HTTP OIDC, serta 18/18 tes browser lulus pada database terpisah `ifa_policy_test`. Cakupan baru: pola NIM ASCII exact, kode prodi/alias/domain salah, hd hilang/salah, email belum terverifikasi, binding subject akun istimewa, role Dosen+Admin, larangan eskalasi mahasiswa, rotasi cookie/CSRF, serta grant dicabut tidak dipulihkan saat login. Clippy lulus. Nilai Workspace ITERA nyata masih menunggu login institusi sah; domain fixture `itera.test` tidak digunakan sebagai konfigurasi production. Migrasi localhost diterapkan dan mencabut sesi lama. Beranda masih shell sesi, bukan dashboard Fase 2A.

Pembaruan kontrol akun nonaktif, 15 November 2026: empat tes Rust biasa, tiga tes integrasi PostgreSQL/OIDC opt-in, dan Clippy lulus. Tidak ada akun nyata yang diubah statusnya. Migrasi menambahkan status aktif dan pencabutan semua sesi saat deaktivasi. Tes callback memverifikasi akun nonaktif tetap nonaktif setelah percobaan login, akun yang diaktifkan dapat login kembali, dan cookie lama tetap ditolak setelah aktivasi ulang. Perubahan backend ini tidak mengubah antarmuka; tes browser sebelumnya tidak dijalankan ulang.

Pembaruan 15 November 2026: pembatasan dua email production telah diverifikasi lokal. Empat tes Rust biasa dan dua tes PostgreSQL opt-in lulus; tes HTTP OIDC mencakup penolakan akun di luar allowlist; 16/16 tes browser lulus (13 UI dan 3 OIDC lokal). Tes PostgreSQL memastikan sesi akun di luar allowlist dicabut. Clippy, lint, build frontend dengan Node 22.23.4, dan build debug backend lulus. Integrasi Google nyata tetap belum diuji. Hasil scanner/audit dan build release di tabel berikut berasal dari pemeriksaan 14 November, bukan pemindaian ulang pada pembaruan ini.

| Pemeriksaan | Hasil | Bukti / cakupan |
| --- | --- | --- |
| Frontend TypeScript strict | lulus | `npm run typecheck` |
| Frontend ESLint | lulus | `npm run lint` |
| Build frontend | lulus | Vite production build; JS awal sekitar 95 KB gzip, CSS sekitar 4,3 KB gzip; font dan hero terpisah |
| Rust formatting | lulus | `cargo fmt --all --check` |
| Rust Clippy | lulus | `cargo clippy --locked --all-targets -- -D warnings` |
| Build release Rust | lulus | `cargo build --release --locked`, binary macOS lokal; bukan artefak VPS Linux |
| Cookie production/development | lulus | 1 tes unit: prefix host, Secure, HttpOnly, Lax, Path, tanpa Domain, TTL dan penghapusan |
| Router dan validasi konfigurasi | lulus | 2 tes: anonymous/unknown route, no-store, request ID, origin logout; production menolak domain/provider salah |
| Integrasi PostgreSQL | lulus | 2 tes opt-in: idle/absolute expiry, CSRF, logout/revoke, konsumsi transaksi paralel dan transaksi OIDC kedaluwarsa |
| OIDC lokal / HTTP | lulus | sukses, batal, nonce/audience/issuer/expiry/signature salah, missing/wrong state, cookie binding, replay, rotasi sesi, pencabutan, dua akun terpisah |
| Browser | 14/14 lulus | 12 tes UI dengan mock API dan 2 tes alur OIDC nyata melalui backend/PostgreSQL lokal |
| Responsif | lulus | 360/390/768/1440 px, tanpa horizontal overflow, CTA ≥44 px, font termuat dan logo tidak rusak |
| Inspeksi desain Chrome | 0 FAIL, 1 WARN | warning ukuran judul login 37 px; dipertahankan sebagai judul utama layar masuk. Teks pendukung diperbesar dan grup login ponsel dipindah ke atas |
| Semgrep rule tests | 3/3 lulus | `semgrep --test security`, fixture positif/negatif untuk raw HTML, proses sistem, SQL format |
| Semgrep kode runtime | lulus, 0 temuan | 3 rule pada 9 target Rust/TypeScript; ini cakupan rule proyek, bukan audit menyeluruh |
| Secret scanning | lulus | detect-secrets 1.5.0 pada berkas proyek eligible Git; kredensial dummy/placeholder diberi anotasi setempat, file lokal yang diabaikan Git dikecualikan |
| npm audit | lulus, 0 kerentanan | dependensi minimatch pada tooling diperbarui melalui override; lint/typecheck/build/browser diverifikasi sesudahnya |
| cargo audit | **gagal: 2 advisori** | `RUSTSEC-2023-0071` pada rsa; `RUSTSEC-2026-0459` pada dependensi SQLite opsional di lockfile. Rincian paparan di `security.md`; tidak ada ignore/pengecualian otomatis |

Harness lengkap: `TEST_DATABASE_URL=... node scripts/run-local-checks.mjs`. Tiga tes database saat ini ditandai ignored pada `cargo test` biasa dan dijalankan eksplisit oleh harness/CI. Jangan menghitung status ignored sebagai lulus tanpa menjalankan harness.

## Screenshot

- [Login desktop 1440 px](screenshots/login-1440.png)
- [Login tablet 768 px](screenshots/login-768.png)
- [Login ponsel 390 px](screenshots/login-390.png)
- [Login ponsel 360 px](screenshots/login-360.png)
- [Halaman sesi melalui OIDC lokal](screenshots/lab-oidc-local.png)
- [Fixture UI pengujian escaping](screenshots/lab-session-fixture.png)

Data Rani/Bima dan alamat `example.test` adalah fixture pengujian. Screenshot sesi lokal tidak membuktikan integrasi Google production.

## Belum diverifikasi

- GitHub Actions belum dipicu dari perubahan ini. Workflow CI tersedia dengan action SHA, scanner versi terkunci, tes PostgreSQL/OIDC/browser, SAST/SCA, secret scanning dan pembuatan SBOM. Audit Rust saat ini akan memblokir status hijau.
- Workflow DAST pasif manual dan Automation Framework tersedia. Browser diarahkan melalui ZAP, dan pemeriksaan menolak hasil tanpa respons `/api/me` terautentikasi. Docker daemon lokal tidak berjalan, sehingga workflow ZAP, image tag/add-on, laporan dan cakupan terautentikasinya belum diuji. Jangan menandai DAST selesai hanya karena YAML tersedia. Tidak ada active scan atau scan domain production.
- Google production: kredensial, consent, redirect URI, cookie HTTPS dan smoke test belum diverifikasi. Kredensial pribadi tidak dipakai untuk pengujian lokal ini.
- DNS, TLS, sertifikat renewal, Nginx/systemd di VPS, role PostgreSQL runtime minimum di server, serta staging setara production belum diuji.
- Uji beban 40 mahasiswa, p95 ≤500 ms, RAM 1 GB, backup/restore dan RPO/RTO belum diukur.
- Matriks dua akun × dua kelas dan isolasi praktikum menunggu endpoint kelas/lab pada Fase 2.

Status: fondasi Fase 1 dapat dijalankan dan ditinjau lokal; **belum siap rilis production** sampai advisori dan pemeriksaan eksternal di atas dituntaskan.
