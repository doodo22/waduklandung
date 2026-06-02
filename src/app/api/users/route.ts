import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { username: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const users = await db.user.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, role, status, name, phone, address, familyId } = await request.json();

    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    // Non-admin users can only update their own profile (phone/address only)
    if (!isAdmin(authUser.role)) {
      if (id !== authUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Only allow phone and address updates for non-admin users
      const data: Record<string, unknown> = {};
      if (phone !== undefined) data.phone = phone;
      if (address !== undefined) data.address = address;

      const user = await db.user.update({
        where: { id },
        data,
        select: {
          id: true, username: true, name: true, role: true,
          status: true, phone: true, address: true, familyId: true,
        },
      });
      return NextResponse.json({ user });
    }

    // Admin can update all fields
    const data: Record<string, unknown> = {};
    if (role !== undefined) data.role = role;
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (familyId !== undefined) data.familyId = familyId;

    // Special handling: when approving a PENDING user, auto-create Family + FamilyMember
    if (status === 'ACTIVE') {
      const existingUser = await db.user.findUnique({ where: { id } });
      if (existingUser && existingUser.status === 'PENDING') {
        data.status = 'ACTIVE';

        // Create Family record with the user as KK
        const family = await db.family.create({
          data: {
            familyHead: existingUser.name,
            address: existingUser.address || 'Belum diisi',
            familyMembers: {
              create: {
                userId: existingUser.id,
                fullName: existingUser.name,
                gender: 'LAKI_LAKI',
                relationship: 'KEPALA_KELUARGA',
                isFamilyHead: true,
                maritalStatus: 'KAWIN',
                citizenship: 'WNI',
              },
            },
          },
        });

        // Link user to the new family
        data.familyId = family.id;

        const user = await db.user.update({
          where: { id },
          data,
          select: {
            id: true, username: true, name: true, role: true,
            status: true, phone: true, address: true, familyId: true,
          },
        });

        return NextResponse.json({ user });
      }
    }

    if (status !== undefined) data.status = status;

    const user = await db.user.update({
      where: { id },
      data,
      select: {
        id: true, username: true, name: true, role: true,
        status: true, phone: true, address: true, familyId: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Users PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'KETUA_RT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    await db.user.update({ where: { id }, data: { status: 'INACTIVE' } });

    return NextResponse.json({ message: 'User berhasil dinonaktifkan' });
  } catch (error) {
    console.error('Users DELETE error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
