import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus, Search, MapPin, ArrowDownUp, Eye, Edit2, Trash2, Download, Users, Phone, Calendar, BookOpen, Home,
  RefreshCw, ShieldCheck, Loader2, AlertTriangle, ImageOff, X, FileText, GraduationCap, CalendarCheck, Filter,
} from 'lucide-react';
import {
  checkStudentsAccess, deleteStudent, formatAge, formatAhzab, formatStudentCode, isSuspended, issueStudentsToken, listStudents, StudentsError,
  type MahajaStudent,
} from '../../../lib/mahajaStudents';
import { downloadStudentCardPdf, downloadStudentCardPng } from '../../../utils/studentCard';
import { StudentFormModal } from './StudentFormModal';
import { StudentProfileModal } from './StudentProfileModal';
import { AttendanceModal } from './AttendanceModal';

type AccessState = 'checking' | 'granted' | 'needs_verification' | 'forbidden' | 'not_installed' | 'error';
type SortOrder = 'newest' | 'oldest';
type StatusFilter = 'all' | 'active' | 'suspended';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ar-MA', { year: 'numeric', month: '2-digit', day: '2-digit' });

// ─── Admin re-verification (legacy dashboard logins) ──────────────────────────

const VerifyAdminPanel = ({ onVerified }: { onVerified: () => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (await issueStudentsToken(username, password)) {
        toast.success('تم التحقق من هوية المشرف');
        setPassword('');
        onVerified();
      } else {
        toast.error('بيانات الدخول غير صحيحة أو الحساب غير مفعّل');
      }
    } catch {
      toast.error('تعذّر الاتصال بالخادم');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md mx-auto my-8 p-6 rounded-3xl border border-indigo-100 dark:border-slate-700 bg-indigo-50/50 dark:bg-slate-800/50 space-y-4">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#262150] text-white flex items-center justify-center"><ShieldCheck className="w-7 h-7" /></div>
        <h3 className="text-lg font-black text-slate-800 dark:text-white">تأكيد هوية المشرف</h3>
        <p className="text-sm text-slate-500">بيانات الطلاب محمية. أعد إدخال بيانات دخول المشرف للوصول إلى هذا القسم.</p>
      </div>
      <input type="text" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} placeholder="اسم المستخدم / البريد" dir="ltr"
        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center" />
      <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" dir="ltr"
        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center" />
      <button type="submit" disabled={busy} className="w-full py-3 rounded-xl font-bold text-white bg-[#262150] disabled:opacity-60 flex items-center justify-center gap-2">
        {busy && <Loader2 className="w-5 h-5 animate-spin" />} تأكيد
      </button>
    </form>
  );
};

// ─── Download menu used on each student card ──────────────────────────────────

