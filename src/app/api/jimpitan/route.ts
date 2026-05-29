import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get('familyId');
    const date = searchParams.get('date');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Record<string, unknown> = {};
    if (familyId) where.familyId = familyId;
    if (date) where.date = date;
    if (from && to) {
      where.date = { gte: from, lte: to };
    } else if (from) {
      where.date = { gte: from };
    }

    const logs = await db.jimpitanLog.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        family: { select: { id: true, familyHead: true } },
        creator: { select: { id: true, name: true } },
      },
      take: 200,
    });

    // Summary
    const totalAmount = logs.reduce((sum, l) => sum + l.amount, 0);
    const totalPaid = logs.filter((l) => l.isPaid).reduce((sum, l) => sum + l.amount, 0);
    const totalUnpaid = totalAmount - totalPaid;

    return NextResponse.json({ logs, summary: { totalAmount, totalPaid, totalUnpaid, count: logs.length } });
  } catch (error) {
    console.error('Jimpitan GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { familyId, date, amount, isPaid, notes } = await request.json();
    if (!familyId || !date || amount === undefined) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const log = await db.jimpitanLog.create({
      data: {
        familyId,
        date,
        amount,
        isPaid: isPaid ?? false,
        notes,
        createdBy: authUser.id,
      },
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error('Jimpitan POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, amount, isPaid, notes } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (amount !== undefined) data.amount = amount;
    if (isPaid !== undefined) data.isPaid = isPaid;
    if (notes !== undefined) data.notes = notes;

    const log = await db.jimpitanLog.update({ where: { id }, data });

    return NextResponse.json({ log });
  } catch (error) {
    console.error('Jimpitan PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
