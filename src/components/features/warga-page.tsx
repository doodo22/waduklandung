'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDateShort, ROLE_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';
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
  Users,
  Plus,
  Search,
  Pencil,
  MapPin,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Home,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface Family {
  id: string;
  familyHead: string;
  address: string;
  memberCount: number;
  rondaGroup: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  members?: FamilyMember[];
}

interface FamilyMember {
  id: string;
  name: string;
  username: string;
  role: string;
  status: string;
  phone: string | null;
}

interface WargaPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function WargaPage({ userId, familyId, isAdmin }: WargaPageProps) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    familyHead: '',
    address: '',
    memberCount: 1,
    rondaGroup: '',
  });

  // ----------------------------------------
  // Data fetching
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
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  // ----------------------------------------
  // Handlers
  // ----------------------------------------

  const handleAddFamily = async () => {
    if (!form.familyHead.trim() || !form.address.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/families', {
        familyHead: form.familyHead,
        address: form.address,
        memberCount: form.memberCount,
        rondaGroup: form.rondaGroup || null,
      });
      if (res.ok) {
        setShowAddDialog(false);
        resetForm();
        fetchFamilies();
      }
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  };

  const handleEditFamily = async () => {
    if (!selectedFamily || !form.familyHead.trim() || !form.address.trim()) return;
    setSaving(true);
    try {
      const res = await api.put('/families', {
        id: selectedFamily.id,
        familyHead: form.familyHead,
        address: form.address,
        memberCount: form.memberCount,
        rondaGroup: form.rondaGroup || null,
      });
      if (res.ok) {
        setShowEditDialog(false);
        setSelectedFamily(null);
        resetForm();
        fetchFamilies();
      }
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (family: Family) => {
    setSelectedFamily(family);
    setForm({
      familyHead: family.familyHead,
      address: family.address,
      memberCount: family.memberCount,
      rondaGroup: family.rondaGroup || '',
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setForm({ familyHead: '', address: '', memberCount: 1, rondaGroup: '' });
  };

  const toggleExpand = (familyId: string) => {
    setExpandedFamily(prev => (prev === familyId ? null : familyId));
  };

  // ----------------------------------------
  // Filtered families
  // ----------------------------------------

  const filteredFamilies = families.filter(f => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      f.familyHead.toLowerCase().includes(q) ||
      f.address.toLowerCase().includes(q) ||
      (f.rondaGroup && f.rondaGroup.toLowerCase().includes(q))
    );
  });

  // ----------------------------------------
  // Loading skeleton
  // ----------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        {[1, 2, 3].map(i => (
          <Card key={i} className="rounded-xl shadow-sm border">
            <CardContent className="p-5">
              <div className="space-y-3">
                <div className="h-5 w-48 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ----------------------------------------
  // Render
  // ----------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Data Warga</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {filteredFamilies.length} keluarga terdaftar
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              resetForm();
              setShowAddDialog(true);
            }}
            className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Keluarga
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Cari keluarga, alamat, atau grup ronda..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-10 pl-9 rounded-lg border-slate-200"
        />
      </div>

      {/* Family list */}
      {filteredFamilies.length === 0 ? (
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-10 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada data keluarga</p>
            <p className="text-sm text-slate-400 mt-1">
              {search
                ? 'Tidak ditemukan keluarga yang sesuai pencarian'
                : 'Klik tombol "Tambah Keluarga" untuk menambahkan data'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFamilies.map(family => (
            <Card
              key={family.id}
              className="rounded-xl shadow-sm border hover:shadow-md transition-shadow"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Home className="w-4 h-4 text-slate-400 shrink-0" />
                      <h3 className="font-semibold text-slate-800 truncate">
                        {family.familyHead}
                      </h3>
                      {!family.isActive && (
                        <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                          Nonaktif
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{family.address}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                        <UserCircle className="w-3 h-3 mr-1" />
                        {family.memberCount} anggota
                      </Badge>
                      {family.rondaGroup && (
                        <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700">
                          Grup {family.rondaGroup}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
                        onClick={() => openEditDialog(family)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
                      onClick={() => toggleExpand(family.id)}
                    >
                      {expandedFamily === family.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded members list */}
                {expandedFamily === family.id && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-medium text-slate-600 mb-3">
                      Anggota Keluarga
                    </h4>
                    {family.members && family.members.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Nama</TableHead>
                            <TableHead className="text-xs">Role</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Telepon</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {family.members.map(member => (
                            <TableRow key={member.id}>
                              <TableCell className="text-sm font-medium text-slate-700">
                                {member.name}
                              </TableCell>
                              <TableCell className="text-sm text-slate-500">
                                {ROLE_LABELS[member.role] || member.role}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${STATUS_COLORS[member.status] || 'bg-slate-100 text-slate-600'}`}
                                >
                                  {STATUS_LABELS[member.status] || member.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-slate-500">
                                {member.phone || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        Belum ada anggota terdaftar untuk keluarga ini
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Family Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Tambah Keluarga Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-familyHead">Nama Kepala Keluarga</Label>
              <Input
                id="add-familyHead"
                placeholder="Masukkan nama kepala keluarga"
                value={form.familyHead}
                onChange={e => setForm({ ...form, familyHead: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-address">Alamat</Label>
              <Input
                id="add-address"
                placeholder="Masukkan alamat lengkap"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-memberCount">Jumlah Anggota</Label>
              <Input
                id="add-memberCount"
                type="number"
                min={1}
                value={form.memberCount}
                onChange={e => setForm({ ...form, memberCount: parseInt(e.target.value) || 1 })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-rondaGroup">Grup Ronda</Label>
              <Input
                id="add-rondaGroup"
                placeholder="Contoh: 1, 2, 3..."
                value={form.rondaGroup}
                onChange={e => setForm({ ...form, rondaGroup: e.target.value })}
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => setShowAddDialog(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
              onClick={handleAddFamily}
              disabled={saving || !form.familyHead.trim() || !form.address.trim()}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Family Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Edit Keluarga</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-familyHead">Nama Kepala Keluarga</Label>
              <Input
                id="edit-familyHead"
                placeholder="Masukkan nama kepala keluarga"
                value={form.familyHead}
                onChange={e => setForm({ ...form, familyHead: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Alamat</Label>
              <Input
                id="edit-address"
                placeholder="Masukkan alamat lengkap"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-memberCount">Jumlah Anggota</Label>
              <Input
                id="edit-memberCount"
                type="number"
                min={1}
                value={form.memberCount}
                onChange={e => setForm({ ...form, memberCount: parseInt(e.target.value) || 1 })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-rondaGroup">Grup Ronda</Label>
              <Input
                id="edit-rondaGroup"
                placeholder="Contoh: 1, 2, 3..."
                value={form.rondaGroup}
                onChange={e => setForm({ ...form, rondaGroup: e.target.value })}
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => setShowEditDialog(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
              onClick={handleEditFamily}
              disabled={saving || !form.familyHead.trim() || !form.address.trim()}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
