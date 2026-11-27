import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Avatar from '../components/Avatar';
import { Button, Field, Select, cx } from '../components/ui';
import { AvatarUploader } from '../components/AvatarUploader';
import { COUNTRIES, GOALS, LANGUAGES, LEVELS, PRACTICE_LANGUAGES } from '../lib/constants';
import { api, errMsg } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { LogoMark } from '../components/Logo';

export function LevelPicker({ value, onChange }) {
  return (
    <div className="space-y-2.5">
      {LEVELS.map((l) => (
        <button
          type="button"
          key={l.value}
          onClick={() => onChange(l.value)}
          className={cx(
            'flex w-full items-center gap-3.5 rounded-2xl border-2 p-3.5 text-left transition active:scale-[.99]',
            value === l.value ? 'border-primary bg-primary/15' : 'border-transparent bg-white shadow-card'
          )}
        >
          <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold', value === l.value ? 'bg-primary text-secondary' : 'bg-light text-ink/60')}>
            {l.short}
          </span>
          <span className="flex-1">
            <span className="block font-extrabold text-secondary">{l.label}</span>
            <span className="block text-xs text-ink/55">{l.desc}</span>
          </span>
          {value === l.value && <Check className="h-5 w-5 text-secondary" />}
        </button>
      ))}
    </div>
  );
}

export function GoalPicker({ value, onChange }) {
  const toggle = (g) => onChange(value.includes(g) ? value.filter((x) => x !== g) : [...value, g]);
  return (
    <div className="flex flex-wrap gap-2">
      {GOALS.map((g) => (
        <button type="button" key={g.value} onClick={() => toggle(g.value)} className={cx('chip', value.includes(g.value) && 'chip-active')}>
          <span>{g.emoji}</span> {g.label}
        </button>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useAppStore((s) => s.toast);
  const avatarUploads = useAppStore((s) => s.config?.avatarUploads);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    displayName: user?.displayName || '',
    country: user?.country || '',
    nativeLanguage: user?.nativeLanguage || '',
    englishLevel: user?.englishLevel || 'beginner',
    practiceLanguage: user?.practiceLanguage || 'English',
    learningGoals: user?.learningGoals || [],
    dailyGoalMinutes: user?.dailyGoalMinutes || 15,
  });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const valid = [
    f.displayName.trim().length >= 2 && f.country && f.nativeLanguage,
    Boolean(f.englishLevel),
    f.learningGoals.length > 0,
  ];

  const finish = async () => {
    setBusy(true);
    try {
      const { data } = await api.put('/profile', { ...f, displayName: f.displayName.trim(), completeOnboarding: true });
      setUser(data.user);
      toast(`Welcome, ${data.user.displayName}!`, 'success');
      navigate('/home', { replace: true });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const titles = ['About you', 'Your English level', 'Your goals'];

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-light px-5 pb-10 pt-safe">
      <div className="pt-6">
        <div className="flex items-center justify-between">
          <LogoMark size={36} />
          <span className="text-xs font-bold text-ink/50">Step {step + 1} of 3</span>
        </div>
        <div className="mt-4 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cx('h-1.5 flex-1 rounded-full transition-all', i <= step ? 'bg-primary' : 'bg-ink/10')} />
          ))}
        </div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-secondary">{titles[step]}</h1>
        <p className="muted mt-1">
          {step === 0 && 'Partners will see your display name, picture and level. Never your email or phone.'}
          {step === 1 && 'Be honest. It helps us find partners you will enjoy talking with.'}
          {step === 2 && 'Pick everything you want to work on.'}
        </p>
      </div>

      <div key={step} className="mt-6 animate-page-in space-y-4">
        {step === 0 && (
          <>
            {user?.kind === 'user' && avatarUploads && (
              <div className="flex justify-center">
                <AvatarUploader />
              </div>
            )}
            {!(user?.kind === 'user' && avatarUploads) && (
              <div className="flex justify-center">
                <Avatar src={user?.avatarUrl} name={f.displayName || '?'} size={88} />
              </div>
            )}
            <Field label="Display name">
              <input className="input" maxLength={40} value={f.displayName} onChange={(e) => set('displayName')(e.target.value)} placeholder="How should partners call you?" />
            </Field>
            <Field label="Country" hint="Shown to partners only if you allow it in Settings.">
              <Select value={f.country} onChange={set('country')} options={COUNTRIES} placeholder="Select your country" />
            </Field>
            <Field label="Native language">
              <Select value={f.nativeLanguage} onChange={set('nativeLanguage')} options={LANGUAGES} placeholder="Select your language" />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <LevelPicker value={f.englishLevel} onChange={set('englishLevel')} />
            <Field label="Preferred practice language" hint="We try to pair you with someone who wants the same.">
              <Select value={f.practiceLanguage} onChange={set('practiceLanguage')} options={PRACTICE_LANGUAGES} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <GoalPicker value={f.learningGoals} onChange={set('learningGoals')} />
            <div className="card mt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-secondary">Daily speaking goal</span>
                <span className="text-xl font-extrabold text-secondary">{f.dailyGoalMinutes} min</span>
              </div>
              <input type="range" min={5} max={60} step={5} value={f.dailyGoalMinutes} onChange={(e) => set('dailyGoalMinutes')(Number(e.target.value))} className="range-green mt-3 w-full" />
              <p className="mt-1 text-xs text-ink/50">Small daily habits beat long, rare sessions.</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <button className="btn-ghost" onClick={() => setStep(step - 1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        {step < 2 ? (
          <button className="btn-primary flex-1" disabled={!valid[step]} onClick={() => setStep(step + 1)}>
            Continue <ArrowRight className="h-5 w-5" />
          </button>
        ) : (
          <Button className="btn-primary flex-1" disabled={!valid[2]} loading={busy} onClick={finish}>
            Finish and start speaking
          </Button>
        )}
      </div>
      {step === 0 && !valid[0] && <p className="mt-3 text-center text-xs text-ink/45">Fill in your name, country and native language to continue.</p>}
    </div>
  );
}
