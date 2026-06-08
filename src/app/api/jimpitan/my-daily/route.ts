import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helpers';

// Helper: Get dayOfWeek for a date string
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

// GET /api/jimpitan/my-daily?selapananId=xxx
// Returns personal daily jimpitan history for the current selapanan
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!authUser.familyId) {
      return NextResponse.json({ error: 'Anda belum terdaftar di keluarga' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const selapananId = searchParams.get('selapananId');

    // Find the active selapanan if not specified
    let selapanan;
    if (selapananId) {
      selapanan = await db.selapanan.findUnique({ where: { id: selapananId } });
    } else {
      selapanan = await db.selapanan.findFirst({
        where: { status: 'UPCOMING' },
        orderBy: { periodeStart: 'desc' },
      });
    }

    if (!selapanan) {
      return NextResponse.json({ error: 'Tidak ada selapanan aktif' }, { status: 404 });
    }

    // Get family info
    const family = await db.family.findUnique({
      where: { id: authUser.familyId },
      select: {
        id: true,
        familyHead: true,
        jimpitanType: true,
        jimpitanAmount: true,
        isActive: true,
        jimpitanEnrollment: { select: { isActive: true } },
      },
    });

    if (!family) {
      return NextResponse.json({ error: 'Data keluarga tidak ditemukan' }, { status: 404 });
    }

    // If BULANAN, return different response
    if (family.jimpitanType === 'BULANAN') {
      return NextResponse.json({
        family: {
          id: family.id,
          familyHead: family.familyHead,
          jimpitanType: family.jimpitanType,
          jimpitanAmount: family.jimpitanAmount,
        },
        selapanan: {
          id: selapanan.id,
          number: selapanan.number,
          periodeStart: selapanan.periodeStart,
          periodeEnd: selapanan.periodeEnd,
        },
        isBulanan: true,
        monthlyAmount: family.jimpitanAmount,
        message: 'Anda terdaftar sebagai peserta iuran bulanan',
      });
    }

    // Get jimpitan amount from settings
    const jimpitanSetting = await db.settings.findUnique({
      where: { key: 'jimpitan_amount' },
    });
    const jimpitanAmount = jimpitanSetting ? parseInt(jimpitanSetting.value, 10) || 1000 : 1000;

    // Generate all 35 dates
    const startDate = new Date(selapanan.periodeStart + 'T00:00:00');
    const dates: string[] = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    // Get all logs for this family in this selapanan
    const logs = await db.jimpitanLog.findMany({
      where: {
        familyId: authUser.familyId,
        selapananId: selapanan.id,
      },
      include: {
        group: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    });

    const logMap = new Map(logs.map(l => [l.date, l]));

    // Get ronda groups
    const rondaGroups = await db.rondaGroup.findMany({
      where: { isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Build daily data
    const dailyData = dates.map((date, idx) => {
      const dayOfWeek = getDayOfWeekForDate(date);
      const group = rondaGroups.find(g => g.dayOfWeek === dayOfWeek);
      const log = logMap.get(date);
      const dateObj = new Date(date + 'T23:59:59');
      const isFuture = dateObj > new Date();
      const isToday = date === new Date().toISOString().split('T')[0];

      return {
        date,
        dayOfWeek,
        dayName: DAY_NAMES[dayOfWeek],
        nightLabel: DAY_LABELS[dayOfWeek],
        weekNumber: Math.floor(idx / 7) + 1,
        dayInWeek: (idx % 7) + 1,
        groupName: group?.name ?? null,
        isFuture,
        isToday,
        paidAmount: log?.paidAmount ?? 0,
        shortage: log?.shortage ?? (isFuture ? 0 : jimpitanAmount),
        expectedAmount: jimpitanAmount,
        status: log
          ? (log.paidAmount >= jimpitanAmount ? 'PAID' : log.paidAmount > 0 ? 'PARTIAL' : 'UNPAID')
          : (isFuture ? 'FUTURE' : 'UNPAID'),
      };
    });

    // Calculate summary
    const pastDays = dailyData.filter(d => !d.isFuture);
    const totalPaid = pastDays.reduce((sum, d) => sum + d.paidAmount, 0);
    const totalShortage = pastDays.reduce((sum, d) => sum + d.shortage, 0);
    const totalExpected = pastDays.length * jimpitanAmount;
    const daysPaid = pastDays.filter(d => d.status === 'PAID').length;
    const daysPartial = pastDays.filter(d => d.status === 'PARTIAL').length;
    const daysMissed = pastDays.filter(d => d.status === 'UNPAID').length;

    return NextResponse.json({
      family: {
        id: family.id,
        familyHead: family.familyHead,
        jimpitanType: family.jimpitanType,
        jimpitanAmount: family.jimpitanAmount,
      },
      selapanan: {
        id: selapanan.id,
        number: selapanan.number,
        periodeStart: selapanan.periodeStart,
        periodeEnd: selapanan.periodeEnd,
        meetingDate: selapanan.meetingDate,
      },
      isBulanan: false,
      jimpitanAmount,
      dailyData,
      summary: {
        totalDays: dates.length,
        daysElapsed: pastDays.length,
        daysRemaining: dates.length - pastDays.length,
        totalExpected,
        totalPaid,
        totalShortage,
        daysPaid,
        daysPartial,
        daysMissed,
        paymentRate: totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('Jimpitan My Daily GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
