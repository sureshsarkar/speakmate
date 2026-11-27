import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, BookOpen, ChevronRight, Eye, KeyRound, LifeBuoy, LogOut, ShieldBan, Trash2 } from 'lucide-react';
import Avatar from '../components/Avatar';
import { PageHeader } from '../components/Shared';
import { Button, Field, Sheet, Toggle } from '../components/ui';
import { useFetch } from '../hooks';
import { api, errMsg } from '../lib/api';
import { disablePush, enablePush, pushSupported } from '../lib/push';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';

const Row = ({ title, desc, children }) => (
  <div className="flex items-center justify-between gap-4 px-4 py-3.5">
    <div className="min-w-0">
      <p className="text-sm font-bold">{title}</p>
      {desc && <p className="text-xs text-ink/50">{desc}</p>}
    </div>
    {children}
  </div>
);

const Section = ({ title, icon: Icon, children }) => (
  <section>
    <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-extrabold uppercase tracking-widest text-ink/45">
      <Icon className="h-4 w-4" /> {title}
    </h2>
    <div className="card divide-y divide-ink/5 !p-0">{children}</div>
  </section>
);

export default function Settings() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);
  const config = useAppStore((s) => s.config);
  const toast = useAppStore((s) => s.toast);
  const isGuest = user.kind === 'guest';
  const prefs = user.notifPrefs || {};
  const blocks = useFetch(() => api.get('/blocks').then((r) => r.data.items), []);
  const [sheet, setSheet] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [delPw, setDelPw] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (patch, okMsg) => {
    try {
      const { data } = await api.put('/profile/settings', patch);
      setUser(data.user);
      if (okMsg) toast(okMsg, 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const togglePush = async (on) => {
    try {
      if (on) {
        const r = await enablePush(config?.vapidPublicKey);
        await save({ notifPrefs: { push: true } });
        toast(r.local ? 'Browser notifications enabled while SpeakMate is open.' : 'Push notifications enabled on this device.', 'success');
      } else {
        await disablePush();
        await save({ notifPrefs: { push: false } }, 'Push notifications turned off');
      }
    } catch (e) {
      toast(e.message || errMsg(e), 'error');
    }
  };

  const changePassword = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/change-password', pw);
      setSession({ token: data.token, user: data.user }, true);
      toast('Password changed', 'success');
      setSheet(null);
      setPw({ currentPassword: '', newPassword: '' });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api.post('/profile/delete', { password: delPw || undefined });
      logout();
      navigate('/', { replace: true });
      toast('Your account was deleted.', 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
    }
  };

  const unblock = async (b) => {
    try {
      await api.delete(`/blocks/${b.publicId}`);
      blocks.reload();
      toast(`${b.displayName} unblocked`, 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const pushDenied = pushSupported() && Notification.permission === 'denied';

  return (
    <div className="page space-y-5">
      <PageHeader title="Settings" back="/profile" />

      <Section title="Daily goal" icon={BookOpen}>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Speaking goal</span>
            <span className="text-lg font-extrabold text-secondary">{user.dailyGoalMinutes} min</span>
          </div>
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={user.dailyGoalMinutes}
            onChange={(e) => setUser({ ...user, dailyGoalMinutes: Number(e.target.value) })}
            onMouseUp={(e) => save({ dailyGoalMinutes: Number(e.target.value) })}
            onTouchEnd={(e) => save({ dailyGoalMinutes: Number(e.target.value) })}
            onKeyUp={(e) => save({ dailyGoalMinutes: Number(e.target.value) })}
            className="range-green mt-2 w-full"
          />
        </div>
      </Section>

      {!isGuest && (
        <Section title="Notifications" icon={Bell}>
          <Row title="Push notifications" desc={pushDenied ? 'Blocked in your browser settings' : pushSupported() ? 'Practice requests, reminders and goals' : 'Not supported in this browser'}>
            <Toggle checked={Boolean(prefs.push)} disabled={!pushSupported() || pushDenied} onChange={togglePush} label="Push notifications" />
          </Row>
          <Row title="Daily practice reminder" desc="A nudge if you have not practised yet">
            <Toggle checked={prefs.dailyReminder !== false} onChange={(v) => save({ notifPrefs: { dailyReminder: v } })} label="Daily reminder" />
          </Row>
          {prefs.dailyReminder !== false && (
            <Row title="Reminder time">
              <input type="time" value={prefs.reminderTime || '19:00'} onChange={(e) => e.target.value && save({ notifPrefs: { reminderTime: e.target.value } }, 'Reminder time saved')} className="rounded-xl border border-secondary/15 px-3 py-2 text-sm font-bold" />
            </Row>
          )}
          <Row title="Streak reminder" desc="Evening alert when your streak is at risk">
            <Toggle checked={prefs.streakReminder !== false} onChange={(v) => save({ notifPrefs: { streakReminder: v } })} label="Streak reminder" />
          </Row>
          <Row title="Practice and friend requests">
            <Toggle checked={prefs.requests !== false} onChange={(v) => save({ notifPrefs: { requests: v } })} label="Requests" />
          </Row>
        </Section>
      )}

      <Section title="Privacy" icon={Eye}>
        <Row title="Show my country" desc="Partners see your country on calls">
          <Toggle checked={user.privacy.showCountry} onChange={(v) => save({ privacy: { showCountry: v } })} label="Show country" />
        </Row>
        {!isGuest && (
          <Row title="Show online status" desc="Let favorites see when you are online">
            <Toggle checked={user.privacy.showOnlineStatus} onChange={(v) => save({ privacy: { showOnlineStatus: v } })} label="Show online status" />
          </Row>
        )}
        <p className="px-4 py-3 text-xs text-ink/50">Your email, phone number and account details are never shown to other users. Calls are never recorded.</p>
      </Section>

      <Section title="Blocked users" icon={ShieldBan}>
        {blocks.data?.length ? (
          blocks.data.map((b) => (
            <div key={b.publicId} className="flex items-center gap-3 px-4 py-3">
              <Avatar src={b.avatarUrl} name={b.displayName} size={38} />
              <span className="flex-1 truncate text-sm font-bold">{b.displayName}</span>
              <button className="btn-soft btn-sm" onClick={() => unblock(b)}>
                Unblock
              </button>
            </div>
          ))
        ) : (
          <p className="px-4 py-4 text-sm text-ink/50">{blocks.loading ? 'Loading...' : "You haven't blocked anyone."}</p>
        )}
      </Section>

      <Section title="Help and safety" icon={LifeBuoy}>
        {[
          ['/help', 'Help and support'],
          ['/guidelines', 'Community guidelines'],
        ].map(([to, label]) => (
          <Link key={to} to={to} className="flex items-center justify-between px-4 py-3.5 text-sm font-bold">
            {label} <ChevronRight className="h-4 w-4 text-ink/35" />
          </Link>
        ))}
      </Section>

      <Section title="Account" icon={KeyRound}>
        {!isGuest && user.hasPassword && (
          <button className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-bold" onClick={() => setSheet('password')}>
            Change password <ChevronRight className="h-4 w-4 text-ink/35" />
          </button>
        )}
        <button
          className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-sm font-bold"
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
        >
          <LogOut className="h-4 w-4" /> {isGuest ? 'End guest session' : 'Log out'}
        </button>
        <button className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-sm font-bold text-red-600" onClick={() => setSheet('delete')}>
          <Trash2 className="h-4 w-4" /> Delete {isGuest ? 'guest data' : 'my account'}
        </button>
      </Section>

      <Sheet open={sheet === 'password'} onClose={() => setSheet(null)} title="Change password">
        <div className="space-y-4">
          <Field label="Current password">
            <input type="password" className="input" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </Field>
          <Field label="New password" hint="At least 8 characters with a letter and a number.">
            <input type="password" className="input" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </Field>
          <Button className="btn-primary w-full" loading={busy} disabled={!pw.currentPassword || pw.newPassword.length < 8} onClick={changePassword}>
            Update password
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'delete'} onClose={() => setSheet(null)} title="Delete your account?">
        <p className="mb-4 text-sm text-ink/70">This permanently removes your profile, history, favorites and notifications. This cannot be undone.</p>
        {!isGuest && user.hasPassword && (
          <Field label="Confirm with your password">
            <input type="password" className="input" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
          </Field>
        )}
        <div className="mt-5 flex gap-3">
          <button className="btn-ghost flex-1" onClick={() => setSheet(null)}>
            Cancel
          </button>
          <Button className="btn-danger flex-1" loading={busy} disabled={!isGuest && user.hasPassword && !delPw} onClick={deleteAccount}>
            Delete forever
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
