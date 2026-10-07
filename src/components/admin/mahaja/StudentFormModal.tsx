import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Camera, X, Save, UserPlus, Trash2, User, Users, Phone, Calendar, Home, BookOpen, Loader2 } from 'lucide-react';
import {
  createStudent, updateStudent, validatePhoto, validateStudent, MAX_AHZAB,
  type MahajaStudent, type MahajaStudentInput, type StudentFormErrors,
} from '../../../lib/mahajaStudents';

interface Props {
  student?: MahajaStudent | null;
  onClose: () => void;
  onSaved: (student: MahajaStudent, isNew: boolean) => void;
}

type FormState = Record<keyof Omit<MahajaStudentInput, 'photo_url' | 'photo_path'>, string>;

const emptyForm: FormState = { full_name: '', guardian_name: '', guardian_phone: '', age: '', address: '', quran_ahzab: '', notes: '' };

const fields: { key: keyof FormState; label: string; icon: React.ElementType; type?: string; placeholder: string; dir?: 'ltr'; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }[] = [
  { key: 'full_name', label: 'الاسم الكامل للطالب', icon: User, placeholder: 'مثال: محمد الأمين أحمد' },
  { key: 'guardian_name', label: 'الاسم الكامل للولي', icon: Users, placeholder: 'مثال: أحمد ولد محمد' },
  { key: 'guardian_phone', label: 'رقم هاتف الولي', icon: Phone, type: 'tel', placeholder: '+222 xx xx xx xx', dir: 'ltr', inputMode: 'tel' },
  { key: 'age', label: 'العمر', icon: Calendar, type: 'number', placeholder: 'بالسنوات', inputMode: 'numeric' },
  { key: 'address', label: 'مكان السكن', icon: Home, placeholder: 'المدينة / الحي' },
  { key: 'quran_ahzab', label: 'عدد أحزاب القرآن عند الطالب', icon: BookOpen, type: 'number', placeholder: `من 0 إلى ${MAX_AHZAB}`, inputMode: 'numeric' },
];

