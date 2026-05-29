import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password, name, phone, address } = await request.json();

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: 'Username, password, dan nama wajib diisi' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username minimal 3 karakter' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter' },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    const hashedPassword = hashPassword(password);

    const user = await db.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        phone: phone || null,
        address: address || null,
        role: 'WARGA',
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      message: 'Registrasi berhasil. Menunggu verifikasi admin.',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        status: user.status,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
