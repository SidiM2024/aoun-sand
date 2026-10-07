import { supabase } from './supabase';

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
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

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

// ─── Legacy-admin session token ───────────────────────────────────────────────
// Dashboard admins who log in via system_admins have no Supabase Auth session,
// so the student RPCs accept a short-lived token issued against their password.

const TOKEN_KEY = 'mahaja_students_token';

export const getStudentsToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

const setStudentsToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
};

export const issueStudentsToken = async (username: string, password: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('mahaja_students_issue_token', { p_username: username.trim(), p_password: password });
  if (error || !data?.success) return false;
  setStudentsToken(data.token);
  return true;
};

export const clearStudentsToken = async () => {
  const token = getStudentsToken();
  setStudentsToken(null);
  if (token) await supabase.rpc('mahaja_students_revoke_token', { p_token: token }).then(() => undefined, () => undefined);
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
  if (msg.includes('MAHAJA_UNAUTHORIZED') || code === '42501') return new StudentsError('انتهت صلاحية الجلسة أو ليست لديك صلاحية الوصول. يرجى تأكيد هويتك كمشرف.', 'unauthorized');
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
