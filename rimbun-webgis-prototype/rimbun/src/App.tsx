import { useEffect, type ReactNode } from 'react';
import { RouterProvider, to, useRouter } from './router/router';
import { AppStoreProvider, useStore } from './store/AppStore';
import { DonationModal } from './components/donation/DonationModal';
import { ToastHost } from './components/ui/Feedback';
import { HomePage } from './pages/HomePage';
import { ExploreMapPage } from './pages/ExploreMapPage';
import { ProgramsPage } from './pages/ProgramsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { CalculatorPage } from './pages/CalculatorPage';
import { TransparencyPage } from './pages/TransparencyPage';
import { AboutPage } from './pages/AboutPage';
import { LoginPage, RegisterPage, ForgotPasswordPage } from './pages/AuthPages';
import { DonationSuccessPage } from './pages/DonationSuccessPage';
import { NotFoundPage } from './pages/NotFoundPage';
import {
  DashboardHistoryPage,
  DashboardImpactPage,
  DashboardOverviewPage,
  DashboardProfilePage,
  DashboardSavedPage,
} from './pages/dashboard/DashboardPages';
import { AdminWorkspacePage } from './pages/admin/AdminWorkspacePage';
import { SITE } from './config/site';

const TITLES: Record<string, string> = {
  home: SITE.tagline,
  explore: 'Explore Map',
  programs: 'Program restorasi',
  program: 'Detail program',
  calculator: 'Kalkulator dampak',
  transparency: 'Transparansi',
  about: 'Tentang',
  login: 'Masuk',
  register: 'Daftar',
  'forgot-password': 'Lupa kata sandi',
  'donation-success': 'Bukti kontribusi',
  admin: 'Panel Kurasi Admin',
  'admin-map': 'Peta Kurasi Admin',
};

/** Redirects guests to login and remembers where they wanted to go. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore();
  const { navigate, route } = useRouter();
  useEffect(() => {
    if (!state.user) {
      dispatch({ type: 'setIntent', intent: { kind: 'dashboard', return_to: route.path } });
      dispatch({ type: 'toast', text: 'Masuk dulu untuk membuka dashboard.', tone: 'info' });
      navigate(to.login(), { replace: true });
    }
  }, [state.user, dispatch, navigate, route.path]);
  return state.user ? <>{children}</> : null;
}

/** Logged-in users don't need the auth screens. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const { navigate } = useRouter();
  // Only checked on arrival — a login that happens on this screen handles its own redirect.
  useEffect(() => {
    if (state.user) navigate(state.user.role === 'admin' ? to.admin() : to.dashboard(), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function Routes() {
  const { route } = useRouter();
  useEffect(() => {
    const t = TITLES[route.name] ?? (route.name.startsWith('dashboard') ? 'Dashboard' : 'Halaman tidak ditemukan');
    document.title = route.name === 'home' ? `${SITE.name} — ${t}` : `${t} · ${SITE.name}`;
  }, [route.name]);

  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'explore':
      return <ExploreMapPage />;
    case 'programs':
      return <ProgramsPage />;
    case 'program':
      return <ProjectDetailPage />;
    case 'calculator':
      return <CalculatorPage />;
    case 'transparency':
      return <TransparencyPage />;
    case 'about':
      return <AboutPage />;
    case 'login':
      return (
        <GuestOnly>
          <LoginPage />
        </GuestOnly>
      );
    case 'register':
      return (
        <GuestOnly>
          <RegisterPage />
        </GuestOnly>
      );
    case 'forgot-password':
      return <ForgotPasswordPage />;
    case 'donation-success':
      return (
        <RequireAuth>
          <DonationSuccessPage />
        </RequireAuth>
      );
    case 'dashboard':
      return (
        <RequireAuth>
          <DashboardOverviewPage />
        </RequireAuth>
      );
    case 'dashboard-history':
      return (
        <RequireAuth>
          <DashboardHistoryPage />
        </RequireAuth>
      );
    case 'dashboard-impact':
      return (
        <RequireAuth>
          <DashboardImpactPage />
        </RequireAuth>
      );
    case 'dashboard-saved':
      return (
        <RequireAuth>
          <DashboardSavedPage />
        </RequireAuth>
      );
    case 'dashboard-profile':
      return (
        <RequireAuth>
          <DashboardProfilePage />
        </RequireAuth>
      );
    case 'admin':
    case 'admin-map':
      return (
        <RequireAuth>
          <AdminWorkspacePage />
        </RequireAuth>
      );
    default:
      return <NotFoundPage />;
  }
}

export function App() {
  return (
    <RouterProvider>
      <AppStoreProvider>
        <Routes />
        <DonationModal />
        <ToastHost />
      </AppStoreProvider>
    </RouterProvider>
  );
}
