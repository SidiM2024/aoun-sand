import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { Vote, Trash2, Calendar, Power, BarChart3, Users, PlusCircle } from 'lucide-react';

export const PollsTab = ({ polls, fetchDashboardData }: { polls: any[], fetchDashboardData: () => void }) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [isLoading, setIsLoading] = useState(false);
  const [pollTitle, setPollTitle] = useState('');
  const [pollDesc, setPollDesc] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [expiresAt, setExpiresAt] = useState('');

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = pollOptions.filter(o => o.trim() !== '');
    if (validOptions.length < 2) {
      toast.error(isRTL ? 'أضف خيارين على الأقل' : 'Add at least 2 options');
      return;
    }

    setIsLoading(true);
    const payload: any = { title: pollTitle, description: pollDesc };
    if (expiresAt) {
      payload.expires_at = new Date(expiresAt).toISOString();
    }

    const { data: newPoll, error: pollError } = await supabase
      .from('polls')
      .insert([payload])
      .select()
      .single();

    if (pollError) {
      toast.error(pollError.message);
      setIsLoading(false);
      return;
    }

    const optionsToInsert = validOptions.map(opt => ({
      poll_id: newPoll.id,
      option_text: opt
    }));

    const { error: optionsError } = await supabase
      .from('poll_options')
      .insert(optionsToInsert);

    if (optionsError) {
      toast.error(optionsError.message);
    } else {
      toast.success(isRTL ? 'تم إنشاء التصويت بنجاح!' : 'Poll created successfully!');
      setPollTitle('');
      setPollDesc('');
      setPollOptions(['', '']);
      setExpiresAt('');
      fetchDashboardData();
    }
    setIsLoading(false);
  };

  const handleDeletePoll = async (id: string) => {
    if (!window.confirm(isRTL ? 'تأكيد الحذف؟' : 'Confirm delete?')) return;
    const { error } = await supabase.from('polls').delete().eq('id', id);
    if (!error) {
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      fetchDashboardData();
    } else {
      toast.error(error.message);
    }
  };

  const handleToggleClose = async (id: string, currentStatus: boolean) => {
    // Need to handle schema issues if `is_closed` doesn't exist yet
    const { error } = await supabase.from('polls').update({ is_closed: !currentStatus }).eq('id', id);
    if (!error) {
      toast.success(isRTL ? 'تم تحديث حالة التصويت' : 'Poll status updated');
      fetchDashboardData();
    } else {
      toast.error(isRTL ? 'يجب تحديث قاعدة البيانات أولاً لدعم هذه الميزة' : 'Database must be updated first to support this feature');
    }
  };

  return (
    <motion.div key="voting" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
      
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
        <h3 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
          <Vote className="w-6 h-6 text-teal-500" />
          {isRTL ? 'إنشاء تصويت جديد' : 'Create New Poll'}
        </h3>
        
        <form onSubmit={handleCreatePoll} className="max-w-3xl space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isRTL ? 'عنوان التصويت' : 'Poll Title'}
            </label>
            <input 
              type="text" required
              value={pollTitle} onChange={(e) => setPollTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
              placeholder={isRTL ? 'ما هو موضوع التصويت؟' : 'What is the poll about?'}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isRTL ? 'الوصف (اختياري)' : 'Description (Optional)'}
            </label>
            <textarea 
              rows={2}
              value={pollDesc} onChange={(e) => setPollDesc(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none resize-none transition-all"
              placeholder={isRTL ? 'أضف المزيد من التفاصيل...' : 'Add more details...'}
            />
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-bold text-slate-800 dark:text-white mb-3">
              {isRTL ? 'خيارات التصويت' : 'Poll Options'}
            </label>
            <div className="space-y-3">
              <AnimatePresence>
                {pollOptions.map((opt, idx) => (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} key={idx} className="flex gap-2">
                    <div className="w-10 h-10 shrink-0 bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 rounded-lg flex items-center justify-center font-bold">
                      {idx + 1}
                    </div>
                    <input 
                      type="text" 
                      placeholder={`${isRTL ? 'خيار' : 'Option'} ${idx + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...pollOptions];
                        newOpts[idx] = e.target.value;
                        setPollOptions(newOpts);
                      }}
                      className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                    {pollOptions.length > 2 && (
                      <button 
                        type="button" 
                        onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                        className="w-10 h-10 shrink-0 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <button 
              type="button" 
              onClick={() => setPollOptions([...pollOptions, ''])}
              className="mt-4 flex items-center gap-2 text-teal-600 dark:text-teal-400 text-sm font-medium hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
            >
              <PlusCircle className="w-5 h-5" />
              {isRTL ? 'إضافة خيار آخر' : 'Add another option'}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {isRTL ? 'تاريخ انتهاء التصويت (اختياري)' : 'Expiry Date (Optional)'}
            </label>
            <input 
              type="datetime-local" 
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all w-full md:w-auto"
            />
          </div>

          <div className="flex justify-end">
            <button 
              type="submit" 
              disabled={isLoading}
              className="py-3 px-8 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-teal-500/30 transition-all"
            >
              {isLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'نشر التصويت' : 'Publish Poll')}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
        <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-teal-500" />
          {isRTL ? 'التصويتات الحالية' : 'Active Polls'}
        </h3>
        
        <div className="space-y-6">
          {polls.map((poll: any) => {
            const totalVotes = poll.poll_votes?.length || 0;
            const isClosed = poll.is_closed || (poll.expires_at && new Date(poll.expires_at) < new Date());

            return (
              <div key={poll.id} className={`p-6 border ${isClosed ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30' : 'border-teal-100 dark:border-teal-900/30 bg-teal-50/30 dark:bg-teal-900/10'} rounded-2xl relative`}>
                {isClosed && (
                  <div className="absolute top-0 right-0 rtl:left-0 rtl:right-auto bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold px-3 py-1 rounded-bl-lg rtl:rounded-bl-none rtl:rounded-br-lg">
                    {isRTL ? 'مغلق' : 'Closed'}
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-6">
                  <div className="pr-12 rtl:pr-0 rtl:pl-12">
                    <h4 className="font-bold text-xl text-slate-800 dark:text-white mb-2">{poll.title}</h4>
                    {poll.description && <p className="text-sm text-slate-600 dark:text-slate-400">{poll.description}</p>}
                    
                    <div className="flex items-center gap-4 mt-3 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {totalVotes} {isRTL ? 'صوتاً' : 'votes'}</span>
                      {poll.expires_at && (
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(poll.expires_at).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleToggleClose(poll.id, poll.is_closed)}
                      className={`p-2 rounded-lg transition-colors ${poll.is_closed ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}
                      title={isRTL ? 'فتح/إغلاق التصويت' : 'Toggle Close Poll'}
                    >
                      <Power className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDeletePoll(poll.id)}
                      className="p-2 bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                      title={isRTL ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {poll.poll_options?.map((opt: any) => {
                    const votesCount = poll.poll_votes?.filter((v: any) => v.option_id === opt.id).length || 0;
                    const percentage = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                    
                    return (
                      <div key={opt.id} className="relative">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{opt.option_text}</span>
                          <span className="text-sm font-bold text-teal-600 dark:text-teal-400">{percentage}% ({votesCount})</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="bg-teal-500 h-2.5 rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {polls.length === 0 && (
            <div className="text-center py-12">
              <Vote className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">{isRTL ? 'لا توجد تصويتات حالياً' : 'No polls found'}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
