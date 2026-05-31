import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// GET /api/ronda/groups — Return all 7 groups with their families
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const groups = await db.rondaGroup.findMany({
      orderBy: { dayOfWeek: 'asc' },
      include: {
        families: {
          where: { isActive: true },
          select: {
            id: true,
            familyHead: true,
            address: true,
            rondaGroupId: true,
          },
          orderBy: { familyHead: 'asc' },
        },
      },
    });

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Ronda Groups GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST /api/ronda/groups — Assign a family to a group
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { familyId, groupId } = await request.json();
    if (!familyId || !groupId) {
      return NextResponse.json({ error: 'familyId dan groupId wajib diisi' }, { status: 400 });
    }

    // Verify the group exists
    const group = await db.rondaGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return NextResponse.json({ error: 'Grup ronda tidak ditemukan' }, { status: 404 });
    }

    // Verify the family exists
    const family = await db.family.findUnique({ where: { id: familyId } });
    if (!family) {
      return NextResponse.json({ error: 'Keluarga tidak ditemukan' }, { status: 404 });
    }

    // Update the family's rondaGroupId (allows moving from another group)
    await db.family.update({
      where: { id: familyId },
      data: { rondaGroupId: groupId },
    });

    // Return the updated group with families
    const updatedGroup = await db.rondaGroup.findUnique({
      where: { id: groupId },
      include: {
        families: {
          where: { isActive: true },
          select: {
            id: true,
            familyHead: true,
            address: true,
            rondaGroupId: true,
          },
          orderBy: { familyHead: 'asc' },
        },
      },
    });

    return NextResponse.json({ group: updatedGroup });
  } catch (error) {
    console.error('Ronda Groups POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
