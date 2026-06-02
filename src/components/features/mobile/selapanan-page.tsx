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
import {
  Calendar,
  MapPin,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Users,
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
  CANCELLED: 'bg-rose-100 text-rose-800',
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

  const getMyShortage = (selapananId: string): ShortageEntry | null => {
    for (const summary of shortageData) {
      if (summary.selapananId === selapananId) {
        const mine = summary.shortages.find((s) => s.familyId === familyId);
        if (mine) return mine;
      }
    }
    return null;
  };

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

  const upcomingSelapanan = selapananList.find(
    (s) => s.status === 'UPCOMING'
  );

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

  return (
    <div className="space-y-4">
      {/* Selapanan Mendatang */}
      <Card className="rounded-2xl shadow-sm border border-amber-100 bg-white/90 overflow-hidden">
        <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-700" />
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Selapanan Mendatang</span>
        </div>
        <CardContent className="p-4">
          {upcomingSelapanan ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`font-semibold ${STATUS_COLORS[upcomingSelapanan.status] || 'bg-stone-100 text-stone-700'}`}>
                  {SELAPANAN_STATUS_LABELS[upcomingSelapanan.status] || upcomingSelapanan.status}
                </Badge>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 space-y-2 border border-amber-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-stone-800">
                    {formatDate(upcomingSelapanan.meetingDate)}
                  </span>
                </div>

                {upcomingSelapanan.meetingLocation && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-stone-600">
                      {upcomingSelapanan.meetingLocation}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs text-stone-500">
                    Periode: {formatDateShort(upcomingSelapanan.periodeStart)} — {formatDateShort(upcomingSelapanan.periodeEnd)}
                  </span>
                </div>
              </div>

              {upcomingSelapanan.notes && (
                <p className="text-xs text-stone-500 italic">
                  {upcomingSelapanan.notes}
                </p>
              )}

              {upcomingSelapanan.details.length > 0 && (
                <div>
                  <button
                    onClick={() =>
                      setExpandedId(
                        expandedId === upcomingSelapanan.id ? null : upcomingSelapanan.id
                      )
                    }
                    className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-semibold transition-colors"
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
                          className="bg-stone-50 rounded-xl p-2.5 border border-stone-100"
                        >
                          <p className="text-sm font-semibold text-stone-800">{detail.agenda}</p>
                          {detail.decisions && (
                            <p className="text-xs text-stone-500 mt-1">
                              <span className="font-semibold">Keputusan:</span> {detail.decisions}
                            </p>
                          )}
                          {detail.notes && (
                            <p className="text-xs text-stone-400 mt-0.5">{detail.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Calendar className="w-10 h-10 text-orange-200 mx-auto mb-2" />
              <p className="text-sm font-semibold text-stone-600">Belum ada jadwal selapanan mendatang</p>
              <p className="text-xs text-stone-500 mt-1">
                Informasi selapanan berikutnya akan muncul di sini
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kekurangan Anda */}
      <Card className="rounded-2xl shadow-sm border border-rose-100 bg-white/90 overflow-hidden">
        <div className="bg-rose-50 px-4 py-2.5 border-b border-rose-100 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span className="text-xs font-bold text-rose-800 uppercase tracking-wide">Kekurangan Anda</span>
        </div>
        <CardContent className="p-4">
          {!familyId ? (
            <div className="text-center py-4">
              <AlertCircle className="w-8 h-8 text-orange-200 mx-auto mb-2" />
              <p className="text-sm text-stone-500">Anda belum terdaftar di keluarga</p>
            </div>
          ) : totalUnpaid === 0 ? (
            <div className="flex items-center gap-3 py-2 px-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-700">
                  Anda tidak memiliki kekurangan iuran
                </p>
                <p className="text-xs text-emerald-600">Terima kasih!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-xl p-3 border border-rose-100">
                <p className="text-sm text-stone-600 mb-1 font-medium">Total kekurangan yang akan ditagih</p>
                <p className="text-2xl font-bold text-rose-600">
                  {formatCurrency(totalUnpaid)}
                </p>
              </div>

              {upcomingSelapanan && (
                <p className="text-sm text-stone-600">
                  Harap disiapkan untuk selapanan pada{' '}
                  <span className="font-bold text-stone-800">
                    {formatDate(upcomingSelapanan.meetingDate)}
                  </span>
                </p>
              )}

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
                      className="bg-stone-50 rounded-xl p-3 border border-stone-100"
                    >
                      <p className="text-xs text-stone-500 mb-1 font-semibold">
                        Periode {formatDateShort(summary.periodeStart)} — {formatDateShort(summary.periodeEnd)}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-700 font-medium">Kekurangan</span>
                        <span className="text-sm font-bold text-rose-600">
                          {formatCurrency(remaining)}
                        </span>
                      </div>
                      {myShortage.carriedOver && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1 font-semibold">
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

      {/* Riwayat Kekurangan */}
      {pastWithShortages.length > 0 && (
        <Card className="rounded-2xl shadow-sm border border-orange-100 bg-white/90 overflow-hidden">
          <div className="bg-orange-50 px-4 py-2.5 border-b border-orange-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-700" />
            <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">Riwayat Kekurangan</span>
          </div>
          <CardContent className="px-4 py-3">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {pastWithShortages.map((selapanan) => {
                const shortage = getMyShortage(selapanan.id);
                if (!shortage) return null;

                return (
                  <div
                    key={selapanan.id}
                    className="bg-stone-50 rounded-xl p-3 border border-stone-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] font-semibold ${STATUS_COLORS[selapanan.status] || 'bg-stone-100 text-stone-700'}`}>
                          {SELAPANAN_STATUS_LABELS[selapanan.status] || selapanan.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-stone-400 font-medium">
                        {formatDateShort(selapanan.periodeStart)} — {formatDateShort(selapanan.periodeEnd)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-stone-700 font-medium">
                          Total: {formatCurrency(shortage.totalShortage)}
                        </p>
                        <p className="text-xs text-stone-500">
                          Dibayar: {formatCurrency(shortage.settledAmount)}
                        </p>
                      </div>
                      <Badge
                        className={
                          shortage.isSettled
                            ? 'bg-emerald-100 text-emerald-700 font-semibold'
                            : 'bg-rose-100 text-rose-700 font-semibold'
                        }
                      >
                        {shortage.isSettled ? 'Lunas' : 'Belum Lunas'}
                      </Badge>
                    </div>

                    {shortage.carriedOver && !shortage.isSettled && (
                      <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1 font-semibold">
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

      {/* Daftar Selapanan */}
      <Card className="rounded-2xl shadow-sm border border-teal-100 bg-white/90 overflow-hidden">
        <div className="bg-teal-50 px-4 py-2.5 border-b border-teal-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-700" />
          <span className="text-xs font-bold text-teal-800 uppercase tracking-wide">Daftar Selapanan</span>
        </div>
        <CardContent className="px-4 py-3">
          {selapananList.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="w-8 h-8 text-orange-200 mx-auto mb-2" />
              <p className="text-sm text-stone-500">Belum ada data selapanan</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selapananList.map((selapanan) => {
                const myShortage = getMyShortage(selapanan.id);
                const isUpcoming = selapanan.status === 'UPCOMING';

                return (
                  <div
                    key={selapanan.id}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-xl border ${
                      isUpcoming ? 'bg-amber-50 border-amber-200' : 'bg-stone-50 border-stone-100'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge
                          className={`text-[10px] font-semibold ${STATUS_COLORS[selapanan.status] || 'bg-stone-100 text-stone-700'}`}
                        >
                          {SELAPANAN_STATUS_LABELS[selapanan.status] || selapanan.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-stone-800 font-semibold truncate">
                        {formatDate(selapanan.meetingDate)}
                      </p>
                      <p className="text-xs text-stone-500">
                        {formatDateShort(selapanan.periodeStart)} — {formatDateShort(selapanan.periodeEnd)}
                      </p>
                    </div>

                    <div className="text-right shrink-0 ml-3">
                      {myShortage && !myShortage.isSettled ? (
                        <div>
                          <p className="text-[10px] text-stone-500 font-semibold uppercase">Kurang</p>
                          <p className="text-sm font-bold text-rose-600">
                            {formatCurrency(myShortage.totalShortage - myShortage.settledAmount)}
                          </p>
                        </div>
                      ) : myShortage && myShortage.isSettled ? (
                        <div>
                          <p className="text-[10px] text-stone-500 font-semibold uppercase">Status</p>
                          <p className="text-sm font-bold text-emerald-600">Lunas</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] text-stone-500 font-semibold uppercase">Status</p>
                          <p className="text-sm text-stone-400">-</p>
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
