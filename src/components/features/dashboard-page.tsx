'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateShort,
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  RONDA_STATUS_LABELS,
  SELAPANAN_STATUS_LABELS,
} from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Home,
  Wallet,
  UserCheck,
  FileText,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Megaphone,
  Shield,
  Calendar,
  Clock,
} from 'lucide-react';

// ---------- Types ----------

interface DashboardStats {
  totalWarga: number;
  totalKeluarga: number;
  saldoKas: number;
  wargaPending: number;
  suratPending: number;
  totalInventaris: number;
}

interface RecentTransaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  date: string;
}

interface RecentAnnouncement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isPinned: boolean;
  author?: { name: string } | null;
}

interface TodayRonda {
  id: string;
  date: string;
  shift: string;
  group: { id: string; name: string };
  logs: { id: string; status: string; user: { name: string } }[];
}

interface UpcomingSelapanan {
  id: string;
  meetingDate: string;
  meetingLocation: string | null;
  notes: string | null;
  status: string;
}

interface DashboardData {
  stats: DashboardStats;
  recentTransactions: RecentTransaction[];
  recentAnnouncements: RecentAnnouncement[];
  todayRonda: TodayRonda[];
  upcomingSelapanan: UpcomingSelapanan | null;
}

interface DashboardPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

// ---------- Stat Card Config ----------

interface StatCardConfig {
  key: keyof DashboardStats;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  format: 'number' | 'currency';
}

const STAT_CARDS: StatCardConfig[] = [
  { key: 'totalWarga', label: 'Total Warga', icon: Users, color: 'text-slate-700', bgColor: 'bg-slate-100', format: 'number' },
  { key: 'totalKeluarga', label: 'Total Keluarga', icon: Home, color: 'text-emerald-700', bgColor: 'bg-emerald-50', format: 'number' },
  { key: 'saldoKas', label: 'Saldo Kas', icon: Wallet, color: 'text-green-700', bgColor: 'bg-green-50', format: 'currency' },
  { key: 'wargaPending', label: 'Warga Pending', icon: UserCheck, color: 'text-yellow-700', bgColor: 'bg-yellow-50', format: 'number' },
  { key: 'suratPending', label: 'Surat Pending', icon: FileText, color: 'text-orange-700', bgColor: 'bg-orange-50', format: 'number' },
  { key: 'totalInventaris', label: 'Total Inventaris', icon: Package, color: 'text-teal-700', bgColor: 'bg-teal-50', format: 'number' },
];

// ---------- Skeletons ----------

function StatCardSkeleton() {
  return (
    <Card className="rounded-xl shadow-sm border">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="rounded-xl shadow-sm border">
      <CardHeader className="pb-2 px-5 pt-5">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Main Component ----------

export function DashboardPage({ userId, familyId, isAdmin }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/dashboard');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Gagal memuat data dashboard');
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDashboard();
    return () => { cancelled = true; };
  }, []);

  // ---------- Render: Loading ----------

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Ringkasan data RT</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {STAT_CARDS.map((s) => (
            <StatCardSkeleton key={s.key} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ListSkeleton rows={5} />
          <ListSkeleton rows={3} />
        </div>
      </div>
    );
  }

  // ---------- Render: Error ----------

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 text-sm text-slate-600 hover:text-slate-800 underline"
            >
              Coba lagi
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { stats, recentTransactions, recentAnnouncements, todayRonda = [], upcomingSelapanan } = data;

  // ---------- Render Helpers ----------

  function formatStatValue(key: keyof DashboardStats, value: number | undefined): string {
    if (value === undefined || value === null) return '0';
    const config = STAT_CARDS.find((s) => s.key === key);
    if (config?.format === 'currency') return formatCurrency(value);
    return value.toLocaleString('id-ID');
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">Ringkasan data RT</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {STAT_CARDS.map((cfg) => {
          const Icon = cfg.icon;
          const value = stats[cfg.key];
          return (
            <Card key={cfg.key} className="rounded-xl shadow-sm border">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cfg.bgColor}`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 truncate">{cfg.label}</p>
                    <p className="text-lg font-semibold text-slate-800 truncate">
                      {formatStatValue(cfg.key, value)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card className="rounded-xl shadow-sm border">
          <CardHeader className="pb-2 px-5 pt-5">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-semibold text-slate-800">Transaksi Terakhir</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Belum ada transaksi</p>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          tx.type === 'INCOME' ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        {tx.type === 'INCOME' ? (
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {CATEGORY_LABELS[tx.category] || tx.category}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{tx.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-semibold ${
                            tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {tx.type === 'INCOME' ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </p>
                        <p className="text-xs text-slate-400">{formatDateShort(tx.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Recent Announcements */}
        <Card className="rounded-xl shadow-sm border">
          <CardHeader className="pb-2 px-5 pt-5">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-semibold text-slate-800">Pengumuman Terbaru</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {recentAnnouncements.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Belum ada pengumuman</p>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {recentAnnouncements.map((ann) => (
                    <div key={ann.id} className="rounded-lg border border-slate-100 p-3">
                      <p className="text-sm font-medium text-slate-700">{ann.title}</p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ann.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-400">{formatDateShort(ann.createdAt)}</span>
                        {ann.author && (
                          <>
                            <span className="text-xs text-slate-300">·</span>
                            <span className="text-xs text-slate-400">{ann.author.name}</span>
                          </>
                        )}
                        {ann.isPinned && (
                          <>
                            <span className="text-xs text-slate-300">·</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Disematkan</Badge>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Today's Ronda */}
        <Card className="rounded-xl shadow-sm border">
          <CardHeader className="pb-2 px-5 pt-5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-semibold text-slate-800">Jadwal Ronda Hari Ini</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {todayRonda.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Tidak ada jadwal ronda hari ini</p>
            ) : (
              <div className="space-y-4">
                {todayRonda.map((schedule) => (
                  <div key={schedule.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {schedule.shift === 'MALAM' ? 'Malam' : 'Pagi'}
                      </Badge>
                      <span className="text-xs text-slate-500">{schedule.group?.name || 'Kelompok'}</span>
                    </div>
                    {schedule.logs.length === 0 ? (
                      <p className="text-xs text-slate-400">Belum ada log ronda</p>
                    ) : (
                      <div className="space-y-2">
                        {schedule.logs.map((log) => (
                          <div key={log.id} className="flex items-center gap-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                              {log.user?.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <span className="text-sm text-slate-700 flex-1">{log.user?.name || '-'}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${
                                STATUS_COLORS[log.status] || ''
                              }`}
                            >
                              {RONDA_STATUS_LABELS[log.status] || log.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Selapanan */}
        <Card className="rounded-xl shadow-sm border">
          <CardHeader className="pb-2 px-5 pt-5">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-semibold text-slate-800">Selapanan Mendatang</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {!upcomingSelapanan ? (
              <p className="text-sm text-slate-400 py-4 text-center">Tidak ada jadwal selapanan mendatang</p>
            ) : (
              <div className="rounded-lg border border-slate-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    {SELAPANAN_STATUS_LABELS[upcomingSelapanan.status] || upcomingSelapanan.status}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {formatDateShort(upcomingSelapanan.meetingDate)}
                </p>
                {upcomingSelapanan.meetingLocation && (
                  <p className="text-xs text-slate-500 mt-1">
                    Lokasi: {upcomingSelapanan.meetingLocation}
                  </p>
                )}
                {upcomingSelapanan.notes && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {upcomingSelapanan.notes}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
