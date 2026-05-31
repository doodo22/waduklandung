'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import {
  ROLE_LABELS,
  APP_NAME,
  GENDER_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RELATIONSHIP_LABELS,
  MARITAL_STATUS_OPTIONS,
  MARITAL_STATUS_LABELS,
  EDUCATION_OPTIONS,
  EDUCATION_LABELS,
  CITIZENSHIP_OPTIONS,
  formatDate,
} from '@/lib/constants';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  User,
  Users,
  Phone,
  MapPin,
  Shield,
  Edit2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  LogOut,
  AlertCircle,
  Calendar,
  GraduationCap,
  Briefcase,
  Heart,
  Loader2,
  CheckCircle2,
  Save,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

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
}

interface FamilyInfo {
  id: string;
  familyHead: string;
  address: string;
  rondaGroup: RondaGroup | null;
  familyMembers: FamilyMember[];
}

interface ProfilPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

// ─── Day-of-week labels for ronda group ─────────────────────────────────────

const DAY_LABELS: Record<number, string> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

// ─── Default empty form state ───────────────────────────────────────────────

const EMPTY_MEMBER_FORM = {
  fullName: '',
  nik: '',
  gender: 'LAKI_LAKI' as const,
  relationship: 'ANAK',
  maritalStatus: '',
  birthPlace: '',
  birthDate: '',
  education: '',
  citizenship: 'WNI',
  occupation: '',
  isFamilyHead: false,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function ProfilPage({ userId, familyId, isAdmin }: ProfilPageProps) {
  const { user, clearAuth } = useAuthStore();

  // Data state
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state for member add/edit
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM);
  const [savingMember, setSavingMember] = useState(false);

  // Form state for profile edit (phone only)
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

  // ─── Sync phone with user ───────────────────────────────────────────────

  useEffect(() => {
    if (user) {
      setPhone(user.phone || '');
    }
  }, [user]);

  // ─── Load family data ──────────────────────────────────────────────────

  const loadFamily = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/families');
      if (res.ok) {
        const data = await res.json();
        const families: FamilyInfo[] = data.families || [];
        const myFamily = familyId
          ? families.find((f) => f.id === familyId) || null
          : null;
        setFamily(myFamily);
        setMembers(myFamily?.familyMembers || []);
      }
    } catch (error) {
      console.error('Failed to load family:', error);
      toast.error('Gagal memuat data keluarga');
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  // ─── Save profile (phone) ──────────────────────────────────────────────

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      setSavedProfile(false);
      const res = await api.put('/users', {
        id: userId,
        phone,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const currentToken = localStorage.getItem('auth_token');
          if (currentToken) {
            const { setAuth } = useAuthStore.getState();
            setAuth(data.user, currentToken);
          }
        }
        setSavedProfile(true);
        toast.success('Profil berhasil disimpan');
        setTimeout(() => setSavedProfile(false), 2000);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal menyimpan profil');
      }
    } catch {
      toast.error('Gagal menyimpan profil');
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── Open dialog for adding member ─────────────────────────────────────

  const openAddMember = () => {
    setEditingMember(null);
    setMemberForm(EMPTY_MEMBER_FORM);
    setDialogOpen(true);
  };

  // ─── Open dialog for editing member ────────────────────────────────────

  const openEditMember = (member: FamilyMember) => {
    setEditingMember(member);
    setMemberForm({
      fullName: member.fullName,
      nik: member.nik || '',
      gender: member.gender,
      relationship: member.relationship,
      maritalStatus: member.maritalStatus || '',
      birthPlace: member.birthPlace || '',
      birthDate: member.birthDate ? member.birthDate.split('T')[0] : '',
      education: member.education || '',
      citizenship: member.citizenship || 'WNI',
      occupation: member.occupation || '',
      isFamilyHead: member.isFamilyHead,
    });
    setDialogOpen(true);
  };

  // ─── Save member (add or edit) ─────────────────────────────────────────

  const handleSaveMember = async () => {
    if (!memberForm.fullName.trim()) {
      toast.error('Nama lengkap wajib diisi');
      return;
    }
    if (!memberForm.gender) {
      toast.error('Jenis kelamin wajib diisi');
      return;
    }
    if (!memberForm.relationship) {
      toast.error('Hubungan keluarga wajib diisi');
      return;
    }
    if (!familyId) {
      toast.error('Anda belum terdaftar di keluarga');
      return;
    }

    try {
      setSavingMember(true);

      const payload = {
        familyId,
        fullName: memberForm.fullName.trim(),
        nik: memberForm.nik.trim() || undefined,
        gender: memberForm.gender,
        relationship: memberForm.relationship,
        maritalStatus: memberForm.maritalStatus || undefined,
        birthPlace: memberForm.birthPlace.trim() || undefined,
        birthDate: memberForm.birthDate || undefined,
        education: memberForm.education || undefined,
        citizenship: memberForm.citizenship || 'WNI',
        occupation: memberForm.occupation.trim() || undefined,
        isFamilyHead: memberForm.isFamilyHead || undefined,
        ...(editingMember ? { id: editingMember.id } : {}),
      };

      const res = editingMember
        ? await api.put('/family-members', payload)
        : await api.post('/family-members', payload);

      if (res.ok) {
        toast.success(
          editingMember
            ? 'Data anggota berhasil diperbarui'
            : 'Anggota keluarga berhasil ditambahkan'
        );
        setDialogOpen(false);
        setEditingMember(null);
        setMemberForm(EMPTY_MEMBER_FORM);
        await loadFamily();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal menyimpan data');
      }
    } catch {
      toast.error('Gagal menyimpan data anggota');
    } finally {
      setSavingMember(false);
    }
  };

  // ─── Delete member ─────────────────────────────────────────────────────

  const handleDeleteMember = async (id: string) => {
    try {
      const res = await api.delete(`/family-members?id=${id}`);
      if (res.ok) {
        toast.success('Anggota keluarga berhasil dihapus');
        setDeleteConfirmId(null);
        setExpandedMemberId(null);
        await loadFamily();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal menghapus anggota');
      }
    } catch {
      toast.error('Gagal menghapus anggota');
    }
  };

  // ─── Toggle expand ─────────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    setExpandedMemberId((prev) => (prev === id ? null : id));
  };

  // ─── Loading skeleton ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-xl shadow-sm border border-slate-200">
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-5 bg-slate-200 rounded w-3/4" />
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!user) return null;

  // ─── Gender icon helper ────────────────────────────────────────────────

  const genderIcon = (gender: string) =>
    gender === 'LAKI_LAKI' ? (
      <User className="w-3.5 h-3.5 text-slate-500" />
    ) : (
      <Heart className="w-3.5 h-3.5 text-pink-500" />
    );

  const genderLabel = (gender: string) =>
    GENDER_OPTIONS.find((o) => o.value === gender)?.label || gender;

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ═══ 1. Profile Card ═══ */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-700 text-white flex items-center justify-center text-xl font-bold shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-800 truncate">
                {user.name}
              </h2>
              <p className="text-sm text-slate-500">@{user.username}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge
                  variant="secondary"
                  className="text-xs bg-slate-100 text-slate-700"
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {ROLE_LABELS[user.role] || user.role}
                </Badge>
              </div>
            </div>
          </div>
          {user.phone && (
            <div className="flex items-center gap-2 mt-3 ml-[4.25rem]">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm text-slate-600">{user.phone}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ 2. Family Info Card ═══ */}
      {familyId && family ? (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-slate-600" />
              <CardTitle className="text-sm font-semibold">
                Informasi Keluarga
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2.5">
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Kepala Keluarga</p>
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {family.familyHead}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Alamat</p>
                  <p className="text-sm font-medium text-slate-700">
                    {family.address}
                  </p>
                </div>
              </div>
              {family.rondaGroup && (
                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Grup Ronda</p>
                    <p className="text-sm font-medium text-slate-700">
                      {family.rondaGroup.name} — {DAY_LABELS[family.rondaGroup.dayOfWeek] || ''}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Jumlah Anggota</p>
                  <p className="text-sm font-medium text-slate-700">
                    {members.length} orang
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl shadow-sm border border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Belum terdaftar di keluarga
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Hubungi pengurus RT untuk pendaftaran keluarga
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ 3. Family Members Section ═══ */}
      {familyId && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600" />
                <CardTitle className="text-sm font-semibold">
                  Anggota Keluarga
                </CardTitle>
              </div>
              <span className="text-xs text-slate-500">
                {members.length} orang
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {members.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">
                  Belum ada data anggota keluarga
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const isExpanded = expandedMemberId === member.id;
                  return (
                    <div
                      key={member.id}
                      className="rounded-xl border border-slate-200 overflow-hidden"
                    >
                      {/* Collapsed header — always visible */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(member.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left min-h-[44px]"
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          {genderIcon(member.gender)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-slate-800 truncate">
                              {member.fullName}
                            </span>
                            {member.isFamilyHead && (
                              <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 hover:bg-emerald-100">
                                KK
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0"
                            >
                              {RELATIONSHIP_LABELS[member.relationship] || member.relationship}
                            </Badge>
                          </div>
                        </div>
                        <div className="shrink-0 text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-2">
                          <Separator />
                          <div className="grid grid-cols-1 gap-2 pt-1">
                            {member.nik && (
                              <DetailRow
                                icon={<User className="w-3.5 h-3.5" />}
                                label="NIK"
                                value={member.nik}
                              />
                            )}
                            <DetailRow
                              icon={genderIcon(member.gender)}
                              label="Jenis Kelamin"
                              value={genderLabel(member.gender)}
                            />
                            {member.maritalStatus && (
                              <DetailRow
                                icon={<Heart className="w-3.5 h-3.5" />}
                                label="Status Perkawinan"
                                value={MARITAL_STATUS_LABELS[member.maritalStatus] || member.maritalStatus}
                              />
                            )}
                            {(member.birthPlace || member.birthDate) && (
                              <DetailRow
                                icon={<Calendar className="w-3.5 h-3.5" />}
                                label="Tempat, Tanggal Lahir"
                                value={[
                                  member.birthPlace,
                                  member.birthDate ? formatDate(member.birthDate) : '',
                                ]
                                  .filter(Boolean)
                                  .join(', ')}
                              />
                            )}
                            {member.education && (
                              <DetailRow
                                icon={<GraduationCap className="w-3.5 h-3.5" />}
                                label="Pendidikan Terakhir"
                                value={EDUCATION_LABELS[member.education] || member.education}
                              />
                            )}
                            <DetailRow
                              icon={<Shield className="w-3.5 h-3.5" />}
                              label="Kewarganegaraan"
                              value={CITIZENSHIP_OPTIONS.find((o) => o.value === member.citizenship)?.label || member.citizenship}
                            />
                            {member.occupation && (
                              <DetailRow
                                icon={<Briefcase className="w-3.5 h-3.5" />}
                                label="Pekerjaan"
                                value={member.occupation}
                              />
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-9 text-xs border-slate-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditMember(member);
                              }}
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            {!member.isFamilyHead && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(member.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Hapus
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Member Button */}
            <Button
              onClick={openAddMember}
              className="w-full h-11 mt-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah Anggota
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ═══ 4. Edit Profile (Phone) ═══ */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-600" />
            <CardTitle className="text-sm font-semibold">Edit Profil</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm">
              No. Telepon
            </Label>
            <Input
              id="phone"
              placeholder="Masukkan no. telepon"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11"
            />
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
          >
            {savingProfile ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : savedProfile ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
                Tersimpan!
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Simpan Perubahan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* ═══ 5. Logout Button ═══ */}
      <Button
        variant="outline"
        onClick={clearAuth}
        className="w-full h-11 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Keluar
      </Button>

      {/* ═══ 6. App Version Footer ═══ */}
      <div className="text-center pt-2 pb-4">
        <p className="text-xs text-slate-400">{APP_NAME} v1.0.0</p>
        <p className="text-[11px] text-slate-300 mt-0.5">
          Sistem Manajemen RT Digital
        </p>
      </div>

      {/* ═══ Add/Edit Member Dialog ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingMember ? 'Edit Anggota Keluarga' : 'Tambah Anggota Keluarga'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {editingMember
                ? 'Perbarui data anggota keluarga di bawah ini.'
                : 'Isi data anggota keluarga baru di bawah ini.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Nama Lengkap <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Masukkan nama lengkap"
                value={memberForm.fullName}
                onChange={(e) =>
                  setMemberForm((f) => ({ ...f, fullName: e.target.value }))
                }
                className="h-11"
              />
            </div>

            {/* NIK */}
            <div className="space-y-1.5">
              <Label className="text-sm">NIK</Label>
              <Input
                placeholder="Masukkan NIK (16 digit)"
                value={memberForm.nik}
                onChange={(e) =>
                  setMemberForm((f) => ({ ...f, nik: e.target.value }))
                }
                className="h-11"
                maxLength={16}
              />
            </div>

            {/* Gender */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Jenis Kelamin <span className="text-red-500">*</span>
              </Label>
              <Select
                value={memberForm.gender}
                onValueChange={(v) =>
                  setMemberForm((f) => ({
                    ...f,
                    gender: v as 'LAKI_LAKI' | 'PEREMPUAN',
                  }))
                }
              >
                <SelectTrigger className="w-full h-11">
                  <SelectValue placeholder="Pilih jenis kelamin" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Relationship */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Hubungan Keluarga <span className="text-red-500">*</span>
              </Label>
              <Select
                value={memberForm.relationship}
                onValueChange={(v) =>
                  setMemberForm((f) => ({
                    ...f,
                    relationship: v,
                    isFamilyHead: v === 'KEPALA_KELUARGA',
                  }))
                }
              >
                <SelectTrigger className="w-full h-11">
                  <SelectValue placeholder="Pilih hubungan" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Marital Status */}
            <div className="space-y-1.5">
              <Label className="text-sm">Status Perkawinan</Label>
              <Select
                value={memberForm.maritalStatus}
                onValueChange={(v) =>
                  setMemberForm((f) => ({ ...f, maritalStatus: v }))
                }
              >
                <SelectTrigger className="w-full h-11">
                  <SelectValue placeholder="Pilih status perkawinan" />
                </SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Birth Place */}
            <div className="space-y-1.5">
              <Label className="text-sm">Tempat Lahir</Label>
              <Input
                placeholder="Masukkan tempat lahir"
                value={memberForm.birthPlace}
                onChange={(e) =>
                  setMemberForm((f) => ({ ...f, birthPlace: e.target.value }))
                }
                className="h-11"
              />
            </div>

            {/* Birth Date */}
            <div className="space-y-1.5">
              <Label className="text-sm">Tanggal Lahir</Label>
              <Input
                type="date"
                value={memberForm.birthDate}
                onChange={(e) =>
                  setMemberForm((f) => ({ ...f, birthDate: e.target.value }))
                }
                className="h-11"
              />
            </div>

            {/* Education */}
            <div className="space-y-1.5">
              <Label className="text-sm">Pendidikan Terakhir</Label>
              <Select
                value={memberForm.education}
                onValueChange={(v) =>
                  setMemberForm((f) => ({ ...f, education: v }))
                }
              >
                <SelectTrigger className="w-full h-11">
                  <SelectValue placeholder="Pilih pendidikan terakhir" />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Citizenship */}
            <div className="space-y-1.5">
              <Label className="text-sm">Kewarganegaraan</Label>
              <Select
                value={memberForm.citizenship}
                onValueChange={(v) =>
                  setMemberForm((f) => ({ ...f, citizenship: v }))
                }
              >
                <SelectTrigger className="w-full h-11">
                  <SelectValue placeholder="Pilih kewarganegaraan" />
                </SelectTrigger>
                <SelectContent>
                  {CITIZENSHIP_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Occupation */}
            <div className="space-y-1.5">
              <Label className="text-sm">Pekerjaan</Label>
              <Input
                placeholder="Masukkan pekerjaan"
                value={memberForm.occupation}
                onChange={(e) =>
                  setMemberForm((f) => ({ ...f, occupation: e.target.value }))
                }
                className="h-11"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-11 flex-1 rounded-lg"
              disabled={savingMember}
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveMember}
              disabled={savingMember}
              className="h-11 flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
            >
              {savingMember ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : editingMember ? (
                <>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Perbarui
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Confirm Dialog ═══ */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base">Hapus Anggota</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Apakah Anda yakin ingin menghapus anggota ini? Tindakan ini tidak
              dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="h-11 flex-1 rounded-lg"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmId) handleDeleteMember(deleteConfirmId);
              }}
              className="h-11 flex-1 rounded-lg"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Detail Row Sub-component ──────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-slate-400 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
        <p className="text-sm text-slate-700 leading-snug break-words">
          {value}
        </p>
      </div>
    </div>
  );
}
