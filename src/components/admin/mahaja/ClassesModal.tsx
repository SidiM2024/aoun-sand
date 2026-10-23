import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { X, Plus, Loader2, Save, Trash2, Edit2, Layers, Users, UserCog, Search, ArrowRight } from 'lucide-react';
import {
  CLASS_PERIOD_LABELS, deleteClass, formatStudentCode, getSupervisorOptions, isSuspended, saveClass, setClassStudents,
  setClassSupervisors, type AttendanceContext, type MahajaClass, type MahajaStudent,
} from '../../../lib/mahajaStudents';

interface Props {
  context: AttendanceContext;
  students: MahajaStudent[];
  onClose: () => void;
  onChanged: () => void;
}

type Draft = { id: string | null; name: string; periods: MahajaClass['periods']; is_active: boolean; studentIds: Set<string>; supervisorIds: Set<string> };

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';

// Classes (الحلقات): which students a supervisor records attendance for.
// Managers create classes and choose students; only the Super Admin assigns supervisors.
export const ClassesModal = ({ context, students, onClose, onChanged }: Props) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [supervisors, setSupervisors] = useState<{ id: string; label: string; is_active: boolean }[] | null>(null);
  const [search, setSearch] = useState('');
  const isSuper = context.me.is_super;

  useEffect(() => {
    if (!isSuper) return;
    getSupervisorOptions().then(setSupervisors).catch(() => setSupervisors([]));
  }, [isSuper]);

  const edit = (c: MahajaClass | null) => {
    setSearch('');
    setDraft(c
      ? { id: c.id, name: c.name, periods: c.periods, is_active: c.is_active, studentIds: new Set(c.student_ids), supervisorIds: new Set(c.supervisors.map(s => s.id)) }
      : { id: null, name: '', periods: 'both', is_active: true, studentIds: new Set(), supervisorIds: new Set() });
  };

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter(s => !isSuspended(s) || draft?.studentIds.has(s.id))
      .filter(s => !q || s.full_name.toLowerCase().includes(q) || formatStudentCode(s).toLowerCase().includes(q))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
  }, [students, search, draft]);

  const toggle = (key: 'studentIds' | 'supervisorIds', id: string) => setDraft(d => {
    if (!d) return d;
    const next = new Set(d[key]);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { ...d, [key]: next };
  });

  const save = async () => {
    if (!draft || saving) return;
    if (draft.name.trim().length < 2) { toast.error('اسم الحلقة مطلوب'); return; }
    setSaving(true);
    try {
      const c = await saveClass(draft.id, { name: draft.name.trim(), periods: draft.periods, is_active: draft.is_active });
      await setClassStudents(c.id, [...draft.studentIds]);
      if (isSuper) await setClassSupervisors(c.id, [...draft.supervisorIds]);
      toast.success(draft.id ? 'تم تحديث الحلقة' : 'تم إنشاء الحلقة');
      setDraft(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: MahajaClass) => {
    if (!window.confirm(`حذف حلقة «${c.name}»؟ لن تُحذف سجلات الحضور.`)) return;
    try { await deleteClass(c.id); toast.success('تم حذف الحلقة'); onChanged(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'تعذّر الحذف'); }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4" dir="rtl" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-3xl h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-[#262150] text-white">
          <h3 className="text-lg font-black flex items-center gap-2">
            {draft && <button onClick={() => setDraft(null)} disabled={saving} aria-label="رجوع" className="p-1 rounded-lg hover:bg-white/10"><ArrowRight className="w-5 h-5" /></button>}
            <Layers className="w-5 h-5 text-pink-200" /> {draft ? (draft.id ? 'تعديل الحلقة' : 'حلقة جديدة') : 'الحلقات والمشرفون'}
          </h3>
          <button onClick={onClose} disabled={saving} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        {!draft ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              المشرف المكلف بحلقة يسجّل حضور وخروج طلابها فقط، في فترات الحلقة. المشرف غير المكلف بأي حلقة يرى جميع الطلاب كما في السابق.
              {!isSuper && ' تعيين المشرفين على الحلقات من صلاحية المشرف العام.'}
            </p>
            <button onClick={() => edit(null)} className="px-4 py-2.5 rounded-xl font-bold text-white bg-[#262150] flex items-center gap-2"><Plus className="w-4 h-4" /> حلقة جديدة</button>
            {context.classes.length === 0 ? (
              <p className="text-center py-10 text-slate-500 font-bold">لا توجد حلقات بعد</p>
            ) : context.classes.map(c => (
              <div key={c.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 dark:text-white">{c.name} {!c.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">موقوفة</span>}</p>
                  <p className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3">
                    <span>الفترة: {CLASS_PERIOD_LABELS[c.periods]}</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.student_ids.length} طالب</span>
                    <span className="flex items-center gap-1"><UserCog className="w-3.5 h-3.5" /> {c.supervisors.length ? c.supervisors.map(s => s.label).join('، ') : 'بدون مشرف'}</span>
                  </p>
                </div>
                <button onClick={() => edit(c)} className="px-3 py-2 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-700 flex items-center gap-1.5"><Edit2 className="w-4 h-4" /> تعديل</button>
                <button onClick={() => void remove(c)} className="px-3 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> حذف</button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="sm:col-span-2 block"><span className="block text-sm font-bold mb-1.5">اسم الحلقة *</span>
                  <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} maxLength={80} placeholder="مثال: حلقة الحفظ — المستوى الأول" className={inputCls} /></label>
                <label className="block"><span className="block text-sm font-bold mb-1.5">الفترة</span>
                  <select value={draft.periods} onChange={e => setDraft({ ...draft, periods: e.target.value as MahajaClass['periods'] })} className={inputCls}>
                    {(Object.keys(CLASS_PERIOD_LABELS) as MahajaClass['periods'][]).map(p => <option key={p} value={p}>{CLASS_PERIOD_LABELS[p]}</option>)}
                  </select></label>
              </div>
              <label className="flex items-center gap-2 text-sm font-bold cursor-pointer w-fit">
                <input type="checkbox" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} className="w-4 h-4 accent-[#262150]" /> الحلقة مفعّلة
              </label>

              {isSuper && (
                <section>
                  <h4 className="font-black mb-2 flex items-center gap-1.5"><UserCog className="w-4 h-4" /> المشرفون المكلفون</h4>
                  {supervisors === null ? <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> : supervisors.length === 0 ? (
                    <p className="text-sm text-slate-500">لا يوجد مشرفون لديهم صلاحية قسم المحجة البيضاء. أضفهم من صفحة إدارة المشرفين.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {supervisors.map(a => (
                        <button key={a.id} type="button" onClick={() => toggle('supervisorIds', a.id)} aria-pressed={draft.supervisorIds.has(a.id)}
                          className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${draft.supervisorIds.has(a.id) ? 'bg-[#262150] text-white border-[#262150]' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                          {a.label}{!a.is_active && ' (معطّل)'}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h4 className="font-black flex items-center gap-1.5"><Users className="w-4 h-4" /> طلاب الحلقة ({draft.studentIds.size})</h4>
                  <div className="flex gap-2 text-sm">
                    <button type="button" onClick={() => setDraft({ ...draft, studentIds: new Set([...draft.studentIds, ...visibleStudents.map(s => s.id)]) })} className="px-3 py-1.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800">تحديد الظاهرين</button>
                    <button type="button" onClick={() => setDraft({ ...draft, studentIds: new Set() })} className="px-3 py-1.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800">إلغاء الكل</button>
                  </div>
                </div>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن طالب…" className={`${inputCls} pr-10`} />
                </div>
                <ul className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleStudents.map(s => (
                    <li key={s.id}>
                      <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input type="checkbox" checked={draft.studentIds.has(s.id)} onChange={() => toggle('studentIds', s.id)} className="w-4 h-4 accent-[#262150]" />
                        <span className="font-bold text-sm flex-1">{s.full_name}</span>
                        <span className="text-xs text-slate-400" dir="ltr">{formatStudentCode(s)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button onClick={() => setDraft(null)} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800">إلغاء</button>
              <button onClick={() => void save()} disabled={saving} className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#262150] flex items-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};
