import { create } from 'zustand';

interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  phone: string | null;
  address: string | null;
  familyId: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAdmin: false,

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
    }
    const admin = ['KETUA_RT', 'SEKRETARIS', 'BENDAHARA', 'PENGURUS'].includes(user.role);
    set({ user, token, isLoading: false, isAdmin: admin });
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
    set({ user: null, token: null, isLoading: false, isAdmin: false });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  hydrate: async () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');

    if (!token || !userStr) {
      set({ isLoading: false });
      return;
    }

    try {
      const user = JSON.parse(userStr);
      const admin = ['KETUA_RT', 'SEKRETARIS', 'BENDAHARA', 'PENGURUS'].includes(user.role);
      set({ user, token, isLoading: false, isAdmin: admin });

      // Verify token with backend
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        set({ user: null, token: null, isLoading: false, isAdmin: false });
      } else {
        const data = await res.json();
        if (data.user) {
          const a = ['KETUA_RT', 'SEKRETARIS', 'BENDAHARA', 'PENGURUS'].includes(data.user.role);
          set({ user: data.user, isAdmin: a });
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        }
      }
    } catch {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      set({ user: null, token: null, isLoading: false, isAdmin: false });
    }
  },
}));
