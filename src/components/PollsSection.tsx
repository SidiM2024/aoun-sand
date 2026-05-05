import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { Vote, CheckCircle2, AlertCircle, BarChart2, Users, Lock } from 'lucide-react';

export const PollsSection = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    fetchActivePolls();
    const channel = supabase.channel('polls:homepage')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchActivePolls())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchActivePolls())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchActivePolls = async () => {
    try {
      const { data } = await supabase
        .from('polls')
        .select('*, poll_options(*), poll_votes(*)')
        .order('created_at', { ascending: false });
      if (data) {
        const active = data.filter(p => {
          if (p.is_closed) return false;
          if (p.expires_at && new Date(p.expires_at) < new Date()) return false;
          return true;
        });
        setPolls(active);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    if (!user) {
      toast.error(isRTL ? 'يجب تسجيل الدخول للتصويت' : 'You must log in to vote');
      return;
    }
    setVotingId(pollId);
    try {
      const { error } = await supabase
        .from('poll_votes')
        .insert([{ poll_id: pollId, option_id: optionId, user_id: user.id }]);
      if (error) {
        if (error.code === '23505') {
          toast.error(isRTL ? 'لقد صوّتت مسبقاً في هذا الاستطلاع' : 'You already voted in this poll');
        } else throw error;
      } else {
        toast.success(isRTL ? '✓ تم تسجيل صوتك بنجاح!' : '✓ Your vote has been recorded!');
        fetchActivePolls();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setVotingId(null);
    }
  };

  if (loading || polls.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7 }}
      className="mb-14"
      aria-label="Polls"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <BarChart2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">
            {isRTL ? 'استطلاعات الرأي' : 'Polls & Voting'}
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            {isRTL ? 'شاركنا رأيك في المواضيع المطروحة' : 'Share your opinion on current topics'}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {polls.map((poll, pollIdx) => {
          const totalVotes = poll.poll_votes?.length || 0;
          const userHasVoted = user ? poll.poll_votes?.some((v: any) => v.user_id === user.id) : false;
          const userVote = user ? poll.poll_votes?.find((v: any) => v.user_id === user.id) : null;
          const isVoting = votingId === poll.id;

          return (
            <motion.div
              key={poll.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: pollIdx * 0.1 }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f1623] to-[#161d2e] border border-white/8 shadow-2xl shadow-black/40"
            >
              {/* Top accent line */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

              <div className="p-6 sm:p-8">
                {/* Poll header */}
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 mb-4">
                    <Vote className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      {isRTL ? 'تصويت' : 'Poll'}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{poll.title}</h3>
                  {poll.description && (
                    <p className="text-sm text-slate-400 leading-relaxed">{poll.description}</p>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <AnimatePresence>
                    {poll.poll_options?.map((opt: any, idx: number) => {
                      const votes = poll.poll_votes?.filter((v: any) => v.option_id === opt.id).length || 0;
                      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                      const isChosen = userVote?.option_id === opt.id;
                      const isLeading = userHasVoted && pct === Math.max(...(poll.poll_options?.map((o: any) => {
                        const c = poll.poll_votes?.filter((v: any) => v.option_id === o.id).length || 0;
                        return totalVotes > 0 ? Math.round((c / totalVotes) * 100) : 0;
                      }) || [0]));

                      const colors = ['from-indigo-500 to-blue-500', 'from-purple-500 to-pink-500', 'from-teal-500 to-emerald-500', 'from-amber-500 to-orange-500'];
                      const color = colors[idx % colors.length];

                      return (
                        <motion.div key={opt.id} layout className="relative">
                          {!userHasVoted ? (
                            <button
                              onClick={() => handleVote(poll.id, opt.id)}
                              disabled={isVoting}
                              className="w-full text-start rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-400/40 transition-all duration-200 disabled:opacity-40 group px-5 py-4 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-black shrink-0`}>
                                  {idx + 1}
                                </div>
                                <span className="text-sm sm:text-base font-medium text-slate-200 group-hover:text-white transition-colors">
                                  {opt.option_text}
                                </span>
                              </div>
                              <div className="w-5 h-5 rounded-full border-2 border-white/20 group-hover:border-indigo-400 flex items-center justify-center transition-all shrink-0">
                                <div className="w-2 h-2 rounded-full bg-transparent group-hover:bg-indigo-400 transition-colors" />
                              </div>
                            </button>
                          ) : (
                            <div className={`relative overflow-hidden rounded-2xl border px-5 py-4 ${isChosen ? 'border-indigo-500/60 bg-indigo-500/15' : 'border-white/8 bg-white/4'}`}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 1.2, ease: 'easeOut' }}
                                className={`absolute inset-y-0 start-0 rounded-2xl ${isChosen ? 'bg-indigo-600/25' : 'bg-white/5'}`}
                              />
                              <div className="relative z-10 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-black shrink-0 ${isLeading ? 'ring-2 ring-white/40' : ''}`}>
                                    {idx + 1}
                                  </div>
                                  <span className={`text-sm sm:text-base font-medium ${isChosen ? 'text-indigo-300' : 'text-slate-300'}`}>
                                    {opt.option_text}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-sm font-black tabular-nums ${isChosen ? 'text-indigo-300' : 'text-slate-400'}`}>
                                    {pct}%
                                  </span>
                                  <span className="text-xs text-slate-500">({votes})</span>
                                  {isChosen && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />}
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="mt-5 pt-4 border-t border-white/8 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5" />
                    <span>{isRTL ? `${totalVotes} صوت` : `${totalVotes} votes`}</span>
                  </div>
                  {!user && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400/80 bg-amber-400/10 px-3 py-1.5 rounded-lg border border-amber-400/20">
                      <Lock className="w-3 h-3" />
                      <span>{isRTL ? 'سجّل الدخول للتصويت' : 'Login to vote'}</span>
                    </div>
                  )}
                  {userHasVoted && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400/80 bg-emerald-400/10 px-3 py-1.5 rounded-lg border border-emerald-400/20">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{isRTL ? 'تم التصويت' : 'Voted'}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
};
