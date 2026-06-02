'use client';

import { useAuthStore } from '@/stores/auth-store';
import { LogOut } from 'lucide-react';
import { ROLE_LABELS, APP_NAME } from '@/lib/constants';
import Image from 'next/image';

interface HeaderProps {
  title: string;
  userName: string;
  userRole: string;
  compact?: boolean;
  isWarga?: boolean;
}

export function Header({ title, userName, userRole, compact, isWarga }: HeaderProps) {
  const { clearAuth } = useAuthStore();

  if (isWarga) {
    return (
      <header className="bg-gradient-to-r from-teal-700 to-teal-600 px-4 py-3 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Waduk Landung"
              width={32}
              height={32}
              className="object-contain"
            />
            <div>
              <h1 className="text-sm font-bold tracking-wide">{APP_NAME}</h1>
              <p className="text-[10px] text-teal-200">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium text-white">{userName}</p>
                <p className="text-[10px] text-teal-200">{ROLE_LABELS[userRole] || userRole}</p>
              </div>
            </div>
            <button
              onClick={clearAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-200 hover:text-white hover:bg-rose-600/40 transition-colors text-xs font-semibold border border-rose-400/30"
              title="Keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={compact ? 'bg-white border-b border-slate-200 px-4 py-3' : 'bg-white border-b border-slate-200 px-6 py-4 lg:pl-72'}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 pl-12 lg:pl-0">
          <div>
            <h1 className={compact ? 'text-base font-semibold text-slate-800' : 'text-lg font-semibold text-slate-800'}>{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-semibold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-slate-700">{userName}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[userRole] || userRole}</p>
            </div>
          </div>
          {compact && (
            <button
              onClick={clearAuth}
              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
