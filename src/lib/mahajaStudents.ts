import { supabase } from './supabase';
import { getAdminToken, setAdminToken } from './adminSession';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MahajaStudent {
  id: string;
  student_number: number;
  full_name: string;
  guardian_name: string;
  guardian_phone: string;
  age: number;
  address: string;
  quran_ahzab: number;
  photo_url: string | null;
  photo_path: string | null;
  notes: string | null;
  /** Added by the 20261008 migration; treat a missing value as 'active'. */
  status?: StudentStatus;
  status_reason?: string | null;
  status_changed_at?: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type StudentStatus = 'active' | 'suspended';
export const isSuspended = (s: Pick<MahajaStudent, 'status'>) => s.status === 'suspended';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'left_early' | 'excused';

export const ATTENDANCE_STATUSES: { id: AttendanceStatus; label: string; short: string; tone: string; active: string }[] = [
  { id: 'present', label: 'حاضر', short: 'حاضر', tone: 'text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800', active: 'bg-emerald-600 text-white border-emerald-600' },
  { id: 'absent', label: 'غائب', short: 'غائب', tone: 'text-red-700 border-red-200 dark:text-red-300 dark:border-red-800', active: 'bg-red-600 text-white border-red-600' },
  { id: 'late', label: 'متأخر', short: 'متأخر', tone: 'text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800', active: 'bg-amber-500 text-white border-amber-500' },
  { id: 'left_early', label: 'خرج مبكرًا', short: 'خرج مبكرًا', tone: 'text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-800', active: 'bg-orange-500 text-white border-orange-500' },
  { id: 'excused', label: 'بعذر', short: 'بعذر', tone: 'text-sky-700 border-sky-200 dark:text-sky-300 dark:border-sky-800', active: 'bg-sky-600 text-white border-sky-600' },
];
export const attendanceLabel = (s: string) => ATTENDANCE_STATUSES.find(a => a.id === s)?.label ?? s;

export interface AttendanceRecord {
  id: string;
  student_id: string;
  attendance_date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  note: string | null;
  recorded_by: string;
  recorded_at: string;
}

export interface StudentNote {
  id: string;
  student_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface StudentLogEntry {
  id: number;
  student_id: string;
  action: string;
  details: Record<string, unknown>;
  actor: string;
  created_at: string;
}

export interface StudentDetails {
  notes: StudentNote[];
  attendance: AttendanceRecord[];
  log: StudentLogEntry[];
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  left_early: number;
  excused: number;
  /** % of recorded days (excluding excused absences) the student attended — present, late or left early. */
  rate: number | null;
}

export const computeAttendanceStats = (records: AttendanceRecord[]): AttendanceStats => {
  const count = (s: AttendanceStatus) => records.filter(r => r.status === s).length;
  const stats = { total: records.length, present: count('present'), absent: count('absent'), late: count('late'), left_early: count('left_early'), excused: count('excused') };
  const counted = stats.total - stats.excused;
  const attended = stats.present + stats.late + stats.left_early;
  return { ...stats, rate: counted > 0 ? Math.round((attended / counted) * 100) : null };
};

/** Local calendar date as YYYY-MM-DD. */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface MahajaStudentInput {
  full_name: string;
  guardian_name: string;
  guardian_phone: string;
  age: number;
  address: string;
  quran_ahzab: number;
  notes?: string;
  photo_url?: string | null;
  photo_path?: string | null;
}

export const PHOTO_BUCKET = 'mahaja-students';
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_AHZAB = 60;

/** Human-readable student ID printed on the card, e.g. MB-00042. */
export const formatStudentCode = (s: Pick<MahajaStudent, 'student_number'>) =>
  `MB-${String(s.student_number).padStart(5, '0')}`;

/** Arabic counted nouns: 1 حزب واحد، 2 حزبان، 3–10 أحزاب، 11+ حزباً. */
const arabicCount = (n: number, one: string, two: string, few: string, many: string) =>
  n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`;

export const formatAge = (n: number) => arabicCount(n, 'سنة واحدة', 'سنتان', 'سنوات', 'سنة');
export const formatAhzab = (n: number) => (n === 0 ? '0 حزب' : arabicCount(n, 'حزب واحد', 'حزبان', 'أحزاب', 'حزباً'));

export const normalizePhone = (phone: string) => phone.replace(/[\s\-()]/g, '');

// ─── Admin session token ──────────────────────────────────────────────────────
// Dashboard admins who log in via system_admins have no Supabase Auth session,
// so the student RPCs accept the dashboard session token (see adminSession.ts).
// The server also checks that the admin has the 'mahaja' section.

export const getStudentsToken = getAdminToken;

export const issueStudentsToken = async (username: string, password: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('mahaja_students_issue_token', { p_username: username.trim(), p_password: password });
  if (error || !data?.success) return false;
  setAdminToken(data.token);
  return true;
};

export const checkStudentsAccess = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc('mahaja_students_check_access', { p_token: getStudentsToken() });
  if (error) throw toArabicError(error);
  return data === true;
};

// ─── Errors ───────────────────────────────────────────────────────────────────

export class StudentsError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

const toArabicError = (error: { message?: string; code?: string; details?: string } | null): StudentsError => {
  const msg = error?.message || '';
  const code = error?.code;
  if (msg.includes('ADMIN_FORBIDDEN')) return new StudentsError('ليست لديك صلاحية الوصول إلى قسم المحجة البيضاء.', 'forbidden');
  if (msg.includes('MAHAJA_BAD_DATE')) return new StudentsError('تاريخ الحضور غير صالح.', 'invalid');
  if (msg.includes('MAHAJA_UNAUTHORIZED') || msg.includes('ADMIN_UNAUTHORIZED') || code === '42501') return new StudentsError('انتهت صلاحية الجلسة أو ليست لديك صلاحية الوصول. يرجى تأكيد هويتك كمشرف.', 'unauthorized');
  if (msg.includes('MAHAJA_NOT_FOUND')) return new StudentsError('لم يتم العثور على الطالب، ربما حُذف مسبقاً.', 'not_found');
  if (code === '23505') return new StudentsError('هذا الطالب مسجّل مسبقاً بنفس الاسم ورقم هاتف الولي.', 'duplicate');
  if (code === '23514') return new StudentsError('بعض البيانات غير صالحة، يرجى مراجعة الحقول.', 'invalid');
  if (code === 'PGRST202' || code === '42883' || msg.includes('Could not find the function')) {
    return new StudentsError('قاعدة البيانات غير مهيأة لنظام الطلاب بعد. يرجى تشغيل ملف الترحيل mahaja_students في Supabase.', 'not_installed');
  }
  if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')) return new StudentsError('تعذّر الاتصال بالخادم، تحقق من الإنترنت ثم أعد المحاولة.', 'network');
  return new StudentsError(msg ? `حدث خطأ: ${msg}` : 'حدث خطأ غير متوقع.', code);
};

// ─── Validation ───────────────────────────────────────────────────────────────

export type StudentFormErrors = Partial<Record<keyof MahajaStudentInput | 'photo', string>>;

export const validateStudent = (input: Partial<Record<keyof MahajaStudentInput, unknown>>): StudentFormErrors => {
  const errors: StudentFormErrors = {};
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const fullName = text(input.full_name);
  if (!fullName) errors.full_name = 'الاسم الكامل للطالب مطلوب';
  else if (fullName.length < 3 || fullName.length > 120) errors.full_name = 'الاسم يجب أن يكون بين 3 و120 حرفاً';

  const guardian = text(input.guardian_name);
  if (!guardian) errors.guardian_name = 'اسم الولي مطلوب';
  else if (guardian.length < 3 || guardian.length > 120) errors.guardian_name = 'اسم الولي يجب أن يكون بين 3 و120 حرفاً';

  const phone = normalizePhone(text(input.guardian_phone));
  if (!phone) errors.guardian_phone = 'رقم هاتف الولي مطلوب';
  else if (!/^\+?[0-9]{6,15}$/.test(phone)) errors.guardian_phone = 'رقم الهاتف غير صالح (أرقام فقط، من 6 إلى 15 رقماً)';

  const age = Number(input.age);
  if (input.age === '' || input.age === undefined || input.age === null) errors.age = 'العمر مطلوب';
  else if (!Number.isInteger(age) || age < 3 || age > 100) errors.age = 'العمر يجب أن يكون رقماً صحيحاً بين 3 و100';

  const address = text(input.address);
  if (!address) errors.address = 'مكان السكن مطلوب';
  else if (address.length < 2 || address.length > 160) errors.address = 'مكان السكن غير صالح';

  const ahzab = Number(input.quran_ahzab);
  if (input.quran_ahzab === '' || input.quran_ahzab === undefined || input.quran_ahzab === null) errors.quran_ahzab = 'عدد الأحزاب مطلوب';
  else if (!Number.isInteger(ahzab) || ahzab < 0 || ahzab > MAX_AHZAB) errors.quran_ahzab = `عدد الأحزاب يجب أن يكون بين 0 و${MAX_AHZAB}`;

  return errors;
};

export const validatePhoto = (file: File): string | null => {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return 'نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP';
  if (file.size > MAX_PHOTO_BYTES) return 'حجم الصورة كبير جداً (الحد الأقصى 5 ميغابايت)';
  return null;
};

// ─── Photos (Supabase Storage) ────────────────────────────────────────────────

/** Downscales large camera photos before upload so cards render fast. */
const compressPhoto = async (file: File): Promise<Blob> => {
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1000;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 800 * 1024) { bitmap.close(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    return blob ?? file;
  } catch {
    return file;
  }
};

export const uploadStudentPhoto = async (file: File): Promise<{ url: string; path: string }> => {
  const invalid = validatePhoto(file);
  if (invalid) throw new StudentsError(invalid, 'invalid_photo');
  const blob = await compressPhoto(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/png' ? 'png' : 'webp';
  const path = `students/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) {
    const m = error.message || '';
    if (m.includes('Bucket not found')) throw new StudentsError('مساحة تخزين صور الطلاب غير موجودة. يرجى تشغيل ملف الترحيل mahaja_students.', 'not_installed');
    throw new StudentsError(`تعذّر رفع الصورة: ${m}`, 'upload');
  }
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
};

