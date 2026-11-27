import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info, Phone, PhoneOff, WifiOff, Wrench, X } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { engine } from '../lib/callEngine';
import { CALL_PATHS } from '../lib/constants';
import Avatar from './Avatar';
import { LevelBadge, cx } from './ui';
import { LogoMark } from './Logo';

export function ToastHost() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)]">
      {toasts.map((t) => {
        const Icon = t.type === 'error' ? AlertTriangle : t.type === 'success' ? CheckCircle2 : Info;
        return (
          <div
            key={t.id}
            role="status"
            className={cx(
              'pointer-events-auto flex w-full max-w-sm animate-page-in items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl',
              t.type === 'error' ? 'bg-red-600 text-white' : t.type === 'success' ? 'bg-secondary text-white' : 'bg-ink text-white'
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ConnectionBanner() {
  const state = useAppStore((s) => s.socketState);
  const token = useAuthStore((s) => s.token);
  if (!token || state !== 'reconnecting') return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 pt-[max(env(safe-area-inset-top),6px)] text-xs font-bold text-ink">
      <WifiOff className="h-3.5 w-3.5" /> Reconnecting to SpeakMate...
    </div>
  );
}

/** Keeps the URL in step with the call phase (search -> found -> call -> ended). */
export function CallManager() {
  const phase = useCallStore((s) => s.phase);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const target = CALL_PATHS[phase];
    if (target) {
      if (pathname !== target) navigate(target, { replace: true });
    } else if (phase === 'idle' && pathname.startsWith('/practice/') && pathname !== '/practice/ended') {
      navigate('/practice', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Block navigation away from live-call screens through the URL bar/back button
  useEffect(() => {
    const target = CALL_PATHS[phase];
    if (target && pathname !== target && ['found', 'connecting', 'in_call', 'searching', 'requesting_mic', 'inviting'].includes(phase)) {
      navigate(target, { replace: true });
    }
  }, [pathname, phase, navigate]);

  return null;
}

/** Ringing screen for a direct call from a connection. */
export function IncomingCallSheet() {
  const incoming = useCallStore((s) => s.incoming);
  const phase = useCallStore((s) => s.phase);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!incoming) return undefined;
    const tick = () => setLeft(Math.max(0, Math.ceil((incoming.expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [incoming]);

  if (!incoming || phase !== 'idle') return null;
  const { from } = incoming;
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/60 p-4 backdrop-blur-sm sm:items-center" role="alertdialog" aria-label="Incoming call">
      <div className="w-full max-w-sm animate-sheet-in rounded-4xl bg-secondary p-6 text-center text-white shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Incoming audio call</p>
        <div className="my-5 flex justify-center">
          <div className="relative">
            <span className="absolute inset-0 animate-ripple rounded-full bg-primary/50" />
            <Avatar src={from.avatarUrl} name={from.displayName} size={96} />
          </div>
        </div>
        <p className="text-2xl font-extrabold">{from.displayName}</p>
        <div className="mt-2 flex justify-center">
          <LevelBadge level={from.englishLevel} />
        </div>
        <p className="mt-3 text-sm text-white/60">Ringing... {left}s</p>
        <div className="mt-6 flex justify-center gap-10">
          <button onClick={() => engine.declineDirect()} className="flex flex-col items-center gap-2 text-sm font-bold" aria-label="Decline call">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg">
              <PhoneOff className="h-7 w-7" />
            </span>
            Decline
          </button>
          <button onClick={() => engine.acceptDirect()} className="flex flex-col items-center gap-2 text-sm font-bold" aria-label="Accept call">
            <span className="flex h-16 w-16 animate-pulse-soft items-center justify-center rounded-full bg-primary text-secondary shadow-glow">
              <Phone className="h-7 w-7" />
            </span>
            Answer
          </button>
        </div>
      </div>
    </div>
  );
}

export function MaintenanceScreen({ message }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-light p-8 text-center">
      <LogoMark size={64} />
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <Wrench className="h-7 w-7" />
      </div>
      <h1 className="h1">We'll be right back</h1>
      <p className="muted max-w-xs">{message || 'SpeakMate is under maintenance. Please check back soon.'}</p>
      <button className="btn-soft" onClick={() => window.location.reload()}>
        Try again
      </button>
    </div>
  );
}
