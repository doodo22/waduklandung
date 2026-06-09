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

// GET /api/selapanan/tarikan?selapananId=xxx
// Generates and returns consolidated per-family charge records
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const selapananId = searchParams.get('selapananId');

    if (!selapananId) {
      return NextResponse.json({ error: 'selapananId wajib diisi' }, { status: 400 });
    }

    const selapanan = await db.selapanan.findUnique({ where: { id: selapananId } });
    if (!selapanan) return NextResponse.json({ error: 'Selapanan tidak ditemukan' }, { status: 404 });

    // Get all active families with their ronda group info
    const families = await db.family.findMany({
      where: { isActive: true },
      select: {
        id: true,
        familyHead: true,
        jimpitanType: true,
        jimpitanAmount: true,
        rondaStatus: true,
        rondaFee: true,
        rondaGroupId: true,
        rondaGroup: { select: { id: true, name: true, dayOfWeek: true } },
      },
      orderBy: { familyHead: 'asc' },
    });

    // Get previous unpaid shortages (carry-over from previous selapanan)
    const prevShortages = await db.jimpitanShortage.findMany({
      where: {
        isSettled: false,
        selapanan: {
          periodeEnd: { lt: selapanan.periodeStart },
          status: { not: 'CANCELLED' },
        },
      },
      include: {
        family: { select: { id: true, familyHead: true } },
        selapanan: { select: { number: true } },
      },
    });

    // Build map of familyId → previous shortage remaining
    const prevShortageMap = new Map<string, { remaining: number; fromSelapanan: number }>();
    for (const s of prevShortages) {
      const existing = prevShortageMap.get(s.familyId);
      const remaining = s.totalShortage - s.settledAmount;
      if (existing) {
        existing.remaining += remaining;
      } else {
        prevShortageMap.set(s.familyId, { remaining, fromSelapanan: s.selapanan.number });
      }
    }

    // Get current period jimpitan shortage per family
    const currentLogs = await db.jimpitanLog.findMany({
      where: { selapananId },
      select: { familyId: true, shortage: true },
    });

    const currentShortageMap = new Map<string, number>();
    for (const log of currentLogs) {
      const existing = currentShortageMap.get(log.familyId) || 0;
      currentShortageMap.set(log.familyId, existing + log.shortage);
    }

    // Calculate months spanned for monthly payers
    const monthsSpanned = countMonthBoundaries(selapanan.periodeStart, selapanan.periodeEnd);

    // Get existing tarikan records for this selapanan
    const existingTarikan = await db.selapananTarikan.findMany({
      where: { selapananId },
      include: { family: { select: { familyHead: true } } },
      orderBy: { family: { familyHead: 'asc' } },
    });

    const existingTarikanMap = new Map(existingTarikan.map(t => [t.familyId, t]));

    // Get ronda group setoran notes from previous selapanan
    const prevRondaNotes = await db.transaction.findMany({
      where: {
        category: 'JIMPITAN',
        description: { contains: 'Setoran' },
        selapanan: {
          periodeEnd: { lt: selapanan.periodeStart },
          status: { not: 'CANCELLED' },
        },
      },
      select: { description: true, amount: true, date: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Build tarikan records for each family
    const tarikanRecords = [];

    for (const family of families) {
      const sisaTarikan = prevShortageMap.get(family.id)?.remaining || 0;
      const kuranganJimpitan = family.jimpitanType === 'HARIAN' ? (currentShortageMap.get(family.id) || 0) : 0;
      const iuranBulanan = family.jimpitanType === 'BULANAN' ? family.jimpitanAmount * monthsSpanned : 0;
      const iuranRonda = family.rondaStatus === 'BAYAR_IURAN' ? family.rondaFee : 0;

      const existing = existingTarikanMap.get(family.id);

      // If tarikan record exists, use its payment data; otherwise create new
      if (existing) {
        tarikanRecords.push({
          id: existing.id,
          selapananId: existing.selapananId,
          familyId: existing.familyId,
          familyHead: existing.family.familyHead,
          jimpitanType: family.jimpitanType,
          rondaStatus: family.rondaStatus,
          rondaGroup: family.rondaGroup ? { id: family.rondaGroup.id, name: family.rondaGroup.name } : null,
          monthsSpanned,
          sisaTarikan: existing.sisaTarikan,
          kuranganJimpitan: existing.kuranganJimpitan,
          iuranBulanan: existing.iuranBulanan,
          iuranRonda: existing.iuranRonda,
          totalHarusBayar: existing.sisaTarikan + existing.kuranganJimpitan + existing.iuranBulanan + existing.iuranRonda,
          jumlahBayar: existing.jumlahBayar,
          sisaDepan: existing.sisaDepan,
          notes: existing.notes,
          prevFromSelapanan: prevShortageMap.get(family.id)?.fromSelapanan || null,
        });
      } else {
        const totalHarusBayar = sisaTarikan + kuranganJimpitan + iuranBulanan + iuranRonda;
        const sisaDepan = totalHarusBayar; // belum bayar apapun

        tarikanRecords.push({
          id: null,
          selapananId,
          familyId: family.id,
          familyHead: family.familyHead,
          jimpitanType: family.jimpitanType,
          rondaStatus: family.rondaStatus,
          rondaGroup: family.rondaGroup ? { id: family.rondaGroup.id, name: family.rondaGroup.name } : null,
          monthsSpanned,
          sisaTarikan,
          kuranganJimpitan,
          iuranBulanan,
          iuranRonda,
          totalHarusBayar,
          jumlahBayar: 0,
          sisaDepan,
          notes: null,
          prevFromSelapanan: prevShortageMap.get(family.id)?.fromSelapanan || null,
        });
      }
    }

    // Calculate totals
    const totals = {
      totalSisaTarikan: tarikanRecords.reduce((s, t) => s + t.sisaTarikan, 0),
      totalKuranganJimpitan: tarikanRecords.reduce((s, t) => s + t.kuranganJimpitan, 0),
      totalIuranBulanan: tarikanRecords.reduce((s, t) => s + t.iuranBulanan, 0),
      totalIuranRonda: tarikanRecords.reduce((s, t) => s + t.iuranRonda, 0),
      totalHarusBayar: tarikanRecords.reduce((s, t) => s + t.totalHarusBayar, 0),
      totalSudahBayar: tarikanRecords.reduce((s, t) => s + t.jumlahBayar, 0),
      totalSisaDepan: tarikanRecords.reduce((s, t) => s + t.sisaDepan, 0),
      familiesWithSisa: tarikanRecords.filter(t => t.sisaTarikan > 0).length,
      familiesTotal: tarikanRecords.length,
    };

    return NextResponse.json({
      selapanan: {
        id: selapanan.id,
        number: selapanan.number,
        periodeStart: selapanan.periodeStart,
        periodeEnd: selapanan.periodeEnd,
        meetingDate: selapanan.meetingDate,
      },
      monthsSpanned,
      tarikan: tarikanRecords,
      totals,
      prevRondaNotes: prevRondaNotes.map(n => ({ description: n.description, amount: n.amount, date: n.date })),
    });
  } catch (error) {
    console.error('Selapanan Tarikan GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST /api/selapanan/tarikan — Generate/save tarikan records for a selapanan
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { selapananId } = body;

    if (!selapananId) return NextResponse.json({ error: 'selapananId wajib diisi' }, { status: 400 });

    const selapanan = await db.selapanan.findUnique({ where: { id: selapananId } });
    if (!selapanan) return NextResponse.json({ error: 'Selapanan tidak ditemukan' }, { status: 404 });
    if (selapanan.status === 'COMPLETED') return NextResponse.json({ error: 'Selapanan sudah selesai' }, { status: 400 });

    // Get all active families
    const families = await db.family.findMany({
      where: { isActive: true },
      select: {
        id: true,
        familyHead: true,
        jimpitanType: true,
        jimpitanAmount: true,
        rondaStatus: true,
        rondaFee: true,
      },
      orderBy: { familyHead: 'asc' },
    });

    // Get previous unpaid shortages
    const prevShortages = await db.jimpitanShortage.findMany({
      where: {
        isSettled: false,
        selapanan: {
          periodeEnd: { lt: selapanan.periodeStart },
          status: { not: 'CANCELLED' },
        },
      },
    });

    const prevShortageMap = new Map<string, number>();
    for (const s of prevShortages) {
      const existing = prevShortageMap.get(s.familyId) || 0;
      prevShortageMap.set(s.familyId, existing + (s.totalShortage - s.settledAmount));
    }

    // Get current period jimpitan shortage per family
    const currentLogs = await db.jimpitanLog.findMany({
      where: { selapananId },
      select: { familyId: true, shortage: true },
    });

    const currentShortageMap = new Map<string, number>();
    for (const log of currentLogs) {
      const existing = currentShortageMap.get(log.familyId) || 0;
      currentShortageMap.set(log.familyId, existing + log.shortage);
    }

    const monthsSpanned = countMonthBoundaries(selapanan.periodeStart, selapanan.periodeEnd);

    // Upsert tarikan records
    let upserted = 0;
    for (const family of families) {
      const sisaTarikan = prevShortageMap.get(family.id) || 0;
      const kuranganJimpitan = family.jimpitanType === 'HARIAN' ? (currentShortageMap.get(family.id) || 0) : 0;
      const iuranBulanan = family.jimpitanType === 'BULANAN' ? family.jimpitanAmount * monthsSpanned : 0;
      const iuranRonda = family.rondaStatus === 'BAYAR_IURAN' ? family.rondaFee : 0;
      const totalHarusBayar = sisaTarikan + kuranganJimpitan + iuranBulanan + iuranRonda;

      await db.selapananTarikan.upsert({
        where: { selapananId_familyId: { selapananId, familyId: family.id } },
        create: {
          selapananId,
          familyId: family.id,
          sisaTarikan,
          kuranganJimpitan,
          iuranBulanan,
          iuranRonda,
          jumlahBayar: 0,
          sisaDepan: totalHarusBayar,
        },
        update: {
          sisaTarikan,
          kuranganJimpitan,
          iuranBulanan,
          iuranRonda,
          // Don't overwrite jumlahBayar and sisaDepan if already recorded
        },
      });
      upserted++;
    }

    return NextResponse.json({
      message: `Tarikan berhasil digenerate untuk ${upserted} KK`,
      count: upserted,
    });
  } catch (error) {
    console.error('Selapanan Tarikan POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
