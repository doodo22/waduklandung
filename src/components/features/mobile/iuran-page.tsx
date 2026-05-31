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

      // Load jimpitan logs for user's family this month
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

        // Enrollment status based on whether there are logs
        setEnrolled(logs.length > 0);
      }

      if (shortagesRes.ok) {
        const data = await shortagesRes.json();
        const summaries: ShortageSummary[] = data.summary || [];

        // Filter shortages for this family
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
      return { label: 'Kosong', color: 'bg-red-100 text-red-700' };
    }
  };

  const getStatusIcon = (log: JimpitanLog) => {
    if (log.paidAmount >= log.expectedAmount && log.expectedAmount > 0) {
      return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    } else if (log.paidAmount > 0) {
      return <MinusCircle className="w-4 h-4 text-amber-600" />;
    } else {
      return <XCircle className="w-4 h-4 text-red-500" />;
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

  if (!familyId) {
    return (
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Anda belum terdaftar di keluarga</p>
          <p className="text-xs text-slate-400 mt-1">
            Hubungi pengurus RT untuk pendaftaran
          </p>
        </CardContent>
      </Card>
    );
  }

  const isAllPaid = jimpitanSummary.totalShortage === 0 && jimpitanLogs.length > 0;

  return (
    <div className="space-y-4">
      {/* Status Jimpitan Card */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-800">Status Jimpitan</h2>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Badge
              className={
                isAllPaid
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
              }
            >
              <Coins className="w-3 h-3 mr-1" />
              {isAllPaid ? 'Jimpitan Bulan Ini Lunas' : 'Terdaftar Jimpitan Harian'}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 bg-slate-50 rounded-lg">
              <p className="text-sm font-bold text-slate-800">{jimpitanSummary.count}</p>
              <p className="text-[10px] text-slate-500">Hari</p>
            </div>
            <div className="text-center p-2 bg-emerald-50 rounded-lg">
              <p className="text-sm font-bold text-emerald-600">
                {jimpitanLogs.filter((l) => l.paidAmount >= l.expectedAmount && l.expectedAmount > 0).length}
              </p>
              <p className="text-[10px] text-slate-500">Lunas</p>
            </div>
            <div className="text-center p-2 bg-amber-50 rounded-lg">
              <p className="text-sm font-bold text-amber-600">
                {jimpitanLogs.filter((l) => l.paidAmount > 0 && l.paidAmount < l.expectedAmount).length}
              </p>
              <p className="text-[10px] text-slate-500">Kurang</p>
            </div>
          </div>

          {jimpitanSummary.totalShortage > 0 && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">Total Kekurangan Bulan Ini</p>
                <p className="text-base font-bold text-red-600">
                  {formatCurrency(jimpitanSummary.totalShortage)}
                </p>
              </div>
            </>
          )}

          {isAllPaid && (
            <div className="flex items-center gap-2 py-2 px-3 bg-emerald-50 rounded-lg mt-3">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <p className="text-sm text-emerald-700 font-medium">Semua jimpitan bulan ini lunas!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riwayat Jimpitan Bulan Ini */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-600" />
              <CardTitle className="text-sm font-semibold">Riwayat Jimpitan Bulan Ini</CardTitle>
            </div>
            <span className="text-xs text-slate-500">{jimpitanLogs.length} hari</span>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {jimpitanLogs.length === 0 ? (
            <div className="text-center py-6">
              <Coins className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Belum ada data jimpitan bulan ini</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {/* Table Header */}
              <div className="flex items-center justify-between py-1.5 px-2 text-xs font-medium text-slate-500 border-b border-slate-200">
                <span className="flex-1">Tanggal</span>
                <span className="w-20 text-center">Dibayar</span>
                <span className="w-16 text-right">Status</span>
              </div>

              {jimpitanLogs.map((log) => {
                const status = getPaymentStatus(log);
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700 truncate">
                        {formatDateShort(log.date)}
                      </span>
                    </div>
                    <div className="w-20 text-center">
                      <span className="text-sm font-medium text-slate-800">
                        {formatCurrency(log.paidAmount)}
                      </span>
                    </div>
                    <div className="w-16 text-right">
                      <Badge variant="secondary" className={`text-[10px] px-1.5 ${status.color}`}>
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

      {/* Kekurangan Jimpitan Card */}
      {totalUnpaidShortage > 0 && (
        <Card className="rounded-xl shadow-sm border border-red-200 bg-red-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <h2 className="text-base font-semibold text-red-700">Kekurangan Jimpitan</h2>
            </div>

            <div className="bg-white rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-slate-600">Total kekurangan yang belum dibayar</p>
              </div>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(totalUnpaidShortage)}
              </p>
            </div>

            <p className="text-xs text-red-600 font-medium mb-1">
              Akan ditagihkan pada selapanan berikutnya
            </p>

            {/* Info Box */}
            <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
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
        <Card className="rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-700">Tidak Ada Kekurangan</p>
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
