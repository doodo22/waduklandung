'use client';

import { cn } from '@/lib/utils';
import { Home, Calendar, Shield, Wallet, User } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home, Calendar, Shield, Wallet, User,
};

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
}

interface BottomNavProps {
  items: readonly NavItem[];
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function BottomNav({ items, currentPage, onNavigate }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-teal-100 z-40 safe-area-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = iconMap[item.icon] || Home;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-4 min-w-[64px] transition-all',
                isActive ? 'text-teal-700' : 'text-stone-400'
              )}
            >
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full transition-all',
                isActive ? 'bg-teal-100' : ''
              )}>
                <Icon className={cn('w-5 h-5', isActive ? 'text-teal-700' : 'text-stone-400')} />
              </div>
              <span className={cn('text-[10px] mt-1 font-semibold', isActive ? 'text-teal-700' : 'text-stone-400')}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
