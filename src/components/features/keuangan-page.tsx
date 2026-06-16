'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateShort,
  CATEGORY_LABELS,
  TRANSACTION_TYPE,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  TRANSFER_CATEGORIES,
  ACCOUNT_TYPE,
  ACCOUNT_LABELS,
  FINE_TYPE,
  FINE_STATUS,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  ArrowRightLeft,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronRight,
  Receipt,
  PiggyBank,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================
interface Transaction {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  account: string;
  selapananId: string | null;
  createdBy: string;
  createdAt: string;
}

interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  cashIncome: number;
  cashExpense: number;
  cashBalance: number;
  bankIncome: number;
  bankExpense: number;
  bankBalance: number;
  filteredIncome: number;
  filteredExpense: number;
  filteredNet: number;
}

interface Fine {
  id: string;
  userId: string;
  familyId: string;
  type: string;
  amount: number;
  reason: string;
  status: string;
  date: string;
  selapananId: string | null;
  user: { id: string; name: string };
  family: { id: string; familyHead: string };
}

interface FineSummary {
  totalUnpaid: number;
  totalPaid: number;
}

interface Family {
  id: string;
  familyHead: string;
  address: string;
  members: { id: string; name: string }[];
}

interface SelapananRecap {
  selapanan: {
    id: string;
    number: number;
    periodeStart: string;
    periodeEnd: string;
    status: string;
    storedRecap: {
      jimpitanDaily: number;
      jimpitanMonthly: number;
      rondaFeeTotal: number;
      shortagePaid: number;
      finePaid: number;
      levyPaid: number;
      otherIncome: number;
      totalIncome: number;
      expensePembelian: number;
      expensePembangunan: number;
      expenseOperasional: number;
      expenseBantuan: number;
      expenseLainLain: number;
      totalExpense: number;
    };
  };
  incomeByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  transactions: Transaction[];
}

interface Props {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

// ============================================
// EXPENSE CATEGORY LABELS (Indonesian)
// ============================================
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  PEMBELIAN: 'Pembelian Barang',
  PEMBANGUNAN: 'Pembangunan / Perbaikan',
  OPERASIONAL: 'Operasional RT',
  BANTUAN: 'Bantuan Warga',
  LAIN_LAIN: 'Lain-lain',
};

const INCOME_CATEGORY_LABELS: Record<string, string> = {
  IURAN_BULANAN: 'Iuran Bulanan',
  IURAN_RONDA: 'Iuran Ronda',
  DENDA: 'Denda',
  JIMPITAN: 'Jimpitan Harian',
  DONASI: 'Donasi',
  BUNGA_BANK: 'Bunga Bank',
  LAIN_LAIN: 'Lain-lain',
};

