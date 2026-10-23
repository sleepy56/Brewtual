const CACHE = 'pair-habits-shell-v4';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/offline.html', '/app-icon.svg']))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('pair-habits-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
// Account pages and API responses are never cached on a shared device.
self.addEventListener('fetch', event => { if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html'))); });
