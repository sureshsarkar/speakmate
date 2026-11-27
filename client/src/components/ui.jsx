import { Component, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Loader2, Star, X } from 'lucide-react';
import { levelLabel, levelShort } from '../lib/constants';

export const cx = (...c) => c.filter(Boolean).join(' ');

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={cx('animate-spin', className)} />;
}

export function FullSpinner({ label }) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-secondary">
      <Spinner className="h-8 w-8" />
      {label && <p className="text-sm text-ink/60">{label}</p>}
    </div>
  );
}

export function Button({ children, loading, className = 'btn-primary', ...p }) {
  return (
    <button {...p} disabled={p.disabled || loading} className={className}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink/50">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span>}
    </label>
  );
}

export function Select({ value, onChange, options, placeholder, className = '', ...p }) {
  return (
    <div className="relative">
      <select {...p} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cx('input appearance-none pr-10', className)}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
    </div>
  );
}

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40',
        checked ? 'bg-primary' : 'bg-ink/20'
      )}
    >
      <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function Badge({ children, tone = 'green', className = '' }) {
  const tones = {
    green: 'bg-primary/25 text-secondary',
    dark: 'bg-secondary text-white',
    gray: 'bg-ink/10 text-ink/70',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-sky-100 text-sky-800',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', tones[tone], className)}>{children}</span>;
}

export const LevelBadge = ({ level, long = true }) => (
  <Badge tone="green">
    <span className="opacity-60">{levelShort(level)}</span> {long && levelLabel(level)}
  </Badge>
);

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-secondary/20 bg-white/60 px-6 py-10 text-center">
      {Icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-secondary">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <p className="font-bold text-secondary">{title}</p>
      {text && <p className="muted max-w-[260px]">{text}</p>}
      {action}
    </div>
  );
}

/** Centered modal on desktop, bottom sheet on phones. */
export function Sheet({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cx(
          'relative z-10 max-h-[90dvh] w-full animate-sheet-in overflow-y-auto rounded-t-4xl bg-white p-5 pb-safe shadow-2xl sm:rounded-4xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15 sm:hidden" />
        {(title || onClose) && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-secondary">{title}</h3>
            <button onClick={onClose} className="rounded-full bg-ink/5 p-2 text-ink/60 hover:bg-ink/10" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmSheet({ open, title, text, confirmLabel = 'Confirm', danger, loading, onConfirm, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="mb-5 text-sm text-ink/70">{text}</p>
      <div className="flex gap-3">
        <button className="btn-ghost flex-1" onClick={onClose}>
          Cancel
        </button>
        <Button className={cx(danger ? 'btn-danger' : 'btn-primary', 'flex-1')} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}

export function StarRating({ value, onChange, size = 'h-9 w-9', readOnly }) {
  return (
    <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className="transition active:scale-90"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star className={cx(size, n <= value ? 'fill-primary text-primary' : 'text-ink/20')} />
        </button>
      ))}
    </div>
  );
}

export function YesNo({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[
        [true, 'Yes'],
        [false, 'No'],
      ].map(([v, l]) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(v)}
          className={cx('chip flex-1 justify-center', value === v && 'chip-active')}
        >
          {value === v && <Check className="h-4 w-4" />} {l}
        </button>
      ))}
    </div>
  );
}

export function ProgressRing({ value, max, size = 92, stroke = 9, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max ? value / max : 0);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-primary) / .2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--c-primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function BarChart({ data, valueKey = 'minutes', labelKey = 'label', height = 140, unit = 'm', highlightLast = true }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => {
        const pct = (d[valueKey] / max) * 100;
        const last = highlightLast && i === data.length - 1;
        return (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] font-bold text-ink/50">{d[valueKey] ? `${d[valueKey]}${unit}` : ''}</span>
            <div
              className={cx('w-full max-w-[34px] rounded-t-xl transition-all duration-700', last ? 'bg-primary' : 'bg-primary/45')}
              style={{ height: `${Math.max(d[valueKey] ? 6 : 3, pct * 0.72)}%`, minHeight: 3 }}
              title={`${d[labelKey]}: ${d[valueKey]}${unit}`}
            />
            <span className={cx('truncate text-[10px] font-semibold', last ? 'text-secondary' : 'text-ink/45')}>{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StatTile({ icon: Icon, label, value, sub, tone = 'bg-primary/20 text-secondary' }) {
  return (
    <div className="card flex flex-col gap-2 !p-3.5">
      <div className={cx('flex h-9 w-9 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div>
        <p className="text-xl font-extrabold leading-none text-secondary">{value}</p>
        <p className="mt-1 text-[11px] font-semibold text-ink/55">{label}</p>
        {sub && <p className="text-[10px] text-ink/40">{sub}</p>}
      </div>
    </div>
  );
}

export const Skeleton = ({ className = 'h-24' }) => <div className={cx('animate-pulse rounded-3xl bg-ink/10', className)} />;

export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('UI crashed', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-xl font-extrabold text-secondary">Something went wrong</p>
        <p className="muted max-w-xs">The app hit an unexpected error. Reloading usually fixes it.</p>
        <button className="btn-primary" onClick={() => window.location.assign('/home')}>
          Reload SpeakMate
        </button>
      </div>
    );
  }
}
