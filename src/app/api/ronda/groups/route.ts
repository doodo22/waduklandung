import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const groups = await db.rondaGroup.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        schedules: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Ronda Groups GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { name, description } = await request.json();
    if (!name) return NextResponse.json({ error: 'Nama grup wajib diisi' }, { status: 400 });

    const group = await db.rondaGroup.create({ data: { name, description } });
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error('Ronda Groups POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
