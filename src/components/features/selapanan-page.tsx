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
  Eye,
  TrendingUp,
  FileDown,
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
  const [collectionTab, setCollectionTab] = useState('tarikan');
  const [collectInputs, setCollectInputs] = useState<Record<string, string>>({});
  const [collectNotes, setCollectNotes] = useState<Record<string, string>>({});
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [sessionCollected, setSessionCollected] = useState(0);

  // Tarikan warga state (consolidated per-family view)
  const [tarikanData, setTarikanData] = useState<{
    selapanan: { id: string; number: number; periodeStart: string; periodeEnd: string; meetingDate: string };
    monthsSpanned: number;
    daysElapsed: number;
    jimpitanAmount: number;
    tarikan: {
      id: string | null;
      selapananId: string;
      familyId: string;
      familyHead: string;
      jimpitanType: string;
      rondaStatus: string;
      rondaGroup: { id: string; name: string } | null;
      monthsSpanned: number;
      sisaTarikan: number;
      kuranganJimpitan: number;
      iuranBulanan: number;
      iuranRonda: number;
      totalHarusBayar: number;
      jumlahBayar: number;
      sisaDepan: number;
      notes: string | null;
      prevFromSelapanan: number | null;
    }[];
    totals: {
      totalSisaTarikan: number;
      totalKuranganJimpitan: number;
      totalIuranBulanan: number;
      totalIuranRonda: number;
      totalHarusBayar: number;
      totalSudahBayar: number;
      totalSisaDepan: number;
      familiesWithSisa: number;
      familiesTotal: number;
    };
    prevRondaNotes: { description: string; amount: number; date: string }[];
  } | null>(null);
  const [loadingTarikan, setLoadingTarikan] = useState(false);
  const [autoRecapLoading, setAutoRecapLoading] = useState(false);

  // Daily matrix state
  const [showDailyMatrix, setShowDailyMatrix] = useState(false);
  const [dailyMatrixData, setDailyMatrixData] = useState<{
    selapanan: { id: string; number: number; periodeStart: string; periodeEnd: string; meetingDate: string; status: string };
    jimpitanAmount: number;
    dailyColumns: { date: string; dayOfWeek: number; dayName: string; nightLabel: string; weekNumber: number; dayInWeek: number; groupName: string | null; groupId: string | null }[];
    familyRows: {
      familyId: string;
      familyHead: string;
      rondaGroup: { id: string; name: string; dayOfWeek: number } | null;
      dailyData: Record<string, { paidAmount: number; shortage: number; expectedAmount: number; groupName: string | null }>;
      summary: { totalExpected: number; totalPaid: number; totalShortage: number; daysPaid: number; daysPartial: number; daysMissed: number; paymentRate: number };
    }[];
    overallSummary: { totalFamilies: number; totalDays: number; totalExpected: number; totalPaid: number; totalShortage: number; daysCollected: number; avgPaymentRate: number };
  } | null>(null);
  const [loadingDailyMatrix, setLoadingDailyMatrix] = useState(false);
  const [dailyMatrixWeek, setDailyMatrixWeek] = useState<number>(0); // 0 = all weeks
  const [exportingPdf, setExportingPdf] = useState(false);

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
  // Tarikan Warga
  // ----------------------------------------

  const fetchTarikan = useCallback(async (selapananId: string) => {
    setLoadingTarikan(true);
    try {
      // First, generate the tarikan records
      await api.post('/selapanan/tarikan', { selapananId });
      // Then fetch them
      const res = await api.get(`/selapanan/tarikan?selapananId=${selapananId}`);
      if (res.ok) {
        const data = await res.json();
        setTarikanData(data);
      } else {
        toast.error('Gagal memuat data tarikan');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setLoadingTarikan(false);
    }
  }, []);

  const handleAutoRecap = async () => {
    if (!upcoming) return;
    setAutoRecapLoading(true);
    try {
      const res = await api.post('/jimpitan/auto-recap', { selapananId: upcoming.id });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        // Refresh tarikan data to reflect new kurangan
        await fetchTarikan(upcoming.id);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Gagal generate auto-recap');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setAutoRecapLoading(false);
    }
  };

  const handleCollectTarikan = async (key: string, familyId: string, amount: number, notes?: string) => {
    setSubmittingKey(key);
    try {
      const res = await api.post('/selapanan/collect-tarikan', {
        selapananId: upcoming!.id,
        familyId,
        amount,
        notes: notes || undefined,
      });
      if (res.ok) {
        const data = await res.json();
        setSessionCollected(prev => prev + amount);
        toast.success(data.message);
        setCollectInputs(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setCollectNotes(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        // Refresh tarikan data
        await fetchTarikan(upcoming!.id);
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
    if (upcoming) {
      if (!recapMap[upcoming.id]) {
        fetchRecap(upcoming.id);
      }
      fetchTarikan(upcoming.id);
    }
    setCollectionMode(true);
    setCollectionTab('tarikan');
    setCollectInputs({});
    setCollectNotes({});
    setSessionCollected(0);
  };

  const exitCollectionMode = () => {
    setCollectionMode(false);
    setCollectInputs({});
    setCollectNotes({});
  };

  // ----------------------------------------
  // Daily Matrix
  // ----------------------------------------

  const fetchDailyMatrix = useCallback(async (selapananId: string) => {
    setLoadingDailyMatrix(true);
    try {
      const res = await api.get(`/jimpitan/selapanan-daily?selapananId=${selapananId}`);
      if (res.ok) {
        const data = await res.json();
        setDailyMatrixData(data);
        setShowDailyMatrix(true);
        setDailyMatrixWeek(0);
      } else {
        toast.error('Gagal memuat data rekap harian');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setLoadingDailyMatrix(false);
    }
  }, []);

  const exitDailyMatrix = () => {
    setShowDailyMatrix(false);
    setDailyMatrixData(null);
    setDailyMatrixWeek(0);
  };

  // ----------------------------------------
  // Export PDF
  // ----------------------------------------

  const handleExportPdf = async () => {
    if (!upcoming) return;
    setExportingPdf(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/selapanan/export-pdf?selapananId=${upcoming.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rekap_Selapanan_${upcoming.number}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('PDF Rekap Selapanan berhasil diunduh');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Gagal mengekspor PDF');
      }
    } catch {
      toast.error('Terjadi kesalahan saat mengekspor PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  // ----------------------------------------
  // Render: Daily Matrix View (35-day × families)
  // ----------------------------------------

  const renderDailyMatrix = () => {
    if (!dailyMatrixData) return null;

    const { selapanan, jimpitanAmount, dailyColumns, familyRows, overallSummary } = dailyMatrixData;
    const today = new Date().toISOString().split('T')[0];

    // Group columns by week
    const weeks: Record<number, typeof dailyColumns> = {};
    for (const col of dailyColumns) {
      if (!weeks[col.weekNumber]) weeks[col.weekNumber] = [];
      weeks[col.weekNumber].push(col);
    }

    // Filter by selected week
    const displayWeeks = dailyMatrixWeek === 0 ? weeks : { [dailyMatrixWeek]: weeks[dailyMatrixWeek] || [] };

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="rounded-xl border bg-slate-800 text-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-amber-400 text-slate-900 text-[10px] font-bold">REKAP HARIAN</Badge>
                <span className="text-slate-300 text-sm">Selapanan Ke-{selapanan.number}</span>
              </div>
              <h3 className="text-base font-bold">Kurangan Jimpitan 35 Hari</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Periode: {formatDateShort(selapanan.periodeStart)} — {formatDateShort(selapanan.periodeEnd)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Besaran/Hari</p>
              <p className="text-xl font-bold text-emerald-400">{formatCurrency(jimpitanAmount)}</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-[10px] text-slate-500 font-medium uppercase">KK Harian</p>
            <p className="text-lg font-bold text-slate-800">{overallSummary.totalFamilies}</p>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-[10px] text-slate-500 font-medium uppercase">Hari Terinput</p>
            <p className="text-lg font-bold text-slate-800">{overallSummary.daysCollected}/35</p>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-[10px] text-emerald-600 font-medium uppercase">Total Terkumpul</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(overallSummary.totalPaid)}</p>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-[10px] text-red-600 font-medium uppercase">Total Kurangan</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(overallSummary.totalShortage)}</p>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-[10px] text-slate-500 font-medium uppercase">Target</p>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(overallSummary.totalExpected)}</p>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-[10px] text-sky-600 font-medium uppercase">Rata-rata Bayar</p>
            <p className="text-lg font-bold text-sky-700">{overallSummary.avgPaymentRate}%</p>
          </div>
        </div>

        {/* Week Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">Filter Minggu:</span>
          <button
            className={`h-7 px-3 rounded-md text-xs font-medium border transition-colors ${
              dailyMatrixWeek === 0 ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
            }`}
            onClick={() => setDailyMatrixWeek(0)}
          >
            Semua
          </button>
          {[1, 2, 3, 4, 5].map(w => (
            <button
              key={w}
              className={`h-7 px-3 rounded-md text-xs font-medium border transition-colors ${
                dailyMatrixWeek === w ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
              }`}
              onClick={() => setDailyMatrixWeek(w)}
            >
              Minggu {w}
            </button>
          ))}
        </div>

        {/* "Semua" = Recap Summary, or Detailed Weekly Table */}
        {dailyMatrixWeek === 0 ? (
          /* Recap Summary for All Weeks */
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="p-3 border-b bg-slate-50/50">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                Rekap Mingguan — 35 Hari
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b">
                    <th className="text-left p-2.5 font-semibold text-slate-600 w-10">No</th>
                    <th className="text-left p-2.5 font-semibold text-slate-600 min-w-[100px]">Minggu</th>
                    <th className="text-left p-2.5 font-semibold text-slate-600 min-w-[140px]">Tanggal</th>
                    <th className="text-center p-2.5 font-semibold text-slate-600 w-14">Hari</th>
                    <th className="text-right p-2.5 font-semibold text-slate-600 min-w-[90px]">Target</th>
                    <th className="text-right p-2.5 font-semibold text-emerald-600 min-w-[90px]">Terkumpul</th>
                    <th className="text-right p-2.5 font-semibold text-red-600 min-w-[90px]">Kurangan</th>
                    <th className="text-right p-2.5 font-semibold text-sky-600 w-14">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map(weekNum => {
                    const cols = weeks[weekNum] || [];
                    if (cols.length === 0) return null;
                    const weekPaid = cols.reduce((sum, col) => sum + familyRows.reduce((s, f) => s + (f.dailyData[col.date]?.paidAmount || 0), 0), 0);
                    const weekShortage = cols.reduce((sum, col) => sum + familyRows.reduce((s, f) => s + (f.dailyData[col.date]?.shortage || 0), 0), 0);
                    const weekExpected = cols.length * jimpitanAmount * familyRows.length;
                    const weekRate = weekExpected > 0 ? Math.round((weekPaid / weekExpected) * 100) : 0;
                    const isCurrentWeek = cols.some(col => col.date === today);

                    return (
                      <tr
                        key={weekNum}
                        className={`border-b cursor-pointer hover:bg-slate-50/80 transition-colors ${isCurrentWeek ? 'bg-amber-50/50' : weekNum % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                        onClick={() => setDailyMatrixWeek(weekNum)}
                      >
                        <td className="p-2.5 text-slate-400 font-medium">{weekNum}</td>
                        <td className="p-2.5 font-semibold text-slate-800">Minggu {weekNum}</td>
                        <td className="p-2.5 text-slate-600">
                          {formatDateShort(cols[0]?.date || '')} — {formatDateShort(cols[cols.length - 1]?.date || '')}
                        </td>
                        <td className="p-2.5 text-center text-slate-500">{cols.length}</td>
                        <td className="p-2.5 text-right text-slate-700">{formatCurrency(weekExpected)}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-700">{formatCurrency(weekPaid)}</td>
                        <td className={`p-2.5 text-right font-bold ${weekShortage > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {weekShortage > 0 ? formatCurrency(weekShortage) : '✓'}
                        </td>
                        <td className={`p-2.5 text-right font-bold ${weekRate >= 80 ? 'text-emerald-600' : weekRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {weekRate}%
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total Row */}
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                    <td className="p-2.5 text-slate-500" colSpan={3}>TOTAL 35 HARI</td>
                    <td className="p-2.5 text-center text-slate-600">{dailyColumns.length}</td>
                    <td className="p-2.5 text-right text-slate-700">{formatCurrency(overallSummary.totalExpected)}</td>
                    <td className="p-2.5 text-right text-emerald-700">{formatCurrency(overallSummary.totalPaid)}</td>
                    <td className={`p-2.5 text-right ${overallSummary.totalShortage > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {overallSummary.totalShortage > 0 ? formatCurrency(overallSummary.totalShortage) : '✓'}
                    </td>
                    <td className={`p-2.5 text-right ${overallSummary.avgPaymentRate >= 80 ? 'text-emerald-600' : overallSummary.avgPaymentRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {overallSummary.avgPaymentRate}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-2.5 border-t bg-slate-50/50 text-center">
              <p className="text-[10px] text-slate-400">Klik baris minggu untuk melihat detail harian per warga</p>
            </div>
          </div>
        ) : (
          /* Detailed Weekly Table for Selected Week */
          Object.entries(displayWeeks).map(([weekNum, cols]) => (
            <div key={weekNum} className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Minggu {weekNum} ({formatDateShort(cols[0]?.date || '')} — {formatDateShort(cols[cols.length - 1]?.date || '')})
              </h4>
              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b">
                        <th className="text-left p-2 min-w-[120px] sticky left-0 bg-slate-50 z-10 font-semibold text-slate-600">Nama KK</th>
                        {cols.map(col => {
                          const isToday = col.date === today;
                          const isFuture = col.date > today;
                          return (
                            <th
                              key={col.date}
                              className={`text-center p-1.5 min-w-[52px] font-medium ${
                                isToday ? 'bg-amber-100 text-amber-800' : isFuture ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              <div className="text-[9px]">{col.nightLabel}</div>
                              <div className="text-[10px] font-bold">{col.date.slice(8)}</div>
                              {col.groupName && (
                                <div className="text-[8px] text-slate-400 mt-0.5">G{col.dayOfWeek + 1}</div>
                              )}
                            </th>
                          );
                        })}
                        <th className="text-right p-2 min-w-[50px] font-semibold text-emerald-600 bg-slate-50">Lunas</th>
                        <th className="text-right p-2 min-w-[50px] font-semibold text-red-600 bg-slate-50">Kurang</th>
                        <th className="text-right p-2 min-w-[44px] font-semibold text-sky-600 bg-slate-50">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {familyRows.map((family, idx) => {
                        const weekCols = cols;
                        const weekPaid = weekCols.reduce((sum, col) => sum + (family.dailyData[col.date]?.paidAmount || 0), 0);
                        const weekShortage = weekCols.reduce((sum, col) => sum + (family.dailyData[col.date]?.shortage || 0), 0);
                        const weekExpected = weekCols.length * jimpitanAmount;
                        const weekRate = weekExpected > 0 ? Math.round((weekPaid / weekExpected) * 100) : 0;

                        return (
                          <tr key={family.familyId} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                            <td className="p-2 font-medium text-slate-800 sticky left-0 bg-inherit z-10 truncate max-w-[120px]" title={family.familyHead}>
                              <span className="text-[11px]">{family.familyHead}</span>
                            </td>
                            {weekCols.map(col => {
                              const data = family.dailyData[col.date];
                              const isToday = col.date === today;
                              const isFuture = col.date > today;
                              const paid = data?.paidAmount ?? 0;
                              const shortage = data?.shortage ?? (isFuture ? 0 : jimpitanAmount);

                              let cellBg = 'bg-white';
                              let cellText = '';
                              let cellContent = '';

                              if (isFuture) {
                                cellBg = 'bg-slate-50';
                                cellContent = '—';
                                cellText = 'text-slate-300';
                              } else if (paid >= jimpitanAmount) {
                                cellBg = 'bg-emerald-50';
                                cellContent = '✓';
                                cellText = 'text-emerald-600';
                              } else if (paid > 0) {
                                cellBg = 'bg-amber-50';
                                cellContent = `${paid >= 1000 ? '1rb' : paid >= 500 ? '5r' : paid}`;
                                cellText = 'text-amber-700';
                              } else {
                                cellBg = 'bg-red-50';
                                cellContent = '✗';
                                cellText = 'text-red-500';
                              }

                              return (
                                <td
                                  key={col.date}
                                  className={`text-center p-1 ${cellBg} ${cellText} ${isToday ? 'ring-1 ring-amber-400' : ''} font-medium`}
                                  title={`${family.familyHead} — ${col.date}: ${isFuture ? 'Belum' : `Bayar ${formatCurrency(paid)}, Kurang ${formatCurrency(shortage)}`}`}
                                >
                                  <span className="text-[10px]">{cellContent}</span>
                                </td>
                              );
                            })}
                            <td className="text-right p-2 font-bold text-emerald-700">{formatCurrency(weekPaid)}</td>
                            <td className={`text-right p-2 font-bold ${weekShortage > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                              {weekShortage > 0 ? formatCurrency(weekShortage) : '—'}
                            </td>
                            <td className={`text-right p-2 font-bold ${weekRate >= 80 ? 'text-emerald-600' : weekRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {weekRate}%
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total Row */}
                      <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                        <td className="p-2 sticky left-0 bg-slate-100 z-10 text-slate-700">TOTAL</td>
                        {cols.map(col => {
                          const dayPaid = familyRows.reduce((sum, f) => sum + (f.dailyData[col.date]?.paidAmount || 0), 0);
                          const isFuture = col.date > today;
                          return (
                            <td key={col.date} className={`text-center p-1 ${isFuture ? 'text-slate-300' : 'text-emerald-700'}`}>
                              <span className="text-[9px]">{isFuture ? '—' : formatCurrency(dayPaid)}</span>
                            </td>
                          );
                        })}
                        <td className="text-right p-2 text-emerald-700">
                          {formatCurrency(cols.reduce((sum, col) => sum + familyRows.reduce((s, f) => s + (f.dailyData[col.date]?.paidAmount || 0), 0), 0))}
                        </td>
                        <td className="text-right p-2 text-red-600">
                          {formatCurrency(cols.reduce((sum, col) => sum + familyRows.reduce((s, f) => s + (f.dailyData[col.date]?.shortage || 0), 0), 0))}
                        </td>
                        <td className="text-right p-2 text-sky-700">
                          {(() => {
                            const totalExp = cols.length * jimpitanAmount * familyRows.length;
                            const totalPd = cols.reduce((sum, col) => sum + familyRows.reduce((s, f) => s + (f.dailyData[col.date]?.paidAmount || 0), 0), 0);
                            return totalExp > 0 ? Math.round((totalPd / totalExp) * 100) : 0;
                          })()}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap text-[10px] text-slate-500 px-1">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200 inline-block" /> Lunas (Rp.1.000)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" /> Sebagian (&lt;Rp.1.000)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" /> Tidak Bayar</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-50 border border-slate-200 inline-block" /> Belum terjadi</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-1 ring-amber-400 inline-block" /> Hari ini</span>
        </div>

        {/* Back Button */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs"
            onClick={exitDailyMatrix}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Kembali ke Selapanan
          </Button>
          <Button
            size="sm"
            className="h-9 bg-slate-800 hover:bg-slate-700 text-white text-xs"
            onClick={() => fetchDailyMatrix(selapanan.id)}
            disabled={loadingDailyMatrix}
          >
            <Loader2 className={`w-3.5 h-3.5 mr-1 ${loadingDailyMatrix ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>
    );
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
            {/* Quick access to Daily Matrix - always visible */}
            {isAdmin && (
              <div className="mb-4">
                <Button
                  size="sm"
                  className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-lg"
                  onClick={() => fetchDailyMatrix(upcoming.id)}
                  disabled={loadingDailyMatrix}
                >
                  {loadingDailyMatrix ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                  Lihat Rekap Harian 35 Hari — Kurangan Jimpitan per Warga per Hari
                </Button>
              </div>
            )}

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
                  <div className="flex items-center gap-2 pt-3 border-t flex-wrap">
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
                      className="h-9 bg-teal-600 hover:bg-teal-700 text-white text-xs"
                      onClick={() => fetchDailyMatrix(upcoming.id)}
                      disabled={loadingDailyMatrix}
                    >
                      {loadingDailyMatrix ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                      Rekap Harian 35 Hari
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs border-slate-300"
                      onClick={handleExportPdf}
                      disabled={exportingPdf}
                    >
                      {exportingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1" />}
                      Export PDF
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
              <p className="text-xs text-slate-400 mt-0.5">Tarikan warga, setoran ronda, denda & lainnya</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Terkumpul Hari Ini</p>
              <p className="text-xl font-bold text-emerald-400">{formatCurrency(sessionCollected)}</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[9px] text-slate-300 hover:text-white hover:bg-slate-700 mt-1"
                onClick={handleAutoRecap}
                disabled={autoRecapLoading}
              >
                <Loader2 className={`w-3 h-3 mr-1 ${autoRecapLoading ? 'animate-spin' : ''}`} />
                Rekap Harian
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={collectionTab} onValueChange={setCollectionTab}>
          <TabsList className="w-full flex h-auto flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="tarikan" className="text-xs flex-1 min-w-0 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              <HandCoins className="w-3.5 h-3.5 mr-1 text-amber-500" />
              <span className="hidden sm:inline">Tarikan Warga</span>
              <span className="sm:hidden">Tarikan</span>
            </TabsTrigger>
            <TabsTrigger value="ronda-group" className="text-xs flex-1 min-w-0 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              <Shield className="w-3.5 h-3.5 mr-1 text-slate-500" />
              <span className="hidden sm:inline">Setoran Ronda</span>
              <span className="sm:hidden">Ronda</span>
            </TabsTrigger>
            <TabsTrigger value="ronda-levy-fine" className="text-xs flex-1 min-w-0 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
              <Banknote className="w-3.5 h-3.5 mr-1 text-slate-500" />
              <span className="hidden sm:inline">Denda & Lainnya</span>
              <span className="sm:hidden">Lainnya</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Tarikan Warga */}
          <TabsContent value="tarikan">
            {renderTarikanWargaTab()}
          </TabsContent>

          {/* Tab 2: Setoran Ronda Grup */}
          <TabsContent value="ronda-group">
            {renderRondaGroupTab(recap)}
          </TabsContent>

          {/* Tab 3: Denda & Lainnya */}
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
                className="h-9 text-xs border-slate-300"
                onClick={handleExportPdf}
                disabled={exportingPdf}
              >
                {exportingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1" />}
                PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs"
                onClick={exitCollectionMode}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Kembali
              </Button>
              <Button
                size="sm"
                className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                onClick={() => { setCompletingId(upcoming.id); setCompleteOpen(true); }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Selesai
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ----------------------------------------
  // Tab 1: Tarikan Warga (Consolidated Per-Family View)
  // ----------------------------------------

  const renderTarikanWargaTab = () => {
    if (loadingTarikan && !tarikanData) {
      return (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Memuat data tarikan warga...</p>
          </CardContent>
        </Card>
      );
    }

    if (!tarikanData) {
      return (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-8 text-center">
            <HandCoins className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Data tarikan belum dimuat</p>
            <Button size="sm" className="mt-3 bg-slate-800 hover:bg-slate-700 text-white text-xs" onClick={() => upcoming && fetchTarikan(upcoming.id)}>
              Muat Tarikan
            </Button>
          </CardContent>
        </Card>
      );
    }

    const { tarikan, totals, monthsSpanned } = tarikanData;

    if (tarikan.length === 0) {
      return (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Tidak ada data tarikan</p>
          </CardContent>
        </Card>
      );
    }

    const { daysElapsed = 0, jimpitanAmount = 1000 } = tarikanData;

    return (
      <div className="space-y-3">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div className="rounded-lg border bg-slate-50 p-2.5">
            <p className="text-[9px] text-slate-500 font-medium uppercase">Total Harus Bayar</p>
            <p className="text-sm font-bold text-slate-800">{formatCurrency(totals.totalHarusBayar)}</p>
          </div>
          <div className="rounded-lg border bg-emerald-50 p-2.5">
            <p className="text-[9px] text-emerald-600 font-medium uppercase">Sudah Dibayar</p>
            <p className="text-sm font-bold text-emerald-700">{formatCurrency(totals.totalSudahBayar)}</p>
          </div>
          <div className="rounded-lg border bg-red-50 p-2.5">
            <p className="text-[9px] text-red-600 font-medium uppercase">Sisa Belum Bayar</p>
            <p className="text-sm font-bold text-red-700">{formatCurrency(totals.totalSisaDepan)}</p>
          </div>
          <div className="rounded-lg border bg-amber-50 p-2.5">
            <p className="text-[9px] text-amber-600 font-medium uppercase">KK Dengan Sisa</p>
            <p className="text-sm font-bold text-amber-700">{totals.familiesWithSisa}/{totals.familiesTotal}</p>
          </div>
          <div className="rounded-lg border bg-sky-50 p-2.5">
            <p className="text-[9px] text-sky-600 font-medium uppercase">Hari Ke / 35</p>
            <p className="text-sm font-bold text-sky-700">{daysElapsed}/35</p>
            <p className="text-[8px] text-sky-400">{formatCurrency(jimpitanAmount)}/hari</p>
          </div>
          <div className="rounded-lg border bg-violet-50 p-2.5">
            <p className="text-[9px] text-violet-600 font-medium uppercase">Bulan Ditempuh</p>
            <p className="text-sm font-bold text-violet-700">{monthsSpanned} bln</p>
          </div>
        </div>

        {/* Consolidated Family Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="p-2.5 border-b bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <HandCoins className="w-3.5 h-3.5 text-amber-500" />
              Tarikan Warga ({tarikan.length} KK)
            </h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] text-slate-500 hover:text-slate-700"
              onClick={() => upcoming && fetchTarikan(upcoming.id)}
              disabled={loadingTarikan}
            >
              <Loader2 className={`w-3 h-3 mr-1 ${loadingTarikan ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b">
                  <th className="text-left p-2 font-semibold text-slate-600 w-8 text-center">No</th>
                  <th className="text-left p-2 font-semibold text-slate-600 min-w-[100px]">Nama KK</th>
                  <th className="text-right p-2 font-semibold text-red-600 min-w-[70px]">Sisa</th>
                  <th className="text-right p-2 font-semibold text-amber-600 min-w-[70px]">Jimpitan</th>
                  <th className="text-right p-2 font-semibold text-slate-600 min-w-[70px]">Iuran Bulanan</th>
                  <th className="text-right p-2 font-semibold text-slate-600 min-w-[65px]">Iuran Ronda</th>
                  <th className="text-right p-2 font-semibold text-slate-800 min-w-[80px]">Total Bayar</th>
                  <th className="text-right p-2 font-semibold text-emerald-600 min-w-[75px]">Bayar</th>
                  <th className="text-right p-2 font-semibold text-red-600 min-w-[75px]">Sisa Depan</th>
                  <th className="text-center p-2 font-semibold text-slate-600 w-14">Catat</th>
                </tr>
              </thead>
              <tbody>
                {tarikan.map((t, idx) => {
                  const key = `tarikan-${t.familyId}`;
                  const inputVal = collectInputs[key] ?? String(t.sisaDepan);
                  const inputNum = parseInt(inputVal.replace(/\D/g, '')) || 0;
                  const isSubmitting = submittingKey === key;
                  const isLunas = t.jumlahBayar >= t.totalHarusBayar && t.totalHarusBayar > 0;
                  const liveSisaDepan = t.totalHarusBayar - t.jumlahBayar - inputNum;
                  const hasSisa = t.sisaDepan > 0;
                  const noteVal = collectNotes[key] ?? '';

                  return (
                    <tr
                      key={key}
                      className={`border-b ${isLunas ? 'bg-emerald-50/50' : hasSisa ? 'bg-red-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                    >
                      <td className="p-2 text-slate-400 text-center">{idx + 1}</td>
                      <td className="p-2 font-medium text-slate-800">
                        <div>
                          <span className="text-[11px]">{t.familyHead}</span>
                          {isLunas && (
                            <Badge className="ml-1 text-[8px] bg-emerald-100 text-emerald-700 px-1 py-0">✓ LUNAS</Badge>
                          )}
                          {t.jimpitanType === 'BULANAN' && t.rondaGroup && (
                            <p className="text-[9px] text-slate-400 font-normal">{t.rondaGroup.name}</p>
                          )}
                          {t.jimpitanType === 'HARIAN' && t.rondaGroup && (
                            <p className="text-[9px] text-slate-400 font-normal">{t.rondaGroup.name}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        {t.sisaTarikan > 0 ? (
                          <div>
                            <span className="text-red-600 font-medium">{formatCurrency(t.sisaTarikan)}</span>
                            {t.prevFromSelapanan && (
                              <p className="text-[8px] text-red-400 font-normal">dari selapanan ke-{t.prevFromSelapanan}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {t.jimpitanType === 'HARIAN' && t.kuranganJimpitan > 0 ? (
                          <div>
                            <span className="text-amber-600 font-medium">{formatCurrency(t.kuranganJimpitan)}</span>
                            <p className="text-[8px] text-amber-400 font-normal">{daysElapsed}×{formatCurrency(jimpitanAmount)}</p>
                          </div>
                        ) : t.jimpitanType === 'HARIAN' ? (
                          <span className="text-emerald-500 text-[10px]">✓ Lunas</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {t.jimpitanType === 'BULANAN' && t.iuranBulanan > 0 ? (
                          <div>
                            <span className="text-slate-700 font-medium">{formatCurrency(t.iuranBulanan)}</span>
                            <p className="text-[8px] text-slate-400 font-normal">×{t.monthsSpanned} bln</p>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {t.rondaStatus === 'BAYAR_IURAN' && t.iuranRonda > 0 ? (
                          <span className="text-sky-600 font-medium">{formatCurrency(t.iuranRonda)}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-bold text-slate-800">
                        {formatCurrency(t.totalHarusBayar)}
                      </td>
                      <td className="p-2 text-right">
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="h-7 text-[11px] w-full min-w-[70px]"
                          value={inputVal}
                          placeholder="0"
                          disabled={isLunas || isSubmitting}
                          onChange={e => setCollectInputs(prev => ({ ...prev, [key]: e.target.value }))}
                          onFocus={() => {
                            if (!collectInputs[key]) {
                              setCollectInputs(prev => ({ ...prev, [key]: String(t.sisaDepan) }));
                            }
                          }}
                        />
                        {/* Collapsible notes input */}
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <button className="text-[9px] text-slate-400 hover:text-slate-600 mt-0.5 flex items-center gap-0.5">
                              {noteVal ? <span className="text-amber-600">📝</span> : <span>📝 Catatan</span>}
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <Input
                              type="text"
                              className="h-6 text-[10px] w-full mt-1"
                              value={noteVal}
                              placeholder="Catatan..."
                              disabled={isLunas || isSubmitting}
                              onChange={e => setCollectNotes(prev => ({ ...prev, [key]: e.target.value }))}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      </td>
                      <td className={`p-2 text-right font-bold ${liveSisaDepan > 0 ? 'text-red-600' : liveSisaDepan === 0 ? 'text-emerald-600' : 'text-emerald-600'}`}>
                        {liveSisaDepan > 0 ? formatCurrency(liveSisaDepan) : '✓'}
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          size="sm"
                          className="h-6 bg-slate-800 hover:bg-slate-700 text-white text-[9px] px-1.5 min-w-[40px]"
                          disabled={isLunas || isSubmitting || inputNum <= 0}
                          onClick={() => handleCollectTarikan(key, t.familyId, inputNum, noteVal || undefined)}
                        >
                          {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Catat'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals Row */}
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                  <td className="p-2 text-slate-500" colSpan={2}>TOTAL</td>
                  <td className="p-2 text-right text-red-600">{formatCurrency(totals.totalSisaTarikan)}</td>
                  <td className="p-2 text-right text-amber-600">{formatCurrency(totals.totalKuranganJimpitan)}</td>
                  <td className="p-2 text-right text-slate-700">{formatCurrency(totals.totalIuranBulanan)}</td>
                  <td className="p-2 text-right text-sky-600">{formatCurrency(totals.totalIuranRonda)}</td>
                  <td className="p-2 text-right text-slate-800">{formatCurrency(totals.totalHarusBayar)}</td>
                  <td className="p-2 text-right text-emerald-700">{formatCurrency(totals.totalSudahBayar)}</td>
                  <td className="p-2 text-right text-red-600">{formatCurrency(totals.totalSisaDepan)}</td>
                  <td className="p-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Link to daily matrix */}
        {upcoming && (
          <Button
            size="sm"
            className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white text-xs"
            onClick={() => { exitCollectionMode(); fetchDailyMatrix(upcoming.id); }}
            disabled={loadingDailyMatrix}
          >
            {loadingDailyMatrix ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
            Lihat Rekap Harian 35 Hari — Detail Per Warga Per Hari
          </Button>
        )}
      </div>
    );
  };

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
                <TableHead className="text-[11px] w-28">Catatan</TableHead>
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
                const noteVal = collectNotes[key] ?? '';
                const needsNotes = remaining > 0 && !noteVal.trim();

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
                    <TableCell>
                      <Input
                        type="text"
                        className={`h-8 text-xs w-full ${needsNotes ? 'border-amber-400 bg-amber-50 focus:border-amber-500' : ''}`}
                        value={noteVal}
                        placeholder={needsNotes ? 'Wajib isi...' : 'Catatan...'}
                        disabled={isComplete || isSubmitting}
                        onChange={e => setCollectNotes(prev => ({ ...prev, [key]: e.target.value }))}
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
                          notes: noteVal || undefined,
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
  // Tab 3: Denda & Lainnya
  // ----------------------------------------

  const renderRondaLevyFineTab = (recap: RecapData) => {
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
        {/* Section A: Tarikan Lain */}
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

        {/* Section B: Denda */}
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

      {/* Collection Mode, Daily Matrix, or Preview Mode */}
      {showDailyMatrix ? (
        renderDailyMatrix()
      ) : collectionMode ? (
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
