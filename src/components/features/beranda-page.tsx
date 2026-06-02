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
import Image from 'next/image';
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
  HandCoins,
  Users,
  Sparkles,
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
        <div className="animate-pulse bg-gradient-to-r from-teal-700 to-teal-600 rounded-2xl p-5 h-32" />
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-2xl shadow-sm border border-orange-100 bg-white/80">
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-orange-100 rounded w-3/4" />
                <div className="h-4 bg-orange-100 rounded w-1/2" />
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
        <AlertCircle className="w-10 h-10 text-teal-300 mx-auto mb-3" />
        <p className="text-sm text-stone-500">Gagal memuat data</p>
        <Button variant="outline" size="sm" className="mt-3 h-9 border-teal-200 text-teal-700" onClick={loadDashboard}>
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
    <div className="space-y-4 -mt-1">
      {/* ═══ Hero Welcome ═══ */}
      <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/5" />
        <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white/5" />
        <div className="absolute right-12 bottom-2 w-10 h-10 rounded-full bg-amber-400/10" />

        <div className="flex items-center gap-3 relative z-10">
          <Image
            src="/logo.png"
            alt="Waduk Landung"
            width={48}
            height={48}
            className="object-contain drop-shadow-md"
          />
          <div className="flex-1 min-w-0">
            <p className="text-teal-200 text-xs font-medium">Selamat datang di</p>
            <h2 className="text-lg font-bold tracking-wide text-white">{APP_NAME}</h2>
            <p className="text-sm text-teal-100 mt-0.5">Halo, {data.user.name}! 👋</p>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2 mt-4 relative z-10">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-white">{unpaidFinesCount}</p>
            <p className="text-[10px] text-teal-200 font-medium">Denda</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-white">{data.myRonda.length}</p>
            <p className="text-[10px] text-teal-200 font-medium">Jadwal Ronda</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
            <p className="text-xl font-bold text-white">{data.upcomingSelapanan ? '1' : '0'}</p>
            <p className="text-[10px] text-teal-200 font-medium">Selapanan</p>
          </div>
        </div>
      </div>

      {/* ═══ Financial Alert ═══ */}
      {(totalUnpaidFines > 0 || totalUnpaidJimpitan > 0) && (
        <Card className="rounded-2xl shadow-sm border border-rose-200 bg-gradient-to-r from-rose-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-sm font-bold text-rose-800">Tagihan Belum Dibayar</p>
            </div>
            <div className="space-y-2">
              {totalUnpaidJimpitan > 0 && (
                <div className="flex justify-between items-center bg-white/70 rounded-lg p-2.5">
                  <span className="text-sm text-stone-600 font-medium">Jimpitan</span>
                  <span className="text-sm font-bold text-stone-800">{formatCurrency(totalUnpaidJimpitan)}</span>
                </div>
              )}
              {totalUnpaidFines > 0 && (
                <div className="flex justify-between items-center bg-white/70 rounded-lg p-2.5">
                  <span className="text-sm text-stone-600 font-medium">Denda</span>
                  <span className="text-sm font-bold text-stone-800">{formatCurrency(totalUnpaidFines)}</span>
                </div>
              )}
              <div className="flex justify-between items-center bg-rose-100/80 rounded-lg p-2.5">
                <span className="text-sm font-bold text-rose-800">Total</span>
                <span className="text-base font-bold text-rose-700">{formatCurrency(totalUnpaidJimpitan + totalUnpaidFines)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Quick Actions ═══ */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setPage('iuran')}
          className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-orange-200 transition-all active:scale-95"
        >
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
            <HandCoins className="w-5 h-5 text-amber-700" />
          </div>
          <span className="text-xs font-semibold text-stone-700">Iuran</span>
        </button>
        <button
          onClick={() => setPage('ronda')}
          className="bg-white rounded-2xl border border-teal-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-teal-200 transition-all active:scale-95"
        >
          <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-teal-700" />
          </div>
          <span className="text-xs font-semibold text-stone-700">Ronda</span>
        </button>
        <button
          onClick={() => setPage('selapanan' as string)}
          className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-emerald-200 transition-all active:scale-95"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-emerald-700" />
          </div>
          <span className="text-xs font-semibold text-stone-700">Selapanan</span>
        </button>
      </div>

      {/* ═══ Upcoming Selapanan ═══ */}
      {data.upcomingSelapanan && (
        <Card className="rounded-2xl shadow-sm border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
          <div className="bg-amber-500/10 px-4 py-2.5 border-b border-amber-200/50 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Selapanan Akan Datang</span>
          </div>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-sm font-semibold text-stone-800">
                  {formatDateShort(data.upcomingSelapanan.meetingDate)}
                </span>
              </div>
              {data.upcomingSelapanan.meetingLocation && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-sm text-stone-600">
                    {data.upcomingSelapanan.meetingLocation}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Recent Ronda ═══ */}
      {data.myRonda.length > 0 && (
        <Card className="rounded-2xl shadow-sm border border-teal-100 bg-white/90 overflow-hidden">
          <div className="bg-teal-50 px-4 py-2.5 border-b border-teal-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-700" />
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wide">Ronda Bulan Ini</span>
            </div>
            <button
              onClick={() => setPage('ronda')}
              className="text-xs text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-0.5"
            >
              Semua <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <CardContent className="px-4 py-3">
            <div className="space-y-2">
              {data.myRonda.slice(0, 3).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2 border-b border-orange-50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-stone-800">
                      {log.schedule.group.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatDateShort(log.schedule.date)} • {log.schedule.shift === 'MALAM' ? 'Malam' : 'Pagi'}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs font-semibold ${
                      log.status === 'HADIR'
                        ? 'bg-emerald-100 text-emerald-700'
                        : log.status === 'IZIN'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
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

      {/* ═══ Pengumuman ═══ */}
      <Card className="rounded-2xl shadow-sm border border-orange-100 bg-white/90 overflow-hidden">
        <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-amber-700" />
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Pengumuman</span>
        </div>
        <CardContent className="px-4 py-3">
          {data.announcements.length === 0 ? (
            <div className="text-center py-4">
              <Megaphone className="w-8 h-8 text-orange-200 mx-auto mb-2" />
              <p className="text-sm text-stone-500">Belum ada pengumuman</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="py-2 border-b border-orange-50 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    {ann.isPinned && (
                      <Pin className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800 leading-snug">
                        {ann.title}
                      </p>
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                        {ann.content}
                      </p>
                      <p className="text-[11px] text-stone-400 mt-1.5 flex items-center gap-1">
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

      {/* ═══ Surat Terbaru ═══ */}
      {data.myLetters.length > 0 && (
        <Card className="rounded-2xl shadow-sm border border-orange-100 bg-white/90 overflow-hidden">
          <div className="bg-orange-50 px-4 py-2.5 border-b border-orange-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-700" />
            <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">Surat Terbaru</span>
          </div>
          <CardContent className="px-4 py-3">
            <div className="space-y-2">
              {data.myLetters.slice(0, 3).map((letter) => (
                <div
                  key={letter.id}
                  className="flex items-center justify-between py-2 border-b border-orange-50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-stone-800">{letter.purpose}</p>
                    <p className="text-xs text-stone-500">{formatDateShort(letter.createdAt)}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs font-semibold ${
                      letter.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : letter.status === 'APPROVED'
                        ? 'bg-teal-100 text-teal-700'
                        : letter.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
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
