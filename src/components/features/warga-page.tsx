'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Search,
  Home,
  Shield,
  UserPlus,
  ChevronRight,
  X,
  MapPin,
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

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

  // ---- Selection state ----
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // ---- Mobile view toggle ----
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

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

  // ---- Delete confirm dialog ----
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingMember, setDeletingMember] = useState<FamilyMember | null>(null);
  const [deletingFamily, setDeletingFamily] = useState(false);

  // ----------------------------------------
  // Data Fetching
  // ----------------------------------------

  const fetchFamilies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/families');
      if (res.ok) {
        const data = await res.json();
        setFamilies(Array.isArray(data) ? data : data.families ?? []);
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
      // silent - non-critical
    }
  }, []);

  const fetchMembers = useCallback(async (famId: string) => {
    setLoadingMembers(true);
    try {
      const res = await api.get(`/family-members?familyId=${famId}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? []);
      }
    } catch {
      toast.error('Gagal memuat data anggota');
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    fetchFamilies();
    fetchRondaGroups();
  }, [fetchFamilies, fetchRondaGroups]);

  useEffect(() => {
    if (selectedFamilyId) {
      fetchMembers(selectedFamilyId);
    } else {
      setMembers([]);
    }
  }, [selectedFamilyId, fetchMembers]);

  // ----------------------------------------
  // Derived Data
  // ----------------------------------------

  const selectedFamily = families.find(f => f.id === selectedFamilyId) ?? null;

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

  // ----------------------------------------
  // Family Handlers
  // ----------------------------------------

  const openAddFamilyDialog = () => {
    setEditingFamily(null);
    setFamilyForm(EMPTY_FAMILY_FORM);
    setShowFamilyDialog(true);
  };

  const openEditFamilyDialog = (family: Family) => {
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

  const handleToggleFamilyStatus = async (family: Family) => {
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

  const handleDeleteFamily = async () => {
    if (!selectedFamily) return;
    setDeletingFamily(true);
    try {
      // Delete all members first
      for (const member of members) {
        await api.delete(`/family-members?id=${member.id}`);
      }
      // Then delete the family via toggle to inactive or we could try a direct delete
      // Since there's no DELETE /api/families, we'll set it inactive
      const res = await api.put('/families', {
        id: selectedFamily.id,
        isActive: false,
      });
      if (res.ok) {
        toast.success('Keluarga berhasil dihapus');
        setSelectedFamilyId(null);
        setMobileView('list');
        setShowDeleteDialog(false);
        await fetchFamilies();
      } else {
        toast.error('Gagal menghapus keluarga');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setDeletingFamily(false);
    }
  };

  // ----------------------------------------
  // Member Handlers
  // ----------------------------------------

  const openAddMemberDialog = () => {
    setEditingMember(null);
    setMemberForm({ ...EMPTY_MEMBER_FORM });
    setShowMemberDialog(true);
  };

  const openEditMemberDialog = (member: FamilyMember) => {
    setEditingMember(member);
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
    if (!selectedFamilyId) return;
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
        familyId: selectedFamilyId,
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
        // Remove familyId for update
        delete payload.familyId;
        const res = await api.put('/family-members', payload);
        if (res.ok) {
          toast.success('Data anggota berhasil diperbarui');
          setShowMemberDialog(false);
          await fetchMembers(selectedFamilyId);
          await fetchFamilies();
        } else {
          toast.error('Gagal memperbarui data anggota');
        }
      } else {
        const res = await api.post('/family-members', payload);
        if (res.ok) {
          toast.success('Anggota baru berhasil ditambahkan');
          setShowMemberDialog(false);
          await fetchMembers(selectedFamilyId);
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

  const confirmDeleteMember = (member: FamilyMember) => {
    setDeletingMember(member);
    setShowDeleteDialog(true);
  };

  const handleDeleteMember = async () => {
    if (!deletingMember || !selectedFamilyId) return;
    setSavingMember(true);
    try {
      const res = await api.delete(`/family-members?id=${deletingMember.id}`);
      if (res.ok) {
        toast.success('Anggota berhasil dihapus');
        setShowDeleteDialog(false);
        setDeletingMember(null);
        await fetchMembers(selectedFamilyId);
        await fetchFamilies();
      } else {
        toast.error('Gagal menghapus anggota');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSavingMember(false);
    }
  };

  const handleSelectFamily = (familyId: string) => {
    setSelectedFamilyId(familyId);
    setMobileView('detail');
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  // ----------------------------------------
  // Loading Skeleton
  // ----------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-36 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-4 w-48 bg-slate-100 rounded animate-pulse mt-1.5" />
          </div>
          <div className="h-10 w-36 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="flex gap-6">
          <div className="hidden lg:block w-80 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="flex-1 space-y-3">
            <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------
  // Family List Panel (Left)
  // ----------------------------------------

  const renderFamilyList = () => (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Cari keluarga, alamat..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-10 pl-9 rounded-lg border-slate-200"
        />
      </div>

      {/* List */}
      {filteredFamilies.length === 0 ? (
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada data keluarga</p>
            <p className="text-sm text-slate-400 mt-1">
              {search
                ? 'Tidak ditemukan keluarga yang sesuai'
                : 'Klik "Tambah Keluarga" untuk menambahkan data'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-1">
            {filteredFamilies.map(family => {
              const memberCount = family.familyMembers?.length ?? 0;
              const isSelected = selectedFamilyId === family.id;

              return (
                <button
                  key={family.id}
                  type="button"
                  onClick={() => handleSelectFamily(family.id)}
                  className={`w-full text-left rounded-xl p-4 border transition-all ${
                    isSelected
                      ? 'bg-slate-50 border-slate-300 shadow-sm'
                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-slate-800' : 'bg-slate-100'
                    }`}>
                      <Home className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
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
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-2" />
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  // ----------------------------------------
  // Family Detail Panel (Right)
  // ----------------------------------------

  const renderFamilyDetail = () => {
    if (!selectedFamily) {
      return (
        <Card className="rounded-xl shadow-sm border h-full">
          <CardContent className="p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
            <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">Pilih keluarga untuk melihat detail</p>
            <p className="text-sm text-slate-300 mt-1">
              Klik pada kartu keluarga di sebelah kiri
            </p>
          </CardContent>
        </Card>
      );
    }

    const memberCount = selectedFamily.familyMembers?.length ?? members.length;

    return (
      <div className="space-y-4">
        {/* Header Card */}
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-slate-800">
                      {selectedFamily.familyHead}
                    </h3>
                    <Badge className={`text-[10px] ${
                      selectedFamily.isActive
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-red-100 text-red-700 hover:bg-red-100'
                    }`}>
                      {selectedFamily.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{selectedFamily.address}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {memberCount} anggota
                    </span>
                    {selectedFamily.rondaGroupId && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {rondaGroupName(selectedFamily.rondaGroupId)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => openEditFamilyDialog(selectedFamily)}
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 text-xs ${
                      selectedFamily.isActive
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    }`}
                    onClick={() => handleToggleFamilyStatus(selectedFamily)}
                  >
                    {selectedFamily.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Hapus
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Members Section */}
        <Card className="rounded-xl shadow-sm border">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                Daftar Anggota Keluarga
              </CardTitle>
              {isAdmin && (
                <Button
                  size="sm"
                  className="h-8 bg-slate-800 hover:bg-slate-700 text-white text-xs"
                  onClick={openAddMemberDialog}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  Tambah Anggota
                </Button>
              )}
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {loadingMembers ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4">
                    <div className="h-4 w-8 bg-slate-100 rounded animate-pulse" />
                    <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                    <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="p-10 text-center">
                <UserPlus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium text-sm">Belum ada anggota terdaftar</p>
                <p className="text-xs text-slate-400 mt-1">
                  Klik &quot;Tambah Anggota&quot; untuk menambahkan anggota keluarga
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="text-xs font-semibold w-10 text-center">No</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[160px]">Nama Lengkap</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[120px] hidden md:table-cell">NIK</TableHead>
                      <TableHead className="text-xs font-semibold w-24">JK</TableHead>
                      <TableHead className="text-xs font-semibold w-32">Hubungan</TableHead>
                      <TableHead className="text-xs font-semibold w-28 hidden lg:table-cell">Status Kawin</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[120px] hidden xl:table-cell">Tempat Lahir</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[120px] hidden xl:table-cell">Tgl Lahir</TableHead>
                      <TableHead className="text-xs font-semibold w-20 hidden lg:table-cell">Pendidikan</TableHead>
                      <TableHead className="text-xs font-semibold w-14 text-center">WN</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[100px] hidden lg:table-cell">Pekerjaan</TableHead>
                      {isAdmin && (
                        <TableHead className="text-xs font-semibold w-20 text-center">Aksi</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member, idx) => (
                      <TableRow key={member.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-sm text-slate-400 text-center">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">
                              {member.fullName}
                            </span>
                            {member.isFamilyHead && (
                              <Badge className="text-[9px] bg-slate-800 text-white hover:bg-slate-800 shrink-0">
                                KK
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 font-mono hidden md:table-cell">
                          {member.nik || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {member.gender === 'LAKI_LAKI' ? 'L' : 'P'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${getRelationshipBadgeVariant(member.relationship)}`}
                          >
                            {RELATIONSHIP_LABELS[member.relationship] || member.relationship}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 hidden lg:table-cell">
                          {member.maritalStatus
                            ? MARITAL_STATUS_LABELS[member.maritalStatus] || member.maritalStatus
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 hidden xl:table-cell">
                          {member.birthPlace || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 hidden xl:table-cell">
                          {formatShortDate(member.birthDate)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 hidden lg:table-cell">
                          {member.education
                            ? EDUCATION_LABELS[member.education] || member.education
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 text-center">
                          {member.citizenship}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 hidden lg:table-cell">
                          {member.occupation || '-'}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                                onClick={() => openEditMemberDialog(member)}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                onClick={() => confirmDeleteMember(member)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ----------------------------------------
  // Desktop Two-Panel Layout
  // ----------------------------------------

  const renderDesktopLayout = () => (
    <div className="flex gap-6 h-[calc(100vh-12rem)]">
      {/* Left Panel — Family List */}
      <div className="w-80 shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Daftar Keluarga</h3>
          {isAdmin && (
            <Button
              size="sm"
              className="h-8 bg-slate-800 hover:bg-slate-700 text-white text-xs"
              onClick={openAddFamilyDialog}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Tambah
            </Button>
          )}
        </div>
        {renderFamilyList()}
      </div>

      {/* Right Panel — Family Detail */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {renderFamilyDetail()}
      </div>
    </div>
  );

  // ----------------------------------------
  // Mobile Layout
  // ----------------------------------------

  const renderMobileLayout = () => (
    <div>
      {mobileView === 'list' ? (
        <div className="space-y-4">
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
            <div className="space-y-2">
              {filteredFamilies.map(family => {
                const memberCount = family.familyMembers?.length ?? 0;
                return (
                  <Card
                    key={family.id}
                    className="rounded-xl shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleSelectFamily(family.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Home className="w-4 h-4 text-slate-500" />
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
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Back button */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-slate-600"
              onClick={handleBackToList}
            >
              <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
              Kembali
            </Button>
          </div>
          {renderFamilyDetail()}
        </div>
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

      {/* Layout */}
      <div className="hidden lg:block">
        {renderDesktopLayout()}
      </div>
      <div className="lg:hidden">
        {renderMobileLayout()}
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
                ? 'Perbarui informasi keluarga'
                : 'Isi data keluarga baru. Anggota Kepala Keluarga akan dibuat otomatis.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="familyHead" className="text-sm font-medium text-slate-700">
                Nama Kepala Keluarga <span className="text-red-500">*</span>
              </Label>
              <Input
                id="familyHead"
                placeholder="Masukkan nama kepala keluarga"
                value={familyForm.familyHead}
                onChange={e => setFamilyForm({ ...familyForm, familyHead: e.target.value })}
                className="h-10 rounded-lg border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium text-slate-700">
                Alamat <span className="text-red-500">*</span>
              </Label>
              <Input
                id="address"
                placeholder="Masukkan alamat lengkap"
                value={familyForm.address}
                onChange={e => setFamilyForm({ ...familyForm, address: e.target.value })}
                className="h-10 rounded-lg border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rondaGroupId" className="text-sm font-medium text-slate-700">
                Grup Ronda
              </Label>
              <Select
                value={familyForm.rondaGroupId}
                onValueChange={val => setFamilyForm({ ...familyForm, rondaGroupId: val === '__none__' ? '' : val })}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder="Pilih grup ronda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tidak ada</SelectItem>
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
              className="h-10 rounded-lg"
              onClick={() => setShowFamilyDialog(false)}
              disabled={savingFamily}
            >
              Batal
            </Button>
            <Button
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
              onClick={handleSaveFamily}
              disabled={savingFamily || !familyForm.familyHead.trim() || !familyForm.address.trim()}
            >
              {savingFamily ? 'Menyimpan...' : editingFamily ? 'Perbarui' : 'Simpan'}
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
              {editingMember
                ? 'Perbarui data anggota keluarga'
                : 'Isi data anggota keluarga baru'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Full Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Nama Lengkap <span className="text-red-500">*</span>
              </Label>
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
                placeholder="Masukkan NIK (16 digit)"
                value={memberForm.nik}
                onChange={e => setMemberForm({ ...memberForm, nik: e.target.value })}
                className="h-10 rounded-lg border-slate-200"
                maxLength={16}
              />
            </div>

            {/* Gender + Relationship */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Jenis Kelamin <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={memberForm.gender}
                  onValueChange={val => setMemberForm({ ...memberForm, gender: val })}
                >
                  <SelectTrigger className="h-10 rounded-lg border-slate-200">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Hubungan <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={memberForm.relationship}
                  onValueChange={val => setMemberForm({ ...memberForm, relationship: val })}
                >
                  <SelectTrigger className="h-10 rounded-lg border-slate-200">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Marital Status + Citizenship */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Status Perkawinan</Label>
                <Select
                  value={memberForm.maritalStatus}
                  onValueChange={val => setMemberForm({ ...memberForm, maritalStatus: val === '__none__' ? '' : val })}
                >
                  <SelectTrigger className="h-10 rounded-lg border-slate-200">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tidak diisi</SelectItem>
                    {MARITAL_STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Kewarganegaraan</Label>
                <Select
                  value={memberForm.citizenship}
                  onValueChange={val => setMemberForm({ ...memberForm, citizenship: val })}
                >
                  <SelectTrigger className="h-10 rounded-lg border-slate-200">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIZENSHIP_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Birth Place + Birth Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Tempat Lahir</Label>
                <Input
                  placeholder="Kota tempat lahir"
                  value={memberForm.birthPlace}
                  onChange={e => setMemberForm({ ...memberForm, birthPlace: e.target.value })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Tanggal Lahir</Label>
                <Input
                  type="date"
                  value={memberForm.birthDate}
                  onChange={e => setMemberForm({ ...memberForm, birthDate: e.target.value })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>
            </div>

            {/* Education + Occupation */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Pendidikan Terakhir</Label>
                <Select
                  value={memberForm.education}
                  onValueChange={val => setMemberForm({ ...memberForm, education: val === '__none__' ? '' : val })}
                >
                  <SelectTrigger className="h-10 rounded-lg border-slate-200">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tidak diisi</SelectItem>
                    {EDUCATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Pekerjaan</Label>
                <Input
                  placeholder="Jenis pekerjaan"
                  value={memberForm.occupation}
                  onChange={e => setMemberForm({ ...memberForm, occupation: e.target.value })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>
            </div>

            {/* Is Family Head toggle */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <input
                type="checkbox"
                id="isFamilyHead"
                checked={memberForm.isFamilyHead}
                onChange={e => setMemberForm({ ...memberForm, isFamilyHead: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-800"
              />
              <Label htmlFor="isFamilyHead" className="text-sm font-medium text-slate-700 cursor-pointer">
                Tandai sebagai Kepala Keluarga
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-10 rounded-lg"
              onClick={() => setShowMemberDialog(false)}
              disabled={savingMember}
            >
              Batal
            </Button>
            <Button
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
              onClick={handleSaveMember}
              disabled={savingMember || !memberForm.fullName.trim()}
            >
              {savingMember ? 'Menyimpan...' : editingMember ? 'Perbarui' : 'Simpan'}
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
                ? `Apakah Anda yakin ingin menghapus anggota "${deletingMember.fullName}"? Tindakan ini tidak dapat dibatalkan.`
                : `Apakah Anda yakin ingin menghapus keluarga "${selectedFamily?.familyHead}"? Semua anggota akan dihapus dan keluarga akan dinonaktifkan.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-lg"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeletingMember(null);
              }}
              disabled={savingMember || deletingFamily}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="h-10 rounded-lg bg-red-600 hover:bg-red-700"
              onClick={deletingMember ? handleDeleteMember : handleDeleteFamily}
              disabled={savingMember || deletingFamily}
            >
              {(savingMember || deletingFamily) ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
