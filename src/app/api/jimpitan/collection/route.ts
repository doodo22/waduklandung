import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// Helper: Get dayOfWeek for a date string (YYYY-MM-DD)
// The ronda group on duty tonight corresponds to TOMORROW's dayOfWeek.
// "Malam Senin" (Monday night) occurs on Sunday date -> dayOfWeek=1
// So for a given date, the group on duty = tomorrow's dayOfWeek
function getDayOfWeekForDate(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  // getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
  // Tomorrow's dayOfWeek = (date.getDay() + 1) % 7
  // But our convention: 0=Minggu, 1=Senin, ..., 6=Sabtu
  // "Malam Minggu" = Saturday night going into Sunday = dayOfWeek=0
  // For date Sunday (getDay()=0), tomorrow is Monday -> dayOfWeek=1 -> "Malam Senin"
  // For date Saturday (getDay()=6), tomorrow is Sunday -> dayOfWeek=0 -> "Malam Minggu"
  return (date.getDay() + 1) % 7;
}

// Helper: Find the current/upcoming selapanan for a given date
async function findSelapananForDate(dateStr: string) {
  const selapanan = await db.selapanan.findFirst({
    where: {
      periodeStart: { lte: dateStr },
      periodeEnd: { gte: dateStr },
      status: { not: 'CANCELLED' },
    },
    orderBy: { periodeStart: 'desc' },
  });
  return selapanan;
}

// Helper: Get jimpitan amount from settings
async function getJimpitanAmount(): Promise<number> {
  const setting = await db.settings.findUnique({
    where: { key: 'jimpitan_amount' },
  });
  return setting ? parseInt(setting.value, 10) || 0 : 0;
}

