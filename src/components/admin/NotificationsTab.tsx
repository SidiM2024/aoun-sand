import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { Bell, Send, Clock, Link as LinkIcon, Image as ImageIcon, Trash2, Calendar } from 'lucide-react';

export const NotificationsTab = ({ notifications, fetchDashboardData }: { notifications: any[], fetchDashboardData: () => void }) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload: any = {
        title,
        message,
      };

      // Try adding new columns, if it fails, it means schema is not updated.
      // But we should just send them if they exist in state.
      if (link) payload.link = link;
      if (mediaUrl) payload.media_url = mediaUrl;
      if (isScheduled && scheduledAt) {
        payload.scheduled_at = new Date(scheduledAt).toISOString();
      }

      const { error } = await supabase.from('notifications').insert([payload]);
      
      if (error) {
        throw error;
      }
      
      toast.success(isRTL ? 'تم إنشاء الإشعار بنجاح!' : 'Notification created successfully!');
      setTitle('');
      setMessage('');
      setLink('');
      setMediaUrl('');
      setIsScheduled(false);
      setScheduledAt('');
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف هذا الإشعار؟' : 'Are you sure you want to delete this notification?')) return;
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      fetchDashboardData();
    }
  };

  return (
    <motion.div key="notifications" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
      
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
          <Bell className="w-6 h-6 text-indigo-500" />
          {isRTL ? 'إرسال إشعار جديد' : 'Send New Notification'}
        </h3>
        
        <form onSubmit={handleSendNotification} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'عنوان الإشعار' : 'Title'}
              </label>
              <input 
                type="text" 
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder={isRTL ? 'أدخل عنوان الإشعار...' : 'Enter notification title...'}
              />
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'نص الإشعار' : 'Message'}
              </label>
              <textarea 
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all"
                placeholder={isRTL ? 'اكتب التفاصيل هنا...' : 'Write details here...'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <LinkIcon className="w-4 h-4" />
                {isRTL ? 'رابط مرفق (اختياري)' : 'Attached Link (Optional)'}
              </label>
              <input 
                type="url" 
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <ImageIcon className="w-4 h-4" />
                {isRTL ? 'رابط صورة (اختياري)' : 'Image URL (Optional)'}
              </label>
              <input 
                type="url" 
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="https://.../image.jpg"
              />
            </div>

            <div className="col-span-1 md:col-span-2 flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 bg-white border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {isRTL ? 'جدولة الإشعار' : 'Schedule Notification'}
                </span>
              </label>
              
              {isScheduled && (
                <input 
                  type="datetime-local" 
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button 
              type="submit" 
              disabled={isLoading}
              className="py-3 px-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {isRTL ? 'نشر الإشعار' : 'Publish Notification'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          {isRTL ? 'سجل الإشعارات' : 'Notifications History'}
        </h3>
        
        <div className="space-y-4">
          <AnimatePresence>
            {notifications.map((notif: any, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                key={notif.id} 
                className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900/50 hover:shadow-md transition-shadow relative group"
              >
                <button 
                  onClick={() => handleDelete(notif.id)}
                  className="absolute top-4 rtl:left-4 ltr:right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Bell className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{notif.title}</h4>
                    <p className="text-slate-600 dark:text-slate-400 mb-3 text-sm leading-relaxed">{notif.message}</p>
                    
                    {(notif.link || notif.media_url) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {notif.link && (
                          <a href={notif.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-medium hover:bg-blue-100 transition-colors">
                            <LinkIcon className="w-3.5 h-3.5" />
                            {isRTL ? 'رابط مرفق' : 'Attached Link'}
                          </a>
                        )}
                        {notif.media_url && (
                          <a href={notif.media_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg font-medium hover:bg-purple-100 transition-colors">
                            <ImageIcon className="w-3.5 h-3.5" />
                            {isRTL ? 'صورة مرفقة' : 'Attached Image'}
                          </a>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                      <span>{new Date(notif.created_at).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</span>
                      {notif.scheduled_at && new Date(notif.scheduled_at) > new Date() && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                          <Calendar className="w-3 h-3" />
                          {isRTL ? 'مجدول لـ:' : 'Scheduled for:'} {new Date(notif.scheduled_at).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {notifications.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">{isRTL ? 'لا توجد إشعارات سابقة' : 'No past notifications'}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
