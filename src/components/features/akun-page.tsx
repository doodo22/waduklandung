'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  ROLES,
  formatDate,
} from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  UserCog,
  Search,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  Edit2,
} from 'lucide-react';
import { toast } from 'sonner';

interface AkunPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

interface UserItem {
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  phone: string | null;
  address: string | null;
  familyId: string | null;
  createdAt: string;
}

export function AkunPage({ userId, familyId, isAdmin }: AkunPageProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editDialog, setEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      let url = '/users';
      const params: string[] = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (filterRole !== 'all') params.push(`role=${filterRole}`);
      if (filterStatus !== 'all') params.push(`status=${filterStatus}`);
      if (params.length > 0) url += '?' + params.join('&');

      const res = await api.get(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterRole, filterStatus]);

  const openEditDialog = (user: UserItem) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    try {
      setSaving(true);
      const res = await api.put('/users', {
        id: editingUser.id,
        role: editRole,
        status: editStatus,
      });
      if (res.ok) {
        toast.success(`Akun ${editingUser.name} berhasil diperbarui`);
        setEditDialog(false);
        loadUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Gagal memperbarui akun');
      }
    } catch (error) {
      toast.error('Gagal memperbarui akun');
    } finally {
      setSaving(false);
    }
  };

  const roleOptions = Object.entries(ROLES).map(([key, value]) => ({
    value,
    label: ROLE_LABELS[value] || value,
  }));

  const statusOptions = [
    { value: 'PENDING', label: 'Menunggu Verifikasi' },
    { value: 'ACTIVE', label: 'Aktif' },
    { value: 'REJECTED', label: 'Ditolak' },
    { value: 'INACTIVE', label: 'Tidak Aktif' },
  ];

  // Derived stats
  const activeCount = users.filter(u => u.status === 'ACTIVE').length;
  const pendingCount = users.filter(u => u.status === 'PENDING').length;
  const pengurusCount = users.filter(u => ['KETUA_RT', 'SEKRETARIS', 'BENDAHARA', 'PENGURUS'].includes(u.role)).length;

  // Admin guard - after all hooks
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-500">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  if (loading && users.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Management Akun</h1>
          <p className="text-sm text-slate-500">Kelola akun pengguna sistem</p>
        </div>
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-8 w-8 bg-slate-100 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-slate-50 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Management Akun</h1>
        <p className="text-sm text-slate-500">Kelola akun pengguna sistem</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Aktif</p>
              <p className="text-base font-bold text-emerald-700">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Menunggu</p>
              <p className="text-base font-bold text-amber-700">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Pengurus</p>
              <p className="text-base font-bold text-slate-800">{pengurusCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cari nama atau username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="h-9 w-[130px] text-xs">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Role</SelectItem>
              {roleOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-[130px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-3">
              <UserCog className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">Tidak ada pengguna ditemukan</p>
            <p className="text-xs text-slate-400 mt-1">Coba ubah filter atau kata kunci pencarian</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="text-[11px] font-semibold w-8 text-center">#</TableHead>
                  <TableHead className="text-[11px] font-semibold">Nama</TableHead>
                  <TableHead className="text-[11px] font-semibold">Username</TableHead>
                  <TableHead className="text-[11px] font-semibold">No. HP</TableHead>
                  <TableHead className="text-[11px] font-semibold text-center">Role</TableHead>
                  <TableHead className="text-[11px] font-semibold text-center">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold text-center">Terdaftar</TableHead>
                  <TableHead className="text-[11px] font-semibold text-center w-16">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u, idx) => (
                  <TableRow key={u.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-xs text-slate-400 text-center">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{u.name}</p>
                          {u.address && (
                            <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{u.address}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">@{u.username}</TableCell>
                    <TableCell className="text-xs text-slate-600">{u.phone || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] ${
                          u.role === 'KETUA_RT'
                            ? 'bg-slate-800 text-white'
                            : ['SEKRETARIS', 'BENDAHARA', 'PENGURUS'].includes(u.role)
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[9px] ${STATUS_COLORS[u.status] || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[u.status] || u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 text-center">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-slate-100"
                        onClick={() => openEditDialog(u)}
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="rounded-xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Akun</DialogTitle>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {editingUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {editingUser.name}
                  </p>
                  <p className="text-xs text-slate-500">@{editingUser.username}</p>
                </div>
              </div>

              {/* Role Select */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Role
                </Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Select */}
              <div className="space-y-2">
                <Label className="text-sm">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`flex-1 h-10 text-xs ${
                    editStatus === 'ACTIVE'
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : ''
                  }`}
                  onClick={() => setEditStatus('ACTIVE')}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Aktifkan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`flex-1 h-10 text-xs ${
                    editStatus === 'INACTIVE'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : ''
                  }`}
                  onClick={() => setEditStatus('INACTIVE')}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  Nonaktifkan
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditDialog(false)}
              className="h-10"
              disabled={saving}
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving}
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