// GET /api/jimpitan/collection — Get today's collection data
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Auto-determine which ronda group is on duty
    const dayOfWeek = getDayOfWeekForDate(date);
    const group = await db.rondaGroup.findFirst({
      where: { dayOfWeek, isActive: true },
    });

    // Get jimpitan amount from settings
    const jimpitanAmount = await getJimpitanAmount();

    // Get HARIAN families with enrollment
    const harianFamilies = await db.family.findMany({
      where: {
        isActive: true,
        jimpitanType: 'HARIAN',
        jimpitanEnrollment: { isActive: true },
      },
      orderBy: { familyHead: 'asc' },
      select: {
        id: true,
        familyHead: true,
        jimpitanType: true,
        jimpitanAmount: true,
      },
    });

    // Get BULANAN families (auto-included, no enrollment needed)
    const bulananFamilies = await db.family.findMany({
      where: {
        isActive: true,
        jimpitanType: 'BULANAN',
      },
      orderBy: { familyHead: 'asc' },
      select: {
        id: true,
        familyHead: true,
        jimpitanType: true,
        jimpitanAmount: true,
      },
    });

    // Get existing collection logs for this date
    const existingLogs = await db.jimpitanLog.findMany({
      where: { date },
      include: {
        family: { select: { id: true, familyHead: true } },
      },
    });

    // Build a map of existing logs by familyId
    const logMap = new Map(existingLogs.map((log) => [log.familyId, log]));

    // Build entries for HARIAN families (normal collection)
    const harianEntries = harianFamilies.map((family) => {
      const existingLog = logMap.get(family.id);
      return {
        familyId: family.id,
        familyHead: family.familyHead,
        jimpitanType: 'HARIAN' as const,
        monthlyAmount: 0,
        expectedAmount: jimpitanAmount,
        paidAmount: existingLog?.paidAmount ?? 0,
        shortage: existingLog?.shortage ?? jimpitanAmount,
        notes: existingLog?.notes ?? null,
        logId: existingLog?.id ?? null,
      };
    });

    // Build entries for BULANAN families (disabled, informational only)
    const bulananEntries = bulananFamilies.map((family) => {
      const existingLog = logMap.get(family.id);
      return {
        familyId: family.id,
        familyHead: family.familyHead,
        jimpitanType: 'BULANAN' as const,
        monthlyAmount: family.jimpitanAmount,
        expectedAmount: 0, // Not part of daily collection
        paidAmount: 0,
        shortage: 0,
        notes: existingLog?.notes ?? null,
        logId: existingLog?.id ?? null,
      };
    });

    // Combine: HARIAN first, then BULANAN
    const entries = [...harianEntries, ...bulananEntries];

    // Calculate totals (only from HARIAN entries)
    const totalExpected = harianEntries.reduce((sum, e) => sum + e.expectedAmount, 0);
    const totalPaid = harianEntries.reduce((sum, e) => sum + e.paidAmount, 0);
    const totalShortage = harianEntries.reduce((sum, e) => sum + e.shortage, 0);

    return NextResponse.json({
      date,
      group: group ? {
        id: group.id,
        name: group.name,
        dayOfWeek: group.dayOfWeek,
      } : null,
      jimpitanAmount,
      entries,
      summary: {
        totalFamilies: harianEntries.length,
        totalBulanan: bulananEntries.length,
        totalExpected,
        totalPaid,
        totalShortage,
      },
    });
  } catch (error) {
    console.error('Jimpitan Collection GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST /api/jimpitan/collection — Batch save daily collection (Admin or Ronda member on duty)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { date, entries } = await request.json();

    if (!date || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'date dan entries wajib diisi' }, { status: 400 });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Format tanggal harus YYYY-MM-DD' }, { status: 400 });
    }

    // Determine which ronda group is on duty for this date
    const dayOfWeek = getDayOfWeekForDate(date);
    const dutyGroup = await db.rondaGroup.findFirst({
      where: { dayOfWeek, isActive: true },
    });

    // Check authorization: Admin OR member of the ronda group on duty
    const userIsAdmin = isAdmin(authUser.role);
    let userIsOnDuty = false;

    if (!userIsAdmin && authUser.familyId && dutyGroup) {
      // Check if user's family belongs to the duty group
      const familyInGroup = dutyGroup
        ? await db.family.findFirst({
            where: {
              id: authUser.familyId,
              rondaGroupId: dutyGroup.id,
            },
          })
        : null;
      userIsOnDuty = !!familyInGroup;
    }

    if (!userIsAdmin && !userIsOnDuty) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses. Hanya admin atau anggota grup ronda yang bertugas pada tanggal tersebut yang dapat menginput jimpitan.' },
        { status: 403 }
      );
    }

    // Get jimpitan amount from settings
    const jimpitanAmount = await getJimpitanAmount();

    // Find the current selapanan for this date
    const selapanan = await findSelapananForDate(date);

    // Get BULANAN family IDs to skip
    const bulananFamilies = await db.family.findMany({
      where: { jimpitanType: 'BULANAN', isActive: true },
      select: { id: true },
    });
    const bulananIds = new Set(bulananFamilies.map(f => f.id));

    // Process each entry with upsert (skip BULANAN families)
    const results = [];

    for (const entry of entries) {
      const { familyId, paidAmount, notes } = entry;

      if (!familyId || paidAmount === undefined) continue;

      // Skip BULANAN families — they are not part of daily collection
      if (bulananIds.has(familyId)) continue;

      const expectedAmount = jimpitanAmount;
      const shortage = Math.max(0, expectedAmount - paidAmount);

      const result = await db.jimpitanLog.upsert({
        where: {
          familyId_date: { familyId, date },
        },
        create: {
          familyId,
          date,
          expectedAmount,
          paidAmount,
          shortage,
          groupId: dutyGroup?.id ?? null,
          selapananId: selapanan?.id ?? null,
          notes: notes ?? null,
          createdBy: authUser.id,
        },
        update: {
          expectedAmount,
          paidAmount,
          shortage,
          groupId: dutyGroup?.id ?? null,
          selapananId: selapanan?.id ?? null,
          notes: notes ?? null,
          createdBy: authUser.id,
        },
      });

      results.push(result);
    }

    // After saving all entries, recalculate shortages per family for this selapanan period
    if (selapanan) {
      // Get all jimpitan logs for each family in this selapanan period
      const familyIds = [...new Set(results.map((r: { familyId: string }) => r.familyId))];
      
      for (const familyId of familyIds) {
        const familyLogs = await db.jimpitanLog.findMany({
          where: {
            familyId,
            selapananId: selapanan.id,
            shortage: { gt: 0 },
          },
        });
        
        const totalShortage = familyLogs.reduce((sum: number, log: { shortage: number }) => sum + log.shortage, 0);
        
        if (totalShortage > 0) {
          await db.jimpitanShortage.upsert({
            where: {
              familyId_selapananId: { familyId, selapananId: selapanan.id },
            },
            create: {
              familyId,
              selapananId: selapanan.id,
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
          // No shortage - mark as settled if exists
          await db.jimpitanShortage.updateMany({
            where: {
              familyId,
              selapananId: selapanan.id,
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

    return NextResponse.json({
      message: `Berhasil menyimpan ${results.length} catatan jimpitan`,
      date,
      groupId: dutyGroup?.id ?? null,
      selapananId: selapanan?.id ?? null,
      savedCount: results.length,
    });
  } catch (error) {
    console.error('Jimpitan Collection POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
