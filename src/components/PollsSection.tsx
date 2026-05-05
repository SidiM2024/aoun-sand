import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { BarChart2, CheckCircle2, Users, Lock, ChevronRight, Sparkles } from 'lucide-react';

export const PollsSection = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    fetchActivePolls();
    const ch = supabase.channel('polls:homepage:v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchActivePolls())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchActivePolls())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const fetchActivePolls = async () => {
    try {
      const { data } = await supabase
        .from('polls')
        .select('*, poll_options(*), poll_votes(*)')
        .order('created_at', { ascending: false });
      if (data) {
        setPolls(data.filter(p => !p.is_closed && !(p.expires_at && new Date(p.expires_at) < new Date())));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    if (!user) { toast.error(isRTL ? 'يجب تسجيل الدخول للتصويت' : 'Login to vote'); return; }
    setVotingId(pollId + optionId);
    try {
      const { error } = await supabase.from('poll_votes').insert([{ poll_id: pollId, option_id: optionId, user_id: user.id }]);
      if (error) {
        if (error.code === '23505') toast.error(isRTL ? 'لقد صوّتت مسبقاً في هذا الاستطلاع' : 'You already voted');
        else throw error;
      } else {
        toast.success(isRTL ? '✓ تم تسجيل صوتك!' : '✓ Vote recorded!');
        fetchActivePolls();
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setVotingId(null); }
  };

  if (loading || polls.length === 0) return null;

  return (
    <section className="mb-14" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex items-center gap-3 mb-8"
      >
        <div className="relative">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <span className="absolute -top-1 -end-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-950 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
            {isRTL ? 'استطلاعات الرأي' : 'Active Polls'}
          </h2>
          <p className="text-xs font-medium text-slate-400">
            {isRTL ? 'رأيك يهمنا — صوّت الآن' : 'Your voice matters — vote now'}
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {polls.map((poll, i) => {
          const totalVotes = poll.poll_votes?.length || 0;
          const userHasVoted = user ? poll.poll_votes?.some((v: any) => v.user_id === user.id) : false;
          const userVote = user ? poll.poll_votes?.find((v: any) => v.user_id === user.id) : null;

          const maxPct = Math.max(...(poll.poll_options?.map((o: any) => {
            const c = poll.poll_votes?.filter((v: any) => v.option_id === o.id).length || 0;
            return totalVotes > 0 ? Math.round((c / totalVotes) * 100) : 0;
          }) || [0]));

          const gradients = [
            'from-violet-600 via-indigo-600 to-blue-600',
            'from-rose-600 via-pink-600 to-fuchsia-600',
            'from-amber-500 via-orange-500 to-red-500',
            'from-teal-500 via-emerald-500 to-green-500',
          ];
          const grad = gradients[i % gradients.length];
          const barColors = [
            'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500',
            'bg-blue-500', 'bg-pink-500', 'bg-emerald-500', 'bg-orange-500'
          ];

          return (
            <motion.div
              key={poll.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-lg shadow-slate-200/60 dark:shadow-black/40"
            >
              {/* Gradient top bar */}
              <div className={`h-1.5 w-full bg-gradient-to-r ${grad}`} />

              {/* Header */}
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r ${grad} bg-opacity-10 mb-3`}>
                      <Sparkles className="w-3 h-3 text-white" />
                      <span className="text-xs font-bold text-white uppercase tracking-wide">
                        {isRTL ? 'تصويت نشط' : 'Active Poll'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-snug">{poll.title}</h3>
                    {poll.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{poll.description}</p>
                    )}
                  </div>
                </div>

                {/* Total votes badge */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
                  <Users className="w-3.5 h-3.5" />
                  <span className="font-semibold">{totalVotes} {isRTL ? 'مصوّت' : 'votes'}</span>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <AnimatePresence>
                    {poll.poll_options?.map((opt: any, idx: number) => {
                      const votes = poll.poll_votes?.filter((v: any) => v.option_id === opt.id).length || 0;
                      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                      const isChosen = userVote?.option_id === opt.id;
                      const isLeading = userHasVoted && pct === maxPct && pct > 0;
                      const isSubmitting = votingId === poll.id + opt.id;
                      const barColor = barColors[idx % barColors.length];

                      return (
                        <motion.div key={opt.id} layout>
                          {!userHasVoted ? (
                            /* ── Vote button ── */
                            <motion.button
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleVote(poll.id, opt.id)}
                              disabled={!!votingId}
                              className="w-full text-start rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all duration-200 disabled:opacity-40 group px-4 py-3.5 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-xl ${barColor} bg-opacity-15 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 shrink-0 group-hover:bg-opacity-25 transition-all`}>
                                  {idx + 1}
                                </div>
                                <span className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-200 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                                  {opt.option_text}
                                </span>
                              </div>
                              {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-violet-400/40 border-t-violet-500 rounded-full animate-spin shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-400 transition-colors shrink-0" />
                              )}
                            </motion.button>
                          ) : (
                            /* ── Result row ── */
                            <div className={`relative overflow-hidden rounded-2xl border-2 px-4 py-3.5 ${isChosen ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/40'}`}>
                              {/* Progress fill */}
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
                                className={`absolute inset-y-0 start-0 rounded-2xl ${isChosen ? 'bg-violet-200/50 dark:bg-violet-800/30' : 'bg-slate-200/60 dark:bg-slate-700/40'}`}
                              />
                              <div className="relative z-10 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-8 h-8 rounded-xl ${barColor} flex items-center justify-center text-white text-xs font-black shrink-0 ${isLeading ? 'shadow-lg' : 'opacity-70'}`}>
                                    {idx + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <span className={`text-sm sm:text-base font-semibold block ${isChosen ? 'text-violet-700 dark:text-violet-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                      {opt.option_text}
                                    </span>
                                    <div className={`h-1.5 mt-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden w-24`}>
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                                        className={`h-full rounded-full ${barColor}`}
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-end">
                                    <span className={`text-lg font-black tabular-nums ${isChosen ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                      {pct}%
                                    </span>
                                    <span className="text-xs text-slate-400 block">({votes})</span>
                                  </div>
                                  {isChosen && <CheckCircle2 className="w-5 h-5 text-violet-500 shrink-0" />}
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                {!user ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800/40">
                    <Lock className="w-3.5 h-3.5" />
                    {isRTL ? 'سجّل دخولك للمشاركة' : 'Login to participate'}
                  </div>
                ) : userHasVoted ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isRTL ? 'شكراً لمشاركتك!' : 'Thank you for voting!'}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">{isRTL ? 'اختر خياراً للتصويت' : 'Select an option to vote'}</p>
                )}
                <span className="text-xs font-bold text-slate-400 tabular-nums">{totalVotes} {isRTL ? 'صوت' : 'votes'}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
