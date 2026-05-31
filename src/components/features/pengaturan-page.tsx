'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { formatCurrency, APP_NAME } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Building2,
  Info,
  Clock,
  Shield,
  Wallet,
  Save,
  Check,
  Loader2,
} from 'lucide-react';

interface PengaturanPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

interface SettingItem {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

export function PengaturanPage({ userId, familyId, isAdmin }: PengaturanPageProps) {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Local edit state
  const [jimpitanAmount, setJimpitanAmount] = useState('1000');
  const [rtName, setRtName] = useState('');
  const [rtAddress, setRtAddress] = useState('');
  const [ketuaRtName, setKetuaRtName] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      if (res.ok) {
        const data = await res.json();
        const items: SettingItem[] = data.settings || data || [];
        setSettings(items);
        // Populate local state
        items.forEach((s: SettingItem) => {
          if (s.key === 'jimpitan_amount') setJimpitanAmount(s.value);
          if (s.key === 'rt_name') setRtName(s.value);
          if (s.key === 'rt_address') setRtAddress(s.value);
          if (s.key === 'ketua_rt_name') setKetuaRtName(s.value);
        });
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (key: string, value: string) => {
    try {
      setSaving(key);
      setSaved(null);
      const res = await api.put('/settings', { key, value });
      if (res.ok) {
        setSaved(key);
        setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
        setTimeout(() => setSaved(null), 2000);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-800">Pengaturan</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Pengaturan</h1>

      {/* Jimpitan Settings */}
      <Card className="rounded-xl shadow-sm border">
        <CardHeader className="pb-2 px-5 pt-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-slate-600" />
            <CardTitle className="text-sm font-semibold text-slate-800">Pengaturan Jimpitan</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div>
            <Label className="text-sm text-slate-700">Besaran Jimpitan Harian (Rp)</Label>
            <p className="text-xs text-slate-400 mb-2">
              Nilai yang harus dibayar setiap KK per hari. Grup ronda akan menarik sebesar ini.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Rp</span>
              <Input
                type="number"
                value={jimpitanAmount}
                onChange={(e) => setJimpitanAmount(e.target.value)}
                className="w-40 h-10"
                min="0"
                step="500"
              />
              <Button
                size="sm"
                className="h-10 gap-1.5"
                disabled={saving === 'jimpitan_amount'}
                onClick={() => handleSave('jimpitan_amount', jimpitanAmount)}
              >
                {saving === 'jimpitan_amount' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saved === 'jimpitan_amount' ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saved === 'jimpitan_amount' ? 'Tersimpan' : 'Simpan'}
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Preview: {formatCurrency(parseInt(jimpitanAmount) || 0)} per KK per hari
            </p>
          </div>
          <Separator />
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="h-3.5 w-3.5" />
            <span>Opsi pembayaran di form tarik jimpitan otomatis mengikuti: [0] [Rp {Math.floor((parseInt(jimpitanAmount) || 1000) / 2)}] [Rp {jimpitanAmount}]</span>
          </div>
        </CardContent>
      </Card>

      {/* RT Info */}
      <Card className="rounded-xl shadow-sm border">
        <CardHeader className="pb-2 px-5 pt-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-600" />
            <CardTitle className="text-sm font-semibold text-slate-800">Informasi RT</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div>
            <Label className="text-sm text-slate-700">Nama RT</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={rtName}
                onChange={(e) => setRtName(e.target.value)}
                className="h-10"
                placeholder="RT 01/RW 01"
              />
              <Button
                size="sm"
                className="h-10 gap-1.5 shrink-0"
                disabled={saving === 'rt_name'}
                onClick={() => handleSave('rt_name', rtName)}
              >
                {saving === 'rt_name' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-sm text-slate-700">Alamat</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={rtAddress}
                onChange={(e) => setRtAddress(e.target.value)}
                className="h-10"
                placeholder="Jl. Contoh No. 123"
              />
              <Button
                size="sm"
                className="h-10 gap-1.5 shrink-0"
                disabled={saving === 'rt_address'}
                onClick={() => handleSave('rt_address', rtAddress)}
              >
                {saving === 'rt_address' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-sm text-slate-700">Nama Ketua RT</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={ketuaRtName}
                onChange={(e) => setKetuaRtName(e.target.value)}
                className="h-10"
                placeholder="Nama Ketua RT"
              />
              <Button
                size="sm"
                className="h-10 gap-1.5 shrink-0"
                disabled={saving === 'ketua_rt_name'}
                onClick={() => handleSave('ketua_rt_name', ketuaRtName)}
              >
                {saving === 'ketua_rt_name' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card className="rounded-xl shadow-sm border">
        <CardHeader className="pb-2 px-5 pt-5">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-600" />
            <CardTitle className="text-sm font-semibold text-slate-800">Informasi Aplikasi</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-500">Nama Aplikasi</span>
              <span className="text-sm font-medium text-slate-700">{APP_NAME}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-500">Versi</span>
              <Badge variant="secondary" className="text-xs">v1.0.0</Badge>
            </div>
            <Separator />
            <div className="flex items-start gap-2 py-1.5">
              <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Terakhir Diperbarui</p>
                <p className="text-sm font-medium text-slate-700">Mei 2025</p>
              </div>
            </div>
            <div className="flex items-start gap-2 py-1.5">
              <Shield className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Keamanan</p>
                <p className="text-sm font-medium text-slate-700">Token HMAC-SHA256</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
