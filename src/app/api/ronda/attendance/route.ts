import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// Helper: Get JS Day (0=Sunday) for a ronda group dayOfWeek
// Convention: dayOfWeek=0 ("Sabtu malam") => JS Day 6 (Saturday)
// dayOfWeek=1 ("Minggu malam") => JS Day 0 (Sunday)
// dayOfWeek=2 ("Senin malam") => JS Day 1 (Monday)
// etc.
function jsDayForGroupDay(dayOfWeek: number): number {
  return (dayOfWeek + 6) % 7;
}

// Helper: Get dayOfWeek for a date string (same as in collection route)
function getDayOfWeekForDate(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  return (date.getDay() + 1) % 7;
}

// Helper: Find or create schedules for a group within a selapanan period
async function ensureSchedules(groupId: string, selapananId: string, periodeStart: string, periodeEnd: string) {
  const group = await db.rondaGroup.findUnique({ where: { id: groupId } });
  if (!group) return [];

  // Check if schedules already exist for this group + selapanan
  const existing = await db.rondaSchedule.findMany({
    where: {
      groupId,
      selapananId,
    },
    orderBy: { date: 'asc' },
  });

  if (existing.length > 0) return existing;

  // Auto-generate schedules
  const jsDay = jsDayForGroupDay(group.dayOfWeek);
  const dates: string[] = [];

  const start = new Date(periodeStart + 'T00:00:00');
  const end = new Date(periodeEnd + 'T00:00:00');

  // Find first occurrence of the group's day within the selapanan period
  const current = new Date(start);
  while (current.getDay() !== jsDay && current <= end) {
    current.setDate(current.getDate() + 1);
  }

  // Collect all occurrences (should be exactly 5 for a 35-day selapanan)
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    dates.push(dateStr);
    current.setDate(current.getDate() + 7);
  }

  // Create schedule records
  const created = [];
  for (let i = 0; i < dates.length; i++) {
    const schedule = await db.rondaSchedule.create({
      data: {
        groupId,
        date: dates[i],
        shift: 'MALAM',
        selapananId,
        weekNumber: i + 1,
      },
    });
    created.push(schedule);
  }

  return created;
}

