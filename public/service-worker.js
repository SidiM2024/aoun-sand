/* Retired service worker.
   Old versions of the site installed a service worker that cached images and fonts.
   This replacement removes those caches and unregisters itself, so every visitor
   always gets the latest version of the site straight from the server. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url).catch(() => {}));
  })());
});
