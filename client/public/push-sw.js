/* Imported by the Workbox-generated service worker (see vite.config.js). Handles Web Push. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'SpeakMate', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'SpeakMate';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || 'speakmate',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/home' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/home';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
