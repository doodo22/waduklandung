import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');
    const userId = searchParams.get('userId');

    const where: Record<string, unknown> = {};
    if (scheduleId) where.scheduleId = scheduleId;
    if (userId) where.userId = userId;

    const logs = await db.rondaLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        family: { select: { id: true, familyHead: true } },
        schedule: { include: { group: true } },
      },
      take: 100,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Ronda Logs GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { scheduleId, userId, familyId, status, notes } = await request.json();
    if (!scheduleId || !userId || !familyId) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Upsert: update if exists, create if not
    const existing = await db.rondaLog.findFirst({
      where: { scheduleId, userId },
    });

    let log;
    if (existing) {
      log = await db.rondaLog.update({
        where: { id: existing.id },
        data: { status: status || 'HADIR', notes },
      });
    } else {
      log = await db.rondaLog.create({
        data: {
          scheduleId,
          userId,
          familyId,
          status: status || 'HADIR',
          notes,
        },
      });
    }

    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error('Ronda Logs POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