const DownloadMenu = ({ student }: { student: MahajaStudent }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const run = async (format: 'png' | 'pdf') => {
    setOpen(false);
    if (busy) return;
    setBusy(true);
    const id = toast.loading('جاري تجهيز البطاقة…');
    try {
      if (format === 'png') await downloadStudentCardPng(student);
      else await downloadStudentCardPdf(student);
      toast.success('تم تنزيل البطاقة بنجاح', { id });
    } catch (err) {
      console.error('Student card export failed', err);
      toast.error('تعذّر تنزيل البطاقة، حاول مرة أخرى', { id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} disabled={busy} aria-expanded={open}
        className="w-full px-3 py-2 rounded-xl text-sm font-bold bg-pink-50 text-[#262150] hover:bg-pink-100 flex items-center justify-center gap-1.5 disabled:opacity-60">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} تنزيل البطاقة
      </button>
      {open && (
        <div className="absolute z-20 bottom-full mb-2 inset-x-0 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button type="button" onClick={() => run('png')} className="w-full px-4 py-2.5 text-sm font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700"><Download className="w-4 h-4" /> صورة PNG</button>
          <button type="button" onClick={() => run('pdf')} className="w-full px-4 py-2.5 text-sm font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700"><FileText className="w-4 h-4" /> ملف PDF</button>
        </div>
      )}
    </div>
  );
};

// ─── Delete confirmation ──────────────────────────────────────────────────────

const ConfirmDelete = ({ student, onCancel, onConfirm }: { student: MahajaStudent; onCancel: () => void; onConfirm: () => Promise<void> }) => {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" dir="rtl">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} role="alertdialog" aria-modal="true"
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center"><AlertTriangle className="w-8 h-8" /></div>
        <h3 className="text-xl font-black text-slate-800 dark:text-white">تأكيد حذف الطالب</h3>
        <p className="text-slate-600 dark:text-slate-300">
          هل أنت متأكد من حذف الطالب <strong>«{student.full_name}»</strong>؟ سيتم حذف جميع بياناته وصورته نهائياً ولا يمكن التراجع عن ذلك.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={busy} className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">إلغاء</button>
          <button onClick={confirm} disabled={busy} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} نعم، احذف
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main section ─────────────────────────────────────────────────────────────

export const MahajaStudentsSection = () => {
  const [access, setAccess] = useState<AccessState>('checking');
  const [students, setStudents] = useState<MahajaStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [addressFilter, setAddressFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  const [formStudent, setFormStudent] = useState<MahajaStudent | null | undefined>(undefined); // undefined = closed, null = new
  const [viewing, setViewing] = useState<MahajaStudent | null>(null);
  const [deleting, setDeleting] = useState<MahajaStudent | null>(null);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof StudentsError && err.code === 'unauthorized') { setAccess('needs_verification'); return; }
    if (err instanceof StudentsError && err.code === 'forbidden') { setAccess('forbidden'); return; }
    if (err instanceof StudentsError && err.code === 'not_installed') { setAccess('not_installed'); setErrorMessage(err.message); return; }
    toast.error(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStudents(await listStudents());
      setAccess('granted');
    } catch (err) {
      handleError(err);
      const handled = err instanceof StudentsError && (err.code === 'unauthorized' || err.code === 'forbidden' || err.code === 'not_installed');
      if (!handled) {
        setErrorMessage(err instanceof Error ? err.message : '');
        setAccess(a => (a === 'checking' ? 'error' : a));
      }
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const verifyAndLoad = useCallback(async () => {
    setAccess('checking');
    try {
      if (await checkStudentsAccess()) await load();
      else setAccess('needs_verification');
    } catch (err) {
      if (err instanceof StudentsError && err.code === 'not_installed') { setAccess('not_installed'); setErrorMessage(err.message); }
      else { setAccess('error'); setErrorMessage(err instanceof Error ? err.message : ''); }
    }
  }, [load]);

  useEffect(() => { void verifyAndLoad(); }, [verifyAndLoad]);

  const addresses = useMemo(() => {
    const set = new Map<string, string>();
    students.forEach(s => { const k = s.address.trim().toLowerCase(); if (!set.has(k)) set.set(k, s.address.trim()); });
    return [...set.values()].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [students]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/[\s\-()+]/g, '');
    return students
      .filter(s => statusFilter === 'all' || (statusFilter === 'suspended' ? isSuspended(s) : !isSuspended(s)))
      .filter(s => addressFilter === 'all' || s.address.trim().toLowerCase() === addressFilter.toLowerCase())
      .filter(s => !q
        || s.full_name.toLowerCase().includes(q)
        || s.guardian_name.toLowerCase().includes(q)
        || (qDigits.length > 0 && /^\d+$/.test(qDigits) && s.guardian_phone.replace('+', '').includes(qDigits))
        || formatStudentCode(s).toLowerCase().includes(q))
      .sort((a, b) => {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return sortOrder === 'newest' ? -diff : diff;
      });
  }, [students, search, addressFilter, sortOrder, statusFilter]);

  const suspendedCount = useMemo(() => students.filter(isSuspended).length, [students]);

  const onStudentUpdated = (updated: MahajaStudent) => {
    setStudents(list => list.map(s => (s.id === updated.id ? updated : s)));
    setViewing(v => (v && v.id === updated.id ? updated : v));
  };

  const onSaved = (saved: MahajaStudent, isNew: boolean) => {
    setStudents(list => (isNew ? [saved, ...list] : list.map(s => (s.id === saved.id ? saved : s))));
    setViewing(v => (v && v.id === saved.id ? saved : v));
    setFormStudent(undefined);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteStudent(deleting);
      setStudents(list => list.filter(s => s.id !== deleting.id));
      if (viewing?.id === deleting.id) setViewing(null);
      toast.success('تم حذف الطالب وصورته بنجاح');
      setDeleting(null);
    } catch (err) {
      handleError(err);
      if (err instanceof StudentsError && err.code === 'not_found') {
        setStudents(list => list.filter(s => s.id !== deleting.id));
        setDeleting(null);
      }
    }
  };

  const totalAhzab = useMemo(() => students.reduce((sum, s) => sum + s.quran_ahzab, 0), [students]);

  if (access === 'checking') {
    return <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;
  }
  if (access === 'needs_verification') return <VerifyAdminPanel onVerified={() => void verifyAndLoad()} />;
  if (access === 'forbidden') {
    return (
      <div className="my-8 p-6 rounded-3xl border border-red-200 bg-red-50 dark:bg-red-900/10 text-center space-y-2">
        <ShieldCheck className="w-10 h-10 mx-auto text-red-500" />
        <p className="font-bold text-slate-800 dark:text-white">ليست لديك صلاحية الوصول إلى طلاب المحجة البيضاء.</p>
      </div>
    );
  }
  if (access === 'not_installed' || access === 'error') {
    return (
      <div className="my-8 p-6 rounded-3xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
        <p className="font-bold text-slate-800 dark:text-white">{errorMessage || 'تعذّر تحميل قسم الطلاب'}</p>
        <button onClick={() => void verifyAndLoad()} className="px-5 py-2.5 rounded-xl font-bold bg-white border border-amber-200 inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" /> إعادة المحاولة</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + stats */}
      <div className="rounded-3xl bg-gradient-to-l from-[#262150] to-[#3a3275] text-white p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -left-10 -top-10 w-40 h-40 rounded-full bg-pink-200/10" />
        <div className="flex items-center gap-4 relative">
          <img src="/mahaja-emblem.png" alt="" className="w-14 h-16 object-contain" />
          <div>
            <h3 className="text-xl sm:text-2xl font-black">طلاب المحجة البيضاء</h3>
            <p className="text-pink-100/80 text-sm font-medium">تسجيل الطلاب وإدارة ملفاتهم وبطاقاتهم</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative">
          <div className="px-4 py-2 rounded-2xl bg-white/10 text-center">
            <div className="text-2xl font-black">{students.length}</div>
            <div className="text-xs text-pink-100/80 font-bold">طالب مسجّل</div>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-white/10 text-center">
            <div className="text-2xl font-black">{addresses.length}</div>
            <div className="text-xs text-pink-100/80 font-bold">مكان سكن</div>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-white/10 text-center hidden sm:block">
            <div className="text-2xl font-black">{students.length ? (totalAhzab / students.length).toFixed(1) : 0}</div>
            <div className="text-xs text-pink-100/80 font-bold">متوسط الأحزاب</div>
          </div>
          <button onClick={() => setFormStudent(null)} className="px-5 py-3 rounded-2xl font-black bg-pink-200 text-[#262150] hover:bg-pink-100 flex items-center gap-2 shadow-lg">
            <Plus className="w-5 h-5" /> تسجيل طالب جديد
          </button>
          <button onClick={() => setAttendanceOpen(true)} disabled={students.length === 0}
            className="px-5 py-3 rounded-2xl font-black bg-white/15 text-white border border-white/30 hover:bg-white/25 flex items-center gap-2 disabled:opacity-50">
            <CalendarCheck className="w-5 h-5" /> الحضور
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto] gap-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم الطالب أو الولي أو رقم الهاتف أو المعرف…"
            className="w-full pr-11 pl-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-300" />
          {search && <button onClick={() => setSearch('')} aria-label="مسح البحث" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-4 h-4" /></button>}
        </div>
        <div className="relative">
          <MapPin className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select value={addressFilter} onChange={e => setAddressFilter(e.target.value)} aria-label="فلترة حسب مكان السكن"
            className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium">
            <option value="all">كل أماكن السكن</option>
            {addresses.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="relative">
          <Filter className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} aria-label="فلترة حسب حالة الطالب"
            className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium">
            <option value="all">كل الطلاب</option>
            <option value="active">النشطون فقط</option>
            <option value="suspended">الموقوفون ({suspendedCount})</option>
          </select>
        </div>
        <div className="relative">
          <ArrowDownUp className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)} aria-label="ترتيب حسب تاريخ التسجيل"
            className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium">
            <option value="newest">الأحدث تسجيلاً أولاً</option>
            <option value="oldest">الأقدم تسجيلاً أولاً</option>
          </select>
        </div>
        <button onClick={() => void load()} disabled={loading} className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold flex items-center justify-center gap-2 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
        </button>
      </div>

      {(search || addressFilter !== 'all' || statusFilter !== 'all') && (
        <p className="text-sm text-slate-500 font-medium">عرض {visible.length} من أصل {students.length} طالب</p>
      )}

      {/* List */}
      {loading && students.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-14 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="font-bold text-slate-500">{students.length === 0 ? 'لا يوجد طلاب مسجلون بعد' : 'لا توجد نتائج مطابقة للبحث'}</p>
          {students.length === 0 && (
            <button onClick={() => setFormStudent(null)} className="mt-4 px-5 py-2.5 rounded-xl font-bold text-white bg-[#262150] inline-flex items-center gap-2"><Plus className="w-4 h-4" /> تسجيل أول طالب</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map(s => (
            <motion.article key={s.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`rounded-3xl border bg-white dark:bg-slate-800 overflow-hidden flex flex-col ${isSuspended(s) ? 'border-red-200 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-700'}`}>
              <div className={`h-2 ${isSuspended(s) ? 'bg-red-300' : 'bg-gradient-to-l from-[#262150] via-pink-300 to-[#262150]'}`} />
              <div className="p-4 flex gap-4">
                <button onClick={() => setViewing(s)} className="w-20 h-24 shrink-0 rounded-2xl overflow-hidden border-2 border-pink-200 bg-indigo-50 dark:bg-slate-900 flex items-center justify-center" aria-label={`عرض ملف ${s.full_name}`}>
                  {s.photo_url ? <img src={s.photo_url} alt={s.full_name} loading="lazy" className={`w-full h-full object-cover ${isSuspended(s) ? 'grayscale' : ''}`} /> : <ImageOff className="w-6 h-6 text-slate-300" />}
                </button>
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-slate-800 dark:text-white leading-snug break-words">{s.full_name}</h4>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-pink-100 text-[#262150] text-xs font-bold" dir="ltr">{formatStudentCode(s)}</span>
                  {isSuspended(s) && <span className="inline-block mt-1 ms-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">موقوف</span>}
                  <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> سُجّل في {formatDate(s.created_at)}</p>
                </div>
              </div>
              <dl className="px-4 pb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div className="col-span-2 flex items-center gap-2 text-slate-600 dark:text-slate-300"><Users className="w-4 h-4 text-indigo-500 shrink-0" /><dt className="sr-only">الولي</dt><dd className="truncate">{s.guardian_name}</dd></div>
                <div className="col-span-2 flex items-center gap-2 text-slate-600 dark:text-slate-300"><Phone className="w-4 h-4 text-indigo-500 shrink-0" /><dt className="sr-only">هاتف الولي</dt><dd dir="ltr" className="truncate"><a href={`tel:${s.guardian_phone}`} className="hover:underline">{s.guardian_phone}</a></dd></div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Calendar className="w-4 h-4 text-indigo-500 shrink-0" /><dt className="sr-only">العمر</dt><dd>{formatAge(s.age)}</dd></div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Home className="w-4 h-4 text-indigo-500 shrink-0" /><dt className="sr-only">السكن</dt><dd className="truncate">{s.address}</dd></div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><BookOpen className="w-4 h-4 text-indigo-500 shrink-0" /><dt className="sr-only">الأحزاب</dt><dd>{formatAhzab(s.quran_ahzab)}</dd></div>
              </dl>
              <div className="mt-auto p-3 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-2">
                <button onClick={() => setViewing(s)} className="px-3 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-200 flex items-center justify-center gap-1.5"><Eye className="w-4 h-4" /> عرض</button>
                <button onClick={() => setFormStudent(s)} className="px-3 py-2 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center justify-center gap-1.5"><Edit2 className="w-4 h-4" /> تعديل</button>
                <DownloadMenu student={s} />
                <button onClick={() => setDeleting(s)} className="px-3 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center gap-1.5"><Trash2 className="w-4 h-4" /> حذف</button>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {formStudent !== undefined && (
        <StudentFormModal student={formStudent} onClose={() => setFormStudent(undefined)} onSaved={onSaved} />
      )}
      {viewing && formStudent === undefined && (
        <StudentProfileModal student={viewing} onClose={() => setViewing(null)} onEdit={() => setFormStudent(viewing)} onDelete={() => setDeleting(viewing)} onUpdated={onStudentUpdated} />
      )}
      {attendanceOpen && <AttendanceModal students={students} onClose={() => setAttendanceOpen(false)} />}
      {deleting && <ConfirmDelete student={deleting} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />}
    </div>
  );
};
