import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, Heart, HeartOff, Phone, ShieldBan, UserPlus, Users, X } from 'lucide-react';
import Avatar from '../components/Avatar';
import { PageHeader } from '../components/Shared';
import { Badge, ConfirmSheet, EmptyState, LevelBadge, Skeleton, cx } from '../components/ui';
import { useFetch } from '../hooks';
import { api, errMsg } from '../lib/api';
import { engine } from '../lib/callEngine';
import { timeAgo } from '../lib/format';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';

const STATUS_LABEL = { online: 'Online', busy: 'In a call', offline: 'Offline', hidden: '' };

function PersonCard({ p, children, sub }) {
  return (
    <div className="card flex items-center gap-3 !p-3">
      <Avatar src={p.avatarUrl} name={p.displayName} size={52} online={p.status && p.status !== 'hidden' ? p.status : undefined} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold">{p.displayName}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <LevelBadge level={p.englishLevel} long={false} />
          {p.status && STATUS_LABEL[p.status] && (
            <span className={cx('text-xs font-bold', p.status === 'online' ? 'text-emerald-600' : p.status === 'busy' ? 'text-amber-600' : 'text-ink/40')}>{STATUS_LABEL[p.status]}</span>
          )}
        </div>
        {sub && <p className="mt-0.5 text-[11px] text-ink/45">{sub}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

const IconBtn = ({ icon: Icon, label, onClick, tone = 'bg-primary/20 text-secondary', disabled }) => (
  <button onClick={onClick} disabled={disabled} className={cx('flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-40', tone)} aria-label={label} title={label}>
    <Icon className="h-[18px] w-[18px]" />
  </button>
);

export default function Favorites() {
  const user = useAuthStore((s) => s.user);
  const toast = useAppStore((s) => s.toast);
  const phase = useCallStore((s) => s.phase);
  const isGuest = user.kind === 'guest';
  const [tab, setTab] = useState(isGuest ? 'previous' : 'favorites');
  const [confirm, setConfirm] = useState(null); // { type, person }
  const [busy, setBusy] = useState('');

  const favs = useFetch(() => (isGuest ? Promise.resolve([]) : api.get('/favorites').then((r) => r.data.items)), [], { interval: 8000 });
  const prev = useFetch(() => api.get('/stats/partners').then((r) => r.data.items), []);
  const conns = useFetch(() => (isGuest ? Promise.resolve({ incoming: [], outgoing: [], accepted: [] }) : api.get('/connections').then((r) => r.data)), [], { interval: 10000 });

  const act = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      await fn();
      if (okMsg) toast(okMsg, 'success');
      await Promise.all([favs.reload(), prev.reload(), conns.reload()]);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy('');
      setConfirm(null);
    }
  };

  const requestPractice = (p) => act(`req-${p.publicId}`, () => api.post('/connections', { publicId: p.publicId }), `Practice request sent to ${p.displayName}`);
  const addFav = (p) => act(`fav-${p.publicId}`, () => api.post('/favorites', { publicId: p.publicId }), `${p.displayName} added to favorites`);
  const removeFav = (p) => act(`fav-${p.publicId}`, () => api.delete(`/favorites/${p.publicId}`), 'Removed from favorites');
  const respond = (c, accept) => act(`resp-${c.id}`, () => api.post(`/connections/${c.id}/respond`, { accept }), accept ? `You can now call ${c.displayName}` : 'Request declined');
  const blockUser = (p) => act(`blk-${p.publicId}`, () => api.post('/blocks', { publicId: p.publicId }), `${p.displayName} blocked`);
  const call = (p) => engine.startDirect(p);

  const callBusy = phase !== 'idle';
  const incoming = conns.data?.incoming || [];
  const tabs = [
    ['favorites', 'Favorites', !isGuest],
    ['previous', 'Previous', true],
    ['requests', `Requests${incoming.length ? ` (${incoming.length})` : ''}`, !isGuest],
  ].filter((t) => t[2]);

  const Actions = ({ p, favorite }) => (
    <>
      {p.connection === 'accepted' ? (
        <IconBtn icon={Phone} label={`Call ${p.displayName}`} onClick={() => call(p)} disabled={callBusy || p.status === 'busy'} tone="bg-primary text-secondary shadow-glow" />
      ) : p.connection === 'pending_out' ? (
        <Badge tone="gray">Requested</Badge>
      ) : p.connection === 'pending_in' ? (
        <Badge tone="amber">Wants to connect</Badge>
      ) : !p.isGuest ? (
        <IconBtn icon={UserPlus} label="Send practice request" disabled={busy === `req-${p.publicId}`} onClick={() => requestPractice(p)} />
      ) : null}
      {favorite ? (
        <IconBtn icon={HeartOff} label="Remove from favorites" onClick={() => removeFav(p)} tone="bg-ink/5 text-ink/60" />
      ) : (
        !isGuest && !p.isGuest && <IconBtn icon={Heart} label="Add to favorites" disabled={p.favorite} onClick={() => addFav(p)} tone={p.favorite ? 'bg-primary text-secondary' : 'bg-primary/20 text-secondary'} />
      )}
      <IconBtn icon={ShieldBan} label="Block" onClick={() => setConfirm({ type: 'block', person: p })} tone="bg-red-50 text-red-600" />
    </>
  );

  return (
    <div className="page space-y-4">
      <PageHeader title="Favorites" subtitle="People you enjoy practising with" />

      {isGuest && (
        <Link to="/register" className="card flex items-center gap-3 !bg-primary/20 text-sm font-semibold text-secondary">
          <Users className="h-6 w-6 shrink-0" />
          <span>Create a free account to save favorites and call your practice partners directly.</span>
        </Link>
      )}

      <div className="flex gap-2">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cx('chip flex-1 justify-center', tab === k && 'chip-active')}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'favorites' &&
        (favs.loading ? (
          <Skeleton className="h-28" />
        ) : favs.data?.length ? (
          <div className="space-y-2.5">
            {favs.data.map((p) => (
              <PersonCard key={p.publicId} p={p} sub={p.lastCallAt ? `Last spoke ${timeAgo(p.lastCallAt)} · ${p.calls} call${p.calls === 1 ? '' : 's'}` : null}>
                <Actions p={p} favorite />
              </PersonCard>
            ))}
            <p className="px-2 text-center text-[11px] text-ink/45">Direct calls work with accepted practice requests. Phone numbers and emails are never shared.</p>
          </div>
        ) : (
          <EmptyState icon={Heart} title="No favorites yet" text="After a call, tap 'Add to favorites' on the summary screen." />
        ))}

      {tab === 'previous' &&
        (prev.loading ? (
          <Skeleton className="h-28" />
        ) : prev.data?.length ? (
          <div className="space-y-2.5">
            {prev.data.map((p) => (
              <PersonCard key={p.publicId} p={p} sub={`${p.calls} call${p.calls === 1 ? '' : 's'} · ${p.minutes} min · ${timeAgo(p.lastCallAt)}`}>
                <Actions p={p} />
              </PersonCard>
            ))}
          </div>
        ) : (
          <EmptyState icon={Clock} title="No previous partners" text="People you talk with will appear here." />
        ))}

      {tab === 'requests' && (
        <div className="space-y-5">
          <section>
            <h2 className="mb-2 font-extrabold text-secondary">Incoming requests</h2>
            {incoming.length ? (
              <div className="space-y-2.5">
                {incoming.map((c) => (
                  <PersonCard key={c.id} p={c} sub="Wants to practise with you">
                    <IconBtn icon={Check} label="Accept" onClick={() => respond(c, true)} tone="bg-primary text-secondary" />
                    <IconBtn icon={X} label="Decline" onClick={() => respond(c, false)} tone="bg-ink/5 text-ink/60" />
                  </PersonCard>
                ))}
              </div>
            ) : (
              <p className="muted">No pending requests.</p>
            )}
          </section>
          <section>
            <h2 className="mb-2 font-extrabold text-secondary">Connected</h2>
            {conns.data?.accepted?.length ? (
              <div className="space-y-2.5">
                {conns.data.accepted.map((c) => (
                  <PersonCard key={c.id} p={c}>
                    <IconBtn icon={Phone} label={`Call ${c.displayName}`} onClick={() => call(c)} disabled={callBusy || c.status === 'busy'} tone="bg-primary text-secondary shadow-glow" />
                  </PersonCard>
                ))}
              </div>
            ) : (
              <p className="muted">You have no connections yet. Send a practice request from the Previous tab.</p>
            )}
          </section>
          {conns.data?.outgoing?.length > 0 && (
            <section>
              <h2 className="mb-2 font-extrabold text-secondary">Sent requests</h2>
              <div className="space-y-2.5">
                {conns.data.outgoing.map((c) => (
                  <PersonCard key={c.id} p={c} sub="Waiting for a reply" />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <ConfirmSheet
        open={confirm?.type === 'block'}
        title={`Block ${confirm?.person?.displayName}?`}
        text="You will never be matched with this person again and they are removed from your favorites. You can unblock them in Settings."
        confirmLabel="Block"
        danger
        loading={busy.startsWith('blk-')}
        onConfirm={() => blockUser(confirm.person)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
