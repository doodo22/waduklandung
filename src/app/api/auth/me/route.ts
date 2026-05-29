import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const userId = verifyToken(token);

    if (!userId) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        address: true,
        familyId: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 403 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
