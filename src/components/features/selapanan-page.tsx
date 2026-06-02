'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateShort,
  SELAPANAN_STATUS_LABELS,
  JIMPITAN_TYPE_LABELS,
  LEVY_ITEM_STATUS_LABELS,
} from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Calendar,
  Plus,
  MapPin,
  ChevronDown,
  ChevronRight,
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Shield,
  FileText,
  X,
  Hash,
  ArrowRight,
  Loader2,
  HandCoins,
  Banknote,
  BookOpen,
  CircleDollarSign,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface SelapananDetail {
  id: string;
  selapananId: string;
  agenda: string;
  decisions: string | null;
  notes: string | null;
}

interface Selapanan {
  id: string;
  number: number;
  periodeStart: string;
  periodeEnd: string;
  meetingDate: string;
  meetingLocation: string | null;
  status: string;
  jimpitanDaily: number;
  jimpitanMonthly: number;
  rondaFeeTotal: number;
  shortagePaid: number;
  finePaid: number;
  levyPaid: number;
  otherIncome: number;
  totalIncome: number;
  notes: string | null;
  details: SelapananDetail[];
  createdAt: string;
  updatedAt: string;
}

interface CombinedShortage {
  familyId: string;
  familyHead: string;
  previousShortage: number;
  currentShortage: number;
  totalShortage: number;
  prevFromSelapanan: number | null;
}

interface RecapData {
  selapanan: Selapanan | null;
  jimpitanByGroup: { groupId: string; groupName: string; totalExpected: number; totalPaid: number; totalShortage: number; nightsCollected: number }[];
  monthlyPayers: { familyId: string; familyHead: string; amount: number; monthsSpanned: number; totalDue: number }[];
  rondaFees: { familyId: string; familyHead: string; rondaFee: number }[];
  previousShortages: { familyId: string; familyHead: string; totalShortage: number; isSettled: boolean }[];
  currentShortages: { familyId: string; familyHead: string; totalShortage: number }[];
  combinedShortages: CombinedShortage[];
  totalCombinedShortage: number;
  customLevies: { id: string; name: string; items: { familyId: string; familyHead: string; totalAmount: number; installments: number; paidAmount: number; nextInstallment: number; status: string; id?: string; remaining?: number }[] }[];
  fines: { id: string; familyHead: string; type: string; amount: number; reason: string; status: string }[];
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  monthsSpanned: number;
  daysInPeriod: number;
  daysElapsed: number;
  daysRemaining: number;
}

