import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, ExternalLink, LifeBuoy, Mail, Mic, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/Shared';
import { Skeleton, cx } from '../components/ui';
import { useFetch } from '../hooks';
import { api } from '../lib/api';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';

export function Help() {
  const faqs = useFetch(() => api.get('/content/faqs').then((r) => r.data.faqs), []);
  const resources = useFetch(() => api.get('/content/resources').then((r) => r.data.resources), []);
  const email = useAppStore((s) => s.config?.supportEmail);
  const loggedIn = useAuthStore((s) => Boolean(s.token));
  const [open, setOpen] = useState(null);

  return (
    <div className={cx('mx-auto w-full max-w-md px-4 pt-4 animate-page-in', loggedIn ? 'pb-28' : 'pb-10')}>
      <PageHeader title="Help and Support" back={loggedIn ? '/profile' : '/'} />

      <section className="card mb-5 space-y-3">
        <h2 className="flex items-center gap-2 font-extrabold text-secondary">
          <Mic className="h-5 w-5" /> Microphone troubleshooting
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink/75">
          <li>Allow microphone access when your browser asks. Use the lock icon next to the address bar to change it later.</li>
          <li>Close other apps that may be using the microphone (video meetings, voice recorders).</li>
          <li>Use headphones to avoid echo. Make sure the right input device is selected in your system settings.</li>
          <li>Calls need HTTPS (or localhost) and a recent version of Chrome, Edge, Firefox or Safari.</li>
          <li>If audio connects but you cannot hear your partner, tap "Tap to hear your partner" and check your device volume.</li>
        </ul>
      </section>

      <h2 className="mb-2.5 text-lg font-extrabold text-secondary">Frequently asked questions</h2>
      {faqs.loading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="space-y-2">
          {faqs.data?.map((f) => (
            <div key={f.id} className="card !p-0">
              <button className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left" onClick={() => setOpen(open === f.id ? null : f.id)} aria-expanded={open === f.id}>
                <span className="text-sm font-bold">{f.question}</span>
                <ChevronDown className={cx('h-5 w-5 shrink-0 text-secondary transition', open === f.id && 'rotate-180')} />
              </button>
              {open === f.id && <p className="px-4 pb-4 text-sm text-ink/70">{f.answer}</p>}
            </div>
          ))}
        </div>
      )}

      {resources.data?.length > 0 && (
        <>
          <h2 className="mb-2.5 mt-6 flex items-center gap-2 text-lg font-extrabold text-secondary">
            <BookOpen className="h-5 w-5" /> Learning resources
          </h2>
          <div className="space-y-2">
            {resources.data.map((r) => (
              <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 !p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">{r.title}</p>
                  <p className="text-xs text-ink/55">{r.description}</p>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-secondary" />
              </a>
            ))}
          </div>
        </>
      )}

      <section className="card mt-6 space-y-3 !bg-secondary text-white">
        <h2 className="flex items-center gap-2 font-extrabold">
          <LifeBuoy className="h-5 w-5 text-primary" /> Still need help?
        </h2>
        <p className="text-sm text-white/75">Send us a message and our support team will reply by email.</p>
        {email && (
          <a href={`mailto:${email}?subject=SpeakMate%20support`} className="btn-primary w-full">
            <Mail className="h-5 w-5" /> Email support
          </a>
        )}
        <Link to="/guidelines" className="flex items-center justify-center gap-1.5 text-xs font-bold text-white/70">
          <ShieldCheck className="h-4 w-4" /> Read the community guidelines
        </Link>
      </section>
    </div>
  );
}

const RULES = [
  ['Be respectful and kind', 'Everyone here is learning. Be patient, encourage your partner and never mock accents or mistakes.'],
  ['No harassment, hate or abuse', 'Offensive language, bullying, discrimination, threats and sexual content are not allowed.'],
  ['Keep it private', 'Never share or ask for phone numbers, emails, social accounts, addresses or financial information.'],
  ['No spam or selling', 'Do not advertise, recruit, promote products or ask for money.'],
  ['Audio only, no recording', 'Do not record calls or share what your partner said. SpeakMate never records calls.'],
  ['Be yourself', 'No impersonation or fake identities. Users under 13 may not use SpeakMate.'],
  ['Use the safety tools', 'End the call at any time. Report or block anyone who makes you uncomfortable.'],
];

export function Guidelines() {
  const loggedIn = useAuthStore((s) => Boolean(s.token));
  return (
    <div className={cx('mx-auto w-full max-w-md px-4 pt-4 animate-page-in', loggedIn ? 'pb-28' : 'pb-10')}>
      <PageHeader title="Community Guidelines" back={loggedIn ? '/profile' : '/'} />
      <p className="muted mb-5">SpeakMate works because people feel safe and welcome. By using the app you agree to these rules.</p>
      <ol className="space-y-3">
        {RULES.map(([t, d], i) => (
          <li key={t} className="card flex gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/25 text-sm font-extrabold text-secondary">{i + 1}</span>
            <div>
              <p className="font-extrabold text-secondary">{t}</p>
              <p className="mt-0.5 text-sm text-ink/65">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="card mt-5 !bg-amber-50 text-sm text-amber-900">
        Breaking these rules can lead to a warning, suspension or a permanent ban. Moderators review every report. Calls are never recorded, so reports rely on the details you provide and call metadata.
      </p>
    </div>
  );
}

export default Help;
