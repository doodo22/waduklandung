'use client';

import { useAuthStore } from '@/stores/auth-store';
import { useNavStore } from '@/stores/nav-store';
import { PENGURUS_NAV_ITEMS, WARGA_NAV_ITEMS } from '@/lib/constants';
import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Header } from '@/components/layout/header';
import { LoginPage } from '@/components/features/login-page';
import { DashboardPage } from '@/components/features/dashboard-page';
import { VerifikasiPage } from '@/components/features/verifikasi-page';
import { WargaPage } from '@/components/features/warga-page';
import { RondaJimpitanPage } from '@/components/features/ronda-jimpitan-page';
import { SelapananPage } from '@/components/features/selapanan-page';
import { KeuanganPage } from '@/components/features/keuangan-page';
import { InventarisPage } from '@/components/features/inventaris-page';
import { PengumumanPage } from '@/components/features/pengumuman-page';
import { SuratPage } from '@/components/features/surat-page';
import { PengaturanPage } from '@/components/features/pengaturan-page';
import { AkunPage } from '@/components/features/akun-page';
import { BerandaPage } from '@/components/features/beranda-page';
import { RondaPage } from '@/components/features/mobile/ronda-page';
import { IuranPage } from '@/components/features/mobile/iuran-page';
import { SelapananPage as SelapananWargaPage } from '@/components/features/mobile/selapanan-page';
import { ProfilPage } from '@/components/features/profil-page';
import { useEffect, Suspense } from 'react';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Memuat...</p>
      </div>
    </div>
  );
}

interface PageProps {
  userId: string;
  familyId: string | null;
  isAdmin: boolean;
}

const adminPageComponents: Record<string, React.ComponentType<PageProps>> = {
  dashboard: DashboardPage,
  verifikasi: VerifikasiPage,
  warga: WargaPage,
  'ronda-jimpitan': RondaJimpitanPage,
  selapanan: SelapananPage,
  keuangan: KeuanganPage,
  inventaris: InventarisPage,
  pengumuman: PengumumanPage,
  surat: SuratPage,
  pengaturan: PengaturanPage,
  akun: AkunPage,
};

const wargaPageComponents: Record<string, React.ComponentType<PageProps>> = {
  beranda: BerandaPage,
  ronda: RondaPage,
  iuran: IuranPage,
  selapanan: SelapananWargaPage,
  profil: ProfilPage,
};

function AppContent() {
  const { user, isAdmin, isLoading, hydrate } = useAuthStore();
  const { currentPage, setPage } = useNavStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Set default page based on role
  useEffect(() => {
    if (user && !isLoading) {
      if (isAdmin && currentPage === 'dashboard') return;
      if (!isAdmin && currentPage === 'beranda') return;
      if (isAdmin && (currentPage === 'beranda' || currentPage === 'profil' || currentPage === 'ronda' || currentPage === 'iuran')) {
        setPage('dashboard');
      }
      if (!isAdmin && (currentPage === 'dashboard' || currentPage === 'verifikasi' || currentPage === 'warga' || currentPage === 'ronda-jimpitan' || currentPage === 'keuangan' || currentPage === 'inventaris' || currentPage === 'pengumuman' || currentPage === 'surat' || currentPage === 'pengaturan' || currentPage === 'akun')) {
        setPage('beranda');
      }
    }
  }, [user, isAdmin, isLoading, currentPage, setPage]);

  if (isLoading) return <LoadingScreen />;
  if (!user) return <LoginPage />;

  const pageComponents = isAdmin ? adminPageComponents : wargaPageComponents;
  const PageComponent = pageComponents[currentPage];

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex">
          <Sidebar
            items={PENGURUS_NAV_ITEMS}
            currentPage={currentPage}
            onNavigate={setPage}
            userName={user.name}
            userRole={user.role}
          />
          <div className="flex-1 lg:ml-64">
            <Header
              title={PENGURUS_NAV_ITEMS.find(i => i.id === currentPage)?.label || 'Dashboard'}
              userName={user.name}
              userRole={user.role}
            />
            <main className="p-6">
              {PageComponent ? (
                <PageComponent userId={user.id} familyId={user.familyId} isAdmin={isAdmin} />
              ) : (
                <div className="text-center text-slate-500 py-12">Halaman tidak ditemukan</div>
              )}
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Warga layout - mobile-first with bottom nav
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/80 to-orange-50/30 flex flex-col">
      <Header
        title={WARGA_NAV_ITEMS.find(i => i.id === currentPage)?.label || 'Beranda'}
        userName={user.name}
        userRole={user.role}
        compact
        isWarga
      />
      <main className="flex-1 p-4 pb-20">
        {PageComponent ? (
          <PageComponent userId={user.id} familyId={user.familyId} isAdmin={isAdmin} />
        ) : (
          <div className="text-center text-slate-500 py-12">Halaman tidak ditemukan</div>
        )}
      </main>
      <BottomNav
        items={WARGA_NAV_ITEMS}
        currentPage={currentPage}
        onNavigate={setPage}
      />
    </div>
  );
}

export default function AppShell() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AppContent />
    </Suspense>
  );
}
