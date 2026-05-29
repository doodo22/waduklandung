import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const inventory = await db.inventory.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error('Inventory GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { name, quantity, condition, location, notes } = await request.json();
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });

    const item = await db.inventory.create({
      data: { name, quantity: quantity || 1, condition: condition || 'BAIK', location, notes },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Inventory POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, name, quantity, condition, location, notes } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (quantity !== undefined) data.quantity = quantity;
    if (condition !== undefined) data.condition = condition;
    if (location !== undefined) data.location = location;
    if (notes !== undefined) data.notes = notes;

    const item = await db.inventory.update({ where: { id }, data });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Inventory PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    await db.inventory.delete({ where: { id } });

    return NextResponse.json({ message: 'Inventaris berhasil dihapus' });
  } catch (error) {
    console.error('Inventory DELETE error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
