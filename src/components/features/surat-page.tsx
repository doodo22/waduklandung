'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import {
  formatDateShort,
  LETTER_TYPE_LABELS,
  LETTER_STATUS_LABELS,
  LETTER_STATUS,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  CheckCheck,
  Loader2,
  Inbox,
  User,
  ArrowLeft,
} from 'lucide-react';
import { useNavStore } from '@/stores/nav-store';

interface Letter {
  id: string;
  letterNumber: string | null;
  type: string;
  purpose: string;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
  };
  userId: string;
}

interface SuratPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="size-3" />,
  APPROVED: <CheckCircle className="size-3" />,
  REJECTED: <XCircle className="size-3" />,
  COMPLETED: <CheckCheck className="size-3" />,
};

const defaultForm = {
  type: 'DOMISILI',
  purpose: '',
  notes: '',
};

const defaultProcessForm = {
  letterNumber: '',
  status: 'APPROVED',
};

export function SuratPage({ userId, familyId, isAdmin }: SuratPageProps) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  // Add dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  // Process dialog (admin)
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [processingLetter, setProcessingLetter] = useState<Letter | null>(null);
  const [processForm, setProcessForm] = useState(defaultProcessForm);
  const [processing, setProcessing] = useState(false);

  const fetchLetters = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/letters');
      if (res.ok) {
        const data = await res.json();
        setLetters(Array.isArray(data) ? data : data.letters ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLetters();
  }, [fetchLetters]);

  const filteredLetters = letters.filter((letter) => {
    const matchSearch =
      !searchQuery ||
      letter.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      letter.letterNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      letter.user?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || letter.status === filterStatus;
    const matchType = filterType === 'ALL' || letter.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const handleSubmit = async () => {
    if (!form.purpose.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/letters', {
        type: form.type,
        purpose: form.purpose,
        notes: form.notes || null,
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Gagal mengajukan surat');
        return;
      }
      setAddDialogOpen(false);
      setForm(defaultForm);
      fetchLetters();
    } catch {
      alert('Terjadi kesalahan jaringan');
    } finally {
      setSubmitting(false);
    }
  };

  const openProcessDialog = (letter: Letter, targetStatus: 'APPROVED' | 'REJECTED') => {
    setProcessingLetter(letter);
    setProcessForm({
      letterNumber: letter.letterNumber ?? '',
      status: targetStatus,
    });
    setProcessDialogOpen(true);
  };

  const handleProcess = async () => {
    if (!processingLetter) return;
    setProcessing(true);
    try {
      const body: Record<string, unknown> = {
        id: processingLetter.id,
        status: processForm.status,
      };
      if (processForm.status === 'APPROVED' && processForm.letterNumber.trim()) {
        body.letterNumber = processForm.letterNumber.trim();
      }
      const res = await api.put('/letters', body);
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Gagal memproses surat');
        return;
      }
      setProcessDialogOpen(false);
      setProcessingLetter(null);
      fetchLetters();
    } catch {
      alert('Terjadi kesalahan jaringan');
    } finally {
      setProcessing(false);
    }
  };

  const markCompleted = async (letter: Letter) => {
    try {
      const res = await api.put('/letters', {
        id: letter.id,
        status: 'COMPLETED',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Gagal menyelesaikan surat');
        return;
      }
      fetchLetters();
    } catch {
      alert('Terjadi kesalahan jaringan');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {!isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-slate-400 hover:text-slate-700"
              onClick={() => useNavStore.getState().setPage('beranda')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Surat Pengantar</h2>
            <p className="text-sm text-slate-500">
              {isAdmin ? 'Kelola pengajuan surat warga' : 'Ajukan surat pengantar'}
            </p>
          </div>
        </div>
        {/* Ajukan Surat button disabled - coming soon for warga */}
      </div>

      {/* Coming Soon Notice for Warga */}
      {!isAdmin && (
        <Card className="rounded-2xl shadow-sm border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="py-10 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <Clock className="size-6 text-amber-600" />
            </div>
            <p className="text-stone-800 font-bold text-lg">Fitur Segera Hadir</p>
            <p className="text-sm text-stone-500 mt-2 max-w-sm">
              Layanan pengajuan surat pengantar sedang dalam persiapan menunggu format resmi dari Pak RT. 
              Nantikan informasi lebih lanjut!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters - Admin only */}
      {isAdmin && (
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Cari surat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-10 w-full sm:w-[180px]">
            <SelectValue placeholder="Semua Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="PENDING">Menunggu</SelectItem>
            <SelectItem value="APPROVED">Disetujui</SelectItem>
            <SelectItem value="REJECTED">Ditolak</SelectItem>
            <SelectItem value="COMPLETED">Selesai</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-10 w-full sm:w-[200px]">
            <SelectValue placeholder="Semua Jenis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Jenis</SelectItem>
            <SelectItem value="DOMISILI">Surat Domisili</SelectItem>
            <SelectItem value="PENGANTAR">Surat Pengantar</SelectItem>
            <SelectItem value="KETERANGAN">Surat Keterangan</SelectItem>
            <SelectItem value="LAIN_LAIN">Lain-lain</SelectItem>
          </SelectContent>
        </Select>
      </div>
      )}

      {/* Loading - Admin only */}
      {isAdmin && loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Memuat data...</span>
        </div>
      )}

      {/* Empty State - Admin only */}
      {isAdmin && !loading && filteredLetters.length === 0 && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Inbox className="size-6 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">Belum ada surat</p>
            <p className="text-sm text-slate-400 mt-1">
              {searchQuery || filterStatus !== 'ALL' || filterType !== 'ALL'
                ? 'Coba ubah filter pencarian'
                : isAdmin
                ? 'Belum ada pengajuan surat dari warga'
                : 'Ajukan surat pengantar pertama Anda'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Letters List - Admin only */}
      {isAdmin && !loading && filteredLetters.length > 0 && (
        <div className="space-y-3">
          {filteredLetters.map((letter) => (
            <Card
              key={letter.id}
              className="rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
            >
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="size-5 text-slate-500" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="font-medium text-slate-800">
                        {LETTER_TYPE_LABELS[letter.type] ?? letter.type}
                      </span>
                      <Badge className={`${STATUS_COLORS[letter.status] ?? 'bg-gray-100 text-gray-800'} w-fit`}>
                        {STATUS_ICONS[letter.status]}
                        <span className="ml-1">{LETTER_STATUS_LABELS[letter.status] ?? letter.status}</span>
                      </Badge>
                    </div>

                    {letter.letterNumber && (
                      <div className="text-sm text-slate-500">
                        No. Surat: <span className="font-medium text-slate-700">{letter.letterNumber}</span>
                      </div>
                    )}

                    <div className="text-sm text-slate-600 line-clamp-2">{letter.purpose}</div>

                    {isAdmin && letter.user && (
                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <User className="size-3.5" />
                        <span>{letter.user.name}</span>
                      </div>
                    )}

                    {letter.notes && (
                      <div className="text-xs text-slate-400 italic">Catatan: {letter.notes}</div>
                    )}

                    <div className="text-xs text-slate-400">
                      Diajukan: {formatDateShort(letter.createdAt)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && letter.status === 'PENDING' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
                          onClick={() => openProcessDialog(letter, 'APPROVED')}
                        >
                          <CheckCircle className="size-3.5 mr-1" />
                          Setujui
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
                          onClick={() => openProcessDialog(letter, 'REJECTED')}
                        >
                          <XCircle className="size-3.5 mr-1" />
                          Tolak
                        </Button>
                      </>
                    )}
                    {isAdmin && letter.status === 'APPROVED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-blue-700 border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                        onClick={() => markCompleted(letter)}
                      >
                        <CheckCheck className="size-3.5 mr-1" />
                        Selesai
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Letter Dialog (Warga) */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajukan Surat Pengantar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Jenis Surat</Label>
              <Select
                value={form.type}
                onValueChange={(val) => setForm({ ...form, type: val })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOMISILI">Surat Keterangan Domisili</SelectItem>
                  <SelectItem value="PENGANTAR">Surat Pengantar</SelectItem>
                  <SelectItem value="KETERANGAN">Surat Keterangan</SelectItem>
                  <SelectItem value="LAIN_LAIN">Lain-lain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="letter-purpose">Keperluan *</Label>
              <Textarea
                id="letter-purpose"
                placeholder="Jelaskan keperluan pengajuan surat"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="letter-notes">Catatan</Label>
              <Textarea
                id="letter-notes"
                placeholder="Catatan tambahan (opsional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              className="h-10"
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
              disabled={submitting || !form.purpose.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1" />
                  Mengajukan...
                </>
              ) : (
                'Ajukan Surat'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Letter Dialog (Admin) */}
      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {processForm.status === 'APPROVED' ? 'Setujui Surat' : 'Tolak Surat'}
            </DialogTitle>
          </DialogHeader>
          {processingLetter && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                <div className="text-sm font-medium text-slate-700">
                  {LETTER_TYPE_LABELS[processingLetter.type] ?? processingLetter.type}
                </div>
                <div className="text-sm text-slate-600 line-clamp-2">{processingLetter.purpose}</div>
                {processingLetter.user && (
                  <div className="text-xs text-slate-500">Pemohon: {processingLetter.user.name}</div>
                )}
              </div>

              {processForm.status === 'APPROVED' && (
                <div className="space-y-2">
                  <Label htmlFor="process-number">Nomor Surat</Label>
                  <Input
                    id="process-number"
                    placeholder="Masukkan nomor surat (opsional)"
                    value={processForm.letterNumber}
                    onChange={(e) =>
                      setProcessForm({ ...processForm, letterNumber: e.target.value })
                    }
                    className="h-10"
                  />
                  <p className="text-xs text-slate-400">Nomor surat akan dicantumkan pada surat yang disetujui</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setProcessDialogOpen(false)}
              className="h-10"
              disabled={processing}
            >
              Batal
            </Button>
            <Button
              onClick={handleProcess}
              className={`h-10 text-white ${
                processForm.status === 'APPROVED'
                  ? 'bg-green-700 hover:bg-green-800'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1" />
                  Memproses...
                </>
              ) : processForm.status === 'APPROVED' ? (
                'Setujui'
              ) : (
                'Tolak'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
