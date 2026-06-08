'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDateShort } from '@/lib/constants';
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
  DialogDescription,
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
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Users,
  CheckCircle2,
  XCircle,
  Wallet,
  CircleDollarSign,
  ArrowRightLeft,
  Trash2,
  Plus,
  Calendar,
  Save,
  Clock,
  AlertTriangle,
  ChevronDown,
  Banknote,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface RondaGroupFamily {
  id: string;
  familyHead: string;
  address: string;
  memberCount?: number;
  _count?: { familyMembers: number };
  rondaGroupId: string;
  rondaStatus?: string;
}

interface RondaGroup {
  id: string;
  name: string;
  dayOfWeek: number;
  description: string | null;
  isActive: boolean;
  families: RondaGroupFamily[];
}

interface EnrollmentFamily {
  id: string;
  familyHead: string;
  address: string;
  memberCount?: number;
  isActive: boolean;
  enrollmentId: string | null;
  enrolledAt: string | null;
}

interface CollectionEntry {
  familyId: string;
  familyHead: string;
  jimpitanType: 'HARIAN' | 'BULANAN';
  monthlyAmount: number;
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
    totalBulanan: number;
    totalExpected: number;
    totalPaid: number;
    totalShortage: number;
  };
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

interface RondaJimpitanPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

// ============================================
// DAY HELPERS
// ============================================

const DAY_NAMES: Record<number, string> = {
  0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu',
  4: 'Kamis', 5: 'Jumat', 6: 'Sabtu',
};

const DAY_LABELS: Record<number, string> = {
  0: 'Sabtu malam', 1: 'Minggu malam', 2: 'Senin malam',
  3: 'Selasa malam', 4: 'Rabu malam', 5: 'Kamis malam', 6: 'Jumat malam',
};

const JIMPITAN_QUICK_VALUES = [0, 500, 1000];

// ============================================
// COMPONENT
// ============================================

