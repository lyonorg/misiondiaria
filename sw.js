/* Misión Diaria · service worker v4 */
const CACHE = 'md-v4.3.2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/badge-72.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Red primero para la página (así llegan las actualizaciones), caché si no hay internet
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // API de Supabase y GitHub: siempre red
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })));
});

// Push: siempre hay que mostrar una notificación (iOS revoca el permiso si no)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Misión Diaria', body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'Misión Diaria';
  const opts = {
    body: d.body || '', tag: d.tag || 'md', renotify: true,
    icon: './icons/icon-192.png', badge: './icons/badge-72.png',
    data: { url: d.url || './' }, timestamp: Date.now(),
  };
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, opts),
    (typeof d.badge === 'number' && self.navigator.setAppBadge) ? (d.badge ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge()).catch(() => {}) : Promise.resolve(),
  ]));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.registration.scope);
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) {
      if (c.url.startsWith(self.registration.scope)) { await c.focus(); c.postMessage({ tipo: 'nav', hash: target.hash }); return; }
    }
    await self.clients.openWindow(target.href);
  })());
});
