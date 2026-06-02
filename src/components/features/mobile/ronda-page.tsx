'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/api-client';
import {
  formatDateShort,
  formatCurrency,
  RONDA_STATUS_LABELS,
} from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Calendar,
  Clock,
  Moon,
  Sun,
  Users,
  CheckCircle,
  AlertCircle,
  Wallet,
  Save,
  Loader2,
  CircleDollarSign,
  HandCoins,
} from 'lucide-react';
import { toast } from 'sonner';

interface RondaWargaPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

interface RondaGroup {
  id: string;
  name: string;
  dayOfWeek: number;
  description: string | null;
  families: Array<{
    id: string;
    familyHead: string;
    address: string;
    memberCount?: number;
    _count?: { familyMembers: number };
    rondaGroupId: string | null;
  }>;
}

interface RondaLog {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  userId: string;
  schedule: {
    id: string;
    date: string;
    shift: string;
    notes: string | null;
    group: { id: string; name: string };
  };
}

interface RondaSchedule {
  id: string;
  date: string;
  shift: string;
  notes: string | null;
  group: { id: string; name: string };
  logs: Array<{
    id: string;
    status: string;
    userId: string;
    user: { id: string; name: string };
    family: { id: string; familyHead: string };
  }>;
}

interface CollectionEntry {
  familyId: string;
  familyHead: string;
  expectedAmount: number;
  paidAmount: number;
  shortage: number;
  notes: string | null;
  logId: string | null;
}

interface CollectionData {
  date: string;
  group: { id: string; name: string; dayOfWeek: number } | null;
  jimpitanAmount: number;
  entries: CollectionEntry[];
  summary: {
    totalFamilies: number;
    totalExpected: number;
    totalPaid: number;
    totalShortage: number;
  };
}

const DAY_LABELS: Record<number, string> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

const JIMPITAN_QUICK_VALUES = [0, 500, 1000];