interface Props {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

// ============================================
// COMPONENT
// ============================================

export function SelapananPage({ userId, familyId, isAdmin }: Props) {
  const [selapananList, setSelapananList] = useState<Selapanan[]>([]);
  const [loading, setLoading] = useState(true);
  const [recapMap, setRecapMap] = useState<Record<string, RecapData>>({});
  const [loadingRecapId, setLoadingRecapId] = useState<string | null>(null);

  // Expanded state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    number: 0,
    periodeStart: '',
    periodeEnd: '',
    meetingDate: '',
    meetingLocation: '',
    notes: '',
  });
  const [agendaItems, setAgendaItems] = useState([{ agenda: '', decisions: '', notes: '' }]);
  const [saving, setSaving] = useState(false);

  // Complete dialog
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  // Collection mode state
  const [collectionMode, setCollectionMode] = useState(false);
  const [collectionTab, setCollectionTab] = useState('shortage');
  const [collectInputs, setCollectInputs] = useState<Record<string, string>>({});
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [sessionCollected, setSessionCollected] = useState(0);

  // ----------------------------------------
  // Data Fetching
  // ----------------------------------------

  const fetchSelapanan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/selapanan');
      if (res.ok) {
        const data = await res.json();
        setSelapananList(data.selapanan || []);
      }
    } catch {
      toast.error('Gagal memuat data selapanan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSelapanan();
  }, [fetchSelapanan]);

  const fetchRecap = useCallback(async (selapananId: string) => {
    setLoadingRecapId(selapananId);
    try {
      const res = await api.get(`/selapanan/recap?selapananId=${selapananId}`);
      if (res.ok) {
        const raw = await res.json();
        const r = raw.recap || {};
        const s = raw.selapanan || {};
        const daysDiff = s.periodeStart ? Math.ceil((Date.now() - new Date(s.periodeStart).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const daysRem = s.meetingDate ? Math.max(0, Math.ceil((new Date(s.meetingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

        const recap: RecapData = {
          selapanan: s,
          jimpitanByGroup: (r.dailyByGroup || []).map((g: Record<string, unknown>) => ({
            groupId: g.groupId as string,
            groupName: g.groupName as string,
            totalExpected: g.totalExpected as number,
            totalPaid: g.totalPaid as number,
            totalShortage: g.totalShortage as number,
            nightsCollected: (g.entries as unknown[])?.length || 0,
          })),
          monthlyPayers: (r.monthlyPayers || []).map((m: Record<string, unknown>) => ({
            familyId: m.familyId as string,
            familyHead: m.familyHead as string,
            amount: m.monthlyAmount as number,
            monthsSpanned: m.monthsSpanned as number,
            totalDue: m.totalExpected as number,
          })),
          rondaFees: (r.rondaFees || []).map((f: Record<string, unknown>) => ({
            familyId: f.familyId as string,
            familyHead: f.familyHead as string,
            rondaFee: f.totalExpected as number,
          })),
          previousShortages: (r.previousShortageItems || []).map((s: Record<string, unknown>) => ({
            familyId: s.familyId as string,
            familyHead: s.familyHead as string,
            totalShortage: s.remaining as number,
            isSettled: false,
          })),
          currentShortages: (r.currentShortages || []).map((s: Record<string, unknown>) => ({
            familyId: s.familyId as string,
            familyHead: s.familyHead as string,
            totalShortage: s.remaining as number,
          })),
          combinedShortages: (r.combinedShortages || []).map((s: Record<string, unknown>) => ({
            familyId: s.familyId as string,
            familyHead: s.familyHead as string,
            previousShortage: s.previousShortage as number,
            currentShortage: s.currentShortage as number,
            totalShortage: s.totalShortage as number,
            prevFromSelapanan: s.prevFromSelapanan as number | null,
          })),
          totalCombinedShortage: r.totalCombinedShortage || 0,
          customLevies: (r.leviesWithPayments || []).map((l: Record<string, unknown>) => ({
            id: l.id as string,
            name: l.name as string,
            items: ((l.items || []) as Record<string, unknown>[]).map((i: Record<string, unknown>) => ({
              familyId: i.familyId as string,
              familyHead: i.familyHead as string,
              totalAmount: i.totalAmount as number,
              installments: i.installments as number,
              paidAmount: i.paidAmount as number,
              nextInstallment: i.perInstallment as number,
              status: i.status as string,
              id: i.id as string | undefined,
              remaining: (i.totalAmount as number) - (i.paidAmount as number),
            })),
          })),
          fines: (r.finesSummary || []).map((f: Record<string, unknown>) => ({
            id: f.id as string,
            familyHead: f.familyHead as string,
            type: f.type as string,
            amount: f.amount as number,
            reason: f.reason as string,
            status: 'UNPAID' as string,
          })),
          totalExpected: r.totalExpectedIncome || 0,
          totalCollected: r.totalActualIncome || 0,
          totalOutstanding: r.totalCombinedShortage || (r.totalPreviousShortage || 0) + (r.totalCurrentShortage || 0),
          monthsSpanned: r.monthsSpanned || 1,
          daysInPeriod: 35,
          daysElapsed: Math.max(0, daysDiff),
          daysRemaining: daysRem,
        };
        setRecapMap(prev => ({ ...prev, [selapananId]: recap }));
      }
    } catch {
      toast.error('Gagal memuat rekap');
    } finally {
      setLoadingRecapId(null);
    }
  }, []);

  // ----------------------------------------
  // Handlers
  // ----------------------------------------

  const handleAutoGenerate = () => {
    const baseDate = new Date('2026-05-30');
    const baseNumber = 178;
    const nextNumber = (selapananList.length > 0 ? Math.max(...selapananList.map(s => s.number || 0)) : baseNumber) + 1;

    const periodsAfterBase = nextNumber - baseNumber;
    const nextMeeting = new Date(baseDate);
    nextMeeting.setDate(nextMeeting.getDate() + (periodsAfterBase * 35));

    const periodeStart = new Date(nextMeeting);
    periodeStart.setDate(periodeStart.getDate() - 34);
    const periodeEnd = new Date(nextMeeting);

    setForm({
      number: nextNumber,
      periodeStart: formatDateISO(periodeStart),
      periodeEnd: formatDateISO(periodeEnd),
      meetingDate: formatDateISO(nextMeeting),
      meetingLocation: form.meetingLocation || 'Balai RT',
      notes: '',
    });
  };

  const handleCreate = async () => {
    if (!form.periodeStart || !form.periodeEnd || !form.meetingDate || !form.number) {
      toast.error('Data tidak lengkap');
      return;
    }
    setSaving(true);
    try {
      const details = agendaItems
        .filter(a => a.agenda.trim())
        .map(a => ({ agenda: a.agenda, decisions: a.decisions || undefined, notes: a.notes || undefined }));

      const res = await api.post('/selapanan', {
        number: form.number,
        periodeStart: form.periodeStart,
        periodeEnd: form.periodeEnd,
        meetingDate: form.meetingDate,
        meetingLocation: form.meetingLocation || null,
        notes: form.notes || null,
        details: details.length > 0 ? details : undefined,
      });

      if (res.ok) {
        toast.success('Selapanan berhasil dibuat');
        setCreateOpen(false);
        fetchSelapanan();
      } else {
        toast.error('Gagal membuat selapanan');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!completingId) return;
    setCompleting(true);
    try {
      const res = await api.post('/selapanan/complete', { selapananId: completingId });
      if (res.ok) {
        toast.success('Selapanan berhasil diselesaikan');
        setCompleteOpen(false);
        setCompletingId(null);
        setCollectionMode(false);
        setSessionCollected(0);
        fetchSelapanan();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal menyelesaikan selapanan');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setCompleting(false);
    }
  };

  const handleCollect = async (key: string, payload: {
    selapananId: string;
    type: string;
    familyId?: string;
    amount?: number;
    fineId?: string;
    levyItemId?: string;
    notes?: string;
  }) => {
    setSubmittingKey(key);
    try {
      const res = await api.post('/selapanan/collect', payload);
      if (res.ok) {
        const amt = payload.amount || 0;
        setSessionCollected(prev => prev + amt);
        toast.success(`Berhasil mencatat ${formatCurrency(amt)}`);
        // Clear the input
        setCollectInputs(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        // Refresh recap
        await fetchRecap(payload.selapananId);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Gagal mencatat pembayaran');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmittingKey(null);
    }
  };

  const toggleExpand = (selapanan: Selapanan) => {
    if (expandedId === selapanan.id) {
      setExpandedId(null);
    } else {
      setExpandedId(selapanan.id);
      if (!recapMap[selapanan.id] && selapanan.status === 'UPCOMING') {
        fetchRecap(selapanan.id);
      }
    }
  };

  const enterCollectionMode = () => {
    const upcoming = selapananList.find(s => s.status === 'UPCOMING');
    if (upcoming && !recapMap[upcoming.id]) {
      fetchRecap(upcoming.id);
    }
    setCollectionMode(true);
    setCollectionTab('shortage');
    setCollectInputs({});
    setSessionCollected(0);
  };

  const exitCollectionMode = () => {
    setCollectionMode(false);
    setCollectInputs({});
  };

  // ----------------------------------------
  // Loading Skeleton
  // ----------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-36 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-4 w-48 bg-slate-100 rounded animate-pulse mt-1.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[72px] bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  // ----------------------------------------
  // Derived data
  // ----------------------------------------

  const upcoming = selapananList.find(s => s.status === 'UPCOMING');
  const completed = selapananList.filter(s => s.status === 'COMPLETED');
  const totalAllIncome = completed.reduce((sum, s) => sum + s.totalIncome, 0);

  // ----------------------------------------
  // Render: Stats
  // ----------------------------------------

  const renderStats = () => {
    const daysRemaining = upcoming ? Math.max(0, Math.ceil((new Date(upcoming.meetingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
              <Hash className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Selapanan Aktif</p>
              <p className="text-lg font-bold text-slate-800">Ke-{upcoming?.number || '-'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Hari Menuju Rapat</p>
              <p className="text-lg font-bold text-slate-800">{daysRemaining} hari</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Selapanan Selesai</p>
              <p className="text-lg font-bold text-slate-800">{completed.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-sky-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Pemasukan</p>
              <p className="text-lg font-bold text-slate-800">{formatCurrency(totalAllIncome)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ----------------------------------------
  // Render: Current Period Hero (Preview Mode)
  // ----------------------------------------

  const renderCurrentPeriod = () => {
    if (!upcoming) {
      return (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-8 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada selapanan aktif</p>
            {isAdmin && (
              <Button
                size="sm"
                className="mt-4 bg-slate-800 hover:bg-slate-700 text-white"
                onClick={() => { handleAutoGenerate(); setCreateOpen(true); }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Buat Selapanan ke-179
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    const recap = recapMap[upcoming.id];
    const isLoading = loadingRecapId === upcoming.id;
    const daysRemaining = Math.max(0, Math.ceil((new Date(upcoming.meetingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const daysElapsed = Math.max(0, Math.ceil((Date.now() - new Date(upcoming.periodeStart).getTime()) / (1000 * 60 * 60 * 24)));

    return (
      <div className="space-y-4">
        {/* Period Info Card */}
        <Card className="rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-slate-800 text-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-amber-400 text-slate-900 text-[10px] font-bold">SELANJUTNYA</Badge>
                  <span className="text-slate-300 text-sm">Selapanan Ke-{upcoming.number}</span>
                </div>
                <h3 className="text-lg font-bold">
                  Rapat: {formatDateShort(upcoming.meetingDate)}
                </h3>
                <div className="flex items-center gap-4 mt-1 text-sm text-slate-300">
                  <span>Periode: {formatDateShort(upcoming.periodeStart)} — {formatDateShort(upcoming.periodeEnd)}</span>
                  {upcoming.meetingLocation && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {upcoming.meetingLocation}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{daysRemaining}</div>
                <div className="text-xs text-slate-400">hari lagi</div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3 bg-slate-700 rounded-full h-2">
              <div
                className="bg-amber-400 rounded-full h-2 transition-all"
                style={{ width: `${Math.min(100, (daysElapsed / 35) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Hari ke-{daysElapsed} dari 35</span>
              <span>5x tugas ronda per grup</span>
            </div>
          </div>

          {/* Financial Summary Grid */}
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" />
                <span className="text-sm text-slate-400">Memuat rekap keuangan...</span>
              </div>
            ) : recap ? (
              <div className="space-y-4">
                {/* Income breakdown grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-slate-500 font-medium uppercase">Jimpitan Harian</p>
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(recap.jimpitanByGroup.reduce((s, g) => s + g.totalPaid, 0))}</p>
                    <p className="text-[10px] text-slate-400">{recap.jimpitanByGroup.reduce((s, g) => s + g.totalExpected, 0) > 0 ? `target ${formatCurrency(recap.jimpitanByGroup.reduce((s, g) => s + g.totalExpected, 0))}` : '-'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-slate-500 font-medium uppercase">Iuran Bulanan</p>
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(recap.monthlyPayers.reduce((s, m) => s + m.totalDue, 0))}</p>
                    <p className="text-[10px] text-slate-400">{recap.monthlyPayers.length} warga bulanan</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-slate-500 font-medium uppercase">Iuran Ronda</p>
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(recap.rondaFees.reduce((s, r) => s + r.rondaFee, 0))}</p>
                    <p className="text-[10px] text-slate-400">{recap.rondaFees.length} warga bayar</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-amber-600 font-medium uppercase">Kurangan</p>
                    <p className="text-sm font-bold text-amber-700">{formatCurrency(recap.totalOutstanding)}</p>
                    <p className="text-[10px] text-slate-400">dari periode lalu + sekarang</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-emerald-600 font-medium uppercase">Total Estimasi</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrency(recap.totalExpected)}</p>
                    <p className="text-[10px] text-slate-400">pemasukan selapanan ini</p>
                  </div>
                </div>

                {/* Detail Tables */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-700 py-2 border-t">
                      <span>Lihat Detail Rekap</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-4 pt-3">
                      {/* Jimpitan per Group */}
                      {recap.jimpitanByGroup.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5" /> Jimpitan Harian per Grup
                          </h4>
                          <div className="overflow-x-auto rounded-lg border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50/50">
                                  <TableHead className="text-[11px]">Grup</TableHead>
                                  <TableHead className="text-[11px] text-center">Malam</TableHead>
                                  <TableHead className="text-[11px] text-right">Target</TableHead>
                                  <TableHead className="text-[11px] text-right">Terkumpul</TableHead>
                                  <TableHead className="text-[11px] text-right">Kurang</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {recap.jimpitanByGroup.map(g => (
                                  <TableRow key={g.groupId}>
                                    <TableCell className="text-xs font-medium">{g.groupName}</TableCell>
                                    <TableCell className="text-xs text-center">{g.nightsCollected}/5</TableCell>
                                    <TableCell className="text-xs text-right">{formatCurrency(g.totalExpected)}</TableCell>
                                    <TableCell className="text-xs text-right text-emerald-600">{formatCurrency(g.totalPaid)}</TableCell>
                                    <TableCell className="text-xs text-right text-amber-600">{formatCurrency(g.totalShortage)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {/* Monthly Payers */}
                      {recap.monthlyPayers.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                            <Wallet className="w-3.5 h-3.5" /> Warga Iuran Bulanan
                          </h4>
                          <div className="overflow-x-auto rounded-lg border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50/50">
                                  <TableHead className="text-[11px]">KK</TableHead>
                                  <TableHead className="text-[11px] text-center">Iuran/Bulan</TableHead>
                                  <TableHead className="text-[11px] text-center">Bulan</TableHead>
                                  <TableHead className="text-[11px] text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {recap.monthlyPayers.map(m => (
                                  <TableRow key={m.familyId}>
                                    <TableCell className="text-xs font-medium">{m.familyHead}</TableCell>
                                    <TableCell className="text-xs text-center">{formatCurrency(m.amount)}</TableCell>
                                    <TableCell className="text-xs text-center">{m.monthsSpanned}x</TableCell>
                                    <TableCell className="text-xs text-right font-medium">{formatCurrency(m.totalDue)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {/* Ronda Fees */}
                      {recap.rondaFees.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5" /> Iuran Ronda (Bayar Pengganti)
                          </h4>
                          <div className="overflow-x-auto rounded-lg border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50/50">
                                  <TableHead className="text-[11px]">KK</TableHead>
                                  <TableHead className="text-[11px] text-right">Iuran</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {recap.rondaFees.map(r => (
                                  <TableRow key={r.familyId}>
                                    <TableCell className="text-xs font-medium">{r.familyHead}</TableCell>
                                    <TableCell className="text-xs text-right">{formatCurrency(r.rondaFee)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {/* Shortages */}
                      {recap.combinedShortages.filter(s => s.totalShortage > 0).length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Kurangan Jimpitan
                          </h4>
                          <div className="overflow-x-auto rounded-lg border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50/50">
                                  <TableHead className="text-[11px]">KK</TableHead>
                                  <TableHead className="text-[11px] text-right">Bulan Lalu</TableHead>
                                  <TableHead className="text-[11px] text-right">Periode Ini</TableHead>
                                  <TableHead className="text-[11px] text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {recap.combinedShortages.filter(s => s.totalShortage > 0).map(s => (
                                  <TableRow key={s.familyId}>
                                    <TableCell className="text-xs font-medium">
                                      <div>
                                        {s.familyHead}
                                        {s.prevFromSelapanan && s.previousShortage > 0 && (
                                          <p className="text-[9px] text-amber-500 font-normal">dari selapanan ke-{s.prevFromSelapanan}</p>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-right">
                                      {s.previousShortage > 0 ? (
                                        <span className="text-amber-600">{formatCurrency(s.previousShortage)}</span>
                                      ) : (
                                        <span className="text-slate-300">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs text-right">
                                      {s.currentShortage > 0 ? (
                                        <span className="text-slate-600">{formatCurrency(s.currentShortage)}</span>
                                      ) : (
                                        <span className="text-slate-300">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs text-right font-bold text-red-600">{formatCurrency(s.totalShortage)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {/* Custom Levies */}
                      {recap.customLevies.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> Tarikan Lain
                          </h4>
                          {recap.customLevies.map(levy => (
                            <div key={levy.id} className="mb-3">
                              <p className="text-xs font-medium text-slate-700 mb-1">{levy.name}</p>
                              <div className="overflow-x-auto rounded-lg border">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                      <TableHead className="text-[11px]">KK</TableHead>
                                      <TableHead className="text-[11px] text-right">Total</TableHead>
                                      <TableHead className="text-[11px] text-center">Cicilan</TableHead>
                                      <TableHead className="text-[11px] text-right">Terbayar</TableHead>
                                      <TableHead className="text-[11px] text-right">Per Cicilan</TableHead>
                                      <TableHead className="text-[11px] text-center">Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {levy.items.map(item => (
                                      <TableRow key={item.familyId}>
                                        <TableCell className="text-xs font-medium">{item.familyHead}</TableCell>
                                        <TableCell className="text-xs text-right">{formatCurrency(item.totalAmount)}</TableCell>
                                        <TableCell className="text-xs text-center">{item.installments}x</TableCell>
                                        <TableCell className="text-xs text-right">{formatCurrency(item.paidAmount)}</TableCell>
                                        <TableCell className="text-xs text-right">{formatCurrency(item.nextInstallment)}</TableCell>
                                        <TableCell className="text-xs text-center">
                                          <Badge className={`text-[9px] ${item.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {LEVY_ITEM_STATUS_LABELS[item.status] || item.status}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Fines */}
                      {recap.fines.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Denda
                          </h4>
                          <div className="overflow-x-auto rounded-lg border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50/50">
                                  <TableHead className="text-[11px]">KK</TableHead>
                                  <TableHead className="text-[11px]">Jenis</TableHead>
                                  <TableHead className="text-[11px] text-right">Jumlah</TableHead>
                                  <TableHead className="text-[11px]">Alasan</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {recap.fines.map(fine => (
                                  <TableRow key={fine.id}>
                                    <TableCell className="text-xs font-medium">{fine.familyHead}</TableCell>
                                    <TableCell className="text-xs">{fine.type}</TableCell>
                                    <TableCell className="text-xs text-right text-red-600">{formatCurrency(fine.amount)}</TableCell>
                                    <TableCell className="text-xs text-slate-500">{fine.reason}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Admin Actions */}
                {isAdmin && (
                  <div className="flex items-center gap-2 pt-3 border-t">
                    <Button
                      size="sm"
                      className="h-9 bg-slate-800 hover:bg-slate-700 text-white text-xs"
                      onClick={() => fetchRecap(upcoming.id)}
                    >
                      <Loader2 className={`w-3.5 h-3.5 mr-1 ${loadingRecapId === upcoming.id ? 'animate-spin' : ''}`} />
                      Refresh Rekap
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                      onClick={enterCollectionMode}
                    >
                      <HandCoins className="w-3.5 h-3.5 mr-1" />
                      Mulai Pengumpulan
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      onClick={() => { setCompletingId(upcoming.id); setCompleteOpen(true); }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Selesaikan Selapanan
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-400">Klik "Refresh Rekap" untuk memuat rekap keuangan</p>
                {isAdmin && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => fetchRecap(upcoming.id)}>
                      Muat Rekap
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                      onClick={enterCollectionMode}
                    >
                      <HandCoins className="w-3.5 h-3.5 mr-1" />
                      Mulai Pengumpulan
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ----------------------------------------
  // Render: Collection Mode
  // ----------------------------------------

  const renderCollectionMode = () => {
    if (!upcoming) return null;
    const recap = recapMap[upcoming.id];
    const isLoading = loadingRecapId === upcoming.id;

    if (isLoading && !recap) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" />
          <span className="text-sm text-slate-400">Memuat data untuk pengumpulan...</span>
        </div>
      );
    }

    if (!recap) {
      return (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-slate-500">Data rekap belum dimuat</p>
            <Button size="sm" className="mt-3 bg-slate-800 hover:bg-slate-700 text-white text-xs" onClick={() => fetchRecap(upcoming.id)}>
              Muat Rekap
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Collection Mode Header */}
        <div className="rounded-xl border bg-slate-800 text-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-amber-400 text-slate-900 text-[10px] font-bold">PENGUMPULAN</Badge>
                <span className="text-slate-300 text-sm">Selapanan Ke-{upcoming.number}</span>
              </div>
              <h3 className="text-base font-bold">Mode Pengumpulan Dana</h3>
              <p className="text-xs text-slate-400 mt-0.5">{formatDateShort(upcoming.meetingDate)} — {upcoming.meetingLocation || 'Balai RT'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Terkumpul Hari Ini</p>
              <p className="text-xl font-bold text-emerald-400">{formatCurrency(sessionCollected)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={collectionTab} onValueChange={setCollectionTab}>
          <TabsList className="w-full flex h-auto flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="shortage" className="text-xs flex-1 min-w-0 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-500" />
              <span className="hidden sm:inline">Kurangan</span>
              <span className="sm:hidden">Kurang</span>
            </TabsTrigger>
            <TabsTrigger value="ronda-group" className="text-xs flex-1 min-w-0 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              <Shield className="w-3.5 h-3.5 mr-1 text-slate-500" />
              <span className="hidden sm:inline">Setoran Ronda</span>
              <span className="sm:hidden">Ronda</span>
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs flex-1 min-w-0 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              <Wallet className="w-3.5 h-3.5 mr-1 text-slate-500" />
              <span className="hidden sm:inline">Iuran Bulanan</span>
              <span className="sm:hidden">Bulanan</span>
            </TabsTrigger>
            <TabsTrigger value="ronda-levy-fine" className="text-xs flex-1 min-w-0 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              <Banknote className="w-3.5 h-3.5 mr-1 text-slate-500" />
              <span className="hidden sm:inline">Ronda & Lainnya</span>
              <span className="sm:hidden">Lainnya</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Kurangan Jimpitan */}
          <TabsContent value="shortage">
            {renderShortageTab(recap)}
          </TabsContent>

          {/* Tab 2: Setoran Ronda Grup */}
          <TabsContent value="ronda-group">
            {renderRondaGroupTab(recap)}
          </TabsContent>

          {/* Tab 3: Iuran Bulanan */}
          <TabsContent value="monthly">
            {renderMonthlyTab(recap)}
          </TabsContent>

          {/* Tab 4: Iuran Ronda & Lainnya */}
          <TabsContent value="ronda-levy-fine">
            {renderRondaLevyFineTab(recap)}
          </TabsContent>
        </Tabs>

        {/* Bottom Bar */}
        <div className="sticky bottom-0 z-10 rounded-xl border bg-white shadow-lg p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CircleDollarSign className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-medium">Total Hari Ini</p>
                <p className="text-sm font-bold text-emerald-700">{formatCurrency(sessionCollected)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs"
                onClick={exitCollectionMode}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Kembali ke Preview
              </Button>
              <Button
                size="sm"
                className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                onClick={() => { setCompletingId(upcoming.id); setCompleteOpen(true); }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Selesaikan Selapanan
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ----------------------------------------
  // Tab 1: Kurangan Jimpitan
  // ----------------------------------------

  const renderShortageTab = (recap: RecapData) => {
    const combined = recap.combinedShortages.filter(s => s.totalShortage > 0);

    if (combined.length === 0) {
      return (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Tidak ada kurangan jimpitan</p>
          </CardContent>
        </Card>
      );
    }

    const totalPrev = combined.reduce((s, c) => s + c.previousShortage, 0);
    const totalCurr = combined.reduce((s, c) => s + c.currentShortage, 0);
    const totalAll = combined.reduce((s, c) => s + c.totalShortage, 0);

    return (
      <div className="space-y-3">
        {/* Summary boxes */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-amber-50 p-3">
            <p className="text-[10px] text-amber-600 font-medium uppercase">Kurangan Bulan Lalu</p>
            <p className="text-sm font-bold text-amber-700">{formatCurrency(totalPrev)}</p>
            <p className="text-[10px] text-amber-500">dari selapanan sebelumnya</p>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-[10px] text-slate-500 font-medium uppercase">Kurangan Periode Ini</p>
            <p className="text-sm font-bold text-slate-700">{formatCurrency(totalCurr)}</p>
            <p className="text-[10px] text-slate-400">jimpitan belum lunas</p>
          </div>
          <div className="rounded-lg border bg-red-50 p-3">
            <p className="text-[10px] text-red-600 font-medium uppercase">Total Kurangan</p>
            <p className="text-sm font-bold text-red-700">{formatCurrency(totalAll)}</p>
            <p className="text-[10px] text-red-400">bulan lalu + periode ini</p>
          </div>
        </div>

        {/* Combined shortage table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="p-3 border-b bg-slate-50/50">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Daftar Kurangan ({combined.length} warga)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="text-[11px] w-8 text-center">No</TableHead>
                  <TableHead className="text-[11px]">KK</TableHead>
                  <TableHead className="text-[11px] text-right">Bulan Lalu</TableHead>
                  <TableHead className="text-[11px] text-right">Periode Ini</TableHead>
                  <TableHead className="text-[11px] text-right">Total Kurang</TableHead>
                  <TableHead className="text-[11px] text-right w-28">Bayar</TableHead>
                  <TableHead className="text-[11px] text-center w-16">Catat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combined.map((s, idx) => {
                  const key = `combined-${s.familyId}`;
                  const inputVal = collectInputs[key] ?? String(s.totalShortage);
                  const inputNum = parseInt(inputVal.replace(/\D/g, '')) || 0;
                  const isSubmitting = submittingKey === key;
                  const isSettled = s.totalShortage <= 0;

                  return (
                    <TableRow key={key} className={isSettled ? 'bg-emerald-50/50' : ''}>
                      <TableCell className="text-xs text-slate-400 text-center">{idx + 1}</TableCell>
                      <TableCell className={`text-xs font-medium ${isSettled ? 'line-through text-slate-400' : ''}`}>
                        <div>
                          {s.familyHead}
                          {s.prevFromSelapanan && s.previousShortage > 0 && (
                            <p className="text-[9px] text-amber-500 font-normal">dari selapanan ke-{s.prevFromSelapanan}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {s.previousShortage > 0 ? (
                          <span className="text-amber-600 font-medium">{formatCurrency(s.previousShortage)}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {s.currentShortage > 0 ? (
                          <span className="text-slate-600 font-medium">{formatCurrency(s.currentShortage)}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-xs text-right font-bold ${isSettled ? 'text-emerald-600 line-through' : 'text-red-600'}`}>
                        {formatCurrency(s.totalShortage)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="h-8 text-xs w-full"
                          value={inputVal}
                          placeholder="0"
                          disabled={isSettled || isSubmitting}
                          onChange={e => setCollectInputs(prev => ({ ...prev, [key]: e.target.value }))}
                          onFocus={() => {
                            if (!collectInputs[key]) {
                              setCollectInputs(prev => ({ ...prev, [key]: String(s.totalShortage) }));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          className="h-7 bg-slate-800 hover:bg-slate-700 text-white text-[10px] px-2"
                          disabled={isSettled || isSubmitting || inputNum <= 0 || inputNum > s.totalShortage}
                          onClick={() => handleCollect(key, {
                            selapananId: upcoming!.id,
                            type: 'shortage',
                            familyId: s.familyId,
                            amount: inputNum,
                          })}
                        >
                          {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Catat'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  };

  // ----------------------------------------
  // Tab 2: Setoran Ronda Grup
  // ----------------------------------------

  const renderRondaGroupTab = (recap: RecapData) => {
    const groups = recap.jimpitanByGroup;

    if (groups.length === 0) {
      return (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-6 text-center">
            <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Tidak ada data grup ronda</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="p-3 border-b bg-slate-50/50">
          <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            Setoran Ronda Grup ({groups.length} grup)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="text-[11px] w-8 text-center">No</TableHead>
                <TableHead className="text-[11px]">Grup</TableHead>
                <TableHead className="text-[11px] text-right">Target</TableHead>
                <TableHead className="text-[11px] text-right">Sudah Tercatat</TableHead>
                <TableHead className="text-[11px] text-right w-28">Input Nominal</TableHead>
                <TableHead className="text-[11px] text-center w-16">Catat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g, idx) => {
                const key = `rg-${g.groupId}`;
                const remaining = g.totalExpected - g.totalPaid;
                const inputVal = collectInputs[key] ?? String(Math.max(0, remaining));
                const inputNum = parseInt(inputVal.replace(/\D/g, '')) || 0;
                const isSubmitting = submittingKey === key;
                const isComplete = remaining <= 0;

                return (
                  <TableRow key={g.groupId} className={isComplete ? 'bg-emerald-50/50' : ''}>
                    <TableCell className="text-xs text-slate-400 text-center">{idx + 1}</TableCell>
                    <TableCell className={`text-xs font-medium ${isComplete ? 'line-through text-slate-400' : ''}`}>
                      {g.groupName}
                    </TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(g.totalExpected)}</TableCell>
                    <TableCell className={`text-xs text-right font-medium ${isComplete ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {formatCurrency(g.totalPaid)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="h-8 text-xs w-full"
                        value={inputVal}
                        placeholder="0"
                        disabled={isComplete || isSubmitting}
                        onChange={e => setCollectInputs(prev => ({ ...prev, [key]: e.target.value }))}
                        onFocus={() => {
                          if (!collectInputs[key]) {
                            setCollectInputs(prev => ({ ...prev, [key]: String(Math.max(0, remaining)) }));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        className="h-7 bg-slate-800 hover:bg-slate-700 text-white text-[10px] px-2"
                        disabled={isComplete || isSubmitting || inputNum <= 0}
                        onClick={() => handleCollect(key, {
                          selapananId: upcoming!.id,
                          type: 'ronda_group_setoran',
                          familyId: g.groupId,
                          amount: inputNum,
                        })}
                      >
                        {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Catat'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // ----------------------------------------
  // Tab 3: Iuran Bulanan
  // ----------------------------------------

  const renderMonthlyTab = (recap: RecapData) => {
    const payers = recap.monthlyPayers;

    if (payers.length === 0) {
      return (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-6 text-center">
            <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Tidak ada warga iuran bulanan</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="p-3 border-b bg-slate-50/50">
          <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" />
            Iuran Bulanan ({payers.length} warga)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="text-[11px] w-8 text-center">No</TableHead>
                <TableHead className="text-[11px]">KK</TableHead>
                <TableHead className="text-[11px] text-right">Iuran/Bulan</TableHead>
                <TableHead className="text-[11px] text-center">Bulan</TableHead>
                <TableHead className="text-[11px] text-right">Total</TableHead>
                <TableHead className="text-[11px] text-right w-28">Input Nominal</TableHead>
                <TableHead className="text-[11px] text-center w-16">Catat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payers.map((m, idx) => {
                const key = `monthly-${m.familyId}`;
                const inputVal = collectInputs[key] ?? String(m.totalDue);
                const inputNum = parseInt(inputVal.replace(/\D/g, '')) || 0;
                const isSubmitting = submittingKey === key;

                return (
                  <TableRow key={m.familyId}>
                    <TableCell className="text-xs text-slate-400 text-center">{idx + 1}</TableCell>
                    <TableCell className="text-xs font-medium">{m.familyHead}</TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(m.amount)}</TableCell>
                    <TableCell className="text-xs text-center">{m.monthsSpanned}x</TableCell>
                    <TableCell className="text-xs text-right font-medium">{formatCurrency(m.totalDue)}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="h-8 text-xs w-full"
                        value={inputVal}
                        placeholder="0"
                        disabled={isSubmitting}
                        onChange={e => setCollectInputs(prev => ({ ...prev, [key]: e.target.value }))}
                        onFocus={() => {
                          if (!collectInputs[key]) {
                            setCollectInputs(prev => ({ ...prev, [key]: String(m.totalDue) }));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        className="h-7 bg-slate-800 hover:bg-slate-700 text-white text-[10px] px-2"
                        disabled={isSubmitting || inputNum <= 0}
                        onClick={() => handleCollect(key, {
                          selapananId: upcoming!.id,
                          type: 'monthly_iuran',
                          familyId: m.familyId,
                          amount: inputNum,
                        })}
                      >
                        {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Catat'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // ----------------------------------------
  // Tab 4: Iuran Ronda & Lainnya
  // ----------------------------------------

  const renderRondaLevyFineTab = (recap: RecapData) => {
    const rondaFees = recap.rondaFees;
    const allLevyItems = recap.customLevies.flatMap(l =>
      l.items.filter(i => i.status !== 'COMPLETED').map(i => ({
        ...i,
        levyId: l.id,
        levyName: l.name,
      }))
    );
    const unpaidFines = recap.fines.filter(f => f.status === 'UNPAID');

    return (
      <div className="space-y-4">
        {/* Section A: Iuran Ronda */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="p-3 border-b bg-slate-50/50">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              Iuran Ronda ({rondaFees.length} warga)
            </h3>
          </div>
          {rondaFees.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-400">Tidak ada warga bayar iuran ronda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="text-[11px] w-8 text-center">No</TableHead>
                    <TableHead className="text-[11px]">KK</TableHead>
                    <TableHead className="text-[11px] text-right">Iuran</TableHead>
                    <TableHead className="text-[11px] text-right w-28">Input Nominal</TableHead>
                    <TableHead className="text-[11px] text-center w-16">Catat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rondaFees.map((r, idx) => {
                    const key = `ronda-${r.familyId}`;
                    const inputVal = collectInputs[key] ?? String(r.rondaFee);
                    const inputNum = parseInt(inputVal.replace(/\D/g, '')) || 0;
                    const isSubmitting = submittingKey === key;

                    return (
                      <TableRow key={r.familyId}>
                        <TableCell className="text-xs text-slate-400 text-center">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{r.familyHead}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(r.rondaFee)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="h-8 text-xs w-full"
                            value={inputVal}
                            placeholder="0"
                            disabled={isSubmitting}
                            onChange={e => setCollectInputs(prev => ({ ...prev, [key]: e.target.value }))}
                            onFocus={() => {
                              if (!collectInputs[key]) {
                                setCollectInputs(prev => ({ ...prev, [key]: String(r.rondaFee) }));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            className="h-7 bg-slate-800 hover:bg-slate-700 text-white text-[10px] px-2"
                            disabled={isSubmitting || inputNum <= 0}
                            onClick={() => handleCollect(key, {
                              selapananId: upcoming!.id,
                              type: 'ronda_iuran',
                              familyId: r.familyId,
                              amount: inputNum,
                            })}
                          >
                            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Catat'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Section B: Tarikan Lain */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="p-3 border-b bg-slate-50/50">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              Tarikan Lain ({allLevyItems.length} item)
            </h3>
          </div>
          {allLevyItems.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-400">Tidak ada tarikan lain aktif</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="text-[11px] w-8 text-center">No</TableHead>
                    <TableHead className="text-[11px]">Program</TableHead>
                    <TableHead className="text-[11px]">KK</TableHead>
                    <TableHead className="text-[11px] text-right">Per Cicilan</TableHead>
                    <TableHead className="text-[11px] text-right">Sisa</TableHead>
                    <TableHead className="text-[11px] text-right w-28">Input Nominal</TableHead>
                    <TableHead className="text-[11px] text-center w-16">Catat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allLevyItems.map((item, idx) => {
                    const key = `levy-${item.id || item.familyId}-${item.levyId}`;
                    const remaining = item.remaining ?? (item.totalAmount - item.paidAmount);
                    const inputVal = collectInputs[key] ?? String(item.nextInstallment);
                    const inputNum = parseInt(inputVal.replace(/\D/g, '')) || 0;
                    const isSubmitting = submittingKey === key;

                    return (
                      <TableRow key={key}>
                        <TableCell className="text-xs text-slate-400 text-center">{idx + 1}</TableCell>
                        <TableCell className="text-xs text-slate-600">{item.levyName}</TableCell>
                        <TableCell className="text-xs font-medium">{item.familyHead}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(item.nextInstallment)}</TableCell>
                        <TableCell className="text-xs text-right text-amber-600">{formatCurrency(remaining)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="h-8 text-xs w-full"
                            value={inputVal}
                            placeholder="0"
                            disabled={isSubmitting}
                            onChange={e => setCollectInputs(prev => ({ ...prev, [key]: e.target.value }))}
                            onFocus={() => {
                              if (!collectInputs[key]) {
                                setCollectInputs(prev => ({ ...prev, [key]: String(item.nextInstallment) }));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            className="h-7 bg-slate-800 hover:bg-slate-700 text-white text-[10px] px-2"
                            disabled={isSubmitting || inputNum <= 0}
                            onClick={() => handleCollect(key, {
                              selapananId: upcoming!.id,
                              type: 'levy',
                              familyId: item.familyId,
                              amount: inputNum,
                              levyItemId: item.id,
                            })}
                          >
                            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Catat'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Section C: Denda */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="p-3 border-b bg-slate-50/50">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              Denda ({unpaidFines.length} belum bayar)
            </h3>
          </div>
          {unpaidFines.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-400">Tidak ada denda yang belum dibayar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="text-[11px] w-8 text-center">No</TableHead>
                    <TableHead className="text-[11px]">KK</TableHead>
                    <TableHead className="text-[11px]">Jenis</TableHead>
                    <TableHead className="text-[11px] text-right">Jumlah</TableHead>
                    <TableHead className="text-[11px]">Alasan</TableHead>
                    <TableHead className="text-[11px] text-center w-16">Lunas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaidFines.map((fine, idx) => {
                    const key = `fine-${fine.id}`;
                    const isSubmitting = submittingKey === key;

                    return (
                      <TableRow key={fine.id}>
                        <TableCell className="text-xs text-slate-400 text-center">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{fine.familyHead}</TableCell>
                        <TableCell className="text-xs">{fine.type}</TableCell>
                        <TableCell className="text-xs text-right text-red-600 font-medium">{formatCurrency(fine.amount)}</TableCell>
                        <TableCell className="text-xs text-slate-500">{fine.reason}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            className="h-7 bg-slate-800 hover:bg-slate-700 text-white text-[10px] px-2"
                            disabled={isSubmitting}
                            onClick={() => handleCollect(key, {
                              selapananId: upcoming!.id,
                              type: 'fine',
                              fineId: fine.id,
                              amount: fine.amount,
                            })}
                          >
                            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Lunas'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------
  // Render: History Table
  // ----------------------------------------

  const renderHistory = () => {
    const pastSelapanan = selapananList.filter(s => s.status === 'COMPLETED');
    if (pastSelapanan.length === 0) return null;

    return (
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            Riwayat Selapanan
          </h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="text-xs font-semibold w-10 text-center">No</TableHead>
                <TableHead className="text-xs font-semibold">Periode</TableHead>
                <TableHead className="text-xs font-semibold">Rapat</TableHead>
                <TableHead className="text-xs font-semibold text-right">Jimpitan</TableHead>
                <TableHead className="text-xs font-semibold text-right">Bulanan</TableHead>
                <TableHead className="text-xs font-semibold text-right">Ronda</TableHead>
                <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                <TableHead className="text-xs font-semibold w-20 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastSelapanan.map(s => (
                <TableRow key={s.id} className="hover:bg-slate-50/50">
                  <TableCell className="text-xs text-slate-400 text-center">{s.number}</TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {formatDateShort(s.periodeStart)} — {formatDateShort(s.periodeEnd)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{formatDateShort(s.meetingDate)}</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(s.jimpitanDaily)}</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(s.jimpitanMonthly)}</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(s.rondaFeeTotal)}</TableCell>
                  <TableCell className="text-xs text-right font-semibold text-emerald-700">{formatCurrency(s.totalIncome)}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-[9px] ${STATUS_COLORS[s.status] || ''}`}>
                      {SELAPANAN_STATUS_LABELS[s.status] || s.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // ----------------------------------------
  // Main Render
  // ----------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="hidden lg:flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Selapanan</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {collectionMode
              ? 'Mode Pengumpulan — Catat pembayaran warga'
              : 'Rapat RT setiap 35 hari (Sabtu malam Minggu Pon)'
            }
          </p>
        </div>
        {isAdmin && !collectionMode && (
          <Button
            size="sm"
            className="h-9 bg-slate-800 hover:bg-slate-700 text-white text-xs"
            onClick={() => { handleAutoGenerate(); setCreateOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Buat Selapanan
          </Button>
        )}
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Selapanan</h2>
          <p className="text-xs text-slate-500">
            {collectionMode ? 'Mode Pengumpulan' : 'Rapat RT setiap 35 hari'}
          </p>
        </div>
        {isAdmin && !collectionMode && (
          <Button
            size="sm"
            className="h-9 bg-slate-800 hover:bg-slate-700 text-white text-xs"
            onClick={() => { handleAutoGenerate(); setCreateOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Buat
          </Button>
        )}
      </div>

      {/* Collection Mode or Preview Mode */}
      {collectionMode ? (
        renderCollectionMode()
      ) : (
        <>
          {/* Stats */}
          {renderStats()}

          {/* Current Period */}
          {renderCurrentPeriod()}

          {/* History */}
          {renderHistory()}
        </>
      )}

      {/* ============================================ */}
      {/* CREATE DIALOG */}
      {/* ============================================ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-800">Buat Selapanan Baru</DialogTitle>
            <DialogDescription>Isi data periode selapanan berikutnya</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Button type="button" variant="outline" size="sm" onClick={handleAutoGenerate} className="mb-2">
              <Calendar className="w-4 h-4 mr-1" />
              Auto-generate Periode
            </Button>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Nomor Selapanan</Label>
                <Input
                  type="number"
                  value={form.number}
                  onChange={e => setForm({ ...form, number: parseInt(e.target.value) || 0 })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Tanggal Rapat</Label>
                <Input
                  type="date"
                  value={form.meetingDate}
                  onChange={e => setForm({ ...form, meetingDate: e.target.value })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Periode Mulai</Label>
                <Input
                  type="date"
                  value={form.periodeStart}
                  onChange={e => setForm({ ...form, periodeStart: e.target.value })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Periode Selesai</Label>
                <Input
                  type="date"
                  value={form.periodeEnd}
                  onChange={e => setForm({ ...form, periodeEnd: e.target.value })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Lokasi Rapat</Label>
              <Input
                placeholder="Contoh: Balai RT"
                value={form.meetingLocation}
                onChange={e => setForm({ ...form, meetingLocation: e.target.value })}
                className="h-10 rounded-lg border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Catatan</Label>
              <Input
                placeholder="Catatan tambahan (opsional)"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="h-10 rounded-lg border-slate-200"
              />
            </div>

            {/* Agenda Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-slate-700">Agenda Rapat</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setAgendaItems([...agendaItems, { agenda: '', decisions: '', notes: '' }])}>
                  <Plus className="w-3 h-3 mr-1" />
                  Tambah
                </Button>
              </div>
              {agendaItems.map((item, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Judul agenda"
                      value={item.agenda}
                      onChange={e => { const u = [...agendaItems]; u[idx] = { ...u[idx], agenda: e.target.value }; setAgendaItems(u); }}
                      className="h-9 text-sm rounded-lg border-slate-200"
                    />
                    {agendaItems.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setAgendaItems(agendaItems.filter((_, i) => i !== idx))} className="h-9 w-9 p-0 shrink-0 text-red-500 hover:text-red-700">✕</Button>
                    )}
                  </div>
                  <Input placeholder="Keputusan (opsional)" value={item.decisions} onChange={e => { const u = [...agendaItems]; u[idx] = { ...u[idx], decisions: e.target.value }; setAgendaItems(u); }} className="h-9 text-sm rounded-lg border-slate-200" />
                  <Input placeholder="Catatan (opsional)" value={item.notes} onChange={e => { const u = [...agendaItems]; u[idx] = { ...u[idx], notes: e.target.value }; setAgendaItems(u); }} className="h-9 text-sm rounded-lg border-slate-200" />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setCreateOpen(false)} disabled={saving}>Batal</Button>
            <Button className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg" onClick={handleCreate} disabled={saving || !form.number || !form.meetingDate}>
              {saving ? 'Menyimpan...' : 'Buat Selapanan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* COMPLETE CONFIRM DIALOG */}
      {/* ============================================ */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-800">Selesaikan Selapanan</DialogTitle>
            <DialogDescription>
              Semua pemasukan akan direkap dan dicatat sebagai transaksi. Kurangan yang belum dibayar akan diakumulasi ke selapanan berikutnya.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setCompleteOpen(false)} disabled={completing}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg" onClick={handleComplete} disabled={completing}>
              {completing ? 'Memproses...' : 'Ya, Selesaikan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}
