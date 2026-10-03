import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Vote, BarChart2, Users, Clock, CheckCircle2,
  Lock, ChevronRight, Send, Trophy, Shield, AlertCircle
} from 'lucide-react';

const PollBar = ({ pct, isChosen, isLeading, delay }: { pct: number; isChosen: boolean; isLeading: boolean; delay: number }) => (
  <motion.div
    initial={{ width: 0 }}
    animate={{ width: `${Math.min(100, pct)}%` }}
    transition={{ duration: 0.9, ease: 'easeOut', delay }}
    className={`absolute inset-y-0 start-0 rounded-2xl ${
      isChosen
        ? 'bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/40'
        : isLeading
        ? 'bg-teal-50 dark:bg-teal-900/30'
        : 'bg-slate-100 dark:bg-slate-800/60'
    }`}
  />
);

export const ElectionsPage = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'closed'>('active');

  const fetchPolls = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*, poll_options(*), poll_votes(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setPolls(data);
    } catch (e) {
      console.error('fetchPolls error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolls();
    const ch = supabase
      .channel('elections-page-v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, fetchPolls)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, fetchPolls)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchPolls]);

  const isExpiredFn = (poll: any) => poll.expires_at && new Date(poll.expires_at) < new Date();
  const isClosedFn = (poll: any) => poll.is_closed || isExpiredFn(poll);

  const filteredPolls = polls.filter(p => {
    if (activeFilter === 'active') return !isClosedFn(p);
    if (activeFilter === 'closed') return isClosedFn(p);
    return true;
  });

  const activeCount = polls.filter(p => !isClosedFn(p)).length;
  const closedCount = polls.filter(p => isClosedFn(p)).length;

  const handleSingleVote = async (pollId: string, optionId: string) => {
    if (!user) { toast.error(isRTL ? 'يجب تسجيل الدخول للتصويت' : 'You must be logged in to vote'); return; }
    setSubmitting(pollId);
    try {
      const { error } = await supabase.from('poll_votes').insert([{ poll_id: pollId, option_id: optionId, user_id: user.id }]);
      if (error) {
        if (error.code === '23505') toast.error(isRTL ? 'لقد صوّتَّ مسبقاً في هذا التصويت' : 'You already voted in this poll');
        else throw error;
      } else {
        toast.success(isRTL ? '✓ تم تسجيل صوتك بنجاح!' : '✓ Vote recorded!', { icon: '🗳️' });
        setVoted(prev => ({ ...prev, [pollId]: true }));
        fetchPolls();
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
    if (opts.length === 0) { toast.error(isRTL ? 'اختر خياراً على الأقل' : 'Select at least one option'); return; }
    setSubmitting(pollId);
    try {
      const { error } = await supabase.from('poll_votes').insert(opts.map(oId => ({ poll_id: pollId, option_id: oId, user_id: user.id })));
      if (error) {
        if (error.code === '23505') toast.error(isRTL ? 'لقد صوّتَّ مسبقاً' : 'Already voted');
        else throw error;
      } else {
        toast.success(isRTL ? '✓ تم تسجيل أصواتك!' : '✓ Votes recorded!', { icon: '🗳️' });
        setSelectedOptions(prev => ({ ...prev, [pollId]: [] }));
        setVoted(prev => ({ ...prev, [pollId]: true }));
        fetchPolls();
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(null); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 dark:from-slate-950 dark:via-indigo-950/20 dark:to-slate-950 pt-24 pb-24" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hero */}
      <div className="relative overflow-hidden mb-10">
        <div className="absolute top-0 start-1/4 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 end-1/4 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="container mx-auto max-w-5xl px-4">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white mb-6 shadow-xl shadow-indigo-500/30">
              <Vote className="w-10 h-10" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-800 dark:text-white mb-4 leading-tight">
              {isRTL ? 'الانتخابات والتصويت' : 'Elections & Voting'}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {isRTL
                ? 'شارك في صناعة القرار ودعم مسيرة الجمعية من خلال التصويت في الانتخابات والاستطلاعات المتاحة.'
                : 'Participate in decision-making and support the association by voting in available elections and polls.'}
            </p>
            {!loading && polls.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex items-center justify-center gap-6 mt-8 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{activeCount} {isRTL ? 'تصويت نشط' : `active poll${activeCount !== 1 ? 's' : ''}`}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>{closedCount} {isRTL ? 'مغلق' : `closed`}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                  <Users className="w-3.5 h-3.5" />
                  <span>{polls.reduce((a, p) => a + new Set(p.poll_votes?.map((v: any) => v.user_id)).size, 0)} {isRTL ? 'مشارك' : 'participants'}</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4">
        {/* Filter Tabs */}
        {!loading && polls.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex items-center gap-2 mb-8 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-fit mx-auto">
            {([
              { key: 'active', label: isRTL ? 'النشطة' : 'Active', count: activeCount },
              { key: 'closed', label: isRTL ? 'المغلقة' : 'Closed', count: closedCount },
              { key: 'all', label: isRTL ? 'الكل' : 'All', count: polls.length },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setActiveFilter(tab.key)} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeFilter === tab.key ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeFilter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{tab.count}</span>
              </button>
            ))}
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-slate-500 font-medium">{isRTL ? 'جاري تحميل التصويتات...' : 'Loading polls...'}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredPolls.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
            <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
              {isRTL ? (activeFilter === 'active' ? 'لا توجد تصويتات نشطة حالياً' : activeFilter === 'closed' ? 'لا توجد تصويتات مغلقة' : 'لا توجد تصويتات بعد') : (activeFilter === 'active' ? 'No active polls right now' : activeFilter === 'closed' ? 'No closed polls' : 'No polls yet')}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {isRTL ? 'ستظهر التصويتات هنا بمجرد إنشائها من قِبل المسؤول.' : 'Polls will appear here once created by the admin.'}
            </p>
          </motion.div>
        )}

        {/* Polls */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {filteredPolls.map((poll, i) => {
              const totalVotes = poll.poll_votes?.length || 0;
              const userVotes = user ? poll.poll_votes?.filter((v: any) => v.user_id === user.id) : [];
              const hasVoted = (userVotes && userVotes.length > 0) || voted[poll.id];
              const isSubmittingThis = submitting === poll.id;
              const allowMultiple = poll.allow_multiple === true;
              const selectedForThis = selectedOptions[poll.id] || [];
              const uniqueVoters = new Set(poll.poll_votes?.map((v: any) => v.user_id)).size;
              const pollClosed = isClosedFn(poll);
              const pollExpired = isExpiredFn(poll);

              const optionsWithVotes = (poll.poll_options || []).map((opt: any) => {
                const votesForOpt = poll.poll_votes?.filter((v: any) => v.option_id === opt.id).length || 0;
                const divisor = allowMultiple ? Math.max(uniqueVoters, 1) : Math.max(totalVotes, 1);
                return { ...opt, votes: votesForOpt, pct: totalVotes > 0 ? Math.round((votesForOpt / divisor) * 100) : 0 };
              });
              const maxPct = Math.max(...optionsWithVotes.map((o: any) => o.pct), 0);

              return (
                <motion.div key={poll.id} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12, scale: 0.97 }} transition={{ delay: i * 0.06, duration: 0.4 }}
                  className={`bg-white dark:bg-slate-900 rounded-3xl border shadow-md overflow-hidden transition-all duration-300 ${pollClosed ? 'border-slate-200 dark:border-slate-700 opacity-80' : 'border-indigo-100 dark:border-indigo-900/30 hover:shadow-lg hover:shadow-indigo-500/5'}`}>
                  {/* Status bar */}
                  <div className={`px-5 py-3 flex items-center justify-between gap-2 border-b text-xs font-bold flex-wrap ${pollClosed ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400' : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${pollClosed ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
                      <span>{pollClosed ? (pollExpired ? (isRTL ? 'منتهي الصلاحية' : 'Expired') : (isRTL ? 'مغلق' : 'Closed')) : (isRTL ? 'تصويت نشط' : 'Active Poll')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {allowMultiple && <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">{isRTL ? 'اختيار متعدد' : 'Multi-choice'}</span>}
                      <span className="flex items-center gap-1 text-slate-400"><Users className="w-3 h-3" />{uniqueVoters} {isRTL ? 'مشارك' : 'voted'}</span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start gap-3 mb-5">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/25 mt-0.5">
                        <BarChart2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-black text-lg sm:text-xl text-slate-800 dark:text-white leading-snug">{poll.title}</h3>
                        {poll.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{poll.description}</p>}
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                      {optionsWithVotes.map((opt: any, idx: number) => {
                        const isChosen = userVotes?.some((v: any) => v.option_id === opt.id);
                        const isLeading = hasVoted && opt.pct === maxPct && opt.pct > 0;
                        const isSelected = selectedForThis.includes(opt.id);
                        const showResults = hasVoted || pollClosed;

                        return (
                          <div key={opt.id}>
                            {!showResults && !pollClosed ? (
                              <motion.button whileTap={{ scale: 0.975 }}
                                onClick={() => allowMultiple ? toggleOption(poll.id, opt.id) : handleSingleVote(poll.id, opt.id)}
                                disabled={isSubmittingThis}
                                className={`w-full text-start flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all duration-150 disabled:opacity-60 group ${isSelected ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 bg-transparent hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10'}`}>
                                <div className={`w-5 h-5 flex items-center justify-center shrink-0 transition-all border-2 ${allowMultiple ? 'rounded-md' : 'rounded-full'} ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'}`}>
                                  {allowMultiple ? (isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />) : (<div className={`w-2.5 h-2.5 rounded-full transition-all ${isSelected ? 'bg-white' : 'bg-transparent group-hover:bg-indigo-400/50'}`} />)}
                                </div>
                                <span className={`text-sm sm:text-base font-semibold flex-1 transition-colors ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300'}`}>{opt.option_text}</span>
                                {!allowMultiple && <ChevronRight className={`w-4 h-4 shrink-0 transition-all ${isSelected ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600 group-hover:text-indigo-400'} ${isRTL ? 'rotate-180' : ''}`} />}
                                {!allowMultiple && isSubmittingThis && idx === 0 && <div className="ms-auto w-4 h-4 border-2 border-indigo-400/40 border-t-indigo-500 rounded-full animate-spin shrink-0" />}
                              </motion.button>
                            ) : (
                              <div className={`relative overflow-hidden rounded-2xl border-2 px-4 py-3.5 transition-all ${isChosen ? 'border-indigo-400 dark:border-indigo-600' : isLeading ? 'border-teal-200 dark:border-teal-800' : 'border-slate-100 dark:border-slate-800'}`}>
                                <PollBar pct={opt.pct} isChosen={!!isChosen} isLeading={isLeading} delay={idx * 0.06} />
                                <div className="relative z-10 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-5 h-5 flex items-center justify-center shrink-0 border-2 ${allowMultiple ? 'rounded-md' : 'rounded-full'} ${isChosen ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                      {isChosen && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <span className={`text-sm sm:text-base font-semibold truncate ${isChosen ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>{opt.option_text}</span>
                                    {isLeading && totalVotes > 0 && <span className="hidden sm:flex items-center gap-1 text-[10px] font-black text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/40 px-2 py-0.5 rounded-lg shrink-0"><Trophy className="w-3 h-3" />{isRTL ? 'الأعلى' : 'Leading'}</span>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-sm font-black tabular-nums ${isChosen ? 'text-indigo-600 dark:text-indigo-400' : isLeading && totalVotes > 0 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'}`}>{opt.pct}%</span>
                                    <span className="text-xs text-slate-400 font-medium">({opt.votes})</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Multi-choice submit */}
                    {!hasVoted && !pollClosed && allowMultiple && selectedForThis.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex justify-end">
                        <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleMultipleSubmit(poll.id)} disabled={isSubmittingThis}
                          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50">
                          {isSubmittingThis ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                          {isRTL ? `تصويت (${selectedForThis.length})` : `Submit (${selectedForThis.length})`}
                        </motion.button>
                      </motion.div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 sm:px-6 py-3 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{uniqueVoters} {isRTL ? 'مشارك' : `participant${uniqueVoters !== 1 ? 's' : ''}`}</span>
                      {poll.expires_at && <span className="flex items-center gap-1 text-amber-500"><Clock className="w-3 h-3" />{new Date(poll.expires_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!user ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800/40"><Lock className="w-3 h-3" />{isRTL ? 'سجّل دخولك للتصويت' : 'Login to vote'}</div>
                      ) : pollClosed ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400"><AlertCircle className="w-3.5 h-3.5" />{isRTL ? 'التصويت مغلق' : 'Voting closed'}</div>
                      ) : hasVoted ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />{isRTL ? 'تم تسجيل صوتك ✓' : 'Voted ✓'}</div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">{isRTL ? (allowMultiple ? 'اختر خياراً أو أكثر' : 'اختر خياراً واحداً') : (allowMultiple ? 'Select one or more' : 'Select an option')}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
