import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  X, Loader2, CalendarCheck, Search, CheckCheck, ImageOff, StickyNote, RotateCcw, Sun, Moon, BarChart3, LogIn, LogOut,
  FileDown, Layers, ChevronRight, ChevronLeft, DoorOpen, Clock, UserX, RefreshCw,
} from 'lucide-react';
import {
  CHECKOUT_STATUSES, ENTRY_STATUSES, PERIODS, STILL_INSIDE_LABEL, addDaysISO, checkoutAttendance, classHasPeriod,
  currentPeriod, formatStudentCode, formatTime, getAttendanceContext, getAttendanceReport, getAttendanceSheet,
  isCheckedIn, isSuspended, markAttendance, todayISO,
  type AttendanceContext, type AttendancePeriod, type AttendanceRecord, type CheckoutStatus, type EntryStatus,
  type MahajaStudent, type ReportRow,
} from '../../../lib/mahajaStudents';
import { buildWeeklyStats, countPeriod, exportDailyAttendancePdf, exportWeeklyAttendancePdf } from '../../../utils/attendancePdf';
import { ClassesModal } from './ClassesModal';

interface Props {
  students: MahajaStudent[];
  onClose: () => void;
}

type Tab = AttendancePeriod | 'weekly';

const formatLongDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const formatShortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('ar-MA', { weekday: 'short', day: 'numeric', month: 'short' });
const recKey = (studentId: string, period: AttendancePeriod) => `${studentId}:${period}`;
const byName = (a: MahajaStudent, b: MahajaStudent) => a.full_name.localeCompare(b.full_name, 'ar');

