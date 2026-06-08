---
Task ID: 1
Agent: Main
Task: Build "Selapanan - Kurangan" daily jimpitan tracking feature + verify data persistence + verify BULANAN auto-disable

Work Log:
- Verified seed.ts has guards (if existingGroups === 0, etc.) so data persists through code changes
- Verified BULANAN members are already auto-disabled in jimpitan collection (both API and UI)
- Created backend API: GET /api/jimpitan/selapanan-daily — returns full 35-day daily matrix for a selapanan period
- Created backend API: GET /api/jimpitan/my-daily — returns personal daily jimpitan history for warga
- Built Admin Selapanan "Rekap Harian 35 Hari" view with:
  - 35-day × families matrix organized by 5 weeks
  - Color-coded cells: green (paid), amber (partial), red (unpaid), gray (future)
  - Week filter buttons (Semua, Minggu 1-5)
  - Family shortage ranking table
  - Summary cards (total families, days collected, total paid, total shortage, target, avg rate)
  - Added "Rekap Harian 35 Hari" button to current period card and Kurangan tab
- Built Warga Selapanan daily history view with:
  - Personal 35-day jimpitan tracking
  - Summary grid with payment rate bar
  - Weekly breakdown with day-by-day status
  - Handles BULANAN users gracefully (shows monthly info)
  - "Lihat Rekap Harian Jimpitan Saya" button in Selapanan page
- Tested with Agent Browser:
  - Admin: Selapanan page renders, Rekap Harian button works, daily matrix loads with 5 weeks × 57 members
  - Warga: WL001 (BULANAN) shows monthly info, WL009 (HARIAN) shows full 35-day breakdown
  - BULANAN members in Tarik Jimpitan shown as disabled (Nonaktif, no interactive inputs)

Stage Summary:
- Backend APIs: /api/jimpitan/selapanan-daily, /api/jimpitan/my-daily
- Admin feature: "Rekap Harian 35 Hari" daily matrix in Selapanan page
- Warga feature: "Lihat Rekap Harian Jimpitan Saya" personal daily history
- Data persistence confirmed: seed.ts won't reset data
- BULANAN auto-disable confirmed working
