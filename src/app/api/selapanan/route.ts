import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const selapanan = await db.selapanan.findMany({
      where,
      orderBy: { periodeStart: 'desc' },
      include: {
        details: true,
      },
      take: 20,
    });

    return NextResponse.json({ selapanan });
  } catch (error) {
    console.error('Selapanan GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { periodeStart, periodeEnd, meetingDate, meetingLocation, notes, details } = await request.json();

    if (!periodeStart || !periodeEnd || !meetingDate) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const selapanan = await db.selapanan.create({
      data: {
        periodeStart,
        periodeEnd,
        meetingDate,
        meetingLocation,
        notes,
        details: details
          ? { create: details.map((d: { agenda: string; decisions?: string; notes?: string }) => ({ agenda: d.agenda, decisions: d.decisions, notes: d.notes })) }
          : undefined,
      },
      include: { details: true },
    });

    return NextResponse.json({ selapanan }, { status: 201 });
  } catch (error) {
    console.error('Selapanan POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, status, meetingLocation, notes } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (meetingLocation !== undefined) data.meetingLocation = meetingLocation;
    if (notes !== undefined) data.notes = notes;

    const selapanan = await db.selapanan.update({ where: { id }, data });

    return NextResponse.json({ selapanan });
  } catch (error) {
    console.error('Selapanan PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
