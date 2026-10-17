/* Service Worker: notificaciones push + caché de respaldo (red primero) */
const CACHE = 'familia-v6';
const ASSETS = ['./', './index.html', './app.js', './styles.css', './config.js', './manifest.webmanifest', './icon.svg', './icon-192.png'];
const ICON = new URL('./icon-192.png', self.registration.scope).href;
const appUrl = (u) => {
  if (!u || u === '/' || u === '.') return self.registration.scope;
  return new URL(u, self.registration.scope).href;
};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // CDN/externos: sin tocar

  e.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return (await caches.match(req)) || (await caches.match('./index.html')) || (await caches.match(self.registration.scope));
    }
  })());
});

self.addEventListener('push', (e) => {
  let data = { title: 'Familia', body: 'Tienes una notificación', url: './' };
  try { data = { ...data, ...e.data.json() }; } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: ICON,
    badge: ICON,
    data: { url: appUrl(data.url) }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = appUrl(e.notification.data?.url);
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return clients.openWindow(url);
    })
  );
});
