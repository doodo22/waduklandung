import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { username } });

    if (!user) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    if (!verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    if (user.status === 'PENDING') {
      return NextResponse.json({ error: 'Akun belum diverifikasi oleh admin' }, { status: 403 });
    }

    if (user.status === 'REJECTED') {
      return NextResponse.json({ error: 'Akun ditolak oleh admin' }, { status: 403 });
    }

    if (user.status === 'INACTIVE') {
      return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 403 });
    }

    const token = generateToken(user.id);

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status,
        phone: user.phone,
        address: user.address,
        familyId: user.familyId,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
