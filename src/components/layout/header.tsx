'use client';

import { useAuthStore } from '@/stores/auth-store';
import { LogOut } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/constants';

interface HeaderProps {
  title: string;
  userName: string;
  userRole: string;
  compact?: boolean;
}

export function Header({ title, userName, userRole, compact }: HeaderProps) {
  const { clearAuth } = useAuthStore();

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
