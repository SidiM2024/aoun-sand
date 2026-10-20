import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X } from 'lucide-react';

// Notifications list panel (moved unchanged from Header.tsx).
export const NotificationPanel = ({ isNotifOpen, setIsNotifOpen, notifications, isRTL }: {
  isNotifOpen: boolean;
  setIsNotifOpen: (open: boolean) => void;
   
  notifications: any[];
  isRTL: boolean;
}) => (
            <AnimatePresence>
              {isNotifOpen && (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                  onClick={() => setIsNotifOpen(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 20 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 340 }}
                    onClick={e => e.stopPropagation()}
                    className="w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden rounded-3xl shadow-2xl"
                    style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #1e3a5f 100%)' }}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    {/* Decorative blobs */}
                    <div className="absolute top-0 start-0 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 end-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                    {/* Panel header */}
                    <div className="relative z-10 px-6 pt-6 pb-5 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                          <Bell className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-white">
                            {isRTL ? 'الإشعارات' : 'Notifications'}
                          </h3>
                          <p className="text-xs text-indigo-200/70 font-medium">
                            {isRTL ? `${notifications.length} إشعار` : `${notifications.length} notifications`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsNotifOpen(false)}
                        className="w-9 h-9 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Scrollable content */}
                    <div className="relative z-10 overflow-y-auto flex-1 p-5 space-y-3">
                      {notifications.length === 0 ? (
                        <div className="py-12 text-center flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center border border-white/20">
                            <Bell className="w-8 h-8 text-white/50" />
                          </div>
                          <div>
                            <p className="text-white/70 font-bold text-base">
                              {isRTL ? 'لا توجد إشعارات' : 'No notifications yet'}
                            </p>
                            <p className="text-white/40 text-xs mt-1">
                              {isRTL ? 'ستظهر الإشعارات هنا فور نشرها' : 'Notifications will appear here when published'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        notifications.map((notif, idx) => (
                          <motion.div
                            key={notif.id}
                            initial={{ opacity: 0, x: isRTL ? 16 : -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 p-4 hover:bg-white/15 transition-all"
                          >
                            <div className="flex gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shrink-0 shadow-lg">
                                <Bell className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white text-sm leading-snug mb-1">{notif.title}</h4>
                                <p className="text-sm text-white/60 leading-relaxed">{notif.message}</p>
                                {notif.link && (
                                  <a href={notif.link} target="_blank" rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-300 hover:text-indigo-200 transition-colors">
                                    {isRTL ? 'عرض الرابط ↗' : 'View Link ↗'}
                                  </a>
                                )}
                                {notif.media_url && (
                                  <div className="mt-2 rounded-xl overflow-hidden border border-white/20">
                                    {notif.media_type === 'video'
                                      ? <video src={notif.media_url} controls className="w-full max-h-32 object-cover" />
                                      : <img src={notif.media_url} alt="media" className="w-full max-h-32 object-cover" />}
                                  </div>
                                )}
                                <span className="text-[11px] text-white/35 mt-2 block font-medium">
                                  {new Date(notif.created_at).toLocaleDateString(
                                    isRTL ? 'ar-SA' : 'en-US',
                                    { weekday: 'long', month: 'short', day: 'numeric' }
                                  )}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    <div className="relative z-10 px-5 py-4 border-t border-white/10 shrink-0">
                      <button
                        onClick={() => setIsNotifOpen(false)}
                        className="w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-all border border-white/15"
                      >
                        {isRTL ? 'إغلاق' : 'Close'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
);