export const removeStudentPhoto = async (path: string | null | undefined) => {
  if (!path) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) console.warn('Unable to remove student photo', path, error.message);
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const toPayload = (input: Partial<MahajaStudentInput>) => {
  const payload: Record<string, unknown> = {};
  if (input.full_name !== undefined) payload.full_name = input.full_name.trim();
  if (input.guardian_name !== undefined) payload.guardian_name = input.guardian_name.trim();
  if (input.guardian_phone !== undefined) payload.guardian_phone = normalizePhone(input.guardian_phone.trim());
  if (input.age !== undefined) payload.age = Number(input.age);
  if (input.address !== undefined) payload.address = input.address.trim();
  if (input.quran_ahzab !== undefined) payload.quran_ahzab = Number(input.quran_ahzab);
  if (input.notes !== undefined) payload.notes = input.notes.trim();
  if (input.photo_url !== undefined) payload.photo_url = input.photo_url ?? '';
  if (input.photo_path !== undefined) payload.photo_path = input.photo_path ?? '';
  return payload;
};

export const listStudents = async (): Promise<MahajaStudent[]> => {
  const { data, error } = await supabase.rpc('mahaja_students_list', { p_token: getStudentsToken() });
  if (error) throw toArabicError(error);
  return (data ?? []) as MahajaStudent[];
};

