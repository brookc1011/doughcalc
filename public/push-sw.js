// Added to the app's service worker (vite.config.ts: workbox.importScripts).
// Shows a step reminder when the reminder server pushes one, and opens the batch when tapped.
/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Dough', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Dough';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.batchId ? `dough-${data.batchId}` : 'dough',
      renotify: true,
      data: { batchId: data.batchId || null },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const batchId = event.notification.data && event.notification.data.batchId;
  const url = batchId ? `/?batch=${encodeURIComponent(batchId)}` : '/';
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const win = wins[0];
      if (win) {
        await win.focus();
        win.postMessage({ type: 'open-batch', batchId });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
