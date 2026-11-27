import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { Activity, FileText, Flag, LayoutDashboard, LogOut, Mic, Settings, ShieldCheck, Users, UserCog } from 'lucide-react';
import Logo from '../../components/Logo';
import { Button, Field, cx } from '../../components/ui';
import { adminApi } from '../../lib/adminApi';
import { errMsg } from '../../lib/api';
import { useAdminStore } from '../../store/adminStore';
import { useCan } from './AdminUI';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminCalls from './AdminCalls';
import AdminReports from './AdminReports';
import AdminContent from './AdminContent';
import AdminSettings from './AdminSettings';
import AdminAdmins from './AdminAdmins';

const NAV = [
  ['/admin', 'Dashboard', LayoutDashboard, 'dashboard.view', true],
  ['/admin/users', 'Users', Users, 'users.view'],
  ['/admin/calls', 'Audio calls', Activity, 'calls.view'],
  ['/admin/reports', 'Moderation', Flag, 'reports.manage'],
  ['/admin/content', 'Content', FileText, 'content.manage'],
  ['/admin/settings', 'Settings', Settings, 'settings.manage'],
  ['/admin/admins', 'Admins', UserCog, 'admins.manage'],
];

function AdminLogin() {
  const setSession = useAdminStore((s) => s.setSession);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await adminApi.post('/auth/login', form);
      setSession(data);
    } catch (err) {
      setError(errMsg(err, 'Could not sign in'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-secondary via-secondary to-ink p-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-4xl bg-white p-7 shadow-2xl">
        <Logo />
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-secondary">
            <ShieldCheck className="h-6 w-6" /> Admin sign in
          </h1>
          <p className="muted mt-1">Authorised staff only. Activity is logged.</p>
        </div>
        <Field label="Email">
          <input className="input" type="email" required autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <input className="input" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
        <Button type="submit" loading={busy} className="btn-primary w-full">
          Sign in
        </Button>
      </form>
    </div>
  );
}

function AdminLayout() {
  const token = useAdminStore((s) => s.token);
  const admin = useAdminStore((s) => s.admin);
  const setAdmin = useAdminStore((s) => s.setAdmin);
  const logout = useAdminStore((s) => s.logout);
  const can = useCan();

  useEffect(() => {
    if (token && !admin) {
      adminApi
        .get('/auth/me')
        .then((r) => setAdmin(r.data.admin))
        .catch(() => logout());
    }
  }, [token, admin, setAdmin, logout]);

  if (!token) return <Navigate to="/admin/login" replace />;
  if (!admin) return <div className="p-10 text-center text-secondary">Loading...</div>;

  const items = NAV.filter(([, , , perm]) => can(perm));
  return (
    <div className="min-h-dvh bg-light lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-secondary p-5 text-white lg:flex">
        <Logo className="[&_span]:!text-white" />
        <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-primary">Admin console</p>
        <nav className="mt-8 flex-1 space-y-1">
          {items.map(([to, label, Icon, , end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition', isActive ? 'bg-primary text-secondary' : 'text-white/75 hover:bg-white/10')}>
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-2xl bg-white/10 p-3 text-xs">
          <p className="font-extrabold">{admin.name}</p>
          <p className="capitalize text-white/60">{admin.role.replace('_', ' ')}</p>
          <button onClick={logout} className="mt-2 flex items-center gap-1.5 font-bold text-primary">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-secondary/10 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <Mic className="h-5 w-5 text-secondary" />
          <b className="flex-1 text-secondary">Admin</b>
          <button onClick={logout} className="text-sm font-bold text-secondary">
            Sign out
          </button>
        </header>
        <nav className="scroll-hide flex gap-2 overflow-x-auto bg-white px-4 py-2 lg:hidden">
          {items.map(([to, label, , , end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('chip shrink-0', isActive && 'chip-active')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const token = useAdminStore((s) => s.token);
  return (
    <Routes>
      <Route path="login" element={token ? <Navigate to="/admin" replace /> : <AdminLogin />} />
      <Route element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="calls" element={<AdminCalls />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="content" element={<AdminContent />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="admins" element={<AdminAdmins />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