export const getStudent = async (id: string): Promise<MahajaStudent> => {
  const { data, error } = await supabase.rpc('mahaja_students_get', { p_id: id, p_token: getStudentsToken() });
  if (error) throw toArabicError(error);
  return data as MahajaStudent;
};

/** Uploads the photo (if any), then inserts the student. Rolls the photo back on failure. */
export const createStudent = async (input: MahajaStudentInput, photo: File | null): Promise<MahajaStudent> => {
  const uploaded = photo ? await uploadStudentPhoto(photo) : null;
  const { data, error } = await supabase.rpc('mahaja_students_create', {
    p_data: toPayload({ ...input, photo_url: uploaded?.url ?? null, photo_path: uploaded?.path ?? null }),
    p_token: getStudentsToken(),
  });
  if (error) {
    await removeStudentPhoto(uploaded?.path);
    throw toArabicError(error);
  }
  return data as MahajaStudent;
};

/**
 * Updates a student. `photo`: a File replaces the photo, `null` removes it,
 * `undefined` keeps it. The previous photo is deleted only after the row is saved.
 */
export const updateStudent = async (current: MahajaStudent, input: MahajaStudentInput, photo: File | null | undefined): Promise<MahajaStudent> => {
  let uploaded: { url: string; path: string } | null = null;
  const changes: Partial<MahajaStudentInput> = { ...input };
  if (photo instanceof File) {
    uploaded = await uploadStudentPhoto(photo);
    changes.photo_url = uploaded.url;
    changes.photo_path = uploaded.path;
  } else if (photo === null) {
    changes.photo_url = null;
    changes.photo_path = null;
  }
  const { data, error } = await supabase.rpc('mahaja_students_update', { p_id: current.id, p_data: toPayload(changes), p_token: getStudentsToken() });
  if (error) {
    await removeStudentPhoto(uploaded?.path);
    throw toArabicError(error);
  }
  if (photo !== undefined && current.photo_path && current.photo_path !== uploaded?.path) await removeStudentPhoto(current.photo_path);
  return data as MahajaStudent;
};

