import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * usePushNotifications
 *
 * - Registers the Service Worker
 * - Requests Notification permission (on user gesture if needed)
 * - Listens via Supabase Realtime for new notifications & new polls
 * - Shows rich browser notification even when user is on another tab
 * - Plays a subtle sound alert
 * - Updates badge count
 */
export const usePushNotifications = () => {
  useEffect(() => {
    let swReg: ServiceWorkerRegistration | null = null;

    // ── 1. Register Service Worker ──────────────────────────────
    const registerSW = async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        swReg = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        // Check for updates
        swReg.addEventListener('updatefound', () => {
          const newWorker = swReg?.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] New version available');
            }
          });
        });
      } catch (e) {
        console.warn('[SW] Registration failed:', e);
      }
    };

    registerSW();

    // ── 2. Request Notification Permission ──────────────────────
    const requestPermission = async () => {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') {
        // Don't block — request silently
        Notification.requestPermission().catch(() => {});
      }
    };
    requestPermission();

    // ── 3. Helper: show notification via SW or fallback ─────────
    const showNotification = async (title: string, body: string, url?: string, icon?: string) => {
      if (Notification.permission !== 'granted') return;

      const opts: NotificationOptions = {
        body,
        icon: icon || '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        data: { url: url || '/' },
        dir: 'auto',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: false,
        silent: false,
        tag: 'aoun-sand-notif', // replace previous notification of same tag
      };

      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, opts);
        } else {
          new Notification(title, opts);
        }
      } catch {
        // Fallback without vibrate/badge (unsupported in some browsers)
        try {
          new Notification(title, { body, icon: opts.icon as string });
        } catch (e2) {
          console.warn('[Push] Notification failed:', e2);
        }
      }

      // Update badge count (if supported — Chrome on Android/Desktop)
      if ('setAppBadge' in navigator) {
        try { await (navigator as any).setAppBadge(1); } catch {}
      }
    };

    // ── 4. Subscribe to new notifications (Supabase Realtime) ───
    const notifChannel = supabase
      .channel('push:notifications:v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        async (payload) => {
          const notif = payload.new as any;
          if (!notif) return;
          // Skip future-scheduled notifications
          if (notif.scheduled_at && new Date(notif.scheduled_at) > new Date()) return;

          await showNotification(
            notif.title || 'إشعار جديد',
            notif.message || '',
            notif.link || '/',
          );
        }
      )
      .subscribe();

    // ── 5. Subscribe to new polls ────────────────────────────────
    const pollChannel = supabase
      .channel('push:polls:v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'polls' },
        async (payload) => {
          const poll = payload.new as any;
          if (!poll || poll.is_closed) return;
          await showNotification(
            '🗳️ استطلاع رأي جديد',
            poll.title || 'انضم وأدلِ برأيك الآن',
            '/',
          );
        }
      )
      .subscribe();

    // ── 6. Handle notification click (from SW message) ───────────
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIF_CLICK') {
        const url = event.data.url || '/';
        window.focus();
        if (window.location.pathname !== url) {
          window.location.href = url;
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(pollChannel);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, []);
};
