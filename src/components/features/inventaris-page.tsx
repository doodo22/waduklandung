'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { CONDITION_LABELS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  MapPin,
  FileText,
  X,
  Hash,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Inbox,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  condition: string;
  location: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InventarisPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

const CONDITION_COLORS: Record<string, string> = {
  BAIK: 'bg-emerald-100 text-emerald-700',
  RUSAK_RINGAN: 'bg-amber-100 text-amber-700',
  RUSAK_BERAT: 'bg-red-100 text-red-700',
};

const CONDITION_ICONS: Record<string, typeof CheckCircle2> = {
  BAIK: CheckCircle2,
  RUSAK_RINGAN: AlertTriangle,
  RUSAK_BERAT: XCircle,
};

const defaultForm = {
  name: '',
  quantity: 1,
  condition: 'BAIK',
  location: '',
  notes: '',
};

// ============================================
// COMPONENT
// ============================================

export function InventarisPage({ userId, familyId, isAdmin }: InventarisPageProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [filterCondition, setFilterCondition] = useState('ALL');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ----------------------------------------
  // Data Fetching
  // ----------------------------------------

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory');
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : data.inventory ?? []);
      }
    } catch {
      toast.error('Gagal memuat data inventaris');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ----------------------------------------
  // Derived Data
  // ----------------------------------------

  const filteredItems = items.filter((item) => {
    const matchName = !searchName || item.name.toLowerCase().includes(searchName.toLowerCase());
    const matchCondition = filterCondition === 'ALL' || item.condition === filterCondition;
    return matchName && matchCondition;
  });

  const totalItems = items.length;
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalBaik = items.filter(i => i.condition === 'BAIK').length;
  const totalRusak = items.filter(i => i.condition !== 'BAIK').length;

  // ----------------------------------------
  // Handlers
  // ----------------------------------------

  const openAddDialog = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEditDialog = (item: InventoryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingItem(item);
    setForm({
      name: item.name,
      quantity: item.quantity,
      condition: item.condition,
      location: item.location,
      notes: item.notes ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Nama item wajib diisi');
      return;
    }
    if (!form.location.trim()) {
      toast.error('Lokasi wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        const res = await api.put('/inventory', {
          id: editingItem.id,
          name: form.name.trim(),
          quantity: form.quantity,
          condition: form.condition,
          location: form.location.trim(),
          notes: form.notes.trim() || null,
        });
        if (res.ok) {
          toast.success('Inventaris berhasil diperbarui');
          setDialogOpen(false);
          fetchItems();
        } else {
          toast.error('Gagal memperbarui inventaris');
        }
      } else {
        const res = await api.post('/inventory', {
          name: form.name.trim(),
          quantity: form.quantity,
          condition: form.condition,
          location: form.location.trim(),
          notes: form.notes.trim() || null,
        });
        if (res.ok) {
          toast.success('Inventaris berhasil ditambahkan');
          setDialogOpen(false);
          fetchItems();
        } else {
          toast.error('Gagal menambahkan inventaris');
        }
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (item: InventoryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteItem(item);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/inventory?id=${deleteItem.id}`);
      if (res.ok) {
        toast.success('Inventaris berhasil dihapus');
        setShowDeleteDialog(false);
        setDeleteItem(null);
        fetchItems();
      } else {
        toast.error('Gagal menghapus inventaris');
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
            <div className="h-7 w-32 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-4 w-40 bg-slate-100 rounded animate-pulse mt-1.5" />
          </div>
          <div className="h-10 w-36 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[72px] bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------
  // Render: Stats
  // ----------------------------------------

  const renderStats = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
            <Hash className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Jenis Item</p>
            <p className="text-lg font-bold text-slate-800">{totalItems}</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center">
            <Package className="w-4 h-4 text-sky-700" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Unit</p>
            <p className="text-lg font-bold text-slate-800">{totalUnits}</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Kondisi Baik</p>
            <p className="text-lg font-bold text-slate-800">{totalBaik}</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
            <XCircle className="w-4 h-4 text-red-700" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Perlu Perbaikan</p>
            <p className="text-lg font-bold text-slate-800">{totalRusak}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ----------------------------------------
  // Render: Desktop Table
  // ----------------------------------------

  const renderDesktopTable = () => (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Table Header Bar */}
      <div className="flex items-center justify-between p-4 border-b bg-slate-50/50">
        <div className="flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cari nama item..."
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            className="h-9 w-52 rounded-lg border-slate-200 text-sm"
          />
          {searchName && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-slate-400 hover:text-slate-600"
              onClick={() => setSearchName('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <Select value={filterCondition} onValueChange={setFilterCondition}>
            <SelectTrigger className="h-9 w-[160px] rounded-lg border-slate-200 text-sm">
              <SelectValue placeholder="Kondisi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kondisi</SelectItem>
              <SelectItem value="BAIK">Baik</SelectItem>
              <SelectItem value="RUSAK_RINGAN">Rusak Ringan</SelectItem>
              <SelectItem value="RUSAK_BERAT">Rusak Berat</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-400">
            {filteredItems.length} item
          </span>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            className="h-9 bg-slate-800 hover:bg-slate-700 text-white text-xs"
            onClick={openAddDialog}
          >
            <Plus className="w-4 h-4 mr-1" />
            Tambah Item
          </Button>
        )}
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center">
          <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Belum ada data inventaris</p>
          <p className="text-sm text-slate-400 mt-1">
            {searchName || filterCondition !== 'ALL'
              ? 'Coba ubah filter pencarian'
              : 'Klik "Tambah Item" untuk menambahkan data'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="text-xs font-semibold w-10 text-center">No</TableHead>
                <TableHead className="text-xs font-semibold min-w-[180px]">Nama Item</TableHead>
                <TableHead className="text-xs font-semibold w-20 text-center">Jumlah</TableHead>
                <TableHead className="text-xs font-semibold w-28 text-center">Kondisi</TableHead>
                <TableHead className="text-xs font-semibold min-w-[160px]">Lokasi</TableHead>
                <TableHead className="text-xs font-semibold min-w-[200px] hidden lg:table-cell">Catatan</TableHead>
                {isAdmin && (
                  <TableHead className="text-xs font-semibold w-20 text-center">Aksi</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item, idx) => {
                const ConditionIcon = CONDITION_ICONS[item.condition] ?? Package;
                return (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-xs text-slate-400 text-center">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {item.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 font-medium">
                        {item.quantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] ${CONDITION_COLORS[item.condition] ?? 'bg-gray-100 text-gray-800'}`}>
                        <ConditionIcon className="w-3 h-3 mr-0.5" />
                        {CONDITION_LABELS[item.condition] ?? item.condition}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{item.location || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {item.notes ? (
                        <div className="flex items-start gap-1 text-xs text-slate-500">
                          <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{item.notes}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                            onClick={(e) => openEditDialog(item, e)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                            onClick={(e) => confirmDelete(item, e)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  // ----------------------------------------
  // Render: Mobile Cards
  // ----------------------------------------

  const renderMobileCards = () => (
    <div className="space-y-3">
      {/* Header + Search */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Inventaris</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filteredItems.length} item terdaftar
          </p>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            className="h-9 bg-slate-800 hover:bg-slate-700 text-white text-xs"
            onClick={openAddDialog}
          >
            <Plus className="w-4 h-4 mr-1" />
            Tambah
          </Button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cari item..."
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            className="h-10 pl-9 rounded-lg border-slate-200"
          />
        </div>
        <Select value={filterCondition} onValueChange={setFilterCondition}>
          <SelectTrigger className="h-10 w-[130px] rounded-lg border-slate-200 text-xs">
            <SelectValue placeholder="Kondisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua</SelectItem>
            <SelectItem value="BAIK">Baik</SelectItem>
            <SelectItem value="RUSAK_RINGAN">Rusak Ringan</SelectItem>
            <SelectItem value="RUSAK_BERAT">Rusak Berat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 ? (
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-8 text-center">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada data</p>
            <p className="text-sm text-slate-400 mt-1">
              {searchName || filterCondition !== 'ALL' ? 'Coba ubah filter' : 'Tambahkan item inventaris'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => {
            const ConditionIcon = CONDITION_ICONS[item.condition] ?? Package;
            return (
              <Card key={item.id} className="rounded-xl shadow-sm border">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-slate-800 truncate">
                          {item.name}
                        </h3>
                        <Badge className={`text-[9px] shrink-0 ${CONDITION_COLORS[item.condition] ?? 'bg-gray-100 text-gray-800'}`}>
                          <ConditionIcon className="w-3 h-3 mr-0.5" />
                          {CONDITION_LABELS[item.condition] ?? item.condition}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-medium text-slate-600">Jumlah: {item.quantity}</span>
                        {item.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {item.location}
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <div className="flex items-start gap-1 text-xs text-slate-400 mt-1">
                          <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{item.notes}</span>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex items-center gap-1 pt-2 mt-2 border-t border-slate-100">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-slate-400 hover:text-slate-700"
                            onClick={() => openEditDialog(item)}
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-slate-400 hover:text-red-600"
                            onClick={() => confirmDelete(item)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Hapus
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
          <h2 className="text-xl font-semibold text-slate-800">Inventaris</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola data inventaris RT
          </p>
        </div>
      </div>

      {/* Stats */}
      {renderStats()}

      {/* Table — Desktop */}
      <div className="hidden lg:block">
        {renderDesktopTable()}
      </div>

      {/* Cards — Mobile */}
      <div className="lg:hidden">
        {renderMobileCards()}
      </div>

      {/* ============================================ */}
      {/* ADD/EDIT DIALOG */}
      {/* ============================================ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-800">
              {editingItem ? 'Edit Inventaris' : 'Tambah Inventaris'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Perbarui data inventaris' : 'Isi data inventaris baru'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Nama Item *</Label>
              <Input
                placeholder="Masukkan nama item"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="h-10 rounded-lg border-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Jumlah</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                  className="h-10 rounded-lg border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Kondisi</Label>
                <Select
                  value={form.condition}
                  onValueChange={val => setForm({ ...form, condition: val })}
                >
                  <SelectTrigger className="h-10 rounded-lg border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAIK">Baik</SelectItem>
                    <SelectItem value="RUSAK_RINGAN">Rusak Ringan</SelectItem>
                    <SelectItem value="RUSAK_BERAT">Rusak Berat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Lokasi *</Label>
              <Input
                placeholder="Lokasi penyimpanan"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                className="h-10 rounded-lg border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Catatan</Label>
              <Textarea
                placeholder="Catatan tambahan (opsional)"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="rounded-lg border-slate-200"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Menyimpan...' : editingItem ? 'Simpan' : 'Tambah'}
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
              Apakah Anda yakin ingin menghapus item &quot;{deleteItem?.name}&quot;? Tindakan ini tidak dapat dibatalkan.
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
              onClick={handleDelete}
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
