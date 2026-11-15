# Kebijakan akses akun

Pengguna telah menyetujui perluasan akses mahasiswa pada 15 November 2026. `ALLOWED_EMAILS` kini merupakan allowlist akun Dosen+Admin, bukan seluruh akun portal.

| Identitas Google terverifikasi | Grant awal | Konteks sesi baru |
| --- | --- | --- |
| firman.ashari@if.itera.ac.id | Dosen, Admin | Dosen |
| ilhamfirman39@gmail.com | Dosen, Admin | Dosen |
| Sembilan digit ASCII dengan posisi 4–6 `140`, domain student.itera.ac.id | Mahasiswa | Mahasiswa |
| Alamat persis pada `STUDENT_EMAILS` (akun uji, mis. Gmail) | Mahasiswa | Mahasiswa |
| Akun lain atau nonaktif | Ditolak | Tidak ada sesi |

`STUDENT_EMAILS` (dipisah koma, maksimal 10) menambahkan akun Mahasiswa di luar pola NIM, misalnya akun uji pribadi. Alamat dicocokkan persis tanpa claim Workspace, tidak boleh tumpang tindih dengan `ALLOWED_EMAILS`, dan tidak pernah mendapat grant Dosen/Admin. Isi nilainya di `.env` server; jangan di-commit.

Email dinormalisasi menjadi huruf kecil. Contoh mahasiswa: `123140051@student.itera.ac.id`. Plus alias, kode prodi lain, digit non-ASCII, panjang NIM lain dan domain tambahan ditolak. Semua akun harus memiliki email_verified=true dari ID token yang telah diverifikasi library.

## Workspace institusi

Isi `ITERA_WORKSPACE_DOMAIN` dengan nilai claim `hd` dari login institusi yang sah. Login institusi lokal pada 15 November 2026 telah menghasilkan domain terverifikasi `if.itera.ac.id`; nilai ini dipasang pada konfigurasi localhost. Login mahasiswa sungguhan belum diverifikasi: jika akun mahasiswa berada pada organisasi Workspace berbeda, verifikasi claim akun mahasiswa sebelum memperluas konfigurasi domain. Jangan menebak domain dari alamat email. Google mendokumentasikan bahwa claim `hd` yang ditandatangani menentukan organisasi Workspace; parameter URL bukan kontrol otorisasi. [Referensi Google](https://developers.google.com/identity/openid-connect/openid-connect).

Untuk memperoleh nilainya, coba login dengan akun institusi pada allowlist. Jika konfigurasi kosong, backend mencatat event `workspace_configuration_required` beserta domain terverifikasi saja, tanpa ID token, email, subject, atau code. Callback tetap ditolak sampai operator mengisi konfigurasi dan restart backend. Akun Gmail pada allowlist tidak memerlukan hd. Provider test memakai domain fiktif `itera.test`; pengecualian akun privileged fixture dibatasi APP_ENV=test.

## Grant dan sesi

- Identitas utama adalah issuer/subject. Akun istimewa diikat ke user ID melalui `privileged_bindings`; subject lain untuk email sama ditolak. Binding akun Google yang sudah tersimpan dipertahankan melalui migrasi. Relink hanya melalui prosedur operator dengan audit, bukan API publik.
- Grant diinisialisasi sekali saat login pertama yang memenuhi kebijakan. Pencabutan grant tidak dibatalkan oleh login berikutnya. Trigger mencabut semua sesi bila grant dihapus. Akun nonaktif tetap ditolak.
- `/api/me` mengembalikan role aktif, allowed_roles, dan home_route internal. Policy email, Workspace, status aktif dan grant aktif diperiksa kembali pada pemeriksaan sesi.
- `POST /api/session/context` menerima `{ "role": "admin" }` dengan Origin exact dan X-CSRF-Token. Server menolak role yang tidak dimiliki. Pergantian konteks merotasi cookie dan CSRF tanpa memperpanjang batas sesi absolut. Perubahan dan inisialisasi grant dicatat pada access_events; perubahan status akun dan penghapusan grant juga diaudit.
- React mengarahkan bootstrap `/lab` ke konteks yang sesuai dan menyediakan tombol Beralih peran. Halaman masih shell sesi; dashboard lengkap, kelas dan endpoint data belum dibuat. Route guard React tidak menggantikan otorisasi endpoint backend.

Migrasi kebijakan menghapus sesi lama karena belum membawa konteks Workspace dan role terverifikasi. Pengguna perlu login kembali. Kueri runtime memerlukan tabel user_roles, privileged_bindings dan access_events; jalankan grant deployment setelah migrasi bila memakai role database terpisah.

## Tahap berikutnya

Belum ada API untuk mengelola akun, grant, atau kelas. Sebelum API admin dirilis, tambahkan pemeriksaan minimal satu Admin aktif yang aman terhadap mutasi paralel, prosedur pemulihan admin, audit aktor, dan pengujian scope dua kelas. Jangan menyatakan Fase 2A selesai hanya dari shell sesi dan tombol peralihan konteks.
