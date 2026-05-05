import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { Vote, CheckCircle2, AlertCircle } from 'lucide-react';

export const ActivePollsWidget = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    fetchActivePolls();
    
    const channel = supabase.channel('public:polls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchActivePolls())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchActivePolls())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchActivePolls = async () => {
    try {
      const { data } = await supabase
        .from('polls')
        .select('*, poll_options(*), poll_votes(*)')
        .order('created_at', { ascending: false });
        
      if (data) {
        // Filter out closed polls or expired polls
        const active = data.filter(poll => {
          if (poll.is_closed) return false;
          if (poll.expires_at && new Date(poll.expires_at) < new Date()) return false;
          return true;
        });
        setPolls(active);
      }
    } catch (error) {
      console.error("Error fetching polls", error);
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
        if (error.code === '23505') { // Unique violation
          toast.error(isRTL ? 'لقد قمت بالتصويت مسبقاً' : 'You have already voted');
        } else {
          throw error;
        }
      } else {
        toast.success(isRTL ? 'تم تسجيل تصويتك بنجاح!' : 'Your vote has been recorded!');
        fetchActivePolls();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setVotingId(null);
    }
  };

  if (loading) return null;
  if (polls.length === 0) return null;

  return (
    <div className="space-y-6">
      {polls.map((poll) => {
        const totalVotes = poll.poll_votes?.length || 0;
        const userHasVoted = user ? poll.poll_votes?.some((v: any) => v.user_id === user.id) : false;
        const userVote = user ? poll.poll_votes?.find((v: any) => v.user_id === user.id) : null;

        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={poll.id} 
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-teal-500/5 border border-teal-100 dark:border-slate-700 p-6 overflow-hidden relative"
          >
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl" />

            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30">
                <Vote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-slate-800 dark:text-white">{poll.title}</h3>
                {poll.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{poll.description}</p>
                )}
              </div>
            </div>

            <div className="space-y-3 mt-6 relative z-10">
              <AnimatePresence>
                {poll.poll_options?.map((opt: any) => {
                  const votesCount = poll.poll_votes?.filter((v: any) => v.option_id === opt.id).length || 0;
                  const percentage = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                  const isUserChoice = userVote?.option_id === opt.id;

                  return (
                    <motion.div layout key={opt.id} className="relative">
                      {!userHasVoted ? (
                        <button
                          onClick={() => handleVote(poll.id, opt.id)}
                          disabled={votingId === poll.id}
                          className="w-full text-start p-4 rounded-xl border-2 border-slate-100 hover:border-teal-400 dark:border-slate-700 dark:hover:border-teal-500 bg-slate-50 hover:bg-teal-50 dark:bg-slate-900/50 dark:hover:bg-teal-900/20 transition-all font-medium text-slate-700 dark:text-slate-200 group"
                        >
                          <div className="flex justify-between items-center">
                            <span>{opt.option_text}</span>
                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-teal-500 transition-colors" />
                          </div>
                        </button>
                      ) : (
                        <div className={`p-4 rounded-xl border-2 relative overflow-hidden ${isUserChoice ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/20' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50'}`}>
                          {/* Progress Bar Background */}
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`absolute top-0 left-0 bottom-0 ${isUserChoice ? 'bg-teal-100 dark:bg-teal-900/40' : 'bg-slate-200/50 dark:bg-slate-700/50'} z-0 rtl:right-0 rtl:left-auto`}
                          />
                          
                          <div className="relative z-10 flex justify-between items-center">
                            <span className={`font-medium ${isUserChoice ? 'text-teal-700 dark:text-teal-300' : 'text-slate-700 dark:text-slate-300'}`}>
                              {opt.option_text}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${isUserChoice ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'}`}>
                                {percentage}%
                              </span>
                              {isUserChoice && <CheckCircle2 className="w-5 h-5 text-teal-500" />}
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-medium text-slate-500 relative z-10">
              <span>{totalVotes} {isRTL ? 'أصوات إجمالية' : 'total votes'}</span>
              {!user && (
                <span className="flex items-center gap-1 text-amber-500">
                  <AlertCircle className="w-4 h-4" />
                  {isRTL ? 'سجل الدخول للتصويت' : 'Login to vote'}
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
