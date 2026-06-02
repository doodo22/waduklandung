import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// POST /api/selapanan/collect — Record a payment during selapanan
// Supports: shortage, monthly_iuran, ronda_iuran, fine, levy, ronda_group_setoran
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { selapananId, type, familyId, amount, fineId, levyItemId, notes } = body;

    if (!selapananId || !type || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const selapanan = await db.selapanan.findUnique({ where: { id: selapananId } });
    if (!selapanan) return NextResponse.json({ error: 'Selapanan tidak ditemukan' }, { status: 404 });
    if (selapanan.status === 'COMPLETED') return NextResponse.json({ error: 'Selapanan sudah selesai' }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];
    let transactionDesc = '';
    let transactionCategory = 'LAIN_LAIN';

    switch (type) {
      // ─── 1. PEMBAYARAN KURANGAN JIMPITAN ───────────────────
      case 'shortage': {
        if (!familyId) return NextResponse.json({ error: 'familyId wajib diisi' }, { status: 400 });

        // Find shortage in current selapanan
        const shortage = await db.jimpitanShortage.findUnique({
          where: { familyId_selapananId: { familyId, selapananId } },
        });

        if (shortage) {
          const newSettled = Math.min(shortage.totalShortage, shortage.settledAmount + amount);
          const isFullySettled = newSettled >= shortage.totalShortage;

          await db.jimpitanShortage.update({
            where: { id: shortage.id },
            data: { settledAmount: newSettled, isSettled: isFullySettled },
          });
        } else {
          // Check for carry-over from previous periods
          const prevShortage = await db.jimpitanShortage.findFirst({
            where: { familyId, isSettled: false },
            orderBy: { createdAt: 'asc' },
          });

          if (prevShortage) {
            const newSettled = Math.min(prevShortage.totalShortage, prevShortage.settledAmount + amount);
            const isFullySettled = newSettled >= prevShortage.totalShortage;

            await db.jimpitanShortage.update({
              where: { id: prevShortage.id },
              data: { settledAmount: newSettled, isSettled: isFullySettled },
            });

            // Also track in current selapanan
            await db.jimpitanShortage.upsert({
              where: { familyId_selapananId: { familyId, selapananId } },
              create: {
                familyId, selapananId,
                totalShortage: 0, settledAmount: amount,
                isSettled: true,
                notes: 'Pembayaran kurangan carry-over',
              },
              update: { settledAmount: { increment: amount } },
            });
          } else {
            return NextResponse.json({ error: 'Tidak ada kurangan untuk KK ini' }, { status: 404 });
          }
        }

        const family = await db.family.findUnique({ where: { id: familyId }, select: { familyHead: true } });
        transactionDesc = `Pembayaran kurangan - ${family?.familyHead || '-'} (Rp${amount.toLocaleString('id-ID')})`;
        transactionCategory = 'JIMPITAN';

        await db.selapanan.update({
          where: { id: selapananId },
          data: { shortagePaid: { increment: amount } },
        });
        break;
      }

      // ─── 2. PEMBAYARAN IURAN BULANAN ──────────────────────
      case 'monthly_iuran': {
        if (!familyId) return NextResponse.json({ error: 'familyId wajib diisi' }, { status: 400 });

        const family = await db.family.findUnique({ where: { id: familyId }, select: { familyHead: true } });
        if (!family) return NextResponse.json({ error: 'KK tidak ditemukan' }, { status: 404 });

        transactionDesc = `Iuran bulanan - ${family.familyHead} (Rp${amount.toLocaleString('id-ID')})`;
        transactionCategory = 'IURAN_BULANAN';

        await db.selapanan.update({
          where: { id: selapananId },
          data: { jimpitanMonthly: { increment: amount } },
        });
        break;
      }

      // ─── 3. PEMBAYARAN IURAN RONDA ────────────────────────
      case 'ronda_iuran': {
        if (!familyId) return NextResponse.json({ error: 'familyId wajib diisi' }, { status: 400 });

        const family = await db.family.findUnique({ where: { id: familyId }, select: { familyHead: true } });
        if (!family) return NextResponse.json({ error: 'KK tidak ditemukan' }, { status: 404 });

        transactionDesc = `Iuran ronda - ${family.familyHead} (Rp${amount.toLocaleString('id-ID')})`;
        transactionCategory = 'IURAN_RONDA';

        await db.selapanan.update({
          where: { id: selapananId },
          data: { rondaFeeTotal: { increment: amount } },
        });
        break;
      }

      // ─── 4. PEMBAYARAN DENDA ──────────────────────────────
      case 'fine': {
        if (!fineId) return NextResponse.json({ error: 'fineId wajib diisi' }, { status: 400 });

        const fine = await db.fine.findUnique({
          where: { id: fineId },
          include: { family: { select: { familyHead: true } } },
        });
        if (!fine) return NextResponse.json({ error: 'Denda tidak ditemukan' }, { status: 404 });

        await db.fine.update({
          where: { id: fineId },
          data: { status: 'PAID', selapananId },
        });

        transactionDesc = `Denda ${fine.type} - ${fine.family.familyHead} (Rp${amount.toLocaleString('id-ID')})`;
        transactionCategory = 'DENDA';

        await db.selapanan.update({
          where: { id: selapananId },
          data: { finePaid: { increment: amount } },
        });
        break;
      }

      // ─── 5. PEMBAYARAN TARIKAN LAIN (CICILAN) ─────────────
      case 'levy': {
        if (!levyItemId) return NextResponse.json({ error: 'levyItemId wajib diisi' }, { status: 400 });

        const levyItem = await db.customLevyItem.findUnique({
          where: { id: levyItemId },
          include: {
            levy: { select: { name: true } },
            family: { select: { familyHead: true } },
          },
        });
        if (!levyItem) return NextResponse.json({ error: 'Tarikan tidak ditemukan' }, { status: 404 });

        const newPaidAmount = levyItem.paidAmount + amount;
        const newPaidInstallments = levyItem.paidInstallments + 1;
        const isCompleted = newPaidAmount >= levyItem.totalAmount;

        await db.customLevyItem.update({
          where: { id: levyItemId },
          data: {
            paidAmount: newPaidAmount,
            paidInstallments: newPaidInstallments,
            status: isCompleted ? 'COMPLETED' : 'ACTIVE',
          },
        });

        await db.customLevyPayment.create({
          data: {
            itemId: levyItemId,
            selapananId,
            amount,
            installmentNumber: newPaidInstallments,
            notes: notes || null,
          },
        });

        transactionDesc = `${levyItem.levy.name} cicilan ke-${newPaidInstallments} - ${levyItem.family.familyHead} (Rp${amount.toLocaleString('id-ID')})`;
        transactionCategory = 'LAIN_LAIN';

        await db.selapanan.update({
          where: { id: selapananId },
          data: { levyPaid: { increment: amount } },
        });
        break;
      }

      // ─── 6. SETORAN JIMPITAN GRUP RONDA ───────────────────
      case 'ronda_group_setoran': {
        // familyId = groupId for this type
        const group = await db.rondaGroup.findUnique({ where: { id: familyId }, select: { name: true } });
        if (!group) return NextResponse.json({ error: 'Grup ronda tidak ditemukan' }, { status: 404 });

        transactionDesc = `Setoran jimpitan ${group.name} (Rp${amount.toLocaleString('id-ID')})`;
        transactionCategory = 'JIMPITAN';

        await db.selapanan.update({
          where: { id: selapananId },
          data: { jimpitanDaily: { increment: amount } },
        });
        break;
      }

      default:
        return NextResponse.json({ error: 'Tipe pembayaran tidak valid' }, { status: 400 });
    }

    // Create the transaction record
    const transaction = await db.transaction.create({
      data: {
        type: 'INCOME',
        category: transactionCategory,
        amount,
        description: transactionDesc,
        date: today,
        selapananId,
        createdBy: authUser.id,
      },
    });

    // Update totalIncome on selapanan
    await db.selapanan.update({
      where: { id: selapananId },
      data: { totalIncome: { increment: amount } },
    });

    return NextResponse.json({
      message: 'Pembayaran berhasil dicatat',
      transaction,
    });
  } catch (error) {
    console.error('Selapanan Collect POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
