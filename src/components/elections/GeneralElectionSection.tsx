import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Award, CalendarClock, Camera, CheckCircle2, ClipboardList, FileText, Hourglass, Landmark, Loader2, LogIn,
  Megaphone, Scale, ShieldCheck, Trophy, UserRound, Users, Vote, X, AlertCircle, Trash2, Send, CreditCard as IdCardIcon, LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  PHASE_INFO, STATUS_INFO, STEPS, applyForPosition, candidatesLabel, fetchGeneralElections, formatMrDate,
  formatMrDateTime, formatMrTime, groupPositions, removeCandidatePhoto, uploadCandidatePhoto, votePosition, withdrawApplication,
  type GeneralCandidate, type GeneralElection, type GeneralPosition, type MyApplication,
} from '../../lib/generalElections';
import { CandidateElectionCard } from './CandidateElectionCard';
import { CandidateGallery } from './CandidateGallery';

const NAVY = 'bg-[#211d45]';

// ─── Countdown (synchronised with the server clock) ──────────────────────────

const Countdown = ({ to, offset, label, onDone }: { to: string; offset: number; label: string; onDone: () => void }) => {
  const [now, setNow] = useState(() => Date.now() + offset);
  const fired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);
  const ms = Math.max(0, new Date(to).getTime() - now);
  useEffect(() => {
    if (ms === 0 && !fired.current) { fired.current = true; setTimeout(onDone, 1500); }
  }, [ms, onDone]);
  const parts = [
    { v: Math.floor(ms / 86400000), l: 'يوم' },
    { v: Math.floor(ms / 3600000) % 24, l: 'ساعة' },
    { v: Math.floor(ms / 60000) % 60, l: 'دقيقة' },
    { v: Math.floor(ms / 1000) % 60, l: 'ثانية' },
  ];
  return (
    <div className="text-center">
      <p className="text-sm font-bold text-white/80 mb-2">{label}</p>
      <div className="flex justify-center gap-2 sm:gap-3" dir="ltr">
        {parts.map(p => (
          <div key={p.l} className="w-16 sm:w-20 rounded-2xl bg-white/10 border border-white/15 py-2.5 backdrop-blur">
            <div className="text-2xl sm:text-3xl font-black tabular-nums text-white">{String(p.v).padStart(2, '0')}</div>
            <div className="text-[11px] font-bold text-[#f7b2b0]" dir="rtl">{p.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Phase stepper ───────────────────────────────────────────────────────────

const Stepper = ({ step }: { step: number }) => (
  <ol className="grid grid-cols-5 gap-1.5 mt-5">
    {STEPS.map((s, i) => {
      const n = i + 1;
      const state = n < step ? 'done' : n === step ? 'current' : 'next';
      return (
        <li key={s} className="text-center">
          <div className={`h-1.5 rounded-full ${state === 'next' ? 'bg-white/15' : state === 'current' ? 'bg-[#f7b2b0]' : 'bg-emerald-400'}`} />
          <span className={`block mt-1.5 text-[10px] sm:text-xs font-bold ${state === 'next' ? 'text-white/45' : 'text-white'}`}>{s}</span>
        </li>
      );
    })}
  </ol>
);

// ─── Program dialog ──────────────────────────────────────────────────────────

const ProgramDialog = ({ c, position, onClose }: { c: GeneralCandidate; position: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4" onClick={onClose} dir="rtl">
    <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
      className="w-full sm:max-w-lg max-h-[88vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl">
      <div className={`${NAVY} text-white p-5 flex items-center gap-4 sticky top-0`}>
        {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="w-16 h-16 rounded-2xl object-cover border-2 border-[#f7b2b0]" />}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black truncate">{c.full_name}</h3>
          <p className="text-sm text-[#f7b2b0] font-bold">مترشح لمنصب: {position}</p>
        </div>
        <button onClick={onClose} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5">
        <h4 className="font-black text-[#211d45] dark:text-white mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-[#ef8f88]" /> البرنامج الانتخابي</h4>
        <p className="text-slate-700 dark:text-slate-200 leading-loose whitespace-pre-wrap">{c.program}</p>
      </div>
    </motion.div>
  </div>
);

// ─── Candidate card ──────────────────────────────────────────────────────────

const CandidateCard = ({ c, position, selectable, selected, onSelect, result }: {
  c: GeneralCandidate; position: string; selectable: boolean; selected: boolean; onSelect: () => void;
  result?: { pct: number; winner: boolean; tied: boolean };
}) => {
  const [showProgram, setShowProgram] = useState(false);
  return (
    <div className={`relative rounded-3xl bg-white dark:bg-slate-900 border-2 p-3 transition-all ${selected ? 'border-[#ef8f88] shadow-lg shadow-[#ef8f88]/25' : result?.winner ? 'border-amber-300' : 'border-slate-100 dark:border-slate-800'}`}>
      {result?.winner && <span className="absolute -top-3 start-3 px-3 py-1 rounded-full bg-amber-400 text-[#211d45] text-xs font-black flex items-center gap-1 z-10"><Trophy className="w-3.5 h-3.5" /> الفائز</span>}
      {result?.tied && <span className="absolute -top-3 start-3 px-3 py-1 rounded-full bg-slate-700 text-white text-xs font-black flex items-center gap-1 z-10"><Scale className="w-3.5 h-3.5" /> تعادل</span>}
      <div className="flex gap-3">
        <div className="w-24 h-28 rounded-2xl overflow-hidden bg-[#fde3e1] shrink-0">
          {c.photo_url ? <img src={c.photo_url} alt={c.full_name} loading="lazy" className="w-full h-full object-cover" /> : <UserRound className="w-full h-full p-6 text-[#e2706a]" />}
        </div>
        <div className="min-w-0 flex-1 flex flex-col">
          <h4 className="font-black text-[#211d45] dark:text-white leading-snug">{c.full_name}</h4>
          <p className="text-xs font-bold text-[#e2706a] mt-0.5">{position}</p>
          <button onClick={() => setShowProgram(true)} className="mt-auto self-start px-3 py-1.5 rounded-xl text-xs font-black bg-[#fde8e6] text-[#211d45] dark:bg-[#f7b2b0]/15 dark:text-[#f7b2b0] flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> عرض البرنامج الانتخابي
          </button>
        </div>
      </div>
      {result && (
        <div className="mt-3">
          <div className="flex justify-between text-sm font-black mb-1">
            <span className="text-[#211d45] dark:text-white">{c.votes ?? 0} صوت</span>
            <span className="text-slate-500">{result.pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${result.pct}%` }} transition={{ duration: 0.8 }} className={`h-full rounded-full ${result.winner ? 'bg-amber-400' : 'bg-[#ef8f88]'}`} />
          </div>
        </div>
      )}
      {selectable && (
        <button onClick={onSelect} aria-pressed={selected}
          className={`mt-3 w-full py-2.5 rounded-2xl font-black flex items-center justify-center gap-2 transition-colors ${selected ? 'bg-[#ef8f88] text-white' : 'bg-[#fde3e1] text-[#211d45] hover:bg-[#fbd0cc]'}`}>
          {selected ? <><CheckCircle2 className="w-5 h-5" /> تم الاختيار</> : 'اختيار هذا المترشح'}
        </button>
      )}
      <AnimatePresence>{showProgram && <ProgramDialog c={c} position={position} onClose={() => setShowProgram(false)} />}</AnimatePresence>
    </div>
  );
};

// ─── Candidacy form ──────────────────────────────────────────────────────────

const ApplyModal = ({ election, onClose, onDone }: { election: GeneralElection; onClose: () => void; onDone: () => void }) => {
  const { user, userProfile } = useAuth();
  const applied = new Set(election.my?.applications.map(a => a.position_id) ?? []);
  const positions = election.positions.filter(p => p.is_active);
  const hasOther = positions.some(p => p.group_key === 'other');

  const [name, setName] = useState(userProfile?.full_name ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [group, setGroup] = useState<'executive' | 'committee' | 'other'>('executive');
  const [positionId, setPositionId] = useState('');
  const [program, setProgram] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // One position per committee (its head): the committees are listed directly.
  const choices = positions.filter(p => p.group_key === group);
  useEffect(() => { setPositionId(''); }, [group]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);


  const submit = async () => {
    if (busy || !user) return;
    if (name.trim().length < 3) { toast.error('اكتب اسمك الكامل'); return; }
    if (!photo) { toast.error('أضف صورتك الشخصية'); return; }
    if (!positionId) { toast.error('اختر المنصب المطلوب'); return; }
    if (program.trim().length < 20) { toast.error('اكتب برنامجك الانتخابي (20 حرفًا على الأقل)'); return; }
    setBusy(true);
    let uploaded: { url: string; path: string } | null = null;
    try {
      uploaded = await uploadCandidatePhoto(photo, user.id);
      await applyForPosition(election.id, positionId, { full_name: name.trim(), photo_url: uploaded.url, photo_path: uploaded.path, program: program.trim() });
      toast.success('تم إرسال طلب ترشحك بنجاح، وهو قيد مراجعة الإدارة', { duration: 6000 });
      onDone();
      onClose();
    } catch (err) {
      if (uploaded) void removeCandidatePhoto(uploaded.path);
      toast.error(err instanceof Error ? err.message : 'تعذّر إرسال الطلب');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-[#ef8f88]/50';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4" dir="rtl" onClick={() => !busy && onClose()}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        className="w-full sm:max-w-xl max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className={`${NAVY} text-white px-5 py-4 flex items-center justify-between`}>
          <h3 className="text-lg font-black flex items-center gap-2"><Send className="w-5 h-5 text-[#f7b2b0]" /> استمارة الترشح</h3>
          <button onClick={onClose} disabled={busy} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => fileRef.current?.click()} className="relative w-28 h-32 rounded-3xl overflow-hidden bg-[#fde3e1] border-2 border-dashed border-[#ef8f88] shrink-0 flex items-center justify-center">
              {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <UserRound className="w-12 h-12 text-[#e2706a]" />}
              <span className="absolute bottom-0 inset-x-0 bg-[#211d45]/80 text-white text-xs font-bold py-1.5 flex items-center justify-center gap-1"><Camera className="w-3.5 h-3.5" /> {preview ? 'تغيير' : 'إضافة صورة'}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (f) { setPhoto(f); setPreview(URL.createObjectURL(f)); }
            }} />
            <label className="flex-1 block"><span className="block text-sm font-black mb-1.5">الاسم الكامل *</span>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={120} className={field} placeholder="الاسم كما سيظهر للمصوتين" /></label>
          </div>

          <div>
            <span className="block text-sm font-black mb-2">المنصب المطلوب *</span>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {([['executive', 'المكتب التنفيذي'], ['committee', 'اللجان'], ...(hasOther ? [['other', 'مناصب أخرى']] : [])] as [typeof group, string][]).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setGroup(k)} aria-pressed={group === k}
                  className={`py-2.5 rounded-2xl font-black text-sm border-2 ${group === k ? 'border-[#211d45] bg-[#211d45] text-white' : 'border-slate-200 dark:border-slate-700'}`}>{l}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {choices.map(p => {
                const done = applied.has(p.id);
                return (
                  <button key={p.id} type="button" disabled={done} onClick={() => setPositionId(p.id)} aria-pressed={positionId === p.id}
                    className={`p-3 rounded-2xl border-2 text-start font-bold text-sm disabled:opacity-50 ${positionId === p.id ? 'border-[#ef8f88] bg-[#fde8e6] dark:bg-[#f7b2b0]/10' : 'border-slate-200 dark:border-slate-700'}`}>
                    {p.title}
                    {done && <span className="block text-xs font-medium text-slate-500 mt-0.5">قدّمت طلبًا لهذا المنصب</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block"><span className="block text-sm font-black mb-1.5">البرنامج الانتخابي *</span>
            <textarea value={program} onChange={e => setProgram(e.target.value)} rows={8} maxLength={5000} className={`${field} leading-relaxed`}
              placeholder={'مثال:\n1. الرؤية: …\n2. الأهداف: …\n3. أبرز المشاريع التي سأعمل عليها: …\n4. لماذا أترشح لهذا المنصب: …'} />
            <span className="block text-xs text-slate-400 mt-1 text-start">{program.trim().length} / 5000</span>
          </label>
        </div>
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button onClick={onClose} disabled={busy} className="px-5 py-3 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800">إلغاء</button>
          <button onClick={() => void submit()} disabled={busy} className="flex-1 py-3 rounded-2xl font-black text-white bg-[#ef8f88] hover:bg-[#e2706a] disabled:opacity-60 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} إرسال طلب الترشح
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── One general election ────────────────────────────────────────────────────

const ElectionView = ({ e, offset, reload }: { e: GeneralElection; offset: number; reload: () => void }) => {
  const { user } = useAuth();
  const info = PHASE_INFO[e.phase];
  const isResults = e.phase === 'results';
  const isVoting = e.phase === 'voting';
  const positions = e.positions;
  const groups = groupPositions(positions);
  const voted = new Set(e.my?.voted_position_ids ?? []);
  const [applyOpen, setApplyOpen] = useState(false);
  const [selectedPos, setSelectedPos] = useState<string>(positions[0]?.id ?? '');
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<GeneralPosition | null>(null);
  const [sending, setSending] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [myCard, setMyCard] = useState<MyApplication | null>(null);
  const [cardFilter, setCardFilter] = useState<string>('all');
  const posRef = useRef<HTMLDivElement>(null);

  const current = positions.find(p => p.id === selectedPos) ?? positions[0];
  const canVote = isVoting && !!user && !!e.my?.can_vote;

  const pick = (id: string) => { setSelectedPos(id); setTimeout(() => posRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };

  const sendVote = async () => {
    if (!confirming || sending) return;
    const appId = choice[confirming.id];
    setSending(true);
    try {
      await votePosition(e.id, confirming.id, appId);
      toast.success('تم تسجيل صوتك بنجاح');
      setConfirming(null);
      reload();
      // Move on to the next position not voted yet.
      const next = positions.find(p => p.id !== confirming.id && !voted.has(p.id) && p.candidates.length > 0);
      if (next) setSelectedPos(next.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر تسجيل الصوت');
      setConfirming(null);
      reload();
    } finally {
      setSending(false);
    }
  };

  const withdraw = async (id: string) => {
    if (!window.confirm('سحب طلب الترشح نهائيًا؟')) return;
    setWithdrawing(id);
    try { await withdrawApplication(id); toast.success('تم سحب الطلب'); reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'تعذّر سحب الطلب'); }
    finally { setWithdrawing(null); }
  };

  const banner = (() => {
    switch (e.phase) {
      case 'setup': return { icon: Hourglass, text: 'سيتم الإعلان عن مواعيد الترشح قريبًا.' };
      case 'nominations_upcoming': return { icon: CalendarClock, text: `يُفتح باب الترشح بتاريخ ${formatMrDate(e.nominations_start_at!)} على الساعة ${formatMrTime(e.nominations_start_at!)}.` };
      case 'nominations': return { icon: Megaphone, text: `باب الترشح مفتوح حتى ${formatMrDateTime(e.nominations_end_at!)}. يمكن لكل عضو مسجل تقديم طلب ترشح من حسابه.` };
      case 'nominations_closed': return { icon: ClipboardList, text: 'انتهت مرحلة الترشح، وسيتم الإعلان عن موعد التصويت قريبًا.' };
      case 'voting_scheduled': return { icon: CalendarClock, text: `سيبدأ التصويت في انتخابات جمعية عون وسند الخيرية بتاريخ ${formatMrDate(e.voting_start_at!)} على الساعة ${formatMrTime(e.voting_start_at!)}.` };
      case 'voting': return { icon: Vote, text: e.voting_end_at
        ? `التصويت مفتوح حتى ${formatMrDateTime(e.voting_end_at)}. لكل عضو مؤهل صوت واحد في كل منصب.`
        : 'التصويت مفتوح الآن حتى تعلن إدارة الجمعية إغلاقه. لكل عضو مؤهل صوت واحد في كل منصب.' };
      case 'voting_closed': return { icon: Hourglass, text: 'انتهت عملية التصويت، وسيتم إعلان النتائج الرسمية قريبًا.' };
      case 'results': return { icon: Award, text: 'النتائج الرسمية لانتخابات جمعية عون وسند الخيرية.' };
    }
  })();

  const countdown = e.phase === 'nominations_upcoming' ? { to: e.nominations_start_at!, label: 'يُفتح باب الترشح بعد' }
    : e.phase === 'nominations' ? { to: e.nominations_end_at!, label: 'يُغلق باب الترشح بعد' }
    : e.phase === 'voting_scheduled' ? { to: e.voting_start_at!, label: 'يبدأ التصويت بعد' }
    : e.phase === 'voting' && e.voting_end_at ? { to: e.voting_end_at, label: 'ينتهي التصويت بعد' } : null;

  const resultFor = (p: GeneralPosition, c: GeneralCandidate) => {
    const total = p.voters_count ?? 0;
    const tied = !!p.tie && (c.votes ?? 0) === p.top_votes;
    return { pct: total > 0 ? Math.round(((c.votes ?? 0) / total) * 100) : 0, winner: p.winner_application_id === c.id, tied };
  };

  return (
    <section className="rounded-[32px] overflow-hidden bg-white dark:bg-slate-900 shadow-xl shadow-[#211d45]/10 border border-slate-100 dark:border-slate-800">
      {/* Hero */}
      <div className={`${NAVY} text-white p-5 sm:p-7 relative overflow-hidden`}>
        <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-[#ef8f88]/20 blur-2xl" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-[#f7b2b0] text-[#211d45] text-xs font-black flex items-center gap-1"><Landmark className="w-3.5 h-3.5" /> الانتخابات العامة</span>
            <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-black">{info.label}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black leading-tight">{e.title}</h2>
          {e.description && <p className="text-white/75 mt-2 leading-relaxed whitespace-pre-wrap">{e.description}</p>}
          {info.step > 0 && <Stepper step={info.step} />}
          <div className="mt-5 p-4 rounded-2xl bg-white/10 border border-white/10 flex items-start gap-3">
            <banner.icon className="w-6 h-6 text-[#f7b2b0] shrink-0 mt-0.5" />
            <p className="font-bold leading-relaxed">{banner.text}</p>
          </div>
          {countdown && <div className="mt-5"><Countdown key={countdown.to} to={countdown.to} offset={offset} label={countdown.label} onDone={reload} /></div>}
          {e.phase === 'nominations' && (
            <div className="mt-5 flex justify-center">
              {!user ? (
                <Link to="/auth" state={{ from: { pathname: '/elections' } }} className="px-6 py-3.5 rounded-2xl bg-[#ef8f88] text-white font-black flex items-center gap-2"><LogIn className="w-5 h-5" /> سجّل الدخول للترشح</Link>
              ) : e.my?.can_apply ? (
                <button onClick={() => setApplyOpen(true)} className="px-8 py-4 rounded-2xl bg-[#ef8f88] hover:bg-[#e2706a] text-white text-lg font-black shadow-lg shadow-black/20 flex items-center gap-2"><Send className="w-5 h-5" /> ترشح الآن</button>
              ) : (
                <p className="text-sm font-bold text-amber-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> حسابك غير مؤهل للترشح.</p>
              )}
            </div>
          )}
          {isVoting && user && !e.my?.can_vote && (
            <p className="mt-4 text-sm font-bold text-amber-200 flex items-center gap-2 justify-center"><AlertCircle className="w-4 h-4" /> حسابك غير مؤهل للتصويت في هذه الانتخابات{e.eligibility === 'approved' ? ' (يشترط عضو معتمد)' : ''}.</p>
          )}
          {isVoting && !user && (
            <div className="mt-4 flex justify-center"><Link to="/auth" state={{ from: { pathname: '/elections' } }} className="px-5 py-3 rounded-2xl bg-[#ef8f88] font-black flex items-center gap-2"><LogIn className="w-5 h-5" /> سجّل الدخول للتصويت</Link></div>
          )}
          {(isVoting || isResults || e.phase === 'voting_closed') && e.voters_total !== null && (
            <p className="mt-4 text-center text-sm text-white/75 flex items-center justify-center gap-1.5"><Users className="w-4 h-4" /> عدد المشاركين في التصويت: <b className="text-white">{e.voters_total}</b></p>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* My applications */}
        {!!e.my?.applications.length && (
          <div className="rounded-3xl border border-[#f7b2b0]/50 bg-[#fdf3f2] dark:bg-[#f7b2b0]/5 p-4">
            <h3 className="font-black text-[#211d45] dark:text-white mb-3 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-[#ef8f88]" /> طلبات ترشحي</h3>
            <ul className="space-y-2">
              {e.my.applications.map(a => (
                <li key={a.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-white dark:bg-slate-900">
                  {!isVoting && <img src={a.photo_url} alt="" className="w-11 h-11 rounded-xl object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-[#211d45] dark:text-white truncate">{a.position_title}</p>
                    {a.review_note && <p className="text-xs text-slate-500">ملاحظة الإدارة: {a.review_note}</p>}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-black whitespace-nowrap ${STATUS_INFO[a.status].cls}`}>{STATUS_INFO[a.status].label}</span>
                  {!isVoting && a.status !== 'rejected' && (
                    <button onClick={() => setMyCard(a)} className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-[#262150] text-white flex items-center gap-1 whitespace-nowrap">
                      <IdCardIcon className="w-3.5 h-3.5" /> بطاقتي
                    </button>
                  )}
                  {a.status === 'pending' && e.phase === 'nominations' && (
                    <button onClick={() => void withdraw(a.id)} disabled={withdrawing === a.id} aria-label="سحب الطلب" title="سحب الطلب" className="p-2 rounded-xl text-red-500 hover:bg-red-50">
                      {withdrawing === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Positions overview */}
        {(e.phase === 'nominations' || e.phase === 'nominations_upcoming') && (
          <div>
            <h3 className="font-black text-lg text-[#211d45] dark:text-white mb-3">المناصب المتاحة للترشح</h3>
            {groups.map(g => (
              <div key={g.key} className="mb-3">
                <p className="text-sm font-black text-[#e2706a] mb-2">{g.title}</p>
                <div className="flex flex-wrap gap-2">
                  {g.items.map(p => <span key={p.id} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold">{p.title}</span>)}
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500 mt-2">تظهر بطاقة المترشح للجميع فور موافقة الإدارة على طلبه.</p>
          </div>
        )}

        {isResults && (
          <>
            <div>
              <h3 className="font-black text-lg text-[#211d45] dark:text-white mb-3 flex items-center gap-2">
                {isResults ? <><Trophy className="w-5 h-5 text-amber-500" /> النتائج حسب المنصب</> : <><Users className="w-5 h-5 text-[#ef8f88]" /> المناصب والمترشحون</>}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {groups.map(g => (
                  <div key={g.key} className="rounded-3xl bg-slate-50 dark:bg-slate-800/50 p-4">
                    <p className="font-black text-[#211d45] dark:text-white mb-2">{g.title}</p>
                    <ul className="space-y-1.5">
                      {g.items.map(p => {
                        const winner = isResults ? p.candidates.find(c => c.id === p.winner_application_id) : null;
                        return (
                          <li key={p.id}>
                            <button onClick={() => pick(p.id)} className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm text-start transition-colors ${current?.id === p.id ? 'bg-[#211d45] text-white' : 'bg-white dark:bg-slate-900 hover:bg-[#fde8e6]'}`}>
                              <span className="font-bold">{p.title}</span>
                              <span className={`text-xs font-black whitespace-nowrap flex items-center gap-1 ${current?.id === p.id ? 'text-[#f7b2b0]' : 'text-slate-500'}`}>
                                {voted.has(p.id) && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                                {isResults ? (p.tie ? 'تعادل' : winner ? winner.full_name : '—') : candidatesLabel(p.candidates_count ?? 0)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {current && (
              <div ref={posRef} className="scroll-mt-24">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-xl font-black text-[#211d45] dark:text-white">{current.title}</h3>
                  <span className="px-3 py-1 rounded-full bg-[#fde8e6] text-[#211d45] text-xs font-black">{candidatesLabel(current.candidates_count ?? 0)}</span>
                </div>
                {isResults && current.tie && (
                  <p className="mb-3 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold text-sm flex items-center gap-2"><Scale className="w-5 h-5" /> تعادل في صدارة هذا المنصب، ويُحسم وفق قواعد الجمعية.</p>
                )}
                {isResults && <p className="mb-3 text-sm text-slate-500">عدد المصوتين لهذا المنصب: {current.voters_count ?? 0}</p>}
                {isVoting && voted.has(current.id) && (
                  <p className="mb-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> صوّتّ لهذا المنصب. صوتك سري ولا يمكن تغييره.</p>
                )}
                {current.candidates.length === 0 ? (
                  <p className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/50 text-center font-bold text-slate-500">لا يوجد مترشحون لهذا المنصب</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {current.candidates.map(c => (
                      <CandidateCard key={c.id} c={c} position={current.title}
                        selectable={canVote && !voted.has(current.id)} selected={choice[current.id] === c.id}
                        onSelect={() => setChoice(ch => ({ ...ch, [current.id]: c.id }))}
                        result={isResults ? resultFor(current, c) : undefined} />
                    ))}
                  </div>
                )}
                {canVote && !voted.has(current.id) && current.candidates.length > 0 && (
                  <div className="sticky bottom-[calc(80px+env(safe-area-inset-bottom))] mt-4 z-10">
                    <button onClick={() => setConfirming(current)} disabled={!choice[current.id]}
                      className={`w-full py-4 rounded-2xl ${NAVY} text-white font-black text-lg shadow-xl disabled:opacity-50 flex items-center justify-center gap-2`}>
                      <Vote className="w-5 h-5" /> تأكيد صوتي لمنصب {current.title}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Voting open: only the voting form (names), no cards / photos / programmes. */}
        {isVoting && (
          <div className="space-y-4">
            <h3 className="font-black text-lg text-[#211d45] dark:text-white flex items-center gap-2"><Vote className="w-5 h-5 text-[#ef8f88]" /> ورقة التصويت</h3>
            <p className="text-sm text-slate-500">اختر مترشحًا واحدًا في كل منصب ثم أكّد صوتك. يمكنك التصويت في جميع المناصب، ولكل منصب صوت واحد فقط.</p>
            {groups.map(g => (
              <div key={g.key} className="space-y-3">
                <p className="font-black text-[#e2706a]">{g.title}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {g.items.map(p => {
                    const done = voted.has(p.id);
                    return (
                      <div key={p.id} className={`rounded-3xl border-2 p-4 ${done ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <h4 className="font-black text-[#211d45] dark:text-white">{p.title}</h4>
                          {done
                            ? <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> تم التصويت</span>
                            : <span className="text-xs font-bold text-slate-500">{candidatesLabel(p.candidates.length)}</span>}
                        </div>
                        {p.candidates.length === 0 ? (
                          <p className="text-sm text-slate-500">لا يوجد مترشحون لهذا المنصب</p>
                        ) : done ? (
                          <p className="text-sm text-emerald-700 dark:text-emerald-300">صوتك سري ولا يمكن تغييره.</p>
                        ) : (
                          <>
                            <div className="space-y-2" role="radiogroup" aria-label={p.title}>
                              {p.candidates.map(c => (
                                <label key={c.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 cursor-pointer transition-colors ${choice[p.id] === c.id ? 'border-[#ef8f88] bg-[#fde8e6] dark:bg-[#f7b2b0]/10' : 'border-slate-100 dark:border-slate-800'} ${canVote ? '' : 'opacity-60 cursor-not-allowed'}`}>
                                  <input type="radio" name={`vote-${p.id}`} disabled={!canVote} checked={choice[p.id] === c.id}
                                    onChange={() => setChoice(ch => ({ ...ch, [p.id]: c.id }))} className="w-5 h-5 accent-[#ef8f88]" />
                                  <span className="font-bold text-[#211d45] dark:text-white">{c.full_name}</span>
                                </label>
                              ))}
                            </div>
                            {canVote && (
                              <button onClick={() => setConfirming(p)} disabled={!choice[p.id]}
                                className={`mt-3 w-full py-3 rounded-2xl ${NAVY} text-white font-black disabled:opacity-40 flex items-center justify-center gap-2`}>
                                <Vote className="w-5 h-5" /> تأكيد صوتي
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Before voting / after it closes: every approved candidate's card, for everyone. */}
        {!isVoting && !isResults && (() => {
          const all = positions.flatMap(p => p.candidates.map(c => ({ c, p })));
          const shown = cardFilter === 'all' ? all : all.filter(x => x.p.id === cardFilter);
          return (
            <div>
              <div className="mb-3">
                <h3 className="font-black text-lg text-[#211d45] dark:text-white flex items-center gap-2"><LayoutGrid className="w-5 h-5 text-[#ef8f88]" /> بطاقات المترشحين</h3>
                {all.length > 0 && <p className="text-sm text-slate-500 mt-1">اطّلع على برامج المترشحين قبل التصويت، وشارك صورة أي بطاقة مباشرة من هاتفك.</p>}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
                <button onClick={() => setCardFilter('all')} aria-pressed={cardFilter === 'all'}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold whitespace-nowrap ${cardFilter === 'all' ? 'bg-[#211d45] text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>الكل ({all.length})</button>
                {positions.filter(p => p.candidates.length > 0 || cardFilter === p.id).map(p => (
                  <button key={p.id} onClick={() => setCardFilter(p.id)} aria-pressed={cardFilter === p.id}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold whitespace-nowrap ${cardFilter === p.id ? 'bg-[#211d45] text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    {p.title} <span className="opacity-70">({p.candidates.length})</span>
                  </button>
                ))}
              </div>
              {shown.length === 0 ? (
                <p className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/50 text-center font-bold text-slate-500">
                  {cardFilter === 'all' ? 'لم تُعتمد أي بطاقة مترشح بعد.' : 'لا يوجد مترشحون لهذا المنصب'}
                </p>
              ) : (
                <CandidateGallery items={shown.map(({ c, p }) => ({ candidate: c, positionTitle: p.title }))} electionTitle={e.title} />
              )}
            </div>
          );
        })()}

        <p className="text-xs text-slate-500 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600" /> تصويت سري: تُحفظ الأصوات دون ربطها بهوية المصوّت، ولا يمكن تعديلها. جميع المواعيد بتوقيت موريتانيا.</p>
      </div>

      <AnimatePresence>
        {applyOpen && <ApplyModal election={e} onClose={() => setApplyOpen(false)} onDone={reload} />}
        {myCard && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-950/75 p-3 overflow-y-auto" onClick={() => setMyCard(null)} dir="rtl">
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={ev => ev.stopPropagation()} className="w-full max-w-md my-6 relative" role="dialog" aria-modal="true" aria-label="بطاقتي">
              <button onClick={() => setMyCard(null)} aria-label="إغلاق" className="absolute -top-3 -left-3 z-10 w-10 h-10 rounded-full bg-white text-[#262150] shadow-lg flex items-center justify-center"><X className="w-5 h-5" /></button>
              <CandidateElectionCard id={myCard.id} fullName={myCard.full_name} photoUrl={myCard.photo_url} program={myCard.program}
                positionTitle={myCard.position_title} electionTitle={e.title} expanded
                shareable={myCard.status === 'approved'}
                statusNote={myCard.status === 'approved' ? undefined : 'بطاقتك قيد مراجعة الإدارة، وستظهر للجميع ويمكن مشاركتها بعد الموافقة.'} />
            </motion.div>
          </div>
        )}
        {confirming && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => !sending && setConfirming(null)} dir="rtl">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={ev => ev.stopPropagation()} role="alertdialog" aria-modal="true"
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4">
              <h3 className="text-xl font-black text-[#211d45] dark:text-white">تأكيد التصويت</h3>
              {(() => {
                const c = confirming.candidates.find(x => x.id === choice[confirming.id]);
                return c ? (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#fde8e6] dark:bg-[#f7b2b0]/10">
                    <div><p className="font-black text-[#211d45] dark:text-white">{c.full_name}</p><p className="text-sm text-slate-600 dark:text-slate-300">لمنصب: {confirming.title}</p></div>
                  </div>
                ) : null;
              })()}
              <p className="text-sm text-slate-500 flex items-start gap-2"><ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" /> صوتك سري، ولا يمكن تعديله أو إلغاؤه بعد التأكيد.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(null)} disabled={sending} className="px-5 py-3 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800">رجوع</button>
                <button onClick={() => void sendVote()} disabled={sending} className="flex-1 py-3 rounded-2xl bg-[#ef8f88] text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                  {sending && <Loader2 className="w-5 h-5 animate-spin" />} تأكيد وإرسال الصوت
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};

/** All published general elections, refreshed automatically (phases change with the clock). */
export const GeneralElectionSection = ({ onLoaded }: { onLoaded?: (count: number) => void }) => {
  const { user } = useAuth();
  const [list, setList] = useState<GeneralElection[] | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const t0 = Date.now();
      const data = await fetchGeneralElections();
      if (data[0]) setOffset(new Date(data[0].server_now).getTime() - (t0 + Date.now()) / 2);
      setList(data);
      setError('');
      onLoaded?.(data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل الانتخابات');
      setList(cur => cur ?? []);
      onLoaded?.(0);
    }
  }, [onLoaded]);

  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 20000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [load, user?.id]);

  const items = useMemo(() => list ?? [], [list]);
  if (list === null) return <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#ef8f88]" /></div>;
  if (error && items.length === 0) return error.includes('20261024') ? null : <p className="p-4 rounded-2xl bg-amber-50 text-amber-800 font-bold text-sm">{error}</p>;
  return <>{items.map(e => <ElectionView key={e.id} e={e} offset={offset} reload={() => void load()} />)}</>;
};
