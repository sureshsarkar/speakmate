import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MicOff, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg } from '../lib/api';
import { REPORT_REASONS } from '../lib/constants';
import { useAppStore } from '../store/appStore';
import { useCallStore } from '../store/callStore';
import { Button, Sheet, cx } from './ui';

export function PageHeader({ title, back, right, subtitle }) {
  const navigate = useNavigate();
  return (
    <header className="mb-5 flex items-center gap-3">
      {back && (
        <button
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-secondary" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="h1 truncate">{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

/** Shows microphone problems (permission denied, no device...) with how to fix them. */
export function MicErrorCard({ onRetry }) {
  const error = useCallStore((s) => s.error);
  if (!error || !error.code?.startsWith('MIC_')) return null;
  return (
    <div className="animate-shake rounded-3xl border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
      <div className="mb-1.5 flex items-center gap-2 font-extrabold">
        <MicOff className="h-5 w-5" /> Microphone problem
      </div>
      <p className="text-sm">{error.message}</p>
      {error.code === 'MIC_DENIED' && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-red-800/90">
          <li>Chrome / Edge: click the lock icon next to the address, set Microphone to Allow.</li>
          <li>Safari: Settings for this website, Microphone, Allow.</li>
          <li>Installed app on Android: Settings, Apps, SpeakMate, Permissions, Microphone.</li>
        </ul>
      )}
      {onRetry && (
        <button className="btn-sm mt-3 inline-flex rounded-xl bg-red-600 px-4 py-2 font-bold text-white" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

let gsiPromise;
const loadGsi = () => {
  gsiPromise ||= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Google script failed to load'));
    document.head.appendChild(s);
  });
  return gsiPromise;
};

/** Renders Google's own button, only when GOOGLE_CLIENT_ID is configured on the server. */
export function GoogleButton({ onCredential, text = 'continue_with' }) {
  const clientId = useAppStore((s) => s.config?.googleClientId);
  const ref = useRef(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !ref.current) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          width: Math.min(340, ref.current.offsetWidth || 320),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (!clientId) return null;
  return <div ref={ref} className="flex min-h-[44px] justify-center" />;
}

/** Report (and optionally block) the person you just spoke with. */
export function ReportSheet({ open, onClose, partner, callKey, onBlocked }) {
  const toast = useAppStore((s) => s.toast);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setDetails('');
      setAlsoBlock(true);
    }
  }, [open]);

  const submit = async () => {
    if (!reason) return toast('Please choose a reason.', 'error');
    setBusy(true);
    try {
      await api.post('/reports', { reportedPublicId: partner.publicId, callKey, reason, details: details || undefined });
      if (alsoBlock) {
        await api.post('/blocks', { publicId: partner.publicId });
        onBlocked?.();
      }
      toast('Report sent. Thank you for keeping SpeakMate safe.', 'success');
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Report ${partner?.displayName || 'user'}`}>
      <div className="space-y-2">
        {REPORT_REASONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setReason(r.value)}
            className={cx('flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition', reason === r.value ? 'border-primary bg-primary/20' : 'border-secondary/10 bg-white')}
          >
            <span className={cx('h-4 w-4 rounded-full border-2', reason === r.value ? 'border-secondary bg-secondary' : 'border-ink/30')} />
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Add details (optional)"
        className="input mt-3 resize-none"
      />
      <label className="mt-3 flex items-center gap-2.5 text-sm font-semibold">
        <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--c-secondary))]" />
        Also block this user so we never match you again
      </label>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-ink/50">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Calls are never recorded. Reports include only the details above and call metadata.
      </p>
      <Button className="btn-danger mt-4 w-full" loading={busy} onClick={submit}>
        Send report
      </Button>
    </Sheet>
  );
}
