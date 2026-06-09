import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// POST /api/selapanan/collect-tarikan — Record a consolidated payment from a family
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { selapananId, familyId, amount, notes } = body;

    if (!selapananId || !familyId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const selapanan = await db.selapanan.findUnique({ where: { id: selapananId } });
    if (!selapanan) return NextResponse.json({ error: 'Selapanan tidak ditemukan' }, { status: 404 });
    if (selapanan.status === 'COMPLETED') return NextResponse.json({ error: 'Selapanan sudah selesai' }, { status: 400 });

    // Get or create the tarikan record
    let tarikan = await db.selapananTarikan.findUnique({
      where: { selapananId_familyId: { selapananId, familyId } },
    });

    if (!tarikan) {
      return NextResponse.json({ error: 'Tarikan record tidak ditemukan. Generate tarikan terlebih dahulu.' }, { status: 404 });
    }

    const family = await db.family.findUnique({
      where: { id: familyId },
      select: { familyHead: true, jimpitanType: true, rondaStatus: true },
    });
    if (!family) return NextResponse.json({ error: 'KK tidak ditemukan' }, { status: 404 });

    const totalHarusBayar = tarikan.sisaTarikan + tarikan.kuranganJimpitan + tarikan.iuranBulanan + tarikan.iuranRonda;
    const maxPay = totalHarusBayar - tarikan.jumlahBayar;
    const actualAmount = Math.min(amount, maxPay);

    if (actualAmount <= 0) {
      return NextResponse.json({ error: 'Tidak ada kurangan yang perlu dibayar' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    let remaining = actualAmount;

    // Allocate payment in priority order:
    // 1. Sisa tarikan (previous shortage)
    // 2. Kurangan jimpitan (current period)
    // 3. Iuran bulanan
    // 4. Iuran ronda

    const allocations: { type: string; category: string; amount: number; desc: string }[] = [];

    // 1. Previous shortage
    if (remaining > 0 && tarikan.sisaTarikan > 0) {
      const prevSettled = Math.min(remaining, tarikan.sisaTarikan);
      allocations.push({
        type: 'shortage_prev',
        category: 'JIMPITAN',
        amount: prevSettled,
        desc: `Sisa tarikan - ${family.familyHead} (Rp${prevSettled.toLocaleString('id-ID')})`,
      });
      remaining -= prevSettled;

      // Update previous JimpitanShortage records
      const prevShortages = await db.jimpitanShortage.findMany({
        where: {
          familyId,
          isSettled: false,
          selapanan: {
            periodeEnd: { lt: selapanan.periodeStart },
            status: { not: 'CANCELLED' },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      let settleRemaining = prevSettled;
      for (const s of prevShortages) {
        if (settleRemaining <= 0) break;
        const sRemaining = s.totalShortage - s.settledAmount;
        const settle = Math.min(settleRemaining, sRemaining);
        const newSettled = s.settledAmount + settle;
        await db.jimpitanShortage.update({
          where: { id: s.id },
          data: {
            settledAmount: newSettled,
            isSettled: newSettled >= s.totalShortage,
          },
        });
        settleRemaining -= settle;
      }

      await db.selapanan.update({
        where: { id: selapananId },
        data: { shortagePaid: { increment: prevSettled } },
      });
    }

    // 2. Current jimpitan shortage
    if (remaining > 0 && tarikan.kuranganJimpitan > 0) {
      const jimpitanSettled = Math.min(remaining, tarikan.kuranganJimpitan);
      allocations.push({
        type: 'shortage_current',
        category: 'JIMPITAN',
        amount: jimpitanSettled,
        desc: `Kurangan jimpitan - ${family.familyHead} (Rp${jimpitanSettled.toLocaleString('id-ID')})`,
      });
      remaining -= jimpitanSettled;

      // Update current JimpitanShortage
      const currentShortage = await db.jimpitanShortage.findUnique({
        where: { familyId_selapananId: { familyId, selapananId } },
      });

      if (currentShortage) {
        const newSettled = Math.min(currentShortage.totalShortage, currentShortage.settledAmount + jimpitanSettled);
        await db.jimpitanShortage.update({
          where: { id: currentShortage.id },
          data: {
            settledAmount: newSettled,
            isSettled: newSettled >= currentShortage.totalShortage,
          },
        });
      }

      await db.selapanan.update({
        where: { id: selapananId },
        data: { shortagePaid: { increment: jimpitanSettled } },
      });
    }

    // 3. Iuran bulanan
    if (remaining > 0 && tarikan.iuranBulanan > 0) {
      const bulananPaid = Math.min(remaining, tarikan.iuranBulanan);
      allocations.push({
        type: 'monthly_iuran',
        category: 'IURAN_BULANAN',
        amount: bulananPaid,
        desc: `Iuran bulanan - ${family.familyHead} (Rp${bulananPaid.toLocaleString('id-ID')})`,
      });
      remaining -= bulananPaid;

      await db.selapanan.update({
        where: { id: selapananId },
        data: { jimpitanMonthly: { increment: bulananPaid } },
      });
    }

    // 4. Iuran ronda
    if (remaining > 0 && tarikan.iuranRonda > 0) {
      const rondaPaid = Math.min(remaining, tarikan.iuranRonda);
      allocations.push({
        type: 'ronda_iuran',
        category: 'IURAN_RONDA',
        amount: rondaPaid,
        desc: `Iuran ronda - ${family.familyHead} (Rp${rondaPaid.toLocaleString('id-ID')})`,
      });
      remaining -= rondaPaid;

      await db.selapanan.update({
        where: { id: selapananId },
        data: { rondaFeeTotal: { increment: rondaPaid } },
      });
    }

    // Create Transaction records for each allocation
    for (const alloc of allocations) {
      await db.transaction.create({
        data: {
          type: 'INCOME',
          category: alloc.category,
          amount: alloc.amount,
          description: alloc.desc + (notes ? ` | Catatan: ${notes}` : ''),
          date: today,
          selapananId,
          createdBy: authUser.id,
        },
      });
    }

    // Update total income
    await db.selapanan.update({
      where: { id: selapananId },
      data: { totalIncome: { increment: actualAmount } },
    });

    // Update tarikan record
    const newJumlahBayar = tarikan.jumlahBayar + actualAmount;
    const newSisaDepan = totalHarusBayar - newJumlahBayar;

    const updatedTarikan = await db.selapananTarikan.update({
      where: { id: tarikan.id },
      data: {
        jumlahBayar: newJumlahBayar,
        sisaDepan: newSisaDepan,
        notes: notes || tarikan.notes,
      },
    });

    return NextResponse.json({
      message: `Pembayaran ${formatCurrency(actualAmount)} dari ${family.familyHead} berhasil dicatat`,
      allocation: allocations,
      tarikan: updatedTarikan,
      totalHarusBayar,
      jumlahBayar: newJumlahBayar,
      sisaDepan: newSisaDepan,
    });
  } catch (error) {
    console.error('Selapanan Collect-Tarikan POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

function formatCurrency(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`;
}
