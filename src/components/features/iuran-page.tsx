'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateShort,
  FINE_TYPE,
  FINE_STATUS,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Wallet,
  Receipt,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  Coins,
} from 'lucide-react';

interface IuranPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

interface JimpitanLog {
  id: string;
  date: string;
  amount: number;
  isPaid: boolean;
  notes: string | null;
  family: { id: string; familyHead: string };
}

interface Fine {
  id: string;
  type: string;
  amount: number;
  reason: string;
  status: string;
  date: string;
  user: { id: string; name: string };
  family: { id: string; familyHead: string };
}

type TabType = 'jimpitan' | 'denda';

export function IuranPage({ userId, familyId, isAdmin }: IuranPageProps) {
  const [jimpitanLogs, setJimpitanLogs] = useState<JimpitanLog[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [jimpitanSummary, setJimpitanSummary] = useState({ totalAmount: 0, totalPaid: 0, totalUnpaid: 0, count: 0 });
  const [finesSummary, setFinesSummary] = useState({ totalUnpaid: 0, totalPaid: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('jimpitan');

  useEffect(() => {
    loadData();
  }, [userId, familyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const promises: Promise<Response>[] = [];

      // Load jimpitan for the user's family
      if (familyId) {
        promises.push(api.get(`/jimpitan?familyId=${familyId}`));
      }
      // Load fines for the user
      promises.push(api.get(`/fines?userId=${userId}`));

      const results = await Promise.all(promises);

      if (familyId && results[0]) {
        const jimpitanData = await results[0].json();
        setJimpitanLogs(jimpitanData.logs || []);
        setJimpitanSummary(jimpitanData.summary || { totalAmount: 0, totalPaid: 0, totalUnpaid: 0, count: 0 });
      }

      const finesRes = familyId ? results[1] : results[0];
      if (finesRes) {
        const finesData = await finesRes.json();
        setFines(finesData.fines || []);
        setFinesSummary(finesData.summary || { totalUnpaid: 0, totalPaid: 0 });
      }
    } catch (error) {
      console.error('Failed to load iuran data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalUnpaid = jimpitanSummary.totalUnpaid + finesSummary.totalUnpaid;

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

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-800">Ringkasan Iuran</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Coins className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Jimpitan Belum Bayar</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatCurrency(jimpitanSummary.totalUnpaid)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Denda Belum Bayar</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatCurrency(finesSummary.totalUnpaid)}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Total Tunggakan</p>
              <p className={`text-base font-bold ${totalUnpaid > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(totalUnpaid)}
              </p>
            </div>

            {totalUnpaid === 0 && (
              <div className="flex items-center gap-2 py-2 px-3 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-700 font-medium">Semua iuran sudah lunas!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab Switcher */}
      <div className="flex bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('jimpitan')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'jimpitan'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500'
          }`}
        >
          Jimpitan
        </button>
        <button
          onClick={() => setActiveTab('denda')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'denda'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500'
          }`}
        >
          Denda
        </button>
      </div>

      {/* Jimpitan Tab */}
      {activeTab === 'jimpitan' && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-600" />
                <CardTitle className="text-sm font-semibold">Riwayat Jimpitan</CardTitle>
              </div>
              <span className="text-xs text-slate-500">{jimpitanLogs.length} catatan</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {!familyId ? (
              <div className="text-center py-8">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Anda belum terdaftar di keluarga</p>
                <p className="text-xs text-slate-400 mt-1">
                  Hubungi pengurus RT untuk pendaftaran
                </p>
              </div>
            ) : jimpitanLogs.length === 0 ? (
              <div className="text-center py-8">
                <Coins className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Belum ada data jimpitan</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {jimpitanLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          log.isPaid ? 'bg-green-100' : 'bg-red-100'
                        }`}
                      >
                        {log.isPaid ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {formatCurrency(log.amount)}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateShort(log.date)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        log.isPaid
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {log.isPaid ? 'Lunas' : 'Belum Bayar'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Denda Tab */}
      {activeTab === 'denda' && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-500" />
                <CardTitle className="text-sm font-semibold">Daftar Denda</CardTitle>
              </div>
              <span className="text-xs text-slate-500">{fines.length} catatan</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {fines.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Tidak ada denda</p>
                <p className="text-xs text-slate-400 mt-1">
                  Anda tidak memiliki denda yang tercatat
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {fines.map((fine) => (
                  <div
                    key={fine.id}
                    className="py-3 px-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            fine.type === 'RONDA'
                              ? 'bg-blue-100 text-blue-700'
                              : fine.type === 'JIMPITAN'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {fine.type === 'RONDA'
                            ? 'Ronda'
                            : fine.type === 'JIMPITAN'
                            ? 'Jimpitan'
                            : 'Lain-lain'}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            fine.status === 'PAID'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {fine.status === 'PAID' ? 'Lunas' : 'Belum Bayar'}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        {formatCurrency(fine.amount)}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600">{fine.reason}</p>
                    <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDateShort(fine.date)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
