export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(seconds) {
  const s = Math.round(seconds || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

export const formatMinutes = (min) => {
  const n = Number(min) || 0;
  return n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
};

export function timeAgo(date) {
  if (!date) return '';
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const formatDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export const initials = (name = '?') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

export const hexToRgbTriplet = (hex) => {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
};

export const weekday = (day) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
export const shortDay = (day) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const monthName = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