export function RondaJimpitanPage({ userId, familyId, isAdmin }: RondaJimpitanPageProps) {
  // ---- Tab state ----
  const [activeTab, setActiveTab] = useState('groups');

  // ---- Tab 1: Grup Ronda ----
  const [groups, setGroups] = useState<RondaGroup[]>([]);
  const [allFamilies, setAllFamilies] = useState<RondaGroupFamily[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [manageGroup, setManageGroup] = useState<RondaGroup | null>(null);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [movingFamily, setMovingFamily] = useState<RondaGroupFamily | null>(null);
  const [targetGroupId, setTargetGroupId] = useState('');
  const [addFamilyId, setAddFamilyId] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  // ---- Tab 2: Daftar Jimpitan ----
  const [enrollmentFamilies, setEnrollmentFamilies] = useState<EnrollmentFamily[]>([]);
  const [loadingEnrollment, setLoadingEnrollment] = useState(true);
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [togglingEnrollment, setTogglingEnrollment] = useState<string | null>(null);

  // ---- Tab 3: Tarik Jimpitan ----
  const [collectionDate, setCollectionDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [editedEntries, setEditedEntries] = useState<Map<string, { paidAmount: number; notes: string }>>(new Map());
  const [savingCollection, setSavingCollection] = useState(false);

  // ---- Tab 4: Kekurangan ----
  const [shortageSummary, setShortageSummary] = useState<ShortageSummary[]>([]);
  const [loadingShortage, setLoadingShortage] = useState(true);
  const [selectedSelapananId, setSelectedSelapananId] = useState<string>('all');
  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const [settlingShortage, setSettlingShortage] = useState<ShortageEntry & { selapananId: string } | null>(null);
  const [settleAmount, setSettleAmount] = useState(0);
  const [savingSettle, setSavingSettle] = useState(false);

  // ----------------------------------------
  // Data Fetching
  // ----------------------------------------

  const fetchGroups = useCallback(async (): Promise<RondaGroup[]> => {
    setLoadingGroups(true);
    try {
      const res = await api.get('/ronda/groups');
      if (res.ok) {
        const data = await res.json();
        const groupList: RondaGroup[] = data.groups ?? [];
        setGroups(groupList);

        // Also fetch all families for the unassigned dropdown
        const famRes = await api.get('/families');
        if (famRes.ok) {
          const famData = await famRes.json();
          const famList: RondaGroupFamily[] = (Array.isArray(famData) ? famData : famData.families ?? [])
            .filter((f: { isActive?: boolean }) => f.isActive !== false);
          setAllFamilies(famList);
        }
        return groupList;
      }
    } catch {
      // silent
    } finally {
      setLoadingGroups(false);
    }
    return [];
  }, []);

  const fetchEnrollment = useCallback(async () => {
    setLoadingEnrollment(true);
    try {
      const res = await api.get('/jimpitan/enrollment');
      if (res.ok) {
        const data = await res.json();
        setEnrollmentFamilies(data.families ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingEnrollment(false);
    }
  }, []);

  const fetchCollection = useCallback(async () => {
    setLoadingCollection(true);
    try {
      const res = await api.get(`/jimpitan/collection?date=${collectionDate}`);
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
  }, [collectionDate]);

  const fetchShortages = useCallback(async () => {
    setLoadingShortage(true);
    try {
      const res = await api.get('/jimpitan/shortages');
      if (res.ok) {
        const data = await res.json();
        setShortageSummary(data.summary ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingShortage(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchEnrollment();
    fetchShortages();
  }, [fetchGroups, fetchEnrollment, fetchShortages]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  // ----------------------------------------
  // Tab 1: Grup Ronda Handlers
  // ----------------------------------------

  const openManageDialog = (group: RondaGroup) => {
    setManageGroup(group);
    setAddFamilyId('');
    setShowManageDialog(true);
  };

  const unassignedFamilies = useMemo(() => {
    const assignedIds = new Set<string>();
    groups.forEach(g => g.families.forEach(f => assignedIds.add(f.id)));
    // Only show AKTIF ronda families that are not yet assigned to any group
    return allFamilies.filter(f =>
      !assignedIds.has(f.id) &&
      (f.rondaStatus === 'AKTIF' || !f.rondaStatus) // Only AKTIF can join ronda groups
    );
  }, [allFamilies, groups]);

  const handleAddFamilyToGroup = async () => {
    if (!addFamilyId || !manageGroup) return;
    setSavingGroup(true);
    try {
      const res = await api.post('/ronda/groups', { familyId: addFamilyId, groupId: manageGroup.id });
      if (res.ok) {
        toast.success('Anggota berhasil ditambahkan');
        setAddFamilyId('');
        const freshGroups = await fetchGroups();
        // Update manageGroup from freshly fetched data
        const updatedGroup = freshGroups.find(g => g.id === manageGroup.id);
        if (updatedGroup) setManageGroup(updatedGroup);
      } else {
        toast.error('Gagal menambahkan anggota');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleMoveFamily = (family: RondaGroupFamily) => {
    setMovingFamily(family);
    setTargetGroupId('');
    setShowMoveDialog(true);
  };

  const handleConfirmMove = async () => {
    if (!movingFamily || !targetGroupId) return;
    setSavingGroup(true);
    try {
      const res = await api.post('/ronda/groups', { familyId: movingFamily.id, groupId: targetGroupId });
      if (res.ok) {
        toast.success('Anggota berhasil dipindahkan');
        setShowMoveDialog(false);
        setMovingFamily(null);
        setTargetGroupId('');
        const freshGroups = await fetchGroups();
        // Update manageGroup from freshly fetched data
        if (manageGroup) {
          const updatedGroup = freshGroups.find(g => g.id === manageGroup.id);
          if (updatedGroup) setManageGroup(updatedGroup);
        }
      } else {
        toast.error('Gagal memindahkan anggota');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleRemoveFromGroup = async (familyId: string) => {
    if (!manageGroup) return;
    setSavingGroup(true);
    try {
      const res = await api.put('/families', { id: familyId, rondaGroupId: null });
      if (res.ok) {
        toast.success('Anggota berhasil dihapus dari grup');
        const freshGroups = await fetchGroups();
        // Update manageGroup from freshly fetched data
        const updatedGroup = freshGroups.find(g => g.id === manageGroup.id);
        if (updatedGroup) setManageGroup(updatedGroup);
      } else {
        toast.error('Gagal menghapus anggota dari grup');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSavingGroup(false);
    }
  };

  // ----------------------------------------
  // Tab 2: Enrollment Handlers
  // ----------------------------------------

  const handleToggleEnrollment = async (family: EnrollmentFamily) => {
    setTogglingEnrollment(family.id);
    try {
      const res = await api.post('/jimpitan/enrollment', {
        familyId: family.id,
        isActive: !family.isActive,
      });
      if (res.ok) {
        toast.success(family.isActive ? 'Jimpitan dinonaktifkan' : 'Jimpitan diaktifkan');
        await fetchEnrollment();
      } else {
        toast.error('Gagal mengubah status jimpitan');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setTogglingEnrollment(null);
    }
  };

  const filteredEnrollmentFamilies = useMemo(() => {
    if (!enrollmentSearch) return enrollmentFamilies;
    const q = enrollmentSearch.toLowerCase();
    return enrollmentFamilies.filter(
      f => f.familyHead.toLowerCase().includes(q) || f.address.toLowerCase().includes(q)
    );
  }, [enrollmentFamilies, enrollmentSearch]);

  // ----------------------------------------
  // Tab 3: Collection Handlers
  // ----------------------------------------

  const getEntryPaidAmount = (entry: CollectionEntry): number => {
    const edited = editedEntries.get(entry.familyId);
    return edited?.paidAmount ?? entry.paidAmount;
  };

  const getEntryNotes = (entry: CollectionEntry): string => {
    const edited = editedEntries.get(entry.familyId);
    return edited?.notes ?? entry.notes ?? '';
  };

  const setEntryPaidAmount = (familyId: string, amount: number) => {
    setEditedEntries(prev => {
      const next = new Map(prev);
      const existing = next.get(familyId);
      next.set(familyId, { paidAmount: amount, notes: existing?.notes ?? '' });
      return next;
    });
  };

  const setEntryNotes = (familyId: string, notes: string) => {
    setEditedEntries(prev => {
      const next = new Map(prev);
      const existing = next.get(familyId);
      next.set(familyId, { paidAmount: existing?.paidAmount ?? 0, notes });
      return next;
    });
  };

  const getStatusBadge = (paid: number, expected: number) => {
    if (paid === 0) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">Kosong</Badge>;
    if (paid < expected) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">Kurang</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">Lunas</Badge>;
  };

  const computedSummary = useMemo(() => {
    if (!collectionData) return { totalFamilies: 0, totalBulanan: 0, totalPaid: 0, totalShortage: 0 };
    const entries = collectionData.entries;
    const harianEntries = entries.filter(e => e.jimpitanType !== 'BULANAN');
    const bulananEntries = entries.filter(e => e.jimpitanType === 'BULANAN');
    let totalPaid = 0;
    let totalShortage = 0;
    for (const entry of harianEntries) {
      const paid = getEntryPaidAmount(entry);
      const shortage = Math.max(0, entry.expectedAmount - paid);
      totalPaid += paid;
      totalShortage += shortage;
    }
    return {
      totalFamilies: harianEntries.length,
      totalBulanan: bulananEntries.length,
      totalPaid,
      totalShortage,
    };
  }, [collectionData, editedEntries]);

  const handleSaveCollection = async () => {
    if (!collectionData) return;
    setSavingCollection(true);
    try {
      // Only save HARIAN entries (skip BULANAN — they pay monthly)
      const entries = collectionData.entries
        .filter(entry => entry.jimpitanType !== 'BULANAN')
        .map(entry => {
          const edited = editedEntries.get(entry.familyId);
          return {
            familyId: entry.familyId,
            paidAmount: edited?.paidAmount ?? entry.paidAmount,
            notes: edited?.notes ?? entry.notes ?? null,
          };
        });

      const res = await api.post('/jimpitan/collection', {
        date: collectionDate,
        entries,
      });

      if (res.ok) {
        toast.success('Data jimpitan berhasil disimpan');
        await fetchCollection();
      } else {
        toast.error('Gagal menyimpan data jimpitan');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSavingCollection(false);
    }
  };

  // ----------------------------------------
  // Tab 4: Shortage Handlers
  // ----------------------------------------

  const flattenedShortages = useMemo(() => {
    if (selectedSelapananId === 'all') {
      return shortageSummary.flatMap(s =>
        s.shortages.map(sh => ({ ...sh, selapananId: s.selapananId, periodeStart: s.periodeStart, periodeEnd: s.periodeEnd }))
      );
    }
    const selected = shortageSummary.find(s => s.selapananId === selectedSelapananId);
    if (!selected) return [];
    return selected.shortages.map(sh => ({ ...sh, selapananId: selected.selapananId, periodeStart: selected.periodeStart, periodeEnd: selected.periodeEnd }));
  }, [shortageSummary, selectedSelapananId]);

  const getShortageStatusBadge = (entry: ShortageEntry) => {
    if (entry.isSettled) return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">Lunas</Badge>;
    if (entry.settledAmount > 0) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">Dibayar Sebagian</Badge>;
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">Belum Bayar</Badge>;
  };

  const openSettleDialog = (entry: ShortageEntry & { selapananId: string }) => {
    setSettlingShortage(entry);
    setSettleAmount(entry.totalShortage - entry.settledAmount);
    setShowSettleDialog(true);
  };

  const handleSettleShortage = async () => {
    if (!settlingShortage || settleAmount <= 0) return;
    setSavingSettle(true);
    try {
      const res = await api.post('/jimpitan/shortages', {
        selapananId: settlingShortage.selapananId,
        settlements: [{
          familyId: settlingShortage.familyId,
          settledAmount: settleAmount + settlingShortage.settledAmount,
        }],
      });
      if (res.ok) {
        toast.success('Pembayaran kekurangan berhasil dicatat');
        setShowSettleDialog(false);
        setSettlingShortage(null);
        await fetchShortages();
      } else {
        toast.error('Gagal mencatat pembayaran');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSavingSettle(false);
    }
  };

  // ----------------------------------------
  // Loading Skeleton
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

  const todayDutyGroup = useMemo(() => {
    if (!collectionData?.group) return null;
    return collectionData.group;
  }, [collectionData]);

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Ronda &amp; Jimpitan</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Kelola grup ronda, pendaftaran jimpitan, dan penarikan harian
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 h-auto flex-wrap">
          <TabsTrigger
            value="groups"
            className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm"
          >
            <Shield className="w-4 h-4" />
            Grup Ronda
          </TabsTrigger>
          <TabsTrigger
            value="enrollment"
            className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm"
          >
            <Users className="w-4 h-4" />
            Daftar Jimpitan
          </TabsTrigger>
          <TabsTrigger
            value="collection"
            className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm"
          >
            <Wallet className="w-4 h-4" />
            Tarik Jimpitan
          </TabsTrigger>
          <TabsTrigger
            value="shortages"
            className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            Kekurangan
          </TabsTrigger>
        </TabsList>

        {/* ============================================ */}
        {/* TAB 1: GRUP RONDA */}
        {/* ============================================ */}
        <TabsContent value="groups" className="space-y-6">
          {loadingGroups ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {renderSkeleton(7)}
            </div>
          ) : groups.length === 0 ? (
            <Card className="rounded-xl shadow-sm border">
              <CardContent className="p-8 text-center">
                <Shield className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Belum ada grup ronda</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {groups.map(group => (
                <Card
                  key={group.id}
                  className="rounded-xl shadow-sm border hover:shadow-md transition-shadow"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold text-slate-800 truncate">
                          {group.name}
                        </CardTitle>
                        <p className="text-xs text-slate-500">{DAY_LABELS[group.dayOfWeek] ?? DAY_NAMES[group.dayOfWeek]}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Separator className="mb-3" />
                    <p className="text-xs text-slate-500 mb-2">
                      {group.families.length} KK anggota
                    </p>
                    {group.families.length > 0 ? (
                      <div className="space-y-1 mb-3">
                        {group.families.slice(0, 5).map(f => (
                          <p key={f.id} className="text-xs text-slate-700 truncate">
                            • {f.familyHead}
                          </p>
                        ))}
                        {group.families.length > 5 && (
                          <p className="text-xs text-slate-400">
                            +{group.families.length - 5} lainnya
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mb-3">Belum ada anggota</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={() => openManageDialog(group)}
                    >
                      <Users className="w-3.5 h-3.5 mr-1" />
                      Kelola Anggota
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* TAB 2: DAFTAR JIMPITAN */}
        {/* ============================================ */}
        <TabsContent value="enrollment" className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Input
              placeholder="Cari nama KK atau alamat..."
              value={enrollmentSearch}
              onChange={e => setEnrollmentSearch(e.target.value)}
              className="h-10 pl-4 rounded-lg border-slate-200"
            />
          </div>

          {loadingEnrollment ? (
            <div className="space-y-3">{renderSkeleton(5)}</div>
          ) : filteredEnrollmentFamilies.length === 0 ? (
            <Card className="rounded-xl shadow-sm border">
              <CardContent className="p-8 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Belum ada data keluarga</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-12">No</TableHead>
                      <TableHead className="text-xs">Nama KK</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Alamat</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Grup Ronda</TableHead>
                      <TableHead className="text-xs text-center">Status Jimpitan</TableHead>
                      <TableHead className="text-xs text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEnrollmentFamilies.map((family, idx) => {
                      const group = groups.find(g => g.families.some(f => f.id === family.id));
                      return (
                        <TableRow key={family.id}>
                          <TableCell className="text-sm text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="text-sm font-medium text-slate-800">
                            {family.familyHead}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 hidden sm:table-cell">
                            {family.address || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 hidden md:table-cell">
                            {group ? group.name : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={`text-xs ${
                                family.isActive
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {family.isActive ? 'Aktif' : 'Tidak Aktif'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className={`h-8 text-xs ${
                                family.isActive
                                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              }`}
                              onClick={() => handleToggleEnrollment(family)}
                              disabled={togglingEnrollment === family.id}
                            >
                              {togglingEnrollment === family.id ? (
                                <span className="animate-pulse">...</span>
                              ) : family.isActive ? (
                                <>
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  Nonaktifkan
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                  Aktifkan
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* TAB 3: TARIK JIMPITAN */}
        {/* ============================================ */}
        <TabsContent value="collection" className="space-y-4">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Tanggal Penarikan</Label>
              <Input
                type="date"
                value={collectionDate}
                onChange={e => setCollectionDate(e.target.value)}
                className="h-10 w-full sm:w-48 rounded-lg border-slate-200"
              />
            </div>

            {todayDutyGroup && (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <Shield className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{todayDutyGroup.name}</p>
                  <p className="text-xs text-slate-500">jaga malam ini</p>
                </div>
              </div>
            )}

            {collectionData && collectionData.jimpitanAmount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <CircleDollarSign className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-slate-500">Besaran</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {formatCurrency(collectionData.jimpitanAmount)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          {collectionData && (
            <div className={`grid gap-3 ${computedSummary.totalBulanan > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <Card className="rounded-xl shadow-sm border">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">KK Harian</p>
                      <p className="text-lg font-bold text-slate-800">
                        {computedSummary.totalFamilies}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {computedSummary.totalBulanan > 0 && (
                <Card className="rounded-xl shadow-sm border">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">KK Bulanan</p>
                        <p className="text-lg font-bold text-purple-700">
                          {computedSummary.totalBulanan}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="rounded-xl shadow-sm border">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Terkumpul</p>
                      <p className="text-sm sm:text-lg font-bold text-emerald-700">
                        {formatCurrency(computedSummary.totalPaid)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm border">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <Banknote className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Kekurangan</p>
                      <p className="text-sm sm:text-lg font-bold text-red-600">
                        {formatCurrency(computedSummary.totalShortage)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Collection Table */}
          {loadingCollection ? (
            <div className="space-y-3">{renderSkeleton(5)}</div>
          ) : !collectionData || collectionData.entries.length === 0 ? (
            <Card className="rounded-xl shadow-sm border">
              <CardContent className="p-8 text-center">
                <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">
                  Tidak ada KK terdaftar jimpitan untuk tanggal ini
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-12">No</TableHead>
                        <TableHead className="text-xs min-w-[140px]">Nama KK</TableHead>
                        <TableHead className="text-xs min-w-[200px]">Dibayar (Rp)</TableHead>
                        <TableHead className="text-xs text-center w-24">Status</TableHead>
                        <TableHead className="text-xs min-w-[120px]">Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collectionData.entries.map((entry, idx) => {
                        const isBulanan = entry.jimpitanType === 'BULANAN';
                        const paid = getEntryPaidAmount(entry);
                        const notes = getEntryNotes(entry);
                        const expected = entry.expectedAmount;

                        // BULANAN row: disabled, informational only
                        if (isBulanan) {
                          return (
                            <TableRow key={entry.familyId} className="bg-purple-50/40">
                              <TableCell className="text-sm text-slate-400">{idx + 1}</TableCell>
                              <TableCell className="text-sm font-medium text-slate-500">
                                {entry.familyHead}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs">
                                    Bulanan
                                  </Badge>
                                  <span className="text-xs text-purple-600 font-medium">
                                    {formatCurrency(entry.monthlyAmount)}/bln
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 text-xs">
                                  Nonaktif
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-slate-400 italic">Iuran bulanan</span>
                              </TableCell>
                            </TableRow>
                          );
                        }

                        // HARIAN row: normal interactive
                        return (
                          <TableRow key={entry.familyId}>
                            <TableCell className="text-sm text-slate-500">{idx + 1}</TableCell>
                            <TableCell className="text-sm font-medium text-slate-800">
                              {entry.familyHead}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1.5">
                                {/* Quick select buttons */}
                                <div className="flex gap-1">
                                  {JIMPITAN_QUICK_VALUES.map(val => (
                                    <button
                                      key={val}
                                      type="button"
                                      className={`h-8 px-2.5 rounded-md text-xs font-medium border transition-colors ${
                                        paid === val
                                          ? 'bg-emerald-600 text-white border-emerald-600'
                                          : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                                      }`}
                                      onClick={() => setEntryPaidAmount(entry.familyId, val)}
                                    >
                                      {val === 0 ? '0' : val >= 1000 ? `${val / 1000}rb` : val}
                                    </button>
                                  ))}
                                  {/* Custom amount input */}
                                  <Input
                                    type="number"
                                    min={0}
                                    placeholder="Lain"
                                    value={paid > 0 && !JIMPITAN_QUICK_VALUES.includes(paid) ? paid : ''}
                                    onChange={e => {
                                      const v = parseInt(e.target.value);
                                      if (!isNaN(v) && v >= 0) {
                                        setEntryPaidAmount(entry.familyId, v);
                                      }
                                    }}
                                    className="h-8 w-16 text-xs rounded-md border-slate-200 px-2"
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {getStatusBadge(paid, expected)}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                placeholder="Catatan..."
                                value={notes}
                                onChange={e => setEntryNotes(entry.familyId, e.target.value)}
                                className="h-8 text-xs rounded-md border-slate-200 px-2"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  className="h-10 bg-slate-800 hover:bg-slate-700 text-white px-6"
                  onClick={handleSaveCollection}
                  disabled={savingCollection}
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {savingCollection ? 'Menyimpan...' : 'Simpan Semua'}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* TAB 4: KEKURANGAN */}
        {/* ============================================ */}
        <TabsContent value="shortages" className="space-y-4">
          {/* Period Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Label className="text-sm text-slate-600 shrink-0">Periode Selapanan:</Label>
            <Select
              value={selectedSelapananId}
              onValueChange={setSelectedSelapananId}
            >
              <SelectTrigger className="h-10 w-full sm:w-64 rounded-lg border-slate-200">
                <SelectValue placeholder="Pilih periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Periode</SelectItem>
                {shortageSummary.map(s => (
                  <SelectItem key={s.selapananId} value={s.selapananId}>
                    {formatDateShort(s.periodeStart)} — {formatDateShort(s.periodeEnd)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingShortage ? (
            <div className="space-y-3">{renderSkeleton(5)}</div>
          ) : flattenedShortages.length === 0 ? (
            <Card className="rounded-xl shadow-sm border">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Tidak ada data kekurangan</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-12">No</TableHead>
                      <TableHead className="text-xs">Nama KK</TableHead>
                      {selectedSelapananId === 'all' && (
                        <TableHead className="text-xs hidden sm:table-cell">Periode</TableHead>
                      )}
                      <TableHead className="text-xs text-right">Total Kekurangan</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flattenedShortages.map((entry, idx) => (
                      <TableRow key={`${entry.familyId}-${entry.selapananId}`}>
                        <TableCell className="text-sm text-slate-500">{idx + 1}</TableCell>
                        <TableCell className="text-sm font-medium text-slate-800">
                          {entry.familyHead}
                        </TableCell>
                        {selectedSelapananId === 'all' && (
                          <TableCell className="text-xs text-slate-600 hidden sm:table-cell">
                            {formatDateShort(entry.periodeStart)} — {formatDateShort(entry.periodeEnd)}
                          </TableCell>
                        )}
                        <TableCell className="text-sm font-semibold text-red-600 text-right">
                          {formatCurrency(entry.totalShortage - entry.settledAmount)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getShortageStatusBadge(entry)}
                        </TableCell>
                        <TableCell className="text-right">
                          {!entry.isSettled && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => openSettleDialog(entry as ShortageEntry & { selapananId: string })}
                            >
                              <Banknote className="w-3.5 h-3.5 mr-1" />
                              Bayar
                            </Button>
                          )}
                        </TableCell>
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

      {/* Kelola Anggota Dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="rounded-xl max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-slate-800">
              Kelola Anggota — {manageGroup?.name}
            </DialogTitle>
            <DialogDescription>
              Tambah, pindahkan, atau hapus anggota grup ronda
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto max-h-[55vh] pr-1">
            {/* Add member dropdown */}
            {unassignedFamilies.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-slate-600">Tambah KK ke Grup</Label>
                <div className="flex gap-2">
                  <Select value={addFamilyId} onValueChange={setAddFamilyId}>
                    <SelectTrigger className="h-9 text-sm flex-1">
                      <SelectValue placeholder="Pilih KK yang belum terdaftar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedFamilies.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.familyHead}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleAddFamilyToGroup}
                    disabled={!addFamilyId || savingGroup}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Current members */}
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">
                Anggota Saat Ini ({manageGroup?.families.length ?? 0} KK)
              </Label>
              {manageGroup && manageGroup.families.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Belum ada anggota di grup ini
                </p>
              ) : (
                <div className="space-y-2">
                  {manageGroup?.families.map(family => (
                    <div
                      key={family.id}
                      className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {family.familyHead}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {family.address}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-slate-600 hover:bg-slate-100"
                          onClick={() => handleMoveFamily(family)}
                          disabled={savingGroup}
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                          Pindah
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-500 hover:bg-red-50"
                          onClick={() => handleRemoveFromGroup(family.id)}
                          disabled={savingGroup}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pindah Grup Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-800">Pindah Grup</DialogTitle>
            <DialogDescription>
              Pindahkan {movingFamily?.familyHead} ke grup lain
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Grup Tujuan</Label>
              <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Pilih grup tujuan..." />
                </SelectTrigger>
                <SelectContent>
                  {groups
                    .filter(g => g.id !== manageGroup?.id)
                    .map(g => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({DAY_LABELS[g.dayOfWeek]})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => setShowMoveDialog(false)}
              disabled={savingGroup}
            >
              Batal
            </Button>
            <Button
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
              onClick={handleConfirmMove}
              disabled={!targetGroupId || savingGroup}
            >
              {savingGroup ? 'Memindahkan...' : 'Pindahkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settlement Dialog */}
      <Dialog open={showSettleDialog} onOpenChange={setShowSettleDialog}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-800">Bayar Kekurangan</DialogTitle>
            <DialogDescription>
              Catat pembayaran kekurangan jimpitan
            </DialogDescription>
          </DialogHeader>
          {settlingShortage && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                <p className="text-sm font-medium text-slate-800">
                  {settlingShortage.familyHead}
                </p>
                <p className="text-xs text-slate-500">
                  Total kekurangan: <span className="font-semibold text-red-600">{formatCurrency(settlingShortage.totalShortage - settlingShortage.settledAmount)}</span>
                </p>
                {settlingShortage.settledAmount > 0 && (
                  <p className="text-xs text-slate-500">
                    Sudah dibayar: <span className="font-semibold text-emerald-600">{formatCurrency(settlingShortage.settledAmount)}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-600">Jumlah Pembayaran (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  max={settlingShortage.totalShortage - settlingShortage.settledAmount}
                  value={settleAmount || ''}
                  onChange={e => setSettleAmount(parseInt(e.target.value) || 0)}
                  className="h-10"
                  placeholder="0"
                />
                <p className="text-xs text-slate-400">
                  Maks: {formatCurrency(settlingShortage.totalShortage - settlingShortage.settledAmount)}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => setShowSettleDialog(false)}
              disabled={savingSettle}
            >
              Batal
            </Button>
            <Button
              className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSettleShortage}
              disabled={settleAmount <= 0 || savingSettle}
            >
              {savingSettle ? 'Menyimpan...' : 'Bayar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
