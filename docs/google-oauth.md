# Pengaturan Google OAuth IFA Lab

Akses ruang `/lab` dan API terproteksi mengikuti [kebijakan akun terbaru](access-policy.md): dua email Dosen+Admin dan mahasiswa dengan pola `xxx140xxx@student.itera.ac.id`. Halaman login, privasi, dan bantuan tetap publik. Backend memeriksa ID token, email terverifikasi, Workspace, status akun dan grant. Identitas utama tetap pasangan issuer/subject (`sub`).

## 1. Buat project Google Cloud

Buka [Google Cloud Console](https://console.cloud.google.com/), pilih project khusus IFA Lab atau buat project baru. Buka **Google Auth Platform** → **Get started** bila belum dikonfigurasi. Gunakan akun pengelola yang memiliki akses project.

## 2. Isi Branding

Isi nama aplikasi **IFA Lab**, email dukungan yang aktif, dan kontak pengembang. Untuk production, isi homepage `https://lab.ilhamfirmanashari.my.id` dan privacy policy `https://lab.ilhamfirmanashari.my.id/privasi`. Authorized domain adalah domain induk `ilhamfirmanashari.my.id`; selesaikan verifikasi kepemilikan domain bila diminta. Pastikan halaman tersebut tersedia melalui HTTPS sebelum pemeriksaan Google.

## 3. Atur Audience

Pilih **External**, karena akses mencakup akun Workspace ITERA dan Gmail pribadi. Mulai dengan status **Testing**. Pada **Test users**, tambahkan hanya:

- `firman.ashari@if.itera.ac.id`
- `ilhamfirman39@gmail.com`

Tambahkan akun mahasiswa penguji yang memenuhi kebijakan bila diperlukan untuk consent Testing. Daftar test users tidak menggantikan policy backend. Claim `hd` dari ID token wajib diperiksa untuk akun institusi; parameter `hd` pada URL hanya hint. Akun Gmail yang diizinkan tidak memerlukan hd.

## 4. Atur Data Access

Gunakan cakupan identitas minimum: `openid`, email (`https://www.googleapis.com/auth/userinfo.email`), dan profile (`https://www.googleapis.com/auth/userinfo.profile`). Kode mengirim `openid email profile`. Aplikasi tidak meminta akses Drive, Gmail, atau refresh token Google.

## 5. Buat client production

Buka **Clients** → **Create client**, pilih **Web application**, lalu beri nama `IFA Lab Production`. Tambahkan **Authorized redirect URI** persis:

```text
https://lab.ilhamfirmanashari.my.id/api/auth/google/callback
```

Tidak perlu mengisi JavaScript origins untuk alur redirect server ini. Simpan Client ID dan Client Secret ke konfigurasi backend. Secret tidak boleh dimasukkan ke frontend, variabel `VITE_*`, Git, atau percakapan.

## 6. Buat client development terpisah

Buat Web application lain bernama `IFA Lab Development`. Untuk konfigurasi `.env.example`, redirect URI adalah:

```text
http://localhost:5173/api/auth/google/callback
```

Jika membuka Vite melalui `http://127.0.0.1:5173`, gunakan `APP_BASE_URL=http://127.0.0.1:5173` dan daftarkan URI ini juga:

```text
http://127.0.0.1:5173/api/auth/google/callback
```

Scheme, host, port, path, dan trailing slash harus sama persis. Gunakan satu origin secara konsisten saat membuka browser. Vite meneruskan `/api` ke backend sesuai `IFA_API_URL` (default port 3000).

## 7. Isi environment backend

Isi `Lab-Backend/.env` dari client development. Pertahankan `APP_ENV=development`, issuer Google, dan dua email allowlist. Backend dapat dijalankan dari root repo maupun folder `Lab-Backend`. Lihat README untuk migrasi/database dan perintah menjalankan aplikasi.

Production menggunakan `deploy/production.env.example` sebagai dasar `/etc/ifa/runtime.env`:

```dotenv
APP_ENV=production
APP_BASE_URL=https://lab.ilhamfirmanashari.my.id
OIDC_ISSUER=https://accounts.google.com
OIDC_CLIENT_ID=isi-client-id-production
OIDC_CLIENT_SECRET=isi-secret-di-server
ALLOWED_EMAILS=firman.ashari@if.itera.ac.id,ilhamfirman39@gmail.com
ITERA_WORKSPACE_DOMAIN=isi-domain-dari-claim-hd-yang-terverifikasi
SUPPORT_EMAIL=firman.ashari@if.itera.ac.id
```

Isi juga database dan bind address sesuai contoh deployment. File server dimiliki root:ifa dengan mode 0640. Backend production menolak startup bila allowlist akun istimewa bukan persis dua email tersebut. Isi ITERA_WORKSPACE_DOMAIN dari claim login institusi yang sah; kosong berarti akses institusi ditolak. Restart layanan setelah konfigurasi berubah.

Pengujian otomatis memakai `APP_ENV=test`, penyedia OIDC lokal dan email sintetis Rani/Bima. Hasil fixture tidak membuktikan integrasi Google sungguhan. Jangan memakai fixture untuk deployment.

## 8. Uji akses

1. Login dengan masing-masing akun yang diizinkan: harus sampai `/lab`, identitas benar, dan `/api/me` memberikan 200.
2. Logout lalu pastikan `/api/me` memberikan 401.
3. Coba mahasiswa dengan NIM valid dan Workspace sesuai: harus masuk sebagai Mahasiswa, tanpa akses peralihan Admin. Coba kode prodi lain, alias, domain mirip, serta akun Google lain: jika callback mencapai aplikasi, backend wajib mengarahkannya ke `/login?status=unauthorized` tanpa pengguna/sesi baru.
4. Uji penolakan callback akun lain dengan fixture lokal melalui `scripts/run-local-checks.mjs`; tes database juga memastikan sesi lama milik akun di luar allowlist ditolak dan dicabut.
5. Coba batalkan consent, refresh setelah login, dan akses `/lab` tanpa sesi. Periksa cookie HTTPS sesuai panduan deployment.

## 9. Publikasi dan kendala umum

Tinjau **Verification Center** dan persyaratan yang ditampilkan Google sebelum mengubah status publikasi. Status Production di Google tidak menggantikan allowlist backend. Kebijakan administrator Workspace ITERA dapat membatasi persetujuan aplikasi; hubungi admin bila akun institusi diblokir.

- `redirect_uri_mismatch`: cocokkan URI pada Clients dengan `APP_BASE_URL` + `/api/auth/google/callback`.
- Access blocked saat Testing: periksa project, audience, test users, dan kebijakan Workspace.
- Pesan akun tidak diizinkan: periksa kelayakan email, claim Workspace, status akun dan grant sesuai kebijakan akun terbaru.
- Gangguan sementara: periksa konfigurasi backend, koneksi database/Google, serta log teredaksi tanpa menyalin token atau secret.

Referensi resmi: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [pengaturan Google Auth Platform](https://support.google.com/cloud/answer/15544987), dan [pengelolaan OAuth clients](https://support.google.com/cloud/answer/15549257).
