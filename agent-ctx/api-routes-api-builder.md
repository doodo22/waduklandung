---
Task ID: api-routes
Agent: API Builder
Task: Create 6 API route files for ronda groups, jimpitan, and settings

Work Log:
- Read worklog.md and existing codebase (Prisma schema, auth helpers, existing API routes)
- Created /api/ronda/groups/route.ts — GET all groups with families, POST assign family to group
- Created /api/ronda/groups/[id]/route.ts — GET group detail, PUT update group, DELETE group (with family check)
- Created /api/jimpitan/enrollment/route.ts — GET all families with enrollment status, POST toggle enrollment
- Created /api/jimpitan/collection/route.ts — GET daily collection with auto group detection, POST batch save with upsert
- Created /api/jimpitan/shortages/route.ts — GET shortage summary (per-selapanan or all), POST settle shortages with carry-over
- Created /api/settings/route.ts — GET all settings, PUT update setting (upsert)
- All routes use getAuthUser(request) for auth and isAdmin(role) for admin checks
- ESLint passes with 0 errors (1 pre-existing warning)
- Dev server running normally

Stage Summary:
- 6 new API route files created covering all specified endpoints
- Key implementation details:
  - Ronda group duty determined by (date.getDay() + 1) % 7 for dayOfWeek
  - JimpitanLog uses upsert on @@unique([familyId, date]) constraint
  - JimpitanShortage carry-over: unsettled amounts propagate to next selapanan
  - Settings uses upsert for create-or-update semantics
  - Transaction records created for shortage settlements (type=INCOME, category=JIMPITAN)
  - All errors handled gracefully with proper HTTP status codes
