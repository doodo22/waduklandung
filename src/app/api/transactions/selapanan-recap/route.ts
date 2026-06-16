import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// GET /api/transactions/selapanan-recap — Per-selapanan financial recap
// Returns income/expense breakdown for each selapanan period
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const selapananId = searchParams.get('selapananId');

    // Get all completed selapanans with their financial data
    const where: Record<string, unknown> = { status: { not: 'CANCELLED' } };
    if (selapananId) where.id = selapananId;

    const selapanans = await db.selapanan.findMany({
      where,
      orderBy: { number: 'desc' },
      take: 20,
    });

    // For each selapanan, also get transaction-level details
    const recaps = await Promise.all(
      selapanans.map(async (s) => {
        // Get all transactions linked to this selapanan
        const transactions = await db.transaction.findMany({
          where: { selapananId: s.id },
          orderBy: { date: 'desc' },
        });

        // Calculate from transactions (source of truth for real-time)
        const incomeByCategory: Record<string, number> = {};
        const expenseByCategory: Record<string, number> = {};
        let totalIncomeFromTx = 0;
        let totalExpenseFromTx = 0;

        for (const tx of transactions) {
          if (tx.type === 'INCOME') {
            incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + tx.amount;
            totalIncomeFromTx += tx.amount;
          } else if (tx.type === 'EXPENSE') {
            expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
            totalExpenseFromTx += tx.amount;
          }
          // TRANSFER is not counted in income/expense totals
        }

        return {
          selapanan: {
            id: s.id,
            number: s.number,
            periodeStart: s.periodeStart,
            periodeEnd: s.periodeEnd,
            status: s.status,
            // Stored recap values (set at completion)
            storedRecap: {
              jimpitanDaily: s.jimpitanDaily,
              jimpitanMonthly: s.jimpitanMonthly,
              rondaFeeTotal: s.rondaFeeTotal,
              shortagePaid: s.shortagePaid,
              finePaid: s.finePaid,
              levyPaid: s.levyPaid,
              otherIncome: s.otherIncome,
              totalIncome: s.totalIncome,
              expensePembelian: s.expensePembelian,
              expensePembangunan: s.expensePembangunan,
              expenseOperasional: s.expenseOperasional,
              expenseBantuan: s.expenseBantuan,
              expenseLainLain: s.expenseLainLain,
              totalExpense: s.totalExpense,
            },
          },
          // Live transaction-based totals
          incomeByCategory,
          expenseByCategory,
          totalIncome: totalIncomeFromTx,
          totalExpense: totalExpenseFromTx,
          netIncome: totalIncomeFromTx - totalExpenseFromTx,
          transactions,
        };
      })
    );

    // Also get the active (UPCOMING) selapanan if any
    const activeSelapanan = await db.selapanan.findFirst({
      where: { status: 'UPCOMING' },
      orderBy: { number: 'desc' },
    });

    // Get expenses for the active selapanan
    let activeExpenseSummary = null;
    if (activeSelapanan) {
      const activeExpenses = await db.transaction.findMany({
        where: {
          selapananId: activeSelapanan.id,
          type: 'EXPENSE',
        },
      });

      const activeIncome = await db.transaction.findMany({
        where: {
          selapananId: activeSelapanan.id,
          type: 'INCOME',
        },
      });

      const activeIncomeTotal = activeIncome.reduce((s, t) => s + t.amount, 0);
      const activeExpenseTotal = activeExpenses.reduce((s, t) => s + t.amount, 0);

      activeExpenseSummary = {
        selapananId: activeSelapanan.id,
        number: activeSelapanan.number,
        periodeStart: activeSelapanan.periodeStart,
        periodeEnd: activeSelapanan.periodeEnd,
        totalIncome: activeIncomeTotal,
        totalExpense: activeExpenseTotal,
        netIncome: activeIncomeTotal - activeExpenseTotal,
      };
    }

    return NextResponse.json({
      recaps,
      activeSelapanan: activeExpenseSummary,
    });
  } catch (error) {
    console.error('Selapanan Recap GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
