# Arah visual

Tugas utama: masuk dengan Google, lalu memeriksa sesi dan keluar. Identitas mengikuti brief IFARISE: putih hangat, hijau hutan #325341, sage, charcoal, Inter; logo perisai jaringan dan wordmark IFA Lab.

Unsur subjek: meja praktikum kampus, ESP32, sensor kelembapan, gateway jaringan, tanaman tropis di jendela, pembuktian risiko dan perbaikan, mahasiswa, Google login, domain IFA, dua jalur keamanan web/IoT. Meja praktikum menjadi jendela visual menuju eksperimen IFA. Satu interaksi utama pada login adalah CTA Google yang bekerja.

Layar `/lab` memakai arah framed-sheet: bingkai hijau pucat, satu lembar putih, tanpa bayangan. Login memakai komposisi dua panel 43/57 yang diwajibkan brief, sehingga aturan sidebar, tabel dan metrik tidak diterapkan pada login. Gambar tunggal memenuhi brief login; tidak menambahkan empat gambar, video, statistik atau testimoni yang tidak diperlukan. Lapisan gelap pada foto hanya untuk kontras teks, bukan dekorasi permukaan aplikasi.

Konten login: Masuk ke IFA Lab; Praktikum keamanan web dan IoT untuk mahasiswa.; Masuk dengan Google; catatan akun dan sesi; Kebijakan Privasi/Bantuan. Konten lab: nama akun, email, role, batas sesi, Keluar, dan keterangan katalog belum tersedia.

Aset lokal: `Lab-FrontEnd/public/assets/lab-720.webp` dan `lab-1440.webp`, rasio 2:3, dimensi eksplisit, dekoratif. Deskripsi aset: laboratorium kampus rapi dengan meja kayu, ESP32, breadboard, sensor kelembapan, gateway putih dan pemandangan tropis lembut. Font Inter dan Roboto disajikan lokal melalui Fontsource. Logo G diambil dari [aset resmi Google](https://developers.google.com/static/identity/images/signin-assets.zip); hanya bingkai tombol di luar logo yang dikeluarkan, bentuk/warna logo dipertahankan. Tombol memakai ukuran logo 20 px, font Roboto medium 14 px, putih dan border #747775 sesuai panduan Google.

Screenshot dari Chrome tersedia pada folder `docs/screenshots`. Screenshot fixture UI dipisahkan dari screenshot sesi melalui OIDC lokal. Pemeriksaan visual tidak merupakan bukti verifikasi Google production.

Inspeksi akhir pada 1440/768/390 px: tidak ada overflow, gambar rusak, font gagal dimuat atau console error. Teks pendukung dinaikkan menjadi 12–13 px. Pada ponsel, judul dan tombol diletakkan dekat bagian atas, hero disembunyikan. Satu warning ukuran judul aplikasi dipertahankan karena layar login menggunakan judul utama 37 px dan tidak berfungsi sebagai dashboard data.

## Dasbor Admin

Konteks Admin memakai shell sidebar + topbar pada `/lab/admin` dengan subrute `pengguna`, `kelas`, `katalog`, `audit`, dan `pengaturan` (navigasi `pushState`, guard tetap memeriksa peran aktif). Kode berada di `Lab-FrontEnd/src/admin/`. Grafik ditulis sebagai SVG/HTML tanpa pustaka tambahan sehingga tetap sesuai CSP `style-src 'self'`: garis-area, batang, batang horizontal, heatmap hari × jam, dan batang komposisi status. Setiap grafik memiliki tooltip (pointer dan keyboard) serta sakelar tampilan tabel.

Backend belum memiliki API admin, sehingga semua angka berasal dari `src/admin/data.ts` dan halaman diberi label "Data contoh". Data contoh memakai nama fiktif tanpa email karena bundle JS dapat diunduh publik. Aksi yang mengubah data (status akun, cabut grant) dinonaktifkan sampai API tersedia. Halaman Pengaturan menampilkan kebijakan sesi dan akses yang berlaku, bukan data contoh.

Warna seri: hijau `#2c8048` (terang) dan `#46a865` (gelap), keduanya lolos validator palet (pita lightness, chroma, kontras ≥ 3:1). Status memakai palet tetap good/warning/critical dengan titik + label. Tema Terang/Gelap/Ikuti sistem disimpan di `localStorage` dengan fallback aman. Screenshot `docs/screenshots/admin-*.png` dihasilkan oleh `tests/admin.spec.ts` pada 390 dan 1440 px.

## Latihan Mahasiswa dan Dosen

Bank soal berada di `Lab-Backend/content/latihan.json` (2 jalur × 4 level × 3 latihan) dan dimuat backend saat start; isinya divalidasi (id unik, kunci pilihan ganda valid, isian sudah ternormalisasi). Frontend tidak pernah memuat berkas ini, sehingga kunci jawaban tidak masuk bundle publik.

- Mahasiswa (`/lab`, `/lab/latihan`, `/lab/latihan/{id}`, `/lab/pencapaian`): langkah dikerjakan berurutan per jalur; level berikutnya terbuka setelah seluruh level sebelumnya benar. Server memeriksa jawaban dan syarat buka (409 bila terkunci) dalam transaksi dengan advisory lock per pengguna. Isi latihan terkunci tidak dikirim. Gamifikasi: XP per level (10/20/30/50), petunjuk memotong XP setengahnya, tiap jawaban salah -10% (minimum 20%), peringkat Pemula→Pakar Keamanan, dan lencana. XP dan lencana dihitung dari progres server, bukan disimpan di peramban.
- Dosen (`/lab/dosen`, `/lab/dosen/latihan[/{id}]`): tampilan latihan yang sama tanpa XP, peringkat, atau kunci; semua level terbuka dengan kunci jawaban, jawaban isian yang diterima, pembahasan, dan petunjuk. Mode presentasi menyembunyikan jawaban saat soal dibahas di kelas.
- Admin, Dosen, dan Mahasiswa memakai shell yang sama (`src/portal/`).

Progres disimpan pada tabel `exercise_progress` (migrasi 0005). Screenshot `mahasiswa-*.png` dan `dosen-*.png` dihasilkan `tests/latihan.spec.ts`.
