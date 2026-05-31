---
Task ID: 3
Agent: Frontend Agent
Task: Update 3 mobile pages for warga (residents) in bottom-nav layout

Work Log:
- Created `/src/components/features/mobile/` directory for mobile-specific warga pages
- Built `ronda-page.tsx` — Warga Ronda Page
  - My Ronda Group Card: Finds user's family group from /ronda/groups, shows group name, day, shift
  - Jadwal Ronda Bulan Ini: Lists this month's schedules for user's group via /ronda/schedules?groupId=X&from=...&to=...
  - Status Kehadiran: Shows attendance status per schedule (Hadir/Izin/Tidak Hadir/Menunggu) from /ronda/logs
  - Attendance stats: Hadir/Izin/Tidak Hadir counts
- Built `iuran-page.tsx` — Warga Iuran/Jimpitan Page
  - Status Jimpitan Card: Shows enrollment badge, daily counts (Lunas/Kurang), total kekurangan
  - Riwayat Jimpitan Bulan Ini: Table with Tanggal | Dibayar | Status (Lunas/Kurang/Kosong) using Badges
  - Kekurangan Jimpitan Card: Shows unpaid shortage amount, info box about selapanan billing
  - Uses /jimpitan?familyId=X&from=...&to=... and /jimpitan/shortages (filtered by familyId)
- Built `selapanan-page.tsx` — Warga Selapanan Page
  - Selapanan Mendatang Card: Date, location, notes, expandable agenda
  - Kekurangan Anda Card: Shows total unpaid shortage, or "no shortage" success message
  - History Kekurangan: Past selapanan shortages with settlement status
  - Daftar Selapanan: Full list with shortage info per entry
  - Uses /selapanan and /jimpitan/shortages (filtered by familyId)
- Fixed /api/jimpitan GET route to use correct Prisma schema fields (expectedAmount/paidAmount/shortage instead of amount/isPaid)
- Fixed /api/jimpitan POST and PUT routes similarly
- Updated app-shell.tsx: Split pageComponents into adminPageComponents and wargaPageComponents
  - Warga pages now use mobile versions (RondaPage, IuranPage, SelapananWargaPage)
  - Admin pages continue using original components (RondaJimpitanPage, SelapananPage, etc.)
- ESLint passes with 0 errors (1 pre-existing warning)
- Dev server running cleanly

Stage Summary:
- 3 new mobile pages created in /src/components/features/mobile/
- Jimpitan API route fixed to match Prisma schema
- App shell properly routes warga users to mobile-optimized pages
- All text in Indonesian, mobile-first compact layout
- Uses shadcn/ui components, emerald/amber/red color scheme, no indigo/blue
