import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// Helper: Count how many month boundaries fall within a period
// Each month boundary = 1 monthly payment required
function countMonthBoundaries(periodeStart: string, periodeEnd: string): number {
  const start = new Date(periodeStart + 'T00:00:00');
  const end = new Date(periodeEnd + 'T00:00:00');

  const startMonth = start.getMonth();
  const startYear = start.getFullYear();
  const endMonth = end.getMonth();
  const endYear = end.getFullYear();

  // Total months spanned (inclusive of both months)
  const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  return months;
}

// GET /api/selapanan/recap?selapananId=xxx
// Returns comprehensive financial recap for a selapanan period
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const selapananId = searchParams.get('selapananId');

    if (!selapananId) {
      return NextResponse.json(
        { error: 'selapananId wajib diisi' },
        { status: 400 }
      );
    }

    // Get the selapanan period
    const selapanan = await db.selapanan.findUnique({
      where: { id: selapananId },
      include: {
        details: true,
        shortages: {
          include: {
            family: { select: { id: true, familyHead: true } },
          },
          orderBy: { family: { familyHead: 'asc' } },
        },
        levyPayments: {
          include: {
            item: {
              include: {
                levy: { select: { id: true, name: true } },
                family: { select: { id: true, familyHead: true } },
              },
            },
          },
        },
      },
    });

    if (!selapanan) {
      return NextResponse.json(
        { error: 'Selapanan tidak ditemukan' },
        { status: 404 }
      );
    }

    // =============================================
    // 1. JIMPITAN DAILY COLLECTION PER RONDA GROUP
    // =============================================
    const jimpitanLogs = await db.jimpitanLog.findMany({
      where: {
        selapananId,
      },
      include: {
        family: { select: { id: true, familyHead: true, jimpitanType: true } },
        group: { select: { id: true, name: true, dayOfWeek: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Group by ronda group
    const groupMap = new Map<string, {
      groupId: string;
      groupName: string;
      dayOfWeek: number;
      totalExpected: number;
      totalPaid: number;
      totalShortage: number;
      entries: typeof jimpitanLogs;
    }>();

    for (const log of jimpitanLogs) {
      const gKey = log.groupId || 'ungrouped';
      if (!groupMap.has(gKey)) {
        groupMap.set(gKey, {
          groupId: log.groupId || 'ungrouped',
          groupName: log.group?.name || 'Tidak Tergrup',
          dayOfWeek: log.group?.dayOfWeek ?? -1,
          totalExpected: 0,
          totalPaid: 0,
          totalShortage: 0,
          entries: [],
        });
      }
      const g = groupMap.get(gKey)!;
      g.totalExpected += log.expectedAmount;
      g.totalPaid += log.paidAmount;
      g.totalShortage += log.shortage;
      g.entries.push(log);
    }

    const dailyByGroup = Array.from(groupMap.values()).sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek
    );

    const totalJimpitanDaily = jimpitanLogs.reduce((sum, l) => sum + l.paidAmount, 0);

    // =============================================
    // 2. MONTHLY PAYERS
    // =============================================
    const monthlyFamilies = await db.family.findMany({
      where: {
        jimpitanType: 'BULANAN',
        isActive: true,
      },
      select: {
        id: true,
        familyHead: true,
        jimpitanAmount: true,
        jimpitanType: true,
      },
      orderBy: { familyHead: 'asc' },
    });

    // Calculate how many months the 35-day period spans
    const monthsSpanned = countMonthBoundaries(selapanan.periodeStart, selapanan.periodeEnd);

    const monthlyPayers = monthlyFamilies.map((f) => ({
      familyId: f.id,
      familyHead: f.familyHead,
      monthlyAmount: f.jimpitanAmount,
      monthsSpanned,
      totalExpected: f.jimpitanAmount * monthsSpanned,
    }));

    const totalJimpitanMonthly = monthlyPayers.reduce((sum, f) => sum + f.totalExpected, 0);

    // =============================================
    // 3. RONDA FEES (BAYAR_IURAN families)
    // =============================================
    const rondaFeeFamilies = await db.family.findMany({
      where: {
        rondaStatus: 'BAYAR_IURAN',
        isActive: true,
      },
      select: {
        id: true,
        familyHead: true,
        rondaStatus: true,
        rondaFee: true,
      },
      orderBy: { familyHead: 'asc' },
    });

    const rondaFees = rondaFeeFamilies.map((f) => ({
      familyId: f.id,
      familyHead: f.familyHead,
      rondaStatus: f.rondaStatus,
      rondaFeePerSelapanan: f.rondaFee,
      totalExpected: f.rondaFee, // 1x per selapanan
    }));

    const totalRondaFee = rondaFees.reduce((sum, f) => sum + f.totalExpected, 0);

    // =============================================
    // 4. SHORTAGES FROM PREVIOUS SELAPANAN
    // =============================================
    // Find shortages carried over from previous periods that are unpaid
    const previousShortages = await db.jimpitanShortage.findMany({
      where: {
        carriedOver: true,
        isSettled: false,
        selapanan: {
          periodeEnd: { lt: selapanan.periodeStart },
          status: { not: 'CANCELLED' },
        },
      },
      include: {
        family: { select: { id: true, familyHead: true } },
        selapanan: { select: { id: true, periodeStart: true, periodeEnd: true, number: true } },
      },
      orderBy: { family: { familyHead: 'asc' } },
    });

    const previousShortageItems = previousShortages.map((s) => ({
      familyId: s.familyId,
      familyHead: s.family.familyHead,
      fromSelapanan: s.selapanan.number,
      fromPeriode: `${s.selapanan.periodeStart} s/d ${s.selapanan.periodeEnd}`,
      totalShortage: s.totalShortage,
      settledAmount: s.settledAmount,
      remaining: s.totalShortage - s.settledAmount,
    }));

    const totalPreviousShortage = previousShortageItems.reduce((sum, s) => sum + s.remaining, 0);

    // Also include current period shortages
    const currentShortages = selapanan.shortages
      .filter((s) => !s.isSettled || s.carriedOver)
      .map((s) => ({
        familyId: s.familyId,
        familyHead: s.family.familyHead,
        totalShortage: s.totalShortage,
        settledAmount: s.settledAmount,
        remaining: s.totalShortage - s.settledAmount,
        isSettled: s.isSettled,
        carriedOver: s.carriedOver,
      }));

    const totalCurrentShortage = currentShortages.reduce((sum, s) => sum + s.remaining, 0);

    // =============================================
    // 5. ACTIVE CUSTOM LEVIES WITH ITEMS AND PAYMENT STATUS
    // =============================================
    const activeLevies = await db.customLevy.findMany({
      where: { isActive: true },
      include: {
        items: {
          include: {
            family: { select: { id: true, familyHead: true } },
            payments: {
              where: { selapananId },
              orderBy: { installmentNumber: 'asc' },
            },
          },
          orderBy: { family: { familyHead: 'asc' } },
        },
      },
    });

    const leviesWithPayments = activeLevies.map((levy) => ({
      id: levy.id,
      name: levy.name,
      description: levy.description,
      isActive: levy.isActive,
      items: levy.items.map((item) => {
        const paidThisPeriod = item.payments.reduce((sum, p) => sum + p.amount, 0);
        const nextInstallment = item.paidInstallments + 1;
        const expectedThisPeriod = nextInstallment <= item.installments ? item.perInstallment : 0;

        return {
          id: item.id,
          familyId: item.familyId,
          familyHead: item.family.familyHead,
          totalAmount: item.totalAmount,
          installments: item.installments,
          perInstallment: item.perInstallment,
          paidAmount: item.paidAmount,
          paidInstallments: item.paidInstallments,
          status: item.status,
          paidThisPeriod,
          expectedThisPeriod,
          remaining: item.totalAmount - item.paidAmount,
          payments: item.payments,
        };
      }),
    }));

    const totalLevyPaidThisPeriod = activeLevies.reduce(
      (sum, levy) =>
        sum +
        levy.items.reduce(
          (itemSum, item) =>
            itemSum + item.payments.reduce((pSum, p) => pSum + p.amount, 0),
          0
        ),
      0
    );

    const totalLevyExpectedThisPeriod = activeLevies.reduce(
      (sum, levy) =>
        sum +
        levy.items.reduce((itemSum, item) => {
          const nextInstallment = item.paidInstallments + 1;
          return itemSum + (nextInstallment <= item.installments ? item.perInstallment : 0);
        }, 0),
      0
    );

    // =============================================
    // 6. FINES SUMMARY (UNPAID in this period)
    // =============================================
    const unpaidFines = await db.fine.findMany({
      where: {
        status: 'UNPAID',
        date: {
          gte: selapanan.periodeStart,
          lte: selapanan.periodeEnd,
        },
      },
      include: {
        user: { select: { id: true, name: true } },
        family: { select: { id: true, familyHead: true } },
      },
      orderBy: { date: 'desc' },
    });

    const finesSummary = unpaidFines.map((f) => ({
      id: f.id,
      userId: f.userId,
      userName: f.user.name,
      familyId: f.familyId,
      familyHead: f.family.familyHead,
      type: f.type,
      amount: f.amount,
      reason: f.reason,
      date: f.date,
    }));

    const totalUnpaidFines = unpaidFines.reduce((sum, f) => sum + f.amount, 0);

    // Also include fines associated with this selapananId directly
    const selapananFines = await db.fine.findMany({
      where: {
        selapananId,
        status: 'UNPAID',
      },
      include: {
        user: { select: { id: true, name: true } },
        family: { select: { id: true, familyHead: true } },
      },
    });

    const additionalFines = selapananFines.filter(
      (sf) => !unpaidFines.some((uf) => uf.id === sf.id)
    );

    for (const f of additionalFines) {
      finesSummary.push({
        id: f.id,
        userId: f.userId,
        userName: f.user.name,
        familyId: f.familyId,
        familyHead: f.family.familyHead,
        type: f.type,
        amount: f.amount,
        reason: f.reason,
        date: f.date,
      });
      // Counted in actualTotalFines below
    }

    const actualTotalFines = unpaidFines.reduce((sum, f) => sum + f.amount, 0) +
      additionalFines.reduce((sum, f) => sum + f.amount, 0);

    // =============================================
    // 7. TOTAL EXPECTED INCOME
    // =============================================
    const totalExpectedIncome =
      totalJimpitanDaily +
      totalJimpitanMonthly +
      totalRondaFee +
      totalPreviousShortage +
      totalLevyExpectedThisPeriod +
      actualTotalFines +
      selapanan.otherIncome;

    // =============================================
    // COMBINE PREVIOUS AND CURRENT SHORTAGES PER FAMILY
    // =============================================
    const allFamilyIds = new Set([
      ...previousShortageItems.map(s => s.familyId),
      ...currentShortages.map(s => s.familyId),
    ]);

    const combinedShortages = Array.from(allFamilyIds).map(familyId => {
      const prev = previousShortageItems.find(s => s.familyId === familyId);
      const curr = currentShortages.find(s => s.familyId === familyId);
      const prevAmount = prev ? prev.remaining : 0;
      const currAmount = curr ? curr.remaining : 0;
      const familyHead = prev?.familyHead || curr?.familyHead || '-';

      return {
        familyId,
        familyHead,
        previousShortage: prevAmount,
        currentShortage: currAmount,
        totalShortage: prevAmount + currAmount,
        prevFromSelapanan: prev?.fromSelapanan || null,
      };
    }).sort((a, b) => a.familyHead.localeCompare(b.familyHead));

    const totalCombinedShortage = combinedShortages.reduce((sum, s) => sum + s.totalShortage, 0);

    // =============================================
    // BUILD RESPONSE
    // =============================================
    return NextResponse.json({
      selapanan: {
        id: selapanan.id,
        number: selapanan.number,
        periodeStart: selapanan.periodeStart,
        periodeEnd: selapanan.periodeEnd,
        meetingDate: selapanan.meetingDate,
        status: selapanan.status,
        details: selapanan.details,
        // Saved financial recap
        savedRecap: {
          jimpitanDaily: selapanan.jimpitanDaily,
          jimpitanMonthly: selapanan.jimpitanMonthly,
          rondaFeeTotal: selapanan.rondaFeeTotal,
          shortagePaid: selapanan.shortagePaid,
          finePaid: selapanan.finePaid,
          levyPaid: selapanan.levyPaid,
          otherIncome: selapanan.otherIncome,
          totalIncome: selapanan.totalIncome,
        },
      },
      recap: {
        // 1. Daily jimpitan by ronda group
        dailyByGroup,
        totalJimpitanDaily,

        // 2. Monthly payers
        monthlyPayers,
        monthsSpanned,
        totalJimpitanMonthly,

        // 3. Ronda fees
        rondaFees,
        totalRondaFee,

        // 4. Previous shortages (carry-over)
        previousShortageItems,
        totalPreviousShortage,

        // Current period shortages
        currentShortages,
        totalCurrentShortage,

        // Combined shortages per family
        combinedShortages,
        totalCombinedShortage,

        // 5. Custom levies
        leviesWithPayments,
        totalLevyPaidThisPeriod,
        totalLevyExpectedThisPeriod,

        // 6. Fines
        finesSummary,
        totalUnpaidFines: actualTotalFines,

        // 7. Total expected
        totalExpectedIncome,
        totalActualIncome:
          totalJimpitanDaily +
          totalJimpitanMonthly +
          totalRondaFee +
          selapanan.shortagePaid +
          selapanan.finePaid +
          totalLevyPaidThisPeriod +
          selapanan.otherIncome,
      },
    });
  } catch (error) {
    console.error('Selapanan Recap GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
