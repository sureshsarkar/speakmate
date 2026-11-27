import { Navigate } from 'react-router-dom';
import { Lock, MessageCircleQuestion, Mic, PhoneOff, Sparkles, X } from 'lucide-react';
import Avatar from '../components/Avatar';
import { MicErrorCard, PageHeader } from '../components/Shared';
import { LevelBadge, Skeleton, cx } from '../components/ui';
import Waveform from '../components/Waveform';
import { useFetch, useSecondsSince } from '../hooks';
import { api } from '../lib/api';
import { engine } from '../lib/callEngine';
import { pathForPhase } from '../lib/constants';
import { formatClock } from '../lib/format';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { StartButton } from './Home';

/** /practice: choose a topic and start. */
export function Practice() {
  const topics = useFetch(() => api.get('/content/topics').then((r) => r.data.topics), []);
  const assist = useFetch(() => api.get('/content/assist').then((r) => r.data), []);
  const topicSlug = useCallStore((s) => s.topicSlug);
  const toast = useAppStore((s) => s.toast);
  const pick = (t) => {
    if (t.locked) return toast('Premium topics are available on the Premium plan.', 'info');
    useCallStore.getState().patch({ topicSlug: topicSlug === t.slug ? null : t.slug });
  };

  return (
    <div className="page space-y-5">
      <PageHeader title="Practice" subtitle="Pick a topic (optional) and meet a partner." />
      <MicErrorCard onRetry={() => engine.startSearch()} />
      <StartButton />
      <p className="-mt-2 text-center text-xs text-ink/50">Audio only. Your microphone is used just for the call, and calls are never recorded.</p>

      <section>
        <h2 className="mb-2.5 text-lg font-extrabold text-secondary">Conversation topics</h2>
        {topics.loading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {topics.data?.map((t) => (
              <button
                key={t.slug}
                onClick={() => pick(t)}
                className={cx(
                  'relative rounded-3xl p-3.5 text-left transition active:scale-[.97]',
                  topicSlug === t.slug ? 'bg-primary/30 ring-2 ring-primary' : 'bg-white shadow-card',
                  t.locked && 'opacity-60'
                )}
              >
                <span className="text-2xl">{t.icon}</span>
                <p className="mt-1.5 text-sm font-extrabold leading-tight text-secondary">{t.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-ink/50">{t.description}</p>
                {t.locked && <Lock className="absolute right-3 top-3 h-4 w-4 text-ink/40" />}
              </button>
            ))}
          </div>
        )}
        {topicSlug && (
          <button onClick={() => useCallStore.getState().patch({ topicSlug: null })} className="mt-3 flex items-center gap-1 text-xs font-bold text-ink/50">
            <X className="h-3.5 w-3.5" /> Clear topic (let us choose)
          </button>
        )}
      </section>

      {assist.data && (
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-extrabold text-secondary">
            <MessageCircleQuestion className="h-5 w-5" /> Conversation starters
          </h2>
          <div className="flex flex-wrap gap-2">
            {assist.data.starters.map((s) => (
              <span key={s} className="chip !cursor-default">
                {s}
              </span>
            ))}
          </div>
          <h2 className="flex items-center gap-2 pt-1 font-extrabold text-secondary">
            <Sparkles className="h-5 w-5" /> Useful sentences
          </h2>
          <ul className="space-y-2">
            {assist.data.phrases.map((p) => (
              <li key={p.text} className="rounded-2xl bg-light px-3.5 py-2.5 text-sm">
                <span className="font-bold">{p.text}</span>
                {p.note && <span className="block text-xs text-ink/50">{p.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Live screen while looking for a partner (or ringing a connection). */
export function Searching() {
  const phase = useCallStore((s) => s.phase);
  const startedAt = useCallStore((s) => s.searchStartedAt);
  const outgoing = useCallStore((s) => s.outgoing);
  const local = useCallStore((s) => s.analysers.local);
  const topicSlug = useCallStore((s) => s.topicSlug);
  const online = useAppStore((s) => s.online);
  const user = useAuthStore((s) => s.user);
  const secs = useSecondsSince(startedAt);

  if (!['requesting_mic', 'searching', 'inviting'].includes(phase)) return <Navigate to={pathForPhase(phase)} replace />;

  const calling = phase === 'inviting';
  const status =
    phase === 'requesting_mic' ? 'Waiting for microphone permission' : calling ? (outgoing?.accepting ? 'Connecting' : 'Ringing') : 'Looking for Partner';
  const title = calling ? `${outgoing?.accepting ? 'Connecting to' : 'Calling'} ${outgoing?.to?.displayName || 'your partner'}...` : 'Finding Your English Speaking Partner...';

  return (
    <div className="fixed inset-0 flex flex-col items-center bg-gradient-to-b from-primary/35 via-light to-light px-6 pb-safe pt-safe">
      <div className="mt-10 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-secondary/60">{status}</p>
        <h1 className="mx-auto mt-2 max-w-xs text-2xl font-extrabold leading-tight text-secondary">
          {title}
          <span className="inline-flex">
            {[0, 1, 2].map((i) => (
              <i key={i} className="not-italic animate-dots" style={{ animationDelay: `${i * 0.2}s` }}>
                .
              </i>
            ))}
          </span>
        </h1>
      </div>

      <div className="relative my-auto flex h-72 w-72 items-center justify-center">
        {[0, 0.8, 1.6].map((d) => (
          <span key={d} className="absolute h-36 w-36 animate-ripple rounded-full border-2 border-primary bg-primary/20" style={{ animationDelay: `${d}s` }} />
        ))}
        <div className="relative z-10 rounded-full bg-white p-1.5 shadow-glow">
          <Avatar src={calling ? outgoing?.to?.avatarUrl : user.avatarUrl} name={calling ? outgoing?.to?.displayName : user.displayName} size={112} />
        </div>
      </div>

      <div className="mb-4 w-full max-w-xs space-y-4">
        {phase !== 'requesting_mic' && (
          <div className="card !p-3">
            <p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wide text-ink/45">Microphone check. Say something!</p>
            <Waveform analyser={local} bars={34} height={34} />
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="card !p-2.5">
            <p className="text-lg font-extrabold text-secondary">{online.online || 1}</p>
            <p className="text-[10px] font-semibold text-ink/50">Online</p>
          </div>
          <div className="card !p-2.5">
            <p className="text-lg font-extrabold text-secondary">{online.searching || 1}</p>
            <p className="text-[10px] font-semibold text-ink/50">Searching</p>
          </div>
          <div className="card !p-2.5">
            <p className="text-lg font-extrabold text-secondary">{formatClock(secs)}</p>
            <p className="text-[10px] font-semibold text-ink/50">Waiting</p>
          </div>
        </div>
        {!calling && (
          <p className="text-center text-xs text-ink/55">
            {secs < 10 ? `Matching you with learners near your level${topicSlug ? ' who want to chat about your topic' : ''}.` : secs < 30 ? 'Widening the search to more levels...' : 'Still searching. Fewer learners are online right now. Hang tight!'}
          </p>
        )}
        <button onClick={() => engine.cancelSearch()} className="btn-ghost w-full !border-red-200 !text-red-600">
          <PhoneOff className="h-4 w-4" /> {calling ? 'Cancel Call' : 'Cancel Search'}
        </button>
      </div>
    </div>
  );
}

/** "Partner found" interstitial before the call connects. */
export function PartnerFound() {
  const phase = useCallStore((s) => s.phase);
  const partner = useCallStore((s) => s.partner);
  const topic = useCallStore((s) => s.topic);
  if (phase !== 'found' || !partner) return <Navigate to={pathForPhase(phase)} replace />;
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-secondary via-secondary to-ink px-6 text-center text-white">
      <p className="animate-page-in text-xs font-bold uppercase tracking-widest text-primary">Partner Found</p>
      <div className="relative my-8 animate-page-in">
        <span className="absolute inset-0 animate-ripple rounded-full bg-primary/40" />
        <span className="absolute inset-0 animate-ripple rounded-full bg-primary/30" style={{ animationDelay: '.9s' }} />
        <Avatar src={partner.avatarUrl} name={partner.displayName} size={140} className="relative" />
      </div>
      <h1 className="animate-page-in text-3xl font-extrabold">{partner.displayName}</h1>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 animate-page-in">
        <LevelBadge level={partner.englishLevel} />
        {partner.country && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{partner.country}</span>}
      </div>
      {topic && (
        <p className="mt-6 animate-page-in text-sm text-white/70">
          Suggested topic: <b className="text-white">{topic.title}</b>
        </p>
      )}
      <p className="mt-10 flex items-center gap-1 text-sm font-semibold text-white/80">
        <Mic className="h-4 w-4" /> Connecting your audio
        {[0, 1, 2].map((i) => (
          <i key={i} className="not-italic animate-dots" style={{ animationDelay: `${i * 0.2}s` }}>
            .
          </i>
        ))}
      </p>
    </div>
  );
}
