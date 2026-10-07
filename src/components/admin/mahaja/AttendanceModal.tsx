import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { X, Save, Loader2, CalendarCheck, Search, CheckCheck, ImageOff, StickyNote, RotateCcw } from 'lucide-react';
import {
  ATTENDANCE_STATUSES, formatStudentCode, getAttendanceForDay, isSuspended, saveAttendance, todayISO,
  type AttendanceRecord, type AttendanceStatus, type MahajaStudent,
} from '../../../lib/mahajaStudents';

interface Props {
  students: MahajaStudent[];
  onClose: () => void;
}

interface Row { status: AttendanceStatus | null; note: string }

export const AttendanceModal = ({ students, onClose }: Props) => {
  const [date, setDate] = useState(todayISO());
  const [saved, setSaved] = useState<Record<string, AttendanceRecord>>({});
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showSuspended, setShowSuspended] = useState(false);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const savingRef = useRef(false);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    try {
      const records = await getAttendanceForDay(day);
      const byStudent: Record<string, AttendanceRecord> = {};
      records.forEach(r => { byStudent[r.student_id] = r; });
      setSaved(byStudent);
      const next: Record<string, Row> = {};
      records.forEach(r => { next[r.student_id] = { status: r.status, note: r.note ?? '' }; });
      setRows(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر تحميل الحضور');
      setSaved({});
      setRows({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(date); }, [date, load]);

  const dirtyIds = useMemo(() => Object.keys({ ...rows, ...saved }).filter(id => {
    const r = rows[id] ?? { status: null, note: '' };
    const s = saved[id];
    return (r.status ?? null) !== (s?.status ?? null) || (r.status !== null && r.note.trim() !== (s?.note ?? ''));
  }), [rows, saved]);
  const isDirty = dirtyIds.length > 0;

  const requestClose = useCallback(() => {
    if (savingRef.current) return;
    if (isDirty && !window.confirm('لديك تغييرات لم تُحفظ. هل تريد الإغلاق دون حفظ؟')) return;
    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  const changeDate = (next: string) => {
    if (!next || next === date) return;
    if (isDirty && !window.confirm('لديك تغييرات لم تُحفظ لهذا اليوم. هل تريد تغيير التاريخ دون حفظ؟')) return;
    setDate(next);
  };

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter(s => showSuspended || !isSuspended(s) || saved[s.id])
      .filter(s => !q || s.full_name.toLowerCase().includes(q) || formatStudentCode(s).toLowerCase().includes(q))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
  }, [students, search, showSuspended, saved]);

  const setStatus = (id: string, status: AttendanceStatus) =>
    setRows(r => {
      const cur = r[id] ?? { status: null, note: '' };
      return { ...r, [id]: { ...cur, status: cur.status === status ? null : status } };
    });
  const setNote = (id: string, note: string) =>
    setRows(r => ({ ...r, [id]: { status: r[id]?.status ?? null, note } }));

  const markAllUnset = (status: AttendanceStatus) => {
    setRows(r => {
      const next = { ...r };
      list.forEach(s => { if (!next[s.id]?.status) next[s.id] = { status, note: next[s.id]?.note ?? '' }; });
      return next;
    });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { unset: 0 };
    ATTENDANCE_STATUSES.forEach(a => { c[a.id] = 0; });
    list.forEach(s => { const st = rows[s.id]?.status; c[st ?? 'unset'] += 1; });
    return c;
  }, [list, rows]);

  const save = async () => {
    if (savingRef.current || !isDirty) return;
    const changes = dirtyIds.map(id => ({ student_id: id, status: rows[id]?.status ?? null, note: rows[id]?.note ?? '' }));
    savingRef.current = true;
    setSaving(true);
    try {
      const records = await saveAttendance(date, changes);
      const byStudent: Record<string, AttendanceRecord> = {};
      records.forEach(r => { byStudent[r.student_id] = r; });
      setSaved(byStudent);
      setRows(prev => {
        const next: Record<string, Row> = {};
        Object.keys(prev).forEach(id => { if (prev[id].status) next[id] = { status: prev[id].status, note: byStudent[id]?.note ?? '' }; });
        return next;
      });
      toast.success(`تم حفظ الحضور (${changes.length} ${changes.length === 1 ? 'طالب' : 'طلاب'})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر حفظ الحضور');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const formatDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4" dir="rtl" onMouseDown={e => { if (e.target === e.currentTarget) requestClose(); }}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-4xl h-[95vh] sm:h-auto sm:max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-[#262150] text-white">
          <h3 className="text-xl font-black flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-pink-200" /> الحضور والغياب</h3>
          <button onClick={requestClose} disabled={saving} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10 disabled:opacity-40"><X className="w-5 h-5" /></button>
        </div>

        {/* Controls */}
        <div className="px-5 sm:px-6 py-4 space-y-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <input type="date" value={date} max={todayISO()} onChange={e => changeDate(e.target.value)} aria-label="تاريخ الحضور"
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold" />
              {date !== todayISO() && (
                <button onClick={() => changeDate(todayISO())} className="px-3 py-2.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 flex items-center gap-1"><RotateCcw className="w-4 h-4" /> اليوم</button>
              )}
            </div>
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن طالب…"
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{formatDay(date)}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            {ATTENDANCE_STATUSES.map(a => (
              <span key={a.id} className={`px-2.5 py-1 rounded-full border ${a.tone}`}>{a.label}: {counts[a.id]}</span>
            ))}
            <span className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500">لم يُسجَّل: {counts.unset}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => markAllUnset('present')} disabled={loading || counts.unset === 0}
              className="px-3 py-2 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 disabled:opacity-50 flex items-center gap-1.5">
              <CheckCheck className="w-4 h-4" /> تسجيل غير المحددين حاضرين
            </button>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={showSuspended} onChange={e => setShowSuspended(e.target.checked)} className="w-4 h-4 accent-[#262150]" />
              إظهار الطلاب الموقوفين
            </label>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : list.length === 0 ? (
            <p className="text-center py-12 text-slate-500 font-bold">لا يوجد طلاب</p>
          ) : (
            <ul className="space-y-2">
              {list.map(s => {
                const row = rows[s.id] ?? { status: null, note: '' };
                const savedRec = saved[s.id];
                const noteOpen = openNote === s.id || !!row.note;
                return (
                  <li key={s.id} className={`p-3 rounded-2xl border ${dirtyIds.includes(s.id) ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex items-center gap-3 md:w-56 shrink-0 min-w-0">
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-indigo-50 dark:bg-slate-800 border border-pink-200 shrink-0 flex items-center justify-center">
                          {s.photo_url ? <img src={s.photo_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <ImageOff className="w-4 h-4 text-slate-300" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-white truncate">{s.full_name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <span dir="ltr">{formatStudentCode(s)}</span>
                            {isSuspended(s) && <span className="px-1.5 rounded bg-red-100 text-red-700">موقوف</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {ATTENDANCE_STATUSES.map(a => (
                          <button key={a.id} type="button" onClick={() => setStatus(s.id, a.id)} aria-pressed={row.status === a.id}
                            className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors ${row.status === a.id ? a.active : `bg-white dark:bg-slate-800 ${a.tone} hover:bg-slate-50 dark:hover:bg-slate-700`}`}>
                            {a.short}
                          </button>
                        ))}
                        {!noteOpen && (
                          <button type="button" onClick={() => setOpenNote(s.id)} className="px-2.5 py-1.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1" title="إضافة ملاحظة">
                            <StickyNote className="w-4 h-4" /> ملاحظة
                          </button>
                        )}
                      </div>
                    </div>
                    {noteOpen && (
                      <input type="text" value={row.note} maxLength={300} onChange={e => setNote(s.id, e.target.value)} autoFocus={openNote === s.id && !row.note}
                        placeholder="مثال: تأخر 20 دقيقة، أو غائب بعذر مرضي"
                        className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
                    )}
                    {savedRec && (
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        سُجّل بواسطة {savedRec.recorded_by} — {new Date(savedRec.recorded_at).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
          <span className="text-sm font-medium text-slate-500">{isDirty ? `${dirtyIds.length} تغيير غير محفوظ` : 'لا توجد تغييرات غير محفوظة'}</span>
          <div className="flex gap-3">
            <button onClick={requestClose} disabled={saving} className="flex-1 sm:flex-none px-5 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50">إغلاق</button>
            <button onClick={save} disabled={saving || !isDirty} className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-white bg-[#262150] hover:bg-[#332c6b] disabled:opacity-50 flex items-center justify-center gap-2 min-w-[150px]">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'جاري الحفظ…' : 'حفظ الحضور'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
