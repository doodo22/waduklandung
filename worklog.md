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
---
Task ID: 1
Agent: Main Agent
Task: Modify Semua tab to show weekly recap and remove ranking feature

Work Log:
- Read and analyzed selapanan-page.tsx (2316 lines) to understand the daily matrix rendering
- Identified the renderDailyMatrix() function and its week filtering logic
- Replaced the "Semua" (dailyMatrixWeek === 0) view: instead of showing 5 individual weekly tables with all families, now shows a concise recap table with Week 1-5 rows showing: No, Minggu, Tanggal, Hari, Target, Terkumpul, Kurangan, %
- Each week row in the recap is clickable to navigate to that week's detailed view
- Added a "TOTAL 35 HARI" total row in the recap
- Removed the "Peringkat Kekurangan" (Family Shortage Ranking) section entirely
- Fixed JSX parsing error (can't use {expression} directly in ternary else branch)
- Verified with lint (0 errors), dev server (no runtime errors), and Agent Browser e2e testing

Stage Summary:
- "Semua" tab now shows a clean weekly recap instead of 5 heavy tables
- Ranking feature removed as requested
- Clicking a week row in recap navigates to detailed weekly view
- All features verified working via browser testing
