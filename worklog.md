---
Task ID: 1
Agent: Main Agent
Task: Implement ronda attendance feature with schedule auto-generation, attendance table, and recap

Work Log:
- Updated Prisma schema: added `selapananId` and `weekNumber` to RondaSchedule model, added `rondaSchedules` relation to Selapanan
- Pushed schema changes with `bun run db:push` and regenerated Prisma client
- Created API endpoint `/api/ronda/attendance` with GET and POST handlers:
  - GET: Auto-generates RondaSchedule records for the current selapanan period, returns group info, members, schedules, and attendance data
  - POST: Saves attendance entries (HADIR/TIDAK_HADIR) for a schedule, with authorization check (admin or ronda member on duty)
- Rewrote mobile ronda page (`/src/components/features/mobile/ronda-page.tsx`) with:
  - Group info card with member list (showing all KK in the group)
  - Attendance table (rows=members, columns=5 ronda dates within selapanan)
  - Active column logic (today's ronda column is clickable to toggle attendance)
  - Past columns show recorded status (read-only)
  - Future columns are greyed out/empty
  - Save button for today's attendance edits
  - Legend explaining attendance icons
  - Recap section (appears when all 5 ronda in selapanan are past)
- Kept existing jimpitan collection form feature (Tarik Jimpitan when on duty)
- Verified attendance logic with direct DB test: confirmed 5 dates per selapanan per group

Stage Summary:
- Ronda attendance feature fully implemented (API + frontend)
- Schedules auto-generate when attendance data is fetched for a selapanan
- Attendance can be marked by admin or ronda group members on their duty day
- Recap shows after all 5 ronda sessions are complete
- Lint check passes (0 errors)
