'use client';

import { cn } from '@/lib/utils';
import {
  LayoutDashboard, UserCheck, Users, Shield, Calendar, Wallet,
  Package, Megaphone, FileText, Settings, UserCog,
  Home, LogOut, X
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { ROLE_LABELS } from '@/lib/constants';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, UserCheck, Users, Shield, Calendar, Wallet,
  Package, Megaphone, FileText, Settings, UserCog, Home,
};

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

interface SidebarProps {
  items: readonly NavItem[];
  currentPage: string;
  onNavigate: (page: string) => void;
  userName: string;
  userRole: string;
}

export function Sidebar({ items, currentPage, onNavigate, userName, userRole }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { clearAuth } = useAuthStore();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200">
        <h1 className="text-lg font-bold text-slate-800">Management RT</h1>
        <p className="text-xs text-slate-500 mt-1">Sistem Manajemen Digital</p>
      </div>

      {/* User info */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{userName}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[userRole] || userRole}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = iconMap[item.icon] || LayoutDashboard;
            const isActive = currentPage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-200">
        <button
          onClick={() => {
            clearAuth();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-sm border border-slate-200"
      >
        <div className="w-5 h-5 flex flex-col justify-center gap-1">
          <span className="block h-0.5 w-5 bg-slate-600" />
          <span className="block h-0.5 w-5 bg-slate-600" />
          <span className="block h-0.5 w-5 bg-slate-600" />
        </div>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white z-50 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 z-30">
        {sidebarContent}
      </aside>
    </>
  );
}
