import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// Helper: Count how many month boundaries fall within a period
function countMonthBoundaries(periodeStart: string, periodeEnd: string): number {
  const start = new Date(periodeStart + 'T00:00:00');
  const end = new Date(periodeEnd + 'T00:00:00');
  const startMonth = start.getMonth();
  const startYear = start.getFullYear();
  const endMonth = end.getMonth();
  const endYear = end.getFullYear();
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
}

// POST /api/selapanan/complete — Finalize a selapanan period
// - Mark status as COMPLETED
// - Calculate and save all financial recap fields
// - Create Transaction records for each income type
// - Carry over unpaid shortages to next selapanan
// - Unpaid custom levy installments stay ACTIVE for next period
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { selapananId, otherIncome } = await request.json();

    if (!selapananId) {
      return NextResponse.json({ error: 'selapananId wajib diisi' }, { status: 400 });
    }

    // Get the selapanan
    const selapanan = await db.selapanan.findUnique({
      where: { id: selapananId },
    });

    if (!selapanan) {
      return NextResponse.json({ error: 'Selapanan tidak ditemukan' }, { status: 404 });
    }

    if (selapanan.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Selapanan sudah diselesaikan' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    // =============================================
    // 1. CALCULATE JIMPITAN DAILY
    // =============================================
    const jimpitanLogs = await db.jimpitanLog.findMany({
      where: { selapananId },
    });

    const jimpitanDaily = jimpitanLogs.reduce((sum, l) => sum + l.paidAmount, 0);

    // =============================================
    // 2. CALCULATE JIMPITAN MONTHLY
    // =============================================
    const monthlyFamilies = await db.family.findMany({
      where: {
        jimpitanType: 'BULANAN',
        isActive: true,
      },
      select: { id: true, jimpitanAmount: true },
    });

    const monthsSpanned = countMonthBoundaries(selapanan.periodeStart, selapanan.periodeEnd);
    const jimpitanMonthly = monthlyFamilies.reduce(
      (sum, f) => sum + f.jimpitanAmount * monthsSpanned,
      0
    );

    // =============================================
    // 3. CALCULATE RONDA FEES
    // =============================================
    const rondaFeeFamilies = await db.family.findMany({
      where: {
        rondaStatus: 'BAYAR_IURAN',
        isActive: true,
      },
      select: { id: true, rondaFee: true },
    });

    const rondaFeeTotal = rondaFeeFamilies.reduce((sum, f) => sum + f.rondaFee, 0);

    // =============================================
    // 4. CALCULATE SHORTAGES PAID
    // =============================================
    // Shortages that were settled (paid) during this selapanan
    const settledShortages = await db.jimpitanShortage.findMany({
      where: {
        selapananId,
        isSettled: true,
      },
    });

    const shortagePaid = settledShortages.reduce((sum, s) => sum + s.settledAmount, 0);

    // =============================================
    // 5. CALCULATE FINES PAID
    // =============================================
    const paidFines = await db.fine.findMany({
      where: {
        selapananId,
        status: 'PAID',
      },
    });

    // Also get fines within the period date range that are paid
    const paidFinesInPeriod = await db.fine.findMany({
      where: {
        date: {
          gte: selapanan.periodeStart,
          lte: selapanan.periodeEnd,
        },
        status: 'PAID',
      },
    });

    // Merge unique fines
    const allPaidFineIds = new Set<string>();
    let finePaid = 0;

    for (const f of paidFines) {
      if (!allPaidFineIds.has(f.id)) {
        allPaidFineIds.add(f.id);
        finePaid += f.amount;
      }
    }
    for (const f of paidFinesInPeriod) {
      if (!allPaidFineIds.has(f.id)) {
        allPaidFineIds.add(f.id);
        finePaid += f.amount;
      }
    }

    // =============================================
    // 6. CALCULATE LEVY PAID
    // =============================================
    const levyPayments = await db.customLevyPayment.findMany({
      where: { selapananId },
    });

    const levyPaid = levyPayments.reduce((sum, p) => sum + p.amount, 0);

    // =============================================
    // 7. OTHER INCOME
    // =============================================
    const otherIncomeAmount = otherIncome ?? selapanan.otherIncome ?? 0;

    // =============================================
    // 8. TOTAL INCOME
    // =============================================
    const totalIncome =
      jimpitanDaily +
      jimpitanMonthly +
      rondaFeeTotal +
      shortagePaid +
      finePaid +
      levyPaid +
      otherIncomeAmount;

    // =============================================
    // CALCULATE EXPENSES FOR THIS SELAPANAN
    // =============================================
    const expenseTransactions = await db.transaction.findMany({
      where: {
        selapananId,
        type: 'EXPENSE',
      },
    });

    let expensePembelian = 0;
    let expensePembangunan = 0;
    let expenseOperasional = 0;
    let expenseBantuan = 0;
    let expenseLainLain = 0;

    for (const tx of expenseTransactions) {
      switch (tx.category) {
        case 'PEMBELIAN': expensePembelian += tx.amount; break;
        case 'PEMBANGUNAN': expensePembangunan += tx.amount; break;
        case 'OPERASIONAL': expenseOperasional += tx.amount; break;
        case 'BANTUAN': expenseBantuan += tx.amount; break;
        case 'LAIN_LAIN': expenseLainLain += tx.amount; break;
      }
    }

    const totalExpense = expensePembelian + expensePembangunan + expenseOperasional + expenseBantuan + expenseLainLain;

    // =============================================
    // UPDATE SELAPANAN WITH RECAP
    // =============================================
    const updatedSelapanan = await db.selapanan.update({
      where: { id: selapananId },
      data: {
        status: 'COMPLETED',
        jimpitanDaily,
        jimpitanMonthly,
        rondaFeeTotal,
        shortagePaid,
        finePaid,
        levyPaid,
        otherIncome: otherIncomeAmount,
        totalIncome,
        expensePembelian,
        expensePembangunan,
        expenseOperasional,
        expenseBantuan,
        expenseLainLain,
        totalExpense,
      },
    });

    // =============================================
    // CREATE TRANSACTION RECORDS
    // =============================================
    const transactions = [];

    // Transaction: Jimpitan Daily
    if (jimpitanDaily > 0) {
      const t = await db.transaction.create({
        data: {
          type: 'INCOME',
          category: 'JIMPITAN',
          amount: jimpitanDaily,
          description: `Jimpitan harian - Selapanan ke-${selapanan.number} (${selapanan.periodeStart} s/d ${selapanan.periodeEnd})`,
          date: today,
          selapananId,
          createdBy: authUser.id,
        },
      });
      transactions.push(t);
    }

    // Transaction: Jimpitan Monthly
    if (jimpitanMonthly > 0) {
      const t = await db.transaction.create({
        data: {
          type: 'INCOME',
          category: 'IURAN_BULANAN',
          amount: jimpitanMonthly,
          description: `Iuran bulanan (${monthsSpanned} bulan) - Selapanan ke-${selapanan.number} (${selapanan.periodeStart} s/d ${selapanan.periodeEnd})`,
          date: today,
          selapananId,
          createdBy: authUser.id,
        },
      });
      transactions.push(t);
    }

    // Transaction: Ronda Fees
    if (rondaFeeTotal > 0) {
      const t = await db.transaction.create({
        data: {
          type: 'INCOME',
          category: 'IURAN_RONDA',
          amount: rondaFeeTotal,
          description: `Iuran ronda pengganti - Selapanan ke-${selapanan.number} (${selapanan.periodeStart} s/d ${selapanan.periodeEnd})`,
          date: today,
          selapananId,
          createdBy: authUser.id,
        },
      });
      transactions.push(t);
    }

    // Transaction: Shortages Paid
    if (shortagePaid > 0) {
      const t = await db.transaction.create({
        data: {
          type: 'INCOME',
          category: 'JIMPITAN',
          amount: shortagePaid,
          description: `Pembayaran kekurangan jimpitan - Selapanan ke-${selapanan.number} (${selapanan.periodeStart} s/d ${selapanan.periodeEnd})`,
          date: today,
          selapananId,
          createdBy: authUser.id,
        },
      });
      transactions.push(t);
    }

    // Transaction: Fines Paid
    if (finePaid > 0) {
      const t = await db.transaction.create({
        data: {
          type: 'INCOME',
          category: 'DENDA',
          amount: finePaid,
          description: `Pembayaran denda - Selapanan ke-${selapanan.number} (${selapanan.periodeStart} s/d ${selapanan.periodeEnd})`,
          date: today,
          selapananId,
          createdBy: authUser.id,
        },
      });
      transactions.push(t);
    }

    // Transaction: Levy Paid
    if (levyPaid > 0) {
      const t = await db.transaction.create({
        data: {
          type: 'INCOME',
          category: 'LAIN_LAIN',
          amount: levyPaid,
          description: `Pembayaran tarikan lain - Selapanan ke-${selapanan.number} (${selapanan.periodeStart} s/d ${selapanan.periodeEnd})`,
          date: today,
          selapananId,
          createdBy: authUser.id,
        },
      });
      transactions.push(t);
    }

    // Transaction: Other Income
    if (otherIncomeAmount > 0) {
      const t = await db.transaction.create({
        data: {
          type: 'INCOME',
          category: 'LAIN_LAIN',
          amount: otherIncomeAmount,
          description: `Pemasukan lain - Selapanan ke-${selapanan.number} (${selapanan.periodeStart} s/d ${selapanan.periodeEnd})`,
          date: today,
          selapananId,
          createdBy: authUser.id,
        },
      });
      transactions.push(t);
    }

    // =============================================
    // CARRY OVER UNPAID SHORTAGES TO NEXT SELAPANAN
    // =============================================
    const unpaidShortages = await db.jimpitanShortage.findMany({
      where: {
        selapananId,
        isSettled: false,
      },
    });

    let carriedOverCount = 0;

    if (unpaidShortages.length > 0) {
      // Find the next selapanan period
      const nextSelapanan = await db.selapanan.findFirst({
        where: {
          periodeStart: { gt: selapanan.periodeStart },
          status: { not: 'CANCELLED' },
        },
        orderBy: { periodeStart: 'asc' },
      });

      if (nextSelapanan) {
        for (const shortage of unpaidShortages) {
          const remaining = shortage.totalShortage - shortage.settledAmount;
          if (remaining > 0) {
            // Mark current shortage as carried over
            await db.jimpitanShortage.update({
              where: { id: shortage.id },
              data: { carriedOver: true },
            });

            // Create or update shortage in next selapanan
            await db.jimpitanShortage.upsert({
              where: {
                familyId_selapananId: {
                  familyId: shortage.familyId,
                  selapananId: nextSelapanan.id,
                },
              },
              create: {
                familyId: shortage.familyId,
                selapananId: nextSelapanan.id,
                totalShortage: remaining,
                isSettled: false,
                settledAmount: 0,
                carriedOver: true,
                notes: `Carry-over dari periode ${selapanan.periodeStart} s/d ${selapanan.periodeEnd}`,
              },
              update: {
                totalShortage: { increment: remaining },
                carriedOver: true,
              },
            });

            carriedOverCount++;
          }
        }
      }
    }

    // Note: Unpaid custom levy installments stay ACTIVE for next period
    // They are linked to CustomLevyItem, not to a specific selapanan,
    // so they naturally carry forward. No additional action needed.

    // =============================================
    // CARRY OVER TARIKAN SISA DEPAN TO NEXT SELAPANAN
    // =============================================
    // Families with sisaDepan > 0 from SelapananTarikan need their
    // unpaid amounts carried over as shortage to the next selapanan
    const unpaidTarikan = await db.selapananTarikan.findMany({
      where: {
        selapananId,
        sisaDepan: { gt: 0 },
      },
    });

    let tarikanCarriedOverCount = 0;

    if (unpaidTarikan.length > 0) {
      // Find the next selapanan period (same as above, but re-query in case it wasn't found before)
      let nextSelapanan = await db.selapanan.findFirst({
        where: {
          periodeStart: { gt: selapanan.periodeStart },
          status: { not: 'CANCELLED' },
        },
        orderBy: { periodeStart: 'asc' },
      });

      if (nextSelapanan) {
        for (const tarikan of unpaidTarikan) {
          // Create or update JimpitanShortage in next selapanan
          // The sisaDepan includes ALL unpaid amounts (jimpitan + bulanan + ronda fee + previous sisa)
          await db.jimpitanShortage.upsert({
            where: {
              familyId_selapananId: {
                familyId: tarikan.familyId,
                selapananId: nextSelapanan!.id,
              },
            },
            create: {
              familyId: tarikan.familyId,
              selapananId: nextSelapanan!.id,
              totalShortage: tarikan.sisaDepan,
              isSettled: false,
              settledAmount: 0,
              carriedOver: true,
              notes: `Carry-over tarikan dari selapanan ke-${selapanan.number}: sisa Rp${tarikan.sisaDepan.toLocaleString('id-ID')}${tarikan.notes ? ` (${tarikan.notes})` : ''}`,
            },
            update: {
              totalShortage: { increment: tarikan.sisaDepan },
              carriedOver: true,
            },
          });

          tarikanCarriedOverCount++;
        }
      }
    }

    return NextResponse.json({
      message: `Selapanan ke-${selapanan.number} berhasil diselesaikan`,
      selapanan: updatedSelapanan,
      recap: {
        jimpitanDaily,
        jimpitanMonthly,
        rondaFeeTotal,
        shortagePaid,
        finePaid,
        levyPaid,
        otherIncome: otherIncomeAmount,
        totalIncome,
        expensePembelian,
        expensePembangunan,
        expenseOperasional,
        expenseBantuan,
        expenseLainLain,
        totalExpense,
        netIncome: totalIncome - totalExpense,
      },
      transactionsCreated: transactions.length,
      shortagesCarriedOver: carriedOverCount,
      tarikanCarriedOver: tarikanCarriedOverCount,
    });
  } catch (error) {
    console.error('Selapanan Complete POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
