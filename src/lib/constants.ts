// ============================================
// APPLICATION CONSTANTS
// ============================================

export const APP_NAME = 'Management RT';
export const APP_DESCRIPTION = 'Sistem Manajemen RT Digital';

// User Roles
export const ROLES = {
  KETUA_RT: 'KETUA_RT',
  SEKRETARIS: 'SEKRETARIS',
  BENDAHARA: 'BENDAHARA',
  PENGURUS: 'PENGURUS',
  WARGA: 'WARGA',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  KETUA_RT: 'Ketua RT',
  SEKRETARIS: 'Sekretaris',
  BENDAHARA: 'Bendahara',
  PENGURUS: 'Pengurus',
  WARGA: 'Warga',
};

// User Status
export const USER_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  INACTIVE: 'INACTIVE',
} as const;

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu Verifikasi',
  ACTIVE: 'Aktif',
  REJECTED: 'Ditolak',
  INACTIVE: 'Tidak Aktif',
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};

// Ronda
export const RONDA_SHIFT = {
  MALAM: 'MALAM',
  PAGI: 'PAGI',
} as const;

export const RONDA_STATUS = {
  HADIR: 'HADIR',
  TIDAK_HADIR: 'TIDAK_HADIR',
  IZIN: 'IZIN',
} as const;

export const RONDA_STATUS_LABELS: Record<string, string> = {
  HADIR: 'Hadir',
  TIDAK_HADIR: 'Tidak Hadir',
  IZIN: 'Izin',
};

// Transaction
export const TRANSACTION_TYPE = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;

export const TRANSACTION_CATEGORY = {
  IURAN_BULANAN: 'IURAN_BULANAN',
  IURAN_RONDA: 'IURAN_RONDA',
  DENDA: 'DENDA',
  JIMPITAN: 'JIMPITAN',
  PEMBELIAN: 'PEMBELIAN',
  PEMBANGUNAN: 'PEMBANGUNAN',
  LAIN_LAIN: 'LAIN_LAIN',
} as const;

export const CATEGORY_LABELS: Record<string, string> = {
  IURAN_BULANAN: 'Iuran Bulanan',
  IURAN_RONDA: 'Iuran Ronda',
  DENDA: 'Denda',
  JIMPITAN: 'Jimpitan',
  PEMBELIAN: 'Pembelian',
  PEMBANGUNAN: 'Pembangunan',
  LAIN_LAIN: 'Lain-lain',
};

// Fine
export const FINE_TYPE = {
  RONDA: 'RONDA',
  JIMPITAN: 'JIMPITAN',
  LAIN_LAIN: 'LAIN_LAIN',
} as const;

export const FINE_STATUS = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
} as const;

// Inventory
export const INVENTORY_CONDITION = {
  BAIK: 'BAIK',
  RUSAK_RINGAN: 'RUSAK_RINGAN',
  RUSAK_BERAT: 'RUSAK_BERAT',
} as const;

export const CONDITION_LABELS: Record<string, string> = {
  BAIK: 'Baik',
  RUSAK_RINGAN: 'Rusak Ringan',
  RUSAK_BERAT: 'Rusak Berat',
};

// Letter
export const LETTER_TYPE = {
  DOMISILI: 'DOMISILI',
  PENGANTAR: 'PENGANTAR',
  KETERANGAN: 'KETERANGAN',
  LAIN_LAIN: 'LAIN_LAIN',
} as const;

export const LETTER_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
} as const;

export const LETTER_TYPE_LABELS: Record<string, string> = {
  DOMISILI: 'Surat Keterangan Domisili',
  PENGANTAR: 'Surat Pengantar',
  KETERANGAN: 'Surat Keterangan',
  LAIN_LAIN: 'Lain-lain',
};

export const LETTER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  COMPLETED: 'Selesai',
};

// Selapanan
export const SELAPANAN_STATUS = {
  UPCOMING: 'UPCOMING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const SELAPANAN_STATUS_LABELS: Record<string, string> = {
  UPCOMING: 'Akan Datang',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

// Pengurus roles that see admin dashboard
export const ADMIN_ROLES = [ROLES.KETUA_RT, ROLES.SEKRETARIS, ROLES.BENDAHARA, ROLES.PENGURUS];

// Navigation
export const WARGA_NAV_ITEMS = [
  { id: 'beranda', label: 'Beranda', icon: 'Home' },
  { id: 'selapanan', label: 'Selapanan', icon: 'Calendar' },
  { id: 'ronda', label: 'Ronda', icon: 'Shield' },
  { id: 'iuran', label: 'Iuran', icon: 'Wallet' },
  { id: 'profil', label: 'Profil', icon: 'User' },
] as const;

export const PENGURUS_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'verifikasi', label: 'Verifikasi Warga', icon: 'UserCheck' },
  { id: 'warga', label: 'Data Warga', icon: 'Users' },
  { id: 'ronda-jimpitan', label: 'Ronda & Jimpitan', icon: 'Shield' },
  { id: 'selapanan', label: 'Selapanan', icon: 'Calendar' },
  { id: 'keuangan', label: 'Keuangan', icon: 'Wallet' },
  { id: 'inventaris', label: 'Inventaris', icon: 'Package' },
  { id: 'pengumuman', label: 'Pengumuman', icon: 'Megaphone' },
  { id: 'surat', label: 'Surat Pengantar', icon: 'FileText' },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'Settings' },
  { id: 'akun', label: 'Management Akun', icon: 'UserCog' },
] as const;

// Format helpers
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
