import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Field, FullSpinner, Toggle } from '../../components/ui';
import { useFetch } from '../../hooks';
import { adminApi } from '../../lib/adminApi';
import { errMsg } from '../../lib/api';
import { applyTheme } from '../../lib/theme';
import { useAppStore } from '../../store/appStore';
import { PageTitle } from './AdminUI';

const COLORS = [
  ['primary', 'Primary (Parrot Green)'],
  ['secondary', 'Secondary'],
  ['light', 'Light background'],
  ['text', 'Text'],
  ['background', 'Background'],
];

const NumberField = ({ label, hint, value, onChange, min = 0, max = 9999 }) => (
  <Field label={label} hint={hint}>
    <input type="number" min={min} max={max} className="input" value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </Field>
);

const Card = ({ title, children, desc }) => (
  <section className="card space-y-4">
    <div>
      <h2 className="font-extrabold text-secondary">{title}</h2>
      {desc && <p className="muted">{desc}</p>}
    </div>
    {children}
  </section>
);

export default function AdminSettings() {
  const toast = useAppStore((s) => s.toast);
  const loadConfig = useAppStore((s) => s.loadConfig);
  const { data, loading } = useFetch(() => adminApi.get('/settings').then((r) => r.data.settings), []);
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  if (loading || !s) return <FullSpinner />;
  const set = (group, key) => (v) => setS({ ...s, [group]: { ...s[group], [key]: v } });

  const save = async () => {
    setBusy(true);
    try {
      const { appName, tagline, logoUrl, supportEmail, theme, matching, limits, guest, maintenance } = s;
      const { data: res } = await adminApi.put('/settings', { appName, tagline, logoUrl, supportEmail, theme, matching, limits, guest, maintenance });
      setS(res.settings);
      applyTheme(res.settings.theme);
      loadConfig();
      toast('Settings saved', 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Application settings" subtitle="Branding, matching rules, limits and availability.">
        <Button className="btn-primary" loading={busy} onClick={save}>
          Save all changes
        </Button>
      </PageTitle>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Branding">
          <Field label="Application name">
            <input className="input" maxLength={40} value={s.appName} onChange={(e) => setS({ ...s, appName: e.target.value })} />
          </Field>
          <Field label="Tagline">
            <input className="input" maxLength={120} value={s.tagline} onChange={(e) => setS({ ...s, tagline: e.target.value })} />
          </Field>
          <Field label="Logo URL" hint="Square image, https://... Leave empty for the default mark.">
            <input className="input" value={s.logoUrl} onChange={(e) => setS({ ...s, logoUrl: e.target.value })} placeholder="https://..." />
          </Field>
          <Field label="Support email">
            <input className="input" type="email" value={s.supportEmail} onChange={(e) => setS({ ...s, supportEmail: e.target.value })} />
          </Field>
        </Card>

        <Card title="Theme colors" desc="Applies instantly to every user.">
          <div className="grid grid-cols-2 gap-3">
            {COLORS.map(([k, label]) => (
              <Field key={k} label={label}>
                <div className="flex items-center gap-2 rounded-2xl border border-secondary/15 bg-white p-2">
                  <input type="color" value={s.theme[k]} onChange={(e) => set('theme', k)(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={label} />
                  <span className="font-mono text-xs font-bold">{s.theme[k]}</span>
                </div>
              </Field>
            ))}
          </div>
          <button className="text-xs font-bold text-secondary underline" onClick={() => setS({ ...s, theme: { primary: '#7ED957', secondary: '#1B5E20', background: '#FFFFFF', light: '#F5FAF2', text: '#17251A' } })}>
            Reset to Parrot Green defaults
          </button>
        </Card>

        <Card title="Matching rules" desc="How partners are paired. Wider tolerance means faster matches but less similar levels.">
          <NumberField label="Allowed level gap at start" hint="0 = same level only. Max 4." value={s.matching.initialLevelDiff} onChange={set('matching', 'initialLevelDiff')} max={4} />
          <NumberField label="Widen level gap every (seconds)" value={s.matching.relaxEverySec} onChange={set('matching', 'relaxEverySec')} min={3} max={120} />
          <NumberField label="Require same practice language for (seconds)" value={s.matching.samePracticeLanguageSec} onChange={set('matching', 'samePracticeLanguageSec')} max={300} />
          <NumberField label="Avoid recent partners until waited (seconds)" value={s.matching.avoidRecentPartnersSec} onChange={set('matching', 'avoidRecentPartnersSec')} max={600} />
          <NumberField label="Recent partners remembered" value={s.matching.recentPartnerMemory} onChange={set('matching', 'recentPartnerMemory')} max={50} />
        </Card>

        <Card title="Call limits" desc="Daily limits count practice minutes per person.">
          <NumberField label="Free plan daily minutes" value={s.limits.freeDailyMinutes} onChange={set('limits', 'freeDailyMinutes')} min={1} max={1440} />
          <NumberField label="Premium plan daily minutes" value={s.limits.premiumDailyMinutes} onChange={set('limits', 'premiumDailyMinutes')} min={1} max={1440} />
          <NumberField label="Guest daily minutes" value={s.limits.guestDailyMinutes} onChange={set('limits', 'guestDailyMinutes')} min={1} max={1440} />
          <NumberField label="Maximum single call duration (minutes)" value={s.limits.maxCallMinutes} onChange={set('limits', 'maxCallMinutes')} min={1} max={240} />
        </Card>

        <Card title="Guest access">
          <div className="flex items-center justify-between rounded-2xl bg-light px-4 py-3">
            <div>
              <p className="text-sm font-bold">Allow guest mode</p>
              <p className="text-xs text-ink/50">Let people practise without registering.</p>
            </div>
            <Toggle checked={s.guest.enabled} onChange={set('guest', 'enabled')} label="Guest access" />
          </div>
        </Card>

        <Card title="Maintenance mode">
          <div className="flex items-center justify-between rounded-2xl bg-light px-4 py-3">
            <div>
              <p className="text-sm font-bold">Enable maintenance mode</p>
              <p className="text-xs text-ink/50">Blocks the app and new calls. Admin console stays available.</p>
            </div>
            <Toggle checked={s.maintenance.enabled} onChange={set('maintenance', 'enabled')} label="Maintenance mode" />
          </div>
          {s.maintenance.enabled && (
            <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Users will see the message below after you save. Calls already in progress are not interrupted.
            </p>
          )}
          <Field label="Message shown to users">
            <input className="input" maxLength={200} value={s.maintenance.message} onChange={(e) => set('maintenance', 'message')(e.target.value)} />
          </Field>
        </Card>
      </div>
    </>
  );
}
