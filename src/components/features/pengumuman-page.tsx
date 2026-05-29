'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { formatDate, formatDateShort } from '@/lib/constants';
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
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Pin,
  Calendar,
  Loader2,
  Inbox,
  Eye,
} from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    name: string;
  };
}

interface PengumumanPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

const defaultForm = {
  title: '',
  content: '',
  isPinned: false,
};

export function PengumumanPage({ userId, familyId, isAdmin }: PengumumanPageProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/announcements');
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(Array.isArray(data) ? data : data.announcements ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Sort: pinned first, then by date descending
  const sortedAnnouncements = [...announcements]
    .filter((a) => a.isActive !== false)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const openAddDialog = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEditDialog = (item: Announcement) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      content: item.content,
      isPinned: item.isPinned,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSubmitting(true);
    try {
      if (editingItem) {
        const res = await api.put('/announcements', {
          id: editingItem.id,
          title: form.title,
          content: form.content,
          isPinned: form.isPinned,
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Gagal mengubah pengumuman');
          return;
        }
      } else {
        const res = await api.post('/announcements', {
          title: form.title,
          content: form.content,
          isPinned: form.isPinned,
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Gagal menambah pengumuman');
          return;
        }
      }
      setDialogOpen(false);
      setForm(defaultForm);
      setEditingItem(null);
      fetchAnnouncements();
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
      // Soft delete: set isActive to false
      const res = await api.put('/announcements', {
        id: deleteId,
        isActive: false,
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Gagal menghapus pengumuman');
        return;
      }
      setDeleteId(null);
      fetchAnnouncements();
    } catch {
      alert('Terjadi kesalahan jaringan');
    } finally {
      setDeleting(false);
    }
  };

  const truncateText = (text: string, maxLen: number = 150) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Pengumuman</h2>
          <p className="text-sm text-slate-500">Informasi dan pengumuman RT</p>
        </div>
        {isAdmin && (
          <Button
            onClick={openAddDialog}
            className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
          >
            <Plus className="size-4 mr-1" />
            Buat Pengumuman
          </Button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Memuat data...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && sortedAnnouncements.length === 0 && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Inbox className="size-6 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">Belum ada pengumuman</p>
            <p className="text-sm text-slate-400 mt-1">
              {isAdmin
                ? 'Buat pengumuman pertama untuk warga'
                : 'Belum ada pengumuman dari pengurus'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Announcements List */}
      {!loading && sortedAnnouncements.length > 0 && (
        <div className="space-y-4">
          {sortedAnnouncements.map((item) => {
            const isExpanded = expandedId === item.id;
            const isLong = item.content.length > 150;
            return (
              <Card
                key={item.id}
                className={`rounded-xl shadow-sm border transition-shadow hover:shadow-md ${
                  item.isPinned ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        item.isPinned ? 'bg-amber-100' : 'bg-slate-100'
                      }`}>
                        <Megaphone className={`size-4 ${item.isPinned ? 'text-amber-600' : 'text-slate-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{item.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Calendar className="size-3" />
                            {formatDateShort(item.createdAt)}
                          </div>
                          {item.author && (
                            <span className="text-xs text-slate-400">· {item.author.name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.isPinned && (
                        <Badge className="bg-amber-100 text-amber-800">
                          <Pin className="size-3 mr-1" />
                          Disematkan
                        </Badge>
                      )}
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <AlertDialog open={deleteId === item.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteId(item.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Pengumuman</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus pengumuman &quot;{item.title}&quot;? Tindakan ini tidak dapat dibatalkan.
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
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {isExpanded || !isLong ? item.content : truncateText(item.content)}
                  </div>
                  {isLong && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 mt-2 text-slate-500 hover:text-slate-700 px-0"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <Eye className="size-3.5 mr-1" />
                      {isExpanded ? 'Sembunyikan' : 'Baca selengkapnya'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Pengumuman' : 'Buat Pengumuman'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Judul *</Label>
              <Input
                id="ann-title"
                placeholder="Masukkan judul pengumuman"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-content">Isi Pengumuman *</Label>
              <Textarea
                id="ann-content"
                placeholder="Tulis isi pengumuman..."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={5}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Sematkan pengumuman</span>
              </label>
              {form.isPinned && (
                <Badge className="bg-amber-100 text-amber-800">
                  <Pin className="size-3 mr-1" />
                  Disematkan
                </Badge>
              )}
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
              disabled={submitting || !form.title.trim() || !form.content.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1" />
                  Menyimpan...
                </>
              ) : editingItem ? (
                'Simpan Perubahan'
              ) : (
                'Buat Pengumuman'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
