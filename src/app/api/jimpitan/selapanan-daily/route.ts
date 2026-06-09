import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helpers';

// Helper: Get dayOfWeek for a date string
// "Malam Senin" = Sunday night going into Monday = dayOfWeek=1
function getDayOfWeekForDate(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  return (date.getDay() + 1) % 7;
}

const DAY_NAMES: Record<number, string> = {
  0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu',
  4: 'Kamis', 5: 'Jumat', 6: 'Sabtu',
};

const DAY_LABELS: Record<number, string> = {
  0: 'Mal. Minggu', 1: 'Mal. Senin', 2: 'Mal. Selasa',
  3: 'Mal. Rabu', 4: 'Mal. Kamis', 5: 'Mal. Jumat', 6: 'Mal. Sabtu',
};

// GET /api/jimpitan/selapanan-daily?selapananId=xxx
// Returns full 35-day daily jimpitan matrix for a selapanan period
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const selapananId = searchParams.get('selapananId');

    if (!selapananId) {
      return NextResponse.json({ error: 'selapananId wajib diisi' }, { status: 400 });
    }

    const selapanan = await db.selapanan.findUnique({
      where: { id: selapananId },
    });

    if (!selapanan) {
      return NextResponse.json({ error: 'Selapanan tidak ditemukan' }, { status: 404 });
    }

    // Get all HARIAN families with enrollment (active in daily jimpitan)
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
        rondaGroupId: true,
        rondaGroup: { select: { id: true, name: true, dayOfWeek: true } },
      },
    });

    // Generate all 35 dates in the selapanan period
    const startDate = new Date(selapanan.periodeStart + 'T00:00:00');
    const dates: string[] = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    // Get all jimpitan logs for this selapanan period
    const logs = await db.jimpitanLog.findMany({
      where: {
        selapananId,
        familyId: { in: harianFamilies.map(f => f.id) },
      },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    // Build a lookup map: `${familyId}_${date}` -> log
    const logMap = new Map<string, {
      paidAmount: number;
      shortage: number;
      expectedAmount: number;
      groupName: string | null;
    }>();

    for (const log of logs) {
      logMap.set(`${log.familyId}_${log.date}`, {
        paidAmount: log.paidAmount,
        shortage: log.shortage,
        expectedAmount: log.expectedAmount,
        groupName: log.group?.name ?? null,
      });
    }

    // Get jimpitan amount from settings
    const jimpitanSetting = await db.settings.findUnique({
      where: { key: 'jimpitan_amount' },
    });
    const jimpitanAmount = jimpitanSetting ? parseInt(jimpitanSetting.value, 10) || 1000 : 1000;

    // Get ronda groups for reference
    const rondaGroups = await db.rondaGroup.findMany({
      where: { isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Build daily columns info
    const dailyColumns = dates.map((date, idx) => {
      const dayOfWeek = getDayOfWeekForDate(date);
      const group = rondaGroups.find(g => g.dayOfWeek === dayOfWeek);
      return {
        date,
        dayOfWeek,
        dayName: DAY_NAMES[dayOfWeek],
        nightLabel: DAY_LABELS[dayOfWeek],
        weekNumber: Math.floor(idx / 7) + 1,
        dayInWeek: (idx % 7) + 1,
        groupName: group?.name ?? null,
        groupId: group?.id ?? null,
      };
    });

    // Build family rows with daily data
    const familyRows = harianFamilies.map(family => {
      const dailyData: Record<string, {
        paidAmount: number;
        shortage: number;
        expectedAmount: number;
        groupName: string | null;
      }> = {};

      let totalPaid = 0;
      let totalShortage = 0;
      let daysPaid = 0;
      let daysPartial = 0;
      let daysMissed = 0;

      for (const date of dates) {
        const key = `${family.id}_${date}`;
        const log = logMap.get(key);

        if (log) {
          dailyData[date] = log;
          totalPaid += log.paidAmount;
          totalShortage += log.shortage;
          if (log.paidAmount >= log.expectedAmount) daysPaid++;
          else if (log.paidAmount > 0) daysPartial++;
          else daysMissed++;
        } else {
          // No log for this date - check if date is in the past or future
          const dateObj = new Date(date + 'T23:59:59');
          const isFuture = dateObj > new Date();

          dailyData[date] = {
            paidAmount: 0,
            shortage: isFuture ? 0 : jimpitanAmount,
            expectedAmount: jimpitanAmount,
            groupName: null,
          };

          if (!isFuture) {
            totalShortage += jimpitanAmount;
            daysMissed++;
          }
        }
      }

      const totalExpected = dates.length * jimpitanAmount;

      return {
        familyId: family.id,
        familyHead: family.familyHead,
        rondaGroup: family.rondaGroup ? {
          id: family.rondaGroup.id,
          name: family.rondaGroup.name,
          dayOfWeek: family.rondaGroup.dayOfWeek,
        } : null,
        dailyData,
        summary: {
          totalExpected,
          totalPaid,
          totalShortage,
          daysPaid,
          daysPartial,
          daysMissed,
          paymentRate: totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0,
        },
      };
    });

    // Overall summary
    const overallSummary = {
      totalFamilies: harianFamilies.length,
      totalDays: dates.length,
      totalExpected: harianFamilies.length * dates.length * jimpitanAmount,
      totalPaid: familyRows.reduce((sum, f) => sum + f.summary.totalPaid, 0),
      totalShortage: familyRows.reduce((sum, f) => sum + f.summary.totalShortage, 0),
      daysCollected: new Set(logs.map(l => l.date)).size,
      avgPaymentRate: familyRows.length > 0
        ? Math.round(familyRows.reduce((sum, f) => sum + f.summary.paymentRate, 0) / familyRows.length)
        : 0,
    };

    return NextResponse.json({
      selapanan: {
        id: selapanan.id,
        number: selapanan.number,
        periodeStart: selapanan.periodeStart,
        periodeEnd: selapanan.periodeEnd,
        meetingDate: selapanan.meetingDate,
        status: selapanan.status,
      },
      jimpitanAmount,
      dailyColumns,
      familyRows,
      overallSummary,
    });
  } catch (error) {
    console.error('Jimpitan Selapanan Daily GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
