import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowRight, CalendarClock, CheckCircle2, ClipboardList, Eye, EyeOff, FileText, History, Landmark, Loader2, Plus, RefreshCw,
  RotateCcw, Save, Scale, Square, Trash2, Trophy, Users, XCircle, Megaphone, Play, Power, X,
} from 'lucide-react';
import {
  LOG_LABELS, PHASE_INFO, STATUS_INFO, STEPS, adminCreateGeneral, adminDeleteGeneral, adminDeletePosition, adminGeneralAction,
  adminGetGeneral, adminListGeneral, adminResolveTie, adminReviewApplication, adminSaveGeneral, adminSavePosition, candidatesLabel,
  formatMrDateTime, fromMrInput, groupPositions, toMrInput, votingStarted,
  type AdminApplication, type AdminGeneralElection, type ApplicationStatus, type GeneralAction, type GeneralElectionSummary, type GeneralPhase,
} from '../../lib/generalElections';

const card = 'bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800';
const input = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';
const phaseCls = (p: GeneralPhase) => p === 'voting' ? 'bg-emerald-100 text-emerald-700' : p === 'nominations' ? 'bg-sky-100 text-sky-700'
  : p === 'results' ? 'bg-amber-100 text-amber-800' : p === 'voting_closed' ? 'bg-slate-200 text-slate-700' : 'bg-indigo-50 text-indigo-700';

// ─── Create dialog ───────────────────────────────────────────────────────────

const CreateDialog = ({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eligibility, setEligibility] = useState<'approved' | 'registered'>('registered');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (title.trim().length < 3) { toast.error('عنوان الانتخابات مطلوب'); return; }
    setBusy(true);
    try { const r = await adminCreateGeneral({ title: title.trim(), description: description.trim(), eligibility }); toast.success('تم إنشاء الانتخابات مع المناصب الافتراضية'); onCreated(r.id); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'تعذّر الإنشاء'); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4" dir="rtl" onClick={() => !busy && onClose()}>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()} className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between"><h3 className="text-lg font-black">انتخابات عامة جديدة</h3><button onClick={onClose} aria-label="إغلاق"><X className="w-5 h-5" /></button></div>
        <label className="block"><span className="block text-sm font-bold mb-1.5">العنوان *</span>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} className={input} placeholder="انتخابات جمعية عون وسند الخيرية 2026" /></label>
        <label className="block"><span className="block text-sm font-bold mb-1.5">وصف (اختياري)</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={input} /></label>
        <label className="block"><span className="block text-sm font-bold mb-1.5">من يحق له التصويت؟</span>
          <select value={eligibility} onChange={e => setEligibility(e.target.value as 'approved' | 'registered')} className={input}>
            <option value="registered">كل الأعضاء المسجلين</option>
            <option value="approved">الأعضاء المعتمدون فقط</option>
          </select></label>
        <p className="text-xs text-slate-500">تُنشأ تلقائيًا مناصب المكتب التنفيذي (3) واللجان الثماني (مسؤول لكل لجنة)، ويمكن تعديلها.</p>
        <button onClick={() => void save()} disabled={busy} className="w-full py-3 rounded-xl font-black text-white bg-[#211d45] flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إنشاء
        </button>
      </motion.div>
    </div>
  );
};

// ─── Detail view ─────────────────────────────────────────────────────────────

type Tab = 'schedule' | 'applications' | 'positions' | 'results' | 'log';

