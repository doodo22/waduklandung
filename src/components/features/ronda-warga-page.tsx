'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  formatDateShort,
  RONDA_STATUS_LABELS,
  RONDA_SHIFT,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Calendar,
  Clock,
  AlertCircle,
  Moon,
  Sun,
  User,
} from 'lucide-react';

interface RondaWargaPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

interface RondaLog {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  user: { id: string; name: string };
  family: { id: string; familyHead: string };
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
  }>;
}

export function RondaWargaPage({ userId, familyId, isAdmin }: RondaWargaPageProps) {
  const [logs, setLogs] = useState<RondaLog[]>([]);
  const [schedules, setSchedules] = useState<RondaSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId, familyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [logsRes, schedulesRes] = await Promise.all([
        api.get(`/ronda/logs?userId=${userId}`),
        api.get('/ronda/schedules'),
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }
      if (schedulesRes.ok) {
        const schedulesData = await schedulesRes.json();
        // Filter to upcoming schedules only (today and forward)
        const today = new Date().toISOString().split('T')[0];
        const upcoming = (schedulesData.schedules || []).filter(
          (s: RondaSchedule) => s.date >= today
        );
        setSchedules(upcoming);
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
        return 'bg-green-100 text-green-700 border-green-200';
      case 'IZIN':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
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

  // Separate past and upcoming logs
  const today = new Date().toISOString().split('T')[0];
  const pastLogs = logs.filter((l) => l.schedule.date < today);
  const upcomingLogs = logs.filter((l) => l.schedule.date >= today);

  // Find schedules for the user's family that don't have logs yet
  const myScheduleIds = new Set(logs.map((l) => l.schedule.id));
  const unloggedSchedules = schedules.filter(
    (s) => !myScheduleIds.has(s.id)
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-green-600" />
            <h2 className="text-base font-semibold text-slate-800">Jadwal Ronda Anda</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-slate-800">{logs.length}</p>
              <p className="text-[11px] text-slate-500">Total Catatan</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">
                {logs.filter((l) => l.status === 'HADIR').length}
              </p>
              <p className="text-[11px] text-slate-500">Hadir</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-yellow-600">
                {logs.filter((l) => l.status === 'IZIN').length}
              </p>
              <p className="text-[11px] text-slate-500">Izin</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Schedules */}
      {(upcomingLogs.length > 0 || unloggedSchedules.length > 0) && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <CardTitle className="text-sm font-semibold">Jadwal Akan Datang</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-3">
              {/* Upcoming schedules with logs */}
              {upcomingLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                      {log.schedule.shift === 'MALAM' ? (
                        <Moon className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-600" />
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

              {/* Schedules without logs (not yet assigned status) */}
              {unloggedSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                      {schedule.shift === 'MALAM' ? (
                        <Moon className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Sun className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {schedule.group.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateShort(schedule.date)} •{' '}
                        {schedule.shift === 'MALAM' ? 'Malam' : 'Pagi'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-500">
                    Belum dicatat
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Attendance History */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <CardTitle className="text-sm font-semibold">Riwayat Kehadiran</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {pastLogs.length === 0 && upcomingLogs.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Belum ada riwayat ronda</p>
              <p className="text-xs text-slate-400 mt-1">
                Riwayat kehadiran ronda Anda akan muncul di sini
              </p>
            </div>
          ) : pastLogs.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-500">Belum ada riwayat kehadiran</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pastLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        log.status === 'HADIR'
                          ? 'bg-green-100'
                          : log.status === 'IZIN'
                          ? 'bg-yellow-100'
                          : 'bg-red-100'
                      }`}
                    >
                      {log.status === 'HADIR' ? (
                        <Shield className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-slate-500" />
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
