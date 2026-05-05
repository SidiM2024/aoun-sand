import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * usePushNotifications
 * 
 * - Registers the Service Worker
 * - Requests Notification permission
 * - Listens via Supabase Realtime for new notifications
 * - Shows a browser notification even when user is on another tab
 */
export const usePushNotifications = () => {
  useEffect(() => {
    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').then((reg) => {
        console.log('[SW] Registered:', reg.scope);
      }).catch((e) => {
        console.warn('[SW] Registration failed:', e);
      });
    }

    // 2. Request notification permission
    const requestPermission = async () => {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    };
    requestPermission();

    // 3. Subscribe to new notifications via Supabase Realtime
    const channel = supabase
      .channel('push:notifications:v1')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        async (payload) => {
          const notif = payload.new as any;
          if (!notif) return;

          // Show browser notification if permission granted
          if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
            try {
              const reg = await navigator.serviceWorker.ready;
              await reg.showNotification(notif.title || 'إشعار جديد', {
                body: notif.message || '',
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-72.png',
                data: { url: notif.link || '/' },
                dir: 'auto',
                vibrate: [200, 100, 200],
              });
            } catch (e) {
              // Fallback: use basic Notification API
              new Notification(notif.title || 'إشعار جديد', {
                body: notif.message || '',
                icon: '/icons/icon-192.png',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};