const Detail = ({ id, onBack }: { id: string; onBack: () => void }) => {
  const [e, setE] = useState<AdminGeneralElection | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('schedule');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setE(await adminGetGeneral(id)); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'تعذّر التحميل'); }
  }, [id]);
  useEffect(() => {
    void load();
    // Phases change with the clock: keep the dashboard current.
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    if (busy) return false;
    setBusy(key);
    try { await fn(); toast.success(ok); await load(); return true; }
    catch (err) { toast.error(err instanceof Error ? err.message : 'حدث خطأ'); return false; }
    finally { setBusy(null); }
  };

  if (!e) return <div className={`${card} p-10 text-center`}>{error ? <p className="font-bold text-red-600">{error}</p> : <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />}</div>;

  const info = PHASE_INFO[e.phase];
  const pending = e.applications.filter(a => a.status === 'pending').length;
  const approved = e.applications.filter(a => a.status === 'approved').length;
  const turnout = e.eligible_count > 0 && e.voters_total !== null ? Math.round((e.voters_total / e.eligible_count) * 100) : 0;
  const tabs: { id: Tab; label: string; icon: typeof CalendarClock; badge?: number }[] = [
    { id: 'schedule', label: 'المواعيد والمراحل', icon: CalendarClock },
    { id: 'applications', label: 'طلبات الترشح', icon: ClipboardList, badge: pending },
    { id: 'positions', label: 'المناصب والمترشحون', icon: Users },
    { id: 'results', label: 'النتائج', icon: Trophy },
    { id: 'log', label: 'السجل', icon: History },
  ];

  const action = (a: GeneralAction, ok: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    void act(a, () => adminGeneralAction(e.id, a), ok);
  };

  return (
    <div className="space-y-4">
      <div className={`${card} p-5`}>
        <div className="flex flex-wrap items-start gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800" aria-label="رجوع"><ArrowRight className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">{e.title}</h2>
            <div className="flex flex-wrap gap-2 mt-2 text-xs font-black">
              <span className={`px-3 py-1 rounded-full ${phaseCls(e.phase)}`}>{info.label}</span>
              <span className={`px-3 py-1 rounded-full ${e.is_published ? 'bg-sky-50 text-sky-700' : 'bg-red-50 text-red-600'}`}>{e.is_published ? 'ظاهرة للأعضاء' : 'مخفية عن الأعضاء'}</span>
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">{e.eligibility === 'approved' ? 'التصويت: الأعضاء المعتمدون' : 'التصويت: كل المسجلين'}</span>
            </div>
          </div>
          <button onClick={() => void load()} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> تحديث</button>
        </div>
        <ol className="grid grid-cols-5 gap-1.5 mt-4">
          {STEPS.map((s, i) => (
            <li key={s} className="text-center">
              <div className={`h-1.5 rounded-full ${i + 1 < info.step ? 'bg-emerald-500' : i + 1 === info.step ? 'bg-[#ef8f88]' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <span className="block mt-1 text-[11px] font-bold text-slate-500">{s}</span>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
          {[['طلبات قيد المراجعة', pending], ['مترشحون مقبولون', approved], ['المؤهلون للتصويت', e.eligible_count], ['المشاركون في التصويت', e.voters_total ?? 0], ['نسبة المشاركة', `${turnout}%`]].map(([l, v]) => (
            <div key={l as string} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-center">
              <div className="text-2xl font-black text-slate-800 dark:text-white">{v}</div>
              <div className="text-[11px] font-bold text-slate-500">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id}
            className={`px-4 py-2.5 rounded-2xl text-sm font-black whitespace-nowrap flex items-center gap-1.5 ${tab === t.id ? 'bg-[#211d45] text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
            {!!t.badge && <span className="px-1.5 rounded-full bg-[#ef8f88] text-white text-[11px]">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'schedule' && <ScheduleTab e={e} busy={busy} act={act} action={action} onDeleted={onBack} />}
      {tab === 'applications' && <ApplicationsTab e={e} busy={busy} act={act} />}
      {tab === 'positions' && <PositionsTab e={e} busy={busy} act={act} />}
      {tab === 'results' && <ResultsTab e={e} busy={busy} act={act} action={action} />}
      {tab === 'log' && (
        <div className={`${card} p-4`}>
          {e.log.length === 0 ? <p className="text-center text-slate-500 py-8">لا توجد عمليات بعد</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {e.log.map(l => (
                <li key={l.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-black text-slate-800 dark:text-white">{LOG_LABELS[l.action] ?? l.action}</span>
                  {typeof l.details.candidate === 'string' && <span className="text-slate-600">{l.details.candidate} — {String(l.details.position ?? '')}</span>}
                  {typeof l.details.title === 'string' && l.action.startsWith('position') && <span className="text-slate-600">{l.details.title}</span>}
                  {l.action === 'tie_resolved' && <span className="text-slate-600">{String(l.details.position)}: {String(l.details.winner)}</span>}
                  {typeof l.details.note === 'string' && <span className="text-slate-500">({l.details.note})</span>}
                  <span className="ms-auto text-xs text-slate-400">{l.actor} — {formatMrDateTime(l.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

type ActFn = (key: string, fn: () => Promise<unknown>, ok: string) => Promise<boolean>;

// ─── Schedule & phases ───────────────────────────────────────────────────────

const ScheduleTab = ({ e, busy, act, action, onDeleted }: {
  e: AdminGeneralElection; busy: string | null; act: ActFn; action: (a: GeneralAction, ok: string, confirm?: string) => void; onDeleted: () => void;
}) => {
  const [f, setF] = useState(() => ({
    title: e.title, description: e.description ?? '', eligibility: e.eligibility, live: e.live_results !== false,
    ns: toMrInput(e.nominations_start_at), ne: toMrInput(e.nominations_end_at), vs: toMrInput(e.voting_start_at), ve: toMrInput(e.voting_end_at),
  }));
  useEffect(() => {
    setF({ title: e.title, description: e.description ?? '', eligibility: e.eligibility, live: e.live_results !== false,
      ns: toMrInput(e.nominations_start_at), ne: toMrInput(e.nominations_end_at), vs: toMrInput(e.voting_start_at), ve: toMrInput(e.voting_end_at) });
  }, [e.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when the saved election changes

  const started = votingStarted(e.phase);
  const nowInput = () => new Date().toISOString().slice(0, 16);
  const save = (over: Partial<typeof f> = {}) => {
    const v = { ...f, ...over };
    return act('save', () => adminSaveGeneral(e.id, {
      title: v.title.trim(), description: v.description, eligibility: v.eligibility, live_results: v.live,
      nominations_start_at: fromMrInput(v.ns), nominations_end_at: fromMrInput(v.ne),
      voting_start_at: fromMrInput(v.vs), voting_end_at: fromMrInput(v.ve),
    }), 'تم حفظ المواعيد');
  };

  const dt = (label: string, key: 'ns' | 'ne' | 'vs' | 've', disabled: boolean) => (
    <label className="block"><span className="block text-sm font-bold mb-1.5">{label}</span>
      <input type="datetime-local" value={f[key]} disabled={disabled} onChange={ev => setF({ ...f, [key]: ev.target.value })} className={`${input} disabled:opacity-60`} />
    </label>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className={`${card} p-5 space-y-4 lg:col-span-2`}>
        <h3 className="font-black text-lg flex items-center gap-2"><CalendarClock className="w-5 h-5 text-indigo-500" /> المواعيد الانتخابية <span className="text-xs font-bold text-slate-500">(بتوقيت موريتانيا UTC+0)</span></h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2"><span className="block text-sm font-bold mb-1.5">العنوان</span>
            <input value={f.title} onChange={ev => setF({ ...f, title: ev.target.value })} className={input} /></label>
          <label className="block sm:col-span-2"><span className="block text-sm font-bold mb-1.5">الوصف</span>
            <textarea value={f.description} onChange={ev => setF({ ...f, description: ev.target.value })} rows={2} className={input} /></label>
          <div className="sm:col-span-2 p-3 rounded-2xl bg-sky-50 dark:bg-sky-900/10 grid sm:grid-cols-2 gap-3">
            <p className="sm:col-span-2 font-black text-sky-800 dark:text-sky-300 text-sm">1. مرحلة الترشح</p>
            {dt('بداية الترشح', 'ns', started)}
            {dt('نهاية الترشح', 'ne', started)}
          </div>
          <div className="sm:col-span-2 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 grid sm:grid-cols-2 gap-3">
            <p className="sm:col-span-2 font-black text-emerald-800 dark:text-emerald-300 text-sm">2. مرحلة التصويت (بعد نهاية الترشح) — أو استعمل زر «فتح التصويت الآن»</p>
            {dt('بداية التصويت', 'vs', started)}
            {dt('نهاية التصويت (اختياري: بدونها يبقى مفتوحًا حتى تغلقه)', 've', started && e.phase !== 'voting')}
          </div>
          <label className="block sm:col-span-2"><span className="block text-sm font-bold mb-1.5">من يحق له التصويت؟</span>
            <select value={f.eligibility} disabled={started} onChange={ev => setF({ ...f, eligibility: ev.target.value as 'approved' | 'registered' })} className={`${input} disabled:opacity-60`}>
              <option value="registered">كل الأعضاء المسجلين</option>
              <option value="approved">الأعضاء المعتمدون فقط</option>
            </select></label>
          <label className="sm:col-span-2 flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
            <input type="checkbox" checked={f.live} onChange={ev => setF({ ...f, live: ev.target.checked })} className="mt-1 w-5 h-5 accent-[#211d45]" />
            <span><span className="block text-sm font-black">عرض النتائج مباشرة أثناء التصويت</span>
              <span className="block text-xs text-slate-500">يظهر عدد أصوات كل مترشح للجميع ويتحدث تلقائيًا. عند إلغائه لا تظهر الأعداد إلا بعد إعلان النتائج. يمكن تغييره في أي وقت (اضغط حفظ).</span></span>
          </label>
        </div>
        <p className="text-xs text-slate-500">تتغير المراحل تلقائيًا حسب هذه المواعيد: يُغلق الترشح ويُفتح التصويت ويُغلق دون تدخل. تحقق الخادم يمنع أي عملية خارج موعدها.</p>
        <button onClick={() => void save()} disabled={!!busy || (started && e.phase !== 'voting')} className="px-6 py-3 rounded-xl font-black text-white bg-[#211d45] flex items-center gap-2 disabled:opacity-50">
          {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ المواعيد
        </button>
      </div>

      <div className={`${card} p-5 space-y-2.5`}>
        <h3 className="font-black text-lg mb-1">إجراءات سريعة</h3>
        {(e.phase === 'setup' || e.phase === 'nominations_upcoming' || e.phase === 'nominations_closed') && (
          <button disabled={!!busy || !f.ne || new Date(fromMrInput(f.ne)!).getTime() <= Date.now()} title={!f.ne ? 'حدّد نهاية الترشح أولاً' : ''}
            onClick={() => { const ns = nowInput(); setF({ ...f, ns }); void save({ ns }); }}
            className="w-full py-2.5 rounded-xl font-bold bg-sky-600 text-white flex items-center justify-center gap-2 disabled:opacity-50"><Play className="w-4 h-4" /> فتح باب الترشح الآن</button>
        )}
        {e.phase === 'nominations' && (
          <button disabled={!!busy} onClick={() => action('close_nominations', 'تم إغلاق باب الترشح', 'إغلاق باب الترشح الآن؟ لن تُقبل طلبات جديدة.')}
            className="w-full py-2.5 rounded-xl font-bold bg-slate-800 text-white flex items-center justify-center gap-2"><Square className="w-4 h-4" /> إغلاق باب الترشح الآن</button>
        )}
        {!started && (
          <button disabled={!!busy} onClick={() => action('open_voting', 'تم فتح التصويت: أُخفيت بطاقات المترشحين وظهرت ورقة التصويت للأعضاء',
            'فتح التصويت الآن؟ سيُغلق باب الترشح، وتُخفى بطاقات المترشحين وبرامجهم، وتظهر ورقة التصويت للأعضاء. يبقى التصويت مفتوحًا حتى تغلقه.')}
            className="w-full py-2.5 rounded-xl font-black bg-emerald-600 text-white flex items-center justify-center gap-2"><Play className="w-4 h-4" /> فتح التصويت الآن</button>
        )}
        {e.phase === 'voting' && (
          <button disabled={!!busy} onClick={() => action('close_voting', 'تم إغلاق التصويت', 'إغلاق التصويت الآن؟ لا يمكن التراجع.')}
            className="w-full py-2.5 rounded-xl font-bold bg-slate-800 text-white flex items-center justify-center gap-2"><Square className="w-4 h-4" /> إغلاق التصويت الآن</button>
        )}
        {e.phase === 'voting_closed' && (
          <button disabled={!!busy} onClick={() => action('announce', 'تم إعلان النتائج للأعضاء', 'إعلان النتائج النهائية لجميع الأعضاء؟')}
            className="w-full py-2.5 rounded-xl font-black bg-amber-400 text-[#211d45] flex items-center justify-center gap-2"><Megaphone className="w-4 h-4" /> إعلان النتائج</button>
        )}
        {e.phase === 'results' && (
          <button disabled={!!busy} onClick={() => action('unannounce', 'تم سحب الإعلان', 'سحب إعلان النتائج وإخفاؤها عن الأعضاء؟')}
            className="w-full py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> سحب إعلان النتائج</button>
        )}
        <button disabled={!!busy} onClick={() => action(e.is_published ? 'unpublish' : 'publish', e.is_published ? 'أُخفيت الانتخابات عن الأعضاء' : 'الانتخابات ظاهرة للأعضاء')}
          className="w-full py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 flex items-center justify-center gap-2">
          {e.is_published ? <><EyeOff className="w-4 h-4" /> إخفاء عن الأعضاء</> : <><Eye className="w-4 h-4" /> إظهار للأعضاء</>}
        </button>
        <button disabled={!!busy || e.phase === 'voting'} onClick={() => {
          if (!window.confirm(`حذف «${e.title}» نهائيًا مع الطلبات والأصوات؟`)) return;
          void act('delete', () => adminDeleteGeneral(e.id), 'تم حذف الانتخابات').then(ok => { if (ok) onDeleted(); });
        }} className="w-full py-2.5 rounded-xl font-bold bg-red-50 text-red-600 flex items-center justify-center gap-2 disabled:opacity-50"><Trash2 className="w-4 h-4" /> حذف الانتخابات</button>
        <div className="pt-3 text-xs text-slate-500 space-y-1">
          {e.nominations_start_at && <p>الترشح: {formatMrDateTime(e.nominations_start_at)} ← {e.nominations_end_at && formatMrDateTime(e.nominations_end_at)}</p>}
          {e.voting_start_at && <p>التصويت: {formatMrDateTime(e.voting_start_at)} ← {e.voting_end_at && formatMrDateTime(e.voting_end_at)}</p>}
          {e.results_announced_at && <p>أُعلنت النتائج: {formatMrDateTime(e.results_announced_at)}</p>}
        </div>
      </div>
    </div>
  );
};

// ─── Applications ────────────────────────────────────────────────────────────

const ApplicationsTab = ({ e, busy, act }: { e: AdminGeneralElection; busy: string | null; act: ActFn }) => {
  const [status, setStatus] = useState<ApplicationStatus | 'all'>('pending');
  const [position, setPosition] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const locked = votingStarted(e.phase);
  const list = e.applications.filter(a => (status === 'all' || a.status === status) && (position === 'all' || a.position_id === position));
  const review = (a: AdminApplication, s: ApplicationStatus) => {
    let note: string | undefined;
    if (s === 'rejected') { const n = window.prompt('سبب الرفض (يظهر للمترشح، اختياري):', a.review_note ?? ''); if (n === null) return; note = n; }
    void act(a.id + s, () => adminReviewApplication(a.id, s, note), s === 'approved' ? 'تم قبول المترشح' : s === 'rejected' ? 'تم رفض الطلب' : 'أُعيد الطلب إلى المراجعة');
  };
  return (
    <div className="space-y-3">
      <div className={`${card} p-3 flex flex-wrap gap-2`}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s}
            className={`px-3 py-2 rounded-xl text-sm font-bold ${status === s ? 'bg-[#211d45] text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {s === 'all' ? 'الكل' : STATUS_INFO[s].label} ({s === 'all' ? e.applications.length : e.applications.filter(a => a.status === s).length})
          </button>
        ))}
        <select value={position} onChange={ev => setPosition(ev.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold ms-auto">
          <option value="all">كل المناصب</option>
          {e.positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      {locked && <p className="p-3 rounded-2xl bg-amber-50 text-amber-800 text-sm font-bold">بدأ التصويت: لا يمكن تغيير حالة الطلبات.</p>}
      {list.length === 0 ? <div className={`${card} p-10 text-center text-slate-500 font-bold`}>لا توجد طلبات</div> : list.map(a => (
        <div key={a.id} className={`${card} p-4`}>
          <div className="flex flex-wrap gap-4">
            <img src={a.photo_url} alt={a.full_name} className="w-24 h-28 rounded-2xl object-cover bg-slate-100" />
            <div className="flex-1 min-w-[200px]">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-lg font-black text-slate-800 dark:text-white">{a.full_name}</h4>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${STATUS_INFO[a.status].cls}`}>{STATUS_INFO[a.status].label}</span>
              </div>
              <p className="text-sm font-bold text-[#e2706a] mt-0.5">{a.position_title}</p>
              <p className="text-xs text-slate-500 mt-1">الحساب: {a.account_name ?? '—'} • <span dir="ltr">{a.account_email ?? ''}</span> • <span dir="ltr">{a.account_phone ?? ''}</span></p>
              <p className="text-xs text-slate-400">قُدّم في {formatMrDateTime(a.created_at)}{a.reviewed_by ? ` • راجعه ${a.reviewed_by}` : ''}</p>
              {a.review_note && <p className="text-xs text-slate-600 mt-1">ملاحظة: {a.review_note}</p>}
              <button onClick={() => setOpen(open === a.id ? null : a.id)} className="mt-2 text-sm font-bold text-indigo-600 flex items-center gap-1"><FileText className="w-4 h-4" /> {open === a.id ? 'إخفاء البرنامج' : 'عرض البرنامج الانتخابي'}</button>
              {open === a.id && <p className="mt-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-sm leading-relaxed whitespace-pre-wrap">{a.program}</p>}
            </div>
            {!locked && (
              <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                {a.status !== 'approved' && <button disabled={!!busy} onClick={() => review(a, 'approved')} className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white flex items-center justify-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> قبول</button>}
                {a.status !== 'rejected' && <button disabled={!!busy} onClick={() => review(a, 'rejected')} className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 flex items-center justify-center gap-1.5"><XCircle className="w-4 h-4" /> رفض</button>}
                {a.status !== 'pending' && <button disabled={!!busy} onClick={() => review(a, 'pending')} className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 flex items-center justify-center gap-1.5"><RotateCcw className="w-4 h-4" /> قيد المراجعة</button>}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Positions & approved candidates ─────────────────────────────────────────

const PositionsTab = ({ e, busy, act }: { e: AdminGeneralElection; busy: string | null; act: ActFn }) => {
  const [title, setTitle] = useState('');
  const locked = votingStarted(e.phase);
  const groups = groupPositions(e.positions);
  return (
    <div className="space-y-4">
      {groups.map(g => (
        <div key={g.key} className={`${card} p-4`}>
          <h3 className="font-black text-lg mb-3">{g.title}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {g.items.map(p => (
              <div key={p.id} className={`p-3 rounded-2xl border ${p.is_active ? 'border-slate-200 dark:border-slate-700' : 'border-dashed border-slate-300 opacity-60'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black flex-1">{p.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700">{candidatesLabel(p.candidates_count ?? 0)}</span>
                  {!!p.pending_count && <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-700">{p.pending_count} قيد المراجعة</span>}
                </div>
                {p.candidates.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {p.candidates.map(c => (
                      <span key={c.id} className="flex items-center gap-1.5 pe-2.5 rounded-full bg-slate-50 dark:bg-slate-800 text-xs font-bold">
                        <img src={c.photo_url ?? undefined} alt="" className="w-7 h-7 rounded-full object-cover" /> {c.full_name}
                      </span>
                    ))}
                  </div>
                )}
                {!locked && (
                  <div className="flex gap-2 mt-2">
                    <button disabled={!!busy} onClick={() => void act(p.id, () => adminSavePosition(e.id, p.id, { is_active: !p.is_active }), p.is_active ? 'تم تعطيل المنصب' : 'تم تفعيل المنصب')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 flex items-center gap-1"><Power className="w-3.5 h-3.5" /> {p.is_active ? 'تعطيل' : 'تفعيل'}</button>
                    {p.group_key === 'other' && (
                      <button disabled={!!busy} onClick={() => window.confirm(`حذف منصب «${p.title}»؟`) && void act(p.id + 'd', () => adminDeletePosition(p.id), 'تم حذف المنصب')}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> حذف</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {!locked && (
        <div className={`${card} p-4 flex flex-col sm:flex-row gap-2`}>
          <input value={title} onChange={ev => setTitle(ev.target.value)} placeholder="إضافة منصب آخر (مثال: أمين الصندوق)" className={input} />
          <button disabled={!!busy || title.trim().length < 2} onClick={() => void act('addpos', () => adminSavePosition(e.id, null, { title: title.trim(), group_key: 'other' }), 'تمت إضافة المنصب').then(ok => ok && setTitle(''))}
            className="px-5 py-2.5 rounded-xl font-bold text-white bg-[#211d45] flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"><Plus className="w-4 h-4" /> إضافة منصب</button>
        </div>
      )}
    </div>
  );
};

// ─── Results ─────────────────────────────────────────────────────────────────

const ResultsTab = ({ e, busy, act, action }: { e: AdminGeneralElection; busy: string | null; act: ActFn; action: (a: GeneralAction, ok: string, confirm?: string) => void }) => {
  const groups = groupPositions(e.positions.filter(p => p.is_active));
  const ties = e.positions.filter(p => p.tie).length;
  const canResolve = e.phase === 'voting_closed' || e.phase === 'results';
  return (
    <div className="space-y-4">
      <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
        <p className="flex-1 text-sm font-bold text-slate-600 dark:text-slate-300">
          {e.phase === 'voting' ? 'نتائج مباشرة (تظهر للمشرفين فقط حتى إعلانها).' : e.phase === 'results' ? 'النتائج معلنة للأعضاء.' : votingStarted(e.phase) ? 'انتهى التصويت. النتائج مخفية عن الأعضاء حتى إعلانها.' : 'لم يبدأ التصويت بعد.'}
          {ties > 0 && <span className="text-amber-700"> — يوجد تعادل في {ties} {ties === 1 ? 'منصب' : 'مناصب'}.</span>}
        </p>
        {e.phase === 'voting_closed' && (
          <button disabled={!!busy} onClick={() => action('announce', 'تم إعلان النتائج للأعضاء', ties > 0 ? 'يوجد تعادل لم يُحسم بعد وسيظهر «تعادل» للأعضاء. إعلان النتائج؟' : 'إعلان النتائج النهائية لجميع الأعضاء؟')}
            className="px-5 py-2.5 rounded-xl font-black bg-amber-400 text-[#211d45] flex items-center gap-2"><Megaphone className="w-4 h-4" /> إعلان النتائج</button>
        )}
      </div>
      {groups.map(g => (
        <div key={g.key} className={`${card} p-4`}>
          <h3 className="font-black text-lg mb-3">{g.title}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {g.items.map(p => {
              const total = p.voters_count ?? 0;
              const tied = p.candidates.filter(c => p.tie && (c.votes ?? 0) === p.top_votes);
              return (
                <div key={p.id} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-black">{p.title}</span>
                    <span className="text-xs font-bold text-slate-500">{total} مصوّت</span>
                  </div>
                  {p.candidates.length === 0 ? <p className="text-sm text-slate-500">لا يوجد مترشحون لهذا المنصب</p> : (
                    <ol className="space-y-2">
                      {p.candidates.map((c, i) => {
                        const pct = total > 0 ? Math.round(((c.votes ?? 0) / total) * 100) : 0;
                        const winner = p.winner_application_id === c.id;
                        return (
                          <li key={c.id}>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="w-5 text-slate-400 font-black">{i + 1}</span>
                              <img src={c.photo_url ?? undefined} alt="" className="w-8 h-8 rounded-full object-cover" />
                              <span className="font-bold flex-1 truncate">{c.full_name}</span>
                              {winner && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black flex items-center gap-1"><Trophy className="w-3 h-3" /> {p.tie_resolved ? 'فائز (بعد الحسم)' : 'الأعلى أصواتًا'}</span>}
                              {p.tie && (c.votes ?? 0) === p.top_votes && <span className="px-2 py-0.5 rounded-full bg-slate-700 text-white text-[11px] font-black flex items-center gap-1"><Scale className="w-3 h-3" /> تعادل</span>}
                              <span className="font-black tabular-nums">{c.votes ?? 0}</span>
                              <span className="text-xs text-slate-500 w-10 text-end">{pct}%</span>
                            </div>
                            <div className="h-1.5 mt-1 ms-7 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={`h-full ${winner ? 'bg-amber-400' : 'bg-indigo-400'}`} style={{ width: `${pct}%` }} /></div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {canResolve && (p.tie || p.tie_resolved) && (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm">
                      <p className="font-bold mb-1.5">{p.tie ? 'حسم التعادل وفق قواعد الجمعية:' : 'تم حسم التعادل.'}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(p.tie ? tied : []).map(c => (
                          <button key={c.id} disabled={!!busy} onClick={() => window.confirm(`اعتماد «${c.full_name}» فائزًا بمنصب ${p.title}؟`) && void act(p.id, () => adminResolveTie(p.id, c.id), 'تم تسجيل حسم التعادل')}
                            className="px-3 py-1.5 rounded-lg bg-[#211d45] text-white text-xs font-bold">اعتماد {c.full_name}</button>
                        ))}
                        {p.tie_resolved && <button disabled={!!busy} onClick={() => void act(p.id, () => adminResolveTie(p.id, null), 'أُلغي الحسم')} className="px-3 py-1.5 rounded-lg bg-slate-200 text-xs font-bold">إلغاء الحسم</button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── List ────────────────────────────────────────────────────────────────────

export const GeneralElectionsAdmin = () => {
  const [list, setList] = useState<GeneralElectionSummary[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    try { setList(await adminListGeneral()); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'تعذّر التحميل'); setList([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const sorted = useMemo(() => list ?? [], [list]);

  if (openId) return <Detail id={openId} onBack={() => { setOpenId(null); void load(); }} />;
  return (
    <div className="space-y-4">
      <div className={`${card} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div>
          <h3 className="text-xl font-black flex items-center gap-2"><Landmark className="w-6 h-6 text-indigo-500" /> الانتخابات العامة للجمعية</h3>
          <p className="text-sm text-slate-500 mt-1">الترشح ← مراجعة الطلبات ← عرض المترشحين ← التصويت لكل منصب ← إعلان النتائج.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4" /> تحديث</button>
          <button onClick={() => setCreating(true)} className="px-5 py-2.5 rounded-xl font-bold text-white bg-[#211d45] flex items-center gap-2"><Plus className="w-5 h-5" /> انتخابات جديدة</button>
        </div>
      </div>
      {list === null ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        : sorted.length === 0 ? <div className={`${card} p-10 text-center font-bold text-slate-500`}>{error || 'لا توجد انتخابات عامة بعد. أنشئ أول انتخابات.'}</div>
        : sorted.map(s => (
          <button key={s.id} onClick={() => setOpenId(s.id)} className={`${card} w-full p-4 text-start flex flex-wrap items-center gap-3 hover:border-indigo-300`}>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black text-slate-800 dark:text-white">{s.title}</p>
              <p className="text-xs text-slate-500 mt-1">{s.approved} مترشح مقبول • {s.pending} طلب قيد المراجعة{s.is_published ? '' : ' • مخفية عن الأعضاء'}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-black ${phaseCls(s.phase)}`}>{PHASE_INFO[s.phase].label}</span>
          </button>
        ))}
      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setOpenId(id); }} />}
    </div>
  );
};
