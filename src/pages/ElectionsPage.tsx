import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Vote, ShieldCheck, Lock, Users, CalendarClock, CheckCircle2, Loader2, ChevronDown, Trophy, AlertCircle, LogIn, X, UserRound,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LegacyPolls } from '../components/LegacyPolls';
import { castVote, fetchPublicElections, PHASE_LABELS, SiteError, type Candidate, type Election } from '../lib/siteApi';

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString('ar-MA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

const phaseStyle: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  upcoming: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  ended: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  closed: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  draft: 'bg-slate-100 text-slate-500',
};

const Countdown = ({ to, label }: { to: string; label: string }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return (
    <p className="text-sm font-bold text-[#211d45] dark:text-[#f7b2b0]">
      {label}: <span dir="ltr" className="tabular-nums">{d > 0 ? `${d}d ` : ''}{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>
    </p>
  );
};

const CandidateCard = ({ c, selectable, selected, onToggle, showVotes, total, isWinner }: {
  c: Candidate; selectable: boolean; selected: boolean; onToggle: () => void; showVotes: boolean; total: number; isWinner: boolean;
}) => {
  const [openProgram, setOpenProgram] = useState(false);
  const pct = showVotes && total > 0 ? Math.round(((c.votes ?? 0) / total) * 100) : 0;
  return (
    <div className={`relative rounded-3xl border-2 bg-white dark:bg-slate-900 p-4 transition-all ${selected ? 'border-[#ef8f88] shadow-lg shadow-[#ef8f88]/20' : 'border-slate-100 dark:border-slate-800'}`}>
      {isWinner && <span className="absolute -top-3 start-4 px-3 py-1 rounded-full bg-amber-400 text-[#211d45] text-xs font-black flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> الأعلى أصواتاً</span>}
      <div className="flex items-start gap-3">
        <div className="w-20 h-24 rounded-2xl overflow-hidden bg-[#fde3e1] shrink-0 flex items-center justify-center">
          {c.photo_url ? <img src={c.photo_url} alt={c.full_name} loading="lazy" className="w-full h-full object-cover" /> : <UserRound className="w-10 h-10 text-[#e2706a]" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-lg text-[#211d45] dark:text-white leading-snug">{c.full_name}</h3>
          {c.bio && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{c.bio}</p>}
        </div>
      </div>
      {c.program && (
        <div className="mt-3">
          <button onClick={() => setOpenProgram(o => !o)} aria-expanded={openProgram} className="text-sm font-bold text-[#211d45] dark:text-[#f7b2b0] flex items-center gap-1">
            البرنامج الانتخابي <ChevronDown className={`w-4 h-4 transition-transform ${openProgram ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {openProgram && (
              <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap overflow-hidden">{c.program}</motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
      {showVotes && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm font-bold mb-1">
            <span className="text-[#211d45] dark:text-white">{c.votes ?? 0} صوت</span>
            <span className="text-slate-500">{pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className={`h-full rounded-full ${isWinner ? 'bg-amber-400' : 'bg-[#ef8f88]'}`} />
          </div>
        </div>
      )}
      {selectable && (
        <button onClick={onToggle} aria-pressed={selected}
          className={`mt-4 w-full py-2.5 rounded-2xl font-black flex items-center justify-center gap-2 transition-colors ${selected ? 'bg-[#ef8f88] text-white' : 'bg-[#fde3e1] text-[#211d45] hover:bg-[#fbd0cc]'}`}>
          {selected ? <><CheckCircle2 className="w-5 h-5" /> تم الاختيار</> : 'اختيار هذا المرشح'}
        </button>
      )}
    </div>
  );
};

const ElectionCard = ({ e, loggedIn, onVoted }: { e: Election; loggedIn: boolean; onVoted: () => void }) => {
  const [choice, setChoice] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canVote = e.phase === 'open' && loggedIn && e.is_eligible && !e.has_voted;
  const showVotes = e.results_visible && e.candidates.some(c => c.votes !== null);
  const total = e.ballots_count ?? e.candidates.reduce((s, c) => s + (c.votes ?? 0), 0);
  const maxVotes = Math.max(0, ...e.candidates.map(c => c.votes ?? 0));

  const toggle = (id: string) => setChoice(cur => {
    if (cur.includes(id)) return cur.filter(x => x !== id);
    if (e.max_choices === 1) return [id];
    if (cur.length >= e.max_choices) { toast.error(`يمكنك اختيار ${e.max_choices} مرشحين كحد أقصى`); return cur; }
    return [...cur, id];
  });

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await castVote(e.id, choice);
      toast.success('تم تسجيل صوتك بنجاح. شكراً لمشاركتك!');
      setConfirming(false);
      setChoice([]);
      onVoted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر تسجيل الصوت');
      if (err instanceof SiteError && err.code === 'VOTE_ALREADY_CAST') { setConfirming(false); onVoted(); }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="bg-white/70 dark:bg-slate-900/60 rounded-[28px] border border-slate-100 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-black text-[#211d45] dark:text-white">{e.title}</h2>
          {e.description && <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">{e.description}</p>}
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-black ${phaseStyle[e.phase]}`}>{PHASE_LABELS[e.phase]}</span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-500 dark:text-slate-400 mb-4">
        {e.starts_at && <span className="flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> يبدأ: {fmt(e.starts_at)}</span>}
        {e.ends_at && <span className="flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> ينتهي: {fmt(e.ends_at)}</span>}
        <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {e.voters_count} مشارك</span>
        <span className="flex items-center gap-1.5"><Vote className="w-4 h-4" /> {e.max_choices === 1 ? 'اختيار مرشح واحد' : `حتى ${e.max_choices} مرشحين`}</span>
      </div>

      {e.phase === 'upcoming' && e.starts_at && <div className="mb-4"><Countdown to={e.starts_at} label="يبدأ التصويت بعد" /></div>}
      {e.phase === 'open' && e.ends_at && <div className="mb-4"><Countdown to={e.ends_at} label="ينتهي التصويت بعد" /></div>}

      {/* Voter status */}
      {e.phase === 'open' && (
        !loggedIn ? (
          <div className="mb-4 p-3 rounded-2xl bg-[#fde8e6] dark:bg-[#f7b2b0]/10 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[#211d45] dark:text-white">سجّل الدخول بحسابك للتصويت.</p>
            <Link to="/auth" state={{ from: { pathname: '/elections' } }} className="px-4 py-2 rounded-xl bg-[#211d45] text-white text-sm font-bold flex items-center gap-1.5"><LogIn className="w-4 h-4" /> تسجيل الدخول</Link>
          </div>
        ) : e.has_voted ? (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> لقد صوّتّ في هذا الاقتراع. صوتك سري ولا يمكن تعديله.</div>
        ) : !e.is_eligible ? (
          <div className="mb-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5" /> هذا الاقتراع متاح للأعضاء {e.eligibility === 'approved' ? 'المعتمدين' : 'المسجلين'} فقط.</div>
        ) : null
      )}
      {e.has_voted && e.phase !== 'open' && (
        <p className="mb-4 text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> شاركت في هذا الاقتراع</p>
      )}
      {!e.results_visible && (e.phase === 'closed' || e.phase === 'ended') && (
        <p className="mb-4 text-sm text-slate-500 flex items-center gap-1.5"><Lock className="w-4 h-4" /> ستُعلن النتائج بعد اعتمادها من إدارة الجمعية.</p>
      )}
      {showVotes && <p className="mb-3 text-sm font-bold text-[#211d45] dark:text-white">النتائج — إجمالي الأصوات: {total}</p>}

      {e.candidates.length === 0 ? (
        <p className="text-slate-500 text-center py-6">لم يُعلن عن المرشحين بعد.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {e.candidates.map(c => (
            <CandidateCard key={c.id} c={c} selectable={canVote} selected={choice.includes(c.id)} onToggle={() => toggle(c.id)}
              showVotes={showVotes} total={total} isWinner={showVotes && maxVotes > 0 && (c.votes ?? 0) === maxVotes && e.phase !== 'open'} />
          ))}
        </div>
      )}

      {canVote && (
        <div className="sticky bottom-[calc(80px+env(safe-area-inset-bottom))] mt-4 z-10">
          <button onClick={() => setConfirming(true)} disabled={choice.length === 0}
            className="w-full py-4 rounded-2xl bg-[#211d45] text-white font-black text-lg shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
            <Vote className="w-5 h-5" /> تأكيد التصويت ({choice.length}/{e.max_choices})
          </button>
        </div>
      )}

      <AnimatePresence>
        {confirming && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => !submitting && setConfirming(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={ev => ev.stopPropagation()}
              role="alertdialog" aria-modal="true" className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4" dir="rtl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-[#211d45] dark:text-white">تأكيد التصويت</h3>
                <button onClick={() => setConfirming(false)} disabled={submitting} aria-label="إغلاق"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <p className="text-slate-600 dark:text-slate-300">ستصوّت لـ:</p>
              <ul className="space-y-2">
                {e.candidates.filter(c => choice.includes(c.id)).map(c => (
                  <li key={c.id} className="p-3 rounded-2xl bg-[#fde8e6] dark:bg-[#f7b2b0]/10 font-bold text-[#211d45] dark:text-white">{c.full_name}</li>
                ))}
              </ul>
              <p className="text-sm text-slate-500 flex items-start gap-2"><ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" /> صوتك سري، ولا يمكن تعديله أو إلغاؤه بعد التأكيد.</p>
              <button onClick={submit} disabled={submitting} className="w-full py-3.5 rounded-2xl bg-[#ef8f88] text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-5 h-5 animate-spin" />} تأكيد وإرسال الصوت
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </article>
  );
};

export const ElectionsPage = () => {
  const { user } = useAuth();
  const [elections, setElections] = useState<Election[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setElections(await fetchPublicElections());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل الانتخابات');
      setElections(cur => cur ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [load, user?.id]);

  const openCount = useMemo(() => (elections ?? []).filter(e => e.phase === 'open').length, [elections]);

  return (
    <div className="min-h-screen bg-[#f7f6fb] dark:bg-slate-950 pt-[calc(76px+env(safe-area-inset-top))]" dir="rtl">
      <div className="bg-[#211d45] text-white px-5 pt-8 pb-16 rounded-b-[32px]">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-3"><Vote className="w-8 h-8 text-[#f7b2b0]" /> الانتخابات الإلكترونية</h1>
          <p className="text-white/75 mt-2 max-w-2xl">شارك في صناعة مستقبل الجمعية. لكل عضو مؤهل صوت واحد في كل اقتراع، والتصويت سري ومحمي من التعديل.</p>
          <div className="flex flex-wrap gap-2 mt-4 text-sm">
            <span className="px-3 py-1.5 rounded-full bg-white/10 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#f7b2b0]" /> تصويت سري</span>
            <span className="px-3 py-1.5 rounded-full bg-white/10 flex items-center gap-1.5"><Lock className="w-4 h-4 text-[#f7b2b0]" /> صوت واحد لكل عضو</span>
            {openCount > 0 && <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-200 font-bold">{openCount} اقتراع مفتوح الآن</span>}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 -mt-8 space-y-5">
        {elections === null ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#ef8f88]" /></div>
        ) : elections.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center">
            <Vote className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-slate-500">{error || 'لا توجد انتخابات معلنة حالياً.'}</p>
          </div>
        ) : (
          elections.map(e => <ElectionCard key={e.id} e={e} loggedIn={!!user} onVoted={() => void load()} />)
        )}
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4">
        <LegacyPolls />
      </div>
    </div>
  );
};
