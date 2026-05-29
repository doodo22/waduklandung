import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const selapananId = searchParams.get('selapananId');

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (category) where.category = category;
    if (selapananId) where.selapananId = selapananId;
    if (from && to) {
      where.date = { gte: from, lte: to };
    } else if (from) {
      where.date = { gte: from };
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 200,
    });

    // Calculate totals
    const totalIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    return NextResponse.json({
      transactions,
      summary: { totalIncome, totalExpense, balance: totalIncome - totalExpense },
    });
  } catch (error) {
    console.error('Transactions GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { type, category, amount, description, date, selapananId } = await request.json();

    if (!type || !category || !amount || !description || !date) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const transaction = await db.transaction.create({
      data: {
        type,
        category,
        amount,
        description,
        date,
        selapananId: selapananId || null,
        createdBy: authUser.id,
      },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error('Transactions POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'KETUA_RT' && authUser.role !== 'BENDAHARA') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

    await db.transaction.delete({ where: { id } });

    return NextResponse.json({ message: 'Transaksi berhasil dihapus' });
  } catch (error) {
    console.error('Transactions DELETE error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
