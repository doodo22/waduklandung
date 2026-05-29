import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const familyId = searchParams.get('familyId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (familyId) where.familyId = familyId;

    // Warga can only see their own fines
    if (!isAdmin(authUser.role)) {
      where.userId = authUser.id;
    }

    const fines = await db.fine.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        family: { select: { id: true, familyHead: true } },
      },
      take: 100,
    });

    const totalUnpaid = fines.filter((f) => f.status === 'UNPAID').reduce((sum, f) => sum + f.amount, 0);
    const totalPaid = fines.filter((f) => f.status === 'PAID').reduce((sum, f) => sum + f.amount, 0);

    return NextResponse.json({ fines, summary: { totalUnpaid, totalPaid } });
  } catch (error) {
    console.error('Fines GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { userId, familyId, type, amount, reason, date, selapananId } = await request.json();

    if (!userId || !familyId || !type || !amount || !reason || !date) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const fine = await db.fine.create({
      data: {
        userId,
        familyId,
        type,
        amount,
        reason,
        date,
        selapananId: selapananId || null,
      },
    });

    return NextResponse.json({ fine }, { status: 201 });
  } catch (error) {
    console.error('Fines POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, status } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    const fine = await db.fine.update({ where: { id }, data: { status: status || 'PAID' } });

    return NextResponse.json({ fine });
  } catch (error) {
    console.error('Fines PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
