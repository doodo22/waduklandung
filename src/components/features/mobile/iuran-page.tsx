'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateShort,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Wallet,
  AlertCircle,
  CheckCircle,
  Calendar,
  Coins,
  Info,
  XCircle,
  MinusCircle,
  Sparkles,
} from 'lucide-react';

interface IuranWargaPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

interface JimpitanLog {
  id: string;
  date: string;
  expectedAmount: number;
  paidAmount: number;
  shortage: number;
  notes: string | null;
  family: { id: string; familyHead: string };
}

interface ShortageEntry {
  familyId: string;
  familyHead: string;
  totalShortage: number;
  settledAmount: number;
  isSettled: boolean;
  carriedOver: boolean;
  notes: string | null;
}

interface ShortageSummary {
  selapananId: string;
  periodeStart: string;
  periodeEnd: string;
  status: string;
  totalShortage: number;
  totalSettled: number;
  totalRemaining: number;
  familyCount: number;
  unsettledCount: number;
  shortages: ShortageEntry[];
}

export function IuranPage({ userId, familyId, isAdmin }: IuranWargaPageProps) {
  const [jimpitanLogs, setJimpitanLogs] = useState<JimpitanLog[]>([]);
  const [jimpitanSummary, setJimpitanSummary] = useState({
    totalExpected: 0,
    totalPaid: 0,
    totalShortage: 0,
    count: 0,
  });
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [myShortages, setMyShortages] = useState<ShortageEntry[]>([]);
  const [totalUnpaidShortage, setTotalUnpaidShortage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId, familyId]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (!familyId) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const from = `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      const [jimpitanRes, shortagesRes] = await Promise.all([
        api.get(`/jimpitan?familyId=${familyId}&from=${from}&to=${to}`),
        api.get('/jimpitan/shortages'),
      ]);

      if (jimpitanRes.ok) {
        const data = await jimpitanRes.json();
        const logs: JimpitanLog[] = data.logs || [];

        setJimpitanLogs(logs);
        setJimpitanSummary({
          totalExpected: data.summary?.totalAmount || logs.reduce((s, l) => s + l.expectedAmount, 0),
          totalPaid: data.summary?.totalPaid || logs.reduce((s, l) => s + l.paidAmount, 0),
          totalShortage: data.summary?.totalUnpaid || logs.reduce((s, l) => s + l.shortage, 0),
          count: logs.length,
        });

        setEnrolled(logs.length > 0);
      }

      if (shortagesRes.ok) {
        const data = await shortagesRes.json();
        const summaries: ShortageSummary[] = data.summary || [];

        const familyShortages: ShortageEntry[] = [];
        let unpaidTotal = 0;

        for (const summary of summaries) {
          for (const shortage of summary.shortages) {
            if (shortage.familyId === familyId) {
              familyShortages.push(shortage);
              if (!shortage.isSettled) {
                unpaidTotal += shortage.totalShortage - shortage.settledAmount;
              }
            }
          }
        }

        setMyShortages(familyShortages);
        setTotalUnpaidShortage(unpaidTotal);
      }
    } catch (error) {
      console.error('Failed to load iuran data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentStatus = (log: JimpitanLog): { label: string; color: string } => {
    if (log.paidAmount >= log.expectedAmount && log.expectedAmount > 0) {
      return { label: 'Lunas', color: 'bg-emerald-100 text-emerald-700' };
    } else if (log.paidAmount > 0 && log.paidAmount < log.expectedAmount) {
      return { label: 'Kurang', color: 'bg-amber-100 text-amber-700' };
    } else {
      return { label: 'Kosong', color: 'bg-rose-100 text-rose-700' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
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

  if (!familyId) {
    return (
      <Card className="rounded-2xl shadow-sm border border-orange-100 bg-white/80">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-teal-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-stone-700">Anda belum terdaftar di keluarga</p>
          <p className="text-xs text-stone-500 mt-1">
            Hubungi pengurus RT untuk pendaftaran
          </p>
        </CardContent>
      </Card>
    );
  }

  const isAllPaid = jimpitanSummary.totalShortage === 0 && jimpitanLogs.length > 0;

  return (
    <div className="space-y-4">
      {/* Status Jimpitan */}
      <Card className="rounded-2xl shadow-sm border border-amber-100 bg-white/90 overflow-hidden">
        <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-700" />
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Status Jimpitan</span>
        </div>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge
              className={
                isAllPaid
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-semibold'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-100 font-semibold'
              }
            >
              <Coins className="w-3 h-3 mr-1" />
              {isAllPaid ? 'Jimpitan Bulan Ini Lunas' : 'Terdaftar Jimpitan Harian'}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-3 bg-stone-50 rounded-xl border border-stone-100">
              <p className="text-lg font-bold text-stone-800">{jimpitanSummary.count}</p>
              <p className="text-[10px] text-stone-500 font-semibold">Hari</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-lg font-bold text-emerald-700">
                {jimpitanLogs.filter((l) => l.paidAmount >= l.expectedAmount && l.expectedAmount > 0).length}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">Lunas</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-lg font-bold text-amber-700">
                {jimpitanLogs.filter((l) => l.paidAmount > 0 && l.paidAmount < l.expectedAmount).length}
              </p>
              <p className="text-[10px] text-amber-600 font-semibold">Kurang</p>
            </div>
          </div>

          {jimpitanSummary.totalShortage > 0 && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center justify-between bg-rose-50 rounded-xl p-3 border border-rose-100">
                <p className="text-sm text-stone-700 font-medium">Total Kekurangan</p>
                <p className="text-lg font-bold text-rose-600">
                  {formatCurrency(jimpitanSummary.totalShortage)}
                </p>
              </div>
            </>
          )}

          {isAllPaid && (
            <div className="flex items-center gap-2 py-2.5 px-3 bg-emerald-50 rounded-xl mt-3 border border-emerald-100">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <p className="text-sm text-emerald-700 font-semibold">Semua jimpitan bulan ini lunas!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riwayat Jimpitan */}
      <Card className="rounded-2xl shadow-sm border border-orange-100 bg-white/90 overflow-hidden">
        <div className="bg-orange-50 px-4 py-2.5 border-b border-orange-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-orange-700" />
            <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">Riwayat Jimpitan</span>
          </div>
          <span className="text-xs text-stone-500 font-semibold">{jimpitanLogs.length} hari</span>
        </div>
        <CardContent className="px-4 py-3">
          {jimpitanLogs.length === 0 ? (
            <div className="text-center py-6">
              <Coins className="w-8 h-8 text-orange-200 mx-auto mb-2" />
              <p className="text-sm text-stone-500">Belum ada data jimpitan bulan ini</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between py-1.5 px-2 text-xs font-bold text-stone-500 border-b border-orange-100 uppercase tracking-wide">
                <span className="flex-1">Tanggal</span>
                <span className="w-20 text-center">Dibayar</span>
                <span className="w-16 text-right">Status</span>
              </div>

              {jimpitanLogs.map((log) => {
                const status = getPaymentStatus(log);
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-orange-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="text-sm text-stone-700 font-medium truncate">
                        {formatDateShort(log.date)}
                      </span>
                    </div>
                    <div className="w-20 text-center">
                      <span className="text-sm font-bold text-stone-800">
                        {formatCurrency(log.paidAmount)}
                      </span>
                    </div>
                    <div className="w-16 text-right">
                      <Badge variant="secondary" className={`text-[10px] px-1.5 font-semibold ${status.color}`}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kekurangan Jimpitan */}
      {totalUnpaidShortage > 0 && (
        <Card className="rounded-2xl shadow-sm border border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 overflow-hidden">
          <div className="bg-rose-100/50 px-4 py-2.5 border-b border-rose-200/50 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wide">Kekurangan Jimpitan</span>
          </div>
          <CardContent className="p-4">
            <div className="bg-white/70 rounded-xl p-3 mb-3 border border-rose-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-stone-600 font-medium">Total kekurangan yang belum dibayar</p>
              </div>
              <p className="text-2xl font-bold text-rose-600">
                {formatCurrency(totalUnpaidShortage)}
              </p>
            </div>

            <p className="text-xs text-rose-700 font-semibold mb-1">
              Akan ditagihkan pada selapanan berikutnya
            </p>

            <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Kekurangan jimpitan akan ditagihkan pada selapanan berikutnya. Jika tidak hadir, kekurangan akan diakumulasikan.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Shortages */}
      {totalUnpaidShortage === 0 && jimpitanLogs.length > 0 && (
        <Card className="rounded-2xl shadow-sm border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-700">Tidak Ada Kekurangan</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Anda tidak memiliki kekurangan jimpitan yang belum dibayar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
