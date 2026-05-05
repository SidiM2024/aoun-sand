import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { BarChart2, CheckCircle2, Users, Lock, Clock } from 'lucide-react';

export const PollsSection = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchActivePolls();
    const ch = supabase.channel('polls:home:v3')
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

  const handleSingleVote = async (pollId: string, optionId: string) => {
    if (!user) { toast.error(isRTL ? 'يجب تسجيل الدخول للتصويت' : 'Login to vote'); return; }
    setSubmitting(pollId);
    try {
      const { error } = await supabase
        .from('poll_votes')
        .insert([{ poll_id: pollId, option_id: optionId, user_id: user.id }]);
      if (error) {
        if (error.code === '23505') toast.error(isRTL ? 'صوّتَّ مسبقاً في هذا الاستطلاع' : 'Already voted');
        else throw error;
      } else {
        toast.success(isRTL ? '✓ تم تسجيل صوتك!' : '✓ Vote recorded!');
        fetchActivePolls();
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(null); }
  };

  const toggleOption = (pollId: string, optionId: string) => {
    setSelectedOptions(prev => {
      const current = prev[pollId] || [];
      if (current.includes(optionId)) return { ...prev, [pollId]: current.filter(id => id !== optionId) };
      return { ...prev, [pollId]: [...current, optionId] };
    });
  };

  const handleMultipleSubmit = async (pollId: string) => {
    if (!user) { toast.error(isRTL ? 'يجب تسجيل الدخول للتصويت' : 'Login to vote'); return; }
    const opts = selectedOptions[pollId] || [];
    if (opts.length === 0) return;
    
    setSubmitting(pollId);
    try {
      const inserts = opts.map(oId => ({ poll_id: pollId, option_id: oId, user_id: user.id }));
      const { error } = await supabase.from('poll_votes').insert(inserts);
      if (error) throw error;
      toast.success(isRTL ? '✓ تم تسجيل أصواتك!' : '✓ Votes recorded!');
      setSelectedOptions(prev => ({ ...prev, [pollId]: [] }));
      fetchActivePolls();
    } catch (e: any) { 
      if (e.code === '23505') toast.error(isRTL ? 'صوّتَّ مسبقاً في هذا الاستطلاع' : 'Already voted');
      else toast.error(e.message); 
    }
    finally { setSubmitting(null); }
  };

  if (loading || polls.length === 0) return null;

  return (
    <section className="mb-14" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex items-center gap-3 mb-6"
      >
        <div className="relative">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <span className="absolute -top-1 -end-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-slate-950 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
            {isRTL ? 'استطلاعات الرأي' : 'Polls'}
          </h2>
          <p className="text-xs font-medium text-slate-400">
            {isRTL ? `${polls.length} استطلاع نشط` : `${polls.length} active poll${polls.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </motion.div>

      <div className="space-y-4">
        {polls.map((poll, i) => {
          const totalVotes = poll.poll_votes?.length || 0;
          const userVotes = user ? poll.poll_votes?.filter((v: any) => v.user_id === user.id) : [];
          const hasVoted = userVotes && userVotes.length > 0;
          const isSubmittingThis = submitting === poll.id;
          const allowMultiple = poll.allow_multiple === true;
          const selectedForThis = selectedOptions[poll.id] || [];

          // Sorted options for results display (highest first)
          const optionsWithVotes = (poll.poll_options || []).map((opt: any) => {
            const votesForOpt = poll.poll_votes?.filter((v: any) => v.option_id === opt.id).length || 0;
            // In multiple choice, percentage might be based on total participants, but we use total votes for simplicity
            // To be more accurate for multiple, pct = (votes / totalParticipants) * 100. 
            // We approximate participants by counting unique user_ids if needed, but totalVotes is fine for UI
            const uniqueVoters = new Set(poll.poll_votes?.map((v:any) => v.user_id)).size;
            const divisor = allowMultiple ? Math.max(uniqueVoters, 1) : Math.max(totalVotes, 1);
            return {
              ...opt,
              votes: votesForOpt,
              pct: totalVotes > 0 ? Math.round((votesForOpt / divisor) * 100) : 0,
            };
          });
          const maxPct = Math.max(...optionsWithVotes.map((o: any) => o.pct), 0);

          return (
            <motion.div
              key={poll.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-md overflow-hidden"
            >
              {/* Poll header */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
                    <BarChart2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white leading-snug">{poll.title}</h3>
                    {poll.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{poll.description}</p>
                    )}
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-2.5">
                  {optionsWithVotes.map((opt: any, idx: number) => {
                    const isChosen = userVotes?.some((v:any) => v.option_id === opt.id);
                    const isLeading = hasVoted && opt.pct === maxPct && opt.pct > 0;
                    const isSelected = selectedForThis.includes(opt.id);

                    return (
                      <div key={opt.id}>
                        {!hasVoted ? (
                          /* ── Unvoted: WhatsApp-style option button ── */
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => allowMultiple ? toggleOption(poll.id, opt.id) : handleSingleVote(poll.id, opt.id)}
                            disabled={isSubmittingThis}
                            className="w-full text-start flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-transparent hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all duration-150 disabled:opacity-50 group"
                          >
                            {/* Radio/Checkbox circle */}
                            <div className={`w-5 h-5 flex items-center justify-center shrink-0 transition-colors ${allowMultiple ? 'rounded-md' : 'rounded-full'} border-2 ${isSelected ? 'border-teal-500 bg-teal-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-teal-500'}`}>
                              {allowMultiple ? (
                                isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-teal-500 transition-colors" />
                              )}
                            </div>
                            <span className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                              {opt.option_text}
                            </span>
                            {!allowMultiple && isSubmittingThis && idx === 0 && (
                              <div className="ms-auto w-4 h-4 border-2 border-teal-400/40 border-t-teal-500 rounded-full animate-spin shrink-0" />
                            )}
                          </motion.button>
                        ) : (
                          /* ── Voted: WhatsApp-style result bar ── */
                          <div className={`relative overflow-hidden rounded-2xl border-2 px-4 py-3.5 ${isChosen ? 'border-teal-400 dark:border-teal-600' : 'border-slate-100 dark:border-slate-800'}`}>
                            {/* Fill bar */}
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, opt.pct)}%` }}
                              transition={{ duration: 0.9, ease: 'easeOut', delay: idx * 0.06 }}
                              className={`absolute inset-y-0 start-0 rounded-2xl ${isChosen ? 'bg-teal-100 dark:bg-teal-900/40' : 'bg-slate-100 dark:bg-slate-800/60'}`}
                            />
                            <div className="relative z-10 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Chosen check */}
                                <div className={`w-5 h-5 flex items-center justify-center shrink-0 transition-all ${allowMultiple ? 'rounded-md' : 'rounded-full'} border-2 ${isChosen ? 'border-teal-500 bg-teal-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                  {isChosen && <CheckCircle2 className="w-3.5 h-3.5 text-white" /> }
                                </div>
                                <span className={`text-sm sm:text-base font-semibold truncate ${isChosen ? 'text-teal-700 dark:text-teal-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                  {opt.option_text}
                                </span>
                                {isLeading && (
                                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/40 px-1.5 py-0.5 rounded-lg shrink-0">
                                    {isRTL ? 'الأعلى' : 'Leading'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-sm font-black tabular-nums ${isChosen ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                  {opt.pct}%
                                </span>
                                <span className="text-xs text-slate-400">({opt.votes})</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Poll footer */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Users className="w-3.5 h-3.5" />
                  <span>{new Set(poll.poll_votes?.map((v:any)=>v.user_id)).size} {isRTL ? 'مشارك' : 'participants'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {!hasVoted && allowMultiple && selectedForThis.length > 0 && (
                    <button
                      onClick={() => handleMultipleSubmit(poll.id)}
                      disabled={isSubmittingThis}
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                    >
                      {isSubmittingThis ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isRTL ? 'تصويت' : 'Submit'}
                    </button>
                  )}

                  {poll.expires_at && (
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(poll.expires_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  )}

                  {!user ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800/40">
                      <Lock className="w-3 h-3" />
                      {isRTL ? 'سجّل دخولك' : 'Login to vote'}
                    </div>
                  ) : hasVoted ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isRTL ? 'صوّتَّ' : 'Voted'}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {isRTL ? (allowMultiple ? 'اختر خياراً أو أكثر' : 'اختر خياراً') : (allowMultiple ? 'Select one or more' : 'Select an option')}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

