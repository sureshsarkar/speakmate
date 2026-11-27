import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CloudOff } from 'lucide-react';
import AppShell from './components/AppShell';
import { CallManager, ConnectionBanner, IncomingCallSheet, MaintenanceScreen, ToastHost } from './components/Overlays';
import { ErrorBoundary, FullSpinner } from './components/ui';
import { api } from './lib/api';
import { useAppStore } from './store/appStore';
import { useAuthStore } from './store/authStore';
import Landing from './pages/Landing';
import { ForgotPassword, GuestAccess, Login, Register, ResetPassword, VerifyEmail } from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import { PartnerFound, Practice, Searching } from './pages/Practice';
import CallScreen from './pages/CallScreen';
import CallEnded from './pages/CallEnded';
import History from './pages/History';
import Favorites from './pages/Favorites';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import { Guidelines, Help } from './pages/Help';

const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

function RequireAuth({ children, onboarded = true }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const { pathname } = useLocation();
  if (!ready) return <FullSpinner />;
  if (!token) return <Navigate to="/login" state={{ from: pathname }} replace />;
  if (!user) return <FullSpinner />;
  if (onboarded && !user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return children;
}

function PublicOnly({ children }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  if (token) return <Navigate to={user && !user.onboardingCompleted ? '/onboarding' : '/home'} replace />;
  return children;
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="h1">Page not found</h1>
      <Link to="/" className="btn-primary mt-2">
        Back to SpeakMate
      </Link>
    </div>
  );
}

function Unreachable() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <CloudOff className="h-12 w-12 text-secondary" />
      <h1 className="h1">Cannot reach SpeakMate</h1>
      <p className="muted max-w-xs">Check your internet connection. If you are running the app locally, make sure the server is started.</p>
      <button className="btn-primary" onClick={() => useAppStore.getState().loadConfig()}>
        Retry
      </button>
    </div>
  );
}

function Shell() {
  const config = useAppStore((s) => s.config);
  const configError = useAppStore((s) => s.configError);
  const maintenance = useAppStore((s) => s.maintenance);
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const { pathname } = useLocation();

  useEffect(() => {
    useAppStore.getState().loadConfig();
    useAuthStore.getState().init();
  }, []);

  // Remove the HTML splash once we know the session state
  useEffect(() => {
    if (ready && (config || configError)) {
      const el = document.getElementById('splash');
      if (el) {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 350);
      }
    }
  }, [ready, config, configError]);

  // Unread notification badge
  useEffect(() => {
    if (user?.kind === 'user') {
      api
        .get('/notifications')
        .then((r) => useAppStore.getState().setUnread(r.data.unread))
        .catch(() => {});
    }
  }, [user?.publicId, user?.kind]);

  if (!config && configError) return <Unreachable />;
  if (!config) return null;
  if (maintenance.enabled && !pathname.startsWith('/admin')) return <MaintenanceScreen message={maintenance.message} />;

  return (
    <>
      <CallManager />
      <ConnectionBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<Register />} />
        <Route path="/guest" element={<PublicOnly><GuestAccess /></PublicOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/help" element={<Help />} />
        <Route path="/guidelines" element={<Guidelines />} />

        <Route path="/onboarding" element={<RequireAuth onboarded={false}><Onboarding /></RequireAuth>} />

        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/home" element={<Home />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/history" element={<History />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>

        {/* Full-screen call flow */}
        <Route path="/practice/searching" element={<RequireAuth><Searching /></RequireAuth>} />
        <Route path="/practice/found" element={<RequireAuth><PartnerFound /></RequireAuth>} />
        <Route path="/practice/call" element={<RequireAuth><CallScreen /></RequireAuth>} />
        <Route path="/practice/ended" element={<RequireAuth><CallEnded /></RequireAuth>} />

        <Route path="/admin/*" element={<Suspense fallback={<FullSpinner />}><AdminApp /></Suspense>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <IncomingCallSheet />
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
