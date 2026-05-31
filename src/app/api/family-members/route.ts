import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// GET /api/family-members?familyId=xxx — list members of a family
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get('familyId');

    if (!familyId) {
      return NextResponse.json({ error: 'familyId wajib diisi' }, { status: 400 });
    }

    // Warga can only see their own family members
    if (!isAdmin(authUser.role) && authUser.familyId !== familyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const members = await db.familyMember.findMany({
      where: { familyId },
      orderBy: [{ isFamilyHead: 'desc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('FamilyMembers GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST /api/family-members — add a member
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      familyId, fullName, nik, gender, relationship, maritalStatus,
      birthPlace, birthDate, education, citizenship, occupation, isFamilyHead, userId,
    } = body;

    if (!familyId || !fullName || !gender || !relationship) {
      return NextResponse.json(
        { error: 'familyId, nama lengkap, jenis kelamin, dan hubungan keluarga wajib diisi' },
        { status: 400 }
      );
    }

    // Warga can only add members to their own family
    if (!isAdmin(authUser.role) && authUser.familyId !== familyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If this member is set as Kepala Keluarga, unset any existing KK
    if (isFamilyHead) {
      const existingHead = await db.familyMember.findFirst({
        where: { familyId, isFamilyHead: true },
      });
      if (existingHead) {
        await db.familyMember.update({
          where: { id: existingHead.id },
          data: { isFamilyHead: false, relationship: 'FAMILI_LAIN' },
        });
      }
      // Also update Family.familyHead
      await db.family.update({
        where: { id: familyId },
        data: { familyHead: fullName },
      });
    }

    const member = await db.familyMember.create({
      data: {
        familyId,
        userId: userId || null,
        fullName,
        nik: nik || null,
        gender,
        relationship,
        maritalStatus: maritalStatus || null,
        birthPlace: birthPlace || null,
        birthDate: birthDate || null,
        education: education || null,
        citizenship: citizenship || 'WNI',
        occupation: occupation || null,
        isFamilyHead: isFamilyHead || false,
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error('FamilyMembers POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// PUT /api/family-members — update a member
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      id, fullName, nik, gender, relationship, maritalStatus,
      birthPlace, birthDate, education, citizenship, occupation, isFamilyHead, userId,
    } = body;

    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    // Find the member first to check ownership
    const existing = await db.familyMember.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 });

    // Warga can only edit their own family members
    if (!isAdmin(authUser.role) && authUser.familyId !== existing.familyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If promoting to KK, demote existing KK
    if (isFamilyHead && !existing.isFamilyHead) {
      const currentHead = await db.familyMember.findFirst({
        where: { familyId: existing.familyId, isFamilyHead: true },
      });
      if (currentHead) {
        await db.familyMember.update({
          where: { id: currentHead.id },
          data: { isFamilyHead: false, relationship: 'FAMILI_LAIN' },
        });
      }
    }

    const data: Record<string, unknown> = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (nik !== undefined) data.nik = nik || null;
    if (gender !== undefined) data.gender = gender;
    if (relationship !== undefined) data.relationship = relationship;
    if (maritalStatus !== undefined) data.maritalStatus = maritalStatus || null;
    if (birthPlace !== undefined) data.birthPlace = birthPlace || null;
    if (birthDate !== undefined) data.birthDate = birthDate || null;
    if (education !== undefined) data.education = education || null;
    if (citizenship !== undefined) data.citizenship = citizenship;
    if (occupation !== undefined) data.occupation = occupation || null;
    if (isFamilyHead !== undefined) data.isFamilyHead = isFamilyHead;
    if (userId !== undefined) data.userId = userId || null;

    const member = await db.familyMember.update({ where: { id }, data });

    // If this is the KK, sync the Family.familyHead field
    if (isFamilyHead && fullName) {
      await db.family.update({
        where: { id: existing.familyId },
        data: { familyHead: fullName },
      });
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error('FamilyMembers PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// DELETE /api/family-members?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    const existing = await db.familyMember.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 });

    if (!isAdmin(authUser.role) && authUser.familyId !== existing.familyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (existing.isFamilyHead) {
      return NextResponse.json(
        { error: 'Kepala Keluarga tidak bisa dihapus. Ubah KK terlebih dahulu.' },
        { status: 400 }
      );
    }

    await db.familyMember.delete({ where: { id } });

    return NextResponse.json({ message: 'Anggota keluarga berhasil dihapus' });
  } catch (error) {
    console.error('FamilyMembers DELETE error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
