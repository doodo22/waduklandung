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
  Users,
  CheckCircle,
  AlertCircle,
  Wallet,
  Save,
  Loader2,
  CircleDollarSign,
  HandCoins,
  UserCheck,
  UserX,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface RondaWargaPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

interface AttendanceMember {
  id: string;
  familyHead: string;
  rondaStatus: string;
}

interface AttendanceSchedule {
  id: string;
  date: string;
  shift: string;
  weekNumber: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  attendance: Record<string, string>; // familyId -> status
}

interface AttendanceRecapMember {
  familyId: string;
  familyHead: string;
  hadirCount: number;
  tidakHadirCount: number;
  totalSchedules: number;
  attendanceRate: number;
}

interface AttendanceData {
  hasGroup: boolean;
  selapanan: {
    id: string;
    number: number;
    periodeStart: string;
    periodeEnd: string;
    status: string;
  } | null;
  group: {
    id: string;
    name: string;
    dayOfWeek: number;
  } | null;
  members: AttendanceMember[];
  schedules: AttendanceSchedule[];
  recap: {
    isComplete: boolean;
    members: AttendanceRecapMember[];
  } | null;
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
    rondaGroupId: string | null;
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

const DAY_NIGHT_LABELS: Record<number, string> = {
  0: 'Sabtu malam',
  1: 'Minggu malam',
  2: 'Senin malam',
  3: 'Selasa malam',
  4: 'Rabu malam',
  5: 'Kamis malam',
  6: 'Jumat malam',
};

const JIMPITAN_QUICK_VALUES = [0, 500, 1000];

// ============================================
// COMPONENT
// ============================================

export function RondaPage({ userId, familyId, isAdmin }: RondaWargaPageProps) {
  const [loading, setLoading] = useState(true);

  // Attendance state
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [editedAttendance, setEditedAttendance] = useState<Map<string, Map<string, string>>>(new Map());
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [showRecap, setShowRecap] = useState(false);

  // Jimpitan collection state
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [editedEntries, setEditedEntries] = useState<Map<string, number>>(new Map());
  const [savingCollection, setSavingCollection] = useState(false);
  const [showJimpitanForm, setShowJimpitanForm] = useState(false);

  // Group info
  const [myGroup, setMyGroup] = useState<RondaGroup | null>(null);

  useEffect(() => {
    loadData();
  }, [userId, familyId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load ronda groups to find user's group
      const groupsRes = await api.get('/ronda/groups');
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        const groups: RondaGroup[] = groupsData.groups || [];
        if (familyId) {
          const userGroup = groups.find((g) =>
            g.families.some((f) => f.id === familyId)
          ) || null;
          setMyGroup(userGroup);
        }
      }

      // Load attendance data
      const attendanceRes = await api.get('/ronda/attendance');
      if (attendanceRes.ok) {
        const data: AttendanceData = await attendanceRes.json();
        setAttendanceData(data);
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

  // Find today's schedule
  const todaySchedule = useMemo(() => {
    if (!attendanceData?.schedules) return null;
    return attendanceData.schedules.find(s => s.isToday);
  }, [attendanceData]);

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

  // ─── Attendance Handlers ─────────────────────────────────────

  const getAttendanceStatus = (scheduleId: string, familyId: string): string | null => {
    const edited = editedAttendance.get(scheduleId);
    if (edited && edited.has(familyId)) {
      return edited.get(familyId)!;
    }
    const schedule = attendanceData?.schedules.find(s => s.id === scheduleId);
    return schedule?.attendance[familyId] ?? null;
  };

  const toggleAttendance = (scheduleId: string, familyId: string, currentStatus: string | null) => {
    // Cycle: null -> HADIR -> TIDAK_HADIR -> null
    let nextStatus: string | null;
    if (!currentStatus || currentStatus === 'TIDAK_HADIR') {
      nextStatus = 'HADIR';
    } else if (currentStatus === 'HADIR') {
      nextStatus = 'TIDAK_HADIR';
    } else {
      nextStatus = null;
    }

    setEditedAttendance(prev => {
      const next = new Map(prev);
      const scheduleMap = new Map(next.get(scheduleId) || new Map());
      if (nextStatus === null) {
        scheduleMap.delete(familyId);
      } else {
        scheduleMap.set(familyId, nextStatus);
      }
      if (scheduleMap.size === 0) {
        next.delete(scheduleId);
      } else {
        next.set(scheduleId, scheduleMap);
      }
      return next;
    });
  };

  const hasUnsavedAttendance = useMemo(() => {
    return editedAttendance.size > 0;
  }, [editedAttendance]);

  const handleSaveAttendance = async (scheduleId: string) => {
    const scheduleEdits = editedAttendance.get(scheduleId);
    if (!scheduleEdits || scheduleEdits.size === 0) return;

    setSavingAttendance(true);
    try {
      const entries = Array.from(scheduleEdits.entries()).map(([familyId, status]) => ({
        familyId,
        status,
      }));

      const res = await api.post('/ronda/attendance', {
        scheduleId,
        entries,
      });

      if (res.ok) {
        toast.success('Absensi berhasil disimpan');
        // Clear edits for this schedule
        setEditedAttendance(prev => {
          const next = new Map(prev);
          next.delete(scheduleId);
          return next;
        });
        // Reload attendance data
        const attendanceRes = await api.get('/ronda/attendance');
        if (attendanceRes.ok) {
          const data: AttendanceData = await attendanceRes.json();
          setAttendanceData(data);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal menyimpan absensi');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSavingAttendance(false);
    }
  };

  // ─── Jimpitan Collection Handlers ────────────────────────────

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
    return { totalFamilies: entries.length, totalPaid, totalShortage };
  }, [collectionData, editedEntries]);

  const handleSaveCollection = async () => {
    if (!collectionData) return;
    setSavingCollection(true);
    try {
      const entries = collectionData.entries.map(entry => ({
        familyId: entry.familyId,
        paidAmount: editedEntries.get(entry.familyId) ?? entry.paidAmount,
      }));

      const res = await api.post('/jimpitan/collection', { date: today, entries });
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

  // ─── Render Helpers ──────────────────────────────────────────

  const formatMiniDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${day}/${month}`;
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
          <p className="text-xs text-stone-500 mt-1">Hubungi pengurus RT untuk pendaftaran</p>
        </CardContent>
      </Card>
    );
  }

  if (!attendanceData?.hasGroup || !attendanceData?.group) {
    return (
      <Card className="rounded-2xl shadow-sm border border-orange-100 bg-white/80">
        <CardContent className="p-8 text-center">
          <Shield className="w-10 h-10 text-orange-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-stone-700">Keluarga Anda belum terdaftar di grup ronda</p>
          <p className="text-xs text-stone-500 mt-1">Hubungi pengurus RT untuk penempatan grup</p>
        </CardContent>
      </Card>
    );
  }

  const { selapanan, group, members, schedules, recap } = attendanceData;

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
            {loadingCollection ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse space-y-2">
                    <div className="h-4 bg-emerald-100 rounded w-3/4" />
                    <div className="h-8 bg-emerald-50 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : !collectionData || collectionData.entries.length === 0 ? (
              <div className="text-center py-6">
                <Wallet className="w-10 h-10 text-emerald-200 mx-auto mb-2" />
                <p className="text-sm text-stone-500">Tidak ada KK terdaftar jimpitan untuk hari ini</p>
              </div>
            ) : (
              <div className="space-y-3">
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
                          <tr key={entry.familyId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
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

                <Button
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm"
                  onClick={handleSaveCollection}
                  disabled={savingCollection}
                >
                  {savingCollection ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Simpan Semua</>
                  )}
                </Button>
              </div>
            )}
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
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl p-3 border border-teal-100">
              <div>
                <p className="text-base font-bold text-stone-800">{group.name}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  Hari: {DAY_NIGHT_LABELS[group.dayOfWeek] || DAY_LABELS[group.dayOfWeek]}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 rounded-lg px-2.5 py-1.5">
                <Users className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-semibold text-teal-700">{members.length} KK</span>
              </div>
            </div>

            {/* Member list */}
            {members.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Anggota Grup</p>
                <div className="space-y-1">
                  {members.map((member, idx) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg bg-white border border-slate-100"
                    >
                      <span className="text-xs font-bold text-stone-400 w-5">{idx + 1}.</span>
                      <span className="text-sm font-medium text-stone-800 flex-1">{member.familyHead}</span>
                      {member.id === familyId && (
                        <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 text-[10px]">Anda</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══ Jadwal & Absen Ronda ═══ */}
      {selapanan && schedules.length > 0 && (
        <Card className="rounded-2xl shadow-sm border border-amber-100 bg-white/90 overflow-hidden">
          <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Jadwal & Absen Ronda</span>
            </div>
            <div className="text-[10px] text-amber-600 font-semibold">
              Selapanan ke-{selapanan.number}
            </div>
          </div>
          <CardContent className="p-0">
            {/* Period info */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatDateShort(selapanan.periodeStart)} — {formatDateShort(selapanan.periodeEnd)}</span>
                <span className="text-stone-400">({schedules.length}x ronda)</span>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200">
                    <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide px-3 py-2.5 min-w-[80px]">KK</th>
                    {schedules.map((schedule) => {
                      const isActive = schedule.isToday;
                      return (
                        <th
                          key={schedule.id}
                          className={`text-center text-[10px] font-bold uppercase tracking-wide px-1.5 py-2.5 min-w-[48px] ${
                            isActive
                              ? 'text-amber-700 bg-amber-50'
                              : schedule.isPast
                              ? 'text-slate-400'
                              : 'text-slate-300'
                          }`}
                        >
                          <div>Ronde {schedule.weekNumber}</div>
                          <div className={`font-normal text-[9px] mt-0.5 ${isActive ? 'text-amber-600' : ''}`}>
                            {formatMiniDate(schedule.date)}
                          </div>
                          {isActive && (
                            <div className="text-[8px] font-bold text-amber-600 mt-0.5">HARI INI</div>
                          )}
                        </th>
                      );
                    })}
                    <th className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-wide px-2 py-2.5 min-w-[40px]">
                      <div>Total</div>
                      <div className="font-normal text-[9px]">Hadir</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, idx) => {
                    // Calculate total attendance for this member
                    let totalHadir = 0;
                    schedules.forEach(s => {
                      const status = getAttendanceStatus(s.id, member.id);
                      if (status === 'HADIR') totalHadir++;
                    });

                    return (
                      <tr
                        key={member.id}
                        className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${
                          member.id === familyId ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        <td className="px-3 py-2">
                          <span className={`text-xs font-medium ${member.id === familyId ? 'text-teal-800 font-semibold' : 'text-stone-800'}`}>
                            {member.familyHead}
                          </span>
                        </td>
                        {schedules.map((schedule) => {
                          const status = getAttendanceStatus(schedule.id, member.id);
                          const isActive = schedule.isToday;
                          const isPast = schedule.isPast;
                          const isEdited = editedAttendance.get(schedule.id)?.has(member.id);

                          return (
                            <td key={schedule.id} className="px-1 py-1.5 text-center">
                              {isActive ? (
                                // Active column - clickable to toggle
                                <button
                                  type="button"
                                  onClick={() => toggleAttendance(schedule.id, member.id, status)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all border-2 ${
                                    status === 'HADIR'
                                      ? 'bg-emerald-100 border-emerald-400 text-emerald-700'
                                      : status === 'TIDAK_HADIR'
                                      ? 'bg-rose-100 border-rose-400 text-rose-700'
                                      : 'bg-amber-50 border-amber-300 text-amber-400 hover:bg-amber-100'
                                  } ${isEdited ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}
                                >
                                  {status === 'HADIR' ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : status === 'TIDAK_HADIR' ? (
                                    <UserX className="w-4 h-4" />
                                  ) : (
                                    <span className="text-xs font-bold">?</span>
                                  )}
                                </button>
                              ) : isPast ? (
                                // Past column - show status, read-only
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto ${
                                  status === 'HADIR'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : status === 'TIDAK_HADIR'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-slate-100 text-slate-400'
                                }`}>
                                  {status === 'HADIR' ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : status === 'TIDAK_HADIR' ? (
                                    <UserX className="w-4 h-4" />
                                  ) : (
                                    <span className="text-[10px]">—</span>
                                  )}
                                </div>
                              ) : (
                                // Future column - empty/inactive
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto bg-slate-50 text-slate-300">
                                  <span className="text-[10px]">—</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 text-center">
                          <span className={`text-xs font-bold ${
                            totalHadir === schedules.length ? 'text-emerald-700' :
                            totalHadir > 0 ? 'text-amber-700' : 'text-stone-400'
                          }`}>
                            {totalHadir}/{schedules.length}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[10px] text-stone-500">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-700" />
                </div>
                <span>Masuk</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-rose-100 flex items-center justify-center">
                  <UserX className="w-2.5 h-2.5 text-rose-700" />
                </div>
                <span>Tidak Masuk</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-amber-50 border-2 border-amber-300 flex items-center justify-center">
                  <span className="text-[8px] text-amber-400 font-bold">?</span>
                </div>
                <span>Belum diabsen</span>
              </div>
            </div>

            {/* Save button for today's attendance */}
            {todaySchedule && editedAttendance.get(todaySchedule.id)?.size ? (
              <div className="px-4 py-3 border-t border-amber-100 bg-amber-50/50">
                <Button
                  className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm shadow-sm"
                  onClick={() => handleSaveAttendance(todaySchedule.id)}
                  disabled={savingAttendance}
                >
                  {savingAttendance ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan Absensi...</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Simpan Absensi Hari Ini</>
                  )}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ═══ No Selapanan Message ═══ */}
      {attendanceData?.hasGroup && !selapanan && (
        <Card className="rounded-2xl shadow-sm border border-orange-100 bg-white/90">
          <CardContent className="p-6 text-center">
            <Calendar className="w-10 h-10 text-orange-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-stone-700">Belum ada periode selapanan aktif</p>
            <p className="text-xs text-stone-500 mt-1">Jadwal ronda akan muncul setelah periode selapanan dibuat oleh pengurus</p>
          </CardContent>
        </Card>
      )}

      {/* ═══ Rekap Absen Ronda ═══ */}
      {recap && recap.isComplete && schedules.length > 0 && (
        <Card className="rounded-2xl shadow-sm border border-emerald-100 bg-white/90 overflow-hidden">
          <div
            className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-100 flex items-center justify-between cursor-pointer"
            onClick={() => setShowRecap(!showRecap)}
          >
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Rekap Absen Ronda</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">Lengkap</Badge>
              {showRecap ? (
                <ChevronUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-emerald-600" />
              )}
            </div>
          </div>
          {showRecap && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide px-3 py-2">KK</th>
                      <th className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-wide px-2 py-2 w-14">Hadir</th>
                      <th className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-wide px-2 py-2 w-14">Tidak</th>
                      <th className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-wide px-2 py-2 w-16">% Hadir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.members.map((member, idx) => (
                      <tr
                        key={member.familyId}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                      >
                        <td className="px-3 py-2">
                          <span className="text-xs font-medium text-stone-800">{member.familyHead}</span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="text-xs font-bold text-emerald-700">{member.hadirCount}</span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="text-xs font-bold text-rose-600">{member.tidakHadirCount}</span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  member.attendanceRate >= 80 ? 'bg-emerald-500' :
                                  member.attendanceRate >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${member.attendanceRate}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-bold ${
                              member.attendanceRate >= 80 ? 'text-emerald-700' :
                              member.attendanceRate >= 60 ? 'text-amber-700' : 'text-rose-700'
                            }`}>
                              {member.attendanceRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
