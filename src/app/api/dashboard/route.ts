import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // ---- Common (warga) data: always returned ----
    const user = await db.user.findUnique({
      where: { id: authUser.id },
      include: { family: true },
    });

    const announcements = await db.announcement.findMany({
      where: { isActive: true },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: { author: { select: { name: true } } },
      take: 5,
    });

    const myFines = await db.fine.findMany({
      where: { userId: authUser.id, status: 'UNPAID' },
      orderBy: { date: 'desc' },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const myRonda = await db.rondaLog.findMany({
      where: {
        userId: authUser.id,
        schedule: { date: { gte: monthStart, lte: monthEnd } },
      },
      include: { schedule: { include: { group: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const myJimpitan = await db.jimpitanLog.findMany({
      where: {
        familyId: authUser.familyId || '',
        date: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { date: 'desc' },
    });

    const upcomingSelapanan = await db.selapanan.findFirst({
      where: { status: 'UPCOMING' },
      orderBy: { meetingDate: 'asc' },
    });

    const myLetters = await db.letter.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Build base response (warga-shaped, always present)
    const baseResponse: Record<string, unknown> = {
      user: {
        id: user?.id,
        name: user?.name,
        role: user?.role,
        family: user?.family,
      },
      announcements,
      myFines,
      myRonda,
      myJimpitan,
      upcomingSelapanan,
      myLetters,
    };

    // ---- Admin-specific data: added when user is admin ----
    if (isAdmin(authUser.role)) {
      const [
        totalWarga,
        totalFamily,
        pendingUsers,
        totalInventory,
        pendingLetters,
      ] = await Promise.all([
        db.user.count({ where: { status: 'ACTIVE' } }),
        db.family.count({ where: { isActive: true } }),
        db.user.count({ where: { status: 'PENDING' } }),
        db.inventory.count(),
        db.letter.count({ where: { status: 'PENDING' } }),
      ]);

      const transactions = await db.transaction.findMany({});
      const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

      const recentTransactions = await db.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      const recentAnnouncements = await db.announcement.findMany({
        where: { isActive: true },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        include: { author: { select: { name: true } } },
        take: 3,
      });

      const today = new Date().toISOString().split('T')[0];
      const todayRonda = await db.rondaSchedule.findMany({
        where: { date: today },
        include: {
          group: true,
          logs: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
      });

      baseResponse.stats = {
        totalWarga,
        totalKeluarga: totalFamily,
        saldoKas: totalIncome - totalExpense,
        wargaPending: pendingUsers,
        suratPending: pendingLetters,
        totalInventaris: totalInventory,
      };
      baseResponse.recentTransactions = recentTransactions;
      baseResponse.recentAnnouncements = recentAnnouncements;
      baseResponse.todayRonda = todayRonda;
    }

    return NextResponse.json(baseResponse);
  } catch (error) {
    console.error('Dashboard GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
