import { useState } from 'react';
import { CheckCircle2, Download, MoreVertical, PlusSquare, Share, Smartphone } from 'lucide-react';
import { Sheet } from './ui';
import { isIos, promptInstall, usePwa } from '../lib/pwa';
import { useAppStore } from '../store/appStore';

/** "Install app" card for the Profile page. Always does something useful. */
export default function InstallApp() {
  const { canPrompt, installed } = usePwa();
  const toast = useAppStore((s) => s.toast);
  const appName = useAppStore((s) => s.config?.appName) || 'SpeakMate';
  const [help, setHelp] = useState(false);

  if (installed) {
    return (
      <section className="card flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-secondary" />
        <div>
          <p className="font-extrabold text-secondary">{appName} is installed</p>
          <p className="text-xs text-ink/55">You are using the installed app.</p>
        </div>
      </section>
    );
  }

  const install = async () => {
    if (!canPrompt) return setHelp(true);
    const outcome = await promptInstall();
    if (outcome === 'accepted') toast(`${appName} is being installed...`, 'success');
  };

  return (
    <>
      <section className="card flex items-center gap-3 !bg-secondary text-white">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-secondary">
          <Smartphone className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">Get the {appName} app</p>
          <p className="text-xs text-white/65">Install it on your phone or computer for one-tap access.</p>
        </div>
        <button onClick={install} className="btn-primary btn-sm shrink-0">
          <Download className="h-4 w-4" /> Install
        </button>
      </section>

      <Sheet open={help} onClose={() => setHelp(false)} title={`Install ${appName}`}>
        {isIos() ? (
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Share className="mt-0.5 h-5 w-5 shrink-0 text-secondary" /> Open this page in <b>Safari</b> and tap the <b>Share</b> button.
            </li>
            <li className="flex items-start gap-3">
              <PlusSquare className="mt-0.5 h-5 w-5 shrink-0 text-secondary" /> Choose <b>Add to Home Screen</b>.
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary" /> Tap <b>Add</b>. {appName} appears on your home screen.
            </li>
          </ol>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-ink/70">Your browser did not offer the install dialog yet. You can install from the browser menu:</p>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <MoreVertical className="mt-0.5 h-5 w-5 shrink-0 text-secondary" /> <span><b>Chrome / Edge:</b> open the <b>⋮</b> menu, then <b>Install {appName}</b> (or the install icon in the address bar on desktop).</span>
              </li>
              <li className="flex items-start gap-3">
                <PlusSquare className="mt-0.5 h-5 w-5 shrink-0 text-secondary" /> <span><b>Android:</b> menu, then <b>Add to Home screen</b> / <b>Install app</b>.</span>
              </li>
            </ol>
            <p className="rounded-2xl bg-light p-3 text-xs text-ink/55">Installing requires HTTPS and a supported browser. Firefox on desktop does not support installing web apps.</p>
          </div>
        )}
      </Sheet>
    </>
  );
}
