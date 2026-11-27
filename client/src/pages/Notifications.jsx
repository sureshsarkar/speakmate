import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Clock, Flame, Heart, Phone, Target, Trash2, UserPlus, X, Check } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { PageHeader } from '../components/Shared';
import Avatar from '../components/Avatar';
import { EmptyState, Skeleton, cx } from '../components/ui';
import { useFetch } from '../hooks';
import { api, errMsg } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';

const ICONS = {
  friend_request: UserPlus,
  practice_request: Phone,
  request_accepted: Heart,
  daily_reminder: Clock,
  streak_reminder: Flame,
  goal_completed: Target,
  system: Bell,
  partner_found: Phone,
};

export default function Notifications() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const toast = useAppStore((s) => s.toast);
  const setUnread = useAppStore((s) => s.setUnread);
  const unread = useAppStore((s) => s.unread);
  const { data, loading, reload, setData } = useFetch(() => api.get('/notifications').then((r) => r.data), []);

  useEffect(() => {
    if (data) setUnread(data.unread);
  }, [data, setUnread]);
  // live updates: a new socket notification bumps `unread`; refetch when it changes
  useEffect(() => {
    if (data && unread > data.unread) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  if (user.kind === 'guest') return <Navigate to="/home" replace />;

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all');
      setData((d) => ({ ...d, unread: 0, items: d.items.map((n) => ({ ...n, read: true })) }));
      setUnread(0);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const open = async (n) => {
    if (!n.read) {
      api.post(`/notifications/${n.id}/read`).catch(() => {});
      setData((d) => ({ ...d, unread: Math.max(0, d.unread - 1), items: d.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }));
    }
    if (['practice_request', 'request_accepted', 'friend_request'].includes(n.type)) navigate('/favorites');
    else if (n.type === 'goal_completed') navigate('/history');
    else if (['daily_reminder', 'streak_reminder'].includes(n.type)) navigate('/practice');
  };

  const remove = async (n) => {
    try {
      await api.delete(`/notifications/${n.id}`);
      setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== n.id), unread: n.read ? d.unread : Math.max(0, d.unread - 1) }));
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const respond = async (n, accept) => {
    try {
      await api.post(`/connections/${n.data.connectionId}/respond`, { accept });
      toast(accept ? 'Request accepted' : 'Request declined', 'success');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  return (
    <div className="page space-y-4">
      <PageHeader
        title="Notifications"
        back="/home"
        right={
          data?.unread > 0 && (
            <button onClick={markAll} className="btn-soft btn-sm">
              <CheckCheck className="h-4 w-4" /> Read all
            </button>
          )
        }
      />
      {loading ? (
        <Skeleton className="h-64" />
      ) : data?.items.length ? (
        <ul className="space-y-2.5">
          {data.items.map((n) => {
            const Icon = ICONS[n.type] || Bell;
            const pending = n.type === 'friend_request' && n.data?.connectionId && !n.data?.handled;
            return (
              <li key={n.id} className={cx('card relative flex gap-3 !p-3.5', !n.read && 'ring-2 ring-primary/60')}>
                {n.data?.from ? (
                  <Avatar src={n.data.from.avatarUrl} name={n.data.from.displayName} size={44} />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/25 text-secondary">
                    <Icon className="h-5 w-5" />
                  </span>
                )}
                <button className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
                  <p className="text-sm font-extrabold leading-snug">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-ink/60">{n.body}</p>}
                  <p className="mt-1 text-[11px] font-semibold text-ink/40">{timeAgo(n.createdAt)}</p>
                  {pending && (
                    <span className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <span role="button" tabIndex={0} onClick={() => respond(n, true)} className="btn-primary btn-sm !py-1.5">
                        <Check className="h-4 w-4" /> Accept
                      </span>
                      <span role="button" tabIndex={0} onClick={() => respond(n, false)} className="btn-ghost btn-sm !py-1.5">
                        <X className="h-4 w-4" /> Decline
                      </span>
                    </span>
                  )}
                  {n.type === 'friend_request' && n.data?.handled && <p className="mt-1 text-xs font-bold text-secondary">You {n.data.handled} this request.</p>}
                </button>
                <button onClick={() => remove(n)} className="h-8 w-8 shrink-0 rounded-full text-ink/30 hover:bg-red-50 hover:text-red-500" aria-label="Delete notification">
                  <Trash2 className="mx-auto h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Bell} title="You're all caught up" text="Practice requests, reminders and goal alerts will show up here." />
      )}
    </div>
  );
}
