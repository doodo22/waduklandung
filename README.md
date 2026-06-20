# Waduk Landung - Sistem Manajemen RT Digital

Waduk Landung adalah aplikasi berbasis web untuk digitalisasi manajemen Rukun Tetangga (RT). Sistem ini dirancang secara khusus untuk mempermudah tugas pengurus RT dalam mengelola data warga, keuangan (jimpitan, denda, kas), inventaris, hingga presensi jadwal ronda harian dengan konsep "Selapanan" (periode 35 hari pada penanggalan Jawa).

## 🚀 Fitur Utama

- **👥 Manajemen Warga & Keluarga**  
  Pencatatan data warga lengkap (KK, anggota keluarga, nomor telepon) beserta status aktif atau nonaktif dalam kegiatan RT.
  
- **🛡️ Jadwal & Absensi Ronda**  
  Pengelompokan warga ke dalam grup ronda harian. Absensi ronda menggunakan rentang waktu "Selapanan" (35 hari), dilengkapi dengan rekap persentase kehadiran setiap warga.
  
- **💰 Sistem Jimpitan Terpadu (Harian & Bulanan)**  
  Pencatatan otomatis jimpitan. Mendukung warga dengan metode iuran harian (misal Rp1.000/hari) maupun iuran bulanan (dicatat secara penuh). Terdapat fitur rekap kekurangan/tunggakan jimpitan.
  
- **📒 Manajemen Kas & Transaksi**  
  Pembukuan kas masuk dan keluar secara digital sehingga laporan keuangan RT lebih transparan dan mudah diaudit.
  
- **📦 Inventaris RT**  
  Pencatatan aset atau barang pinjaman milik RT (misalnya: tenda, kursi, sound system).
  
- **📱 Responsif & Mobile-Friendly**  
  Tampilan UI terpisah dan dioptimalkan secara khusus untuk *desktop* (bagi admin/pengurus) dan *mobile* (bagi warga) agar mudah diakses dari *smartphone*.

## 🛠️ Tech Stack

Aplikasi ini dibangun menggunakan teknologi modern:

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Bahasa:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **Database ORM:** [Prisma](https://www.prisma.io/)
- **Icons:** [Lucide React](https://lucide.dev/)

## 💻 Cara Menjalankan Secara Lokal (Development)

Berikut adalah langkah-langkah untuk menjalankan aplikasi Waduk Landung di komputer Anda:

1. **Clone repository ini**
   ```bash
   git clone https://github.com/doodo22/waduklandung.git
   cd waduklandung
   ```

2. **Install dependensi**
   Anda dapat menggunakan `npm`, `yarn`, atau `pnpm`.
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**
   Buat file `.env` di *root* direktori dan atur variabel database (Prisma). Contoh untuk SQLite:
   ```env
   DATABASE_URL="file:./dev.db"
   ```

4. **Migrasi Database & Generate Prisma Client**
   ```bash
   npm run db:push
   npm run db:generate
   ```

5. **Jalankan Development Server**
   ```bash
   npm run dev
   ```

6. **Akses Aplikasi**
   Buka browser Anda dan akses `http://localhost:3000`.

## 🤝 Berkontribusi

Jika Anda menemukan *bug* atau memiliki ide penambahan fitur, silakan buat [*Issue*](https://github.com/doodo22/waduklandung/issues) atau kirimkan *Pull Request*.

## 📄 Lisensi

Proyek ini bersifat *Open Source* dan dapat digunakan atau dimodifikasi secara bebas untuk keperluan komunitas/Rukun Tetangga.
