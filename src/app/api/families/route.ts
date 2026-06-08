import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (isAdmin(authUser.role)) {
      const families = await db.family.findMany({
        orderBy: { familyHead: 'asc' },
        include: {
          users: {
            select: { id: true, name: true, role: true, status: true, phone: true },
          },
          familyMembers: {
            orderBy: [
              { isFamilyHead: 'desc' },
              { createdAt: 'asc' },
            ],
          },
          rondaGroup: {
            select: { id: true, name: true, dayOfWeek: true },
          },
        },
      });
      return NextResponse.json({ families });
    } else {
      if (authUser.familyId) {
        const family = await db.family.findUnique({
          where: { id: authUser.familyId },
          include: {
            users: {
              select: { id: true, name: true, role: true, status: true, phone: true },
            },
            familyMembers: {
              orderBy: [
                { isFamilyHead: 'desc' },
                { createdAt: 'asc' },
              ],
            },
            rondaGroup: {
              select: { id: true, name: true, dayOfWeek: true },
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

    const { familyHead, address, rondaGroupId } = await request.json();

    if (!familyHead || !address) {
      return NextResponse.json({ error: 'Nama KK dan alamat wajib diisi' }, { status: 400 });
    }

    // Create family + the KK member in one transaction
    const family = await db.family.create({
      data: {
        familyHead,
        address,
        rondaGroupId: rondaGroupId || null,
        familyMembers: {
          create: {
            fullName: familyHead,
            gender: 'LAKI_LAKI',
            relationship: 'KEPALA_KELUARGA',
            isFamilyHead: true,
            maritalStatus: 'KAWIN',
            citizenship: 'WNI',
          },
        },
      },
      include: {
        familyMembers: true,
        rondaGroup: { select: { id: true, name: true, dayOfWeek: true } },
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

    const { id, familyHead, address, rondaGroupId, isActive, jimpitanType, jimpitanAmount, rondaStatus, rondaFee } = await request.json();

    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (familyHead !== undefined) data.familyHead = familyHead;
    if (address !== undefined) data.address = address;
    if (isActive !== undefined) data.isActive = isActive;
    if (jimpitanType !== undefined) data.jimpitanType = jimpitanType;
    if (jimpitanAmount !== undefined) data.jimpitanAmount = jimpitanAmount;
    if (rondaStatus !== undefined) {
      data.rondaStatus = rondaStatus;
      // Auto-remove from ronda group when status is not AKTIF (dispensasi)
      if (rondaStatus !== 'AKTIF') {
        data.rondaGroupId = null;
      }
    }
    if (rondaFee !== undefined) data.rondaFee = rondaFee;
    // Only allow rondaGroupId for AKTIF families
    if (rondaGroupId !== undefined) {
      const finalStatus = data.rondaStatus as string | undefined;
      if (finalStatus && finalStatus !== 'AKTIF') {
        // Ignore group assignment for non-AKTIF (dispensasi)
      } else {
        data.rondaGroupId = rondaGroupId || null;
      }
    }

    // If familyHead name changes, also update the KK member's fullName
    if (familyHead) {
      const headMember = await db.familyMember.findFirst({
        where: { familyId: id, isFamilyHead: true },
      });
      if (headMember) {
        await db.familyMember.update({
          where: { id: headMember.id },
          data: { fullName: familyHead },
        });
      }
    }

    const family = await db.family.update({
      where: { id },
      data,
      include: {
        familyMembers: { orderBy: [{ isFamilyHead: 'desc' }, { createdAt: 'asc' }] },
        rondaGroup: { select: { id: true, name: true, dayOfWeek: true } },
      },
    });

    return NextResponse.json({ family });
  } catch (error) {
    console.error('Families PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
