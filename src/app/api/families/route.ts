import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (isAdmin(authUser.role)) {
      // Admin: return all families
      const families = await db.family.findMany({
        orderBy: { familyHead: 'asc' },
        include: {
          members: {
            select: { id: true, name: true, role: true, status: true },
          },
        },
      });
      return NextResponse.json({ families });
    } else {
      // Warga: return only their own family
      if (authUser.familyId) {
        const family = await db.family.findUnique({
          where: { id: authUser.familyId },
          include: {
            members: {
              select: { id: true, name: true, role: true, status: true },
            },
          },
        });
        return NextResponse.json({ families: family ? [family] : [] });
      }
      return NextResponse.json({ families: [] });
    }
  } catch (error) {
    console.error('Families GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { familyHead, address, memberCount, rondaGroup } = await request.json();

    if (!familyHead || !address) {
      return NextResponse.json({ error: 'Nama KK dan alamat wajib diisi' }, { status: 400 });
    }

    const family = await db.family.create({
      data: {
        familyHead,
        address,
        memberCount: memberCount || 1,
        rondaGroup: rondaGroup || null,
      },
    });

    return NextResponse.json({ family }, { status: 201 });
  } catch (error) {
    console.error('Families POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, familyHead, address, memberCount, rondaGroup, isActive } = await request.json();

    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (familyHead !== undefined) data.familyHead = familyHead;
    if (address !== undefined) data.address = address;
    if (memberCount !== undefined) data.memberCount = memberCount;
    if (rondaGroup !== undefined) data.rondaGroup = rondaGroup;
    if (isActive !== undefined) data.isActive = isActive;

    const family = await db.family.update({ where: { id }, data });

    return NextResponse.json({ family });
  } catch (error) {
    console.error('Families PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
