'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateShort,
  RONDA_STATUS_LABELS,
  FINE_TYPE,
  APP_NAME,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Megaphone,
  Shield,
  Wallet,
  Calendar,
  FileText,
  Clock,
  AlertCircle,
  ChevronRight,
  Pin,
} from 'lucide-react';
import { useNavStore } from '@/stores/nav-store';

interface BerandaPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

interface DashboardData {
  user: {
    id: string;
    name: string;
    role: string;
    family?: {
      id: string;
      familyHead: string;
      address: string;
      rondaGroup: string | null;
    } | null;
  };
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    isPinned: boolean;
    createdAt: string;
  }>;
  myFines: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string;
    status: string;
    date: string;
  }>;
  myRonda: Array<{
    id: string;
    status: string;
    schedule: {
      id: string;
      date: string;
      shift: string;
      group: { id: string; name: string };
    };
  }>;
  myJimpitan: Array<{
    id: string;
    date: string;
    amount: number;
    isPaid: boolean;
  }>;
  upcomingSelapanan: {
    id: string;
    meetingDate: string;
    meetingLocation: string | null;
    status: string;
  } | null;
  myLetters: Array<{
    id: string;
    type: string;
    purpose: string;
    status: string;
    createdAt: string;
  }>;
}

export function BerandaPage({ userId, familyId, isAdmin }: BerandaPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { setPage } = useNavStore();

  useEffect(() => {
    loadDashboard();
  }, [userId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-xl shadow-sm border border-slate-200">
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-4 bg-slate-200 rounded w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Gagal memuat data</p>
        <Button variant="outline" size="sm" className="mt-3 h-9" onClick={loadDashboard}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  const unpaidFinesCount = data.myFines.filter((f) => f.status === 'UNPAID').length;
  const totalUnpaidFines = data.myFines
    .filter((f) => f.status === 'UNPAID')
    .reduce((sum, f) => sum + f.amount, 0);
  const unpaidJimpitan = data.myJimpitan.filter((j) => !j.isPaid);
  const totalUnpaidJimpitan = unpaidJimpitan.reduce((sum, j) => sum + j.amount, 0);

  return (
    <div className="space-y-4">
      {/* Welcome */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800">
          Halo, {data.user.name}! 👋
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Selamat datang di {APP_NAME}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card
          className="rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setPage('iuran')}
        >
          <CardContent className="p-3 text-center">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-lg font-bold text-slate-800">
              {unpaidFinesCount}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Denda Belum Bayar</p>
          </CardContent>
        </Card>

        <Card
          className="rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setPage('ronda')}
        >
          <CardContent className="p-3 text-center">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center mx-auto mb-2">
              <Shield className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-lg font-bold text-slate-800">
              {data.myRonda.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Jadwal Ronda</p>
          </CardContent>
        </Card>

        <Card
          className="rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setPage('selapanan' as string)}
        >
          <CardContent className="p-3 text-center">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center mx-auto mb-2">
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-slate-800">
              {data.upcomingSelapanan ? '1' : '0'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Selapanan</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      {(totalUnpaidFines > 0 || totalUnpaidJimpitan > 0) && (
        <Card className="rounded-xl shadow-sm border border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-red-600" />
              <p className="text-sm font-semibold text-red-700">Tagihan Belum Dibayar</p>
            </div>
            <div className="space-y-1.5">
              {totalUnpaidJimpitan > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Jimpitan</span>
                  <span className="font-medium text-slate-800">{formatCurrency(totalUnpaidJimpitan)}</span>
                </div>
              )}
              {totalUnpaidFines > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Denda</span>
                  <span className="font-medium text-slate-800">{formatCurrency(totalUnpaidFines)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-red-700">Total</span>
                <span className="text-red-700">{formatCurrency(totalUnpaidJimpitan + totalUnpaidFines)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-12 rounded-xl border-slate-200 justify-start gap-2 text-sm font-medium"
          onClick={() => setPage('iuran')}
        >
          <Wallet className="w-4 h-4 text-slate-600" />
          Lihat Jimpitan
        </Button>
        <Button
          variant="outline"
          className="h-12 rounded-xl border-slate-200 justify-start gap-2 text-sm font-medium"
          onClick={() => {
            setPage('surat');
          }}
        >
          <FileText className="w-4 h-4 text-slate-600" />
          Ajukan Surat
        </Button>
      </div>

      {/* Upcoming Selapanan */}
      {data.upcomingSelapanan && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold text-slate-800">Selapanan Akan Datang</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-600">
                <span className="font-medium">Tanggal:</span>{' '}
                {formatDateShort(data.upcomingSelapanan.meetingDate)}
              </p>
              {data.upcomingSelapanan.meetingLocation && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Lokasi:</span>{' '}
                  {data.upcomingSelapanan.meetingLocation}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Ronda */}
      {data.myRonda.length > 0 && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-600" />
                <CardTitle className="text-sm font-semibold">Ronda Bulan Ini</CardTitle>
              </div>
              <button
                onClick={() => setPage('ronda')}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                Lihat Semua <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {data.myRonda.slice(0, 3).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {log.schedule.group.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateShort(log.schedule.date)} • {log.schedule.shift === 'MALAM' ? 'Malam' : 'Pagi'}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      log.status === 'HADIR'
                        ? 'bg-green-100 text-green-700'
                        : log.status === 'IZIN'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {RONDA_STATUS_LABELS[log.status] || log.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Announcements */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-slate-600" />
            <CardTitle className="text-sm font-semibold">Pengumuman</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {data.announcements.length === 0 ? (
            <div className="text-center py-4">
              <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Belum ada pengumuman</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="py-2 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    {ann.isPinned && (
                      <Pin className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">
                        {ann.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {ann.content}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateShort(ann.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Letters */}
      {data.myLetters.length > 0 && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <CardTitle className="text-sm font-semibold">Surat Terbaru</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {data.myLetters.slice(0, 3).map((letter) => (
                <div
                  key={letter.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">{letter.purpose}</p>
                    <p className="text-xs text-slate-500">{formatDateShort(letter.createdAt)}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      letter.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : letter.status === 'APPROVED'
                        ? 'bg-blue-100 text-blue-700'
                        : letter.status === 'REJECTED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {letter.status === 'PENDING'
                      ? 'Menunggu'
                      : letter.status === 'APPROVED'
                      ? 'Disetujui'
                      : letter.status === 'REJECTED'
                      ? 'Ditolak'
                      : 'Selesai'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
