'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateShort,
  RONDA_STATUS_LABELS,
  RONDA_SHIFT,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Plus,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Wallet,
  CircleDollarSign,
  Banknote,
  Edit3,
  Search,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface RondaGroup {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RondaSchedule {
  id: string;
  groupId: string;
  date: string;
  shift: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  group?: RondaGroup;
  logs?: RondaLog[];
}

interface RondaLog {
  id: string;
  scheduleId: string;
  userId: string;
  familyId: string;
  status: string;
  notes: string | null;
  createdAt: string;
  user?: { id: string; name: string };
  family?: { id: string; familyHead: string };
}

interface JimpitanLog {
  id: string;
  familyId: string;
  date: string;
  amount: number;
  isPaid: boolean;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  family?: { id: string; familyHead: string };
  creator?: { id: string; name: string };
}

interface Family {
  id: string;
  familyHead: string;
  address: string;
  memberCount: number;
  rondaGroup: string | null;
  isActive: boolean;
}

interface RondaJimpitanPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function RondaJimpitanPage({ userId, familyId, isAdmin }: RondaJimpitanPageProps) {
  // ---- Ronda State ----
  const [rondaGroups, setRondaGroups] = useState<RondaGroup[]>([]);
  const [schedules, setSchedules] = useState<RondaSchedule[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loadingRonda, setLoadingRonda] = useState(true);
  const [showAddGroupDialog, setShowAddGroupDialog] = useState(false);
  const [showAddScheduleDialog, setShowAddScheduleDialog] = useState(false);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<RondaSchedule | null>(null);
  const [saving, setSaving] = useState(false);

  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [scheduleForm, setScheduleForm] = useState({
    groupId: '',
    date: '',
    shift: 'MALAM',
    notes: '',
  });
  const [attendanceForm, setAttendanceForm] = useState({
    familyId: '',
    status: 'HADIR',
    notes: '',
  });

  // ---- Jimpitan State ----
  const [jimpitanLogs, setJimpitanLogs] = useState<JimpitanLog[]>([]);
  const [loadingJimpitan, setLoadingJimpitan] = useState(true);
  const [showAddJimpitanDialog, setShowAddJimpitanDialog] = useState(false);
  const [jimpitanForm, setJimpitanForm] = useState({
    familyId: '',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    isPaid: false,
    notes: '',
  });
  const [jimpitanSearch, setJimpitanSearch] = useState('');

  // ----------------------------------------
  // Data fetching
  // ----------------------------------------

  const fetchRondaData = useCallback(async () => {
    setLoadingRonda(true);
    try {
      const [groupsRes, schedulesRes] = await Promise.all([
        api.get('/ronda/groups'),
        api.get('/ronda/schedules'),
      ]);
      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setRondaGroups(data);
      }
      if (schedulesRes.ok) {
        const data = await schedulesRes.json();
        setSchedules(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingRonda(false);
    }
  }, []);

  const fetchJimpitanData = useCallback(async () => {
    setLoadingJimpitan(true);
    try {
      const res = await api.get('/jimpitan');
      if (res.ok) {
        const data = await res.json();
        setJimpitanLogs(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingJimpitan(false);
    }
  }, []);

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await api.get('/families');
      if (res.ok) {
        const data = await res.json();
        setFamilies(data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchRondaData();
    fetchJimpitanData();
    fetchFamilies();
  }, [fetchRondaData, fetchJimpitanData, fetchFamilies]);

  // ----------------------------------------
  // Ronda Handlers
  // ----------------------------------------

  const handleAddGroup = async () => {
    if (!groupForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/ronda/groups', {
        name: groupForm.name,
        description: groupForm.description || null,
      });
      if (res.ok) {
        setShowAddGroupDialog(false);
        setGroupForm({ name: '', description: '' });
        fetchRondaData();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleAddSchedule = async () => {
    if (!scheduleForm.groupId || !scheduleForm.date) return;
    setSaving(true);
    try {
      const res = await api.post('/ronda/schedules', {
        groupId: scheduleForm.groupId,
        date: scheduleForm.date,
        shift: scheduleForm.shift,
        notes: scheduleForm.notes || null,
      });
      if (res.ok) {
        setShowAddScheduleDialog(false);
        setScheduleForm({ groupId: '', date: '', shift: 'MALAM', notes: '' });
        fetchRondaData();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAttendance = async () => {
    if (!selectedSchedule || !attendanceForm.familyId) return;
    setSaving(true);
    try {
      const res = await api.post('/ronda/logs', {
        scheduleId: selectedSchedule.id,
        userId: userId,
        familyId: attendanceForm.familyId,
        status: attendanceForm.status,
        notes: attendanceForm.notes || null,
      });
      if (res.ok) {
        setShowAttendanceDialog(false);
        setAttendanceForm({ familyId: '', status: 'HADIR', notes: '' });
        setSelectedSchedule(null);
        fetchRondaData();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const openAttendanceDialog = (schedule: RondaSchedule) => {
    setSelectedSchedule(schedule);
    setAttendanceForm({ familyId: '', status: 'HADIR', notes: '' });
    setShowAttendanceDialog(true);
  };

  // ----------------------------------------
  // Jimpitan Handlers
  // ----------------------------------------

  const handleAddJimpitan = async () => {
    if (!jimpitanForm.familyId || !jimpitanForm.date || jimpitanForm.amount <= 0) return;
    setSaving(true);
    try {
      const res = await api.post('/jimpitan', {
        familyId: jimpitanForm.familyId,
        date: jimpitanForm.date,
        amount: jimpitanForm.amount,
        isPaid: jimpitanForm.isPaid,
        notes: jimpitanForm.notes || null,
      });
      if (res.ok) {
        setShowAddJimpitanDialog(false);
        setJimpitanForm({
          familyId: '',
          date: new Date().toISOString().split('T')[0],
          amount: 0,
          isPaid: false,
          notes: '',
        });
        fetchJimpitanData();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePaid = async (log: JimpitanLog) => {
    try {
      const res = await api.put(`/jimpitan/${log.id}`, {
        isPaid: !log.isPaid,
      });
      if (res.ok) {
        fetchJimpitanData();
      }
    } catch {
      // silent
    }
  };

  // ----------------------------------------
  // Jimpitan Summary
  // ----------------------------------------

  const jimpitanSummary = {
    total: jimpitanLogs.reduce((sum, l) => sum + l.amount, 0),
    paid: jimpitanLogs.filter(l => l.isPaid).reduce((sum, l) => sum + l.amount, 0),
    unpaid: jimpitanLogs.filter(l => !l.isPaid).reduce((sum, l) => sum + l.amount, 0),
  };

  // ----------------------------------------
  // Filtered jimpitan
  // ----------------------------------------

  const filteredJimpitanLogs = jimpitanLogs.filter(l => {
    const q = jimpitanSearch.toLowerCase();
    if (!q) return true;
    return (
      (l.family?.familyHead || '').toLowerCase().includes(q) ||
      l.date.includes(q)
    );
  });

  // ----------------------------------------
  // Shift badge helper
  // ----------------------------------------

  const shiftBadge = (shift: string) => {
    const isMalam = shift === 'MALAM';
    return (
      <Badge
        variant="secondary"
        className={`text-xs ${isMalam ? 'bg-slate-700 text-white' : 'bg-amber-100 text-amber-800'}`}
      >
        <Clock className="w-3 h-3 mr-1" />
        {isMalam ? 'Malam' : 'Pagi'}
      </Badge>
    );
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'HADIR':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'TIDAK_HADIR':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'IZIN':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default:
        return null;
    }
  };

  // ----------------------------------------
  // Loading state
  // ----------------------------------------

  const renderSkeleton = (count: number) =>
    Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="rounded-xl shadow-sm border">
        <CardContent className="p-5">
          <div className="space-y-3">
            <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-56 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    ));

  // ----------------------------------------
  // Render
  // ----------------------------------------

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Ronda &amp; Jimpitan</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Kelola jadwal ronda dan iuran jimpitan harian
        </p>
      </div>

      <Tabs defaultValue="ronda" className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="ronda" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Shield className="w-4 h-4" />
            Ronda
          </TabsTrigger>
          <TabsTrigger value="jimpitan" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Wallet className="w-4 h-4" />
            Jimpitan
          </TabsTrigger>
        </TabsList>

        {/* ============================================ */}
        {/* RONDA TAB */}
        {/* ============================================ */}
        <TabsContent value="ronda" className="space-y-6">
          {/* Ronda Groups Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-700">Grup Ronda</h3>
              {isAdmin && (
                <Button
                  onClick={() => {
                    setGroupForm({ name: '', description: '' });
                    setShowAddGroupDialog(true);
                  }}
                  className="h-9 bg-slate-800 hover:bg-slate-700 text-white text-sm"
                  size="sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Tambah Grup
                </Button>
              )}
            </div>

            {loadingRonda ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderSkeleton(3)}
              </div>
            ) : rondaGroups.length === 0 ? (
              <Card className="rounded-xl shadow-sm border">
                <CardContent className="p-8 text-center">
                  <Shield className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Belum ada grup ronda</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rondaGroups.map(group => (
                  <Card
                    key={group.id}
                    className="rounded-xl shadow-sm border hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Users className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800">{group.name}</h4>
                        </div>
                      </div>
                      {group.description && (
                        <p className="text-sm text-slate-500 mt-1">{group.description}</p>
                      )}
                      <Badge
                        variant="secondary"
                        className={`mt-2 text-xs ${group.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                      >
                        {group.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Ronda Schedule Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-700">Jadwal Ronda</h3>
              {isAdmin && (
                <Button
                  onClick={() => {
                    setScheduleForm({ groupId: '', date: '', shift: 'MALAM', notes: '' });
                    setShowAddScheduleDialog(true);
                  }}
                  className="h-9 bg-slate-800 hover:bg-slate-700 text-white text-sm"
                  size="sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Tambah Jadwal
                </Button>
              )}
            </div>

            {loadingRonda ? (
              <div className="space-y-3">{renderSkeleton(3)}</div>
            ) : schedules.length === 0 ? (
              <Card className="rounded-xl shadow-sm border">
                <CardContent className="p-8 text-center">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Belum ada jadwal ronda</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {schedules
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(schedule => (
                    <Card
                      key={schedule.id}
                      className="rounded-xl shadow-sm border hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <span className="font-medium text-slate-800">
                                {formatDateShort(schedule.date)}
                              </span>
                              {shiftBadge(schedule.shift)}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                                <Shield className="w-3 h-3 mr-1" />
                                {schedule.group?.name || 'Grup'}
                              </Badge>
                              {schedule.notes && (
                                <span className="text-xs text-slate-400">{schedule.notes}</span>
                              )}
                            </div>

                            {/* Attendance logs */}
                            {schedule.logs && schedule.logs.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <p className="text-xs text-slate-500 mb-2">Kehadiran:</p>
                                <div className="flex flex-wrap gap-2">
                                  {schedule.logs.map(log => (
                                    <div
                                      key={log.id}
                                      className="flex items-center gap-1.5 text-xs bg-slate-50 rounded-md px-2 py-1"
                                    >
                                      {statusIcon(log.status)}
                                      <span className="text-slate-600">
                                        {log.user?.name || log.family?.familyHead || 'Warga'}
                                      </span>
                                      <span className="text-slate-400">
                                        ({RONDA_STATUS_LABELS[log.status] || log.status})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs shrink-0"
                              onClick={() => openAttendanceDialog(schedule)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Absensi
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </section>
        </TabsContent>

        {/* ============================================ */}
        {/* JIMPITAN TAB */}
        {/* ============================================ */}
        <TabsContent value="jimpitan" className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-xl shadow-sm border">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <CircleDollarSign className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Jimpitan</p>
                    <p className="text-lg font-bold text-slate-800">
                      {formatCurrency(jimpitanSummary.total)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm border">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Sudah Dibayar</p>
                    <p className="text-lg font-bold text-emerald-700">
                      {formatCurrency(jimpitanSummary.paid)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm border">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Belum Dibayar</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(jimpitanSummary.unpaid)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add jimpitan button + search */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Cari keluarga atau tanggal..."
                value={jimpitanSearch}
                onChange={e => setJimpitanSearch(e.target.value)}
                className="h-10 pl-9 rounded-lg border-slate-200"
              />
            </div>
            {isAdmin && (
              <Button
                onClick={() => {
                  setJimpitanForm({
                    familyId: '',
                    date: new Date().toISOString().split('T')[0],
                    amount: 0,
                    isPaid: false,
                    notes: '',
                  });
                  setShowAddJimpitanDialog(true);
                }}
                className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Tambah Jimpitan
              </Button>
            )}
          </div>

          {/* Jimpitan logs table */}
          {loadingJimpitan ? (
            <div className="space-y-3">{renderSkeleton(5)}</div>
          ) : filteredJimpitanLogs.length === 0 ? (
            <Card className="rounded-xl shadow-sm border">
              <CardContent className="p-8 text-center">
                <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Belum ada data jimpitan</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Tanggal</TableHead>
                      <TableHead className="text-xs">Keluarga</TableHead>
                      <TableHead className="text-xs">Jumlah</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Catatan</TableHead>
                      {isAdmin && <TableHead className="text-xs text-right">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJimpitanLogs
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm text-slate-700">
                            {formatDateShort(log.date)}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-slate-700">
                            {log.family?.familyHead || '-'}
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-slate-800">
                            {formatCurrency(log.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                log.isPaid
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {log.isPaid ? 'Lunas' : 'Belum Bayar'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-400">
                            {log.notes || '-'}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 text-xs ${
                                  log.isPaid
                                    ? 'text-red-500 hover:text-red-700'
                                    : 'text-emerald-600 hover:text-emerald-800'
                                }`}
                                onClick={() => handleTogglePaid(log)}
                              >
                                <Edit3 className="w-3 h-3 mr-1" />
                                {log.isPaid ? 'Batalkan' : 'Lunasi'}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ============================================ */}
      {/* DIALOGS */}
      {/* ============================================ */}

      {/* Add Ronda Group Dialog */}
      <Dialog open={showAddGroupDialog} onOpenChange={setShowAddGroupDialog}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Tambah Grup Ronda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-name">Nama Grup</Label>
              <Input
                id="group-name"
                placeholder="Contoh: Grup 1, Grup 2..."
                value={groupForm.name}
                onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-desc">Deskripsi (opsional)</Label>
              <Input
                id="group-desc"
                placeholder="Keterangan tambahan"
                value={groupForm.description}
                onChange={e => setGroupForm({ ...groupForm, description: e.target.value })}
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => setShowAddGroupDialog(false)} disabled={saving}>
              Batal
            </Button>
            <Button
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
              onClick={handleAddGroup}
              disabled={saving || !groupForm.name.trim()}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Ronda Schedule Dialog */}
      <Dialog open={showAddScheduleDialog} onOpenChange={setShowAddScheduleDialog}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Tambah Jadwal Ronda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Grup Ronda</Label>
              <Select
                value={scheduleForm.groupId}
                onValueChange={v => setScheduleForm({ ...scheduleForm, groupId: v })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Pilih grup" />
                </SelectTrigger>
                <SelectContent>
                  {rondaGroups.filter(g => g.isActive).map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-date">Tanggal</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleForm.date}
                onChange={e => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select
                value={scheduleForm.shift}
                onValueChange={v => setScheduleForm({ ...scheduleForm, shift: v })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALAM">Malam</SelectItem>
                  <SelectItem value="PAGI">Pagi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-notes">Catatan (opsional)</Label>
              <Input
                id="schedule-notes"
                placeholder="Catatan tambahan"
                value={scheduleForm.notes}
                onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => setShowAddScheduleDialog(false)} disabled={saving}>
              Batal
            </Button>
            <Button
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
              onClick={handleAddSchedule}
              disabled={saving || !scheduleForm.groupId || !scheduleForm.date}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Catat Kehadiran</DialogTitle>
          </DialogHeader>
          {selectedSchedule && (
            <p className="text-sm text-slate-500">
              Jadwal: {formatDateShort(selectedSchedule.date)} — {selectedSchedule.shift === 'MALAM' ? 'Malam' : 'Pagi'}
            </p>
          )}
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Keluarga</Label>
              <Select
                value={attendanceForm.familyId}
                onValueChange={v => setAttendanceForm({ ...attendanceForm, familyId: v })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Pilih keluarga" />
                </SelectTrigger>
                <SelectContent>
                  {families.filter(f => f.isActive).map(family => (
                    <SelectItem key={family.id} value={family.id}>
                      {family.familyHead}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status Kehadiran</Label>
              <Select
                value={attendanceForm.status}
                onValueChange={v => setAttendanceForm({ ...attendanceForm, status: v })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HADIR">Hadir</SelectItem>
                  <SelectItem value="TIDAK_HADIR">Tidak Hadir</SelectItem>
                  <SelectItem value="IZIN">Izin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance-notes">Catatan (opsional)</Label>
              <Input
                id="attendance-notes"
                placeholder="Alasan izin, dll."
                value={attendanceForm.notes}
                onChange={e => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => setShowAttendanceDialog(false)} disabled={saving}>
              Batal
            </Button>
            <Button
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
              onClick={handleMarkAttendance}
              disabled={saving || !attendanceForm.familyId}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Jimpitan Dialog */}
      <Dialog open={showAddJimpitanDialog} onOpenChange={setShowAddJimpitanDialog}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Tambah Jimpitan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Keluarga</Label>
              <Select
                value={jimpitanForm.familyId}
                onValueChange={v => setJimpitanForm({ ...jimpitanForm, familyId: v })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Pilih keluarga" />
                </SelectTrigger>
                <SelectContent>
                  {families.filter(f => f.isActive).map(family => (
                    <SelectItem key={family.id} value={family.id}>
                      {family.familyHead}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jimpitan-date">Tanggal</Label>
              <Input
                id="jimpitan-date"
                type="date"
                value={jimpitanForm.date}
                onChange={e => setJimpitanForm({ ...jimpitanForm, date: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jimpitan-amount">Jumlah (Rp)</Label>
              <Input
                id="jimpitan-amount"
                type="number"
                min={0}
                placeholder="0"
                value={jimpitanForm.amount || ''}
                onChange={e => setJimpitanForm({ ...jimpitanForm, amount: parseInt(e.target.value) || 0 })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label>Status Pembayaran</Label>
              <Select
                value={jimpitanForm.isPaid ? 'paid' : 'unpaid'}
                onValueChange={v => setJimpitanForm({ ...jimpitanForm, isPaid: v === 'paid' })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Belum Bayar</SelectItem>
                  <SelectItem value="paid">Sudah Dibayar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jimpitan-notes">Catatan (opsional)</Label>
              <Input
                id="jimpitan-notes"
                placeholder="Catatan tambahan"
                value={jimpitanForm.notes}
                onChange={e => setJimpitanForm({ ...jimpitanForm, notes: e.target.value })}
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => setShowAddJimpitanDialog(false)} disabled={saving}>
              Batal
            </Button>
            <Button
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
              onClick={handleAddJimpitan}
              disabled={saving || !jimpitanForm.familyId || !jimpitanForm.date || jimpitanForm.amount <= 0}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
