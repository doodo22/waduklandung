'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import {
  formatDate,
  formatDateShort,
  STATUS_LABELS,
  STATUS_COLORS,
  ROLE_LABELS,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  UserCheck,
  UserX,
  Users,
  Clock,
  Phone,
  MapPin,
  User,
  AlertCircle,
} from 'lucide-react';

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

// ---------- Skeleton ----------

function UserCardSkeleton() {
  return (
    <Card className="rounded-xl shadow-sm border">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Main Component ----------

export function VerifikasiPage({ userId, familyId, isAdmin }: VerifikasiPageProps) {
  const [pendingUsers, setPendingUsers] = useState<UserItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  // AlertDialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogUser, setDialogUser] = useState<UserItem | null>(null);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject'>('approve');

  // ---------- Data Fetching ----------

  const fetchPendingUsers = useCallback(async () => {
    try {
      const res = await api.get('/users?status=PENDING');
      if (res.ok) {
        const data = await res.json();
        setPendingUsers(Array.isArray(data) ? data : data.users ?? []);
      }
    } catch {
      // silent - will show empty state
    }
  }, []);

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await api.get('/users');
      if (res.ok) {
        const data = await res.json();
        setAllUsers(Array.isArray(data) ? data : data.users ?? []);
      }
    } catch {
      // silent - will show empty state
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        await Promise.all([fetchPendingUsers(), fetchAllUsers()]);
      } catch {
        if (!cancelled) setError('Gagal memuat data warga');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [fetchPendingUsers, fetchAllUsers]);

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
      setPendingUsers((prev) => prev.filter((u) => u.id !== dialogUser.id));
      setAllUsers((prev) =>
        prev.map((u) => (u.id === dialogUser.id ? { ...u, status: newStatus } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setActionLoading(null);
      setDialogOpen(false);
      setDialogUser(null);
    }
  };

  // ---------- User Card ----------

  function UserCard({ user, showActions = false }: { user: UserItem; showActions?: boolean }) {
    const isActioning = actionLoading === user.id;

    return (
      <Card className="rounded-xl shadow-sm border">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
              {user.name.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[user.status] || ''}`}
                >
                  {STATUS_LABELS[user.status] || user.status}
                </Badge>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {ROLE_LABELS[user.role] || user.role}
                </Badge>
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <User className="h-3 w-3" />
                  <span>{user.username}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Phone className="h-3 w-3" />
                    <span>{user.phone}</span>
                  </div>
                )}
                {user.address && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{user.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span>Terdaftar: {formatDate(user.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            {showActions && (
              <div className="flex sm:flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={isActioning}
                  onClick={() => openConfirmDialog(user, 'approve')}
                >
                  <UserCheck className="h-4 w-4" />
                  Setujui
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-9"
                  disabled={isActioning}
                  onClick={() => openConfirmDialog(user, 'reject')}
                >
                  <UserX className="h-4 w-4" />
                  Tolak
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---------- Empty State ----------

  function EmptyState({ message }: { message: string }) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-3">
          <Users className="h-7 w-7 text-slate-400" />
        </div>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    );
  }

  // ---------- Render: Loading ----------

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Verifikasi Warga</h1>
          <p className="text-sm text-slate-500">Kelola persetujuan warga baru</p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <UserCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Verifikasi Warga</h1>
        <p className="text-sm text-slate-500">Kelola persetujuan warga baru</p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            <UserCheck className="h-3.5 w-3.5" />
            Menunggu Verifikasi
            {pendingUsers.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-[10px]">
                {pendingUsers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Semua Warga
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending">
          {pendingUsers.length === 0 ? (
            <EmptyState message="Tidak ada warga yang menunggu verifikasi" />
          ) : (
            <ScrollArea className="max-h-[calc(100vh-260px)]">
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <UserCard key={user.id} user={user} showActions />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* All Users Tab */}
        <TabsContent value="all">
          {allUsers.length === 0 ? (
            <EmptyState message="Belum ada data warga" />
          ) : (
            <ScrollArea className="max-h-[calc(100vh-260px)]">
              <div className="space-y-3">
                {allUsers.map((user) => (
                  <UserCard key={user.id} user={user} />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogAction === 'approve' ? 'Setujui Pendaftaran' : 'Tolak Pendaftaran'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogAction === 'approve'
                ? `Apakah Anda yakin ingin menyetujui pendaftaran ${dialogUser?.name}? Warga akan dapat mengakses sistem setelah disetujui.`
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
