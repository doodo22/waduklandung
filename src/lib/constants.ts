// ============================================
// APPLICATION CONSTANTS
// ============================================

export const APP_NAME = 'Waduk Landung';
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
  TRANSFER: 'TRANSFER',
} as const;

export const TRANSACTION_CATEGORY = {
  // Income categories
  IURAN_BULANAN: 'IURAN_BULANAN',
  IURAN_RONDA: 'IURAN_RONDA',
  DENDA: 'DENDA',
  JIMPITAN: 'JIMPITAN',
  DONASI: 'DONASI',
  BUNGA_BANK: 'BUNGA_BANK',
  LAIN_LAIN: 'LAIN_LAIN',
  // Expense categories
  PEMBELIAN: 'PEMBELIAN',
  PEMBANGUNAN: 'PEMBANGUNAN',
  OPERASIONAL: 'OPERASIONAL',
  BANTUAN: 'BANTUAN',
  // Transfer categories
  SETOR_BANK: 'SETOR_BANK',
  TARIK_BANK: 'TARIK_BANK',
} as const;

export const INCOME_CATEGORIES = ['IURAN_BULANAN', 'IURAN_RONDA', 'DENDA', 'JIMPITAN', 'DONASI', 'BUNGA_BANK', 'LAIN_LAIN'] as const;
export const EXPENSE_CATEGORIES = ['PEMBELIAN', 'PEMBANGUNAN', 'OPERASIONAL', 'BANTUAN', 'LAIN_LAIN'] as const;
export const TRANSFER_CATEGORIES = ['SETOR_BANK', 'TARIK_BANK'] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  // Income
  IURAN_BULANAN: 'Iuran Bulanan',
  IURAN_RONDA: 'Iuran Ronda',
  DENDA: 'Denda',
  JIMPITAN: 'Jimpitan',
  DONASI: 'Donasi',
  BUNGA_BANK: 'Bunga Bank',
  LAIN_LAIN: 'Lain-lain',
  // Expense
  PEMBELIAN: 'Pembelian',
  PEMBANGUNAN: 'Pembangunan',
  OPERASIONAL: 'Operasional',
  BANTUAN: 'Bantuan Warga',
  // Transfer
  SETOR_BANK: 'Setor ke Bank',
  TARIK_BANK: 'Tarik dari Bank',
};

// Account types for dual-account system
export const ACCOUNT_TYPE = {
  CASH: 'CASH',
  BANK_BKK: 'BANK_BKK',
} as const;

export const ACCOUNT_LABELS: Record<string, string> = {
  CASH: 'Kas Tunai',
  BANK_BKK: 'Tabungan BKK',
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

// Family Member — Gender
export const GENDER_OPTIONS = [
  { value: 'LAKI_LAKI', label: 'Laki-laki' },
  { value: 'PEREMPUAN', label: 'Perempuan' },
] as const;

// Family Member — Hubungan dalam Keluarga
export const RELATIONSHIP_OPTIONS = [
  { value: 'KEPALA_KELUARGA', label: 'Kepala Keluarga' },
  { value: 'SUAMI', label: 'Suami' },
  { value: 'ISTRI', label: 'Istri' },
  { value: 'ANAK', label: 'Anak' },
  { value: 'MENANTU', label: 'Menantu' },
  { value: 'CUCU', label: 'Cucu' },
  { value: 'ORANG_TUA', label: 'Orang Tua' },
  { value: 'MERTUA', label: 'Mertua' },
  { value: 'FAMILI_LAIN', label: 'Famili Lain' },
  { value: 'PEMBANTU', label: 'Pembantu' },
  { value: 'LAINNYA', label: 'Lainnya' },
] as const;

export const RELATIONSHIP_LABELS: Record<string, string> = {
  ...Object.fromEntries(RELATIONSHIP_OPTIONS.map(o => [o.value, o.label])),
  // Legacy compatibility
  SUAMI_ISTRI: 'Suami/Istri',
};

// Family Member — Status Perkawinan
export const MARITAL_STATUS_OPTIONS = [
  { value: 'BELUM_KAWIN', label: 'Belum Kawin' },
  { value: 'KAWIN', label: 'Kawin' },
  { value: 'CERAI_HIDUP', label: 'Cerai Hidup' },
  { value: 'CERAI_MATI', label: 'Cerai Mati' },
] as const;

export const MARITAL_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  MARITAL_STATUS_OPTIONS.map(o => [o.value, o.label])
);

// Family Member — Pendidikan Terakhir
export const EDUCATION_OPTIONS = [
  { value: 'TIDAK_SEKOLAH', label: 'Tidak Sekolah' },
  { value: 'SD', label: 'SD' },
  { value: 'SMP', label: 'SMP' },
  { value: 'SMA', label: 'SMA/SMK' },
  { value: 'D1', label: 'D1' },
  { value: 'D2', label: 'D2' },
  { value: 'D3', label: 'D3' },
  { value: 'S1', label: 'S1/D4' },
  { value: 'S2', label: 'S2' },
  { value: 'S3', label: 'S3' },
] as const;

export const EDUCATION_LABELS: Record<string, string> = Object.fromEntries(
  EDUCATION_OPTIONS.map(o => [o.value, o.label])
);

// Family Member — Kewarganegaraan
export const CITIZENSHIP_OPTIONS = [
  { value: 'WNI', label: 'WNI' },
  { value: 'WNA', label: 'WNA' },
] as const;

// Family — Jimpitan Type
export const JIMPITAN_TYPE_OPTIONS = [
  { value: 'HARIAN', label: 'Harian (Rp.1.000/malam)' },
  { value: 'BULANAN', label: 'Bulanan (custom)' },
] as const;

export const JIMPITAN_TYPE_LABELS: Record<string, string> = {
  HARIAN: 'Harian',
  BULANAN: 'Bulanan',
};

// Family — Ronda Status
export const RONDA_FAMILY_STATUS_OPTIONS = [
  { value: 'AKTIF', label: 'Aktif Ronda' },
  { value: 'KASEPUHAN', label: 'Kasepuhan (Dispensasi)' },
  { value: 'BAYAR_IURAN', label: 'Bayar Iuran Ronda' },
] as const;

export const RONDA_FAMILY_STATUS_LABELS: Record<string, string> = {
  AKTIF: 'Aktif Ronda',
  KASEPUHAN: 'Kasepuhan',
  BAYAR_IURAN: 'Bayar Iuran',
};

// CustomLevyItem — Status
export const LEVY_ITEM_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  COMPLETED: 'Lunas',
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
    month: 'long',
    year: 'numeric',
  }).format(date);
}
