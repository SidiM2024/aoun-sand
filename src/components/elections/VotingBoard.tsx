import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle, BarChart3, CheckCircle2, Crown, Loader2, LogIn, RefreshCw, Scale, ShieldCheck, TrendingUp, Trophy, UserRound, Users, Vote, X,
} from 'lucide-react';
import {
  candidacyLabel, candidatesLabel, groupPositions, votePosition,
  type GeneralCandidate, type GeneralElection, type GeneralPosition,
} from '../../lib/generalElections';

// Electronic ballot and live results of a general election: a live counter (total votes, voters,
// turnout), one section per position with a card per candidate (photo, name, position, votes,
// vote button). One vote per member and position, enforced by the database.

const fmt = (n: number) => n.toLocaleString('ar-MA');

/** Number that counts up/down smoothly to its new value. */
const useAnimatedNumber = (value: number) => {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3)));
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value]);
  return shown;
};

const AnimatedNumber = ({ value, className }: { value: number; className?: string }) => {
  const v = useAnimatedNumber(value);
  return <span className={`tabular-nums ${className ?? ''}`}>{fmt(v)}</span>;
};

// ─── Live counter (top of the election) ─────────────────────────────────────

export const LiveStats = ({ e, lastUpdated, refreshing, onRefresh }: {
  e: GeneralElection; lastUpdated: Date | null; refreshing: boolean; onRefresh: () => void;
}) => {
  const live = e.phase === 'voting';
  const total = e.total_votes ?? 0;
  const voters = e.voters_total ?? 0;
  const eligible = e.eligible_count || 0;
  const turnout = eligible > 0 ? Math.min(100, Math.round((voters / eligible) * 100)) : 0;
  const turnoutShown = useAnimatedNumber(turnout);
  return (
    <div className="mt-5 rounded-3xl bg-white/[0.07] border border-white/15 p-4 sm:p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="font-black flex items-center gap-2 text-sm sm:text-base">
          <BarChart3 className="w-5 h-5 text-[#f7b2b0]" /> {e.phase === 'results' ? 'الحصيلة النهائية' : 'إحصائيات التصويت'}
        </p>
        {live ? (
          <span className="px-2.5 py-1 rounded-full bg-red-500/90 text-white text-xs font-black flex items-center gap-1.5">
            <span className="relative flex w-2 h-2"><span className="absolute inline-flex w-full h-full rounded-full bg-white opacity-75 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-white" /></span>
            مباشر
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-full bg-white/10 text-xs font-black">{e.phase === 'results' ? 'نتائج رسمية' : 'التصويت مغلق'}</span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="col-span-2 sm:col-span-1 rounded-2xl bg-[#f7b2b0] text-[#211d45] p-3 sm:p-4 flex sm:flex-col items-center justify-between sm:justify-center gap-2 text-center">
          <span className="text-sm font-black flex items-center gap-1.5 sm:order-2"><Vote className="w-4 h-4" /> إجمالي الأصوات</span>
          <AnimatedNumber value={total} className="text-4xl font-black leading-none" />
        </div>
        <div className="rounded-2xl bg-white/10 p-3 sm:p-4 text-center">
          <AnimatedNumber value={voters} className="block text-2xl sm:text-4xl font-black leading-tight" />
          <span className="text-xs font-bold text-white/80">عدد المصوتين</span>
        </div>
        <div className="rounded-2xl bg-white/10 p-3 sm:p-4 text-center">
          <span className="block text-2xl sm:text-4xl font-black leading-tight tabular-nums">{fmt(turnoutShown)}٪</span>
          <span className="text-xs font-bold text-white/80">نسبة المشاركة</span>
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={turnout} aria-valuemin={0} aria-valuemax={100} aria-label="نسبة المشاركة">
        <div className="h-full rounded-full bg-gradient-to-l from-[#f7b2b0] to-[#ef8f88] transition-[width] duration-700" style={{ width: `${turnout}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-white/65">
        <span>{fmt(voters)} من {fmt(eligible)} عضوًا مؤهلًا</span>
        <button onClick={onRefresh} className="flex items-center gap-1 hover:text-white" aria-label="تحديث الآن">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {live ? 'يتحدث تلقائيًا' : 'تحديث'}{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
        </button>
      </div>
    </div>
  );
};

// ─── Candidate card on the ballot ───────────────────────────────────────────

const Photo = ({ c, size }: { c: GeneralCandidate; size: string }) => {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`${size} shrink-0 rounded-full border-[3px] border-[#f4b4a8] bg-[#efedf6] overflow-hidden flex items-center justify-center`}>
      {c.photo_url && !failed
        ? <img src={c.photo_url} alt={c.full_name} loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover" />
        : <UserRound className="w-1/2 h-1/2 text-[#262150]/50" />}
    </span>
  );
};

interface CardState {
  votes: number | null;
  pct: number;
  leader: boolean;
  winner: boolean;
  myChoice: boolean;
}

const BallotCard = ({ c, position, state, action }: {
  c: GeneralCandidate; position: GeneralPosition; state: CardState; action: React.ReactNode;
}) => {
  const { lead, target } = candidacyLabel(position.title);
  const highlight = state.winner || state.myChoice;
  return (
    <article className={`min-w-0 rounded-3xl bg-white dark:bg-slate-900 border-2 p-4 flex flex-col transition-shadow hover:shadow-lg ${
      state.winner ? 'border-amber-400 shadow-amber-200/50 shadow-lg' : state.myChoice ? 'border-emerald-400' : 'border-slate-100 dark:border-slate-800'}`}
      aria-label={`${c.full_name} — ${position.title}`}>
      <div className="flex items-start gap-3">
        <Photo c={c} size={highlight ? 'w-[72px] h-[72px]' : 'w-[68px] h-[68px]'} />
        <div className="min-w-0 flex-1">
          {(state.winner || state.leader || state.myChoice) && (
            <div className="flex flex-wrap gap-1 mb-1">
              {state.winner && <span className="px-2 py-0.5 rounded-full bg-amber-400 text-[#211d45] text-[11px] font-black flex items-center gap-1"><Crown className="w-3 h-3" /> فائز</span>}
              {!state.winner && state.leader && <span className="px-2 py-0.5 rounded-full bg-[#211d45] text-[#f7b2b0] text-[11px] font-black flex items-center gap-1"><TrendingUp className="w-3 h-3" /> متصدر</span>}
              {state.myChoice && <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> صوتك</span>}
            </div>
          )}
          <h4 className="font-black text-[17px] leading-snug text-[#211d45] dark:text-white break-words">{c.full_name}</h4>
          <p className="mt-1.5 inline-flex flex-wrap items-center gap-x-1 px-2 py-0.5 rounded-lg bg-[#fde8e4] dark:bg-[#f4b4a8]/15 text-xs leading-relaxed">
            <span className="text-[#262150]/70 dark:text-white/70">{lead}</span>
            <b className="font-black text-[#262150] dark:text-white">{target}</b>
          </p>
        </div>
      </div>

      {state.votes !== null && (
        <div className="mt-4">
          <div className="flex items-end justify-between gap-2 mb-1.5">
            <span className="text-[#211d45] dark:text-white"><AnimatedNumber value={state.votes} className="text-2xl font-black" /> <span className="text-sm font-bold text-slate-500">صوت</span></span>
            <span className="text-sm font-black text-[#e2706a] tabular-nums">{fmt(state.pct)}٪</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className={`h-full rounded-full transition-[width] duration-700 ${state.winner ? 'bg-amber-400' : 'bg-gradient-to-l from-[#ef8f88] to-[#211d45]'}`} style={{ width: `${state.pct}%` }} />
          </div>
        </div>
      )}
      <div className="mt-auto pt-4">{action}</div>
    </article>
  );
};

// ─── Board ───────────────────────────────────────────────────────────────────

const choiceKey = (electionId: string, userId: string) => `vote_choices_${electionId}_${userId}`;
const readChoices = (key: string): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
};

export const VotingBoard = ({ e, userId, reload }: { e: GeneralElection; userId: string | null; reload: () => Promise<void> | void }) => {
  const isVoting = e.phase === 'voting';
  const isResults = e.phase === 'results';
  const showVotes = !!e.results_visible;
  const voted = useMemo(() => new Set(e.my?.voted_position_ids ?? []), [e.my?.voted_position_ids]);
  const canVote = isVoting && !!userId && !!e.my?.can_vote;
  const positions = e.positions.filter(p => p.is_active);
  const groups = groupPositions(positions.filter(p => p.candidates.length > 0));
  const votable = positions.filter(p => p.candidates.length > 0);
  const votedCount = votable.filter(p => voted.has(p.id)).length;

  // The member's own choices are remembered on this device only (the ballot itself is secret).
  const storageKey = userId ? choiceKey(e.id, userId) : '';
  const [myChoices, setMyChoices] = useState<Record<string, string>>(() => (storageKey ? readChoices(storageKey) : {}));
  useEffect(() => { setMyChoices(storageKey ? readChoices(storageKey) : {}); }, [storageKey]);

  const [confirming, setConfirming] = useState<{ p: GeneralPosition; c: GeneralCandidate } | null>(null);
  const [sending, setSending] = useState(false);

  const jump = (id: string) => document.getElementById(`pos-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const send = async () => {
    if (!confirming || sending) return;
    const { p, c } = confirming;
    setSending(true);
    try {
      await votePosition(e.id, p.id, c.id);
      if (storageKey) {
        const next = { ...readChoices(storageKey), [p.id]: c.id };
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage blocked */ }
        setMyChoices(next);
      }
      toast.success(`تم تسجيل صوتك لمنصب ${p.title}`);
      setConfirming(null);
      await reload();
      const next = votable.find(x => x.id !== p.id && !voted.has(x.id));
      if (next) setTimeout(() => jump(next.id), 300);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر تسجيل الصوت');
      setConfirming(null);
      void reload();
    } finally {
      setSending(false);
    }
  };

  const stateFor = (p: GeneralPosition, c: GeneralCandidate): CardState => {
    const votes = showVotes ? (c.votes ?? 0) : null;
    const total = showVotes ? p.candidates.reduce((s, x) => s + (x.votes ?? 0), 0) : 0;
    const top = showVotes ? Math.max(0, ...p.candidates.map(x => x.votes ?? 0)) : 0;
    const leaders = showVotes ? p.candidates.filter(x => (x.votes ?? 0) === top).length : 0;
    return {
      votes,
      pct: votes !== null && total > 0 ? Math.round((votes / total) * 100) : 0,
      leader: !isResults && votes !== null && top > 0 && votes === top && leaders === 1,
      winner: isResults && p.winner_application_id === c.id,
      myChoice: voted.has(p.id) && myChoices[p.id] === c.id,
    };
  };

  const actionFor = (p: GeneralPosition, c: GeneralCandidate) => {
    if (!isVoting) return null;
    if (!userId) {
      return <Link to="/auth" state={{ from: { pathname: '/elections' } }} className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[#211d45] dark:text-white font-black text-sm flex items-center justify-center gap-2"><LogIn className="w-4 h-4" /> سجّل الدخول للتصويت</Link>;
    }
    if (!e.my?.can_vote) return <p className="text-xs font-bold text-amber-700 bg-amber-50 rounded-xl px-3 py-2 text-center">{e.eligibility === 'approved' ? 'التصويت للأعضاء المعتمدين فقط' : 'حسابك غير مؤهل للتصويت'}</p>;
    if (voted.has(p.id)) {
      return myChoices[p.id] === c.id
        ? <p className="w-full py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-black text-sm flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> صوّتَّ لهذا المترشح</p>
        : <p className="w-full py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold text-sm text-center">تم التصويت في هذا المنصب</p>;
    }
    return (
      <button onClick={() => setConfirming({ p, c })}
        className="w-full py-3 rounded-2xl bg-[#211d45] hover:bg-[#2f2960] text-white font-black flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
        <Vote className="w-5 h-5" /> صوّت
      </button>
    );
  };

  const winners = isResults ? positions.filter(p => p.candidates.length > 0) : [];

  return (
    <div className="space-y-6">
      {/* Progress of my ballot + jump to a position */}
      {isVoting && (
        <div className="rounded-3xl bg-[#f6f5fb] dark:bg-slate-800/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-black text-lg text-[#211d45] dark:text-white flex items-center gap-2"><Vote className="w-5 h-5 text-[#ef8f88]" /> ورقة التصويت</h3>
            {canVote && votable.length > 0 && (
              <span className="text-sm font-black text-[#211d45] dark:text-white">صوّتَّ في {fmt(votedCount)} من {fmt(votable.length)} مناصب</span>
            )}
          </div>
          {canVote && votable.length > 0 && (
            <div className="h-2 rounded-full bg-white dark:bg-slate-900 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${(votedCount / votable.length) * 100}%` }} />
            </div>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400">اضغط «صوّت» على بطاقة المترشح الذي تختاره، ثم أكّد. لكل منصب صوت واحد لا يمكن تغييره، ويمكنك التصويت في جميع المناصب.</p>
          {!e.my?.can_vote && userId && (
            <p className="text-sm font-bold text-amber-700 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {e.eligibility === 'approved'
              ? 'التصويت متاح للأعضاء المعتمدين فقط. ستتمكن من التصويت فور اعتماد حسابك من إدارة الجمعية.'
              : 'حسابك غير مؤهل للتصويت في هذه الانتخابات.'}</p>
          )}
        </div>
      )}

      {isResults && winners.length > 0 && (
        <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/10 dark:to-slate-900 border border-amber-200/70 p-4">
          <h3 className="font-black text-lg text-[#211d45] dark:text-white mb-3 flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /> الفائزون</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {winners.map(p => {
              const w = p.candidates.find(c => c.id === p.winner_application_id);
              return (
                <li key={p.id}>
                  <button onClick={() => jump(p.id)} className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-white dark:bg-slate-900 text-start hover:shadow">
                    {w ? <Photo c={w} size="w-10 h-10" /> : <span className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Scale className="w-5 h-5 text-slate-500" /></span>}
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-500 truncate">{p.title}</span>
                      <span className="block font-black text-sm text-[#211d45] dark:text-white truncate">{w ? w.full_name : p.tie ? 'تعادل' : '—'}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Position chips */}
      <nav className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" aria-label="المناصب">
        {votable.map(p => (
          <button key={p.id} onClick={() => jump(p.id)}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold whitespace-nowrap flex items-center gap-1 ${voted.has(p.id) ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-[#211d45] dark:text-white'}`}>
            {voted.has(p.id) && <CheckCircle2 className="w-3.5 h-3.5" />}{p.title}
          </button>
        ))}
      </nav>

      {groups.map(g => (
        <div key={g.key} className="space-y-5">
          <p className="font-black text-[#e2706a] text-lg">{g.title}</p>
          {g.items.map(p => (
            <section key={p.id} id={`pos-${p.id}`} className="scroll-mt-24">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="text-lg sm:text-xl font-black text-[#211d45] dark:text-white flex items-center gap-2">
                  {voted.has(p.id) && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}{p.title}
                </h4>
                <span className="flex items-center gap-2 text-xs font-black">
                  <span className="px-2.5 py-1 rounded-full bg-[#fde8e6] text-[#211d45]">{candidatesLabel(p.candidates.length)}</span>
                  {showVotes && <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {fmt((p.voters_count ?? 0))} مصوّت</span>}
                </span>
              </div>
              {isResults && p.tie && (
                <p className="mb-3 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold text-sm flex items-center gap-2"><Scale className="w-5 h-5" /> تعادل في صدارة هذا المنصب، ويُحسم وفق قواعد الجمعية.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {p.candidates.map(c => <BallotCard key={c.id} c={c} position={p} state={stateFor(p, c)} action={actionFor(p, c)} />)}
              </div>
            </section>
          ))}
        </div>
      ))}
      {groups.length === 0 && <p className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/50 text-center font-bold text-slate-500">لا يوجد مترشحون معتمدون في هذه الانتخابات.</p>}

      {confirming && createPortal(
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm" onClick={() => !sending && setConfirming(null)} dir="rtl">
          <div onClick={ev => ev.stopPropagation()} role="alertdialog" aria-modal="true" aria-label="تأكيد التصويت"
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-[28px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#211d45] dark:text-white">تأكيد التصويت</h3>
              <button onClick={() => setConfirming(null)} disabled={sending} aria-label="إغلاق" className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#fde8e6] dark:bg-[#f7b2b0]/10">
              <Photo c={confirming.c} size="w-16 h-16" />
              <div className="min-w-0">
                <p className="font-black text-lg text-[#211d45] dark:text-white break-words">{confirming.c.full_name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">لمنصب: <b>{confirming.p.title}</b></p>
              </div>
            </div>
            <p className="text-sm text-slate-500 flex items-start gap-2"><ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" /> صوتك سري، ولا يمكن تعديله أو إلغاؤه بعد التأكيد.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(null)} disabled={sending} className="px-5 py-3 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800">رجوع</button>
              <button onClick={() => void send()} disabled={sending} className="flex-1 py-3 rounded-2xl bg-[#ef8f88] hover:bg-[#e2706a] text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Vote className="w-5 h-5" />} تأكيد وإرسال الصوت
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
