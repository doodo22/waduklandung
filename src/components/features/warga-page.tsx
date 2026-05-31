'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { api } from '@/lib/api-client';
import {
  GENDER_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RELATIONSHIP_LABELS,
  MARITAL_STATUS_OPTIONS,
  MARITAL_STATUS_LABELS,
  EDUCATION_OPTIONS,
  EDUCATION_LABELS,
  CITIZENSHIP_OPTIONS,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Search,
  Home,
  Shield,
  UserPlus,
  ChevronDown,
  ChevronRight,
  MapPin,
  UserCheck,
  UserX,
  Hash,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface FamilyMember {
  id: string;
  familyId: string;
  userId: string | null;
  fullName: string;
  nik: string | null;
  gender: 'LAKI_LAKI' | 'PEREMPUAN';
  relationship: string;
  maritalStatus: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  education: string | null;
  citizenship: string;
  occupation: string | null;
  isFamilyHead: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RondaGroup {
  id: string;
  name: string;
  dayOfWeek: number;
  description: string | null;
  isActive: boolean;
}

interface Family {
  id: string;
  familyHead: string;
  address: string;
  rondaGroupId: string | null;
  rondaGroup: RondaGroup | null;
  isActive: boolean;
  familyMembers: FamilyMember[];
  users: { id: string; name: string; phone: string | null }[];
  createdAt: string;
  updatedAt: string;
}

interface MemberFormData {
  fullName: string;
  nik: string;
  gender: string;
  relationship: string;
  maritalStatus: string;
  birthPlace: string;
  birthDate: string;
  education: string;
  citizenship: string;
  occupation: string;
  isFamilyHead: boolean;
}

interface FamilyFormData {
  familyHead: string;
  address: string;
  rondaGroupId: string;
}

const EMPTY_MEMBER_FORM: MemberFormData = {
  fullName: '',
  nik: '',
  gender: 'LAKI_LAKI',
  relationship: 'ANAK',
  maritalStatus: '',
  birthPlace: '',
  birthDate: '',
  education: '',
  citizenship: 'WNI',
  occupation: '',
  isFamilyHead: false,
};

const EMPTY_FAMILY_FORM: FamilyFormData = {
  familyHead: '',
  address: '',
  rondaGroupId: '',
};

// ============================================
// HELPERS
// ============================================

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getRelationshipBadgeVariant(relationship: string): string {
  switch (relationship) {
    case 'KEPALA_KELUARGA':
      return 'bg-slate-800 text-white';
    case 'SUAMI_ISTRI':
      return 'bg-emerald-100 text-emerald-700';
    case 'ANAK':
      return 'bg-sky-100 text-sky-700';
    case 'MENANTU':
      return 'bg-amber-100 text-amber-700';
    case 'CUCU':
      return 'bg-purple-100 text-purple-700';
    case 'ORANG_TUA':
      return 'bg-rose-100 text-rose-700';
    case 'MERTUA':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

// ============================================
// COMPONENT
// ============================================

export function WargaPage({ userId, familyId, isAdmin }: { userId: string; familyId: string | null; isAdmin: boolean }) {
  // ---- Core data state ----
  const [families, setFamilies] = useState<Family[]>([]);
  const [rondaGroups, setRondaGroups] = useState<RondaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ---- Expandable row state ----
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Set<string>>(new Set());
  const [membersMap, setMembersMap] = useState<Record<string, FamilyMember[]>>({});
  const [loadingMembersIds, setLoadingMembersIds] = useState<Set<string>>(new Set());

  // ---- Family dialog state ----
  const [showFamilyDialog, setShowFamilyDialog] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [familyForm, setFamilyForm] = useState<FamilyFormData>(EMPTY_FAMILY_FORM);
  const [savingFamily, setSavingFamily] = useState(false);

  // ---- Member dialog state ----
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberForm, setMemberForm] = useState<MemberFormData>(EMPTY_MEMBER_FORM);
  const [savingMember, setSavingMember] = useState(false);
  const [memberFamilyId, setMemberFamilyId] = useState<string | null>(null);

  // ---- Delete confirm dialog ----
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingMember, setDeletingMember] = useState<FamilyMember | null>(null);
  const [deletingFamily, setDeletingFamily] = useState<Family | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ----------------------------------------
  // Data Fetching
  // ----------------------------------------

  const fetchFamilies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/families');
      if (res.ok) {
        const data = await res.json();
        const fams = Array.isArray(data) ? data : data.families ?? [];
        setFamilies(fams);
        // Pre-populate membersMap from included data
        const map: Record<string, FamilyMember[]> = {};
        fams.forEach((f: Family) => {
          if (f.familyMembers?.length) {
            map[f.id] = f.familyMembers;
          }
        });
        setMembersMap(prev => ({ ...prev, ...map }));
      }
    } catch {
      toast.error('Gagal memuat data keluarga');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRondaGroups = useCallback(async () => {
    try {
      const res = await api.get('/ronda/groups');
      if (res.ok) {
        const data = await res.json();
        setRondaGroups(data.groups ?? []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchMembers = useCallback(async (famId: string) => {
    setLoadingMembersIds(prev => new Set(prev).add(famId));
    try {
      const res = await api.get(`/family-members?familyId=${famId}`);
      if (res.ok) {
        const data = await res.json();
        setMembersMap(prev => ({ ...prev, [famId]: data.members ?? [] }));
      }
    } catch {
      toast.error('Gagal memuat data anggota');
    } finally {
      setLoadingMembersIds(prev => {
        const next = new Set(prev);
        next.delete(famId);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    fetchFamilies();
    fetchRondaGroups();
  }, [fetchFamilies, fetchRondaGroups]);

  // ----------------------------------------
  // Derived Data
  // ----------------------------------------

  const filteredFamilies = families.filter(f => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      f.familyHead.toLowerCase().includes(q) ||
      f.address.toLowerCase().includes(q) ||
      (f.rondaGroup?.name && f.rondaGroup.name.toLowerCase().includes(q))
    );
  });

  const rondaGroupName = (groupId: string | null): string => {
    if (!groupId) return '-';
    const group = rondaGroups.find(g => g.id === groupId);
    return group ? group.name : '-';
  };

  const totalKK = families.filter(f => f.isActive).length;
  const totalWarga = families.reduce((sum, f) => sum + (f.familyMembers?.length ?? 0), 0);

  // ----------------------------------------
  // Expand/Collapse
  // ----------------------------------------

  const toggleExpand = (familyId: string) => {
    setExpandedFamilyIds(prev => {
      const next = new Set(prev);
      if (next.has(familyId)) {
        next.delete(familyId);
      } else {
        next.add(familyId);
        // Fetch fresh members if not already loaded
        if (!membersMap[familyId]) {
          fetchMembers(familyId);
        }
      }
      return next;
    });
  };

  // ----------------------------------------
  // Family Handlers
  // ----------------------------------------

  const openAddFamilyDialog = () => {
    setEditingFamily(null);
    setFamilyForm(EMPTY_FAMILY_FORM);
    setShowFamilyDialog(true);
  };

  const openEditFamilyDialog = (family: Family, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingFamily(family);
    setFamilyForm({
      familyHead: family.familyHead,
      address: family.address,
      rondaGroupId: family.rondaGroupId ?? '',
    });
    setShowFamilyDialog(true);
  };

  const handleSaveFamily = async () => {
    if (!familyForm.familyHead.trim() || !familyForm.address.trim()) {
      toast.error('Nama Kepala Keluarga dan Alamat wajib diisi');
      return;
    }
    setSavingFamily(true);
    try {
      if (editingFamily) {
        const res = await api.put('/families', {
          id: editingFamily.id,
          familyHead: familyForm.familyHead.trim(),
          address: familyForm.address.trim(),
          rondaGroupId: familyForm.rondaGroupId || null,
        });
        if (res.ok) {
          toast.success('Data keluarga berhasil diperbarui');
          setShowFamilyDialog(false);
          await fetchFamilies();
        } else {
          toast.error('Gagal memperbarui data keluarga');
        }
      } else {
        const res = await api.post('/families', {
          familyHead: familyForm.familyHead.trim(),
          address: familyForm.address.trim(),
          rondaGroupId: familyForm.rondaGroupId || null,
        });
        if (res.ok) {
          toast.success('Keluarga baru berhasil ditambahkan');
          setShowFamilyDialog(false);
          await fetchFamilies();
        } else {
          toast.error('Gagal menambahkan keluarga');
        }
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSavingFamily(false);
    }
  };

  const handleToggleFamilyStatus = async (family: Family, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newStatus = !family.isActive;
    const statusText = newStatus ? 'mengaktifkan' : 'menonaktifkan';
    try {
      const res = await api.put('/families', {
        id: family.id,
        isActive: newStatus,
      });
      if (res.ok) {
        toast.success(`Keluarga berhasil ${statusText}`);
        await fetchFamilies();
      } else {
        toast.error(`Gagal ${statusText} keluarga`);
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }
  };

  const confirmDeleteFamily = (family: Family, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeletingFamily(family);
    setDeletingMember(null);
    setShowDeleteDialog(true);
  };

  const handleDeleteFamily = async () => {
    if (!deletingFamily) return;
    setDeleting(true);
    try {
      const famMembers = membersMap[deletingFamily.id] ?? deletingFamily.familyMembers ?? [];
      for (const member of famMembers) {
        await api.delete(`/family-members?id=${member.id}`);
      }
      const res = await api.put('/families', {
        id: deletingFamily.id,
        isActive: false,
      });
      if (res.ok) {
        toast.success('Keluarga berhasil dihapus');
        setExpandedFamilyIds(prev => {
          const next = new Set(prev);
          next.delete(deletingFamily.id);
          return next;
        });
        setShowDeleteDialog(false);
        setDeletingFamily(null);
        await fetchFamilies();
      } else {
        toast.error('Gagal menghapus keluarga');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setDeleting(false);
    }
  };

  // ----------------------------------------
  // Member Handlers
  // ----------------------------------------

  const openAddMemberDialog = (famId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingMember(null);
    setMemberFamilyId(famId);
    setMemberForm({ ...EMPTY_MEMBER_FORM });
    setShowMemberDialog(true);
  };

  const openEditMemberDialog = (member: FamilyMember, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingMember(member);
    setMemberFamilyId(member.familyId);
    setMemberForm({
      fullName: member.fullName,
      nik: member.nik ?? '',
      gender: member.gender,
      relationship: member.relationship,
      maritalStatus: member.maritalStatus ?? '',
      birthPlace: member.birthPlace ?? '',
      birthDate: member.birthDate ? member.birthDate.split('T')[0] : '',
      education: member.education ?? '',
      citizenship: member.citizenship || 'WNI',
      occupation: member.occupation ?? '',
      isFamilyHead: member.isFamilyHead,
    });
    setShowMemberDialog(true);
  };

  const handleSaveMember = async () => {
    if (!memberFamilyId) return;
    if (!memberForm.fullName.trim()) {
      toast.error('Nama Lengkap wajib diisi');
      return;
    }
    if (!memberForm.gender) {
      toast.error('Jenis Kelamin wajib diisi');
      return;
    }
    if (!memberForm.relationship) {
      toast.error('Hubungan Keluarga wajib diisi');
      return;
    }

    setSavingMember(true);
    try {
      const payload: Record<string, unknown> = {
        familyId: memberFamilyId,
        fullName: memberForm.fullName.trim(),
        nik: memberForm.nik.trim() || null,
        gender: memberForm.gender,
        relationship: memberForm.relationship,
        maritalStatus: memberForm.maritalStatus || null,
        birthPlace: memberForm.birthPlace.trim() || null,
        birthDate: memberForm.birthDate || null,
        education: memberForm.education || null,
        citizenship: memberForm.citizenship || 'WNI',
        occupation: memberForm.occupation.trim() || null,
        isFamilyHead: memberForm.isFamilyHead,
      };

      if (editingMember) {
        payload.id = editingMember.id;
        delete payload.familyId;
        const res = await api.put('/family-members', payload);
        if (res.ok) {
          toast.success('Data anggota berhasil diperbarui');
          setShowMemberDialog(false);
          await fetchMembers(memberFamilyId);
          await fetchFamilies();
        } else {
          toast.error('Gagal memperbarui data anggota');
        }
      } else {
        const res = await api.post('/family-members', payload);
        if (res.ok) {
          toast.success('Anggota baru berhasil ditambahkan');
          setShowMemberDialog(false);
          await fetchMembers(memberFamilyId);
          await fetchFamilies();
        } else {
          toast.error('Gagal menambahkan anggota');
        }
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSavingMember(false);
    }
  };

  const confirmDeleteMember = (member: FamilyMember, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeletingMember(member);
    setDeletingFamily(null);
    setShowDeleteDialog(true);
  };

  const handleDeleteMember = async () => {
    if (!deletingMember) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/family-members?id=${deletingMember.id}`);
      if (res.ok) {
        toast.success('Anggota berhasil dihapus');
        setShowDeleteDialog(false);
        setDeletingMember(null);
        if (memberFamilyId || deletingMember.familyId) {
          await fetchMembers(deletingMember.familyId);
          await fetchFamilies();
        }
      } else {
        toast.error('Gagal menghapus anggota');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setDeleting(false);
    }
  };

  // ----------------------------------------
  // Loading Skeleton
  // ----------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-36 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-4 w-48 bg-slate-100 rounded animate-pulse mt-1.5" />
          </div>
          <div className="h-10 w-36 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------
  // Render: Stats Summary
  // ----------------------------------------

  const renderStats = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
            <Hash className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total KK</p>
            <p className="text-lg font-bold text-slate-800">{totalKK}</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Users className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Warga</p>
            <p className="text-lg font-bold text-slate-800">{totalWarga}</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-sky-700" />
          </div>
          <div>
            <p className="text-xs text-slate-500">KK Aktif</p>
            <p className="text-lg font-bold text-slate-800">{families.filter(f => f.isActive).length}</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
            <UserX className="w-4 h-4 text-red-700" />
          </div>
          <div>
            <p className="text-xs text-slate-500">KK Nonaktif</p>
            <p className="text-lg font-bold text-slate-800">{families.filter(f => !f.isActive).length}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ----------------------------------------
  // Render: Member Sub-Table (inside expanded row)
  // ----------------------------------------

  const renderMemberSubTable = (famId: string) => {
    const members = membersMap[famId];
    const isLoading = loadingMembersIds.has(famId);

    if (isLoading) {
      return (
        <div className="p-4 space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      );
    }

    if (!members || members.length === 0) {
      return (
        <div className="p-4 text-center">
          <p className="text-sm text-slate-400">Belum ada data anggota</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-[11px] font-semibold w-8 text-center">No</TableHead>
              <TableHead className="text-[11px] font-semibold min-w-[140px]">Nama</TableHead>
              <TableHead className="text-[11px] font-semibold w-8 text-center">JK</TableHead>
              <TableHead className="text-[11px] font-semibold w-28">Hubungan</TableHead>
              <TableHead className="text-[11px] font-semibold w-24 hidden sm:table-cell">Status</TableHead>
              <TableHead className="text-[11px] font-semibold min-w-[100px] hidden md:table-cell">Tempat Lahir</TableHead>
              <TableHead className="text-[11px] font-semibold min-w-[100px] hidden md:table-cell">Tgl Lahir</TableHead>
              <TableHead className="text-[11px] font-semibold w-16 hidden lg:table-cell">Pendidikan</TableHead>
              <TableHead className="text-[11px] font-semibold w-10 text-center hidden sm:table-cell">WN</TableHead>
              <TableHead className="text-[11px] font-semibold min-w-[80px] hidden lg:table-cell">Pekerjaan</TableHead>
              {isAdmin && (
                <TableHead className="text-[11px] font-semibold w-16 text-center">Aksi</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member, idx) => (
              <TableRow key={member.id} className="hover:bg-slate-50/50">
                <TableCell className="text-xs text-slate-400 text-center">{idx + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-800">
                      {member.fullName}
                    </span>
                    {member.isFamilyHead && (
                      <Badge className="text-[8px] px-1 py-0 bg-slate-800 text-white hover:bg-slate-800 shrink-0">
                        KK
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-slate-600 text-center">
                  {member.gender === 'LAKI_LAKI' ? 'L' : 'P'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`text-[9px] ${getRelationshipBadgeVariant(member.relationship)}`}
                  >
                    {RELATIONSHIP_LABELS[member.relationship] || member.relationship}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-500 hidden sm:table-cell">
                  {member.maritalStatus
                    ? MARITAL_STATUS_LABELS[member.maritalStatus] || member.maritalStatus
                    : '-'}
                </TableCell>
                <TableCell className="text-xs text-slate-500 hidden md:table-cell">
                  {member.birthPlace || '-'}
                </TableCell>
                <TableCell className="text-xs text-slate-500 hidden md:table-cell">
                  {formatShortDate(member.birthDate)}
                </TableCell>
                <TableCell className="text-xs text-slate-500 hidden lg:table-cell">
                  {member.education
                    ? EDUCATION_LABELS[member.education] || member.education
                    : '-'}
                </TableCell>
                <TableCell className="text-xs text-slate-600 text-center hidden sm:table-cell">
                  {member.citizenship}
                </TableCell>
                <TableCell className="text-xs text-slate-500 hidden lg:table-cell">
                  {member.occupation || '-'}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex items-center justify-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
                        onClick={(e) => openEditMemberDialog(member, e)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                        onClick={(e) => confirmDeleteMember(member, e)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // ----------------------------------------
  // Render: Desktop Expandable Table
  // ----------------------------------------

  const renderDesktopTable = () => (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Table Header Bar */}
      <div className="flex items-center justify-between p-4 border-b bg-slate-50/50">
        <div className="flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cari nama KK, alamat, grup ronda..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-64 rounded-lg border-slate-200 text-sm"
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-slate-400 hover:text-slate-600"
              onClick={() => setSearch('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <span className="text-xs text-slate-400">
            {filteredFamilies.length} keluarga
          </span>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            className="h-9 bg-slate-800 hover:bg-slate-700 text-white text-xs"
            onClick={openAddFamilyDialog}
          >
            <Plus className="w-4 h-4 mr-1" />
            Tambah KK
          </Button>
        )}
      </div>

      {/* Table */}
      {filteredFamilies.length === 0 ? (
        <div className="p-12 text-center">
          <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Belum ada data keluarga</p>
          <p className="text-sm text-slate-400 mt-1">
            {search ? 'Tidak ditemukan keluarga yang sesuai' : 'Klik "Tambah KK" untuk menambahkan data'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="text-xs font-semibold w-8"></TableHead>
                <TableHead className="text-xs font-semibold w-10 text-center">No</TableHead>
                <TableHead className="text-xs font-semibold min-w-[160px]">Kepala Keluarga</TableHead>
                <TableHead className="text-xs font-semibold min-w-[180px]">Alamat</TableHead>
                <TableHead className="text-xs font-semibold w-32 hidden lg:table-cell">Grup Ronda</TableHead>
                <TableHead className="text-xs font-semibold w-16 text-center">Anggota</TableHead>
                <TableHead className="text-xs font-semibold w-16 text-center">Status</TableHead>
                {isAdmin && (
                  <TableHead className="text-xs font-semibold w-28 text-center">Aksi</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFamilies.map((family, idx) => {
                const isExpanded = expandedFamilyIds.has(family.id);
                const memberCount = family.familyMembers?.length ?? membersMap[family.id]?.length ?? 0;

                return (
                  <Fragment key={family.id}>
                    {/* Main KK Row */}
                    <TableRow
                      className={`cursor-pointer transition-colors ${
                        isExpanded
                          ? 'bg-slate-50 hover:bg-slate-50'
                          : 'hover:bg-slate-50/50'
                      }`}
                      onClick={() => toggleExpand(family.id)}
                    >
                      <TableCell className="w-8">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(family.id); }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 text-center">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                            <Home className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {family.familyHead}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{family.address}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {family.rondaGroupId ? (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
                            <Shield className="w-3 h-3 mr-0.5" />
                            {rondaGroupName(family.rondaGroupId)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600">
                          {memberCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[9px] ${
                          family.isActive
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-red-100 text-red-700 hover:bg-red-100'
                        }`}>
                          {family.isActive ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex items-center justify-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                              onClick={(e) => openEditFamilyDialog(family, e)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 w-7 p-0 ${
                                family.isActive
                                  ? 'text-slate-400 hover:text-red-600'
                                  : 'text-emerald-500 hover:text-emerald-600'
                              }`}
                              onClick={(e) => handleToggleFamilyStatus(family, e)}
                            >
                              {family.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                              onClick={(e) => confirmDeleteFamily(family, e)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>

                    {/* Expanded Members Row */}
                    {isExpanded && (
                      <TableRow className="bg-slate-50/30">
                        <TableCell colSpan={isAdmin ? 8 : 7} className="p-0">
                          <div className="border-t border-slate-200">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" />
                                Anggota Keluarga
                              </span>
                              {isAdmin && (
                                <Button
                                  size="sm"
                                  className="h-7 bg-slate-800 hover:bg-slate-700 text-white text-[11px]"
                                  onClick={(e) => openAddMemberDialog(family.id, e)}
                                >
                                  <UserPlus className="w-3 h-3 mr-1" />
                                  Tambah
                                </Button>
                              )}
                            </div>
                            {renderMemberSubTable(family.id)}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  // ----------------------------------------
  // Render: Mobile Expandable Cards
  // ----------------------------------------

  const renderMobileCards = () => (
    <div className="space-y-3">
      {/* Header + Search */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Data Warga</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filteredFamilies.length} keluarga terdaftar
          </p>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            className="h-9 bg-slate-800 hover:bg-slate-700 text-white text-xs"
            onClick={openAddFamilyDialog}
          >
            <Plus className="w-4 h-4 mr-1" />
            Tambah
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Cari keluarga, alamat..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-10 pl-9 rounded-lg border-slate-200"
        />
      </div>

      {/* Family Cards */}
      {filteredFamilies.length === 0 ? (
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada data keluarga</p>
            <p className="text-sm text-slate-400 mt-1">
              {search ? 'Tidak ditemukan' : 'Tambahkan data keluarga baru'}
            </p>
          </CardContent>
        </Card>
      ) : (
        filteredFamilies.map(family => {
          const isExpanded = expandedFamilyIds.has(family.id);
          const memberCount = family.familyMembers?.length ?? membersMap[family.id]?.length ?? 0;
          const members = membersMap[family.id] ?? family.familyMembers ?? [];

          return (
            <Collapsible
              key={family.id}
              open={isExpanded}
              onOpenChange={() => toggleExpand(family.id)}
            >
              <Card className={`rounded-xl shadow-sm border transition-all ${isExpanded ? 'ring-1 ring-slate-200' : ''}`}>
                {/* KK Header Card */}
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isExpanded ? 'bg-slate-800' : 'bg-slate-100'
                      }`}>
                        <Home className={`w-4 h-4 ${isExpanded ? 'text-white' : 'text-slate-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-semibold text-sm text-slate-800 truncate">
                            {family.familyHead}
                          </h3>
                          {!family.isActive && (
                            <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700 shrink-0">
                              Nonaktif
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{family.address}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600">
                            <Users className="w-3 h-3 mr-0.5" />
                            {memberCount} anggota
                          </Badge>
                          {family.rondaGroupId && (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
                              <Shield className="w-3 h-3 mr-0.5" />
                              {rondaGroupName(family.rondaGroupId)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 mt-2" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-2" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>

                {/* Admin Actions for this family */}
                {isAdmin && (
                  <div className="px-4 pb-2 flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={(e) => openEditFamilyDialog(family, e)}
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-7 text-[11px] ${
                        family.isActive
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                      }`}
                      onClick={(e) => handleToggleFamilyStatus(family, e)}
                    >
                      {family.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] border-red-200 text-red-600 hover:bg-red-50"
                      onClick={(e) => confirmDeleteFamily(family, e)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Hapus
                    </Button>
                  </div>
                )}

                {/* Expanded Member Cards */}
                <CollapsibleContent>
                  <div className="border-t px-4 pt-3 pb-4 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Anggota Keluarga
                      </span>
                      {isAdmin && (
                        <Button
                          size="sm"
                          className="h-7 bg-slate-800 hover:bg-slate-700 text-white text-[11px]"
                          onClick={(e) => openAddMemberDialog(family.id, e)}
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          Tambah
                        </Button>
                      )}
                    </div>

                    {loadingMembersIds.has(family.id) ? (
                      <div className="space-y-2">
                        {[1, 2].map(i => (
                          <div key={i} className="h-14 bg-white rounded-lg animate-pulse" />
                        ))}
                      </div>
                    ) : members.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">Belum ada anggota</p>
                    ) : (
                      members.map(member => (
                        <div
                          key={member.id}
                          className="rounded-lg border bg-white p-3 space-y-1.5"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-slate-800">
                                {member.fullName}
                              </span>
                              {member.isFamilyHead && (
                                <Badge className="text-[8px] px-1 py-0 bg-slate-800 text-white hover:bg-slate-800">
                                  KK
                                </Badge>
                              )}
                            </div>
                            <Badge
                              variant="secondary"
                              className={`text-[9px] ${getRelationshipBadgeVariant(member.relationship)}`}
                            >
                              {RELATIONSHIP_LABELS[member.relationship] || member.relationship}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-500">
                            <span>JK: {member.gender === 'LAKI_LAKI' ? 'Laki-laki' : 'Perempuan'}</span>
                            <span>WN: {member.citizenship}</span>
                            {member.maritalStatus && (
                              <span>Status: {MARITAL_STATUS_LABELS[member.maritalStatus] || member.maritalStatus}</span>
                            )}
                            {member.education && (
                              <span>Pendidikan: {EDUCATION_LABELS[member.education] || member.education}</span>
                            )}
                            {member.birthPlace && (
                              <span className="col-span-2">Lahir: {member.birthPlace}{member.birthDate ? `, ${formatShortDate(member.birthDate)}` : ''}</span>
                            )}
                            {member.occupation && (
                              <span>Pekerjaan: {member.occupation}</span>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px] text-slate-400 hover:text-slate-700"
                                onClick={(e) => openEditMemberDialog(member, e)}
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px] text-slate-400 hover:text-red-600"
                                onClick={(e) => confirmDeleteMember(member, e)}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Hapus
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })
      )}
    </div>
  );

  // ----------------------------------------
  // Main Render
  // ----------------------------------------

  return (
    <div className="space-y-4">
      {/* Desktop Header */}
      <div className="hidden lg:flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Data Warga</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola data keluarga dan anggota warga RT
          </p>
        </div>
      </div>

      {/* Stats */}
      {renderStats()}

      {/* Expandable Table — Desktop */}
      <div className="hidden lg:block">
        {renderDesktopTable()}
      </div>

      {/* Expandable Cards — Mobile */}
      <div className="lg:hidden">
        {renderMobileCards()}
      </div>

      {/* ============================================ */}
      {/* ADD/EDIT FAMILY DIALOG */}
      {/* ============================================ */}
      <Dialog open={showFamilyDialog} onOpenChange={setShowFamilyDialog}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-800">
              {editingFamily ? 'Edit Keluarga' : 'Tambah Keluarga Baru'}
            </DialogTitle>
            <DialogDescription>
              {editingFamily
                ? 'Perbarui data keluarga'
                : 'Isi data keluarga baru. Anggota KK akan otomatis dibuat.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Nama Kepala Keluarga</Label>
              <Input
                placeholder="Masukkan nama KK"
                value={familyForm.familyHead}
                onChange={e => setFamilyForm({ ...familyForm, familyHead: e.target.value })}
                className="h-10 rounded-lg border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Alamat</Label>
              <Input
                placeholder="Masukkan alamat"
                value={familyForm.address}
                onChange={e => setFamilyForm({ ...familyForm, address: e.target.value })}
                className="h-10 rounded-lg border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Grup Ronda</Label>
              <Select
                value={familyForm.rondaGroupId}
                onValueChange={val => setFamilyForm({ ...familyForm, rondaGroupId: val })}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="Pilih grup ronda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa Grup</SelectItem>
                  {rondaGroups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setShowFamilyDialog(false)}
            >
              Batal
            </Button>
            <Button
              className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
              onClick={handleSaveFamily}
              disabled={savingFamily}
            >
              {savingFamily ? 'Menyimpan...' : editingFamily ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* ADD/EDIT MEMBER DIALOG */}
      {/* ============================================ */}
      <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
        <DialogContent className="rounded-xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-800">
              {editingMember ? 'Edit Anggota' : 'Tambah Anggota Keluarga'}
            </DialogTitle>
            <DialogDescription>
              Isi data anggota keluarga dengan lengkap
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium text-slate-700">Nama Lengkap *</Label>
                <Input
                  placeholder="Masukkan nama lengkap"
                  value={memberForm.fullName}
                  onChange={e => setMemberForm({ ...memberForm, fullName: e.target.value })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>

              {/* NIK */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">NIK</Label>
                <Input
                  placeholder="Nomor Induk Kependudukan"
                  value={memberForm.nik}
                  onChange={e => setMemberForm({ ...memberForm, nik: e.target.value })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Jenis Kelamin *</Label>
                <Select
                  value={memberForm.gender}
                  onValueChange={val => setMemberForm({ ...memberForm, gender: val })}
                >
                  <SelectTrigger className="h-10 rounded-lg border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Relationship */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Hubungan Keluarga *</Label>
                <Select
                  value={memberForm.relationship}
                  onValueChange={val => setMemberForm({ ...memberForm, relationship: val })}
                >
                  <SelectTrigger className="h-10 rounded-lg border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Marital Status */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Status Perkawinan</Label>
                <Select
                  value={memberForm.maritalStatus}
                  onValueChange={val => setMemberForm({ ...memberForm, maritalStatus: val })}
                >
                  <SelectTrigger className="h-10 rounded-lg border-slate-200">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    {MARITAL_STATUS_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Birth Place */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Tempat Lahir</Label>
                <Input
                  placeholder="Kota/Kabupaten"
                  value={memberForm.birthPlace}
                  onChange={e => setMemberForm({ ...memberForm, birthPlace: e.target.value })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>

              {/* Birth Date */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Tanggal Lahir</Label>
                <Input
                  type="date"
                  value={memberForm.birthDate}
                  onChange={e => setMemberForm({ ...memberForm, birthDate: e.target.value })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>

              {/* Education */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Pendidikan Terakhir</Label>
                <Select
                  value={memberForm.education}
                  onValueChange={val => setMemberForm({ ...memberForm, education: val })}
                >
                  <SelectTrigger className="h-10 rounded-lg border-slate-200">
                    <SelectValue placeholder="Pilih pendidikan" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDUCATION_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Citizenship */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Kewarganegaraan</Label>
                <Select
                  value={memberForm.citizenship}
                  onValueChange={val => setMemberForm({ ...memberForm, citizenship: val })}
                >
                  <SelectTrigger className="h-10 rounded-lg border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIZENSHIP_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Occupation */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Pekerjaan</Label>
                <Input
                  placeholder="Pekerjaan saat ini"
                  value={memberForm.occupation}
                  onChange={e => setMemberForm({ ...memberForm, occupation: e.target.value })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setShowMemberDialog(false)}
            >
              Batal
            </Button>
            <Button
              className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
              onClick={handleSaveMember}
              disabled={savingMember}
            >
              {savingMember ? 'Menyimpan...' : editingMember ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* DELETE CONFIRM DIALOG */}
      {/* ============================================ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-800">Konfirmasi Hapus</DialogTitle>
            <DialogDescription>
              {deletingMember
                ? `Apakah Anda yakin ingin menghapus anggota "${deletingMember.fullName}"?`
                : deletingFamily
                ? `Apakah Anda yakin ingin menghapus keluarga "${deletingFamily.familyHead}"? Semua anggota akan ikut terhapus.`
                : ''
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-lg"
              onClick={deletingMember ? handleDeleteMember : handleDeleteFamily}
              disabled={deleting}
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
