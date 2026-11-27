import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Clock, Flame, Mic, PhoneCall, Sparkles, Target, Users } from 'lucide-react';
import Avatar from '../components/Avatar';
import { MicErrorCard } from '../components/Shared';
import { Badge, EmptyState, LevelBadge, ProgressRing, Skeleton, StatTile } from '../components/ui';
import { useFetch } from '../hooks';
import { api } from '../lib/api';
import { engine } from '../lib/callEngine';
import { formatDuration, formatMinutes, timeAgo } from '../lib/format';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export function StartButton({ big = true }) {
  const phase = useCallStore((s) => s.phase);
  const busy = phase !== 'idle' && phase !== 'ended';
  const start = () => engine.startSearch();
  return (
    <button
      onClick={start}
      disabled={busy}
      className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[28px] bg-primary px-6 py-5 text-lg font-extrabold uppercase tracking-wide text-secondary shadow-glow transition active:scale-[.98] disabled:opacity-70"
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
      <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary">
        <Mic className="h-6 w-6" />
        <span className="absolute inset-0 animate-ripple rounded-full bg-secondary/50" />
      </span>
      <span className="relative">{big ? 'Start Speaking' : 'Find a partner'}</span>
    </button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const online = useAppStore((s) => s.online);
  const unread = useAppStore((s) => s.unread);
  const setTopic = (slug) => useCallStore.getState().patch({ topicSlug: slug });
  const topicSlug = useCallStore((s) => s.topicSlug);

  const summary = useFetch(() => api.get('/stats/summary').then((r) => r.data), []);
  const topics = useFetch(() => api.get('/content/topics').then((r) => r.data.topics), []);
  const stats = summary.data?.stats;
  const isGuest = user?.kind === 'guest';

  return (
    <div className="page space-y-5">
      <header className="flex items-center gap-3">
        <Link to="/profile">
          <Avatar src={user.avatarUrl} name={user.displayName} size={52} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink/50">{greet()}</p>
          <h1 className="truncate text-xl font-extrabold text-secondary">{user.displayName}</h1>
        </div>
        {!isGuest && (
          <Link to="/notifications" className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card" aria-label="Notifications">
            <Bell className="h-5 w-5 text-secondary" />
            {unread > 0 && <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
          </Link>
        )}
      </header>

      {/* Profile / level card */}
      <section className="card flex items-center gap-3 !bg-secondary !p-4 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your English level</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <LevelBadge level={user.englishLevel} />
            {user.country && <span className="text-xs text-white/70">{user.country}</span>}
          </div>
          <p className="mt-2 text-xs text-white/60">Practising: {user.practiceLanguage}</p>
        </div>
        <Link to="/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15" aria-label="Edit profile">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </section>

      <MicErrorCard onRetry={() => engine.startSearch()} />
      <StartButton />

      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-ink/60">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <Users className="h-4 w-4" />
        <b className="text-secondary">{online.online || 1}</b> online practice partner{(online.online || 1) === 1 ? '' : 's'}
        {online.searching > 0 && <span className="text-ink/40">· {online.searching} looking now</span>}
      </div>

      {/* Daily goal + stats */}
      {summary.loading ? (
        <Skeleton className="h-40" />
      ) : stats ? (
        <>
          <section className="card flex items-center gap-4">
            <ProgressRing value={stats.todayMinutes} max={stats.dailyGoalMinutes}>
              <span className="text-xl font-extrabold leading-none text-secondary">{Math.round((Math.min(1, stats.todayMinutes / stats.dailyGoalMinutes)) * 100)}%</span>
              <span className="mt-0.5 text-[10px] font-semibold text-ink/45">of goal</span>
            </ProgressRing>
            <div className="flex-1">
              <p className="flex items-center gap-1.5 font-extrabold text-secondary">
                <Target className="h-4 w-4" /> Daily speaking goal
              </p>
              <p className="mt-1 text-sm text-ink/65">
                <b className="text-secondary">{formatMinutes(stats.todayMinutes)}</b> / {stats.dailyGoalMinutes} min today
              </p>
              {stats.todayMinutes >= stats.dailyGoalMinutes ? (
                <Badge className="mt-2">Goal completed! 🎉</Badge>
              ) : (
                <p className="mt-1 text-xs text-ink/50">{formatMinutes(stats.dailyGoalMinutes - stats.todayMinutes)} min to go</p>
              )}
            </div>
          </section>

          <div className="grid grid-cols-3 gap-3">
            <StatTile icon={Clock} label="Speaking min" value={formatMinutes(stats.totalMinutes)} />
            <StatTile icon={Flame} label="Day streak" value={stats.streak} tone="bg-orange-100 text-orange-600" />
            <StatTile icon={PhoneCall} label="Total calls" value={stats.totalCalls} tone="bg-sky-100 text-sky-700" />
          </div>
        </>
      ) : null}

      {isGuest && (
        <Link to="/register" className="card flex items-center gap-3 !bg-primary/20">
          <Sparkles className="h-6 w-6 shrink-0 text-secondary" />
          <p className="flex-1 text-sm font-semibold text-secondary">Create a free account to save your streak, history and favorite partners.</p>
          <ChevronRight className="h-5 w-5 text-secondary" />
        </Link>
      )}

      {/* Suggested topics */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-secondary">Suggested topics</h2>
          <Link to="/practice" className="text-sm font-bold text-secondary">
            See all
          </Link>
        </div>
        <div className="scroll-hide -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
          {(topics.data || []).slice(0, 8).map((t) => (
            <button
              key={t.slug}
              disabled={t.locked}
              onClick={() => {
                setTopic(topicSlug === t.slug ? null : t.slug);
              }}
              className={`chip shrink-0 ${topicSlug === t.slug ? 'chip-active' : ''} ${t.locked ? 'opacity-50' : ''}`}
            >
              <span>{t.icon}</span> {t.title}
            </button>
          ))}
        </div>
        {topicSlug && <p className="mt-2 text-xs font-semibold text-secondary">We will suggest this topic in your next call.</p>}
      </section>

      {/* Recent history */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-secondary">Recent practice</h2>
          <Link to="/history" className="text-sm font-bold text-secondary">
            View all
          </Link>
        </div>
        {summary.data?.recent?.length ? (
          <div className="space-y-2.5">
            {summary.data.recent.map((r) => (
              <button key={r.id} onClick={() => navigate('/history')} className="card flex w-full items-center gap-3 !p-3 text-left">
                <Avatar src={r.partner.avatarUrl} name={r.partner.displayName} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.partner.displayName}</p>
                  <p className="truncate text-xs text-ink/50">
                    {r.topic?.title || 'Free talk'} · {timeAgo(r.startedAt)}
                  </p>
                </div>
                <Badge>{formatDuration(r.durationSec)}</Badge>
              </button>
            ))}
          </div>
        ) : (
          !summary.loading && <EmptyState icon={Mic} title="No calls yet" text="Tap Start Speaking to have your first conversation." />
        )}
      </section>
    </div>
  );
}
