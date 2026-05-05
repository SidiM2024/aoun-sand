import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  Bell, BellOff, X, ChevronLeft, ChevronRight,
  ExternalLink, Image as ImageIcon, Video as VideoIcon,
  Sparkles, Clock, CheckCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface Notification {
  id: string;
  title: string;
  message: string;
  link?: string;
  media_url?: string;
  created_at: string;
  scheduled_at?: string;
}

/* ── Media Preview ── */
const MediaPreview = ({ url }: { url: string }) => {
  const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.includes('video');
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i.test(url) || url.includes('image');

  if (isVideo) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden bg-black aspect-video mt-4">
        <video
          src={url}
          controls
          preload="metadata"
          className="w-full h-full object-contain"
          playsInline
        />
      </div>
    );
  }

  if (isImage || (!isVideo && url)) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden mt-4 bg-slate-100 dark:bg-slate-700 shadow-inner">
        <img
          src={url}
          alt="notification media"
          className="w-full object-cover rounded-2xl max-h-64"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    );
  }

  return null;
};

/* ── Single Notification Card (used inside the modal) ── */
const NotifCard = ({
  notif,
  index,
  total,
  isRTL,
  language,
  onClose,
}: {
  notif: Notification;
  index: number;
  total: number;
  isRTL: boolean;
  language: string;
  onClose: () => void;
}) => {
  const mediaType = notif.media_url
    ? /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(notif.media_url) ? 'video' : 'image'
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800/50">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
            {isRTL ? 'إشعار رسمي' : 'Official Notice'}
          </span>
        </div>
        {total > 1 && (
          <span className="text-xs font-bold text-slate-400 tabular-nums">
            {index + 1} / {total}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-xl font-black text-slate-800 dark:text-white mb-3 leading-snug">
        {notif.title}
      </h3>

      {/* Message */}
      <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed flex-1">
        {notif.message}
      </p>

      {/* Media */}
      {notif.media_url && (
        <MediaPreview url={notif.media_url} />
      )}

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span>
            {new Date(notif.created_at).toLocaleDateString(
              isRTL ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-US',
              { year: 'numeric', month: 'short', day: 'numeric' }
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {notif.media_url && (
            <a
              href={notif.media_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition-colors"
            >
              {mediaType === 'video'
                ? <VideoIcon className="w-3.5 h-3.5" />
                : <ImageIcon className="w-3.5 h-3.5" />}
              {isRTL ? 'فتح الوسيط' : 'Open Media'}
            </a>
          )}
          {notif.link && (
            <a
              href={notif.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {isRTL ? 'اقرأ المزيد' : 'Read More'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════
   Main Notifications Modal Component
   ══════════════════════════════════════════ */
export const NotificationsModal = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [direction, setDirection] = useState(0); // -1 prev, 1 next

  /* Swipe support */
  const dragX = useMotionValue(0);
  const opacity = useTransform(dragX, [-150, 0, 150], [0.5, 1, 0.5]);

  /* ── Load seen IDs from localStorage ── */
  const storageKey = `notif_seen_${user?.id || 'guest'}`;
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setSeenIds(new Set(stored));
    } catch {
      setSeenIds(new Set());
    }
  }, [user?.id]);

  /* ── Fetch notifications ── */
  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .is('scheduled_at', null) // only unscheduled (published immediately)
      .order('created_at', { ascending: false })
      .limit(20);

    // Also get scheduled ones that are past their time
    const { data: scheduled } = await supabase
      .from('notifications')
      .select('*')
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    const all = [...(data || []), ...(scheduled || [])];
    // Sort by created_at desc
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return all as Notification[];
  }, []);

  /* ── Initial load + real-time subscription ── */
  useEffect(() => {
    if (!user) return; // only for logged-in users

    const load = async () => {
      const notifs = await fetchNotifications();
      setNotifications(notifs);

      // Check if there are any unseen notifications
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[];
      const unseen = notifs.filter(n => !stored.includes(n.id));
      if (unseen.length > 0) {
        // Delay slightly for a natural feel
        setTimeout(() => setIsOpen(true), 1500);
      }
    };

    load();

    // Real-time subscription
    const ch = supabase.channel('notif-modal:v3')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        async (payload) => {
          const newNotif = payload.new as Notification;
          // Check if it's scheduled for the future
          if (newNotif.scheduled_at && new Date(newNotif.scheduled_at) > new Date()) return;

          setNotifications(prev => [newNotif, ...prev]);
          setCurrentIndex(0);
          setIsOpen(true);
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotifications(prev => prev.filter(n => n.id !== (payload.old as any).id));
        })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, fetchNotifications, storageKey]);

  /* ── Mark all as seen on close ── */
  const handleClose = useCallback(() => {
    setIsOpen(false);
    const allIds = notifications.map(n => n.id);
    localStorage.setItem(storageKey, JSON.stringify(allIds));
    setSeenIds(new Set(allIds));
  }, [notifications, storageKey]);

  /* ── Navigation ── */
  const goNext = useCallback(() => {
    if (currentIndex < notifications.length - 1) {
      setDirection(1);
      setCurrentIndex(i => i + 1);
    } else {
      handleClose();
    }
  }, [currentIndex, notifications.length, handleClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(i => i - 1);
    }
  }, [currentIndex]);

  /* ── Keyboard support ── */
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight') isRTL ? goPrev() : goNext();
      if (e.key === 'ArrowLeft') isRTL ? goNext() : goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleClose, goNext, goPrev, isRTL]);

  /* ── Swipe drag end ── */
  const handleDragEnd = (_: any, info: any) => {
    const threshold = 80;
    if (info.offset.x < -threshold) {
      isRTL ? goPrev() : goNext();
    } else if (info.offset.x > threshold) {
      isRTL ? goNext() : goPrev();
    }
    dragX.set(0);
  };

  /* Don't render if no notifications or user not logged in */
  if (!user || notifications.length === 0) return null;

  const current = notifications[currentIndex];
  const isLast = currentIndex === notifications.length - 1;
  const unseenCount = notifications.filter(n => !seenIds.has(n.id)).length;

  /* Slide variants */
  const slideVariants = {
    enter: (d: number) => ({
      x: d > 0 ? (isRTL ? -60 : 60) : (isRTL ? 60 : -60),
      opacity: 0,
      scale: 0.96,
    }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({
      x: d > 0 ? (isRTL ? 60 : -60) : (isRTL ? -60 : 60),
      opacity: 0,
      scale: 0.96,
    }),
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden
          />

          {/* ── Modal ── */}
          <div
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
            dir={isRTL ? 'rtl' : 'ltr'}
            role="dialog"
            aria-modal
            aria-label={isRTL ? 'الإشعارات' : 'Notifications'}
          >
            <motion.div
              key="notif-modal"
              initial={{ opacity: 0, scale: 0.88, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 360 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_32px_80px_-12px_rgba(0,0,0,0.35)] overflow-hidden border border-white/80 dark:border-slate-700/60"
              onClick={e => e.stopPropagation()}
            >
              {/* Top gradient bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500" />

              {/* Background decorations */}
              <div className="absolute -top-20 -end-20 w-48 h-48 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -start-16 w-40 h-40 rounded-full bg-teal-500/5 blur-2xl pointer-events-none" />

              {/* ── Header ── */}
              <div className="relative z-10 flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-md shadow-indigo-500/25">
                      <Bell className="w-5 h-5 text-white" />
                    </div>
                    {unseenCount > 0 && (
                      <span className="absolute -top-1 -end-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm">
                        {unseenCount > 9 ? '9+' : unseenCount}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="font-black text-slate-800 dark:text-white text-base leading-tight">
                      {isRTL ? 'الإشعارات' : 'Notifications'}
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">
                      {isRTL
                        ? `${notifications.length} إشعار`
                        : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>

                {/* Close button */}
                <button
                  id="notif-close-btn"
                  onClick={handleClose}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                </button>
              </div>

              {/* ── Notification Content (swipeable) ── */}
              <div className="relative px-6 py-5 min-h-[200px] overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={current.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', damping: 32, stiffness: 380, duration: 0.25 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.12}
                    onDragEnd={handleDragEnd}
                    style={{ opacity }}
                    className="cursor-grab active:cursor-grabbing select-none"
                  >
                    <NotifCard
                      notif={current}
                      index={currentIndex}
                      total={notifications.length}
                      isRTL={isRTL}
                      language={language}
                      onClose={handleClose}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* ── Dot indicators ── */}
              {notifications.length > 1 && (
                <div className="flex justify-center gap-1.5 pb-4 px-6">
                  {notifications.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); }}
                      className={`transition-all duration-300 rounded-full ${
                        i === currentIndex
                          ? 'w-6 h-2 bg-indigo-500'
                          : 'w-2 h-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'
                      }`}
                      aria-label={`Go to notification ${i + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* ── Navigation Footer ── */}
              <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-2">
                {/* Prev button */}
                {notifications.length > 1 ? (
                  <button
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    {isRTL ? 'السابق' : 'Prev'}
                  </button>
                ) : (
                  <div />
                )}

                {/* Dismiss / Next */}
                {notifications.length > 1 ? (
                  <button
                    onClick={goNext}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                      isLast
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-500/25 active:scale-95'
                        : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                    }`}
                  >
                    {isLast ? (
                      <>
                        <CheckCheck className="w-4 h-4" />
                        {isRTL ? 'تم القراءة' : 'Done'}
                      </>
                    ) : (
                      <>
                        {isRTL ? 'التالي' : 'Next'}
                        {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleClose}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-500/25 active:scale-95 transition-all"
                  >
                    <CheckCheck className="w-4 h-4" />
                    {isRTL ? 'حسناً، شكراً' : 'Got it, Thanks'}
                  </button>
                )}
              </div>

              {/* Swipe hint */}
              {notifications.length > 1 && (
                <p className="text-center text-[11px] text-slate-300 dark:text-slate-600 pb-4 font-medium select-none">
                  {isRTL ? '← اسحب للتنقل بين الإشعارات →' : '← Swipe to navigate →'}
                </p>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