// ============================================
// MAIN COMPONENT
// ============================================
export function KeuanganPage({ userId, familyId, isAdmin }: Props) {
  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary>({
    totalIncome: 0, totalExpense: 0, balance: 0,
    cashIncome: 0, cashExpense: 0, cashBalance: 0,
    bankIncome: 0, bankExpense: 0, bankBalance: 0,
    filteredIncome: 0, filteredExpense: 0, filteredNet: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSelapanan, setFilterSelapanan] = useState<string>('all');

  // Transaction form
  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState({
    type: 'INCOME',
    category: 'JIMPITAN',
    account: 'CASH',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [txSaving, setTxSaving] = useState(false);

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    direction: 'SETOR_BANK' as 'SETOR_BANK' | 'TARIK_BANK',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [transferSaving, setTransferSaving] = useState(false);

  // Fines state
  const [fines, setFines] = useState<Fine[]>([]);
  const [fineSummary, setFineSummary] = useState<FineSummary>({ totalUnpaid: 0, totalPaid: 0 });
  const [finesLoading, setFinesLoading] = useState(true);

  // Fine form
  const [fineOpen, setFineOpen] = useState(false);
  const [fineForm, setFineForm] = useState({
    userId: '',
    familyId: '',
    type: 'RONDA',
    amount: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [fineSaving, setFineSaving] = useState(false);

  // Families for fine form dropdown
  const [families, setFamilies] = useState<Family[]>([]);

  // Selapanan recap
  const [selapananRecaps, setSelapananRecaps] = useState<SelapananRecap[]>([]);
  const [recapsLoading, setRecapsLoading] = useState(true);
  const [expandedRecap, setExpandedRecap] = useState<string | null>(null);

  // Selapanan list for expense linking
  const [selapananList, setSelapananList] = useState<{ id: string; number: number; periodeStart: string; periodeEnd: string; status: string }[]>([]);

  // Active tab
  const [activeTab, setActiveTab] = useState('pendapatan');

  // Dynamic category options based on transaction type
  const getCategoryOptions = useCallback((type: string) => {
    if (type === 'INCOME') return INCOME_CATEGORIES;
    if (type === 'EXPENSE') return EXPENSE_CATEGORIES;
    return [];
  }, []);

  // Get filter category options
  const getFilterCategoryOptions = useCallback(() => {
    if (filterType === 'INCOME') return INCOME_CATEGORIES;
    if (filterType === 'EXPENSE') return EXPENSE_CATEGORIES;
    if (filterType === 'TRANSFER') return TRANSFER_CATEGORIES;
    return [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...TRANSFER_CATEGORIES];
  }, [filterType]);

  // ============================================
  // FETCH FUNCTIONS
  // ============================================
  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType && filterType !== 'all') params.set('type', filterType);
      if (filterCategory && filterCategory !== 'all') params.set('category', filterCategory);
      if (filterAccount && filterAccount !== 'all') params.set('account', filterAccount);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);

      const query = params.toString();
      const res = await api.get(`/transactions${query ? `?${query}` : ''}`);
      const data = await res.json();
      if (res.ok) {
        setTransactions(data.transactions || []);
        setSummary(data.summary || {
          totalIncome: 0, totalExpense: 0, balance: 0,
          cashBalance: 0, bankBalance: 0,
          filteredIncome: 0, filteredExpense: 0, filteredNet: 0,
        });
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [filterType, filterCategory, filterAccount, filterFrom, filterTo]);

  const fetchFines = useCallback(async () => {
    try {
      const res = await api.get('/fines');
      const data = await res.json();
      if (res.ok) {
        setFines(data.fines || []);
        setFineSummary(data.summary || { totalUnpaid: 0, totalPaid: 0 });
      }
    } catch {
      // silently handle
    } finally {
      setFinesLoading(false);
    }
  }, []);

  const fetchFamilies = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/families');
      const data = await res.json();
      if (res.ok) {
        setFamilies(data.families || []);
      }
    } catch {
      // silently handle
    }
  }, [isAdmin]);

  const fetchRecaps = useCallback(async () => {
    try {
      const res = await api.get('/transactions/selapanan-recap');
      const data = await res.json();
      if (res.ok) {
        setSelapananRecaps(data.recaps || []);
      }
    } catch {
      // silently handle
    } finally {
      setRecapsLoading(false);
    }
  }, []);

  const fetchSelapananList = useCallback(async () => {
    try {
      const res = await api.get('/selapanan');
      const data = await res.json();
      if (res.ok) {
        const list = (data.selapanans || data || []).slice(0, 10);
        setSelapananList(list);
      }
    } catch {
      // silently handle
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchFines();
    fetchFamilies();
    fetchRecaps();
    fetchSelapananList();
  }, [fetchFines, fetchFamilies, fetchRecaps, fetchSelapananList]);

  // ============================================
  // HANDLERS
  // ============================================
  const handleCreateTransaction = async () => {
    if (!txForm.type || !txForm.category || !txForm.amount || !txForm.description || !txForm.date)
      return;
    setTxSaving(true);
    try {
      // Auto-set account for BUNGA_BANK
      let account = txForm.account;
      if (txForm.category === 'BUNGA_BANK') {
        account = 'BANK_BKK';
      }

      // Auto-link to active selapanan if creating an expense
      let selapananId = filterSelapanan !== 'all' ? filterSelapanan : null;

      const res = await api.post('/transactions', {
        type: txForm.type,
        category: txForm.category,
        amount: parseInt(txForm.amount, 10),
        description: txForm.description,
        date: txForm.date,
        account,
        selapananId,
      });
      if (res.ok) {
        toast.success('Transaksi berhasil ditambahkan');
        setTxOpen(false);
        setTxForm({
          type: 'INCOME',
          category: 'JIMPITAN',
          account: 'CASH',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
        });
        fetchTransactions();
        fetchRecaps();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal menambahkan transaksi');
      }
    } catch {
      toast.error('Gagal menambahkan transaksi');
    } finally {
      setTxSaving(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const res = await api.delete(`/transactions?id=${id}`);
      if (res.ok) {
        toast.success('Transaksi berhasil dihapus');
        fetchTransactions();
        fetchRecaps();
      } else {
        toast.error('Gagal menghapus transaksi');
      }
    } catch {
      toast.error('Gagal menghapus transaksi');
    }
  };

  const handleTransfer = async (direction: 'SETOR_BANK' | 'TARIK_BANK') => {
    if (!transferForm.amount || !transferForm.description || !transferForm.date) return;
    setTransferSaving(true);
    try {
      const res = await api.post('/transactions', {
        type: 'TRANSFER',
        category: direction,
        amount: parseInt(transferForm.amount, 10),
        description: transferForm.description,
        date: transferForm.date,
      });
      if (res.ok) {
        toast.success(
          direction === 'SETOR_BANK'
            ? 'Setoran ke bank berhasil'
            : 'Penarikan dari bank berhasil'
        );
        setTransferForm({
          direction: 'SETOR_BANK',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
        });
        fetchTransactions();
        fetchRecaps();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal melakukan transfer');
      }
    } catch {
      toast.error('Gagal melakukan transfer');
    } finally {
      setTransferSaving(false);
    }
  };

  const handleCreateFine = async () => {
    if (!fineForm.userId || !fineForm.familyId || !fineForm.type || !fineForm.amount || !fineForm.reason || !fineForm.date)
      return;
    setFineSaving(true);
    try {
      const res = await api.post('/fines', {
        userId: fineForm.userId,
        familyId: fineForm.familyId,
        type: fineForm.type,
        amount: parseInt(fineForm.amount, 10),
        reason: fineForm.reason,
        date: fineForm.date,
      });
      if (res.ok) {
        toast.success('Denda berhasil ditambahkan');
        setFineOpen(false);
        setFineForm({
          userId: '',
          familyId: '',
          type: 'RONDA',
          amount: '',
          reason: '',
          date: new Date().toISOString().split('T')[0],
        });
        fetchFines();
        fetchTransactions();
      }
    } catch {
      toast.error('Gagal menambahkan denda');
    } finally {
      setFineSaving(false);
    }
  };

  const handleMarkFinePaid = async (id: string) => {
    try {
      const res = await api.put('/fines', { id, status: 'PAID' });
      if (res.ok) {
        toast.success('Denda ditandai lunas');
        fetchFines();
        fetchTransactions();
      }
    } catch {
      toast.error('Gagal mengubah status denda');
    }
  };

  const handleFamilySelect = (familyId: string) => {
    const family = families.find((f) => f.id === familyId);
    setFineForm((prev) => ({
      ...prev,
      familyId,
      userId: family?.members?.[0]?.id || '',
    }));
  };

  const selectedFamily = families.find((f) => f.id === fineForm.familyId);

  const clearFilters = () => {
    setFilterType('all');
    setFilterCategory('all');
    setFilterAccount('all');
    setFilterFrom('');
    setFilterTo('');
    setFilterSelapanan('all');
  };

  const hasActiveFilters = filterType !== 'all' || filterCategory !== 'all' || filterAccount !== 'all' || filterFrom || filterTo || filterSelapanan !== 'all';

  // Get type badge styling
  const getTypeBadge = (tx: Transaction) => {
    if (tx.type === 'TRANSFER') {
      return { className: 'bg-amber-100 text-amber-800', label: 'Transfer' };
    }
    if (tx.type === 'INCOME') {
      return { className: 'bg-green-100 text-green-800', label: 'Masuk' };
    }
    return { className: 'bg-red-100 text-red-800', label: 'Keluar' };
  };

  // Get amount display for transaction
  const getAmountDisplay = (tx: Transaction) => {
    if (tx.type === 'TRANSFER') {
      if (tx.description.startsWith('[Transfer]')) {
        return { text: `+ ${formatCurrency(tx.amount)}`, className: 'text-green-700' };
      }
      return { text: `- ${formatCurrency(tx.amount)}`, className: 'text-red-700' };
    }
    if (tx.type === 'INCOME') {
      return { text: `+ ${formatCurrency(tx.amount)}`, className: 'text-green-700' };
    }
    return { text: `- ${formatCurrency(tx.amount)}`, className: 'text-red-700' };
  };

  // Filter transfer transactions for the transfer tab
  const transferTransactions = transactions.filter((tx) => tx.type === 'TRANSFER');

  // Get active selapanan for auto-linking expenses
  const activeSelapanan = selapananList.find(s => s.status === 'UPCOMING');

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-800">Keuangan RT</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-xl shadow-sm border border-slate-200 animate-pulse">
              <CardContent className="p-5">
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
                <div className="h-6 bg-slate-200 rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Keuangan RT</h2>
          <p className="text-sm text-slate-500 mt-1">Kelola keuangan, pendapatan & pengeluaran RT</p>
        </div>
        {isAdmin && (
          <Dialog open={txOpen} onOpenChange={setTxOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 bg-slate-800 hover:bg-slate-700 text-white">
                <Plus className="w-4 h-4 mr-1" />
                Tambah Transaksi
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Transaksi</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Jenis</Label>
                  <Select
                    value={txForm.type}
                    onValueChange={(v) => {
                      const cats = getCategoryOptions(v);
                      setTxForm({
                        ...txForm,
                        type: v,
                        category: cats[0] || 'IURAN_BULANAN',
                        account: v === 'EXPENSE' ? txForm.account : txForm.account,
                      });
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCOME">Pemasukan</SelectItem>
                      <SelectItem value="EXPENSE">Pengeluaran</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select
                    value={txForm.category}
                    onValueChange={(v) => {
                      setTxForm({
                        ...txForm,
                        category: v,
                        account: v === 'BUNGA_BANK' ? 'BANK_BKK' : txForm.account === 'BANK_BKK' && v !== 'BUNGA_BANK' ? 'CASH' : txForm.account,
                      });
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getCategoryOptions(txForm.type).map((key) => (
                        <SelectItem key={key} value={key}>
                          {CATEGORY_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Akun</Label>
                  <Select
                    value={txForm.category === 'BUNGA_BANK' ? 'BANK_BKK' : txForm.account}
                    onValueChange={(v) => setTxForm({ ...txForm, account: v })}
                    disabled={txForm.category === 'BUNGA_BANK'}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">{ACCOUNT_LABELS.CASH}</SelectItem>
                      <SelectItem value="BANK_BKK">{ACCOUNT_LABELS.BANK_BKK}</SelectItem>
                    </SelectContent>
                  </Select>
                  {txForm.category === 'BUNGA_BANK' && (
                    <p className="text-xs text-slate-500">Otomatis: Tabungan BKK</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Jumlah (Rp)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={txForm.amount}
                    onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Keterangan</Label>
                  <Input
                    placeholder="Deskripsi transaksi"
                    value={txForm.description}
                    onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Input
                    type="date"
                    value={txForm.date}
                    onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                    className="h-10"
                  />
                </div>

                {/* Show active selapanan info for expenses */}
                {txForm.type === 'EXPENSE' && activeSelapanan && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-700">
                      <CalendarDays className="w-3 h-3 inline mr-1" />
                      Pengeluaran akan dikaitkan dengan Selapanan ke-{activeSelapanan.number} ({activeSelapanan.periodeStart} s/d {activeSelapanan.periodeEnd})
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setTxOpen(false)} className="h-10">
                    Batal
                  </Button>
                  <Button
                    onClick={handleCreateTransaction}
                    disabled={txSaving || !txForm.amount || !txForm.description}
                    className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
                  >
                    {txSaving ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* ============================================
          STAT CARDS — DUAL ACCOUNT OVERVIEW
          ============================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Total */}
        <Card className="rounded-xl shadow-sm border border-slate-300 bg-slate-800">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-slate-200" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-300 font-medium">Saldo Total</p>
                <p className="text-base sm:text-lg font-bold text-white truncate">
                  {formatCurrency(summary.cashBalance + summary.bankBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kas Tunai */}
        <Card className="rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-emerald-600 font-medium">Kas Tunai</p>
                <p className="text-base sm:text-lg font-bold text-emerald-700 truncate">
                  {formatCurrency(summary.cashBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabungan BKK */}
        <Card className="rounded-xl shadow-sm border border-sky-200 bg-sky-50/50">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-sky-600 font-medium">Tabungan BKK</p>
                <p className="text-base sm:text-lg font-bold text-sky-700 truncate">
                  {formatCurrency(summary.bankBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Periode */}
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                summary.filteredNet >= 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {summary.filteredNet >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium">Net Periode</p>
                <p className={`text-base sm:text-lg font-bold truncate ${
                  summary.filteredNet >= 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {formatCurrency(summary.filteredNet)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================
          TABS
          ============================================ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="pendapatan" className="text-xs sm:text-sm">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            Pendapatan
          </TabsTrigger>
          <TabsTrigger value="pengeluaran" className="text-xs sm:text-sm">
            <TrendingDown className="w-3.5 h-3.5 mr-1" />
            Pengeluaran
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="transfer" className="text-xs sm:text-sm">
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
              Transfer
            </TabsTrigger>
          )}
          <TabsTrigger value="rekap" className="text-xs sm:text-sm">
            <CalendarDays className="w-3.5 h-3.5 mr-1" />
            Rekap Selapanan
          </TabsTrigger>
          <TabsTrigger value="denda" className="text-xs sm:text-sm">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Denda
          </TabsTrigger>
        </TabsList>

        {/* ============ TAB: PENDAPATAN ============ */}
        <TabsContent value="pendapatan" className="space-y-4">
          {/* Income Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(INCOME_CATEGORY_LABELS).map(([key, label]) => {
              const total = transactions
                .filter(t => t.type === 'INCOME' && t.category === key)
                .reduce((s, t) => s + t.amount, 0);
              if (total === 0 && key !== 'LAIN_LAIN') return null;
              return (
                <Card key={key} className="rounded-lg shadow-sm border border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-500 truncate">{label}</p>
                    <p className="text-sm font-bold text-green-700">{formatCurrency(total)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Income Table */}
          <Card className="rounded-xl shadow-sm border border-slate-200">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-green-600" />
                Daftar Pendapatan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.filter(t => t.type === 'INCOME').length === 0 ? (
                <div className="p-10 text-center">
                  <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Belum ada data pendapatan</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-9">Tanggal</TableHead>
                        <TableHead className="text-xs h-9">Kategori</TableHead>
                        <TableHead className="text-xs h-9">Akun</TableHead>
                        <TableHead className="text-xs h-9">Keterangan</TableHead>
                        <TableHead className="text-xs h-9 text-right">Jumlah</TableHead>
                        {isAdmin && <TableHead className="text-xs h-9 w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions
                        .filter(t => t.type === 'INCOME')
                        .map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-xs py-3 whitespace-nowrap">
                              {formatDateShort(tx.date)}
                            </TableCell>
                            <TableCell className="text-xs py-3">
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                {INCOME_CATEGORY_LABELS[tx.category] || CATEGORY_LABELS[tx.category] || tx.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs py-3">
                              <div className="flex items-center gap-1.5">
                                {tx.account === 'BANK_BKK' ? (
                                  <Landmark className="w-3 h-3 text-sky-500" />
                                ) : (
                                  <Wallet className="w-3 h-3 text-emerald-500" />
                                )}
                                <span className="text-slate-600">
                                  {ACCOUNT_LABELS[tx.account] || tx.account}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs py-3 max-w-[200px] truncate">
                              {tx.description}
                            </TableCell>
                            <TableCell className="text-xs py-3 text-right font-medium whitespace-nowrap text-green-700">
                              + {formatCurrency(tx.amount)}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="py-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                                  onClick={() => handleDeleteTransaction(tx.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB: PENGELUARAN ============ */}
        <TabsContent value="pengeluaran" className="space-y-4">
          {/* Expense Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => {
              const total = transactions
                .filter(t => t.type === 'EXPENSE' && t.category === key)
                .reduce((s, t) => s + t.amount, 0);
              if (total === 0 && key !== 'LAIN_LAIN') return null;
              return (
                <Card key={key} className="rounded-lg shadow-sm border border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-500 truncate">{label}</p>
                    <p className="text-sm font-bold text-red-700">{formatCurrency(total)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Expense Table */}
          <Card className="rounded-xl shadow-sm border border-slate-200">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-600" />
                Daftar Pengeluaran
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.filter(t => t.type === 'EXPENSE').length === 0 ? (
                <div className="p-10 text-center">
                  <TrendingDown className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Belum ada data pengeluaran</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-9">Tanggal</TableHead>
                        <TableHead className="text-xs h-9">Kategori</TableHead>
                        <TableHead className="text-xs h-9">Akun</TableHead>
                        <TableHead className="text-xs h-9">Keterangan</TableHead>
                        <TableHead className="text-xs h-9 text-right">Jumlah</TableHead>
                        {isAdmin && <TableHead className="text-xs h-9 w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions
                        .filter(t => t.type === 'EXPENSE')
                        .map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-xs py-3 whitespace-nowrap">
                              {formatDateShort(tx.date)}
                            </TableCell>
                            <TableCell className="text-xs py-3">
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                {EXPENSE_CATEGORY_LABELS[tx.category] || CATEGORY_LABELS[tx.category] || tx.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs py-3">
                              <div className="flex items-center gap-1.5">
                                {tx.account === 'BANK_BKK' ? (
                                  <Landmark className="w-3 h-3 text-sky-500" />
                                ) : (
                                  <Wallet className="w-3 h-3 text-emerald-500" />
                                )}
                                <span className="text-slate-600">
                                  {ACCOUNT_LABELS[tx.account] || tx.account}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs py-3 max-w-[200px] truncate">
                              {tx.description}
                            </TableCell>
                            <TableCell className="text-xs py-3 text-right font-medium whitespace-nowrap text-red-700">
                              - {formatCurrency(tx.amount)}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="py-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                                  onClick={() => handleDeleteTransaction(tx.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB: TRANSFER (Admin only) ============ */}
        {isAdmin && (
          <TabsContent value="transfer" className="space-y-4">
            {/* Transfer Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Setor ke Bank */}
              <Card className="rounded-xl shadow-sm border border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-3 pt-5 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                    <ArrowUpRight className="w-4 h-4" />
                    Setor ke Bank
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    Kas Tunai → Tabungan BKK
                  </p>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Jumlah (Rp)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={transferForm.direction === 'SETOR_BANK' ? transferForm.amount : ''}
                      onChange={(e) => setTransferForm({ ...transferForm, direction: 'SETOR_BANK', amount: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Keterangan</Label>
                    <Input
                      placeholder="Mis: Setoran iuran bulanan"
                      value={transferForm.direction === 'SETOR_BANK' ? transferForm.description : ''}
                      onChange={(e) => setTransferForm({ ...transferForm, direction: 'SETOR_BANK', description: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tanggal</Label>
                    <Input
                      type="date"
                      value={transferForm.direction === 'SETOR_BANK' ? transferForm.date : new Date().toISOString().split('T')[0]}
                      onChange={(e) => setTransferForm({ ...transferForm, direction: 'SETOR_BANK', date: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <Button
                    className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white mt-1"
                    disabled={transferSaving || (transferForm.direction === 'SETOR_BANK' && (!transferForm.amount || !transferForm.description))}
                    onClick={() => handleTransfer('SETOR_BANK')}
                  >
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                    Setor ke Bank
                  </Button>
                </CardContent>
              </Card>

              {/* Tarik dari Bank */}
              <Card className="rounded-xl shadow-sm border border-teal-200 bg-teal-50/30">
                <CardHeader className="pb-3 pt-5 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-teal-800">
                    <ArrowDownRight className="w-4 h-4" />
                    Tarik dari Bank
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    Tabungan BKK → Kas Tunai
                  </p>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Jumlah (Rp)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={transferForm.direction === 'TARIK_BANK' ? transferForm.amount : ''}
                      onChange={(e) => setTransferForm({ ...transferForm, direction: 'TARIK_BANK', amount: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Keterangan</Label>
                    <Input
                      placeholder="Mis: Penarikan untuk pembayaran"
                      value={transferForm.direction === 'TARIK_BANK' ? transferForm.description : ''}
                      onChange={(e) => setTransferForm({ ...transferForm, direction: 'TARIK_BANK', description: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tanggal</Label>
                    <Input
                      type="date"
                      value={transferForm.direction === 'TARIK_BANK' ? transferForm.date : new Date().toISOString().split('T')[0]}
                      onChange={(e) => setTransferForm({ ...transferForm, direction: 'TARIK_BANK', date: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <Button
                    className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white mt-1"
                    disabled={transferSaving || (transferForm.direction === 'TARIK_BANK' && (!transferForm.amount || !transferForm.description))}
                    onClick={() => handleTransfer('TARIK_BANK')}
                  >
                    <ArrowDownRight className="w-4 h-4 mr-1" />
                    Tarik dari Bank
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Balance Quick View */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Sisa Kas Tunai</p>
                  <p className="text-sm font-bold text-emerald-700">{formatCurrency(summary.cashBalance)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-sky-50 rounded-xl border border-sky-200">
                <Landmark className="w-5 h-5 text-sky-600" />
                <div>
                  <p className="text-xs text-sky-600 font-medium">Sisa Tabungan BKK</p>
                  <p className="text-sm font-bold text-sky-700">{formatCurrency(summary.bankBalance)}</p>
                </div>
              </div>
            </div>

            {/* Transfer History */}
            <Card className="rounded-xl shadow-sm border border-slate-200">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                  Riwayat Transfer
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {transferTransactions.length === 0 ? (
                  <div className="p-10 text-center">
                    <ArrowRightLeft className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Belum ada riwayat transfer</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs h-9">Tanggal</TableHead>
                          <TableHead className="text-xs h-9">Jenis</TableHead>
                          <TableHead className="text-xs h-9">Akun</TableHead>
                          <TableHead className="text-xs h-9">Keterangan</TableHead>
                          <TableHead className="text-xs h-9 text-right">Jumlah</TableHead>
                          <TableHead className="text-xs h-9 w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transferTransactions.map((tx) => {
                          const isCounterpart = tx.description.startsWith('[Transfer]');
                          const amountDisplay = getAmountDisplay(tx);

                          return (
                            <TableRow key={tx.id} className={isCounterpart ? 'bg-amber-50/50' : ''}>
                              <TableCell className="text-xs py-3 whitespace-nowrap">
                                {formatDateShort(tx.date)}
                              </TableCell>
                              <TableCell className="text-xs py-3">
                                <Badge className="bg-amber-100 text-amber-800">
                                  {tx.category === 'SETOR_BANK' ? (
                                    <><ArrowUpRight className="w-3 h-3 mr-1" />Setor</>
                                  ) : (
                                    <><ArrowDownRight className="w-3 h-3 mr-1" />Tarik</>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs py-3">
                                <div className="flex items-center gap-1.5">
                                  {tx.account === 'BANK_BKK' ? (
                                    <Landmark className="w-3 h-3 text-sky-500" />
                                  ) : (
                                    <Wallet className="w-3 h-3 text-emerald-500" />
                                  )}
                                  <span className="text-slate-600">
                                    {ACCOUNT_LABELS[tx.account] || tx.account}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs py-3 max-w-[200px] truncate">
                                {isCounterpart ? (
                                  <span className="flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 text-amber-500 shrink-0" />
                                    <span className="truncate">{tx.description.replace('[Transfer] ', '')}</span>
                                  </span>
                                ) : (
                                  tx.description
                                )}
                              </TableCell>
                              <TableCell className={`text-xs py-3 text-right font-medium whitespace-nowrap ${amountDisplay.className}`}>
                                {amountDisplay.text}
                              </TableCell>
                              <TableCell className="py-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                                  onClick={() => handleDeleteTransaction(tx.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ============ TAB: REKAP SELAPANAN ============ */}
        <TabsContent value="rekap" className="space-y-4">
          {/* Governance Flow Card */}
          <Card className="rounded-xl shadow-sm border border-slate-200 bg-slate-50/50">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" />
                Alur Tata Kelola Keuangan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-center">
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700">1. Tarikan</p>
                  <p className="text-[10px] text-emerald-600 mt-1">Iuran dikumpulkan saat selapanan</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs font-semibold text-green-700">2. Pencatatan</p>
                  <p className="text-[10px] text-green-600 mt-1">Bendahara catat pemasukan ke Kas Tunai</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs font-semibold text-amber-700">3. Penyetoran</p>
                  <p className="text-[10px] text-amber-600 mt-1">Setor ke Tabungan BKK</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs font-semibold text-red-700">4. Pengeluaran</p>
                  <p className="text-[10px] text-red-600 mt-1">Bendahara catat pengeluaran per periode</p>
                </div>
                <div className="p-3 bg-slate-100 rounded-lg border border-slate-300">
                  <p className="text-xs font-semibold text-slate-700">5. Rekap</p>
                  <p className="text-[10px] text-slate-600 mt-1">Laporan per selapanan saat penutupan</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {recapsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : selapananRecaps.length === 0 ? (
            <Card className="rounded-xl shadow-sm border border-slate-200">
              <CardContent className="p-10 text-center">
                <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Belum ada data rekap selapanan</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {selapananRecaps.map((recap) => {
                const isExpanded = expandedRecap === recap.selapanan.id;
                const s = recap.selapanan;

                return (
                  <Card key={s.id} className="rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Header — always visible */}
                    <button
                      className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedRecap(isExpanded ? null : s.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-slate-700">
                              Selapanan ke-{s.number}
                            </p>
                            <p className="text-xs text-slate-500">
                              {s.periodeStart} s/d {s.periodeEnd}
                            </p>
                          </div>
                          <Badge className={
                            s.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }>
                            {s.status === 'COMPLETED' ? 'Selesai' : 'Berjalan'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Pemasukan</p>
                            <p className="text-sm font-bold text-green-700">{formatCurrency(recap.totalIncome)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Pengeluaran</p>
                            <p className="text-sm font-bold text-red-700">{formatCurrency(recap.totalExpense)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Net</p>
                            <p className={`text-sm font-bold ${recap.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {formatCurrency(recap.netIncome)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 p-5 space-y-4 bg-white">
                        {/* Income Breakdown */}
                        <div>
                          <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Rincian Pemasukan
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {Object.entries(recap.incomeByCategory).map(([cat, amount]) => (
                              <div key={cat} className="p-2.5 bg-green-50 rounded-lg border border-green-100">
                                <p className="text-[10px] text-green-600 truncate">{INCOME_CATEGORY_LABELS[cat] || CATEGORY_LABELS[cat] || cat}</p>
                                <p className="text-xs font-bold text-green-700">{formatCurrency(amount)}</p>
                              </div>
                            ))}
                            {Object.keys(recap.incomeByCategory).length === 0 && (
                              <p className="text-xs text-slate-400 col-span-4">Belum ada pemasukan</p>
                            )}
                          </div>
                        </div>

                        {/* Expense Breakdown */}
                        <div>
                          <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5" />
                            Rincian Pengeluaran
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {Object.entries(recap.expenseByCategory).map(([cat, amount]) => (
                              <div key={cat} className="p-2.5 bg-red-50 rounded-lg border border-red-100">
                                <p className="text-[10px] text-red-600 truncate">{EXPENSE_CATEGORY_LABELS[cat] || CATEGORY_LABELS[cat] || cat}</p>
                                <p className="text-xs font-bold text-red-700">{formatCurrency(amount)}</p>
                              </div>
                            ))}
                            {Object.keys(recap.expenseByCategory).length === 0 && (
                              <p className="text-xs text-slate-400 col-span-5">Belum ada pengeluaran</p>
                            )}
                          </div>
                        </div>

                        {/* Transaction List */}
                        {recap.transactions.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                              Detail Transaksi ({recap.transactions.length})
                            </h4>
                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto rounded-lg border border-slate-200">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs h-8">Tanggal</TableHead>
                                    <TableHead className="text-xs h-8">Jenis</TableHead>
                                    <TableHead className="text-xs h-8">Kategori</TableHead>
                                    <TableHead className="text-xs h-8">Akun</TableHead>
                                    <TableHead className="text-xs h-8">Keterangan</TableHead>
                                    <TableHead className="text-xs h-8 text-right">Jumlah</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {recap.transactions.map((tx) => {
                                    const isTransfer = tx.type === 'TRANSFER';
                                    if (isTransfer) return null; // Skip transfer entries in recap
                                    return (
                                      <TableRow key={tx.id}>
                                        <TableCell className="text-xs py-2 whitespace-nowrap">{formatDateShort(tx.date)}</TableCell>
                                        <TableCell className="text-xs py-2">
                                          <Badge className={tx.type === 'INCOME' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                            {tx.type === 'INCOME' ? 'Masuk' : 'Keluar'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs py-2">
                                          {tx.type === 'INCOME'
                                            ? INCOME_CATEGORY_LABELS[tx.category] || CATEGORY_LABELS[tx.category]
                                            : EXPENSE_CATEGORY_LABELS[tx.category] || CATEGORY_LABELS[tx.category]
                                          }
                                        </TableCell>
                                        <TableCell className="text-xs py-2">
                                          <div className="flex items-center gap-1">
                                            {tx.account === 'BANK_BKK' ? (
                                              <Landmark className="w-3 h-3 text-sky-500" />
                                            ) : (
                                              <Wallet className="w-3 h-3 text-emerald-500" />
                                            )}
                                            {ACCOUNT_LABELS[tx.account] || tx.account}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-xs py-2 max-w-[200px] truncate">{tx.description}</TableCell>
                                        <TableCell className={`text-xs py-2 text-right font-medium whitespace-nowrap ${tx.type === 'INCOME' ? 'text-green-700' : 'text-red-700'}`}>
                                          {tx.type === 'INCOME' ? '+' : '-'} {formatCurrency(tx.amount)}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============ TAB: DENDA ============ */}
        <TabsContent value="denda" className="space-y-4">
          {/* Fine Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="rounded-xl shadow-sm border border-red-200 bg-red-50/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-red-600 font-medium">Denda Belum Bayar</p>
                    <p className="text-lg font-bold text-red-700">
                      {formatCurrency(fineSummary.totalUnpaid)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm border border-green-200 bg-green-50/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-green-600 font-medium">Denda Sudah Bayar</p>
                    <p className="text-lg font-bold text-green-700">
                      {formatCurrency(fineSummary.totalPaid)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add Fine Button */}
          {isAdmin && (
            <div className="flex justify-end">
              <Dialog open={fineOpen} onOpenChange={setFineOpen}>
                <DialogTrigger asChild>
                  <Button className="h-10 bg-slate-800 hover:bg-slate-700 text-white">
                    <Plus className="w-4 h-4 mr-1" />
                    Tambah Denda
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tambah Denda</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <Label>Keluarga</Label>
                      <Select
                        value={fineForm.familyId}
                        onValueChange={handleFamilySelect}
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Pilih keluarga" />
                        </SelectTrigger>
                        <SelectContent>
                          {families.map((fam) => (
                            <SelectItem key={fam.id} value={fam.id}>
                              {fam.familyHead}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedFamily && selectedFamily.members.length > 0 && (
                      <div className="space-y-2">
                        <Label>Warga</Label>
                        <Select
                          value={fineForm.userId}
                          onValueChange={(v) => setFineForm({ ...fineForm, userId: v })}
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder="Pilih warga" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedFamily.members.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Jenis Denda</Label>
                      <Select
                        value={fineForm.type}
                        onValueChange={(v) => setFineForm({ ...fineForm, type: v })}
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RONDA">Ronda</SelectItem>
                          <SelectItem value="JIMPITAN">Jimpitan</SelectItem>
                          <SelectItem value="LAIN_LAIN">Lain-lain</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Jumlah (Rp)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={fineForm.amount}
                        onChange={(e) => setFineForm({ ...fineForm, amount: e.target.value })}
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Alasan</Label>
                      <Input
                        placeholder="Alasan denda"
                        value={fineForm.reason}
                        onChange={(e) => setFineForm({ ...fineForm, reason: e.target.value })}
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tanggal</Label>
                      <Input
                        type="date"
                        value={fineForm.date}
                        onChange={(e) => setFineForm({ ...fineForm, date: e.target.value })}
                        className="h-10"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <Button variant="outline" onClick={() => setFineOpen(false)} className="h-10">
                        Batal
                      </Button>
                      <Button
                        onClick={handleCreateFine}
                        disabled={fineSaving || !fineForm.userId || !fineForm.familyId || !fineForm.amount || !fineForm.reason}
                        className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
                      >
                        {fineSaving ? 'Menyimpan...' : 'Simpan'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Fines Table */}
          <Card className="rounded-xl shadow-sm border border-slate-200">
            <CardContent className="p-0">
              {finesLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : fines.length === 0 ? (
                <div className="p-10 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Tidak ada data denda</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-9">Tanggal</TableHead>
                        <TableHead className="text-xs h-9">Warga</TableHead>
                        <TableHead className="text-xs h-9">KK</TableHead>
                        <TableHead className="text-xs h-9">Jenis</TableHead>
                        <TableHead className="text-xs h-9">Alasan</TableHead>
                        <TableHead className="text-xs h-9 text-right">Jumlah</TableHead>
                        <TableHead className="text-xs h-9">Status</TableHead>
                        {isAdmin && <TableHead className="text-xs h-9 w-20" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fines.map((fine) => (
                        <TableRow key={fine.id}>
                          <TableCell className="text-xs py-3 whitespace-nowrap">
                            {formatDateShort(fine.date)}
                          </TableCell>
                          <TableCell className="text-xs py-3">
                            {fine.user?.name || '-'}
                          </TableCell>
                          <TableCell className="text-xs py-3">
                            {fine.family?.familyHead || '-'}
                          </TableCell>
                          <TableCell className="text-xs py-3">
                            <Badge variant="outline" className="text-xs">
                              {fine.type === FINE_TYPE.RONDA
                                ? 'Ronda'
                                : fine.type === FINE_TYPE.JIMPITAN
                                ? 'Jimpitan'
                                : 'Lain-lain'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs py-3 max-w-[150px] truncate">
                            {fine.reason}
                          </TableCell>
                          <TableCell className="text-xs py-3 text-right font-medium whitespace-nowrap">
                            {formatCurrency(fine.amount)}
                          </TableCell>
                          <TableCell className="text-xs py-3">
                            <Badge
                              className={
                                fine.status === FINE_STATUS.PAID
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }
                            >
                              {fine.status === FINE_STATUS.PAID ? 'Lunas' : 'Belum'}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="py-3">
                              {fine.status === FINE_STATUS.UNPAID && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                                  onClick={() => handleMarkFinePaid(fine.id)}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Lunas
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
