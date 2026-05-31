import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// GET /api/jimpitan/shortages — Get shortage summary
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const selapananId = searchParams.get('selapananId');

    if (selapananId) {
      // Return shortages for a specific selapanan period
      const selapanan = await db.selapanan.findUnique({
        where: { id: selapananId },
      });
      if (!selapanan) {
        return NextResponse.json({ error: 'Selapanan tidak ditemukan' }, { status: 404 });
      }

      const shortages = await db.jimpitanShortage.findMany({
        where: { selapananId },
        include: {
          family: { select: { id: true, familyHead: true } },
          selapanan: { select: { id: true, periodeStart: true, periodeEnd: true, status: true } },
        },
        orderBy: { family: { familyHead: 'asc' } },
      });

      // Also get carried-over shortages from previous selapanan that affect this one
      const previousShortages = await db.jimpitanShortage.findMany({
        where: {
          carriedOver: true,
          isSettled: false,
          selapanan: { periodeEnd: { lt: selapanan.periodeStart } },
        },
        include: {
          family: { select: { id: true, familyHead: true } },
          selapanan: { select: { id: true, periodeStart: true, periodeEnd: true } },
        },
        orderBy: { family: { familyHead: 'asc' } },
      });

      // Accumulate carried-over shortages per family
      const carriedOverMap = new Map<string, number>();
      for (const ps of previousShortages) {
        const remaining = ps.totalShortage - ps.settledAmount;
        if (remaining > 0) {
          carriedOverMap.set(
            ps.familyId,
            (carriedOverMap.get(ps.familyId) || 0) + remaining
          );
        }
      }

      // Merge shortages with carry-over data
      const result = shortages.map((s) => ({
        familyId: s.familyId,
        familyHead: s.family.familyHead,
        selapananId: s.selapananId,
        selapananPeriode: {
          start: s.selapanan.periodeStart,
          end: s.selapanan.periodeEnd,
        },
        totalShortage: s.totalShortage,
        settledAmount: s.settledAmount,
        isSettled: s.isSettled,
        carriedOver: s.carriedOver,
        carriedOverAmount: carriedOverMap.get(s.familyId) || 0,
        notes: s.notes,
      }));

      return NextResponse.json({
        selapananId,
        selapanan: {
          periodeStart: selapanan.periodeStart,
          periodeEnd: selapanan.periodeEnd,
          status: selapanan.status,
        },
        shortages: result,
      });
    } else {
      // Return summary for all selapanan periods
      const allSelapanan = await db.selapanan.findMany({
        where: { status: { not: 'CANCELLED' } },
        orderBy: { periodeStart: 'desc' },
        include: {
          shortages: {
            include: {
              family: { select: { id: true, familyHead: true } },
            },
            orderBy: { family: { familyHead: 'asc' } },
          },
        },
      });

      // For each selapanan, compute total shortage stats
      const summary = allSelapanan.map((sel) => {
        const totalShortage = sel.shortages.reduce((sum, s) => sum + s.totalShortage, 0);
        const totalSettled = sel.shortages.reduce((sum, s) => sum + s.settledAmount, 0);
        const unsettledCount = sel.shortages.filter((s) => !s.isSettled).length;

        return {
          selapananId: sel.id,
          periodeStart: sel.periodeStart,
          periodeEnd: sel.periodeEnd,
          status: sel.status,
          totalShortage,
          totalSettled,
          totalRemaining: totalShortage - totalSettled,
          familyCount: sel.shortages.length,
          unsettledCount,
          shortages: sel.shortages.map((s) => ({
            familyId: s.familyId,
            familyHead: s.family.familyHead,
            totalShortage: s.totalShortage,
            settledAmount: s.settledAmount,
            isSettled: s.isSettled,
            carriedOver: s.carriedOver,
            notes: s.notes,
          })),
        };
      });

      return NextResponse.json({ summary });
    }
  } catch (error) {
    console.error('Jimpitan Shortages GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST /api/jimpitan/shortages — Settle shortages at selapanan (Admin only)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { selapananId, settlements } = await request.json();

    if (!selapananId || !Array.isArray(settlements) || settlements.length === 0) {
      return NextResponse.json(
        { error: 'selapananId dan settlements wajib diisi' },
        { status: 400 }
      );
    }

    // Verify selapanan exists
    const selapanan = await db.selapanan.findUnique({
      where: { id: selapananId },
    });
    if (!selapanan) {
      return NextResponse.json({ error: 'Selapanan tidak ditemukan' }, { status: 404 });
    }

    // Find the next selapanan for carry-over
    const nextSelapanan = await db.selapanan.findFirst({
      where: {
        periodeStart: { gt: selapanan.periodeStart },
        status: { not: 'CANCELLED' },
      },
      orderBy: { periodeStart: 'asc' },
    });

    const results = [];

    for (const settlement of settlements) {
      const { familyId, settledAmount } = settlement;

      if (!familyId || settledAmount === undefined) continue;

      // Find the shortage record
      const shortage = await db.jimpitanShortage.findUnique({
        where: { familyId_selapananId: { familyId, selapananId } },
      });

      if (!shortage) continue;

      const isFullyPaid = settledAmount >= shortage.totalShortage;
      const newSettledAmount = Math.min(settledAmount, shortage.totalShortage);

      // Update the shortage record
      const updatedShortage = await db.jimpitanShortage.update({
        where: { id: shortage.id },
        data: {
          settledAmount: newSettledAmount,
          isSettled: isFullyPaid,
          carriedOver: !isFullyPaid,
        },
      });

      // Create a Transaction record for the settled amount
      if (newSettledAmount > 0) {
        const family = await db.family.findUnique({
          where: { id: familyId },
          select: { familyHead: true },
        });

        await db.transaction.create({
          data: {
            type: 'INCOME',
            category: 'JIMPITAN',
            amount: newSettledAmount,
            description: `Pembayaran kekurangan jimpitan - ${family?.familyHead || 'Unknown'} (${selapanan.periodeStart} s/d ${selapanan.periodeEnd})`,
            date: new Date().toISOString().split('T')[0],
            selapananId,
            createdBy: authUser.id,
          },
        });
      }

      // If not fully paid and there's a next selapanan, carry over the remaining shortage
      if (!isFullyPaid && nextSelapanan) {
        const remainingShortage = shortage.totalShortage - newSettledAmount;

        // Create or update shortage entry in the next selapanan
        await db.jimpitanShortage.upsert({
          where: {
            familyId_selapananId: {
              familyId,
              selapananId: nextSelapanan.id,
            },
          },
          create: {
            familyId,
            selapananId: nextSelapanan.id,
            totalShortage: remainingShortage,
            isSettled: false,
            settledAmount: 0,
            carriedOver: true,
            notes: `Carry-over dari periode ${selapanan.periodeStart} s/d ${selapanan.periodeEnd}`,
          },
          update: {
            totalShortage: { increment: remainingShortage },
            carriedOver: true,
          },
        });
      }

      results.push(updatedShortage);
    }

    return NextResponse.json({
      message: `Berhasil memproses ${results.length} pembayaran kekurangan`,
      selapananId,
      processedCount: results.length,
    });
  } catch (error) {
    console.error('Jimpitan Shortages POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
