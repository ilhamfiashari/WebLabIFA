# Threat model autentikasi

Pemilik kontrol awal adalah pengelola aplikasi. Batas kepercayaan: browser/internet → Nginx; Nginx → Axum loopback; Axum → database; Axum/browser → Google. Aset: identitas, peran, sesi, transaksi OIDC, konfigurasi rahasia, log dan backup. Identitas mahasiswa adalah data pribadi; token dan verifier adalah rahasia sementara.

| STRIDE / risiko | Kontrol | Bukti verifikasi |
| --- | --- | --- |
| Spoofing: login CSRF / akun tertukar | state + cookie binding + nonce + issuer/sub, PKCE S256 | `scripts/verify-oidc.mjs`: missing/wrong state, browser tanpa cookie, nonce salah, dua akun |
| Tampering: token atau code diubah | Signature, audience, issuer, expiry oleh library; redirect URI exact; verifier di server | fixture dengan signature/audience/issuer/expiry salah; fixture memeriksa PKCE dan redirect |
| Repudiation: peristiwa tanpa jejak | Event login_started/completed/rejected/logout, request ID; nilai rahasia tidak dilog | review kode dan observasi log lokal; rotasi/retensi log staging belum diverifikasi |
| Information disclosure: pencurian cookie atau callback | HttpOnly/Secure/SameSite, no-store, session hash, log path-only, CSP, payload React sebagai teks | tes header, logout, rendering payload; konfigurasi TLS dan log Nginx perlu smoke test VPS |
| Denial of service: pool/login dipenuhi | Pool 5, timeout, body/concurrency/rate limit, Nginx per-IP, TTL cleanup | review konfigurasi; uji beban belum dijalankan |
| Elevation: role dari penyedia atau client | Default mahasiswa, constraint role, upsert tidak mengubah role | tes login default; endpoint perubahan role belum dibuat |
| Replay / fixation | Konsumsi transaksi atomik, cookie binding, session rotation, pencabutan saat logout | tes replay, dua consume paralel pada PostgreSQL, cookie sesi lama ditolak |

## Matriks requirement → kontrol → tes → bukti

| ID | Requirement | Kontrol | Tes / bukti |
| --- | --- | --- | --- |
| AUTH-01 | Login code flow aman | Library OIDC + PKCE S256 + scope minimum | `verify-oidc.mjs`, `tests/oidc.spec.ts` |
| AUTH-02 | State dan browser terikat | Hash state/browser + cookie transaksi | Node harness wrong/missing state dan stolen callback |
| AUTH-03 | Callback sekali pakai dan TTL | DELETE RETURNING + expires_at | Node replay; tes PostgreSQL paralel dan expiry |
| AUTH-04 | Validasi ID token lengkap | signature/issuer/audience/expiry/nonce | enam skenario penolakan fixture |
| AUTH-05 | Hanya akun yang memenuhi kebijakan | Dua akun istimewa atau NIM mahasiswa exact + email terverifikasi + claim Workspace; pemeriksaan ulang saat sesi | Fixture mahasiswa valid/invalid, hd salah/hilang, email belum terverifikasi, outsider |
| AUTH-07 | Grant dan konteks sesi aman | Grant DB, binding subject akun istimewa, rotasi sesi/CSRF, daftar peran server | Fixture subject berbeda ditolak; mahasiswa gagal menjadi Admin; cookie lama ditolak setelah context switch; pencabutan grant tidak dibatalkan login |
| AUTH-06 | Akun nonaktif tidak memperoleh sesi | Upsert hanya untuk akun aktif, pemeriksaan status pada sesi, trigger pencabutan semua sesi saat deaktivasi | Tes PostgreSQL/OIDC `disabled_account_rejects_login_and_revokes_all_sessions`: penolakan login, dua sesi dicabut, aktivasi ulang tidak memulihkan cookie |
| SESSION-01 | Tidak ada sesi client yang bisa dimanipulasi | opaque token, hash DB, cookie host-only | tes router/database dan pemeriksaan cookie |
| SESSION-02 | Idle, absolute expiry dan logout | WHERE waktu + DELETE sesi + cookie Max-Age=0 | `Lab-Backend/tests/auth.rs` |
| SESSION-03 | Login merotasi sesi | token baru + revoke cookie sebelumnya | Node harness session rotation |
| CSRF-01 | Logout menolak cross-origin | Origin exact dan token CSRF | Node harness + tes PostgreSQL |
| UI-01 | Responsif dan akses keyboard | CSS tiga band, target 44px, focus, reduced motion | Playwright 360/390/768/1440 + screenshot |
| UI-02 | Payload menjadi teks | React escaping | Playwright nama berisi markup |
| OPS-01 | Rahasia hanya di server | .gitignore, contoh tanpa kredensial nyata | secret scanner + review diff |
| OPS-02 | Kebijakan jaringan/TLS/log | Nginx dan systemd | berkas tersedia; belum diuji di VPS |
| OPS-03 | Pemeriksaan otomatis | CI pinned, SAST/SCA, tes DB/browser | hasil lokal di `verification.md`; CI belum dijalankan di GitHub |

