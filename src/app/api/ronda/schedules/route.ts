import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const date = searchParams.get('date');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Record<string, unknown> = {};
    if (groupId) where.groupId = groupId;
    if (date) where.date = date;
    if (from && to) {
      where.date = { gte: from, lte: to };
    } else if (from) {
      where.date = { gte: from };
    }

    const schedules = await db.rondaSchedule.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        group: true,
        logs: {
          include: {
            user: { select: { id: true, name: true } },
            family: { select: { id: true, familyHead: true } },
          },
        },
      },
      take: 60,
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Ronda Schedules GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { groupId, date, shift, notes } = await request.json();
    if (!groupId || !date) {
      return NextResponse.json({ error: 'Grup dan tanggal wajib diisi' }, { status: 400 });
    }

    const schedule = await db.rondaSchedule.create({
      data: { groupId, date, shift: shift || 'MALAM', notes },
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error('Ronda Schedules POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
