/* eslint-disable no-restricted-globals */

// This service worker can be customized!
// See https://developers.google.com/web/tools/workbox/modules
// for the list of available Workbox modules, or add any other
// code you'd like.
// You can also import Workbox here if you want to use it
// importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

const CACHE_NAME = 'aoun-sand-v1';
const DATA_CACHE_NAME = 'data-cache-v1';

const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
    '/icons/icon-72.png',
    '/icons/icon-96.png',
    '/icons/icon-128.png',
    '/icons/icon-144.png',
    '/icons/icon-152.png',
    '/icons/icon-192.png',
    '/icons/icon-256.png',
    '/icons/icon-384.png',
    '/icons/icon-512.png',
];

// Install Service Worker
self.addEventListener('install', (evt) => {
    console.log('[ServiceWorker] Install');
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Pre-caching offline page');
            return cache.addAll(FILES_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', (evt) => {
    console.log('[ServiceWorker] Activate');
    evt.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
                        console.log('[ServiceWorker] Removing old cache', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (evt) => {
    if (evt.request.mode !== 'navigate') {
        // Not a page navigation, use cache-first for assets
        evt.respondWith(
            caches.match(evt.request).then((response) => {
                return response || fetch(evt.request);
            })
        );
        return;
    }

    // Navigation request - Network First, then Cache, then Offline Page
    evt.respondWith(
        fetch(evt.request)
            .catch(() => {
                return caches.open(CACHE_NAME)
                    .then((cache) => {
                        return cache.match(evt.request);
                    });
            })
            .catch(() => {
                return caches.match('/offline.html');
            })
    );
});

// Push Notification Event
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.message || 'لديك إشعار جديد',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            data: {
                url: data.link || '/',
                id: data.id
            },
            dir: 'rtl',
            vibrate: [200, 100, 200]
        };
        
        if (data.media_url) {
            options.image = data.media_url;
        }

        event.waitUntil(
            self.registration.showNotification(data.title || 'إشعار من النظام', options)
        );
    }
});

// Notification Click Event
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.notification.data && event.notification.data.url) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    } else {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});
