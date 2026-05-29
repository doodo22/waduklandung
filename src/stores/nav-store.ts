import { create } from 'zustand';

interface NavState {
  currentPage: string;
  setPage: (page: string) => void;
}

export const useNavStore = create<NavState>((set) => ({
  currentPage: 'dashboard',
  setPage: (page) => set({ currentPage: page }),
}));
