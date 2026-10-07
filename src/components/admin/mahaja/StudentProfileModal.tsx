import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  X, Edit2, Trash2, User, Users, Phone, Calendar, Home, BookOpen, Hash, Clock, StickyNote, Loader2, ImageOff,
  CreditCard as IdCard, CalendarCheck, History, Ban, PlayCircle, Send, AlertTriangle,
} from 'lucide-react';
import {
  ATTENDANCE_STATUSES, addStudentNote, attendanceLabel, computeAttendanceStats, formatAge, formatAhzab, formatStudentCode,
  getStudentDetails, isSuspended, setStudentStatus,
  type MahajaStudent, type StudentDetails, type StudentLogEntry,
} from '../../../lib/mahajaStudents';
import { studentCardDataUrl } from '../../../utils/studentCard';
import { CardDownloadButtons } from './CardDownloadButtons';

interface Props {
  student: MahajaStudent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Called when the student record changes here (e.g. suspended / reactivated). */
  onUpdated: (student: MahajaStudent) => void;
}

type Tab = 'info' | 'attendance' | 'notes' | 'history';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('ar-MA', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' });

const FIELD_LABELS: Record<string, string> = {
  full_name: 'الاسم', guardian_name: 'اسم الولي', guardian_phone: 'هاتف الولي', age: 'العمر',
  address: 'مكان السكن', quran_ahzab: 'عدد الأحزاب', photo_path: 'الصورة', notes: 'الملاحظات العامة',
};

const describeLog = (e: StudentLogEntry): string => {
  const d = e.details as Record<string, unknown>;
  switch (e.action) {
    case 'created': return 'تسجيل الطالب';
    case 'updated': {
      const fields = (d.fields as string[] | undefined)?.map(f => FIELD_LABELS[f] ?? f).join('، ');
      const ahzab = d.old_ahzab !== d.new_ahzab && d.new_ahzab !== undefined ? ` (الأحزاب: ${d.old_ahzab} ← ${d.new_ahzab})` : '';
      return `تعديل البيانات: ${fields ?? ''}${ahzab}`;
    }
    case 'suspended': return `إيقاف الطالب${d.reason ? ` — السبب: ${d.reason}` : ''}`;
    case 'reactivated': return 'إعادة تفعيل الطالب';
    case 'note_added': return `إضافة ملاحظة: ${d.note ?? ''}`;
    case 'attendance': {
      const prev = d.previous ? ` (كان: ${attendanceLabel(String(d.previous))})` : '';
      return `حضور ${formatDay(String(d.date))}: ${attendanceLabel(String(d.status))}${prev}${d.note ? ` — ${d.note}` : ''}`;
    }
    case 'attendance_cleared': return `حذف تسجيل حضور يوم ${formatDay(String(d.date))}`;
    default: return e.action;
  }
};

const statusChip = (status: string) => {
  const a = ATTENDANCE_STATUSES.find(x => x.id === status);
  return <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${a?.active ?? 'bg-slate-200'}`}>{a?.label ?? status}</span>;
};

export const StudentProfileModal = ({ student, onClose, onEdit, onDelete, onUpdated }: Props) => {
  const [tab, setTab] = useState<Tab>('info');
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [cardError, setCardError] = useState(false);

  const [details, setDetails] = useState<StudentDetails | null>(null);
  const [detailsError, setDetailsError] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(true);

  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [reason, setReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  // Re-render the card whenever the student record changes (e.g. after an edit).
  useEffect(() => {
    let cancelled = false;
    setCardUrl(null);
    setCardError(false);
    studentCardDataUrl(student, 1)
      .then(url => { if (!cancelled) setCardUrl(url); })
      .catch(() => { if (!cancelled) setCardError(true); });
    return () => { cancelled = true; };
  }, [student]);

  const loadDetails = useCallback(async () => {
    setDetailsLoading(true);
    setDetailsError('');
    try {
      setDetails(await getStudentDetails(student.id));
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'تعذّر تحميل السجل');
    } finally {
      setDetailsLoading(false);
    }
  }, [student.id]);

  // Reload history when the record changes (edits and status changes add log entries).
  useEffect(() => { void loadDetails(); }, [loadDetails, student.updated_at]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !statusDialog) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, statusDialog]);

  const suspended = isSuspended(student);
  const stats = computeAttendanceStats(details?.attendance ?? []);

  const submitNote = async () => {
    if (addingNote) return;
    setAddingNote(true);
    try {
      const note = await addStudentNote(student.id, noteText);
      setDetails(d => d ? { ...d, notes: [note, ...d.notes] } : d);
      setNoteText('');
      toast.success('تمت إضافة الملاحظة');
      void loadDetails();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر إضافة الملاحظة');
    } finally {
      setAddingNote(false);
    }
  };

  const changeStatus = async () => {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      const updated = await setStudentStatus(student.id, suspended ? 'active' : 'suspended', reason);
      onUpdated(updated);
      toast.success(suspended ? 'تمت إعادة تفعيل الطالب' : 'تم إيقاف الطالب');
      setStatusDialog(false);
      setReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر تغيير حالة الطالب');
    } finally {
      setStatusBusy(false);
    }
  };

  const info = [
    { icon: Hash, label: 'معرف الطالب', value: formatStudentCode(student), ltr: true },
    { icon: User, label: 'الاسم الكامل للطالب', value: student.full_name },
    { icon: Users, label: 'الاسم الكامل للولي', value: student.guardian_name },
    { icon: Phone, label: 'رقم هاتف الولي', value: student.guardian_phone, ltr: true, href: `tel:${student.guardian_phone}` },
    { icon: Calendar, label: 'العمر', value: formatAge(student.age) },
    { icon: Home, label: 'مكان السكن', value: student.address },
    { icon: BookOpen, label: 'عدد أحزاب القرآن', value: formatAhzab(student.quran_ahzab) },
    { icon: Clock, label: 'تاريخ التسجيل', value: formatDateTime(student.created_at) },
    { icon: Clock, label: 'آخر تحديث', value: formatDateTime(student.updated_at) },
  ];

  const tabs: { id: Tab; label: string; icon: typeof IdCard; count?: number }[] = [
    { id: 'info', label: 'المعلومات والبطاقة', icon: IdCard },
    { id: 'attendance', label: 'سجل الحضور', icon: CalendarCheck, count: details?.attendance.length },
    { id: 'notes', label: 'الملاحظات', icon: StickyNote, count: details?.notes.length },
    { id: 'history', label: 'سجل الطالب', icon: History },
  ];

  const detailsState = detailsLoading && !details ? (
    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  ) : detailsError ? (
    <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 text-center space-y-3">
      <p className="font-bold text-slate-700 dark:text-slate-200">{detailsError}</p>
      <button onClick={() => void loadDetails()} className="px-4 py-2 rounded-xl bg-white border border-amber-200 font-bold">إعادة المحاولة</button>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4" dir="rtl" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-5xl max-h-[95vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#262150] text-white">
          <h3 className="text-xl font-black">ملف الطالب</h3>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Side card */}
          <div className="flex flex-col items-center gap-3">
            <div className={`relative w-40 h-48 sm:w-48 sm:h-56 rounded-3xl overflow-hidden border-4 ${suspended ? 'border-red-300' : 'border-pink-200'} bg-indigo-50 dark:bg-slate-800 flex items-center justify-center`}>
              {student.photo_url
                ? <img src={student.photo_url} alt={student.full_name} className={`w-full h-full object-cover ${suspended ? 'grayscale' : ''}`} />
                : <ImageOff className="w-12 h-12 text-slate-300" />}
              {suspended && <span className="absolute top-2 inset-x-2 text-center text-xs font-black text-white bg-red-600/90 rounded-lg py-1">موقوف</span>}
            </div>
            <h4 className="text-xl font-black text-slate-800 dark:text-white text-center">{student.full_name}</h4>
            <span className="px-3 py-1 rounded-full bg-pink-100 text-[#262150] font-bold text-sm" dir="ltr">{formatStudentCode(student)}</span>
            {suspended && student.status_reason && (
              <p className="text-xs text-red-600 font-bold text-center">سبب الإيقاف: {student.status_reason}</p>
            )}
            <div className="grid grid-cols-2 gap-2 w-full pt-2">
              <button onClick={onEdit} className="px-4 py-2.5 rounded-xl font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center justify-center gap-2"><Edit2 className="w-4 h-4" /> تعديل</button>
              <button onClick={onDelete} className="px-4 py-2.5 rounded-xl font-bold bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> حذف</button>
              <button onClick={() => setStatusDialog(true)}
                className={`col-span-2 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 ${suspended ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                {suspended ? <><PlayCircle className="w-4 h-4" /> إعادة تفعيل الطالب</> : <><Ban className="w-4 h-4" /> إيقاف الطالب</>}
              </button>
            </div>

            {/* Quick attendance stats */}
            <div className="w-full grid grid-cols-2 gap-2 pt-2">
              <div className="col-span-2 p-3 rounded-2xl bg-[#262150] text-white text-center">
                <div className="text-3xl font-black">{stats.rate === null ? '—' : `${stats.rate}%`}</div>
                <div className="text-xs text-pink-100/80 font-bold">نسبة الحضور</div>
              </div>
              {[
                { label: 'أيام الحضور', value: stats.present, cls: 'text-emerald-600' },
                { label: 'أيام الغياب', value: stats.absent, cls: 'text-red-600' },
                { label: 'مرات التأخر', value: stats.late, cls: 'text-amber-600' },
                { label: 'الخروج المبكر', value: stats.left_early, cls: 'text-orange-600' },
              ].map(s => (
                <div key={s.label} className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
                  <div className={`text-xl font-black ${s.cls}`}>{s.value}</div>
                  <div className="text-[11px] font-bold text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Main */}
          <div className="space-y-5 min-w-0">
            <div role="tablist" className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-x-auto">
              {tabs.map(t => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 min-w-max px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap ${tab === t.id ? 'bg-white dark:bg-slate-900 text-[#262150] dark:text-white shadow-sm' : 'text-slate-500'}`}>
                  <t.icon className="w-4 h-4" /> {t.label}
                  {!!t.count && <span className="px-1.5 rounded-full bg-pink-100 text-[#262150] text-[11px]">{t.count}</span>}
                </button>
              ))}
            </div>

            {tab === 'info' && (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {info.map(item => (
                    <div key={item.label} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="w-9 h-9 shrink-0 rounded-xl bg-[#262150] text-white flex items-center justify-center"><item.icon className="w-4 h-4" /></div>
                      <div className="min-w-0">
                        <dt className="text-xs font-bold text-slate-500">{item.label}</dt>
                        <dd className="font-bold text-slate-800 dark:text-white break-words" dir={item.ltr ? 'ltr' : undefined} style={item.ltr ? { textAlign: 'right' } : undefined}>
                          {item.href ? <a href={item.href} className="hover:underline">{item.value}</a> : item.value}
                        </dd>
                      </div>
                    </div>
                  ))}
                  {student.notes && (
                    <div className="sm:col-span-2 flex items-start gap-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                      <StickyNote className="w-5 h-5 text-amber-600 mt-0.5" />
                      <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{student.notes}</p>
                    </div>
                  )}
                </dl>

                <section>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <h4 className="text-lg font-black text-slate-800 dark:text-white">بطاقة الطالب</h4>
                    <CardDownloadButtons student={student} />
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 aspect-[1586/992] flex items-center justify-center">
                    {cardUrl ? <img src={cardUrl} alt={`بطاقة ${student.full_name}`} className="w-full h-full object-contain" />
                      : cardError ? <p className="text-red-600 font-bold">تعذّر إنشاء معاينة البطاقة</p>
                      : <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />}
                  </div>
                </section>
              </>
            )}

            {tab === 'attendance' && (detailsState ?? (
              <section className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: 'الأيام المسجلة', value: stats.total },
                    { label: 'حاضر', value: stats.present },
                    { label: 'غائب', value: stats.absent },
                    { label: 'متأخر', value: stats.late },
                    { label: 'خرج مبكرًا', value: stats.left_early },
                    { label: 'غياب بعذر', value: stats.excused },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="text-xl font-black text-slate-800 dark:text-white">{s.value}</div>
                      <div className="text-xs font-bold text-slate-500">{s.label}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  نسبة الحضور = (حاضر + متأخر + خرج مبكرًا) ÷ (الأيام المسجلة باستثناء الغياب بعذر).
                </p>
                {details!.attendance.length === 0 ? (
                  <p className="text-center py-10 text-slate-500 font-bold">لم يُسجَّل أي حضور لهذا الطالب بعد. استخدم زر «الحضور» في قائمة الطلاب.</p>
                ) : (
                  <>
                    <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                          <tr>
                            <th className="p-3 text-start font-bold">التاريخ</th>
                            <th className="p-3 text-start font-bold">الحالة</th>
                            <th className="p-3 text-start font-bold">الملاحظة</th>
                            <th className="p-3 text-start font-bold">المشرف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {details!.attendance.map(r => (
                            <tr key={r.id}>
                              <td className="p-3 font-bold whitespace-nowrap">{formatDay(r.attendance_date)}</td>
                              <td className="p-3">{statusChip(r.status)}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">{r.note || '—'}</td>
                              <td className="p-3 text-slate-500 whitespace-nowrap">
                                {r.recorded_by}
                                <div className="text-[11px]">{new Date(r.recorded_at).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ul className="sm:hidden space-y-2">
                      {details!.attendance.map(r => (
                        <li key={r.id} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm">{formatDay(r.attendance_date)}</span>
                            {statusChip(r.status)}
                          </div>
                          {r.note && <p className="text-sm text-slate-600 dark:text-slate-300">{r.note}</p>}
                          <p className="text-[11px] text-slate-400">بواسطة {r.recorded_by}</p>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            ))}

            {tab === 'notes' && (detailsState ?? (
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} maxLength={1000}
                    placeholder="اكتب ملاحظة عن الطالب (السلوك، الحفظ، التواصل مع الولي…)"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-300" />
                  <button onClick={submitNote} disabled={addingNote || !noteText.trim()}
                    className="px-5 py-3 rounded-xl font-bold text-white bg-[#262150] hover:bg-[#332c6b] disabled:opacity-50 flex items-center justify-center gap-2 sm:self-stretch">
                    {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إضافة
                  </button>
                </div>
                {details!.notes.length === 0 ? (
                  <p className="text-center py-8 text-slate-500 font-bold">لا توجد ملاحظات بعد</p>
                ) : (
                  <ul className="space-y-2">
                    {details!.notes.map(n => (
                      <li key={n.id} className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                        <p className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{n.note}</p>
                        <p className="text-xs text-slate-500 mt-2">{n.created_by} — {formatDateTime(n.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            {tab === 'history' && (detailsState ?? (
              details!.log.length === 0 ? (
                <p className="text-center py-10 text-slate-500 font-bold">لا يوجد سجل بعد. ستظهر هنا كل التعديلات والحضور والملاحظات.</p>
              ) : (
                <ol className="relative border-s-2 border-pink-200 dark:border-slate-700 ms-3 space-y-4">
                  {details!.log.map(e => (
                    <li key={e.id} className="ms-5">
                      <span className="absolute -start-[7px] mt-1.5 w-3 h-3 rounded-full bg-[#262150] border-2 border-white dark:border-slate-900" />
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{describeLog(e)}</p>
                      <p className="text-xs text-slate-500">{e.actor} — {formatDateTime(e.created_at)}</p>
                    </li>
                  ))}
                </ol>
              )
            ))}
          </div>
        </div>
      </motion.div>

      {/* Suspend / reactivate confirmation */}
      {statusDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={e => { if (e.target === e.currentTarget && !statusBusy) setStatusDialog(false); }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} role="alertdialog" aria-modal="true"
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${suspended ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {suspended ? <PlayCircle className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
            </div>
            <h3 className="text-xl font-black text-center text-slate-800 dark:text-white">{suspended ? 'إعادة تفعيل الطالب' : 'إيقاف الطالب'}</h3>
            <p className="text-center text-slate-600 dark:text-slate-300">
              {suspended
                ? <>سيعود الطالب <strong>«{student.full_name}»</strong> إلى قائمة الطلاب النشطين وقوائم الحضور.</>
                : <>سيبقى ملف الطالب <strong>«{student.full_name}»</strong> وسجله محفوظين، لكنه لن يظهر في قوائم الحضور اليومية.</>}
            </p>
            {!suspended && (
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} maxLength={200} placeholder="سبب الإيقاف (اختياري)"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            )}
            <div className="flex gap-3">
              <button onClick={() => setStatusDialog(false)} disabled={statusBusy} className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">إلغاء</button>
              <button onClick={changeStatus} disabled={statusBusy}
                className={`flex-1 py-3 rounded-xl font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2 ${suspended ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                {statusBusy && <Loader2 className="w-5 h-5 animate-spin" />} تأكيد
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
