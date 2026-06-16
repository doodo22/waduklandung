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
    const account = searchParams.get('account');

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (category) where.category = category;
    if (selapananId) where.selapananId = selapananId;
    if (account) where.account = account;
    if (from && to) {
      where.date = { gte: from, lte: to };
    } else if (from) {
      where.date = { gte: from };
    } else if (to) {
      where.date = { lte: to };
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 500,
    });

    // Calculate per-account balances from ALL transactions (not filtered)
    const allTransactions = await db.transaction.findMany({
      select: { type: true, amount: true, account: true, category: true },
    });

    let cashIncome = 0;
    let cashExpense = 0;
    let bankIncome = 0;
    let bankExpense = 0;

    for (const tx of allTransactions) {
      if (tx.type === 'TRANSFER') {
        if (tx.category === 'SETOR_BANK') {
          // Setor ke bank: cash → bank (cash decreases, bank increases)
          cashExpense += tx.amount;
          bankIncome += tx.amount;
        } else if (tx.category === 'TARIK_BANK') {
          // Tarik dari bank: bank → cash (bank decreases, cash increases)
          bankExpense += tx.amount;
          cashIncome += tx.amount;
        }
      } else {
        if (tx.account === 'CASH') {
          if (tx.type === 'INCOME') cashIncome += tx.amount;
          else if (tx.type === 'EXPENSE') cashExpense += tx.amount;
        } else if (tx.account === 'BANK_BKK') {
          if (tx.type === 'INCOME') bankIncome += tx.amount;
          else if (tx.type === 'EXPENSE') bankExpense += tx.amount;
        }
      }
    }

    const totalIncome = cashIncome + bankIncome;
    const totalExpense = cashExpense + bankExpense;

    // Filtered summary (for display)
    const filteredIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((s, t) => s + t.amount, 0);
    const filteredExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((s, t) => s + t.amount, 0);

    return NextResponse.json({
      transactions,
      summary: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        cashIncome,
        cashExpense,
        cashBalance: cashIncome - cashExpense,
        bankIncome,
        bankExpense,
        bankBalance: bankIncome - bankExpense,
        // filtered period totals
        filteredIncome,
        filteredExpense,
        filteredNet: filteredIncome - filteredExpense,
      },
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

    const { type, category, amount, description, date, selapananId, account } = await request.json();

    if (!type || !category || !amount || !description || !date) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Determine account for transfer
    let txAccount = account || 'CASH';

    if (type === 'TRANSFER') {
      if (category === 'SETOR_BANK') {
        // Setor ke bank: source is CASH (expense from cash)
        txAccount = 'CASH';
      } else if (category === 'TARIK_BANK') {
        // Tarik dari bank: source is BANK_BKK (expense from bank)
        txAccount = 'BANK_BKK';
      }
    }

    const transaction = await db.transaction.create({
      data: {
        type,
        category,
        amount,
        description,
        date,
        account: txAccount,
        selapananId: selapananId || null,
        createdBy: authUser.id,
      },
    });

    // For transfers, also create the counterpart transaction
    if (type === 'TRANSFER') {
      let counterAccount: string;
      let counterCategory: string;

      if (category === 'SETOR_BANK') {
        counterAccount = 'BANK_BKK';
        counterCategory = 'SETOR_BANK';
      } else {
        counterAccount = 'CASH';
        counterCategory = 'TARIK_BANK';
      }

      await db.transaction.create({
        data: {
          type: 'TRANSFER',
          category: counterCategory,
          amount,
          description: `[Transfer] ${description}`,
          date,
          account: counterAccount,
          selapananId: selapananId || null,
          createdBy: authUser.id,
        },
      });
    }

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

    // If deleting a transfer, also delete the counterpart
    const tx = await db.transaction.findUnique({ where: { id } });
    if (tx?.type === 'TRANSFER') {
      // Find counterpart: same date, amount, description starting with [Transfer]
      const counterpart = await db.transaction.findFirst({
        where: {
          date: tx.date,
          amount: tx.amount,
          type: 'TRANSFER',
          category: tx.category,
          id: { not: tx.id },
          description: { startsWith: '[Transfer]' },
        },
      });
      if (counterpart) {
        await db.transaction.delete({ where: { id: counterpart.id } });
      }
    }

    await db.transaction.delete({ where: { id } });

    return NextResponse.json({ message: 'Transaksi berhasil dihapus' });
  } catch (error) {
    console.error('Transactions DELETE error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
