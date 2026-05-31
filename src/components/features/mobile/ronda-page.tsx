'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  formatDateShort,
  RONDA_STATUS_LABELS,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Calendar,
  Clock,
  Moon,
  Sun,
  Users,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

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
    memberCount: number;
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

const DAY_LABELS: Record<number, string> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

export function RondaPage({ userId, familyId, isAdmin }: RondaWargaPageProps) {
  const [myGroup, setMyGroup] = useState<RondaGroup | null>(null);
  const [schedules, setSchedules] = useState<RondaSchedule[]>([]);
  const [logs, setLogs] = useState<RondaLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId, familyId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load groups to find user's group
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

      // Load schedules for user's group this month
      if (userGroup) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const from = `${year}-${month}-01`;
        // Get last day of month
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

      // Load user's ronda logs
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HADIR':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'IZIN':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'TIDAK_HADIR':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
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

  // Build a map of scheduleId → log for this user
  const logMap = new Map<string, RondaLog>();
  for (const log of logs) {
    logMap.set(log.schedule.id, log);
  }

  const today = new Date().toISOString().split('T')[0];

  // Stats
  const hadirCount = logs.filter((l) => l.status === 'HADIR').length;
  const izinCount = logs.filter((l) => l.status === 'IZIN').length;
  const tidakHadirCount = logs.filter((l) => l.status === 'TIDAK_HADIR').length;

  return (
    <div className="space-y-4">
      {/* My Ronda Group Card */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-800">Grup Ronda Saya</h2>
          </div>

          {myGroup ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-emerald-50 rounded-lg p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{myGroup.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hari: {DAY_LABELS[myGroup.dayOfWeek] || '-'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">
                    {myGroup.families.length} KK
                  </span>
                </div>
              </div>

              {/* Attendance Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-emerald-50 rounded-lg">
                  <p className="text-lg font-bold text-emerald-600">{hadirCount}</p>
                  <p className="text-[10px] text-slate-500">Hadir</p>
                </div>
                <div className="text-center p-2 bg-amber-50 rounded-lg">
                  <p className="text-lg font-bold text-amber-600">{izinCount}</p>
                  <p className="text-[10px] text-slate-500">Izin</p>
                </div>
                <div className="text-center p-2 bg-red-50 rounded-lg">
                  <p className="text-lg font-bold text-red-600">{tidakHadirCount}</p>
                  <p className="text-[10px] text-slate-500">Tidak Hadir</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <Shield className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Keluarga Anda belum terdaftar di grup ronda</p>
              <p className="text-xs text-slate-400 mt-1">
                Hubungi pengurus RT untuk penempatan grup
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jadwal Ronda Bulan Ini */}
      {myGroup && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <CardTitle className="text-sm font-semibold">Jadwal Ronda Bulan Ini</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {schedules.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Belum ada jadwal ronda bulan ini</p>
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
                      className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${
                        isToday
                          ? 'bg-amber-50 border border-amber-200'
                          : isPast
                          ? 'bg-slate-50'
                          : 'bg-white border border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isToday
                              ? 'bg-amber-100'
                              : isPast
                              ? 'bg-slate-100'
                              : 'bg-emerald-50'
                          }`}
                        >
                          {schedule.shift === 'MALAM' ? (
                            <Moon className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Sun className="w-4 h-4 text-orange-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {formatDateShort(schedule.date)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {schedule.shift === 'MALAM' ? 'Malam' : 'Pagi'}
                            {isToday && ' • Hari ini'}
                          </p>
                        </div>
                      </div>

                      {/* Status Kehadiran */}
                      {myLog ? (
                        <Badge
                          variant="secondary"
                          className={`text-xs ${getStatusColor(myLog.status)}`}
                        >
                          {RONDA_STATUS_LABELS[myLog.status] || myLog.status}
                        </Badge>
                      ) : isPast ? (
                        <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-400">
                          Tidak dicatat
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs bg-slate-50 text-slate-400">
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

      {/* Status Kehadiran Detail */}
      {logs.length > 0 && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <CardTitle className="text-sm font-semibold">Riwayat Kehadiran</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        log.status === 'HADIR'
                          ? 'bg-emerald-100'
                          : log.status === 'IZIN'
                          ? 'bg-amber-100'
                          : 'bg-red-100'
                      }`}
                    >
                      {log.status === 'HADIR' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {log.schedule.group.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateShort(log.schedule.date)} •{' '}
                        {log.schedule.shift === 'MALAM' ? 'Malam' : 'Pagi'}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${getStatusColor(log.status)}`}
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
