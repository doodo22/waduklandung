'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import {
  formatDate,
  STATUS_LABELS,
  STATUS_COLORS,
  ROLE_LABELS,
} from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  UserCheck,
  UserX,
  Clock,
  Phone,
  MapPin,
  User,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ---------- Types ----------

interface UserItem {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  address: string | null;
  role: string;
  status: string;
  createdAt: string;
  familyId: string | null;
}

interface VerifikasiPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

// ---------- Main Component ----------

export function VerifikasiPage({ userId, familyId, isAdmin }: VerifikasiPageProps) {
  const [allVerifications, setAllVerifications] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // AlertDialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogUser, setDialogUser] = useState<UserItem | null>(null);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject'>('approve');

  // ---------- Derived ----------

  const pendingUsers = allVerifications.filter(u => u.status === 'PENDING');
  const processedUsers = allVerifications.filter(u => u.status !== 'PENDING');

  // ---------- Data Fetching ----------

  const fetchVerifications = useCallback(async () => {
    try {
      // Fetch both PENDING and non-PENDING users
      const [pendingRes, activeRes, rejectedRes] = await Promise.all([
        api.get('/users?status=PENDING'),
        api.get('/users?status=ACTIVE'),
        api.get('/users?status=REJECTED'),
      ]);

      const combined: UserItem[] = [];

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        combined.push(...(Array.isArray(data) ? data : data.users ?? []));
      }
      if (activeRes.ok) {
        const data = await activeRes.json();
        combined.push(...(Array.isArray(data) ? data : data.users ?? []));
      }
      if (rejectedRes.ok) {
        const data = await rejectedRes.json();
        combined.push(...(Array.isArray(data) ? data : data.users ?? []));
      }

      // Sort: PENDING first (by newest), then ACTIVE, then REJECTED
      const statusOrder: Record<string, number> = { PENDING: 0, ACTIVE: 1, REJECTED: 2 };
      combined.sort((a, b) => {
        const orderDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
        if (orderDiff !== 0) return orderDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setAllVerifications(combined);
    } catch {
      toast.error('Gagal memuat data verifikasi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  // ---------- Actions ----------

  const openConfirmDialog = (user: UserItem, action: 'approve' | 'reject') => {
    setDialogUser(user);
    setDialogAction(action);
    setDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!dialogUser) return;

    const newStatus = dialogAction === 'approve' ? 'ACTIVE' : 'REJECTED';
    setActionLoading(dialogUser.id);

    try {
      const res = await api.put('/users', { id: dialogUser.id, status: newStatus });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal memperbarui status');
      }

      // Update local state
      setAllVerifications(prev =>
        prev.map(u => (u.id === dialogUser.id ? { ...u, status: newStatus } : u))
      );

      toast.success(
        dialogAction === 'approve'
          ? `${dialogUser.name} berhasil disetujui & ditambahkan ke Data Warga`
          : `Pendaftaran ${dialogUser.name} ditolak`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setActionLoading(null);
      setDialogOpen(false);
      setDialogUser(null);
    }
  };

  // ---------- Render: Loading ----------

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Verifikasi Warga</h1>
          <p className="text-sm text-slate-500">Kelola persetujuan warga baru</p>
        </div>
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2">
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="p-6 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-8 w-8 bg-slate-100 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-28 bg-slate-50 rounded animate-pulse" />
                </div>
                <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Render ----------

  return (
    <div className="space-y-4">
      {/* Header & Stats */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Verifikasi Warga</h1>
        <p className="text-sm text-slate-500">Kelola persetujuan warga baru</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Menunggu</p>
              <p className="text-base font-bold text-amber-700">{pendingUsers.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Disetujui</p>
              <p className="text-base font-bold text-emerald-700">{processedUsers.filter(u => u.status === 'ACTIVE').length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-700" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Ditolak</p>
              <p className="text-base font-bold text-red-700">{processedUsers.filter(u => u.status === 'REJECTED').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Full Verification Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-700">Daftar Verifikasi</h3>
        </div>

        {allVerifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-3">
              <UserCheck className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">Belum ada pendaftaran warga</p>
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
                  <TableHead className="text-[11px] font-semibold">Alamat</TableHead>
                  <TableHead className="text-[11px] font-semibold text-center">Terdaftar</TableHead>
                  <TableHead className="text-[11px] font-semibold text-center">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold text-center w-[140px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user, idx) => {
                  const isActioning = actionLoading === user.id;
                  return (
                    <TableRow key={user.id} className="hover:bg-slate-50/50 bg-amber-50/30">
                      <TableCell className="text-xs text-slate-400 text-center">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{user.name}</p>
                            <p className="text-[10px] text-slate-400">{ROLE_LABELS[user.role] || user.role}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{user.username}</TableCell>
                      <TableCell className="text-xs text-slate-600">{user.phone || '-'}</TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-[180px] truncate">{user.address || '-'}</TableCell>
                      <TableCell className="text-xs text-slate-500 text-center">{formatDate(user.createdAt)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[9px] ${STATUS_COLORS[user.status] || ''}`}>
                          {STATUS_LABELS[user.status] || user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]"
                            disabled={isActioning}
                            onClick={() => openConfirmDialog(user, 'approve')}
                          >
                            {isActioning ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserCheck className="w-3 h-3" />
                            )}
                            Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2.5 text-[10px]"
                            disabled={isActioning}
                            onClick={() => openConfirmDialog(user, 'reject')}
                          >
                            <UserX className="w-3 h-3" />
                            Tolak
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {processedUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-xs text-slate-400 text-center">
                      <div className="flex items-center justify-center">
                        {user.status === 'ACTIVE' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          user.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-700">{user.name}</p>
                          <p className="text-[10px] text-slate-400">{ROLE_LABELS[user.role] || user.role}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{user.username}</TableCell>
                    <TableCell className="text-xs text-slate-500">{user.phone || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[180px] truncate">{user.address || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-400 text-center">{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[9px] ${STATUS_COLORS[user.status] || ''}`}>
                        {STATUS_LABELS[user.status] || user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-[10px] text-slate-400">-</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogAction === 'approve' ? 'Setujui Pendaftaran' : 'Tolak Pendaftaran'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogAction === 'approve'
                ? `Apakah Anda yakin ingin menyetujui pendaftaran ${dialogUser?.name}? Akun akan langsung ditambahkan ke Data Warga sebagai Kepala Keluarga baru.`
                : `Apakah Anda yakin ingin menolak pendaftaran ${dialogUser?.name}? Warga tidak akan dapat mengakses sistem.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={`h-10 ${
                dialogAction === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {dialogAction === 'approve' ? 'Setujui' : 'Tolak'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
