import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (isAdmin(authUser.role)) {
      // Admin dashboard stats
      const [
        totalWarga,
        totalFamily,
        pendingUsers,
        activeAnnouncements,
        totalInventory,
        pendingLetters,
      ] = await Promise.all([
        db.user.count({ where: { status: 'ACTIVE' } }),
        db.family.count({ where: { isActive: true } }),
        db.user.count({ where: { status: 'PENDING' } }),
        db.announcement.count({ where: { isActive: true } }),
        db.inventory.count(),
        db.letter.count({ where: { status: 'PENDING' } }),
      ]);

      // Financial summary
      const transactions = await db.transaction.findMany({});
      const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

      // Unpaid fines
      const unpaidFines = await db.fine.findMany({ where: { status: 'UNPAID' } });
      const totalUnpaidFines = unpaidFines.reduce((s, f) => s + f.amount, 0);

      // Recent transactions
      const recentTransactions = await db.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      // Recent announcements
      const recentAnnouncements = await db.announcement.findMany({
        where: { isActive: true },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: 3,
      });

      // Upcoming selapanan
      const upcomingSelapanan = await db.selapanan.findFirst({
        where: { status: 'UPCOMING' },
        orderBy: { meetingDate: 'asc' },
      });

      // Today's ronda
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

      return NextResponse.json({
        stats: {
          totalWarga,
          totalFamily,
          pendingUsers,
          activeAnnouncements,
          totalInventory,
          pendingLetters,
          totalIncome,
          totalExpense,
          balance: totalIncome - totalExpense,
          totalUnpaidFines,
        },
        recentTransactions,
        recentAnnouncements,
        upcomingSelapanan,
        todayRonda,
      });
    } else {
      // Warga dashboard
      // Get family info
      const user = await db.user.findUnique({
        where: { id: authUser.id },
        include: { family: true },
      });

      // Recent announcements
      const announcements = await db.announcement.findMany({
        where: { isActive: true },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      });

      // User's fines
      const myFines = await db.fine.findMany({
        where: { userId: authUser.id, status: 'UNPAID' },
        orderBy: { date: 'desc' },
      });

      // User's ronda this month
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

      // User's jimpitan this month
      const myJimpitan = await db.jimpitanLog.findMany({
        where: {
          familyId: authUser.familyId || '',
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { date: 'desc' },
      });

      // Upcoming selapanan
      const upcomingSelapanan = await db.selapanan.findFirst({
        where: { status: 'UPCOMING' },
        orderBy: { meetingDate: 'asc' },
      });

      // My letters
      const myLetters = await db.letter.findMany({
        where: { userId: authUser.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      return NextResponse.json({
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
      });
    }
  } catch (error) {
    console.error('Dashboard GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