export function RondaPage({ userId, familyId, isAdmin }: RondaWargaPageProps) {
  const [myGroup, setMyGroup] = useState<RondaGroup | null>(null);
  const [schedules, setSchedules] = useState<RondaSchedule[]>([]);
  const [logs, setLogs] = useState<RondaLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Jimpitan collection state
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [editedEntries, setEditedEntries] = useState<Map<string, number>>(new Map());
  const [savingCollection, setSavingCollection] = useState(false);
  const [showJimpitanForm, setShowJimpitanForm] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId, familyId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const groupsRes = await api.get('/ronda/groups');
      let userGroup: RondaGroup | null = null;

      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        const groups: RondaGroup[] = groupsData.groups || [];
        if (familyId) {
          userGroup = groups.find((g) =>
            g.families.some((f) => f.id === familyId)
          ) || null;
        }
        setMyGroup(userGroup);
      }

      if (userGroup) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const from = `${year}-${month}-01`;
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        const schedulesRes = await api.get(
          `/ronda/schedules?groupId=${userGroup.id}&from=${from}&to=${to}`
        );
        if (schedulesRes.ok) {
          const schedulesData = await schedulesRes.json();
          setSchedules((schedulesData.schedules || []).sort(
            (a: RondaSchedule, b: RondaSchedule) => a.date.localeCompare(b.date)
          ));
        }
      }

      const logsRes = await api.get(`/ronda/logs?userId=${userId}`);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }
    } catch (error) {
      console.error('Failed to load ronda data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user is on ronda duty today
  const today = new Date().toISOString().split('T')[0];
  const isOnDutyToday = useMemo(() => {
    if (!myGroup) return false;
    const dutyDayOfWeek = (new Date().getDay() + 1) % 7;
    return myGroup.dayOfWeek === dutyDayOfWeek;
  }, [myGroup]);

  // Fetch jimpitan collection data for today
  const fetchCollection = useCallback(async () => {
    setLoadingCollection(true);
    try {
      const res = await api.get(`/jimpitan/collection?date=${today}`);
      if (res.ok) {
        const data: CollectionData = await res.json();
        setCollectionData(data);
        setEditedEntries(new Map());
      }
    } catch {
      // silent
    } finally {
      setLoadingCollection(false);
    }
  }, [today]);

  // Auto-fetch collection data when on duty
  useEffect(() => {
    if (isOnDutyToday && familyId) {
      fetchCollection();
    }
  }, [isOnDutyToday, familyId, fetchCollection]);

  // ─── Jimpitan Collection Handlers ─────────────────────────────────────────

  const getEntryPaidAmount = (entry: CollectionEntry): number => {
    return editedEntries.get(entry.familyId) ?? entry.paidAmount;
  };

  const setEntryPaidAmount = (familyId: string, amount: number) => {
    setEditedEntries(prev => {
      const next = new Map(prev);
      next.set(familyId, amount);
      return next;
    });
  };

  const getStatusBadge = (paid: number, expected: number) => {
    if (paid === 0) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">Kosong</Badge>;
    if (paid < expected) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">Kurang</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">Lunas</Badge>;
  };

  const computedSummary = useMemo(() => {
    if (!collectionData) return { totalFamilies: 0, totalPaid: 0, totalShortage: 0 };
    const entries = collectionData.entries;
    let totalPaid = 0;
    let totalShortage = 0;
    for (const entry of entries) {
      const paid = editedEntries.get(entry.familyId) ?? entry.paidAmount;
      const shortage = Math.max(0, entry.expectedAmount - paid);
      totalPaid += paid;
      totalShortage += shortage;
    }
    return {
      totalFamilies: entries.length,
      totalPaid,
      totalShortage,
    };
  }, [collectionData, editedEntries]);

  const handleSaveCollection = async () => {
    if (!collectionData) return;
    setSavingCollection(true);
    try {
      const entries = collectionData.entries.map(entry => ({
        familyId: entry.familyId,
        paidAmount: editedEntries.get(entry.familyId) ?? entry.paidAmount,
      }));

      const res = await api.post('/jimpitan/collection', {
        date: today,
        entries,
      });

      if (res.ok) {
        toast.success('Data jimpitan berhasil disimpan');
        await fetchCollection();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal menyimpan data jimpitan');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSavingCollection(false);
    }
  };

  // ─── General helpers ─────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HADIR':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'IZIN':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'TIDAK_HADIR':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
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

  const logMap = new Map<string, RondaLog>();
  for (const log of logs) {
    logMap.set(log.schedule.id, log);
  }

  const hadirCount = logs.filter((l) => l.status === 'HADIR').length;
  const izinCount = logs.filter((l) => l.status === 'IZIN').length;
  const tidakHadirCount = logs.filter((l) => l.status === 'TIDAK_HADIR').length;

  // Render collection content
  const renderCollectionContent = () => {
    if (loadingCollection) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 bg-emerald-100 rounded w-3/4" />
              <div className="h-8 bg-emerald-50 rounded w-full" />
            </div>
          ))}
        </div>
      );
    }

    if (!collectionData || collectionData.entries.length === 0) {
      return (
        <div className="text-center py-6">
          <Wallet className="w-10 h-10 text-emerald-200 mx-auto mb-2" />
          <p className="text-sm text-stone-500">Tidak ada KK terdaftar jimpitan untuk hari ini</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-lg font-bold text-slate-800">{computedSummary.totalFamilies}</p>
            <p className="text-[10px] text-slate-500 font-semibold">KK</p>
          </div>
          <div className="text-center p-2 bg-emerald-50 rounded-lg border border-emerald-100">
            <p className="text-sm font-bold text-emerald-700">{formatCurrency(computedSummary.totalPaid)}</p>
            <p className="text-[10px] text-emerald-600 font-semibold">Terkumpul</p>
          </div>
          <div className="text-center p-2 bg-rose-50 rounded-lg border border-rose-100">
            <p className="text-sm font-bold text-rose-600">{formatCurrency(computedSummary.totalShortage)}</p>
            <p className="text-[10px] text-rose-500 font-semibold">Kurang</p>
          </div>
        </div>

        {/* Simple Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide px-3 py-2">KK</th>
                <th className="text-center text-[11px] font-bold text-slate-500 uppercase tracking-wide px-2 py-2">Jimpitan</th>
                <th className="text-center text-[11px] font-bold text-slate-500 uppercase tracking-wide px-2 py-2 w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {collectionData.entries.map((entry, idx) => {
                const paid = getEntryPaidAmount(entry);
                const expected = entry.expectedAmount;

                return (
                  <tr
                    key={entry.familyId}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                  >
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-medium text-stone-800">{entry.familyHead}</span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {JIMPITAN_QUICK_VALUES.map(val => (
                          <button
                            key={val}
                            type="button"
                            className={`h-7 min-w-[38px] px-1.5 rounded-md text-[11px] font-bold border transition-colors ${
                              paid === val
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 active:bg-slate-100'
                            }`}
                            onClick={() => setEntryPaidAmount(entry.familyId, val)}
                          >
                            {val === 0 ? '0' : val >= 1000 ? `${val / 1000}rb` : val}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {getStatusBadge(paid, expected)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Save Button */}
        <Button
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm"
          onClick={handleSaveCollection}
          disabled={savingCollection}
        >
          {savingCollection ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Simpan Semua
            </>
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ═══ Ronda Duty Alert ═══ */}
      {isOnDutyToday && myGroup && (
        <Card className="rounded-2xl shadow-md border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
          <div className="bg-amber-500/20 px-4 py-2.5 border-b border-amber-200/50 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center animate-pulse">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Anda Bertugas Hari Ini!</span>
          </div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-base font-bold text-stone-800">{myGroup.name}</p>
                <p className="text-xs text-stone-500">Jaga malam ini &bull; {DAY_LABELS[myGroup.dayOfWeek]}</p>
              </div>
              <Button
                onClick={() => setShowJimpitanForm(!showJimpitanForm)}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 px-3 rounded-lg font-semibold"
              >
                <HandCoins className="w-4 h-4 mr-1.5" />
                {showJimpitanForm ? 'Tutup Form' : 'Tarik Jimpitan'}
              </Button>
            </div>
            {!showJimpitanForm && (
              <p className="text-xs text-amber-700 bg-amber-100/80 rounded-lg p-2.5">
                Klik <strong>Tarik Jimpitan</strong> untuk menginput pembayaran jimpitan warga saat ronda malam ini.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ Jimpitan Collection Form ═══ */}
      {isOnDutyToday && showJimpitanForm && (
        <Card className="rounded-2xl shadow-md border border-emerald-200 bg-white/95 overflow-hidden">
          <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Penarikan Jimpitan</span>
            </div>
            {collectionData?.jimpitanAmount ? (
              <div className="flex items-center gap-1.5 bg-emerald-100 rounded-lg px-2 py-1">
                <CircleDollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">
                  {formatCurrency(collectionData.jimpitanAmount)}/KK
                </span>
              </div>
            ) : null}
          </div>
          <CardContent className="p-4">
            {renderCollectionContent()}
          </CardContent>
        </Card>
      )}

      {/* ═══ Grup Ronda Saya ═══ */}
      <Card className="rounded-2xl shadow-sm border border-teal-100 bg-white/90 overflow-hidden">
        <div className="bg-teal-50 px-4 py-2.5 border-b border-teal-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-teal-700" />
          <span className="text-xs font-bold text-teal-800 uppercase tracking-wide">Grup Ronda Saya</span>
        </div>
        <CardContent className="p-4">
          {myGroup ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl p-3 border border-teal-100">
                <div>
                  <p className="text-base font-bold text-stone-800">{myGroup.name}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Hari: {DAY_LABELS[myGroup.dayOfWeek] || '-'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-white/70 rounded-lg px-2.5 py-1.5">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span className="text-xs font-semibold text-teal-700">
                    {myGroup.families.length} KK
                  </span>
                </div>
              </div>

              {/* Attendance Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-xl font-bold text-emerald-700">{hadirCount}</p>
                  <p className="text-[10px] text-emerald-600 font-semibold">Hadir</p>
                </div>
                <div className="text-center p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xl font-bold text-amber-700">{izinCount}</p>
                  <p className="text-[10px] text-amber-600 font-semibold">Izin</p>
                </div>
                <div className="text-center p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                  <p className="text-xl font-bold text-rose-700">{tidakHadirCount}</p>
                  <p className="text-[10px] text-rose-600 font-semibold">Tidak Hadir</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Shield className="w-10 h-10 text-orange-200 mx-auto mb-2" />
              <p className="text-sm font-semibold text-stone-600">Keluarga Anda belum terdaftar di grup ronda</p>
              <p className="text-xs text-stone-500 mt-1">
                Hubungi pengurus RT untuk penempatan grup
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Jadwal Ronda Bulan Ini ═══ */}
      {myGroup && (
        <Card className="rounded-2xl shadow-sm border border-amber-100 bg-white/90 overflow-hidden">
          <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Jadwal Ronda Bulan Ini</span>
          </div>
          <CardContent className="px-4 py-3">
            {schedules.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="w-8 h-8 text-orange-200 mx-auto mb-2" />
                <p className="text-sm text-stone-500">Belum ada jadwal ronda bulan ini</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {schedules.map((schedule) => {
                  const myLog = logMap.get(schedule.id);
                  const isPast = schedule.date < today;
                  const isToday = schedule.date === today;

                  return (
                    <div
                      key={schedule.id}
                      className={`flex items-center justify-between py-2.5 px-3 rounded-xl border ${
                        isToday
                          ? 'bg-amber-50 border-amber-200'
                          : isPast
                          ? 'bg-stone-50 border-stone-100'
                          : 'bg-white border-orange-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isToday
                              ? 'bg-amber-200'
                              : isPast
                              ? 'bg-stone-100'
                              : 'bg-teal-100'
                          }`}
                        >
                          {schedule.shift === 'MALAM' ? (
                            <Moon className="w-5 h-5 text-amber-600" />
                          ) : (
                            <Sun className="w-5 h-5 text-orange-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-800">
                            {formatDateShort(schedule.date)}
                          </p>
                          <p className="text-xs text-stone-500">
                            {schedule.shift === 'MALAM' ? 'Malam' : 'Pagi'}
                            {isToday && ' \u2022 Hari ini'}
                          </p>
                        </div>
                      </div>

                      {myLog ? (
                        <Badge
                          variant="secondary"
                          className={`text-xs font-semibold ${getStatusColor(myLog.status)}`}
                        >
                          {RONDA_STATUS_LABELS[myLog.status] || myLog.status}
                        </Badge>
                      ) : isPast ? (
                        <Badge variant="secondary" className="text-xs bg-stone-100 text-stone-400">
                          Tidak dicatat
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs bg-teal-50 text-teal-500">
                          Menunggu
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ Riwayat Kehadiran ═══ */}
      {logs.length > 0 && (
        <Card className="rounded-2xl shadow-sm border border-orange-100 bg-white/90 overflow-hidden">
          <div className="bg-orange-50 px-4 py-2.5 border-b border-orange-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-700" />
            <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">Riwayat Kehadiran</span>
          </div>
          <CardContent className="px-4 py-3">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2 border-b border-orange-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        log.status === 'HADIR'
                          ? 'bg-emerald-100'
                          : log.status === 'IZIN'
                          ? 'bg-amber-100'
                          : 'bg-rose-100'
                      }`}
                    >
                      {log.status === 'HADIR' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-stone-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-800">
                        {log.schedule.group.name}
                      </p>
                      <p className="text-xs text-stone-500">
                        {formatDateShort(log.schedule.date)} &bull;{' '}
                        {log.schedule.shift === 'MALAM' ? 'Malam' : 'Pagi'}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs font-semibold ${getStatusColor(log.status)}`}
                  >
                    {RONDA_STATUS_LABELS[log.status] || log.status}
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