export const AttendanceModal = ({ students, onClose }: Props) => {
  const [context, setContext] = useState<AttendanceContext | null>(null);
  const [contextError, setContextError] = useState('');
  const [tab, setTab] = useState<Tab>(currentPeriod());
  const [date, setDate] = useState(todayISO());
  const [classFilter, setClassFilter] = useState('all');
  const [records, setRecords] = useState<Map<string, AttendanceRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [showSuspended, setShowSuspended] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const [classesOpen, setClassesOpen] = useState(false);
  const pending = useRef(0);

  const period: AttendancePeriod = tab === 'weekly' ? currentPeriod() : tab;
  const isToday = date === todayISO();

  // ─── Loading ───────────────────────────────────────────────────────────────
  const loadContext = useCallback(async () => {
    try { setContext(await getAttendanceContext()); setContextError(''); }
    catch (err) { setContextError(err instanceof Error ? err.message : 'تعذّر تحميل صلاحيات الحضور'); }
  }, []);

  const loadSheet = useCallback(async (day: string, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const list = await getAttendanceSheet(day);
      if (pending.current > 0) return; // a change is being saved: keep what is on screen
      setRecords(new Map(list.map(r => [recKey(r.student_id, r.period ?? 'morning'), r])));
    } catch (err) {
      if (!quiet) { toast.error(err instanceof Error ? err.message : 'تعذّر تحميل الحضور'); setRecords(new Map()); }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadContext(); }, [loadContext]);
  useEffect(() => { void loadSheet(date); }, [date, loadSheet]);
  // Live: other supervisors may be recording at the same time.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') void loadSheet(date, true); }, 30000);
    return () => clearInterval(t);
  }, [date, loadSheet]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !classesOpen) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, classesOpen]);

  // ─── Who is listed ─────────────────────────────────────────────────────────
  const isManager = context?.me.is_manager ?? false;
  const myClasses = useMemo(() => context?.classes ?? [], [context]);
  const studentsById = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  /** Students of a period, respecting the class filter and the supervisor's classes. */
  const studentsFor = useCallback((p: AttendancePeriod | null): MahajaStudent[] => {
    let ids: Set<string> | null = null;
    if (classFilter !== 'all') {
      const c = myClasses.find(x => x.id === classFilter);
      ids = new Set(c && (!p || classHasPeriod(c, p)) ? c.student_ids : []);
    } else if (!isManager) {
      ids = new Set(myClasses.filter(c => !p || classHasPeriod(c, p)).flatMap(c => c.student_ids));
    }
    return (ids ? [...ids].map(id => studentsById.get(id)).filter((s): s is MahajaStudent => !!s) : students)
      .filter(s => showSuspended || !isSuspended(s) || (p && records.has(recKey(s.id, p))))
      .sort(byName);
  }, [classFilter, myClasses, isManager, studentsById, students, showSuspended, records]);

  const periodStudents = useMemo(() => (tab === 'weekly' ? [] : studentsFor(period)), [tab, period, studentsFor]);
  const periodRecords = useMemo(() => {
    const m = new Map<string, AttendanceRecord>();
    periodStudents.forEach(s => { const r = records.get(recKey(s.id, period)); if (r) m.set(s.id, r); });
    return m;
  }, [periodStudents, records, period]);
  const counts = useMemo(() => countPeriod(periodStudents, periodRecords), [periodStudents, periodRecords]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? periodStudents.filter(s => s.full_name.toLowerCase().includes(q) || formatStudentCode(s).toLowerCase().includes(q)) : periodStudents;
  }, [periodStudents, search]);

  const scopeLabel = classFilter !== 'all'
    ? `حلقة: ${myClasses.find(c => c.id === classFilter)?.name ?? ''}`
    : isManager ? 'جميع الطلاب' : `حلقاتي: ${myClasses.map(c => c.name).join('، ')}`;

  // ─── Saving ────────────────────────────────────────────────────────────────
  const applySaved = (ids: string[], p: AttendancePeriod, saved: AttendanceRecord[]) => {
    setRecords(cur => {
      const next = new Map(cur);
      ids.forEach(id => next.delete(recKey(id, p)));
      saved.forEach(r => next.set(recKey(r.student_id, r.period ?? p), r));
      return next;
    });
  };

  const run = async (ids: string[], fn: () => Promise<AttendanceRecord[]>, p: AttendancePeriod) => {
    pending.current += 1;
    setBusy(b => new Set([...b, ...ids]));
    try {
      applySaved(ids, p, await fn());
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر الحفظ');
      return false;
    } finally {
      pending.current -= 1;
      setBusy(b => { const n = new Set(b); ids.forEach(id => n.delete(id)); return n; });
    }
  };

  const setEntry = (s: MahajaStudent, status: EntryStatus) => {
    const cur = periodRecords.get(s.id);
    const next = cur?.status === status ? null : status;
    if (cur?.checkout_status && !isCheckedIn(next) && !window.confirm('سيُحذف تسجيل الخروج لهذا الطالب. متابعة؟')) return;
    void run([s.id], () => markAttendance(date, period, [s.id], next), period);
  };

  const setExit = (s: MahajaStudent, checkout: CheckoutStatus) => {
    const cur = periodRecords.get(s.id);
    void run([s.id], () => checkoutAttendance(date, period, [s.id], cur?.checkout_status === checkout ? null : checkout), period);
  };

  const saveNote = async (s: MahajaStudent) => {
    const cur = periodRecords.get(s.id);
    const draft = (noteDrafts[s.id] ?? cur?.note ?? '').trim();
    if (!cur) { toast.error('سجّل حالة الطالب أولاً ثم أضف الملاحظة'); return; }
    if (draft === (cur.note ?? '')) { setOpenNote(null); return; }
    const status = (cur.status === 'left_early' ? 'present' : cur.status) as EntryStatus;
    if (await run([s.id], () => markAttendance(date, period, [s.id], status, draft), period)) {
      setOpenNote(null);
      setNoteDrafts(d => { const n = { ...d }; delete n[s.id]; return n; });
      toast.success('تم حفظ الملاحظة');
    }
  };

  const bulk = async (kind: 'present' | 'absent' | 'checkout') => {
    if (bulkBusy) return;
    const ids = kind === 'checkout'
      ? periodStudents.filter(s => { const r = periodRecords.get(s.id); return r && isCheckedIn(r.status) && !r.checkout_status; }).map(s => s.id)
      : periodStudents.filter(s => !periodRecords.has(s.id)).map(s => s.id);
    if (ids.length === 0) return;
    const label = kind === 'checkout' ? `تسجيل خروج ${ids.length} طالب ما زالوا داخل المعهد؟` : `تسجيل ${ids.length} طالب غير محددين «${kind === 'present' ? 'حاضر' : 'غائب'}»؟`;
    if (!window.confirm(label)) return;
    setBulkBusy(true);
    const ok = await run(ids, () => (kind === 'checkout' ? checkoutAttendance(date, period, ids, 'left') : markAttendance(date, period, ids, kind)), period);
    setBulkBusy(false);
    if (ok) toast.success(`تم التسجيل (${ids.length})`);
  };

  // ─── Reports ───────────────────────────────────────────────────────────────
  const downloadDaily = async (periods: AttendancePeriod[]) => {
    if (pdfMessage) return;
    setPdfMessage('جاري تجهيز التقرير…');
    try {
      const fresh = await getAttendanceSheet(date);
      await exportDailyAttendancePdf({ date, periods, students: p => studentsFor(p), records: fresh, scopeLabel, onProgress: setPdfMessage });
      toast.success('تم تنزيل التقرير');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر إنشاء التقرير');
    } finally {
      setPdfMessage(null);
    }
  };

  const changeDate = (next: string) => { if (next && next <= todayISO()) setDate(next); };

  // ─── Render ────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; short: string; icon: typeof Sun }[] = [
    { id: 'morning', label: 'الفترة الصباحية', short: 'الصباح', icon: Sun },
    { id: 'evening', label: 'الفترة المسائية', short: 'المساء', icon: Moon },
    { id: 'weekly', label: 'التقرير الأسبوعي', short: 'الأسبوعي', icon: BarChart3 },
  ];
  const noClassesForPeriod = !!context && !isManager && tab !== 'weekly' && !myClasses.some(c => classHasPeriod(c, period));

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4" dir="rtl" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-5xl h-[95vh] sm:h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 bg-[#262150] text-white">
          <div className="min-w-0">
            <h3 className="text-xl font-black flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-pink-200" /> الحضور والخروج</h3>
            {context && <p className="text-xs text-white/70 mt-0.5 truncate">المشرف: {context.me.label} — {isManager ? 'كل الطلاب' : 'الحلقات المكلف بها'}</p>}
          </div>
          <div className="flex items-center gap-1">
            {isManager && (
              <button onClick={() => setClassesOpen(true)} className="px-3 py-2 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 flex items-center gap-1.5"><Layers className="w-4 h-4" /> الحلقات</button>
            )}
            <button onClick={onClose} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 sm:px-6 pt-3 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id} aria-label={t.label}
              className={`px-4 py-2.5 rounded-t-2xl text-sm font-black flex items-center gap-1.5 whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'border-[#262150] text-[#262150] bg-indigo-50 dark:bg-slate-800 dark:text-white dark:border-pink-300' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <t.icon className="w-4 h-4" /> <span className="hidden sm:inline">{t.label}</span><span className="sm:hidden">{t.short}</span>
            </button>
          ))}
        </div>

        {contextError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
            <p className="font-bold text-amber-700">{contextError}</p>
            <button onClick={() => void loadContext()} className="px-4 py-2 rounded-xl bg-slate-100 font-bold flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> إعادة المحاولة</button>
          </div>
        ) : tab === 'weekly' ? (
          <WeeklyReport studentsFor={studentsFor} scopeLabel={scopeLabel} endDate={date}
            classFilter={classFilter} setClassFilter={setClassFilter} classes={myClasses} isManager={isManager} />
        ) : (
          <>
            {/* Controls and list scroll together on phones; the controls stay pinned on large screens. */}
            <div className="flex-1 overflow-y-auto">
            <div className="lg:sticky lg:top-0 z-10 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3 space-y-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="flex items-center gap-2">
                  <input type="date" value={date} max={todayISO()} onChange={e => changeDate(e.target.value)} aria-label="التاريخ"
                    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold" />
                  {!isToday && <button onClick={() => setDate(todayISO())} className="px-3 py-2.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 flex items-center gap-1"><RotateCcw className="w-4 h-4" /> اليوم</button>}
                </div>
                <ClassSelect value={classFilter} onChange={setClassFilter} classes={myClasses} isManager={isManager} />
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن طالب…"
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                {formatLongDay(date)} — {PERIODS.find(p => p.id === period)?.label}
                {!isToday && <span className="font-medium text-amber-600"> (يوم سابق: لا تُسجَّل أوقات الدخول والخروج تلقائيًا)</span>}
              </p>

              {/* Live stats */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {[
                  { l: 'حاضر', v: counts.present, c: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300' },
                  { l: 'متأخر', v: counts.late, c: 'text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300' },
                  { l: 'غائب', v: counts.absent, c: 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300' },
                  { l: 'بعذر', v: counts.excused, c: 'text-sky-700 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-300' },
                  { l: 'خرج', v: counts.left, c: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-300' },
                  { l: 'خرج مبكرًا', v: counts.left_early, c: 'text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-300' },
                  { l: STILL_INSIDE_LABEL, v: counts.inside, c: 'text-teal-700 bg-teal-50 dark:bg-teal-900/20 dark:text-teal-300' },
                  { l: 'لم يُسجَّل', v: counts.unset, c: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' },
                ].map(x => (
                  <div key={x.l} className={`rounded-xl px-2 py-1.5 text-center ${x.c}`}>
                    <div className="text-lg font-black leading-tight">{x.v}</div>
                    <div className="text-[11px] font-bold leading-tight">{x.l}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => void bulk('present')} disabled={loading || bulkBusy || counts.unset === 0}
                  className="px-3 py-2 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 disabled:opacity-50 flex items-center gap-1.5">
                  <CheckCheck className="w-4 h-4" /> غير المحددين حاضرون
                </button>
                <button onClick={() => void bulk('absent')} disabled={loading || bulkBusy || counts.unset === 0}
                  className="px-3 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 disabled:opacity-50 flex items-center gap-1.5">
                  <UserX className="w-4 h-4" /> غير المحددين غائبون
                </button>
                <button onClick={() => void bulk('checkout')} disabled={loading || bulkBusy || counts.inside === 0}
                  className="px-3 py-2 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 disabled:opacity-50 flex items-center gap-1.5">
                  <LogOut className="w-4 h-4" /> خروج الباقين (نهاية الحصة)
                </button>
                <span className="flex-1" />
                <button onClick={() => void downloadDaily([period])} disabled={!!pdfMessage || loading}
                  className="px-3 py-2 rounded-xl text-sm font-bold bg-[#262150] text-white disabled:opacity-60 flex items-center gap-1.5">
                  <FileDown className="w-4 h-4" /> تقرير الفترة PDF
                </button>
                <button onClick={() => void downloadDaily(['morning', 'evening'])} disabled={!!pdfMessage || loading}
                  className="px-3 py-2 rounded-xl text-sm font-bold bg-pink-100 text-[#262150] hover:bg-pink-200 disabled:opacity-60 flex items-center gap-1.5">
                  <FileDown className="w-4 h-4" /> التقرير اليومي (الفترتان)
                </button>
              </div>
              {pdfMessage && <p className="text-sm font-bold text-indigo-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {pdfMessage}</p>}
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer w-fit">
                <input type="checkbox" checked={showSuspended} onChange={e => setShowSuspended(e.target.checked)} className="w-4 h-4 accent-[#262150]" />
                إظهار الطلاب الموقوفين
              </label>
            </div>

            {/* List */}
            <div className="px-3 sm:px-6 py-3">
              {loading || !context ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
              ) : noClassesForPeriod ? (
                <p className="text-center py-12 text-slate-500 font-bold">لا توجد حلقات مكلف بها في {PERIODS.find(p => p.id === period)?.label}. تواصل مع الإدارة.</p>
              ) : list.length === 0 ? (
                <p className="text-center py-12 text-slate-500 font-bold">لا يوجد طلاب</p>
              ) : (
                <ul className="space-y-2">
                  {list.map(s => {
                    const r = periodRecords.get(s.id);
                    const entry = r?.status === 'left_early' ? 'present' : r?.status;
                    const exit = r?.status === 'left_early' ? 'left_early' : r?.checkout_status ?? null;
                    const inside = isCheckedIn(entry);
                    const rowBusy = busy.has(s.id);
                    const noteOpen = openNote === s.id;
                    return (
                      <li key={s.id} className={`p-3 rounded-2xl border transition-colors ${rowBusy ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
                        <div className="flex flex-col md:flex-row md:items-start gap-3">
                          <div className="flex items-center gap-3 md:w-56 shrink-0 min-w-0">
                            <div className="w-11 h-11 rounded-xl overflow-hidden bg-indigo-50 dark:bg-slate-800 border border-pink-200 shrink-0 flex items-center justify-center">
                              {s.photo_url ? <img src={s.photo_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <ImageOff className="w-4 h-4 text-slate-300" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 dark:text-white truncate">{s.full_name}</p>
                              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                <span dir="ltr">{formatStudentCode(s)}</span>
                                {isSuspended(s) && <span className="px-1.5 rounded bg-red-100 text-red-700">موقوف</span>}
                                {rowBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
                              </p>
                            </div>
                          </div>

                          <div className="flex-1 space-y-2 min-w-0">
                            {/* Entry */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-black text-slate-400 w-14 flex items-center gap-1"><LogIn className="w-3.5 h-3.5" /> الدخول</span>
                              {ENTRY_STATUSES.map(a => (
                                <button key={a.id} type="button" disabled={rowBusy} onClick={() => setEntry(s, a.id)} aria-pressed={entry === a.id}
                                  className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors disabled:opacity-60 ${entry === a.id ? a.active : `bg-white dark:bg-slate-800 ${a.tone} hover:bg-slate-50 dark:hover:bg-slate-700`}`}>
                                  {a.short}
                                </button>
                              ))}
                              {!noteOpen && (
                                <button type="button" onClick={() => setOpenNote(s.id)} className="px-2.5 py-1.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1" title="ملاحظة">
                                  <StickyNote className="w-4 h-4" /> {r?.note ? 'تعديل الملاحظة' : 'ملاحظة'}
                                </button>
                              )}
                            </div>
                            {/* Exit */}
                            {inside && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-black text-slate-400 w-14 flex items-center gap-1"><DoorOpen className="w-3.5 h-3.5" /> الخروج</span>
                                {CHECKOUT_STATUSES.map(c => (
                                  <button key={c.id} type="button" disabled={rowBusy} onClick={() => setExit(s, c.id)} aria-pressed={exit === c.id}
                                    className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors disabled:opacity-60 ${exit === c.id ? c.active : `bg-white dark:bg-slate-800 ${c.tone} hover:bg-slate-50 dark:hover:bg-slate-700`}`}>
                                    {c.label}
                                  </button>
                                ))}
                                {!exit && <span className="px-2.5 py-1 rounded-full text-xs font-black bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {STILL_INSIDE_LABEL}</span>}
                              </div>
                            )}
                            {/* Who / when */}
                            {r && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                {inside ? <>دخل {formatTime(r.check_in_at)}</> : 'سُجّل'} — بواسطة {r.recorded_by}
                                {exit && <> • {exit === 'left_early' ? 'خرج مبكرًا' : 'خرج'} {formatTime(r.check_out_at)}{r.checkout_by ? ` — بواسطة ${r.checkout_by}` : ''}</>}
                                {r.note && !noteOpen && <> • ملاحظة: {r.note}</>}
                              </p>
                            )}
                            {noteOpen && (
                              <div className="flex gap-2">
                                <input type="text" value={noteDrafts[s.id] ?? r?.note ?? ''} maxLength={300} autoFocus
                                  onChange={e => setNoteDrafts(d => ({ ...d, [s.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') void saveNote(s); }}
                                  placeholder="مثال: تأخر 20 دقيقة، أو خرج لموعد طبي"
                                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
                                <button onClick={() => void saveNote(s)} disabled={rowBusy} className="px-3 py-2 rounded-xl text-sm font-bold bg-[#262150] text-white disabled:opacity-60">حفظ</button>
                                <button onClick={() => setOpenNote(null)} className="px-3 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800">إلغاء</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            </div>

            <div className="px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-500 text-xs sm:text-sm">كل تسجيل يُحفظ مباشرة في قاعدة البيانات مع اسم المشرف ووقت العملية.</span>
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">إغلاق</button>
            </div>
          </>
        )}
      </motion.div>

      {classesOpen && context && (
        <ClassesModal context={context} students={students} onClose={() => setClassesOpen(false)} onChanged={() => void loadContext()} />
      )}
    </div>
  );
};

const ClassSelect = ({ value, onChange, classes, isManager }: {
  value: string; onChange: (v: string) => void; classes: AttendanceContext['classes']; isManager: boolean;
}) => (classes.length === 0 ? null : (
  <select value={value} onChange={e => onChange(e.target.value)} aria-label="الحلقة"
    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold">
    <option value="all">{isManager ? 'كل الطلاب' : 'كل حلقاتي'}</option>
    {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (موقوفة)'}</option>)}
  </select>
));

// ─── Weekly report ───────────────────────────────────────────────────────────

const WeeklyReport = ({ studentsFor, scopeLabel, endDate, classFilter, setClassFilter, classes, isManager }: {
  studentsFor: (p: AttendancePeriod | null) => MahajaStudent[];
  scopeLabel: string;
  endDate: string;
  classFilter: string;
  setClassFilter: (v: string) => void;
  classes: AttendanceContext['classes'];
  isManager: boolean;
}) => {
  const [to, setTo] = useState(endDate);
  const from = addDaysISO(to, -6);
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState('');
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    getAttendanceReport(from, to)
      .then(r => { if (alive) { setRows(r); setError(''); } })
      .catch(err => { if (alive) { setRows([]); setError(err instanceof Error ? err.message : 'تعذّر تحميل التقرير'); } });
    return () => { alive = false; };
  }, [from, to]);

  const stats = useMemo(() => (rows ? buildWeeklyStats(studentsFor(null), rows) : []), [rows, studentsFor]);

  const download = async () => {
    setPdfMessage('جاري تجهيز التقرير…');
    try {
      await exportWeeklyAttendancePdf({ from, to, stats, scopeLabel, onProgress: setPdfMessage });
      toast.success('تم تنزيل التقرير الأسبوعي');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر إنشاء التقرير');
    } finally {
      setPdfMessage(null);
    }
  };

  const rateTone = (r: number | null) => r === null ? 'text-slate-400' : r >= 80 ? 'text-emerald-600' : r >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <>
      <div className="px-4 sm:px-6 py-3 space-y-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setTo(addDaysISO(to, -7))} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800" aria-label="الأسبوع السابق"><ChevronRight className="w-4 h-4" /></button>
          <span className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm">من {formatShortDay(from)} إلى {formatShortDay(to)}</span>
          <button onClick={() => setTo(addDaysISO(to, 7))} disabled={addDaysISO(to, 7) > todayISO()} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40" aria-label="الأسبوع التالي"><ChevronLeft className="w-4 h-4" /></button>
          {to !== todayISO() && <button onClick={() => setTo(todayISO())} className="px-3 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800">آخر 7 أيام</button>}
          <ClassSelect value={classFilter} onChange={setClassFilter} classes={classes} isManager={isManager} />
          <span className="flex-1" />
          <button onClick={() => void download()} disabled={!rows || !!pdfMessage}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-[#262150] text-white disabled:opacity-60 flex items-center gap-1.5">
            {pdfMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} التقرير الأسبوعي PDF
          </button>
        </div>
        {pdfMessage && <p className="text-sm font-bold text-indigo-600">{pdfMessage}</p>}
        <p className="text-xs text-slate-500">يُحسب التقرير تلقائيًا من سجلات الحضور. نسبة الحضور = (حاضر + متأخر) ÷ (الحصص المسجلة باستثناء الغياب بعذر).</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3">
        {rows === null ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        ) : error ? (
          <p className="text-center py-12 text-amber-700 font-bold">{error}</p>
        ) : stats.length === 0 ? (
          <p className="text-center py-12 text-slate-500 font-bold">لا يوجد طلاب</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                  <tr>
                    {['الطالب', 'حضور', 'غياب', 'تأخر', 'خروج مبكر', 'بعذر', 'النسبة', 'الصباح', 'المساء'].map(h => <th key={h} className="p-3 text-start font-bold whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.map(x => (
                    <tr key={x.student.id}>
                      <td className="p-3"><div className="font-bold text-slate-800 dark:text-white">{x.student.full_name}</div><div className="text-xs text-slate-400" dir="ltr">{formatStudentCode(x.student)}</div></td>
                      <td className="p-3 font-bold text-emerald-600">{x.present}</td>
                      <td className="p-3 font-bold text-red-600">{x.absent}</td>
                      <td className="p-3 font-bold text-amber-600">{x.late}</td>
                      <td className="p-3 font-bold text-orange-600">{x.left_early}</td>
                      <td className="p-3 font-bold text-sky-600">{x.excused}</td>
                      <td className={`p-3 font-black ${rateTone(x.rate)}`}>{x.rate === null ? '—' : `${x.rate}%`}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{x.morning.sessions ? `${x.morning.attended}/${x.morning.sessions}` : '—'}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{x.evening.sessions ? `${x.evening.attended}/${x.evening.sessions}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden space-y-2">
              {stats.map(x => (
                <li key={x.student.id} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 dark:text-white truncate">{x.student.full_name}</span>
                    <span className={`font-black ${rateTone(x.rate)}`}>{x.rate === null ? '—' : `${x.rate}%`}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 mt-2 text-center text-xs font-bold">
                    <span className="rounded-lg bg-emerald-50 text-emerald-700 py-1">حضور {x.present}</span>
                    <span className="rounded-lg bg-red-50 text-red-700 py-1">غياب {x.absent}</span>
                    <span className="rounded-lg bg-amber-50 text-amber-700 py-1">تأخر {x.late}</span>
                    <span className="rounded-lg bg-orange-50 text-orange-700 py-1">مبكر {x.left_early}</span>
                    <span className="rounded-lg bg-sky-50 text-sky-700 py-1">عذر {x.excused}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">الصباح: {x.morning.sessions ? `${x.morning.attended} من ${x.morning.sessions}` : '—'} • المساء: {x.evening.sessions ? `${x.evening.attended} من ${x.evening.sessions}` : '—'}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
};
