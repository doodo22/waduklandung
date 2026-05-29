'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateShort,
  CATEGORY_LABELS,
  TRANSACTION_TYPE,
  TRANSACTION_CATEGORY,
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
} from 'lucide-react';

// Types
interface Transaction {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  selapananId: string | null;
  createdBy: string;
  createdAt: string;
}

interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
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

interface Props {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

export function KeuanganPage({ userId, familyId, isAdmin }: Props) {
  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary>({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Transaction form
  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState({
    type: 'INCOME',
    category: 'IURAN_BULANAN',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [txSaving, setTxSaving] = useState(false);

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

  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType && filterType !== 'all') params.set('type', filterType);
      if (filterCategory && filterCategory !== 'all') params.set('category', filterCategory);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);

      const query = params.toString();
      const res = await api.get(`/transactions${query ? `?${query}` : ''}`);
      const data = await res.json();
      if (res.ok) {
        setTransactions(data.transactions || []);
        setSummary(
          data.summary || { totalIncome: 0, totalExpense: 0, balance: 0 }
        );
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [filterType, filterCategory, filterFrom, filterTo]);

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

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchFines();
    fetchFamilies();
  }, [fetchFines, fetchFamilies]);

  const handleCreateTransaction = async () => {
    if (!txForm.type || !txForm.category || !txForm.amount || !txForm.description || !txForm.date)
      return;
    setTxSaving(true);
    try {
      const res = await api.post('/transactions', {
        type: txForm.type,
        category: txForm.category,
        amount: parseInt(txForm.amount, 10),
        description: txForm.description,
        date: txForm.date,
      });
      if (res.ok) {
        setTxOpen(false);
        setTxForm({
          type: 'INCOME',
          category: 'IURAN_BULANAN',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
        });
        fetchTransactions();
      }
    } catch {
      // silently handle
    } finally {
      setTxSaving(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const res = await api.delete(`/transactions?id=${id}`);
      if (res.ok) {
        fetchTransactions();
      }
    } catch {
      // silently handle
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
      }
    } catch {
      // silently handle
    } finally {
      setFineSaving(false);
    }
  };

  const handleMarkFinePaid = async (id: string) => {
    try {
      const res = await api.put('/fines', { id, status: 'PAID' });
      if (res.ok) {
        fetchFines();
      }
    } catch {
      // silently handle
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
    setFilterFrom('');
    setFilterTo('');
  };

  const hasActiveFilters = filterType !== 'all' || filterCategory !== 'all' || filterFrom || filterTo;

  // Category options for transaction type
  const categoryOptions = Object.entries(CATEGORY_LABELS);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-800">Keuangan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Keuangan</h2>
          <p className="text-sm text-slate-500 mt-1">Kelola keuangan dan denda RT</p>
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
                    onValueChange={(v) => setTxForm({ ...txForm, type: v })}
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
                    onValueChange={(v) => setTxForm({ ...txForm, category: v })}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-xl shadow-sm border border-green-200 bg-green-50/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium">Pemasukan</p>
                <p className="text-lg font-bold text-green-700">
                  {formatCurrency(summary.totalIncome)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm border border-red-200 bg-red-50/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-red-600 font-medium">Pengeluaran</p>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(summary.totalExpense)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm border border-slate-300 bg-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-slate-200" />
              </div>
              <div>
                <p className="text-xs text-slate-300 font-medium">Saldo</p>
                <p className="text-lg font-bold text-white">
                  {formatCurrency(summary.balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Transaksi</TabsTrigger>
          <TabsTrigger value="fines">Denda</TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Filters */}
          <Card className="rounded-xl shadow-sm border border-slate-200">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Jenis</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      <SelectItem value="INCOME">Pemasukan</SelectItem>
                      <SelectItem value="EXPENSE">Pengeluaran</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Kategori</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-9 w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      {categoryOptions.map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Dari</Label>
                  <Input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Sampai</Label>
                  <Input
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-slate-500">
                    <X className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transaction Table */}
          <Card className="rounded-xl shadow-sm border border-slate-200">
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="p-10 text-center">
                  <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Tidak ada transaksi ditemukan</p>
                  {hasActiveFilters && (
                    <p className="text-xs text-slate-400 mt-1">
                      Coba ubah filter pencarian Anda
                    </p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-9">Tanggal</TableHead>
                        <TableHead className="text-xs h-9">Kategori</TableHead>
                        <TableHead className="text-xs h-9">Keterangan</TableHead>
                        <TableHead className="text-xs h-9 text-right">Jumlah</TableHead>
                        {isAdmin && (
                          <TableHead className="text-xs h-9 w-12" />
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs py-3 whitespace-nowrap">
                            {formatDateShort(tx.date)}
                          </TableCell>
                          <TableCell className="text-xs py-3">
                            <Badge
                              className={
                                tx.type === 'INCOME'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }
                            >
                              {CATEGORY_LABELS[tx.category] || tx.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs py-3 max-w-[200px] truncate">
                            {tx.description}
                          </TableCell>
                          <TableCell
                            className={`text-xs py-3 text-right font-medium whitespace-nowrap ${
                              tx.type === 'INCOME' ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {tx.type === 'INCOME' ? '+' : '-'} {formatCurrency(tx.amount)}
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

        {/* Fines Tab */}
        <TabsContent value="fines" className="space-y-4">
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
