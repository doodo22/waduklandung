'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Building2,
  Info,
  Clock,
  Shield,
} from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

interface PengaturanPageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

export function PengaturanPage({ userId, familyId, isAdmin }: PengaturanPageProps) {
  return (
    <div className="space-y-4">
      {/* Placeholder for RT Info Settings */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-600" />
            <CardTitle className="text-sm font-semibold">Informasi RT</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="text-center py-8">
            <Settings className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Pengaturan akan segera tersedia</p>
            <p className="text-xs text-slate-400 mt-1">
              Pengaturan informasi RT seperti nama, alamat, dan nomor RT/RW akan dapat diatur di sini
            </p>
          </div>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card className="rounded-xl shadow-sm border border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-600" />
            <CardTitle className="text-sm font-semibold">Informasi Aplikasi</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-500">Nama Aplikasi</span>
              <span className="text-sm font-medium text-slate-700">{APP_NAME}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-500">Versi</span>
              <span className="text-sm font-medium text-slate-700">1.0.0</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-500">Framework</span>
              <span className="text-sm font-medium text-slate-700">Next.js 16</span>
            </div>
            <Separator />
            <div className="flex items-start gap-2 py-1.5">
              <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Terakhir Diperbarui</p>
                <p className="text-sm font-medium text-slate-700">Maret 2025</p>
              </div>
            </div>
            <div className="flex items-start gap-2 py-1.5">
              <Shield className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Keamanan</p>
                <p className="text-sm font-medium text-slate-700">Autentikasi JWT</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
