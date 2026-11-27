import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CheckCircle2, Clock, Flag, Heart, Home, Mic, MessageSquare, Search, ShieldBan } from 'lucide-react';
import Avatar from '../components/Avatar';
import { ReportSheet } from '../components/Shared';
import { Button, ConfirmSheet, LevelBadge, StarRating, YesNo, cx } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { engine } from '../lib/callEngine';
import { formatDuration, formatMinutes } from '../lib/format';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';

const REASONS = {
  ended: 'Call ended',
  skipped: 'Call ended',
  partner_disconnected: 'Your partner lost their connection',
  connect_failed: 'We could not connect the audio',
  max_duration: 'Maximum call length reached',
  network_failure: 'The connection was lost',
  connection_lost: 'The connection was lost',
  microphone_lost: 'Your microphone was disconnected',
  protocol_error: 'The call could not be secured',
  admin: 'The call was ended by a moderator',
  server_shutdown: 'SpeakMate is restarting',
};

export default function CallEnded() {
  const summary = useCallStore((s) => s.summary);
  const phase = useCallStore((s) => s.phase);
  const user = useAuthStore((s) => s.user);
  const refresh = useAuthStore((s) => s.refresh);
  const toast = useAppStore((s) => s.toast);

  const [fb, setFb] = useState({ rating: 0, friendly: undefined, comfortable: undefined, connectAgain: undefined });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    if (summary) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.callKey]);

  if (phase !== 'ended' || !summary) return <Navigate to="/home" replace />;

  const { partner } = summary;
  const rated = summary.connected && summary.durationSec >= 5; // shorter calls are not recorded
  const canFavorite = user.kind === 'user' && !partner.isGuest && rated;
  const complete = fb.rating > 0 || fb.friendly !== undefined || fb.comfortable !== undefined || fb.connectAgain !== undefined;

  const submit = async () => {
    setBusy('feedback');
    try {
      const body = Object.fromEntries(Object.entries(fb).filter(([k, v]) => v !== undefined && !(k === 'rating' && !v)));
      await api.post(`/calls/${summary.callKey}/feedback`, body);
      setSent(true);
      if (fb.connectAgain && canFavorite && !favorite) toast('Tip: add them to favorites to find them again.', 'info');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy('');
    }
  };

  const addFavorite = async () => {
    setBusy('favorite');
    try {
      await api.post('/favorites', { publicId: partner.publicId });
      setFavorite(true);
      toast(`${partner.displayName} added to favorites`, 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy('');
    }
  };

  const block = async () => {
    setBusy('block');
    try {
      await api.post('/blocks', { publicId: partner.publicId });
      setBlocked(true);
      setSheet(null);
      toast(`${partner.displayName} is blocked. You will not be matched again.`, 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-light px-4 pb-10 pt-safe">
      <div className="animate-page-in pt-6">
        <div className="card flex flex-col items-center !p-6 text-center">
          <Avatar src={partner.avatarUrl} name={partner.displayName} size={84} />
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-secondary/60">{REASONS[summary.reason] || 'Call ended'}</p>
          <h1 className="text-2xl font-extrabold text-secondary">{partner.displayName}</h1>
          <div className="mt-1.5">
            <LevelBadge level={partner.englishLevel} />
          </div>
          <div className="mt-5 grid w-full grid-cols-3 gap-2">
            <div className="rounded-2xl bg-light p-3">
              <Clock className="mx-auto h-4 w-4 text-secondary" />
              <p className="mt-1 text-lg font-extrabold text-secondary">{formatDuration(summary.durationSec)}</p>
              <p className="text-[10px] font-semibold text-ink/50">Call duration</p>
            </div>
            <div className="rounded-2xl bg-light p-3">
              <Mic className="mx-auto h-4 w-4 text-secondary" />
              <p className="mt-1 text-lg font-extrabold text-secondary">{formatMinutes(summary.practiceMinutes)}</p>
              <p className="text-[10px] font-semibold text-ink/50">Practice minutes</p>
            </div>
            <div className="rounded-2xl bg-light p-3">
              <MessageSquare className="mx-auto h-4 w-4 text-secondary" />
              <p className="mt-1 line-clamp-2 text-xs font-extrabold leading-tight text-secondary">{summary.topic?.title || 'Free talk'}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-ink/50">Topic</p>
            </div>
          </div>
        </div>

        {rated ? (
          <section className="card mt-4 space-y-5">
            <h2 className="text-lg font-extrabold text-secondary">How was your conversation?</h2>
            {sent ? (
              <p className="flex items-center gap-2 rounded-2xl bg-primary/20 p-4 text-sm font-bold text-secondary">
                <CheckCircle2 className="h-5 w-5" /> Thanks for your feedback!
              </p>
            ) : (
              <>
                <StarRating value={fb.rating} onChange={(rating) => setFb({ ...fb, rating })} />
                <div>
                  <p className="label">Was your partner friendly?</p>
                  <YesNo value={fb.friendly} onChange={(friendly) => setFb({ ...fb, friendly })} />
                </div>
                <div>
                  <p className="label">Did you feel comfortable speaking English?</p>
                  <YesNo value={fb.comfortable} onChange={(comfortable) => setFb({ ...fb, comfortable })} />
                </div>
                <div>
                  <p className="label">Would you like to connect with this partner again?</p>
                  <YesNo value={fb.connectAgain} onChange={(connectAgain) => setFb({ ...fb, connectAgain })} />
                </div>
                <Button className="btn-soft w-full" disabled={!complete} loading={busy === 'feedback'} onClick={submit}>
                  Submit feedback
                </Button>
              </>
            )}
          </section>
        ) : (
          <p className="card mt-4 text-center text-sm text-ink/60">This call was too short to rate. Safety options are still available below.</p>
        )}

        <section className="mt-4 grid grid-cols-3 gap-2.5">
          <button
            disabled={!canFavorite || favorite}
            onClick={addFavorite}
            className={cx('card flex flex-col items-center gap-1.5 !p-3 text-xs font-bold transition disabled:opacity-50', favorite && '!bg-primary/25')}
          >
            <Heart className={cx('h-5 w-5 text-secondary', favorite && 'fill-secondary')} />
            {favorite ? 'Added' : 'Add to favorites'}
          </button>
          <button onClick={() => setSheet('report')} className="card flex flex-col items-center gap-1.5 !p-3 text-xs font-bold">
            <Flag className="h-5 w-5 text-amber-600" /> Report user
          </button>
          <button disabled={blocked} onClick={() => setSheet('block')} className="card flex flex-col items-center gap-1.5 !p-3 text-xs font-bold disabled:opacity-50">
            <ShieldBan className="h-5 w-5 text-red-600" /> {blocked ? 'Blocked' : 'Block user'}
          </button>
        </section>
        {user.kind === 'guest' && rated && (
          <p className="mt-3 text-center text-xs text-ink/50">
            <Link to="/register" className="font-bold text-secondary underline">
              Create a free account
            </Link>{' '}
            to add favorites and track your progress.
          </p>
        )}

        <div className="mt-6 space-y-3">
          <button className="btn-primary w-full !py-4" onClick={() => engine.startSearch()}>
            <Search className="h-5 w-5" /> Find Next Partner
          </button>
          <button
            className="btn-ghost w-full"
            onClick={() => {
              engine.reset();
            }}
          >
            <Home className="h-5 w-5" /> Back to Home
          </button>
        </div>
      </div>

      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} partner={partner} callKey={summary.callKey} onBlocked={() => setBlocked(true)} />
      <ConfirmSheet
        open={sheet === 'block'}
        title={`Block ${partner.displayName}?`}
        text="You will never be matched with this person again, and they will be removed from your favorites. You can unblock them in Settings."
        confirmLabel="Block"
        danger
        loading={busy === 'block'}
        onConfirm={block}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
