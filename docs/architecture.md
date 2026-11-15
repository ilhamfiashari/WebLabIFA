# Fondasi Fase 1

Browser → Nginx (HTTPS, aset React) → Axum pada loopback → PostgreSQL.
Axum berkomunikasi langsung dengan discovery, JWKS, dan token endpoint Google melalui HTTPS.
Browser mengunjungi authorization endpoint dan kembali ke callback di origin portal.

## Keputusan

- Monorepo mempertahankan folder `Lab-FrontEnd` dan `Lab-Backend` milik pengguna. Tidak membaca atau menggunakan `tes.env` secara otomatis.
- React/TypeScript strict/Vite, Tailwind 4, komponen Button bergaya shadcn/ui, TanStack Query. Font dan gambar dilayani lokal.
- Halaman `/lab` merupakan shell SPA. Identitas baru ditampilkan setelah `/api/me` memvalidasi sesi. Mengetahui URL atau mengambil HTML shell tidak memberikan data terproteksi. Setiap endpoint data baru harus memanggil pemeriksaan identitas dan otorisasi server; jangan mengandalkan guard React.
- `openidconnect` menangani discovery dan validasi signature, issuer, audience, expiry, nonce. HTTP client menolak redirect dan memiliki timeout 10 detik. Scope hanya `openid email profile`.
- Transaksi OIDC disimpan 5 menit di PostgreSQL. State dan binding browser disimpan sebagai SHA-256; nonce dan verifier hanya di server. `DELETE ... RETURNING` mengonsumsi transaksi secara atomik sebelum pertukaran code, termasuk saat batal atau kedaluwarsa. Retry memulai transaksi baru.
- Satu transaksi login aktif per browser. Login dari tab baru mengganti cookie transaksi; tab sebelumnya harus memulai ulang.
- Cookie opaque acak 256 bit; hanya hash sesi disimpan. Cookie production memakai `__Host-`, Secure, HttpOnly, SameSite=Lax, Path=/, tanpa Domain. Development HTTP memakai nama terpisah. Login merotasi sesi browser sebelumnya.
- Sesi berumur maksimal 8 jam, idle 30 menit. `/api/me` menghitung aktivitas saat dipanggil, tanpa polling untuk mempertahankan sesi secara pasif. Keluar mencabut sesi di database dan menghapus cookie.
- Token CSRF terikat sesi, hanya dikirim melalui respons `/api/me` no-store dan header logout. Tidak menggunakan localStorage/sessionStorage untuk token atau sesi.
- Akun diidentifikasi dengan pasangan issuer/subject. Policy terbaru menerima dua akun Dosen+Admin dan mahasiswa dengan pola NIM Teknik Informatika yang tepat, email terverifikasi, serta claim Workspace sesuai konfigurasi. Grant disimpan di user_roles dan konteks aktif di sesi; role lama users.role tidak lagi dipakai sebagai otoritas. Lihat [kebijakan akses](access-policy.md) dan [panduan OAuth](google-oauth.md).
- Runtime memakai 5 koneksi, acquire timeout 3 detik, statement timeout 5 detik, idle transaction timeout 10 detik. Router membatasi 64 request bersamaan, body 16 KiB, deadline 15 detik dan 2.400 request/menit global. Login dibatasi 120/menit global; Nginx membatasi login 60/menit per-IP dengan burst 40 untuk mengakomodasi alamat NAT kampus, serta API 60/detik dengan burst 80. Nilai ini awal pengujian, bukan hasil uji kapasitas.
- Semua respons API memakai no-store, nosniff, no-referrer, CSP ketat dan request ID. Log aplikasi tidak mencatat URL, cookie, token, verifier, nama, atau email. Query callback dikeluarkan dari log Nginx.
- Cleanup setiap 5 menit menghapus sesi idle/kedaluwarsa dan transaksi kedaluwarsa. Identitas akun memiliki retensi sampai dihapus pengelola; keputusan retensi log/backup perlu disahkan sebelum production.
- Provider fixture adalah proses pengujian terpisah. Konfigurasi production menolak issuer lokal dan domain yang berbeda. Tidak ada jalur login bypass di aplikasi.

## Batas dan pengembangan berikutnya

Tambahan fondasi akun: `users.active` menentukan status akun. Callback tidak mengaktifkan ulang akun nonaktif. Pemeriksaan sesi mewajibkan akun aktif, dan trigger PostgreSQL mencabut seluruh sesi pada transisi aktif → nonaktif dalam transaksi yang sama. Mengaktifkan kembali akun memerlukan login baru. Belum ada endpoint admin untuk mengubah status; operasi ini hanya melalui operator database berwenang, dan tidak ada akun nyata yang dinonaktifkan oleh pengujian.

Perluasan akses mahasiswa telah disetujui. Policy dan pergantian konteks sudah diimplementasikan; akses institusi pada Google sungguhan menunggu konfigurasi hd terverifikasi. Tiga beranda lengkap serta pengelolaan kelas belum diimplementasikan.

Belum ada kelas, grading, skor, atau katalog praktikum. Fase 2 memerlukan service otorisasi objek dan matriks dua akun × dua kelas sebelum endpoint data tersebut dirilis. Halaman katalog hanya ditandai “Segera hadir”; tidak ada angka progres rekaan.

## Referensi implementasi

- [Dokumentasi openidconnect](https://docs.rs/openidconnect/4.1.0/openidconnect/)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Panduan tombol Google](https://developers.google.com/identity/branding-guidelines)
- [OAuth Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html)
