import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a YYYY-MM-DD date to the RondaGroup.dayOfWeek convention:
 *  0 = Minggu (Sunday), 1 = Senin, ..., 6 = Sabtu (Saturday).
 *
 *  Jimpitan is collected at night during ronda. "Malam Minggu" is the night
 *  from Saturday into Sunday, so for a Saturday date the group on duty is
 *  the one with dayOfWeek = 0 (Minggu). This is equivalent to shifting JS
 *  getDay() forward by one: (getDay() + 1) % 7. */
function getDayOfWeekForDate(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  return (date.getDay() + 1) % 7;
}

/** Return all YYYY-MM-DD strings from `startStr` through `endStr` inclusive. */
function getDatesBetween(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');

  const current = new Date(start.getTime());
  while (current.getTime() <= end.getTime()) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/** Today's date in YYYY-MM-DD using local system time. */
function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Yesterday's date in YYYY-MM-DD. */
function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Fetch jimpitan per-night amount from Settings (key: 'jimpitan_amount').
 *  Falls back to 1000 when the setting is absent or unparseable. */
async function getJimpitanAmount(): Promise<number> {
  const setting = await db.settings.findUnique({
    where: { key: 'jimpitan_amount' },
  });
  if (!setting) return 1000;
  const parsed = parseInt(setting.value, 10);
  return Number.isNaN(parsed) ? 1000 : parsed;
}

/** Find a system user ID to use as `createdBy` for auto-generated logs.
 *  Prefers KETUA_RT, then BENDAHARA. */
async function findSystemUserId(): Promise<string | null> {
  const user = await db.user.findFirst({
    where: {
      role: { in: ['KETUA_RT', 'BENDAHARA'] },
      status: 'ACTIVE',
    },
    orderBy: [
      { role: 'asc' }, // BENDAHARA < KETUA_RT alphabetically; KETUA_RT first in priority
    ],
  });
  return user?.id ?? null;
}

/** Recalculate & upsert JimpitanShortage for a set of families in a selapanan. */
async function recalculateShortages(
  familyIds: string[],
  selapananId: string,
): Promise<void> {
  for (const familyId of familyIds) {
    const logs = await db.jimpitanLog.findMany({
      where: { familyId, selapananId },
    });

    const totalShortage = logs.reduce((sum, log) => sum + log.shortage, 0);

    if (totalShortage > 0) {
      await db.jimpitanShortage.upsert({
        where: {
          familyId_selapananId: { familyId, selapananId },
        },
        create: {
          familyId,
          selapananId,
          totalShortage,
          isSettled: false,
          settledAmount: 0,
          carriedOver: false,
        },
        update: {
          totalShortage,
        },
      });
    } else {
      // No shortage remaining — mark existing record as settled
      await db.jimpitanShortage.updateMany({
        where: {
          familyId,
          selapananId,
          isSettled: false,
        },
        data: {
          totalShortage: 0,
          isSettled: true,
          settledAmount: 0,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Shared core logic (used by both GET preview & POST generate)
// ---------------------------------------------------------------------------

interface RecapContext {
  selapananId: string;
  dates: string[];
  familyCount: number;
  daysElapsed: number;
  generatedCount: number;
  skippedCount: number;
  affectedFamilyIds: string[];
}

async function buildRecapContext(
  selapananIdOverride?: string,
  dryRun = true,
  createdByOverride?: string,
): Promise<{ ctx: RecapContext | null; error?: string; status?: number }> {
  // ---- 1. Resolve the current selapanan ----
  const today = getTodayStr();
  let selapanan;

  if (selapananIdOverride) {
    selapanan = await db.selapanan.findUnique({
      where: { id: selapananIdOverride },
    });
  } else {
    selapanan = await db.selapanan.findFirst({
      where: {
        status: 'UPCOMING',
        periodeStart: { lte: today },
        periodeEnd: { gte: today },
      },
    });
  }

  if (!selapanan) {
    return {
      ctx: null,
      error: 'Tidak ada selapanan aktif saat ini',
      status: 404,
    };
  }

  // ---- 2. Determine past dates (periodeStart … yesterday) ----
  const yesterday = getYesterdayStr();

  // If yesterday is before the selapanan even started, nothing to generate.
  if (yesterday < selapanan.periodeStart) {
    return {
      ctx: {
        selapananId: selapanan.id,
        dates: [],
        familyCount: 0,
        daysElapsed: 0,
        generatedCount: 0,
        skippedCount: 0,
        affectedFamilyIds: [],
      },
    };
  }

  const effectiveEnd =
    yesterday <= selapanan.periodeEnd ? yesterday : selapanan.periodeEnd;
  const dates = getDatesBetween(selapanan.periodeStart, effectiveEnd);

  // ---- 3. Get HARIAN families with active enrollment ----
  const harianFamilies = await db.family.findMany({
    where: {
      isActive: true,
      jimpitanType: 'HARIAN',
      jimpitanEnrollment: { isActive: true },
    },
    select: { id: true },
  });

  const familyIds = harianFamilies.map((f) => f.id);

  if (familyIds.length === 0 || dates.length === 0) {
    return {
      ctx: {
        selapananId: selapanan.id,
        dates,
        familyCount: familyIds.length,
        daysElapsed: dates.length,
        generatedCount: 0,
        skippedCount: 0,
        affectedFamilyIds: [],
      },
    };
  }

  // ---- 4. Find existing logs for these families + dates ----
  const existingLogs = await db.jimpitanLog.findMany({
    where: {
      familyId: { in: familyIds },
      date: { in: dates },
    },
    select: { familyId: true, date: true },
  });

  const existingSet = new Set(
    existingLogs.map((l) => `${l.familyId}_${l.date}`),
  );

  // ---- 5. Build the list of missing (family, date) pairs ----
  const missing: { familyId: string; date: string }[] = [];

  for (const familyId of familyIds) {
    for (const date of dates) {
      if (!existingSet.has(`${familyId}_${date}`)) {
        missing.push({ familyId, date });
      }
    }
  }

  const generatedCount = missing.length;
  const skippedCount = familyIds.length * dates.length - generatedCount;

  // ---- 6. If not a dry run, actually generate the logs ----
  let affectedFamilyIds: string[] = [];

  if (!dryRun && missing.length > 0) {
    const jimpitanAmount = await getJimpitanAmount();

    // Resolve createdBy
    const systemUserId =
      createdByOverride ?? (await findSystemUserId());
    if (!systemUserId) {
      return {
        ctx: null,
        error:
          'Tidak ditemukan user admin (KETUA_RT/BENDAHARA) yang aktif untuk dijadikan pembuat log otomatis',
        status: 400,
      };
    }

    // Pre-load ronda groups indexed by dayOfWeek
    const rondaGroups = await db.rondaGroup.findMany({
      where: { isActive: true },
    });
    const groupByDay = new Map(rondaGroups.map((g) => [g.dayOfWeek, g.id]));

    // Use createMany with skipDuplicates for efficiency
    const logsToCreate = missing.map((m) => {
      const dayOfWeek = getDayOfWeekForDate(m.date);
      const groupId = groupByDay.get(dayOfWeek) ?? null;

      return {
        familyId: m.familyId,
        date: m.date,
        expectedAmount: jimpitanAmount,
        paidAmount: 0,
        shortage: jimpitanAmount,
        groupId,
        selapananId: selapanan.id,
        notes: null,
        createdBy: systemUserId,
      };
    });

    const createResult = await db.jimpitanLog.createMany({
      data: logsToCreate,
      skipDuplicates: true,
    });

    const actualCreated = createResult.count;

    // Collect affected family IDs (for shortage recalculation)
    affectedFamilyIds = [...new Set(missing.map((m) => m.familyId))];

    // ---- 7. Recalculate shortages ----
    await recalculateShortages(affectedFamilyIds, selapanan.id);

    // Adjust counts if createMany skipped some due to race conditions
    const raceSkipped = generatedCount - actualCreated;

    return {
      ctx: {
        selapananId: selapanan.id,
        dates,
        familyCount: familyIds.length,
        daysElapsed: dates.length,
        generatedCount: actualCreated,
        skippedCount: skippedCount + raceSkipped,
        affectedFamilyIds,
      },
    };
  }

  // Dry-run: just return counts, no DB writes
  if (!dryRun) {
    // dryRun=false but missing.length === 0 — nothing to generate
    affectedFamilyIds = [];
  }

  return {
    ctx: {
      selapananId: selapanan.id,
      dates,
      familyCount: familyIds.length,
      daysElapsed: dates.length,
      generatedCount,
      skippedCount,
      affectedFamilyIds,
    },
  };
}

// ---------------------------------------------------------------------------
// GET — preview / dry-run
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const selapananId = searchParams.get('selapananId') || undefined;

    const { ctx, error, status } = await buildRecapContext(
      selapananId,
      true, // dry run
    );

    if (!ctx) {
      return NextResponse.json({ error }, { status: status ?? 500 });
    }

    return NextResponse.json({
      message: `Preview: akan generate ${ctx.generatedCount} log jimpitan untuk ${ctx.familyCount} KK \u00D7 ${ctx.daysElapsed} hari`,
      generatedCount: ctx.generatedCount,
      skippedCount: ctx.skippedCount,
      familyCount: ctx.familyCount,
      daysElapsed: ctx.daysElapsed,
      selapananId: ctx.selapananId,
      dates: ctx.dates,
    });
  } catch (error) {
    console.error('Auto-recap GET error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat preview auto-recap' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — actually generate missing logs
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdmin(authUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden — hanya admin yang dapat generate auto-recap' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const selapananId = body.selapananId || undefined;
    const createdBy = body.createdBy || undefined;

    const { ctx, error, status } = await buildRecapContext(
      selapananId,
      false, // not a dry run
      createdBy,
    );

    if (!ctx) {
      return NextResponse.json({ error }, { status: status ?? 500 });
    }

    return NextResponse.json({
      message: `Berhasil generate ${ctx.generatedCount} log jimpitan untuk ${ctx.familyCount} KK \u00D7 ${ctx.daysElapsed} hari`,
      generatedCount: ctx.generatedCount,
      skippedCount: ctx.skippedCount,
      familyCount: ctx.familyCount,
      daysElapsed: ctx.daysElapsed,
      selapananId: ctx.selapananId,
      dates: ctx.dates,
    });
  } catch (error) {
    console.error('Auto-recap POST error:', error);
    return NextResponse.json(
      { error: 'Gagal generate auto-recap' },
      { status: 500 },
    );
  }
}