export const deleteStudent = async (student: MahajaStudent): Promise<void> => {
  const { data, error } = await supabase.rpc('mahaja_students_delete', { p_id: student.id, p_token: getStudentsToken() });
  if (error) throw toArabicError(error);
  await removeStudentPhoto((data as MahajaStudent | null)?.photo_path ?? student.photo_path);
};

// ─── Status, notes, history, attendance ───────────────────────────────────────

const featureError = (error: { message?: string; code?: string }) => {
  const e = toArabicError(error);
  if (e.code === 'not_installed') {
    return new StudentsError('ميزات الحضور والملاحظات تحتاج تشغيل ملف الترحيل 20261008000000 في Supabase.', 'not_installed');
  }
  return e;
};

export const setStudentStatus = async (id: string, status: StudentStatus, reason?: string): Promise<MahajaStudent> => {
  const { data, error } = await supabase.rpc('mahaja_students_set_status', { p_id: id, p_status: status, p_reason: reason ?? null, p_token: getStudentsToken() });
  if (error) throw featureError(error);
  return data as MahajaStudent;
};

export const addStudentNote = async (id: string, note: string): Promise<StudentNote> => {
  const text = note.trim();
  if (!text) throw new StudentsError('اكتب الملاحظة أولاً', 'invalid');
  if (text.length > 1000) throw new StudentsError('الملاحظة طويلة جداً (الحد 1000 حرف)', 'invalid');
  const { data, error } = await supabase.rpc('mahaja_student_add_note', { p_id: id, p_note: text, p_token: getStudentsToken() });
  if (error) throw featureError(error);
  return data as StudentNote;
};

export const getStudentDetails = async (id: string): Promise<StudentDetails> => {
  const { data, error } = await supabase.rpc('mahaja_student_details', { p_id: id, p_token: getStudentsToken() });
  if (error) throw featureError(error);
  return data as StudentDetails;
};

export const getAttendanceForDay = async (date: string): Promise<AttendanceRecord[]> => {
  const { data, error } = await supabase.rpc('mahaja_attendance_day', { p_date: date, p_token: getStudentsToken() });
  if (error) throw featureError(error);
  return (data ?? []) as AttendanceRecord[];
};

export interface AttendanceChange {
  student_id: string;
  /** null removes the student's record for that day. */
  status: AttendanceStatus | null;
  note: string;
}

export const saveAttendance = async (date: string, changes: AttendanceChange[]): Promise<AttendanceRecord[]> => {
  if (changes.some(c => c.note.trim().length > 300)) throw new StudentsError('الملاحظة يجب ألا تتجاوز 300 حرف', 'invalid');
  const { data, error } = await supabase.rpc('mahaja_attendance_save', { p_date: date, p_records: changes, p_token: getStudentsToken() });
  if (error) throw featureError(error);
  return (data ?? []) as AttendanceRecord[];
};
