/* ============================================================
   service-worker.js — aoun-sand PWA
   Handles: caching, push notifications, notification clicks
   ============================================================ */

const CACHE_NAME = 'aoun-sand-v2';
const OFFLINE_PAGE = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install ──
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate ──
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch (Network-first for navigation, Cache-first for assets) ──
self.addEventListener('fetch', (evt) => {
  if (evt.request.mode === 'navigate') {
    evt.respondWith(
      fetch(evt.request).catch(() =>
        caches.match(OFFLINE_PAGE)
      )
    );
  } else {
    evt.respondWith(
      caches.match(evt.request).then((r) => r || fetch(evt.request))
    );
  }
});

// ── Push Notification ──
self.addEventListener('push', (evt) => {
  let payload = { title: 'إشعار من النظام', message: 'لديك إشعار جديد', link: '/', media_url: null };
  try { if (evt.data) payload = { ...payload, ...evt.data.json() }; } catch (_) {}

  const options = {
    body: payload.message,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    image: payload.media_url || undefined,
    data: { url: payload.link || '/' },
    dir: 'auto',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    silent: false,
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'close', title: 'إغلاق' },
    ],
  };

  evt.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// ── Notification Click ──
self.addEventListener('notificationclick', (evt) => {
  evt.notification.close();
  if (evt.action === 'close') return;

  const url = evt.notification.data?.url || '/';
  evt.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          client.focus();
          return;
        }
      }
      // Otherwise open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Background sync (optional future use) ──
self.addEventListener('sync', (evt) => {
  console.log('[SW] Background sync:', evt.tag);
});
