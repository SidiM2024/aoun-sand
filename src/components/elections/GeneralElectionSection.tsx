import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Award, CalendarClock, Camera, ClipboardList, Hourglass, Landmark, Loader2, LogIn,
  Megaphone, ShieldCheck, UserRound, Crop, Vote, X, AlertCircle, Trash2, Send, CreditCard as IdCardIcon, LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  PHASE_INFO, STATUS_INFO, STEPS, applyForPosition, fetchGeneralElections, formatMrDate,
  formatMrDateTime, formatMrTime, groupPositions, removeCandidatePhoto, removeUploadedPhoto, saveMyCandidatePhoto, uploadCandidatePhoto, votingStarted, withdrawApplication,
  type EditedPhoto, type GeneralElection, type MyApplication, type PhotoCrop, type UploadedPhoto,
} from '../../lib/generalElections';
import { CandidateElectionCard } from './CandidateElectionCard';
import { CandidateGallery } from './CandidateGallery';
import { PhotoCropEditor } from './PhotoCropEditor';
import { LiveStats, VotingBoard } from './VotingBoard';

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

// ─── Candidacy form ──────────────────────────────────────────────────────────

type ApplyStep = 'idle' | 'upload' | 'save';
const draftKey = (electionId: string, userId: string) => `candidacy_draft_${electionId}_${userId}`;

