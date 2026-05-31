'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  SELAPANAN_STATUS_LABELS,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  MapPin,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SelapananWargaPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

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
  details: SelapananDetail[];
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

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function SelapananPage({ userId, familyId, isAdmin }: SelapananWargaPageProps) {
  const [selapananList, setSelapananList] = useState<Selapanan[]>([]);
  const [shortageData, setShortageData] = useState<ShortageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [userId, familyId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [selapananRes, shortagesRes] = await Promise.all([
        api.get('/selapanan'),
        api.get('/jimpitan/shortages'),
      ]);

      if (selapananRes.ok) {
        const data = await selapananRes.json();
        setSelapananList(data.selapanan || []);
      }

      if (shortagesRes.ok) {
        const data = await shortagesRes.json();
        setShortageData(data.summary || []);
      }
    } catch (error) {
      console.error('Failed to load selapanan data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Find user's shortage for a given selapanan
  const getMyShortage = (selapananId: string): ShortageEntry | null => {
    for (const summary of shortageData) {
      if (summary.selapananId === selapananId) {
        const mine = summary.shortages.find((s) => s.familyId === familyId);
        if (mine) return mine;
      }
    }
    return null;
  };

  // Get total unpaid shortage across all selapanan
  const getTotalUnpaidShortage = (): number => {
    if (!familyId) return 0;
    let total = 0;
    for (const summary of shortageData) {
      for (const shortage of summary.shortages) {
        if (shortage.familyId === familyId && !shortage.isSettled) {
          total += shortage.totalShortage - shortage.settledAmount;
        }
      }
    }
    return total;
  };

  // Find upcoming selapanan
  const upcomingSelapanan = selapananList.find(
    (s) => s.status === 'UPCOMING'
  );

  // Past selapanan with user's shortages
  const pastWithShortages = selapananList.filter(
    (s) => s.status === 'COMPLETED' && getMyShortage(s.id)
  );

  const myShortageForUpcoming = upcomingSelapanan
    ? getMyShortage(upcomingSelapanan.id)
    : null;

  const totalUnpaid = getTotalUnpaidShortage();

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
      {/* Selapanan Mendatang Card */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-semibold text-slate-800">Selapanan Mendatang</h2>
          </div>

          {upcomingSelapanan ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={STATUS_COLORS[upcomingSelapanan.status] || 'bg-slate-100 text-slate-700'}>
                  {SELAPANAN_STATUS_LABELS[upcomingSelapanan.status] || upcomingSelapanan.status}
                </Badge>
              </div>

              <div className="bg-amber-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-slate-700">
                    {formatDate(upcomingSelapanan.meetingDate)}
                  </span>
                </div>

                {upcomingSelapanan.meetingLocation && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-slate-600">
                      {upcomingSelapanan.meetingLocation}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs text-slate-500">
                    Periode: {formatDateShort(upcomingSelapanan.periodeStart)} — {formatDateShort(upcomingSelapanan.periodeEnd)}
                  </span>
                </div>
              </div>

              {upcomingSelapanan.notes && (
                <p className="text-xs text-slate-500 italic">
                  {upcomingSelapanan.notes}
                </p>
              )}

              {/* Agenda items if any */}
              {upcomingSelapanan.details.length > 0 && (
                <div>
                  <button
                    onClick={() =>
                      setExpandedId(
                        expandedId === upcomingSelapanan.id ? null : upcomingSelapanan.id
                      )
                    }
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Lihat Agenda ({upcomingSelapanan.details.length})</span>
                    {expandedId === upcomingSelapanan.id ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {expandedId === upcomingSelapanan.id && (
                    <div className="mt-2 space-y-2">
                      {upcomingSelapanan.details.map((detail) => (
                        <div
                          key={detail.id}
                          className="bg-slate-50 rounded-lg p-2.5"
                        >
                          <p className="text-sm font-medium text-slate-700">{detail.agenda}</p>
                          {detail.decisions && (
                            <p className="text-xs text-slate-500 mt-1">
                              <span className="font-medium">Keputusan:</span> {detail.decisions}
                            </p>
                          )}
                          {detail.notes && (
                            <p className="text-xs text-slate-400 mt-0.5">{detail.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Belum ada jadwal selapanan mendatang</p>
              <p className="text-xs text-slate-400 mt-1">
                Informasi selapanan berikutnya akan muncul di sini
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kekurangan Anda Card */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h2 className="text-base font-semibold text-slate-800">Kekurangan Anda</h2>
          </div>

          {!familyId ? (
            <div className="text-center py-4">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Anda belum terdaftar di keluarga</p>
            </div>
          ) : totalUnpaid === 0 ? (
            <div className="flex items-center gap-3 py-2 px-3 bg-emerald-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  Anda tidak memiliki kekurangan iuran
                </p>
                <p className="text-xs text-emerald-600">Terima kasih!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-sm text-slate-600 mb-1">Total kekurangan yang akan ditagih</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalUnpaid)}
                </p>
              </div>

              {upcomingSelapanan && (
                <p className="text-sm text-slate-600">
                  Harap disiapkan untuk selapanan pada{' '}
                  <span className="font-semibold text-slate-800">
                    {formatDate(upcomingSelapanan.meetingDate)}
                  </span>
                </p>
              )}

              {/* Detail per selapanan */}
              {shortageData
                .filter((s) =>
                  s.shortages.some((sh) => sh.familyId === familyId && !sh.isSettled)
                )
                .map((summary) => {
                  const myShortage = summary.shortages.find(
                    (sh) => sh.familyId === familyId
                  );
                  if (!myShortage || myShortage.isSettled) return null;
                  const remaining = myShortage.totalShortage - myShortage.settledAmount;
                  if (remaining <= 0) return null;

                  return (
                    <div
                      key={summary.selapananId}
                      className="bg-slate-50 rounded-lg p-3"
                    >
                      <p className="text-xs text-slate-500 mb-1">
                        Periode {formatDateShort(summary.periodeStart)} — {formatDateShort(summary.periodeEnd)}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700">Kekurangan</span>
                        <span className="text-sm font-semibold text-red-600">
                          {formatCurrency(remaining)}
                        </span>
                      </div>
                      {myShortage.carriedOver && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Akumulasi dari periode sebelumnya
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Kekurangan */}
      {pastWithShortages.length > 0 && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <CardTitle className="text-sm font-semibold">Riwayat Kekurangan</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {pastWithShortages.map((selapanan) => {
                const shortage = getMyShortage(selapanan.id);
                if (!shortage) return null;

                return (
                  <div
                    key={selapanan.id}
                    className="bg-slate-50 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_COLORS[selapanan.status] || 'bg-slate-100 text-slate-700'}>
                          {SELAPANAN_STATUS_LABELS[selapanan.status] || selapanan.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-400">
                        {formatDateShort(selapanan.periodeStart)} — {formatDateShort(selapanan.periodeEnd)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-700">
                          Total: {formatCurrency(shortage.totalShortage)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Dibayar: {formatCurrency(shortage.settledAmount)}
                        </p>
                      </div>
                      <Badge
                        className={
                          shortage.isSettled
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }
                      >
                        {shortage.isSettled ? 'Lunas' : 'Belum Lunas'}
                      </Badge>
                    </div>

                    {shortage.carriedOver && !shortage.isSettled && (
                      <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Dibawa ke selapanan berikutnya
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Selapanan List */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <CardTitle className="text-sm font-semibold">Daftar Selapanan</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {selapananList.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Belum ada data selapanan</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selapananList.map((selapanan) => {
                const myShortage = getMyShortage(selapanan.id);
                const isUpcoming = selapanan.status === 'UPCOMING';

                return (
                  <div
                    key={selapanan.id}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${
                      isUpcoming ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge
                          className={`text-[10px] ${STATUS_COLORS[selapanan.status] || 'bg-slate-100 text-slate-700'}`}
                        >
                          {SELAPANAN_STATUS_LABELS[selapanan.status] || selapanan.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700 truncate">
                        {formatDate(selapanan.meetingDate)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateShort(selapanan.periodeStart)} — {formatDateShort(selapanan.periodeEnd)}
                      </p>
                    </div>

                    <div className="text-right shrink-0 ml-3">
                      {myShortage && !myShortage.isSettled ? (
                        <div>
                          <p className="text-xs text-slate-500">Kekurangan</p>
                          <p className="text-sm font-semibold text-red-600">
                            {formatCurrency(myShortage.totalShortage - myShortage.settledAmount)}
                          </p>
                        </div>
                      ) : myShortage && myShortage.isSettled ? (
                        <div>
                          <p className="text-xs text-slate-500">Status</p>
                          <p className="text-sm font-semibold text-emerald-600">Lunas</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-slate-500">Status</p>
                          <p className="text-sm text-slate-400">-</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