Ini adalah persyaratan proyek. Pemetaan nomor ASVS tidak diklaim sudah terverifikasi pada Fase 1; lakukan review terhadap ASVS 5.0.0 sebelum menerbitkan matriks kepatuhan.

## Peran Fase 1

Semua peran tunduk pada [kebijakan akun](access-policy.md), status aktif dan grant database. Halaman publik tidak memberikan akses ke data terproteksi. Matriks ini merupakan batas fondasi sesi; endpoint pengelolaan akun/kelas belum tersedia.

| Aksi | Tanpa sesi | Mahasiswa | Dosen | Admin |
| --- | --- | --- | --- | --- |
| Login, privasi, bantuan | boleh | boleh | boleh | boleh |
| Membaca identitas sesi sendiri | ditolak | boleh | boleh | boleh |
| Logout sesi sendiri dengan CSRF | ditolak | boleh | boleh | boleh |
| Mengatur role / melihat akun lain | tidak tersedia | tidak tersedia | tidak tersedia | tidak tersedia |

## Bug bar dan temuan

Blokir rilis untuk High/Critical terkonfirmasi, rahasia terekspos, kegagalan otorisasi/isolasi, tes wajib gagal, atau cakupan scan wajib belum lengkap. Tidak ada pengecualian advisori yang diterima otomatis. Temuan yang diterima perlu alasan, pemilik, tanggal kedaluwarsa dan persetujuan pengelola.

- `RUSTSEC-2023-0071`: dependensi `rsa 0.9.10` melalui `openidconnect 4.1.0`, ditemukan oleh cargo-audit. Advisori berkaitan dengan operasi private key; portal hanya memverifikasi signature dengan public key dan tidak memegang private key RSA. Ini penilaian paparan awal, bukan persetujuan pengecualian. Audit tetap memblokir workflow sampai perbaikan upstream atau keputusan tertulis pengelola. Jangan menambahkan ignore tanpa review. [Advisori RustSec](https://rustsec.org/advisories/RUSTSEC-2023-0071.html), [isu upstream](https://github.com/ramosbugs/openidconnect-rs/issues/140).
- `RUSTSEC-2026-0459`: `libsqlite3-sys 0.30.1` tetap ada di lockfile lewat dependensi opsional SQLx/macro. `cargo tree -i libsqlite3-sys` menunjukkan tidak ada jalur pada build aktif PostgreSQL. Tidak ada database SQLite atau pembacaan file SQLite dalam aplikasi. Audit lockfile tetap melaporkannya dan belum diberi pengecualian. [Advisori RustSec](https://rustsec.org/advisories/RUSTSEC-2026-0459.html).
- Driver SQLite/MySQL tidak digunakan. Default features SQLx dinonaktifkan; periksa audit lockfile setelah setiap pembaruan.

## Onboarding dan respons

Sebelum menulis endpoint baru: ambil identitas dari sesi server, periksa izin per objek, gunakan binding SQLx dan DTO minimum, render payload lab sebagai teks, dan uji dua akun. Jangan mengeksekusi payload, shell, atau target jaringan arbitrer dari browser.

Jika ditemukan insiden: catat request ID dan waktu tanpa menyalin token; batasi akses lewat Nginx; cabut sesi (`DELETE FROM sessions` untuk pencabutan global oleh operator berwenang); rotasi secret OAuth di Google dan environment server; tinjau build, log teredaksi dan data yang terdampak; deploy perbaikan terverifikasi; pulihkan dari backup uji bila perlu; komunikasikan dampak dan dokumentasikan evaluasi. Pencabutan data/sesi production adalah tindakan operator dengan otorisasi, bukan bagian dari skrip tes.
