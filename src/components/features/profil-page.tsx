'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import {
  ROLE_LABELS,
  APP_NAME,
} from '@/lib/constants';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Phone,
  MapPin,
  LogOut,
  Lock,
  Save,
  CheckCircle2,
  Loader2,
  Home,
  Users,
} from 'lucide-react';

interface ProfilPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

interface FamilyInfo {
  id: string;
  familyHead: string;
  address: string;
  memberCount: number;
  rondaGroup: string | null;
}

export function ProfilPage({ userId, familyId, isAdmin }: ProfilPageProps) {
  const { user, clearAuth } = useAuthStore();
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [family, setFamily] = useState<FamilyInfo | null>(null);

  useEffect(() => {
    if (user) {
      setPhone(user.phone || '');
      setAddress(user.address || '');
    }
  }, [user]);

  useEffect(() => {
    if (familyId) {
      loadFamily();
    }
  }, [familyId]);

  const loadFamily = async () => {
    try {
      const res = await api.get('/families');
      if (res.ok) {
        const data = await res.json();
        const myFamily = (data.families || []).find((f: FamilyInfo) => f.id === familyId);
        if (myFamily) {
          setFamily(myFamily);
        }
      }
    } catch (error) {
      console.error('Failed to load family:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaved(false);
      const res = await api.put('/users', {
        id: userId,
        phone,
        address,
      });
      if (res.ok) {
        setSaved(true);
        // Update auth store with new data
        const data = await res.json();
        if (data.user) {
          // Update auth store properly instead of direct localStorage manipulation
          const currentToken = localStorage.getItem('auth_token');
          if (currentToken) {
            const { setAuth } = useAuthStore.getState();
            setAuth(data.user, currentToken);
          }
        }
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-4">
      {/* Profile Card */}
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
              <Badge
                variant="secondary"
                className="mt-1 text-xs bg-slate-100 text-slate-700"
              >
                {ROLE_LABELS[user.role] || user.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Family Info */}
      {family && (
        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-slate-600" />
              <CardTitle className="text-sm font-semibold">Informasi Keluarga</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2.5">
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Kepala Keluarga</p>
                  <p className="text-sm font-medium text-slate-700">{family.familyHead}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Alamat</p>
                  <p className="text-sm font-medium text-slate-700">{family.address}</p>
                </div>
              </div>
              {family.rondaGroup && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Grup Ronda:</span>
                  <span className="font-medium text-slate-700">{family.rondaGroup}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!familyId && (
        <Card className="rounded-xl shadow-sm border border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Home className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-amber-800">Belum terdaftar di keluarga</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Hubungi pengurus RT untuk pendaftaran keluarga
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Profile */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-600" />
            <CardTitle className="text-sm font-semibold">Edit Profil</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                No. Telepon
              </span>
            </Label>
            <Input
              id="phone"
              placeholder="Masukkan no. telepon"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Alamat
              </span>
            </Label>
            <Input
              id="address"
              placeholder="Masukkan alamat"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-11"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
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

      {/* Change Password Placeholder */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <Lock className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Ubah Password</p>
                <p className="text-xs text-slate-400">Segera tersedia</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" disabled className="text-slate-400 h-9">
              Segera
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Logout */}
      <Button
        variant="outline"
        onClick={clearAuth}
        className="w-full h-11 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Keluar
      </Button>

      {/* App Info */}
      <div className="text-center pt-2 pb-4">
        <p className="text-xs text-slate-400">
          {APP_NAME} v1.0.0
        </p>
        <p className="text-[11px] text-slate-300 mt-0.5">
          Sistem Manajemen RT Digital
        </p>
      </div>
    </div>
  );
}


