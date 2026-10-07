import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Edit2, Trash2, User, Users, Phone, Calendar, Home, BookOpen, Hash, Clock, StickyNote, Loader2, ImageOff } from 'lucide-react';
import { formatAge, formatAhzab, formatStudentCode, type MahajaStudent } from '../../../lib/mahajaStudents';
import { studentCardDataUrl } from '../../../utils/studentCard';
import { CardDownloadButtons } from './CardDownloadButtons';

interface Props {
  student: MahajaStudent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const StudentProfileModal = ({ student, onClose, onEdit, onDelete }: Props) => {
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [cardError, setCardError] = useState(false);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4" dir="rtl" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-5xl max-h-[95vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#262150] text-white">
          <h3 className="text-xl font-black">ملف الطالب</h3>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-48 h-56 rounded-3xl overflow-hidden border-4 border-pink-200 bg-indigo-50 dark:bg-slate-800 flex items-center justify-center">
              {student.photo_url
                ? <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                : <ImageOff className="w-12 h-12 text-slate-300" />}
            </div>
            <h4 className="text-xl font-black text-slate-800 dark:text-white text-center">{student.full_name}</h4>
            <span className="px-3 py-1 rounded-full bg-pink-100 text-[#262150] font-bold text-sm" dir="ltr">{formatStudentCode(student)}</span>
            <div className="flex gap-2 w-full pt-2">
              <button onClick={onEdit} className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center justify-center gap-2"><Edit2 className="w-4 h-4" /> تعديل</button>
              <button onClick={onDelete} className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> حذف</button>
            </div>
          </div>

          <div className="space-y-6 min-w-0">
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
          </div>
        </div>
      </motion.div>
    </div>
  );
};
