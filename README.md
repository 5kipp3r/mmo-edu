# MMO Edukasi 2D Modular — Tahap 0

Fondasi awal yang dapat dijalankan sebagai situs statis. Tidak menggunakan ZIP, framework, database, atau layanan berbayar.

## Struktur

- `index.html` — antarmuka game.
- `styles.css` — tampilan responsif dan kontrol mobile.
- `engine.js` — loop game, kontrol gerak, pemuat manifest, dan validasi dasar.
- `content/manifest.json` — daftar modul konten.
- `content/maps/courtyard.json` — contoh peta halaman sekolah.
- `content/npcs/teacher.json` — contoh definisi NPC guru.

## Uji lokal

Karena engine memuat JSON melalui `fetch`, jalankan lewat server HTTP lokal, bukan membuka `index.html` langsung sebagai `file://`.

Contoh bila Node.js tersedia:

```bash
npx serve .
```

Kemudian buka alamat lokal yang ditampilkan.

## Deploy ke Cloudflare Pages

Untuk repository statis tanpa proses build:
- Build command: kosongkan.
- Build output directory: ` / ` (root) atau `.` sesuai pilihan dashboard yang tersedia.
- Root directory: kosongkan jika seluruh berkas berada di root repository.
- Production branch: `main`.

Cloudflare Pages dapat menerbitkan situs statis tanpa framework. Setelah commit/push, integrasi Git dapat memicu deployment otomatis.

## Menambahkan konten

1. Buat berkas JSON baru di folder yang sesuai.
2. Tambahkan entri dengan `id`, `type`, `version`, `path`, dan `enabled` di `content/manifest.json`.
3. Pastikan ID unik dan path relatif terhadap folder `content/`.
4. Uji deployment dan periksa log halaman.

Saat ini pemuat hanya menampilkan daftar modul dan memuat peta awal. Modul NPC masih berupa data contoh dan belum dirender atau memiliki interaksi sungguhan.

## Batas Tahap 0

Belum tersedia: akun/login, database, server authoritative, multiplayer real-time, Durable Objects, collision map, sistem quest/kuis/minigame produksi, moderasi, atau penyimpanan progres. Jangan memasukkan data pribadi murid ke kerangka contoh ini.
