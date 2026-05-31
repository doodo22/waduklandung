import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// GET /api/jimpitan/enrollment — Return all families with enrollment status (Admin only)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const families = await db.family.findMany({
      where: { isActive: true },
      orderBy: { familyHead: 'asc' },
      include: {
        jimpitanEnrollment: true,
        rondaGroup: { select: { id: true, name: true, dayOfWeek: true } },
      },
    });

    // Map to include enrollment status
    const enrollmentData = families.map((family) => ({
      id: family.id,
      familyHead: family.familyHead,
      address: family.address,
      memberCount: family.memberCount,
      isActive: family.jimpitanEnrollment?.isActive ?? false,
      enrollmentId: family.jimpitanEnrollment?.id ?? null,
      enrolledAt: family.jimpitanEnrollment?.enrolledAt ?? null,
      rondaGroup: family.rondaGroup ? {
        id: family.rondaGroup.id,
        name: family.rondaGroup.name,
        dayOfWeek: family.rondaGroup.dayOfWeek,
      } : null,
    }));

    return NextResponse.json({ families: enrollmentData });
  } catch (error) {
    console.error('Jimpitan Enrollment GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST /api/jimpitan/enrollment — Toggle enrollment (Admin only)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { familyId, isActive } = await request.json();
    if (!familyId || isActive === undefined) {
      return NextResponse.json({ error: 'familyId dan isActive wajib diisi' }, { status: 400 });
    }

    // Verify family exists
    const family = await db.family.findUnique({ where: { id: familyId } });
    if (!family) {
      return NextResponse.json({ error: 'Keluarga tidak ditemukan' }, { status: 404 });
    }

    if (isActive) {
      // Create enrollment if not exists
      const existing = await db.jimpitanEnrollment.findUnique({
        where: { familyId },
      });

      if (existing) {
        // Update existing enrollment to active
        const enrollment = await db.jimpitanEnrollment.update({
          where: { familyId },
          data: { isActive: true },
        });
        return NextResponse.json({ enrollment });
      } else {
        // Create new enrollment
        const enrollment = await db.jimpitanEnrollment.create({
          data: { familyId, isActive: true },
        });
        return NextResponse.json({ enrollment }, { status: 201 });
      }
    } else {
      // Deactivate/delete enrollment
      const existing = await db.jimpitanEnrollment.findUnique({
        where: { familyId },
      });

      if (existing) {
        await db.jimpitanEnrollment.delete({
          where: { familyId },
        });
      }

      return NextResponse.json({ enrollment: null, isActive: false });
    }
  } catch (error) {
    console.error('Jimpitan Enrollment POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