export const StudentFormModal = ({ student, onClose, onSaved }: Props) => {
  const isEdit = !!student;
  const [form, setForm] = useState<FormState>(() => student ? {
    full_name: student.full_name, guardian_name: student.guardian_name, guardian_phone: student.guardian_phone,
    age: String(student.age), address: student.address, quran_ahzab: String(student.quran_ahzab), notes: student.notes ?? '',
  } : emptyForm);
  const [errors, setErrors] = useState<StudentFormErrors>({});
  // undefined = keep the current photo, File = replace it.
  const [photo, setPhoto] = useState<File | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(student?.photo_url ?? null);
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState('');
  const savingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !savingRef.current) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setField = (key: keyof FormState, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const invalid = validatePhoto(file);
    if (invalid) { setErrors(er => ({ ...er, photo: invalid })); toast.error(invalid); return; }
    setErrors(er => ({ ...er, photo: undefined }));
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  // Drops a newly picked photo and falls back to the saved one (if any).
  const discardPickedPhoto = () => {
    setPhoto(undefined);
    setPreview(student?.photo_url ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return; // guards against double submission
    const validation = validateStudent(form);
    if (!photo && !student?.photo_url) validation.photo = 'صورة الطالب مطلوبة';
    setErrors(validation);
    if (Object.values(validation).some(Boolean)) {
      toast.error('يرجى تصحيح الحقول المحددة باللون الأحمر');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setStage(photo ? 'جاري رفع الصورة وحفظ البيانات…' : 'جاري حفظ البيانات…');
    const input: MahajaStudentInput = {
      full_name: form.full_name, guardian_name: form.guardian_name, guardian_phone: form.guardian_phone,
      age: Number(form.age), address: form.address, quran_ahzab: Number(form.quran_ahzab), notes: form.notes,
    };
    try {
      const saved = isEdit
        ? await updateStudent(student!, input, photo)
        : await createStudent(input, photo ?? null);
      toast.success(isEdit ? 'تم تحديث بيانات الطالب بنجاح' : `تم تسجيل الطالب «${saved.full_name}» بنجاح`);
      onSaved(saved, !isEdit);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر حفظ البيانات');
      savingRef.current = false;
      setSaving(false);
      setStage('');
    }
  };

  const inputClass = (key: keyof StudentFormErrors) =>
    `w-full pr-11 pl-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none transition focus:ring-2 ${
      errors[key] ? 'border-red-400 focus:ring-red-300' : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-300'
    }`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4" dir="rtl" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <motion.form
        onSubmit={handleSubmit}
        noValidate
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-3xl max-h-[95vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#262150] text-white">
          <h3 className="text-xl font-black flex items-center gap-2">
            {isEdit ? <Save className="w-5 h-5 text-pink-200" /> : <UserPlus className="w-5 h-5 text-pink-200" />}
            {isEdit ? 'تعديل بيانات الطالب' : 'تسجيل طالب جديد'}
          </h3>
          <button type="button" onClick={onClose} disabled={saving} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10 disabled:opacity-40"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          {/* Photo */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={saving}
              className={`relative w-44 h-52 rounded-3xl overflow-hidden border-4 ${errors.photo ? 'border-red-400' : 'border-pink-200'} bg-indigo-50 dark:bg-slate-800 flex items-center justify-center group`}
            >
              {preview ? (
                <img src={preview} alt="معاينة صورة الطالب" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-slate-400"><User className="w-16 h-16" /><span className="text-sm font-bold mt-2">اختر صورة</span></div>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-[#262150]/80 text-white text-sm font-bold py-2 flex items-center justify-center gap-1 opacity-90 group-hover:opacity-100">
                <Camera className="w-4 h-4" /> {preview ? 'تغيير الصورة' : 'رفع صورة'}
              </span>
            </button>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickPhoto} />
            {photo && (
              <button type="button" onClick={discardPickedPhoto} disabled={saving} className="text-sm font-bold text-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4" /> {isEdit && student?.photo_url ? 'التراجع عن الصورة الجديدة' : 'إزالة الصورة'}</button>
            )}
            <p className={`text-xs text-center ${errors.photo ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
              {errors.photo || 'JPG أو PNG أو WEBP — حتى 5 ميغابايت'}
            </p>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(f => (
              <div key={f.key} className={f.key === 'full_name' || f.key === 'quran_ahzab' ? 'sm:col-span-2' : ''}>
                <label htmlFor={`student-${f.key}`} className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {f.label} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <f.icon className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id={`student-${f.key}`}
                    type={f.type ?? 'text'}
                    inputMode={f.inputMode}
                    dir={f.dir}
                    min={f.type === 'number' ? 0 : undefined}
                    max={f.key === 'quran_ahzab' ? MAX_AHZAB : f.key === 'age' ? 100 : undefined}
                    value={form[f.key]}
                    onChange={e => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    disabled={saving}
                    aria-invalid={!!errors[f.key]}
                    className={`${inputClass(f.key)} ${f.dir === 'ltr' ? 'text-right' : ''}`}
                  />
                </div>
                {errors[f.key] && <p className="text-xs text-red-600 font-bold mt-1">{errors[f.key]}</p>}
              </div>
            ))}
            <div className="sm:col-span-2">
              <label htmlFor="student-notes" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">ملاحظات <span className="text-slate-400 font-medium">(اختياري)</span></label>
              <textarea id="student-notes" value={form.notes} onChange={e => setField('notes', e.target.value)} disabled={saving} rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
          <span className="text-sm text-slate-500 font-medium min-h-[1.25rem]">{stage}</span>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none px-5 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50">إلغاء</button>
            <button type="submit" disabled={saving} className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-white bg-[#262150] hover:bg-[#332c6b] disabled:opacity-60 flex items-center justify-center gap-2 min-w-[150px]">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : isEdit ? <Save className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              {saving ? 'جاري الحفظ…' : isEdit ? 'حفظ التعديلات' : 'تسجيل الطالب'}
            </button>
          </div>
        </div>
      </motion.form>
    </div>
  );
};
