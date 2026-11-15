# Deployment VPS

Target: `https://lab.ilhamfirmanashari.my.id`, VPS awal 1 vCPU/1 GB/20 GB. Deployment belum dijalankan. Gunakan artefak dari commit yang sama dengan bukti pemeriksaan; jangan build Rust release pada VPS 1 GB.

1. Sediakan akun layanan `ifa`, Nginx, PostgreSQL dan direktori `/srv/ifa/releases/<commit>`. Salin frontend dist dan binary Linux release yang dibangun pada runner Linux sesuai arsitektur VPS. Binary macOS lokal tidak dapat digunakan di VPS Linux.
2. Arahkan DNS A ke IPv4 VPS. Tambahkan AAAA hanya jika IPv6 benar-benar dikonfigurasi dan dapat menjangkau HTTPS. Buka 80/443 publik; PostgreSQL 5432 dan Axum 3000 hanya loopback. Batasi SSH sesuai jalur operator.
3. Aktifkan konfigurasi HTTP ACME terlebih dahulu, mintakan sertifikat untuk domain dengan Certbot/webroot `/var/www/acme`, dan verifikasi HTTPS. Setelah sertifikat ada, pasang `deploy/nginx.conf` pada http include serta `deploy/ifa-proxy.conf` ke `/etc/nginx/snippets/ifa-proxy.conf`. Jalankan `nginx -t` sebelum reload. HSTS hanya diaktifkan setelah HTTPS dan sertifikat valid.
4. Ikuti [langkah Google OAuth](google-oauth.md). Buat Web application client production terpisah dari development, Audience External, dan test users yang memenuhi kebijakan. Authorized Redirect URI harus persis `https://lab.ilhamfirmanashari.my.id/api/auth/google/callback`. Isi `ALLOWED_EMAILS` akun istimewa persis seperti contoh production dan `ITERA_WORKSPACE_DOMAIN` dari claim institusi terverifikasi. Uji kedua akun Dosen+Admin, mahasiswa valid, serta penolakan akun yang tidak memenuhi aturan sebelum rilis.
5. Simpan environment dari `deploy/production.env.example` sebagai `/etc/ifa/runtime.env`, owner root:ifa, mode 0640. Isi kredensial nyata hanya di server. Isi `SUPPORT_EMAIL` dengan kontak yang benar. Jangan memasukkan file ini ke Git atau artifact.
6. Buat role migrasi dan runtime terpisah dengan password melalui input interaktif. Buat database milik migrator. Jalankan binary `migrate` dengan `MIGRATION_DATABASE_URL` hanya pada job/operator migrasi. Jalankan `deploy/database-roles.sql` pada database tersebut setelah migrasi. Runtime tidak memerlukan akses DDL atau tabel migrasi. Untuk database remote gunakan jaringan privat dan `sslmode=verify-full`.
7. Mulai dengan PostgreSQL `max_connections=20`, `shared_buffers=128MB`, `work_mem=2MB`. Ini titik awal pengukuran, bukan kapasitas terjamin. Uji pool wait/lock/WAL/disk/RAM sebelum kelas 40 mahasiswa.
8. Arahkan `/srv/ifa/current` secara atomik ke release, pasang systemd unit dan jalankan layanan non-root. Tinjau `journalctl -u ifa-lab` untuk event aman tanpa query callback. Reload Nginx.
9. Smoke test: login Google nyata → `/lab` → refresh → logout → `/api/me` 401; coba pembatalan; pastikan cookie `__Host-ifa_session` Secure/HttpOnly/Lax/Path=/ tanpa Domain. Periksa no-store, CSP, sertifikat, callback URI, peran mahasiswa, email bantuan, dan log tanpa code/state. Uji ukuran 360/390/768/1440 pada origin HTTPS.

## Sertifikat dan log

Aktifkan timer pembaruan Certbot, uji `certbot renew --dry-run`, dan reload Nginx melalui deploy hook. Pantau tanggal kedaluwarsa sertifikat. Access log menggunakan `$uri`, bukan `$request` atau `$request_uri`. Callback error log dimatikan untuk menghindari query code/state. Log aplikasi tidak mencatat URI. Tentukan retensi log/journal, akses operator dan rotasi di staging sebelum rilis.

## Backup dan restore

Tetapkan RPO/RTO bersama pengelola; usulan awal RPO 24 jam dan RTO 4 jam belum merupakan kesepakatan. Jalankan `pg_dump -Fc` melalui akun backup ke berkas di direktori operator berizin 0700, enkripsi memakai alat organisasi, lalu kirim ke penyimpanan di luar VPS. Jangan simpan backup dalam repo. Dokumentasikan jadwal dan retensi yang disetujui.

Pulihkan backup terenkripsi ke PostgreSQL uji terpisah dengan `pg_restore --no-owner --dbname=<database-uji> <dump>`, terapkan grant runtime, lalu jalankan tes konsistensi pengguna/sesi dan smoke test. Jangan melakukan restore ke production sebagai latihan. Hapus sesi dari salinan restore agar cookie lama tidak aktif kembali. Catat durasi dan pemenuhan RPO/RTO; restore belum diverifikasi pada pekerjaan Fase 1 ini.

## Rollback

Simpan release sebelumnya. Bila smoke test gagal, hentikan aplikasi baru, arahkan symlink ke release sebelumnya dan restart. Jangan membalik migrasi dengan menghapus tabel berisi data; periksa kompatibilitas skema atau pulihkan backup melalui prosedur insiden. Migrasi awal belum memiliki down migration destruktif.

## Syarat sebelum rilis

Audit Rust harus dituntaskan, seluruh job CI harus benar-benar berjalan dan lulus, ZAP terautentikasi perlu bukti cakupan, Google production harus diverifikasi, dan retensi data/log/backup serta pemulihan harus disetujui dan diuji. Tidak ada klaim staging/production dari hasil localhost.
