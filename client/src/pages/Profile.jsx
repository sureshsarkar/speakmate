import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, Clock, Crown, Flame, LogOut, Mail, PhoneCall, Settings as SettingsIcon, ShieldCheck, Star } from 'lucide-react';
import { AvatarUploader } from '../components/AvatarUploader';
import Avatar from '../components/Avatar';
import { PageHeader } from '../components/Shared';
import { Badge, Button, Field, LevelBadge, Select, StatTile } from '../components/ui';
import { GoalPicker, LevelPicker } from './Onboarding';
import { COUNTRIES, LANGUAGES, PRACTICE_LANGUAGES } from '../lib/constants';
import { api, errMsg } from '../lib/api';
import { formatMinutes } from '../lib/format';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const toast = useAppStore((s) => s.toast);
  const avatarUploads = useAppStore((s) => s.config?.avatarUploads);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(null);
  const isGuest = user.kind === 'guest';
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const startEdit = () => {
    setF({
      displayName: user.displayName,
      country: user.country,
      nativeLanguage: user.nativeLanguage,
      englishLevel: user.englishLevel,
      learningGoals: user.learningGoals,
      practiceLanguage: user.practiceLanguage,
    });
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put('/profile', { ...f, displayName: f.displayName.trim() });
      setUser(data.user);
      setEditing(false);
      toast('Profile updated', 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      const { data } = await api.post('/auth/resend-verification');
      toast(data.message, 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const s = user.stats;
  return (
    <div className="page space-y-5">
      <PageHeader
        title="Profile"
        right={
          <Link to="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card" aria-label="Settings">
            <SettingsIcon className="h-5 w-5 text-secondary" />
          </Link>
        }
      />

      <section className="card flex flex-col items-center text-center">
        {user.kind === 'user' && avatarUploads ? <AvatarUploader size={96} /> : <Avatar src={user.avatarUrl} name={user.displayName} size={96} />}
        <h2 className="mt-3 text-2xl font-extrabold text-secondary">{user.displayName}</h2>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <LevelBadge level={user.englishLevel} />
          {user.country && <Badge tone="gray">{user.country}</Badge>}
          {user.plan === 'premium' ? (
            <Badge tone="dark">
              <Crown className="h-3 w-3" /> Premium
            </Badge>
          ) : (
            <Badge tone="gray">{isGuest ? 'Guest' : 'Free plan'}</Badge>
          )}
        </div>
        {user.rating && (
          <p className="mt-2 flex items-center gap-1 text-sm font-bold text-amber-600">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {user.rating} partner rating
          </p>
        )}
        {user.kind === 'user' && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink/55">
            <Mail className="h-3.5 w-3.5" /> {user.email} (only you can see this)
            {user.emailVerified ? (
              <span className="flex items-center gap-0.5 font-bold text-secondary">
                <BadgeCheck className="h-3.5 w-3.5" /> verified
              </span>
            ) : (
              <button onClick={resend} className="font-bold text-secondary underline">
                Verify
              </button>
            )}
          </p>
        )}
        {!editing && (
          <button className="btn-soft btn-sm mt-4" onClick={startEdit}>
            Edit profile
          </button>
        )}
      </section>

      {isGuest && (
        <Link to="/register" className="card flex items-center gap-3 !bg-primary/20 text-sm font-semibold text-secondary">
          <ShieldCheck className="h-6 w-6 shrink-0" />
          <span>You are using a temporary guest session. Create a free account to keep your progress. Your profile will be kept.</span>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={Clock} label="Minutes" value={formatMinutes(s.totalMinutes)} />
        <StatTile icon={PhoneCall} label="Calls" value={s.totalCalls} tone="bg-sky-100 text-sky-700" />
        <StatTile icon={Flame} label="Streak" value={s.streak} tone="bg-orange-100 text-orange-600" />
      </div>

      {editing ? (
        <section className="card space-y-4">
          <Field label="Display name">
            <input className="input" maxLength={40} value={f.displayName} onChange={(e) => set('displayName')(e.target.value)} />
          </Field>
          <Field label="Country">
            <Select value={f.country} onChange={set('country')} options={COUNTRIES} placeholder="Select country" />
          </Field>
          <Field label="Native language">
            <Select value={f.nativeLanguage} onChange={set('nativeLanguage')} options={LANGUAGES} placeholder="Select language" />
          </Field>
          <div>
            <span className="label">English speaking level</span>
            <LevelPicker value={f.englishLevel} onChange={set('englishLevel')} />
          </div>
          <Field label="Preferred practice language">
            <Select value={f.practiceLanguage} onChange={set('practiceLanguage')} options={PRACTICE_LANGUAGES} />
          </Field>
          <div>
            <span className="label">Learning goals</span>
            <GoalPicker value={f.learningGoals} onChange={set('learningGoals')} />
          </div>
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <Button className="btn-primary flex-1" loading={busy} disabled={f.displayName.trim().length < 2 || !f.learningGoals.length} onClick={save}>
              Save changes
            </Button>
          </div>
        </section>
      ) : (
        <section className="card divide-y divide-ink/5 !p-0">
          {[
            ['Native language', user.nativeLanguage || '-'],
            ['Practice language', user.practiceLanguage],
            ['Daily goal', `${user.dailyGoalMinutes} minutes`],
            ['Daily free limit', user.dailyLimitMinutes ? `${user.dailyLimitMinutes} minutes` : '-'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-4 py-3.5 text-sm">
              <span className="text-ink/55">{k}</span>
              <span className="font-bold">{v}</span>
            </div>
          ))}
          <div className="px-4 py-3.5">
            <p className="mb-2 text-sm text-ink/55">Learning goals</p>
            <div className="flex flex-wrap gap-1.5">
              {user.learningGoals.map((g) => (
                <Badge key={g}>{g.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="space-y-2.5">
        <Link to="/settings" className="btn-ghost w-full">
          <SettingsIcon className="h-5 w-5" /> Settings and privacy
        </Link>
        <button
          className="btn-ghost w-full !border-red-200 !text-red-600"
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
        >
          <LogOut className="h-5 w-5" /> {isGuest ? 'End guest session' : 'Log out'}
        </button>
      </div>
    </div>
  );
}
