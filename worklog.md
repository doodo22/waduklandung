---
Task ID: 1
Agent: Main Agent
Task: Replace app logo with transparent version and update styling across all components

Work Log:
- Copied transparent logo from `/upload/waduk landung.png` to `/public/logo.png`
- Updated login-page.tsx: Removed `rounded-2xl shadow-md`, added `object-contain`
- Updated header.tsx (warga): Removed `rounded-lg`, added `object-contain`
- Updated sidebar.tsx (admin): Removed `rounded-lg`, added `object-contain`
- Updated beranda-page.tsx: Changed `rounded-xl shadow-md` to `object-contain drop-shadow-md`

Stage Summary:
- Transparent logo (RGBA PNG, 516x483) now renders cleanly without background artifacts
- All 4 logo locations updated to use `object-contain` instead of rounded corners/shadows
- Logo displays properly on both light and dark backgrounds

---
Task ID: 2
Agent: Main Agent
Task: Make 'Keluar' (Logout) button more highlighted/prominent on warga dashboard

Work Log:
- Updated profil-page.tsx: Changed logout button from outline to filled `bg-rose-600 hover:bg-rose-700 text-white` with larger size (h-12), bold text, and shadow
- Updated header.tsx (warga): Changed from tiny icon-only button to a labeled button with "Keluar" text, rose-colored border, and hover effect

Stage Summary:
- Logout button in profil page is now a prominent filled red button (h-12, bold)
- Header logout button now shows both icon and "Keluar" text with rose accent color
- Both buttons are more visible and easier to find for 35+ age demographic

---
Task ID: 3
Agent: Main Agent
Task: Backend: Modify jimpitan collection API to allow ronda group members to submit

Work Log:
- Modified POST handler in `/api/jimpitan/collection/route.ts`
- Removed strict admin-only check (`isAdmin(authUser.role)`)
- Added authorization logic: Admin OR member of the ronda group on duty for the given date
- Checks if user's family belongs to the duty group by querying family's rondaGroupId
- Returns clear error message when user is neither admin nor on duty

Stage Summary:
- API now supports dual authorization: admin OR ronda group member on duty
- Warga users can only submit jimpitan for dates when their group is on duty
- Error message clearly explains access restrictions

---
Task ID: 4
Agent: Main Agent
Task: Frontend: Add jimpitan collection form to warga ronda page when on duty

Work Log:
- Completely rewrote `/components/features/mobile/ronda-page.tsx`
- Added CollectionData/CollectionEntry types and collection state management
- Added `isOnDutyToday` computed property that checks if user's ronda group dayOfWeek matches today's duty
- Added prominent "Anda Bertugas Hari Ini!" alert card with amber highlight when on duty
- Added collapsible jimpitan collection form with "Tarik Jimpitan" button
- Collection form includes: summary stats, per-family entries with quick select (0/500/1rb), custom amount input, notes, status badges, and "Simpan Semua" save button
- Auto-fetches collection data when user is on duty

Stage Summary:
- Warga dashboard ronda page now shows duty alert when it's their turn
- Jimpitan collection form allows on-duty ronda members to input payments
- Form is mobile-optimized with card-based layout (not table-based like admin)
- Same quick-select pattern (0, 500, 1rb) as admin for consistency
