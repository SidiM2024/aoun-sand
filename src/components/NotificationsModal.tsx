import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { requestForToken } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export const NotificationsModal = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Only show if user is logged in and hasn't dismissed it yet
    if (user && !localStorage.getItem('notifications_prompt_dismissed')) {
      // Small delay to make it feel natural
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleEnable = async () => {
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const token = await requestForToken();
          if (token && user) {
            // Save token securely to Supabase
            const { error } = await supabase
              .from('users')
              .update({ fcm_token: token })
              .eq('id', user.id);
              
            if (error) throw error;
            
            toast.success(isRTL ? 'تم تفعيل الإشعارات بنجاح' : 'Notifications enabled successfully');
          }
          localStorage.setItem('notifications_prompt_dismissed', 'true');
          setIsOpen(false);
        }
      }
    } catch (error: any) {
      console.error('Error enabling notifications:', error);
      toast.error(error.message || 'Failed to enable notifications');
      setIsOpen(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('notifications_prompt_dismissed', 'true');
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl" />

            <button 
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/50 dark:to-blue-900/50 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                <Bell className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>

              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
                {isRTL ? 'تفعيل الإشعارات' : 'Enable Notifications'}
              </h3>
              
              <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
                {isRTL 
                  ? 'ابق على اطلاع دائم بآخر أخبارنا، التصويتات الجديدة، والفعاليات المهمة. لن نرسل لك رسائل مزعجة.' 
                  : 'Stay updated with our latest news, new polls, and important events. We won\'t spam you.'}
              </p>

              <div className="flex flex-col sm:flex-row w-full gap-3">
                <button 
                  onClick={handleEnable}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/30 transform transition-all active:scale-95"
                >
                  {isRTL ? 'تفعيل الآن' : 'Enable Now'}
                </button>
                <button 
                  onClick={handleDismiss}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition-colors"
                >
                  {isRTL ? 'ليس الآن' : 'Not Now'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
