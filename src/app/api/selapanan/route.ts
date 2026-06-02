import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// GET /api/selapanan — List selapanan with details, shortages, and levy payments
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const id = searchParams.get('id');

    // If specific ID requested, return single selapanan with full details
    if (id) {
      const selapanan = await db.selapanan.findUnique({
        where: { id },
        include: {
          details: true,
          shortages: {
            include: {
              family: { select: { id: true, familyHead: true } },
            },
            orderBy: { family: { familyHead: 'asc' } },
          },
          levyPayments: {
            include: {
              item: {
                include: {
                  levy: { select: { id: true, name: true } },
                  family: { select: { id: true, familyHead: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!selapanan) {
        return NextResponse.json({ error: 'Selapanan tidak ditemukan' }, { status: 404 });
      }

      return NextResponse.json({ selapanan });
    }

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const selapanan = await db.selapanan.findMany({
      where,
      orderBy: { periodeStart: 'desc' },
      include: {
        details: true,
        shortages: {
          include: {
            family: { select: { id: true, familyHead: true } },
          },
        },
        levyPayments: {
          include: {
            item: {
              include: {
                levy: { select: { id: true, name: true } },
                family: { select: { id: true, familyHead: true } },
              },
            },
          },
        },
      },
      take: 20,
    });

    return NextResponse.json({ selapanan });
  } catch (error) {
    console.error('Selapanan GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST /api/selapanan — Create a new selapanan period
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const {
      number,
      periodeStart,
      periodeEnd,
      meetingDate,
      meetingLocation,
      notes,
      details,
      // Optional financial recap fields (default 0)
      jimpitanDaily,
      jimpitanMonthly,
      rondaFeeTotal,
      shortagePaid,
      finePaid,
      levyPaid,
      otherIncome,
      totalIncome,
    } = await request.json();

    if (!periodeStart || !periodeEnd || !meetingDate) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Auto-calculate totalIncome if not provided
    const daily = jimpitanDaily ?? 0;
    const monthly = jimpitanMonthly ?? 0;
    const rondaFee = rondaFeeTotal ?? 0;
    const shortage = shortagePaid ?? 0;
    const fine = finePaid ?? 0;
    const levy = levyPaid ?? 0;
    const other = otherIncome ?? 0;
    const total = totalIncome ?? (daily + monthly + rondaFee + shortage + fine + levy + other);

    const selapanan = await db.selapanan.create({
      data: {
        number: number ?? 0,
        periodeStart,
        periodeEnd,
        meetingDate,
        meetingLocation,
        notes,
        jimpitanDaily: daily,
        jimpitanMonthly: monthly,
        rondaFeeTotal: rondaFee,
        shortagePaid: shortage,
        finePaid: fine,
        levyPaid: levy,
        otherIncome: other,
        totalIncome: total,
        details: details
          ? {
              create: details.map((d: { agenda: string; decisions?: string; notes?: string }) => ({
                agenda: d.agenda,
                decisions: d.decisions,
                notes: d.notes,
              })),
            }
          : undefined,
      },
      include: {
        details: true,
        shortages: {
          include: {
            family: { select: { id: true, familyHead: true } },
          },
        },
        levyPayments: true,
      },
    });

    return NextResponse.json({ selapanan }, { status: 201 });
  } catch (error) {
    console.error('Selapanan POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// PUT /api/selapanan — Update selapanan (including financial recap and status changes)
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const {
      id,
      number,
      status,
      meetingLocation,
      notes,
      // Financial recap fields
      jimpitanDaily,
      jimpitanMonthly,
      rondaFeeTotal,
      shortagePaid,
      finePaid,
      levyPaid,
      otherIncome,
      totalIncome,
    } = await request.json();

    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    // Check current selapanan state
    const current = await db.selapanan.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: 'Selapanan tidak ditemukan' }, { status: 404 });
    }

    // Build update data
    const data: Record<string, unknown> = {};
    if (number !== undefined) data.number = number;
    if (status !== undefined) data.status = status;
    if (meetingLocation !== undefined) data.meetingLocation = meetingLocation;
    if (notes !== undefined) data.notes = notes;

    // Financial recap fields
    if (jimpitanDaily !== undefined) data.jimpitanDaily = jimpitanDaily;
    if (jimpitanMonthly !== undefined) data.jimpitanMonthly = jimpitanMonthly;
    if (rondaFeeTotal !== undefined) data.rondaFeeTotal = rondaFeeTotal;
    if (shortagePaid !== undefined) data.shortagePaid = shortagePaid;
    if (finePaid !== undefined) data.finePaid = finePaid;
    if (levyPaid !== undefined) data.levyPaid = levyPaid;
    if (otherIncome !== undefined) data.otherIncome = otherIncome;
    if (totalIncome !== undefined) data.totalIncome = totalIncome;

    // If any financial fields are being updated, auto-recalculate totalIncome
    const financialFields = [jimpitanDaily, jimpitanMonthly, rondaFeeTotal, shortagePaid, finePaid, levyPaid, otherIncome];
    const anyFinancialUpdated = financialFields.some((f) => f !== undefined);
    if (anyFinancialUpdated && totalIncome === undefined) {
      const newDaily = (jimpitanDaily ?? current.jimpitanDaily) as number;
      const newMonthly = (jimpitanMonthly ?? current.jimpitanMonthly) as number;
      const newRondaFee = (rondaFeeTotal ?? current.rondaFeeTotal) as number;
      const newShortage = (shortagePaid ?? current.shortagePaid) as number;
      const newFine = (finePaid ?? current.finePaid) as number;
      const newLevy = (levyPaid ?? current.levyPaid) as number;
      const newOther = (otherIncome ?? current.otherIncome) as number;
      data.totalIncome = newDaily + newMonthly + newRondaFee + newShortage + newFine + newLevy + newOther;
    }

    const selapanan = await db.selapanan.update({
      where: { id },
      data,
      include: {
        details: true,
        shortages: {
          include: {
            family: { select: { id: true, familyHead: true } },
          },
        },
        levyPayments: true,
      },
    });

    // When status changes to COMPLETED, carry over unpaid shortages to next selapanan
    if (status === 'COMPLETED' && current.status !== 'COMPLETED') {
      const unpaidShortages = await db.jimpitanShortage.findMany({
        where: {
          selapananId: id,
          isSettled: false,
        },
      });

      if (unpaidShortages.length > 0) {
        // Find the next selapanan period
        const nextSelapanan = await db.selapanan.findFirst({
          where: {
            periodeStart: { gt: current.periodeStart },
            status: { not: 'CANCELLED' },
          },
          orderBy: { periodeStart: 'asc' },
        });

        if (nextSelapanan) {
          for (const shortage of unpaidShortages) {
            const remaining = shortage.totalShortage - shortage.settledAmount;
            if (remaining > 0) {
              // Mark current shortage as carried over
              await db.jimpitanShortage.update({
                where: { id: shortage.id },
                data: { carriedOver: true },
              });

              // Create or update shortage in next selapanan
              await db.jimpitanShortage.upsert({
                where: {
                  familyId_selapananId: {
                    familyId: shortage.familyId,
                    selapananId: nextSelapanan.id,
                  },
                },
                create: {
                  familyId: shortage.familyId,
                  selapananId: nextSelapanan.id,
                  totalShortage: remaining,
                  isSettled: false,
                  settledAmount: 0,
                  carriedOver: true,
                  notes: `Carry-over dari periode ${current.periodeStart} s/d ${current.periodeEnd}`,
                },
                update: {
                  totalShortage: { increment: remaining },
                  carriedOver: true,
                },
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ selapanan });
  } catch (error) {
    console.error('Selapanan PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
