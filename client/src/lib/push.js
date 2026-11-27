import { api } from './api';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const b64ToUint8 = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

/** Asks permission, subscribes this device to Web Push and registers it with the API. */
export async function enablePush(vapidPublicKey) {
  if (!pushSupported()) throw new Error('This browser does not support push notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings.');
  if (!vapidPublicKey) return { local: true }; // in-app/browser notifications only (server push not configured)
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapidPublicKey) });
  await api.post('/profile/push-subscription', sub.toJSON());
  return { local: false };
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api.delete('/profile/push-subscription', { data: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
