'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  SELAPANAN_STATUS_LABELS,
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
import {
  Calendar,
  Plus,
  MapPin,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Wallet,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react';

// Types
interface SelapananDetail {
  id: string;
  selapananId: string;
  agenda: string;
  decisions: string | null;
  notes: string | null;
}

interface Selapanan {
  id: string;
  periodeStart: string;
  periodeEnd: string;
  meetingDate: string;
  meetingLocation: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  details: SelapananDetail[];
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

interface JimpitanLog {
  id: string;
  familyId: string;
  date: string;
  amount: number;
  isPaid: boolean;
  notes: string | null;
  family: { id: string; familyHead: string };
  creator: { id: string; name: string };
}

interface Props {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

// Helper: generate next selapanan period dates
function generateNextPeriod(existingSelapanan: Selapanan[]): {
  periodeStart: string;
  periodeEnd: string;
  meetingDate: string;
} {
  // Reference: find the latest selapanan or use a base reference date
  // The Javanese calendar cycle is 35 days. Selapanan = Sabtu malam Minggu Pon every 35 days.
  // Simplified: use 35-day intervals from a reference date (2024-01-06 was a Saturday Pon)
  const REFERENCE_DATE = new Date('2024-01-06');

  if (existingSelapanan.length > 0) {
    const latest = existingSelapanan[0];
    const latestEnd = new Date(latest.periodeEnd);
    const nextStart = new Date(latestEnd);
    nextStart.setDate(nextStart.getDate() + 1);
    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + 34);
    // Find the next Saturday after nextStart for the meeting
    const meetingDate = findNextSaturdayPon(nextStart);
    return {
      periodeStart: formatDateISO(nextStart),
      periodeEnd: formatDateISO(nextEnd),
      meetingDate: formatDateISO(meetingDate),
    };
  }

  // No existing selapanan: find next Saturday Pon from today
  const today = new Date();
  const meetingDate = findNextSaturdayPon(today);
  const periodeStart = new Date(meetingDate);
  periodeStart.setDate(periodeStart.getDate() - 6);
  const periodeEnd = new Date(periodeStart);
  periodeEnd.setDate(periodeEnd.getDate() + 34);

  return {
    periodeStart: formatDateISO(periodeStart),
    periodeEnd: formatDateISO(periodeEnd),
    meetingDate: formatDateISO(meetingDate),
  };
}

function findNextSaturdayPon(fromDate: Date): Date {
  // Simplified: find next Saturday from the given date
  // In a real implementation, this would also check for the Javanese day "Pon"
  const date = new Date(fromDate);
  const day = date.getDay();
  const daysUntilSaturday = day === 6 ? 7 : (6 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + (day === 6 ? 7 : daysUntilSaturday));
  return date;
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function SelapananPage({ userId, familyId, isAdmin }: Props) {
  const [selapananList, setSelapananList] = useState<Selapanan[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fines, setFines] = useState<Fine[]>([]);
  const [jimpitan, setJimpitan] = useState<JimpitanLog[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    periodeStart: '',
    periodeEnd: '',
    meetingDate: '',
    meetingLocation: '',
    notes: '',
  });
  const [agendaItems, setAgendaItems] = useState([{ agenda: '', decisions: '', notes: '' }]);
  const [saving, setSaving] = useState(false);

  const fetchSelapanan = useCallback(async () => {
    try {
      const res = await api.get('/selapanan');
      const data = await res.json();
      if (res.ok) {
        setSelapananList(data.selapanan || []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSelapanan();
  }, [fetchSelapanan]);

  const handleAutoGenerate = () => {
    const next = generateNextPeriod(selapananList);
    setForm({
      periodeStart: next.periodeStart,
      periodeEnd: next.periodeEnd,
      meetingDate: next.meetingDate,
      meetingLocation: form.meetingLocation || 'Balai RT',
      notes: '',
    });
  };

  const handleCreate = async () => {
    if (!form.periodeStart || !form.periodeEnd || !form.meetingDate) return;
    setSaving(true);
    try {
      const details = agendaItems
        .filter((a) => a.agenda.trim())
        .map((a) => ({
          agenda: a.agenda,
          decisions: a.decisions || undefined,
          notes: a.notes || undefined,
        }));

      const res = await api.post('/selapanan', {
        periodeStart: form.periodeStart,
        periodeEnd: form.periodeEnd,
        meetingDate: form.meetingDate,
        meetingLocation: form.meetingLocation || null,
        notes: form.notes || null,
        details: details.length > 0 ? details : undefined,
      });

      if (res.ok) {
        setCreateOpen(false);
        setForm({ periodeStart: '', periodeEnd: '', meetingDate: '', meetingLocation: '', notes: '' });
        setAgendaItems([{ agenda: '', decisions: '', notes: '' }]);
        fetchSelapanan();
      }
    } catch {
      // silently handle
    } finally {
      setSaving(false);
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      const res = await api.put('/selapanan', { id, status: 'COMPLETED' });
      if (res.ok) {
        fetchSelapanan();
      }
    } catch {
      // silently handle
    }
  };

  const handleExpand = async (selapanan: Selapanan) => {
    if (expandedId === selapanan.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(selapanan.id);
    setDetailsLoading(true);
    try {
      // Fetch fines and jimpitan for this period
      const [finesRes, jimpitanRes] = await Promise.all([
        api.get('/fines'),
        api.get(`/jimpitan?from=${selapanan.periodeStart}&to=${selapanan.periodeEnd}`),
      ]);
      const finesData = await finesRes.json();
      const jimpitanData = await jimpitanRes.json();
      if (finesRes.ok) {
        // Filter fines for this selapanan (by selapananId or date range)
        const filteredFines = (finesData.fines || []).filter(
          (f: Fine) =>
            f.selapananId === selapanan.id ||
            (f.date >= selapanan.periodeStart && f.date <= selapanan.periodeEnd)
        );
        setFines(filteredFines);
      }
      if (jimpitanRes.ok) {
        setJimpitan(jimpitanData.logs || []);
      }
    } catch {
      // silently handle
    } finally {
      setDetailsLoading(false);
    }
  };

  const addAgendaItem = () => {
    setAgendaItems([...agendaItems, { agenda: '', decisions: '', notes: '' }]);
  };

  const removeAgendaItem = (index: number) => {
    if (agendaItems.length <= 1) return;
    setAgendaItems(agendaItems.filter((_, i) => i !== index));
  };

  const updateAgendaItem = (index: number, field: string, value: string) => {
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: value };
    setAgendaItems(updated);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Selapanan</h2>
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-xl shadow-sm border border-slate-200 animate-pulse">
            <CardContent className="p-5">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Selapanan</h2>
          <p className="text-sm text-slate-500 mt-1">
            Rapat RT setiap 35 hari (Sabtu malam Minggu Pon)
          </p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 bg-slate-800 hover:bg-slate-700 text-white">
                <Plus className="w-4 h-4 mr-1" />
                Buat Selapanan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Buat Selapanan Baru</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoGenerate}
                  className="mb-2"
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Auto-generate Periode Berikutnya
                </Button>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Periode Mulai</Label>
                    <Input
                      type="date"
                      value={form.periodeStart}
                      onChange={(e) => setForm({ ...form, periodeStart: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Periode Selesai</Label>
                    <Input
                      type="date"
                      value={form.periodeEnd}
                      onChange={(e) => setForm({ ...form, periodeEnd: e.target.value })}
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tanggal Rapat</Label>
                  <Input
                    type="date"
                    value={form.meetingDate}
                    onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Lokasi Rapat</Label>
                  <Input
                    placeholder="Contoh: Balai RT"
                    value={form.meetingLocation}
                    onChange={(e) => setForm({ ...form, meetingLocation: e.target.value })}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Input
                    placeholder="Catatan tambahan (opsional)"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="h-10"
                  />
                </div>

                {/* Agenda Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Agenda Rapat</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addAgendaItem}>
                      <Plus className="w-3 h-3 mr-1" />
                      Tambah
                    </Button>
                  </div>
                  {agendaItems.map((item, idx) => (
                    <Card key={idx} className="rounded-lg border border-slate-200 shadow-none">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Judul agenda"
                            value={item.agenda}
                            onChange={(e) => updateAgendaItem(idx, 'agenda', e.target.value)}
                            className="h-9 text-sm"
                          />
                          {agendaItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAgendaItem(idx)}
                              className="text-red-500 hover:text-red-700 h-9 w-9 p-0 shrink-0"
                            >
                              ×
                            </Button>
                          )}
                        </div>
                        <Input
                          placeholder="Keputusan (opsional)"
                          value={item.decisions}
                          onChange={(e) => updateAgendaItem(idx, 'decisions', e.target.value)}
                          className="h-9 text-sm"
                        />
                        <Input
                          placeholder="Catatan (opsional)"
                          value={item.notes}
                          onChange={(e) => updateAgendaItem(idx, 'notes', e.target.value)}
                          className="h-9 text-sm"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setCreateOpen(false)} className="h-10">
                    Batal
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={saving || !form.periodeStart || !form.periodeEnd || !form.meetingDate}
                    className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
                  >
                    {saving ? 'Menyimpan...' : 'Buat Selapanan'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Selapanan List */}
      {selapananList.length === 0 ? (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardContent className="p-10 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Belum ada data selapanan</p>
            {isAdmin && (
              <p className="text-slate-400 text-xs mt-1">
                Klik &quot;Buat Selapanan&quot; untuk menambahkan periode baru
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {selapananList.map((selapanan) => {
            const isExpanded = expandedId === selapanan.id;
            return (
              <Card
                key={selapanan.id}
                className="rounded-xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <CardContent className="p-5">
                  {/* Card Header Row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={STATUS_COLORS[selapanan.status] || 'bg-slate-100 text-slate-700'}>
                          {SELAPANAN_STATUS_LABELS[selapanan.status] || selapanan.status}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {formatDateShort(selapanan.periodeStart)} — {formatDateShort(selapanan.periodeEnd)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Rapat: {formatDate(selapanan.meetingDate)}
                        </span>
                        {selapanan.meetingLocation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {selapanan.meetingLocation}
                          </span>
                        )}
                      </div>
                      {selapanan.notes && (
                        <p className="text-xs text-slate-400 mt-1">{selapanan.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isAdmin && selapanan.status === 'UPCOMING' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => handleMarkCompleted(selapanan.id)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Selesai
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleExpand(selapanan)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      {detailsLoading ? (
                        <div className="space-y-2">
                          <div className="h-3 bg-slate-100 rounded w-1/4" />
                          <div className="h-3 bg-slate-100 rounded w-1/2" />
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {/* Agenda Items */}
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
                              <FileText className="w-4 h-4 text-slate-400" />
                              Agenda Rapat
                            </h4>
                            {selapanan.details.length === 0 ? (
                              <p className="text-xs text-slate-400 pl-6">
                                Tidak ada agenda untuk selapanan ini
                              </p>
                            ) : (
                              <div className="space-y-2 pl-1">
                                {selapanan.details.map((detail) => (
                                  <Card
                                    key={detail.id}
                                    className="rounded-lg border border-slate-100 shadow-none bg-slate-50/50"
                                  >
                                    <CardContent className="p-3">
                                      <p className="text-sm font-medium text-slate-700">
                                        {detail.agenda}
                                      </p>
                                      {detail.decisions && (
                                        <p className="text-xs text-slate-500 mt-1">
                                          <span className="font-medium">Keputusan:</span>{' '}
                                          {detail.decisions}
                                        </p>
                                      )}
                                      {detail.notes && (
                                        <p className="text-xs text-slate-400 mt-0.5">
                                          {detail.notes}
                                        </p>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Fines Summary */}
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                              Rekap Denda Periode Ini
                            </h4>
                            {fines.length === 0 ? (
                              <p className="text-xs text-slate-400 pl-6">
                                Tidak ada denda pada periode ini
                              </p>
                            ) : (
                              <div className="pl-1">
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <Card className="rounded-lg border border-red-100 shadow-none bg-red-50/50">
                                    <CardContent className="p-3">
                                      <p className="text-xs text-red-600 font-medium">Belum Bayar</p>
                                      <p className="text-lg font-bold text-red-700">
                                        {formatCurrency(
                                          fines
                                            .filter((f) => f.status === 'UNPAID')
                                            .reduce((s, f) => s + f.amount, 0)
                                        )}
                                      </p>
                                    </CardContent>
                                  </Card>
                                  <Card className="rounded-lg border border-green-100 shadow-none bg-green-50/50">
                                    <CardContent className="p-3">
                                      <p className="text-xs text-green-600 font-medium">Sudah Bayar</p>
                                      <p className="text-lg font-bold text-green-700">
                                        {formatCurrency(
                                          fines
                                            .filter((f) => f.status === 'PAID')
                                            .reduce((s, f) => s + f.amount, 0)
                                        )}
                                      </p>
                                    </CardContent>
                                  </Card>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs h-8">Warga</TableHead>
                                        <TableHead className="text-xs h-8">Jenis</TableHead>
                                        <TableHead className="text-xs h-8">Jumlah</TableHead>
                                        <TableHead className="text-xs h-8">Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {fines.map((fine) => (
                                        <TableRow key={fine.id}>
                                          <TableCell className="text-xs py-2">
                                            {fine.user?.name || '-'}
                                          </TableCell>
                                          <TableCell className="text-xs py-2">
                                            {fine.type === FINE_TYPE.RONDA
                                              ? 'Ronda'
                                              : fine.type === FINE_TYPE.JIMPITAN
                                              ? 'Jimpitan'
                                              : 'Lain-lain'}
                                          </TableCell>
                                          <TableCell className="text-xs py-2">
                                            {formatCurrency(fine.amount)}
                                          </TableCell>
                                          <TableCell className="text-xs py-2">
                                            <Badge
                                              className={
                                                fine.status === FINE_STATUS.PAID
                                                  ? 'bg-green-100 text-green-800'
                                                  : 'bg-red-100 text-red-800'
                                              }
                                            >
                                              {fine.status === FINE_STATUS.PAID
                                                ? 'Lunas'
                                                : 'Belum'}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Jimpitan Recap */}
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
                              <Wallet className="w-4 h-4 text-green-600" />
                              Rekap Jimpitan Periode Ini
                            </h4>
                            {jimpitan.length === 0 ? (
                              <p className="text-xs text-slate-400 pl-6">
                                Tidak ada data jimpitan pada periode ini
                              </p>
                            ) : (
                              <div className="pl-1">
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                  <Card className="rounded-lg border border-slate-100 shadow-none bg-slate-50/50">
                                    <CardContent className="p-3">
                                      <p className="text-xs text-slate-500">Total</p>
                                      <p className="text-sm font-bold text-slate-700">
                                        {formatCurrency(
                                          jimpitan.reduce((s, j) => s + j.amount, 0)
                                        )}
                                      </p>
                                    </CardContent>
                                  </Card>
                                  <Card className="rounded-lg border border-green-100 shadow-none bg-green-50/50">
                                    <CardContent className="p-3">
                                      <p className="text-xs text-green-600">Lunas</p>
                                      <p className="text-sm font-bold text-green-700">
                                        {formatCurrency(
                                          jimpitan
                                            .filter((j) => j.isPaid)
                                            .reduce((s, j) => s + j.amount, 0)
                                        )}
                                      </p>
                                    </CardContent>
                                  </Card>
                                  <Card className="rounded-lg border border-amber-100 shadow-none bg-amber-50/50">
                                    <CardContent className="p-3">
                                      <p className="text-xs text-amber-600">Belum</p>
                                      <p className="text-sm font-bold text-amber-700">
                                        {formatCurrency(
                                          jimpitan
                                            .filter((j) => !j.isPaid)
                                            .reduce((s, j) => s + j.amount, 0)
                                        )}
                                      </p>
                                    </CardContent>
                                  </Card>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs h-8">KK</TableHead>
                                        <TableHead className="text-xs h-8">Tanggal</TableHead>
                                        <TableHead className="text-xs h-8">Jumlah</TableHead>
                                        <TableHead className="text-xs h-8">Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {jimpitan.map((log) => (
                                        <TableRow key={log.id}>
                                          <TableCell className="text-xs py-2">
                                            {log.family?.familyHead || '-'}
                                          </TableCell>
                                          <TableCell className="text-xs py-2">
                                            {formatDateShort(log.date)}
                                          </TableCell>
                                          <TableCell className="text-xs py-2">
                                            {formatCurrency(log.amount)}
                                          </TableCell>
                                          <TableCell className="text-xs py-2">
                                            <Badge
                                              className={
                                                log.isPaid
                                                  ? 'bg-green-100 text-green-800'
                                                  : 'bg-amber-100 text-amber-800'
                                              }
                                            >
                                              {log.isPaid ? 'Lunas' : 'Belum'}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
