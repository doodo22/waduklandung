import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const userId = searchParams.get('userId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;

    // Warga can only see their own letters
    if (!isAdmin(authUser.role)) {
      where.userId = authUser.id;
    } else if (userId) {
      where.userId = userId;
    }

    const letters = await db.letter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
      take: 100,
    });

    return NextResponse.json({ letters });
  } catch (error) {
    console.error('Letters GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { type, purpose, notes } = await request.json();
    if (!type || !purpose) {
      return NextResponse.json({ error: 'Jenis dan keperluan surat wajib diisi' }, { status: 400 });
    }

    const letter = await db.letter.create({
      data: {
        type,
        purpose,
        notes,
        userId: authUser.id,
      },
    });

    return NextResponse.json({ letter }, { status: 201 });
  } catch (error) {
    console.error('Letters POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, letterNumber, status, notes } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (letterNumber !== undefined) data.letterNumber = letterNumber;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;

    const letter = await db.letter.update({ where: { id }, data });

    return NextResponse.json({ letter });
  } catch (error) {
    console.error('Letters PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
