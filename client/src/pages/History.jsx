import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, Flame, Heart, History as HistoryIcon, PhoneCall, Timer } from 'lucide-react';
import Avatar from '../components/Avatar';
import { PageHeader } from '../components/Shared';
import { Badge, BarChart, EmptyState, FullSpinner, Skeleton, Spinner, StatTile, cx } from '../components/ui';
import { useFetch } from '../hooks';
import { api, errMsg } from '../lib/api';
import { formatDate, formatDuration, formatMinutes, monthName, shortDay, weekday } from '../lib/format';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

function ActivityGrid({ days }) {
  const max = Math.max(1, ...days.map((d) => d.minutes));
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const lvl = d.minutes === 0 ? 0 : Math.ceil((d.minutes / max) * 4);
          return (
            <div
              key={d.day}
              title={`${shortDay(d.day)}: ${d.minutes} min`}
              className={cx('aspect-square rounded-lg', ['bg-ink/8', 'bg-primary/30', 'bg-primary/55', 'bg-primary/80', 'bg-primary'][lvl])}
              style={lvl === 0 ? { background: 'rgb(var(--c-text) / .07)' } : undefined}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] font-semibold text-ink/40">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={cx('block h-2.5 w-2.5 rounded-sm', ['', 'bg-primary/30', 'bg-primary/55', 'bg-primary/80', 'bg-primary'][l])} style={l === 0 ? { background: 'rgb(var(--c-text) / .07)' } : undefined} />
        ))}
        More
      </div>
    </div>
  );
}

export default function History() {
  const user = useAuthStore((s) => s.user);
  const toast = useAppStore((s) => s.toast);
  const summary = useFetch(() => api.get('/stats/summary').then((r) => r.data.stats), []);
  const charts = useFetch(() => api.get('/stats/charts').then((r) => r.data), []);
  const favs = useFetch(() => (user.kind === 'user' ? api.get('/favorites').then((r) => r.data.items) : Promise.resolve([])), []);

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get('/stats/history', { params: { page, limit: 10 } })
      .then((r) => {
        if (!alive) return;
        setItems((prev) => (page === 1 ? r.data.items : [...prev, ...r.data.items]));
        setPages(r.data.pages);
      })
      .catch((e) => toast(errMsg(e), 'error'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page, toast]);

  const s = summary.data;
  const c = charts.data;
  const last30 = c ? c.daily.reduce((a, d) => a + d.minutes, 0) : 0;

  return (
    <div className="page space-y-5">
      <PageHeader title="Practice History" subtitle="Your speaking progress" />

      {summary.loading ? (
        <Skeleton className="h-44" />
      ) : s ? (
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={PhoneCall} label="Total audio calls" value={s.totalCalls} tone="bg-sky-100 text-sky-700" />
          <StatTile icon={Clock} label="Total speaking minutes" value={formatMinutes(s.totalMinutes)} />
          <StatTile icon={Timer} label="Average call duration" value={formatDuration(s.avgDurationSec)} tone="bg-violet-100 text-violet-700" />
          <StatTile icon={Flame} label="Daily speaking streak" value={`${s.streak} day${s.streak === 1 ? '' : 's'}`} sub={`Best: ${s.longestStreak}`} tone="bg-orange-100 text-orange-600" />
        </div>
      ) : null}

      <section className="card">
        <h2 className="mb-3 flex items-center gap-2 font-extrabold text-secondary">
          <CalendarDays className="h-5 w-5" /> Weekly speaking
        </h2>
        {charts.loading ? <Skeleton className="h-36" /> : <BarChart data={c.weekly.map((d) => ({ ...d, label: weekday(d.day) }))} />}
      </section>

      <section className="card">
        <h2 className="mb-1 font-extrabold text-secondary">Daily practice activity</h2>
        <p className="mb-3 text-xs text-ink/50">Last 28 days</p>
        {charts.loading ? <Skeleton className="h-28" /> : <ActivityGrid days={c.daily.slice(-28)} />}
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-extrabold text-secondary">Monthly progress</h2>
          {c && <Badge>{formatMinutes(last30)} min / 30 days</Badge>}
        </div>
        {charts.loading ? (
          <Skeleton className="h-36" />
        ) : c.monthly.length ? (
          <BarChart data={c.monthly.map((m) => ({ ...m, label: monthName(m.month) }))} unit="m" />
        ) : (
          <p className="muted py-6 text-center">Your monthly totals will appear after your first call.</p>
        )}
      </section>

      {user.kind === 'user' && (
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-lg font-extrabold text-secondary">
            <Heart className="h-5 w-5" /> Favorite partners
          </h2>
          {favs.loading ? (
            <Skeleton className="h-20" />
          ) : favs.data?.length ? (
            <div className="scroll-hide -mx-4 flex gap-4 overflow-x-auto px-4">
              {favs.data.map((f) => (
                <Link to="/favorites" key={f.publicId} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                  <Avatar src={f.avatarUrl} name={f.displayName} size={56} online={f.status === 'hidden' ? undefined : f.status} />
                  <span className="w-full truncate text-center text-[11px] font-bold">{f.displayName.split(' ')[0]}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">Add people you enjoyed talking to from the call summary screen.</p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2.5 text-lg font-extrabold text-secondary">Recent calls</h2>
        {items.length === 0 && !loading ? (
          <EmptyState icon={HistoryIcon} title="No calls yet" text="Your finished calls will show up here." />
        ) : (
          <div className="space-y-2.5">
            {items.map((r) => (
              <div key={r.id} className="card flex items-center gap-3 !p-3">
                <Avatar src={r.partner.avatarUrl} name={r.partner.displayName} size={46} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.partner.displayName}</p>
                  <p className="truncate text-xs text-ink/50">
                    {r.topic?.title || 'Free talk'} · {formatDate(r.startedAt)}
                  </p>
                  {r.feedback?.rating && <p className="text-xs font-bold text-amber-600">You rated {'★'.repeat(r.feedback.rating)}</p>}
                </div>
                <div className="text-right">
                  <Badge>{formatDuration(r.durationSec)}</Badge>
                  {r.kind === 'direct' && <p className="mt-1 text-[10px] font-semibold text-ink/40">Direct call</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {loading && items.length === 0 && <FullSpinner />}
        {page < pages && (
          <button className="btn-ghost mt-3 w-full" disabled={loading} onClick={() => setPage(page + 1)}>
            {loading ? <Spinner className="h-4 w-4" /> : 'Load more'}
          </button>
        )}
      </section>
    </div>
  );
}
