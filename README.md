# IFA Lab

Platform simulator pentester dan praktikum keamanan aplikasi web (OWASP Top 10:2025) serta keamanan perangkat IoT untuk mahasiswa, dosen, dan admin.

Frontend React/TypeScript/Vite berada di `Lab-FrontEnd`; backend Rust/Axum dan migrasi PostgreSQL di `Lab-Backend`. Repository: https://github.com/ilhamfiashari/WebLabIFA.

## Menjalankan via Docker Compose (Full-Stack)

Prasyarat: Docker Desktop / Docker Engine dengan Compose v2+.

```sh
# 1. Database development saja (untuk menjalankan backend/frontend lokal):
docker compose up -d postgres

# 2. Seluruh service container (postgres + migrate + backend + frontend):
docker compose --profile app up -d --build
```

Untuk deployment produksi berbasis container, lengkapi `deploy/production.env` (salin dari `deploy/production.env.example`), siapkan role runtime menggunakan `deploy/database-roles.sql`, lalu jalankan:

```sh
POSTGRES_MIGRATOR_PASSWORD=<sandi_kuat> docker compose -f deploy/compose.prod.yaml up -d --build
```

## Menjalankan lokal

Prasyarat: Node 22.23.4 (`nvm use`), Rust stable 1.99+, PostgreSQL 17, dan OAuth client Google development. Jika Docker tersedia, `docker compose up -d postgres` menyiapkan database development di loopback.

```sh
cd Lab-FrontEnd
npm ci
npm run dev
```

Di terminal lain, dari root repo:

```sh
# Edit Lab-Backend/.env secara lokal. Jangan gunakan kredensial production.
cargo run -- migrate
```

Migrasi memakai `MIGRATION_DATABASE_URL`. Setelahnya buat role runtime terpisah dan jalankan grant pada `deploy/database-roles.sql`. Untuk compose lokal, role awal adalah `ifa_migrator` dengan sandi contoh dari compose; buat `ifa_runtime` dengan sandi development melalui psql. Sesuaikan `DATABASE_URL` dan jangan gunakan migrator sebagai runtime production.

```sh
cargo run
```

Buka http://localhost:5173. Daftarkan `http://localhost:5173/api/auth/google/callback` sebagai redirect URI client development. Backend default berada di loopback:3000. `APP_BASE_URL` harus sama persis dengan origin browser, tanpa `/` akhir. Jika port 3000 digunakan aplikasi lain, atur `BIND_ADDR=127.0.0.1:3008` dan jalankan Vite dengan `IFA_API_URL=http://127.0.0.1:3008 npm run dev`.

`tes.env` tidak dimuat atau diubah. `Lab-Backend/.env` dimuat oleh backend saat aplikasi dijalankan dari root maupun folder backend, dan diabaikan Git. Jangan menaruh secret dalam variabel `VITE_*`.

## Pemeriksaan

```sh
cd Lab-FrontEnd
npm run typecheck
npm run lint
npm run build
npm audit
npm run test:e2e
```

Tes UI biasa memakai mock API dan melewati lima tes browser OIDC nyata. Chrome lokal diperlukan; di CI Playwright menginstal Chromium.

```sh
cargo fmt --all --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --release --locked
cargo audit
```

Untuk **tes integrasi lengkap**, sediakan database PostgreSQL khusus yang boleh dimodifikasi. Jangan memakai data pengguna nyata. Harness menjalankan fixture OIDC pada loopback:9090, backend pada loopback:3008, tes database, pengujian token/callback/sesi, lalu Playwright pada loopback:5173. Proses aplikasi/provider dimatikan saat selesai. Kredensial fixture bukan kredensial Google.

```sh
TEST_DATABASE_URL=postgres://USER:PASSWORD@127.0.0.1:5432/ifa_test node scripts/run-local-checks.mjs # pragma: allowlist secret -- placeholder
```

Gunakan environment file/secret store untuk password nyata, jangan menaruhnya di riwayat shell. URL di atas hanya contoh untuk database uji. Issuer lokal hanya diizinkan saat `APP_ENV=test`; production tetap mewajibkan Google.

## Dokumentasi

- [Kebijakan akun mahasiswa, Dosen+Admin, dan Workspace](docs/access-policy.md)
- [Langkah pengaturan Google OAuth dan dua akun yang diizinkan](docs/google-oauth.md)
- [Arsitektur dan keputusan](docs/architecture.md)
- [Threat model dan matriks persyaratan](docs/security.md)
- [Deployment VPS, TLS, backup dan rollback](docs/deployment.md)
- [Hasil verifikasi dan keterbatasan](docs/verification.md)
- [Arah visual dan aset](docs/design.md)
- [OpenAPI 3.1](docs/openapi.json)

Pipeline GitHub Actions tersedia; status lokal, CI dan production dilaporkan terpisah. Deployment menunggu permintaan deployment serta akses VPS, DNS/TLS dan kredensial yang sah. Tidak ada deployment otomatis dari pekerjaan lokal ini.