const ApplyModal = ({ election, onClose, onDone }: { election: GeneralElection; onClose: () => void; onDone: () => void }) => {
  const { user, userProfile } = useAuth();
  const applied = new Set(election.my?.applications.map(a => a.position_id) ?? []);
  const positions = election.positions.filter(p => p.is_active);
  const hasOther = positions.some(p => p.group_key === 'other');
  const key = user ? draftKey(election.id, user.id) : '';
  const draft = (() => {
    try { return key ? JSON.parse(sessionStorage.getItem(key) || 'null') as { name?: string; program?: string; positionId?: string; group?: string } | null : null; }
    catch { return null; }
  })();

  const [name, setName] = useState(draft?.name ?? userProfile?.full_name ?? '');
  const [photo, setPhoto] = useState<EditedPhoto | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<'empty' | 'processing' | 'ready' | 'error'>('empty');
  const [photoError, setPhotoError] = useState('');
  // Photo editor: opened on the picture just chosen, or on the original to adjust the crop.
  const [editing, setEditing] = useState<{ file: File; crop: PhotoCrop | null } | null>(null);
  const [group, setGroup] = useState<'executive' | 'committee' | 'other'>((draft?.group as 'executive' | 'committee' | 'other') ?? 'executive');
  const [positionId, setPositionId] = useState(draft?.positionId ?? '');
  const [program, setProgram] = useState(draft?.program ?? '');
  const [step, setStep] = useState<ApplyStep>('idle');
  const [tried, setTried] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = step !== 'idle';

  // One position per committee (its head): the committees are listed directly.
  const choices = positions.filter(p => p.group_key === group);
  const firstGroup = useRef(true);
  useEffect(() => { if (firstGroup.current) { firstGroup.current = false; return; } setPositionId(''); }, [group]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  // The text typed is kept for the session: a failed submission or a closed window loses nothing.
  useEffect(() => {
    if (!key) return;
    try { sessionStorage.setItem(key, JSON.stringify({ name, program, positionId, group })); } catch { /* storage blocked */ }
  }, [key, name, program, positionId, group]);

  const pickPhoto = (f: File) => { setPhotoError(''); setEditing({ file: f, crop: null }); };
  const editAgain = () => {
    if (photo?.original) setEditing({ file: new File([photo.original], 'original.jpg', { type: 'image/jpeg' }), crop: photo.params });
  };
  const onEdited = (p: EditedPhoto) => {
    setPhoto(p);
    setPreview(URL.createObjectURL(p.crop));
    setPhotoState('ready');
    setEditing(null);
  };

  const errors = {
    name: name.trim().length < 3 ? 'اكتب اسمك الكامل (3 أحرف على الأقل)' : '',
    photo: !photo ? (photoError || 'أضف صورتك الشخصية') : '',
    position: !positionId ? 'اختر المنصب المطلوب' : '',
    program: program.trim().length < 20 ? 'اكتب برنامجك الانتخابي (20 حرفًا على الأقل)' : '',
  };
  const firstError = Object.values(errors).find(Boolean);

  const submit = async () => {
    if (busy || !user) return;
    setTried(true);
    if (firstError) { toast.error(firstError); return; }
    let uploaded: UploadedPhoto | null = null;
    try {
      setStep('upload');
      uploaded = await uploadCandidatePhoto(photo!, user.id);
      setStep('save');
      await applyForPosition(election.id, positionId, { full_name: name.trim(), program: program.trim(), ...uploaded });
      try { sessionStorage.removeItem(key); } catch { /* storage blocked */ }
      toast.success('تم إرسال طلب ترشحك بنجاح، وهو قيد مراجعة الإدارة', { duration: 6000 });
      onDone();
      onClose();
    } catch (err) {
      if (uploaded) void removeUploadedPhoto(uploaded);
      toast.error(err instanceof Error ? err.message : 'تعذّر إرسال الطلب', { duration: 7000 });
    } finally {
      setStep('idle');
    }
  };

  const field = 'w-full px-4 py-3 rounded-2xl border bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-[#ef8f88]/50';
  const border = (bad: string) => (tried && bad ? 'border-red-400' : 'border-slate-200 dark:border-slate-700');
  const hint = (bad: string) => (tried && bad ? <span className="block text-xs font-bold text-red-600 mt-1">{bad}</span> : null);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4" dir="rtl" onClick={() => !busy && onClose()}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="استمارة الترشح"
        className="w-full sm:max-w-xl max-h-[94dvh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className={`${NAVY} text-white px-5 py-4 flex items-center justify-between`}>
          <h3 className="text-lg font-black flex items-center gap-2"><Send className="w-5 h-5 text-[#f7b2b0]" /> استمارة الترشح</h3>
          <button onClick={onClose} disabled={busy} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || photoState === 'processing'} aria-label="اختيار الصورة الشخصية"
                className={`relative w-28 h-28 rounded-full overflow-hidden bg-[#fde3e1] border-2 border-dashed flex items-center justify-center ${tried && errors.photo ? 'border-red-400' : 'border-[#ef8f88]'}`}>
                {photoState === 'processing'
                  ? <Loader2 className="w-8 h-8 animate-spin text-[#e2706a]" />
                  : preview ? <img src={preview} alt="الصورة الشخصية" className="w-full h-full object-cover" /> : <UserRound className="w-12 h-12 text-[#e2706a]" />}
                <span className="absolute bottom-0 inset-x-0 bg-[#211d45]/80 text-white text-xs font-bold py-1.5 flex items-center justify-center gap-1"><Camera className="w-3.5 h-3.5" /> {preview ? 'تغيير' : 'إضافة صورة'}</span>
              </button>
              {photoState === 'ready' && (
                <button type="button" onClick={editAgain} disabled={busy} className="mt-1.5 w-full py-1 rounded-xl text-[11px] font-black bg-[#29244C] text-white flex items-center justify-center gap-1">
                  <Crop className="w-3 h-3 text-[#F6B4A6]" /> تعديل الصورة
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (f) pickPhoto(f);
            }} />
            <label className="flex-1 block"><span className="block text-sm font-black mb-1.5">الاسم الكامل *</span>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={120} className={`${field} ${border(errors.name)}`} placeholder="الاسم كما سيظهر للمصوتين" />
              {hint(errors.name)}
            </label>
          </div>
          {photoState === 'error' && <p className="-mt-2 text-sm font-bold text-red-600 flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {photoError}</p>}
          {photoState !== 'error' && hint(errors.photo)}

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
            {hint(errors.position)}
          </div>

          <label className="block"><span className="block text-sm font-black mb-1.5">البرنامج الانتخابي *</span>
            <textarea value={program} onChange={e => setProgram(e.target.value)} rows={8} maxLength={5000} className={`${field} ${border(errors.program)} leading-relaxed`}
              placeholder={'مثال:\n1. الرؤية: …\n2. الأهداف: …\n3. أبرز المشاريع التي سأعمل عليها: …\n4. لماذا أترشح لهذا المنصب: …'} />
            <span className="flex justify-between text-xs mt-1">
              <span>{hint(errors.program)}</span>
              <span className={program.trim().length < 20 ? 'text-slate-400' : 'text-emerald-600 font-bold'}>{program.trim().length} / 5000</span>
            </span>
          </label>
        </div>
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {busy && (
            <p className="text-sm font-bold text-[#211d45] dark:text-white flex items-center gap-2 justify-center" role="status">
              <Loader2 className="w-4 h-4 animate-spin text-[#ef8f88]" /> {step === 'upload' ? 'جارٍ رفع الصورة… (1 من 2)' : 'جارٍ حفظ طلب الترشح… (2 من 2)'}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy} className="px-5 py-3 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800">إلغاء</button>
            <button onClick={() => void submit()} disabled={busy || photoState === 'processing'} className="flex-1 py-3 rounded-2xl font-black text-white bg-[#ef8f88] hover:bg-[#e2706a] disabled:opacity-60 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} إرسال طلب الترشح
            </button>
          </div>
        </div>
      </motion.div>
      {editing && (
        <PhotoCropEditor source={editing.file} initialCrop={editing.crop} title="صورة المترشح"
          onCancel={() => setEditing(null)} onSave={onEdited} />
      )}
    </div>
  );
};

// ─── One general election ────────────────────────────────────────────────────

const ElectionView = ({ e, offset, reload, lastUpdated, refreshing }: {
  e: GeneralElection; offset: number; reload: () => Promise<void>; lastUpdated: Date | null; refreshing: boolean;
}) => {
  const { user } = useAuth();
  const info = PHASE_INFO[e.phase];
  const isVoting = e.phase === 'voting';
  const positions = e.positions;
  const groups = groupPositions(positions);
  const [applyOpen, setApplyOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [myCard, setMyCard] = useState<MyApplication | null>(null);
  const [photoFor, setPhotoFor] = useState<MyApplication | null>(null);

  const savePhoto = async (a: MyApplication, p: EditedPhoto) => {
    if (!user) return;
    await saveMyCandidatePhoto(a.id, user.id, p);
    toast.success('تم حفظ صورتك الجديدة');
    setPhotoFor(null);
    await reload();
  };
  const [cardFilter, setCardFilter] = useState<string>('all');

  const withdraw = async (id: string) => {
    if (!window.confirm('سحب طلب الترشح نهائيًا؟')) return;
    setWithdrawing(id);
    const app = e.my?.applications.find(x => x.id === id);
    try { await withdrawApplication(id, app?.photo_original_path ?? null); toast.success('تم سحب الطلب'); reload(); }
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
          {votingStarted(e.phase) && <LiveStats e={e} lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={reload} />}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* My applications */}
        {!!e.my?.applications.length && (
          <div className="rounded-3xl border border-[#f7b2b0]/50 bg-[#fdf3f2] dark:bg-[#f7b2b0]/5 p-4">
            <h3 className="font-black text-[#211d45] dark:text-white mb-3 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-[#ef8f88]" /> طلبات ترشحي</h3>
            <ul className="space-y-2">
              {e.my.applications.map(a => {
                const canEditPhoto = !votingStarted(e.phase) && a.status !== 'rejected';
                return (
                <li key={a.id} className="p-2.5 rounded-2xl bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    {!isVoting && (
                      <button type="button" onClick={() => canEditPhoto && setPhotoFor(a)} disabled={!canEditPhoto} aria-label="تعديل الصورة"
                        className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden ring-2 ring-[#F6B4A6] disabled:cursor-default">
                        <img key={a.photo_url} src={a.photo_url} alt="" className="w-full h-full object-cover" />
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-[#211d45] dark:text-white truncate">{a.position_title}</p>
                      {a.review_note && <p className="text-xs text-slate-500">ملاحظة الإدارة: {a.review_note}</p>}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-black whitespace-nowrap ${STATUS_INFO[a.status].cls}`}>{STATUS_INFO[a.status].label}</span>
                  </div>
                  {(canEditPhoto || (!isVoting && a.status !== 'rejected') || (a.status === 'pending' && e.phase === 'nominations')) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 ps-[3.75rem]">
                      {canEditPhoto && (
                        <button onClick={() => setPhotoFor(a)} className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-[#F6B4A6] text-[#29244C] flex items-center gap-1 whitespace-nowrap">
                          <Crop className="w-3.5 h-3.5" /> تعديل الصورة
                        </button>
                      )}
                      {!isVoting && a.status !== 'rejected' && (
                        <button onClick={() => setMyCard(a)} className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-[#262150] text-white flex items-center gap-1 whitespace-nowrap">
                          <IdCardIcon className="w-3.5 h-3.5" /> بطاقتي
                        </button>
                      )}
                      {a.status === 'pending' && e.phase === 'nominations' && (
                        <button onClick={() => void withdraw(a.id)} disabled={withdrawing === a.id} aria-label="سحب الطلب" title="سحب الطلب" className="ms-auto p-2 rounded-xl text-red-500 hover:bg-red-50">
                          {withdrawing === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )}
                </li>
                );
              })}
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

        {/* Voting, closed voting and results: the electronic ballot / live results board. */}
        {votingStarted(e.phase) && <VotingBoard e={e} userId={user?.id ?? null} reload={reload} />}

        {/* Before voting: every approved candidate's card, for everyone. */}
        {!votingStarted(e.phase) && (() => {
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
        {photoFor && (
          <PhotoCropEditor key={photoFor.id} source={photoFor.photo_original_url || photoFor.photo_url} initialCrop={photoFor.photo_crop}
            title={`صورتي — ${photoFor.position_title}`} onCancel={() => setPhotoFor(null)} onSave={p => savePhoto(photoFor, p)} />
        )}
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

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const t0 = Date.now();
      const data = await fetchGeneralElections();
      if (data[0]) setOffset(new Date(data[0].server_now).getTime() - (t0 + Date.now()) / 2);
      setList(data);
      setError('');
      setLastUpdated(new Date());
      onLoaded?.(data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل الانتخابات');
      setList(cur => cur ?? []);
      onLoaded?.(0);
    } finally {
      setRefreshing(false);
    }
  }, [onLoaded]);

  // Live results: every 8 s while a vote is open, otherwise every 20 s (phases follow the clock).
  const liveVoting = !!list?.some(x => x.phase === 'voting');
  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, liveVoting ? 8000 : 20000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [load, user?.id, liveVoting]);

  const items = useMemo(() => list ?? [], [list]);
  if (list === null) return <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#ef8f88]" /></div>;
  if (error && items.length === 0) return error.includes('20261024') ? null : <p className="p-4 rounded-2xl bg-amber-50 text-amber-800 font-bold text-sm">{error}</p>;
  return <>{items.map(e => <ElectionView key={e.id} e={e} offset={offset} reload={load} lastUpdated={lastUpdated} refreshing={refreshing} />)}</>;
};
