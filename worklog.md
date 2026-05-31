---
Task ID: 1
Agent: Main
Task: Data Warga feature — full KK & family member management

Work Log:
- Added `FamilyMember` model to Prisma schema with full demographic fields: fullName, nik, gender, relationship, maritalStatus, birthPlace, birthDate, education, citizenship, occupation, isFamilyHead
- Removed `memberCount` from Family model (now computed from familyMembers count)
- Renamed Family `members` relation to `users` (User[]) and added `familyMembers` (FamilyMember[])
- Added `familyMember` optional 1:1 relation on User → FamilyMember
- Added constant enums in constants.ts: GENDER_OPTIONS, RELATIONSHIP_OPTIONS, MARITAL_STATUS_OPTIONS, EDUCATION_OPTIONS, CITIZENSHIP_OPTIONS with label maps
- Created `/api/family-members` route with GET/POST/PUT/DELETE — full CRUD with auth checks (admin=all, warga=own family only)
- Updated `/api/families` route — GET now includes familyMembers + rondaGroup; POST auto-creates KK member; PUT syncs familyHead with KK member
- Fixed ronda groups API — removed `memberCount` field (dropped column), uses simpler select
- Fixed enrollment API — memberCount now from _count.familyMembers
- Built admin WargaPage (1427 lines): two-panel layout, family list + detail, full member table with all demographics, add/edit/delete dialogs
- Built mobile ProfilPage (1031 lines): profile card, family info, expandable member cards, add/edit member dialog, phone edit, logout
- Seeded test data: 11 families with KK members, one family (Ahmad Dahlan) with 4 members including wife, child, and parent

Stage Summary:
- FamilyMember model fully operational with all demographic fields
- Admin can manage all KK and member data from desktop dashboard
- Warga can self-service enter/edit their family member data from mobile
- Data syncs automatically (both admin and warga read from same API)
- All APIs tested and working (families, family-members, ronda groups)
- ESLint passes with 0 errors
