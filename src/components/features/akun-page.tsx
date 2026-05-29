'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  ROLES,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  UserCog,
  Search,
  Phone,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  Filter,
} from 'lucide-react';

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

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
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
        setEditDialog(false);
        loadUsers();
      }
    } catch (error) {
      console.error('Failed to update user:', error);
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

  if (loading && users.length === 0) {
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
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog className="w-5 h-5 text-slate-700" />
          <h2 className="text-base font-semibold text-slate-800">Management Akun</h2>
        </div>
        <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
          {users.length} pengguna
        </Badge>
      </div>

      {/* Search and Filters */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardContent className="p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cari nama atau username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Role</Label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Semua Role" />
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
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Semua Status" />
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
        </CardContent>
      </Card>

      {/* User List */}
      {users.length === 0 ? (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardContent className="p-8 text-center">
            <UserCog className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Tidak ada pengguna ditemukan</p>
            <p className="text-xs text-slate-400 mt-1">
              Coba ubah filter atau kata kunci pencarian
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
          {users.map((u) => (
            <Card
              key={u.id}
              className="rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openEditDialog(u)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {u.name}
                      </p>
                      <p className="text-xs text-slate-500">@{u.username}</p>
                      {u.phone && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {u.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-slate-100 text-slate-600"
                    >
                      {ROLE_LABELS[u.role] || u.role}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${STATUS_COLORS[u.status] || 'bg-slate-100 text-slate-600'}`}
                    >
                      {STATUS_LABELS[u.status] || u.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                <Label className="text-sm">
                  Status
                </Label>
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
