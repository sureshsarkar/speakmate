import { Link, Navigate } from 'react-router-dom';
import { BarChart3, Globe2, Headphones, Lock, Mic, PhoneCall, ShieldCheck, Sparkles, UserX, Users } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

const steps = [
  ['Tap Start Speaking', 'No scheduling, no profiles to browse.', Mic],
  ['Meet a random learner', 'We match you by English level and goals.', Users],
  ['Talk through an audio call', 'Voice only, straight from your browser.', Headphones],
  ['Track your progress', 'Minutes, streaks and weekly charts.', BarChart3],
];

const features = [
  [PhoneCall, 'Audio calls only', 'No camera, no video, no text chat. Just conversation.'],
  [UserX, 'No phone numbers', 'Partners see your display name, level and (optionally) country. Nothing else.'],
  [ShieldCheck, 'Safe by design', 'Report, block and end any call instantly. Moderators review every report.'],
  [Lock, 'Never recorded', 'Calls go peer to peer. We never record audio.'],
  [Sparkles, 'Learning helpers', 'Topics, conversation starters and useful phrases during the call.'],
  [Globe2, 'Practice with the world', 'Meet learners from every country at your own level.'],
];

export default function Landing() {
  const token = useAuthStore((s) => s.token);
  const config = useAppStore((s) => s.config);
  if (token) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-dvh bg-light pt-safe">
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/40 via-primary/15 to-light">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/40 blur-3xl" />
        <div className="mx-auto max-w-3xl px-5 pb-14 pt-6">
          <nav className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-ghost btn-sm">
                Sign in
              </Link>
              <Link to="/register" className="btn-dark btn-sm hidden sm:inline-flex">
                Sign up free
              </Link>
            </div>
          </nav>

          <div className="mt-14 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-bold text-secondary shadow-card">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Audio-only English practice
            </span>
            <h1 className="mx-auto mt-5 max-w-xl text-4xl font-extrabold leading-[1.1] tracking-tight text-secondary sm:text-5xl">
              Don't learn English alone.
              <span className="block text-ink">Speak English with the world.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-ink/65">
              Tap one button and talk with a real learner at your level through a private audio call. Free, safe and no phone number required.
            </p>
            <div className="mx-auto mt-8 flex max-w-xs flex-col gap-3">
              <Link to="/guest" className="btn-primary !py-4 text-base">
                <Mic className="h-5 w-5" /> START SPEAKING
              </Link>
              <Link to="/register" className="btn-ghost">
                Create free account
              </Link>
            </div>
            <p className="mt-3 text-xs text-ink/50">Works in your browser. Install it like an app.</p>
          </div>

          <div className="mx-auto mt-12 flex max-w-xs items-center justify-center gap-1.5">
            {Array.from({ length: 23 }).map((_, i) => (
              <i
                key={i}
                className="block w-1.5 rounded-full bg-secondary/70"
                style={{ height: 10 + Math.abs(Math.sin(i * 0.75)) * 38, animation: `dots 1.4s ${i * 0.07}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="text-center text-2xl font-extrabold text-secondary">How it works</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {steps.map(([t, d, Icon], i) => (
            <div key={t} className="card flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/25 text-secondary">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-extrabold text-secondary">
                  {i + 1}. {t}
                </p>
                <p className="muted mt-0.5">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-2xl font-extrabold text-secondary">Built for privacy and confidence</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {features.map(([Icon, t, d]) => (
              <div key={t} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-secondary" />
                <div>
                  <p className="font-bold">{t}</p>
                  <p className="muted">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-12 text-center">
        <h2 className="text-2xl font-extrabold text-secondary">Ready for your first conversation?</h2>
        <Link to="/guest" className="btn-primary mx-auto mt-5 max-w-xs !py-4">
          <Mic className="h-5 w-5" /> START SPEAKING
        </Link>
      </section>

      <footer className="border-t border-secondary/10 py-6 pb-safe text-center text-xs text-ink/50">
        <Link to="/guidelines" className="font-semibold hover:text-secondary">
          Community Guidelines
        </Link>
        {' · '}
        <Link to="/help" className="font-semibold hover:text-secondary">
          Help
        </Link>
        {' · '}
        <Link to="/admin/login" className="font-semibold hover:text-secondary">
          Admin
        </Link>
        <p className="mt-2">&copy; {new Date().getFullYear()} {config?.appName || 'SpeakMate'}</p>
      </footer>
    </div>
  );
}
