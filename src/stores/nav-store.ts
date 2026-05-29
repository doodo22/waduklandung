import { create } from 'zustand';

interface NavState {
  currentPage: string;
  setPage: (page: string) => void;
}

export const useNavStore = create<NavState>((set) => ({
  currentPage: typeof window !== 'undefined' && localStorage.getItem('auth_user')
    ? (JSON.parse(localStorage.getItem('auth_user') || '{}').role &&
      ['KETUA_RT', 'SEKRETARIS', 'BENDAHARA', 'PENGURUS'].includes(JSON.parse(localStorage.getItem('auth_user') || '{}').role))
      ? 'dashboard'
      : 'beranda'
    : 'dashboard',
  setPage: (page) => set({ currentPage: page }),
}));