// GET /api/ronda/attendance — Get attendance data for the user's group in the current selapanan
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const selapananId = searchParams.get('selapananId');
    const groupId = searchParams.get('groupId');

    // Find the user's family and group
    let targetGroupId = groupId;

    if (!targetGroupId && authUser.familyId) {
      const family = await db.family.findUnique({
        where: { id: authUser.familyId },
        select: { rondaGroupId: true },
      });
      targetGroupId = family?.rondaGroupId ?? null;
    }

    if (!targetGroupId) {
      return NextResponse.json({
        hasGroup: false,
        selapanan: null,
        group: null,
        members: [],
        schedules: [],
        recap: null,
      });
    }

    // Find the selapanan
    let selapanan;
    if (selapananId) {
      selapanan = await db.selapanan.findUnique({ where: { id: selapananId } });
    } else {
      // Find current selapanan (periodeStart <= today <= periodeEnd)
      const today = new Date().toISOString().split('T')[0];
      selapanan = await db.selapanan.findFirst({
        where: {
          periodeStart: { lte: today },
          periodeEnd: { gte: today },
          status: { not: 'CANCELLED' },
        },
        orderBy: { periodeStart: 'desc' },
      });

      // If no current selapanan, find the most recent upcoming one
      if (!selapanan) {
        selapanan = await db.selapanan.findFirst({
          where: {
            periodeStart: { gte: today },
            status: { not: 'CANCELLED' },
          },
          orderBy: { periodeStart: 'asc' },
        });
      }

      // If still none, find the most recent past one
      if (!selapanan) {
        selapanan = await db.selapanan.findFirst({
          where: {
            status: { not: 'CANCELLED' },
          },
          orderBy: { periodeStart: 'desc' },
        });
      }
    }

    if (!selapanan) {
      return NextResponse.json({
        hasGroup: true,
        selapanan: null,
        group: null,
        members: [],
        schedules: [],
        recap: null,
      });
    }

    // Get group info
    const group = await db.rondaGroup.findUnique({
      where: { id: targetGroupId },
      include: {
        families: {
          where: { isActive: true, rondaStatus: 'AKTIF' },
          select: {
            id: true,
            familyHead: true,
            address: true,
            rondaStatus: true,
          },
          orderBy: { familyHead: 'asc' },
        },
      },
    });

    if (!group) {
      return NextResponse.json({
        hasGroup: false,
        selapanan,
        group: null,
        members: [],
        schedules: [],
        recap: null,
      });
    }

    // Auto-generate schedules if they don't exist
    const schedules = await ensureSchedules(
      targetGroupId,
      selapanan.id,
      selapanan.periodeStart,
      selapanan.periodeEnd
    );

    // Get all attendance logs for these schedules
    const scheduleIds = schedules.map(s => s.id);
    const logs = await db.rondaLog.findMany({
      where: {
        scheduleId: { in: scheduleIds },
      },
      include: {
        user: { select: { id: true, name: true } },
        family: { select: { id: true, familyHead: true } },
      },
    });

    // Build attendance map: scheduleId -> familyId -> status
    const attendanceMap: Record<string, Record<string, string>> = {};
    for (const log of logs) {
      if (!attendanceMap[log.scheduleId]) {
        attendanceMap[log.scheduleId] = {};
      }
      attendanceMap[log.scheduleId][log.familyId] = log.status;
    }

    // Build schedule data with attendance
    const today = new Date().toISOString().split('T')[0];
    const scheduleData = schedules.map(s => ({
      id: s.id,
      date: s.date,
      shift: s.shift,
      weekNumber: s.weekNumber,
      isToday: s.date === today,
      isPast: s.date < today,
      isFuture: s.date > today,
      attendance: attendanceMap[s.id] || {},
    }));

    // Build recap
    const allPastOrToday = schedules.every(s => s.date <= today);
    const recapMembers = group.families.map(f => {
      let hadirCount = 0;
      let tidakHadirCount = 0;
      for (const schedule of schedules) {
        const status = attendanceMap[schedule.id]?.[f.id];
        if (status === 'HADIR') hadirCount++;
        else if (status === 'TIDAK_HADIR') tidakHadirCount++;
      }
      return {
        familyId: f.id,
        familyHead: f.familyHead,
        hadirCount,
        tidakHadirCount,
        totalSchedules: schedules.length,
        attendanceRate: schedules.length > 0 ? Math.round((hadirCount / schedules.length) * 100) : 0,
      };
    });

    return NextResponse.json({
      hasGroup: true,
      selapanan: {
        id: selapanan.id,
        number: selapanan.number,
        periodeStart: selapanan.periodeStart,
        periodeEnd: selapanan.periodeEnd,
        status: selapanan.status,
      },
      group: {
        id: group.id,
        name: group.name,
        dayOfWeek: group.dayOfWeek,
      },
      members: group.families.map(f => ({
        id: f.id,
        familyHead: f.familyHead,
        rondaStatus: f.rondaStatus,
      })),
      schedules: scheduleData,
      recap: {
        isComplete: allPastOrToday,
        members: recapMembers,
      },
    });
  } catch (error) {
    console.error('Ronda Attendance GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST /api/ronda/attendance — Save attendance for a schedule
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { scheduleId, entries } = await request.json();

    if (!scheduleId || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Get the schedule
    const schedule = await db.rondaSchedule.findUnique({
      where: { id: scheduleId },
      include: { group: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Jadwal tidak ditemukan' }, { status: 404 });
    }

    // Check authorization: Admin OR member of the ronda group on duty
    const userIsAdmin = isAdmin(authUser.role);
    let userIsOnDuty = false;

    if (!userIsAdmin && authUser.familyId) {
      // Check if today is the schedule date and user belongs to the group
      const today = new Date().toISOString().split('T')[0];
      if (schedule.date === today) {
        const familyInGroup = await db.family.findFirst({
          where: {
            id: authUser.familyId,
            rondaGroupId: schedule.groupId,
          },
        });
        userIsOnDuty = !!familyInGroup;
      }
    }

    if (!userIsAdmin && !userIsOnDuty) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses. Hanya admin atau anggota grup ronda yang bertugas pada hari tersebut yang dapat mengabsen.' },
        { status: 403 }
      );
    }

    // Process each entry
    const results = [];
    for (const entry of entries) {
      const { familyId, status } = entry;
      if (!familyId || !status) continue;

      // Find a user from this family to associate with the log
      const familyUser = await db.user.findFirst({
        where: { familyId },
        select: { id: true },
      });

      if (!familyUser) continue;

      // Upsert: one log per schedule per family
      const existing = await db.rondaLog.findFirst({
        where: { scheduleId, familyId },
      });

      let log;
      if (existing) {
        log = await db.rondaLog.update({
          where: { id: existing.id },
          data: { status, userId: familyUser.id },
        });
      } else {
        log = await db.rondaLog.create({
          data: {
            scheduleId,
            userId: familyUser.id,
            familyId,
            status,
          },
        });
      }
      results.push(log);
    }

    return NextResponse.json({
      message: `Berhasil menyimpan ${results.length} catatan absensi`,
      savedCount: results.length,
    });
  } catch (error) {
    console.error('Ronda Attendance POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
