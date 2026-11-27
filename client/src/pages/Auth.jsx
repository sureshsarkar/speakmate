import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, User, XCircle } from 'lucide-react';
import Logo from '../components/Logo';
import { GoogleButton } from '../components/Shared';
import { Button, Field, FullSpinner, Spinner } from '../components/ui';
import { api, errCode, errMsg } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-primary/25 via-light to-light pt-safe">
      <div className="mx-auto w-full max-w-md px-5 pb-10 pt-8 animate-page-in">
        <Link to="/" className="mb-8 inline-block">
          <Logo />
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-secondary">{title}</h1>
        {subtitle && <p className="muted mt-1.5">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-ink/60">{footer}</div>}
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder = 'Password', autoComplete, ...p }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink/35" />
      <input
        {...p}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="input pl-11 pr-12"
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ink/45" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

const IconInput = ({ icon: Icon, ...p }) => (
  <div className="relative">
    <Icon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink/35" />
    <input {...p} className="input pl-11" />
  </div>
);

const goAfterAuth = (user, from) => (user.onboardingCompleted ? from || '/home' : '/onboarding');

function useGoogle(navigate, from) {
  const setSession = useAuthStore((s) => s.setSession);
  const toast = useAppStore((s) => s.toast);
  return async (credential) => {
    try {
      const { data } = await api.post('/auth/google', { credential, remember: true });
      setSession(data, true);
      navigate(goAfterAuth(data.user, from), { replace: true });
    } catch (e) {
      toast(errMsg(e, 'Google sign-in failed'), 'error');
    }
  };
}

export function Login() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const from = state?.from;
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const onGoogle = useGoogle(navigate, from);
  const guestEnabled = useAppStore((s) => s.config?.guestEnabled);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { ...form, remember });
      setSession(data, remember);
      navigate(goAfterAuth(data.user, from), { replace: true });
    } catch (err) {
      setError(errCode(err) === 'EMAIL_NOT_VERIFIED' ? errMsg(err) : errMsg(err, 'Could not sign in'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue your speaking streak."
      footer={
        <>
          New to SpeakMate?{' '}
          <Link to="/register" className="font-bold text-secondary">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <IconInput icon={Mail} type="email" required autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <PasswordInput required autoComplete="current-password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        </Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-[18px] w-[18px] accent-[rgb(var(--c-secondary))]" />
            Remember me
          </label>
          <Link to="/forgot-password" className="font-bold text-secondary">
            Forgot password?
          </Link>
        </div>
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
        <Button type="submit" loading={busy} className="btn-primary w-full">
          Sign in
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs font-semibold text-ink/40">
        <span className="h-px flex-1 bg-ink/10" /> OR <span className="h-px flex-1 bg-ink/10" />
      </div>
      <div className="space-y-3">
        <GoogleButton onCredential={onGoogle} text="signin_with" />
        {guestEnabled !== false && (
          <Link to="/guest" className="btn-ghost w-full">
            Continue as guest
          </Link>
        )}
      </div>
    </AuthLayout>
  );
}

const rules = [
  ['At least 8 characters', (p) => p.length >= 8],
  ['A letter', (p) => /[A-Za-z]/.test(p)],
  ['A number', (p) => /\d/.test(p)],
];

export function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const onGoogle = useGoogle(navigate);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register', form);
      setSession(data, true);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(errMsg(err, 'Could not create your account'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="No phone number needed. Just your name, email and a password."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-secondary">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Display name" hint="This is the only name your partners will see.">
          <IconInput icon={User} required minLength={2} maxLength={40} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
        </Field>
        <Field label="Email" hint="Never shown to other users.">
          <IconInput icon={Mail} type="email" required autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <PasswordInput required autoComplete="new-password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="Create a password" />
        </Field>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
          {rules.map(([label, test]) => (
            <li key={label} className={`flex items-center gap-1 ${test(form.password) ? 'text-secondary' : 'text-ink/40'}`}>
              {test(form.password) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {label}
            </li>
          ))}
        </ul>
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
        <Button type="submit" loading={busy} className="btn-primary w-full">
          Create account
        </Button>
        <p className="text-center text-xs text-ink/50">
          By signing up you agree to our{' '}
          <Link to="/guidelines" className="font-bold underline">
            Community Guidelines
          </Link>
          .
        </p>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs font-semibold text-ink/40">
        <span className="h-px flex-1 bg-ink/10" /> OR <span className="h-px flex-1 bg-ink/10" />
      </div>
      <GoogleButton onCredential={onGoogle} text="signup_with" />
    </AuthLayout>
  );
}

export function GuestAccess() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const guestEnabled = useAppStore((s) => s.config?.guestEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/auth/guest');
      setSession(data, true);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Try as a guest"
      subtitle="Start speaking right away. No sign-up needed."
      footer={
        <>
          Want to save your progress?{' '}
          <Link to="/register" className="font-bold text-secondary">
            Create an account
          </Link>
        </>
      }
    >
      <div className="card space-y-3">
        {[
          ['A secure temporary guest ID is created for this session.', ShieldCheck],
          ['Guests have a shorter daily practice limit.', CheckCircle2],
          ['Favorites, practice requests and notifications need a free account.', CheckCircle2],
        ].map(([t, Icon]) => (
          <p key={t} className="flex items-start gap-2.5 text-sm">
            <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-secondary" /> {t}
          </p>
        ))}
      </div>
      {guestEnabled === false && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Guest access is currently turned off. Please create an account.</p>}
      {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <Button loading={busy} disabled={guestEnabled === false} onClick={start} className="btn-primary mt-5 w-full">
        Continue as guest
      </Button>
      <Link to="/login" className="btn-ghost mt-3 w-full">
        I already have an account
      </Link>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link to="/login" className="font-bold text-secondary">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="card flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-secondary" />
          <p className="text-sm">If <b>{email}</b> is registered, a reset link is on its way. It is valid for 1 hour.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <IconInput icon={Mail} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          <Button type="submit" loading={busy} className="btn-primary w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const toast = useAppStore((s) => s.toast);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      toast('Password updated. Please sign in.', 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (!token) return <Navigate to="/forgot-password" replace />;
  return (
    <AuthLayout title="Choose a new password" subtitle="Use at least 8 characters with a letter and a number.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">
          <PasswordInput required autoComplete="new-password" value={password} onChange={setPassword} placeholder="New password" />
        </Field>
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <Button type="submit" loading={busy} className="btn-primary w-full">
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const refresh = useAuthStore((s) => s.refresh);
  const loggedIn = useAuthStore((s) => Boolean(s.token));
  const [state, setState] = useState({ status: 'loading', message: '' });

  useEffect(() => {
    if (!token) return setState({ status: 'error', message: 'This verification link is incomplete.' });
    api
      .post('/auth/verify-email', { token })
      .then((r) => {
        setState({ status: 'ok', message: r.data.message });
        if (loggedIn) refresh();
      })
      .catch((e) => setState({ status: 'error', message: errMsg(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthLayout title="Email verification">
      {state.status === 'loading' ? (
        <FullSpinner label="Verifying..." />
      ) : (
        <div className="card flex flex-col items-center gap-3 py-8 text-center">
          {state.status === 'ok' ? <CheckCircle2 className="h-12 w-12 text-secondary" /> : <XCircle className="h-12 w-12 text-red-500" />}
          <p className="font-bold">{state.message}</p>
          <Link to={loggedIn ? '/home' : '/login'} className="btn-primary mt-2">
            {loggedIn ? 'Go to SpeakMate' : 'Sign in'}
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}

export { Spinner };
