import { create } from 'zustand';

/**
 * PWA install state. Chromium browsers fire `beforeinstallprompt`; we keep the event
 * so the Profile page can trigger the native install dialog from a button.
 * Safari (iOS) has no such event, so we show "Add to Home Screen" steps instead.
 */
let deferred = null;

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const usePwa = create((set) => ({
  canPrompt: false,
  installed: typeof window !== 'undefined' ? isStandalone() : false,
}));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    usePwa.setState({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    usePwa.setState({ canPrompt: false, installed: true });
  });
}

/** Shows the browser's install dialog. Returns 'accepted' | 'dismissed' | 'unavailable'. */
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  usePwa.setState({ canPrompt: false });
  return outcome;
}
