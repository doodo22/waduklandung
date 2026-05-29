'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { formatDateShort, CONDITION_LABELS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  MapPin,
  FileText,
  Loader2,
  Inbox,
} from 'lucide-react';

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
  BAIK: 'bg-green-100 text-green-800',
  RUSAK_RINGAN: 'bg-yellow-100 text-yellow-800',
  RUSAK_BERAT: 'bg-red-100 text-red-800',
};

const defaultForm = {
  name: '',
  quantity: 1,
  condition: 'BAIK',
  location: '',
  notes: '',
};

export function InventarisPage({ userId, familyId, isAdmin }: InventarisPageProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [filterCondition, setFilterCondition] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory');
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : data.inventory ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = items.filter((item) => {
    const matchName = !searchName || item.name.toLowerCase().includes(searchName.toLowerCase());
    const matchCondition = filterCondition === 'ALL' || item.condition === filterCondition;
    return matchName && matchCondition;
  });

  const openAddDialog = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEditDialog = (item: InventoryItem) => {
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
    if (!form.name.trim() || !form.location.trim()) return;
    setSubmitting(true);
    try {
      if (editingItem) {
        const res = await api.put('/inventory', {
          id: editingItem.id,
          name: form.name,
          quantity: form.quantity,
          condition: form.condition,
          location: form.location,
          notes: form.notes || null,
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Gagal mengubah inventaris');
          return;
        }
      } else {
        const res = await api.post('/inventory', {
          name: form.name,
          quantity: form.quantity,
          condition: form.condition,
          location: form.location,
          notes: form.notes || null,
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Gagal menambah inventaris');
          return;
        }
      }
      setDialogOpen(false);
      setForm(defaultForm);
      setEditingItem(null);
      fetchItems();
    } catch {
      alert('Terjadi kesalahan jaringan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/inventory?id=${deleteId}`);
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Gagal menghapus inventaris');
        return;
      }
      setDeleteId(null);
      fetchItems();
    } catch {
      alert('Terjadi kesalahan jaringan');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Inventaris</h2>
          <p className="text-sm text-slate-500">Kelola data inventaris RT</p>
        </div>
        {isAdmin && (
          <Button
            onClick={openAddDialog}
            className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
          >
            <Plus className="size-4 mr-1" />
            Tambah Item
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Cari nama item..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <Select value={filterCondition} onValueChange={setFilterCondition}>
          <SelectTrigger className="h-10 w-full sm:w-[180px]">
            <SelectValue placeholder="Semua Kondisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Kondisi</SelectItem>
            <SelectItem value="BAIK">Baik</SelectItem>
            <SelectItem value="RUSAK_RINGAN">Rusak Ringan</SelectItem>
            <SelectItem value="RUSAK_BERAT">Rusak Berat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Memuat data...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredItems.length === 0 && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Inbox className="size-6 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">Belum ada data inventaris</p>
            <p className="text-sm text-slate-400 mt-1">
              {searchName || filterCondition !== 'ALL'
                ? 'Coba ubah filter pencarian'
                : 'Tambahkan item inventaris pertama'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Items Grid */}
      {!loading && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Package className="size-4 text-slate-500" />
                    </div>
                    <CardTitle className="text-base truncate">{item.name}</CardTitle>
                  </div>
                  <Badge className={CONDITION_COLORS[item.condition] ?? 'bg-gray-100 text-gray-800'}>
                    {CONDITION_LABELS[item.condition] ?? item.condition}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="font-medium">Jumlah:</span>
                  <span>{item.quantity}</span>
                </div>
                {item.location && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="size-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </div>
                )}
                {item.notes && (
                  <div className="flex items-start gap-2 text-sm text-slate-500">
                    <FileText className="size-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{item.notes}</span>
                  </div>
                )}
                <div className="text-xs text-slate-400 pt-1">
                  Diperbarui: {formatDateShort(item.updatedAt ?? item.createdAt)}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-slate-600 hover:text-slate-800"
                      onClick={() => openEditDialog(item)}
                    >
                      <Pencil className="size-3.5 mr-1" />
                      Edit
                    </Button>
                    <AlertDialog open={deleteId === item.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className="size-3.5 mr-1" />
                          Hapus
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Inventaris</AlertDialogTitle>
                          <AlertDialogDescription>
                            Apakah Anda yakin ingin menghapus item &quot;{item.name}&quot;? Tindakan ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            {deleting ? 'Menghapus...' : 'Hapus'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Inventaris' : 'Tambah Inventaris'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inv-name">Nama Item *</Label>
              <Input
                id="inv-name"
                placeholder="Masukkan nama item"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inv-qty">Jumlah</Label>
                <Input
                  id="inv-qty"
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label>Kondisi</Label>
                <Select
                  value={form.condition}
                  onValueChange={(val) => setForm({ ...form, condition: val })}
                >
                  <SelectTrigger className="h-10 w-full">
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
              <Label htmlFor="inv-location">Lokasi *</Label>
              <Input
                id="inv-location"
                placeholder="Masukkan lokasi penyimpanan"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-notes">Catatan</Label>
              <Textarea
                id="inv-notes"
                placeholder="Catatan tambahan (opsional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-10"
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
              disabled={submitting || !form.name.trim() || !form.location.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1" />
                  Menyimpan...
                </>
              ) : editingItem ? (
                'Simpan Perubahan'
              ) : (
                'Tambah Item'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
