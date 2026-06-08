import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// GET /api/ronda/groups/[id] — Return group with families
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const group = await db.rondaGroup.findUnique({
      where: { id },
      include: {
        families: {
          where: { isActive: true, rondaStatus: 'AKTIF' },
          select: {
            id: true,
            familyHead: true,
            address: true,
            rondaGroupId: true,
            rondaStatus: true,
          },
          orderBy: { familyHead: 'asc' },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Grup ronda tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ group });
  } catch (error) {
    console.error('Ronda Group GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// PUT /api/ronda/groups/[id] — Update group (name, description)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const { name, description } = await request.json();

    const existingGroup = await db.rondaGroup.findUnique({ where: { id } });
    if (!existingGroup) {
      return NextResponse.json({ error: 'Grup ronda tidak ditemukan' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;

    const group = await db.rondaGroup.update({
      where: { id },
      data,
      include: {
        families: {
          where: { isActive: true, rondaStatus: 'AKTIF' },
          select: {
            id: true,
            familyHead: true,
            address: true,
            rondaGroupId: true,
            rondaStatus: true,
          },
          orderBy: { familyHead: 'asc' },
        },
      },
    });

    return NextResponse.json({ group });
  } catch (error) {
    console.error('Ronda Group PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// DELETE /api/ronda/groups/[id] — Remove group (only if no families assigned)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const group = await db.rondaGroup.findUnique({
      where: { id },
      include: {
        families: { where: { isActive: true, rondaStatus: 'AKTIF' } },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Grup ronda tidak ditemukan' }, { status: 404 });
    }

    if (group.families.length > 0) {
      return NextResponse.json(
        { error: 'Grup tidak dapat dihapus karena masih ada keluarga yang terdaftar' },
        { status: 400 }
      );
    }

    await db.rondaGroup.delete({ where: { id } });

    return NextResponse.json({ message: 'Grup ronda berhasil dihapus' });
  } catch (error) {
    console.error('Ronda Group DELETE error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
