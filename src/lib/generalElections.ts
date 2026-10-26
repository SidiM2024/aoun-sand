import { supabase } from './supabase';
import { getAdminToken } from './adminSession';
import { SiteError } from './siteApi';

// General elections of the association: candidacy → review → candidates → voting → results.
// Every rule (phase windows, eligibility, one vote per position, secrecy) is enforced by the
// RPCs in supabase/migrations/20261024000000_general_elections.sql; this module only calls them.

export type GeneralPhase =
  | 'setup' | 'nominations_upcoming' | 'nominations' | 'nominations_closed'
  | 'voting_scheduled' | 'voting' | 'voting_closed' | 'results';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface GeneralCandidate {
  id: string;
  full_name: string;
  /** Null while voting is open: members then only see the names. */
  photo_url: string | null;
  program: string | null;
  votes: number | null;
}

export interface GeneralPosition {
  id: string;
  title: string;
  group_key: 'executive' | 'committee' | 'other';
  committee: string | null;
  role: string;
  sort_order: number;
  is_active: boolean;
  candidates_count: number | null;
  pending_count?: number | null;
  voters_count: number | null;
  top_votes: number | null;
  tie: boolean | null;
  winner_application_id: string | null;
  tie_resolved: boolean | null;
  candidates: GeneralCandidate[];
}

export interface MyApplication {
  id: string;
  position_id: string;
  position_title: string;
  status: ApplicationStatus;
  review_note: string | null;
  full_name: string;
  photo_url: string;
  photo_path: string | null;
  /** Uncropped original (falls back to the photo itself for older applications). */
  photo_original_url?: string | null;
  photo_original_path?: string | null;
  photo_crop?: PhotoCrop | null;
  photo_updated_at?: string | null;
  program: string;
  created_at: string;
}

/** Position of the circular crop: centre (fraction of the original) and zoom (1 = fit). */
export interface PhotoCrop { x: number; y: number; zoom: number }

export interface GeneralElection {
  id: string;
  title: string;
  description: string | null;
  eligibility: 'approved' | 'registered';
  is_published: boolean;
  phase: GeneralPhase;
  server_now: string;
  /** True while voting is open: programmes are hidden, the ballot shows photos and names. */
  cards_hidden?: boolean;
  /** Vote counts shown live once voting starts (dashboard setting). */
  live_results?: boolean;
  /** Whether vote counts are included (live voting, or results announced). */
  results_visible?: boolean;
  /** Number of votes cast in the election (once voting has started). */
  total_votes?: number | null;
  nominations_start_at: string | null;
  nominations_end_at: string | null;
  voting_start_at: string | null;
  voting_end_at: string | null;
  results_announced_at: string | null;
  voters_total: number | null;
  eligible_count: number;
  positions: GeneralPosition[];
  my: null | {
    can_apply: boolean;
    can_vote: boolean;
    voted_position_ids: string[];
    applications: MyApplication[];
  };
  created_at: string;
  updated_at: string;
}

export interface AdminApplication {
  id: string;
  position_id: string;
  position_title: string;
  user_id: string;
  account_name: string | null;
  account_email: string | null;
  account_phone: string | null;
  full_name: string;
  photo_url: string;
  photo_original_url?: string | null;
  photo_crop?: PhotoCrop | null;
  photo_updated_at?: string | null;
  program: string;
  status: ApplicationStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AdminLogEntry { id: number; actor: string; action: string; details: Record<string, unknown>; created_at: string }

export interface AdminGeneralElection extends GeneralElection {
  applications: AdminApplication[];
  log: AdminLogEntry[];
}

export interface GeneralElectionSummary {
  id: string; title: string; phase: GeneralPhase; is_published: boolean; pending: number; approved: number; created_at: string;
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const PHASE_INFO: Record<GeneralPhase, { label: string; step: number }> = {
  setup: { label: 'قيد الإعداد', step: 0 },
  nominations_upcoming: { label: 'الترشح قريبًا', step: 0 },
  nominations: { label: 'الترشح مفتوح', step: 1 },
  nominations_closed: { label: 'انتهى الترشح', step: 2 },
  voting_scheduled: { label: 'في انتظار التصويت', step: 3 },
  voting: { label: 'التصويت مفتوح', step: 4 },
  voting_closed: { label: 'انتهى التصويت', step: 5 },
  results: { label: 'النتائج معلنة', step: 5 },
};

export const STEPS = ['الترشح', 'المترشحون', 'موعد التصويت', 'التصويت', 'النتائج'];

export const STATUS_INFO: Record<ApplicationStatus, { label: string; cls: string }> = {
  pending: { label: 'قيد المراجعة', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'مقبول', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'مرفوض', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

export const votingStarted = (p: GeneralPhase) => p === 'voting' || p === 'voting_closed' || p === 'results';
export const candidatesVisible = (p: GeneralPhase) => PHASE_INFO[p].step >= 2;

/** «مترشح واحد / مترشحان / 3 مترشحين / 11 مترشحًا». */
export const candidatesLabel = (n: number) => {
  if (n === 0) return 'لا يوجد مترشحون';
  if (n === 1) return 'مترشح واحد';
  if (n === 2) return 'مترشحان';
  if (n <= 10) return `${n} مترشحين`;
  return `${n} مترشحًا`;
};

export const groupPositions = (positions: GeneralPosition[]) => [
  { key: 'executive', title: 'المكتب التنفيذي', items: positions.filter(p => p.group_key === 'executive') },
  { key: 'committee', title: 'اللجان', items: positions.filter(p => p.group_key === 'committee') },
  { key: 'other', title: 'مناصب أخرى', items: positions.filter(p => p.group_key === 'other') },
].filter(g => g.items.length > 0);

// ─── Mauritania time (UTC+0) ──────────────────────────────────────────────────
// All dates are entered and shown in Mauritania time whatever the device's time zone.

const TZ = 'Africa/Nouakchott';
export const formatMrDate = (iso: string) => new Date(iso).toLocaleDateString('ar-MA', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const formatMrTime = (iso: string) => new Date(iso).toLocaleTimeString('ar-MA', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
export const formatMrDateTime = (iso: string) => `${formatMrDate(iso)} — ${formatMrTime(iso)}`;
/** ISO → value for <input type="datetime-local"> in Mauritania time. */
export const toMrInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
/** <input type="datetime-local"> value (Mauritania time) → ISO. */
export const fromMrInput = (value: string) => (value ? new Date(`${value}:00Z`).toISOString() : null);

// ─── Errors & RPC ─────────────────────────────────────────────────────────────

const MESSAGES: Record<string, string> = {
  ADMIN_FORBIDDEN: 'ليست لديك صلاحية قسم الانتخابات.',
  ADMIN_UNAUTHORIZED: 'انتهت الجلسة، يرجى تسجيل الدخول من جديد.',
  APPLY_LOGIN_REQUIRED: 'سجّل الدخول بحسابك لتقديم طلب الترشح.',
  APPLY_CLOSED: 'باب الترشح مغلق حاليًا.',
  APPLY_NOT_ELIGIBLE: 'حسابك غير مؤهل للترشح.',
  APPLY_BAD_POSITION: 'المنصب المختار غير متاح.',
  APPLY_PHOTO_REQUIRED: 'الصورة الشخصية مطلوبة.',
  APPLY_BAD_NAME: 'الاسم الكامل مطلوب (3 أحرف على الأقل).',
  APPLY_BAD_PROGRAM: 'البرنامج الانتخابي مطلوب (20 حرفًا على الأقل).',
  APPLY_DUPLICATE: 'لقد قدّمت طلب ترشح لهذا المنصب مسبقًا.',
  APPLICATION_NOT_FOUND: 'طلب الترشح غير موجود.',
  ELECTION_NOT_FOUND: 'الانتخابات غير موجودة.',
  VOTE_LOGIN_REQUIRED: 'سجّل الدخول بحسابك للتصويت.',
  VOTE_NOT_FOUND: 'الانتخابات غير موجودة.',
  VOTE_NOT_STARTED: 'لم يبدأ التصويت بعد.',
  VOTE_CLOSED: 'انتهت عملية التصويت.',
  VOTE_NOT_ELIGIBLE: 'حسابك غير مؤهل للتصويت في هذه الانتخابات.',
  VOTE_BAD_CHOICES: 'المترشح المختار غير صالح لهذا المنصب.',
  VOTE_ALREADY_CAST: 'لقد صوّتّ مسبقًا لهذا المنصب، ولا يمكن تغيير الصوت.',
  SCHEDULE_NOMINATIONS_END_REQUIRED: 'حدّد موعد نهاية الترشح.',
  SCHEDULE_BAD_NOMINATIONS: 'موعد نهاية الترشح يجب أن يكون بعد بدايته.',
  SCHEDULE_VOTING_BOTH_REQUIRED: 'حدّد بداية التصويت ونهايته معًا.',
  SCHEDULE_BAD_VOTING: 'موعد نهاية التصويت يجب أن يكون بعد بدايته وفي المستقبل.',
  SCHEDULE_VOTING_BEFORE_NOMINATIONS_END: 'لا يمكن أن يبدأ التصويت قبل نهاية الترشح.',
  SCHEDULE_LOCKED: 'بدأ التصويت: لا يمكن تعديل المواعيد إلا تمديد نهاية التصويت أثناءه.',
  ACTION_WRONG_PHASE: 'هذا الإجراء غير متاح في المرحلة الحالية.',
  POSITIONS_LOCKED: 'لا يمكن تعديل المناصب بعد بدء التصويت.',
  POSITION_DUPLICATE: 'يوجد منصب بنفس الاسم.',
  POSITION_HAS_APPLICATIONS: 'لا يمكن حذف منصب عليه طلبات ترشح، يمكنك تعطيله.',
  REVIEW_LOCKED: 'لا يمكن تغيير حالة الطلبات بعد بدء التصويت.',
  VOTING_NO_CANDIDATES: 'لا يمكن فتح التصويت: لا يوجد أي مترشح مقبول بعد.',
  TIE_NOT_FOUND: 'لا يوجد تعادل في صدارة هذا المنصب.',
  ELECTION_IS_OPEN: 'لا يمكن حذف الانتخابات أثناء التصويت.',
  NOT_FOUND: 'العنصر غير موجود، ربما حُذف.',
  PHOTO_INVALID: 'تعذّر حفظ الصورة: الملف غير صالح أو لم يكتمل رفعه. أعد المحاولة.',
  PHOTO_FORBIDDEN: 'لا يمكنك تعديل صورة مترشح آخر.',
  PHOTO_LOCKED: 'لا يمكن تعديل الصورة بعد بدء التصويت أو بعد رفض الطلب.',
  PHOTO_TICKET_INVALID: 'انتهت صلاحية عملية رفع الصورة. أعد المحاولة.',
};

const isMissingFunction = (e: { code?: string; message?: string }) =>
  e.code === 'PGRST202' || e.code === '42883' || (e.message ?? '').includes('Could not find the function');

const toError = (error: { code?: string; message?: string }) => {
  const m = error.message ?? '';
  const key = Object.keys(MESSAGES).find(k => m.includes(k));
  if (key) return new SiteError(MESSAGES[key], key);
  if (isMissingFunction(error)) return new SiteError('نظام الانتخابات العامة يحتاج تشغيل ملف قاعدة البيانات 20261024000000 في Supabase.', 'not_installed');
  if (m.toLowerCase().includes('failed to fetch')) return new SiteError('تعذّر الاتصال بالخادم، تحقق من الإنترنت.', 'network');
  if (/jwt expired|invalid jwt|jwt/i.test(m) || error.code === 'PGRST301' || error.code === 'PGRST303')
    return new SiteError('انتهت جلسة الدخول. أعد تسجيل الدخول ثم حاول مرة أخرى.', 'session');
  return new SiteError(m ? `حدث خطأ: ${m}` : 'حدث خطأ غير متوقع.', error.code);
};

const rpc = async <T>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
  let { data, error } = await supabase.rpc(fn, args);
  // Expired access token (phone left idle): refresh the session once and retry.
  if (error && (/jwt/i.test(error.message ?? '') || error.code === 'PGRST301' || error.code === 'PGRST303')) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) ({ data, error } = await supabase.rpc(fn, args));
  }
  if (error) throw toError(error);
  return data as T;
};
const adminRpc = <T>(fn: string, args: Record<string, unknown> = {}) => rpc<T>(fn, { ...args, p_token: getAdminToken() });

// ─── Members ──────────────────────────────────────────────────────────────────

export const fetchGeneralElections = async () => (await rpc<GeneralElection[] | null>('general_elections_public')) ?? [];

export const applyForPosition = (electionId: string, positionId: string, data: { full_name: string; program: string } & UploadedPhoto) =>
  rpc<{ id: string; status: ApplicationStatus }>('election_apply', { p_election_id: electionId, p_position_id: positionId, p_data: data });

export const withdrawApplication = async (applicationId: string, originalPath?: string | null) => {
  const path = await rpc<string | null>('election_application_withdraw', { p_application_id: applicationId });
  const paths = [...new Set([path, originalPath].filter((x): x is string => !!x))];
  if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
};

export const votePosition = (electionId: string, positionId: string, applicationId: string) =>
  rpc<{ success: boolean }>('election_vote_position', { p_election_id: electionId, p_position_id: positionId, p_application_id: applicationId });

// ─── Candidate photo ──────────────────────────────────────────────────────────

const PHOTO_BUCKET = 'election-photos';
const MAX_PHOTO = 5 * 1024 * 1024;

/** Originals kept for later re-cropping: at most 2000 px. */
const MAX_SIDE = 2000;
/** Largest file accepted from the device before conversion. */
const MAX_INPUT = 25 * 1024 * 1024;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;

const decodeWithImg = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('DECODE')); };
  img.src = url;
});

/**
 * Every photo is turned into a JPEG of at most 2000 px (the original kept for the editor):
 * phone photos (HEIC on iPhone, very large camera files) then always match the bucket's size
 * and type limits. createImageBitmap first; the <img> element as a fallback (older Safari, HEIC).
 */
export const prepareCandidatePhoto = async (file: File): Promise<Blob> => {
  if (!file.type.startsWith('image/') && !IMAGE_EXT.test(file.name)) throw new SiteError('الملف المختار ليس صورة. اختر صورة JPG أو PNG.');
  if (file.size > MAX_INPUT) throw new SiteError('حجم الصورة كبير جدًا (الحد 25 ميغابايت).');
  let source: ImageBitmap | HTMLImageElement | null = null;
  try { source = await createImageBitmap(file); } catch { /* fallback below */ }
  if (!source) {
    try { source = await decodeWithImg(file); } catch { source = null; }
  }
  if (source) {
    const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
    const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
    if (w > 0 && h > 0) {
      const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff'; // transparent PNGs: white background in the JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        if ('close' in source) source.close();
        for (const q of [0.86, 0.75, 0.6]) {
          const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', q));
          if (blob && blob.size <= MAX_PHOTO) return blob;
        }
      }
    }
  }
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= MAX_PHOTO) return file;
  throw new SiteError('تعذّرت قراءة هذه الصورة. اختر صورة أخرى بصيغة JPG أو PNG (يمكنك أخذ لقطة شاشة لها ثم اختيارها).');
};

const uploadMessage = (message: string) => {
  const m = message.toLowerCase();
  if (m.includes('bucket not found')) return 'مساحة صور المترشحين غير مهيأة بعد. أبلغ إدارة الجمعية (ملف قاعدة البيانات 20261029000000).';
  if (m.includes('row-level security') || m.includes('unauthorized') || m.includes('jwt') || m.includes('403'))
    return 'انتهت جلسة الدخول. أعد تسجيل الدخول ثم حاول مرة أخرى.';
  if (m.includes('mime') || m.includes('invalid_mime_type')) return 'نوع الصورة غير مدعوم. اختر صورة JPG أو PNG.';
  if (m.includes('size') || m.includes('too large') || m.includes('413')) return 'حجم الصورة كبير جدًا. اختر صورة أصغر.';
  if (m.includes('fetch') || m.includes('network') || m.includes('timeout')) return 'تعذّر الاتصال بالخادم أثناء رفع الصورة. تحقق من الإنترنت ثم أعد المحاولة.';
  return `تعذّر رفع الصورة: ${message}`;
};

const uploadPhotoBlob = async (path: string, blob: Blob) => {
  const send = () => supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  let { error } = await send();
  // An expired access token is the usual cause of an RLS refusal: refresh the session once.
  if (error && /row-level security|jwt|unauthorized|exp/i.test(error.message)) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) ({ error } = await send());
  } else if (error && /fetch|network|timeout/i.test(error.message)) {
    ({ error } = await send());
  }
  if (error) throw new SiteError(uploadMessage(error.message));
  return { url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl, path };
};

/** Result of the photo editor: cropped 800×800 JPEG, optional new original, crop position. */
export interface EditedPhoto { crop: Blob; original: Blob | null; params: PhotoCrop }

export interface UploadedPhoto {
  photo_url: string; photo_path: string;
  original_url?: string; original_path?: string;
  crop: PhotoCrop;
}

/** Uploads the edited photo (new file names every time: no stale cache) into `folder`. */
const uploadEditedPhoto = async (folder: string, photo: EditedPhoto): Promise<UploadedPhoto> => {
  const id = crypto.randomUUID();
  const crop = await uploadPhotoBlob(`${folder}/${id}-crop.jpg`, photo.crop);
  try {
    const original = photo.original ? await uploadPhotoBlob(`${folder}/${id}-orig.jpg`, photo.original) : null;
    return { photo_url: crop.url, photo_path: crop.path, ...(original ? { original_url: original.url, original_path: original.path } : {}), crop: photo.params };
  } catch (err) {
    void supabase.storage.from(PHOTO_BUCKET).remove([crop.path]);
    throw err;
  }
};

/** New candidacy: uploads the photo into the member's folder. */
export const uploadCandidatePhoto = (photo: EditedPhoto, userId: string) => uploadEditedPhoto(userId, photo);

/** Removes files the member uploaded (own folder only; other paths are refused by Storage). */
export const removeUploadedPhoto = (u: UploadedPhoto) =>
  supabase.storage.from(PHOTO_BUCKET).remove([u.photo_path, ...(u.original_path ? [u.original_path] : [])]);

/** Member: new photo / new position for one of their applications (before voting starts). */
export const saveMyCandidatePhoto = async (applicationId: string, userId: string, photo: EditedPhoto) => {
  const up = await uploadEditedPhoto(userId, photo);
  try {
    const r = await rpc<{ previous_path: string | null }>('election_application_set_photo', { p_application_id: applicationId, p_data: up });
    // The previous cropped copy is no longer used.
    if (r?.previous_path && r.previous_path.startsWith(`${userId}/`) && r.previous_path.endsWith('-crop.jpg')) {
      void supabase.storage.from(PHOTO_BUCKET).remove([r.previous_path]);
    }
  } catch (err) {
    void removeUploadedPhoto(up);
    throw err;
  }
};

/** Dashboard: any candidate's photo, through a one-time upload ticket checked by the server. */
export const adminSaveCandidatePhoto = async (applicationId: string, photo: EditedPhoto) => {
  const ticket = await adminRpc<string>('general_photo_ticket', { p_application_id: applicationId });
  const up = await uploadEditedPhoto(`tickets/${ticket}`, photo);
  await adminRpc<unknown>('general_application_set_photo', { p_ticket: ticket, p_data: up });
};

export const removeCandidatePhoto = async (path: string) => { await supabase.storage.from(PHOTO_BUCKET).remove([path]); };

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const adminListGeneral = async () => (await adminRpc<GeneralElectionSummary[] | null>('general_elections_admin_list')) ?? [];
export const adminGetGeneral = (id: string) => adminRpc<AdminGeneralElection>('general_election_admin_get', { p_id: id });
export const adminCreateGeneral = (data: { title: string; description?: string; eligibility: 'approved' | 'registered' }) =>
  adminRpc<{ id: string }>('general_election_create', { p_data: data });
export const adminSaveGeneral = (id: string, data: Record<string, unknown>) => adminRpc<AdminGeneralElection>('general_election_save', { p_id: id, p_data: data });
export type GeneralAction = 'open_voting' | 'close_nominations' | 'close_voting' | 'announce' | 'unannounce' | 'publish' | 'unpublish';
export const adminGeneralAction = (id: string, action: GeneralAction) => adminRpc<AdminGeneralElection>('general_election_action', { p_id: id, p_action: action });
export const adminSavePosition = (electionId: string, id: string | null, data: Record<string, unknown>) =>
  adminRpc<unknown>('general_position_save', { p_election_id: electionId, p_id: id, p_data: data });
export const adminDeletePosition = (id: string) => adminRpc<void>('general_position_delete', { p_id: id });
export const adminReviewApplication = (id: string, status: ApplicationStatus, note?: string) =>
  adminRpc<unknown>('general_application_review', { p_id: id, p_status: status, p_note: note ?? null });
export const adminResolveTie = (positionId: string, applicationId: string | null) =>
  adminRpc<void>('general_position_resolve_tie', { p_position_id: positionId, p_application_id: applicationId });
export const adminDeleteGeneral = async (id: string) => {
  const paths = await adminRpc<string[] | null>('general_election_delete', { p_id: id });
  // Photos belong to members' folders; the dashboard has no storage rights there, so they stay (harmless).
  return paths ?? [];
};

export const LOG_LABELS: Record<string, string> = {
  created: 'إنشاء الانتخابات', schedule_saved: 'حفظ المواعيد', close_nominations: 'إغلاق باب الترشح', open_voting: 'فتح التصويت',
  close_voting: 'إغلاق التصويت', announce: 'إعلان النتائج', unannounce: 'سحب إعلان النتائج',
  publish: 'إظهار الانتخابات للأعضاء', unpublish: 'إخفاء الانتخابات عن الأعضاء',
  position_added: 'إضافة منصب', position_updated: 'تعديل منصب', position_deleted: 'حذف منصب',
  application_approved: 'قبول طلب ترشح', application_rejected: 'رفض طلب ترشح', application_pending: 'إرجاع طلب إلى المراجعة',
  tie_resolved: 'حسم تعادل', tie_cleared: 'إلغاء حسم تعادل', deleted: 'حذف الانتخابات',
};

// ─── Candidate cards (shareable) ──────────────────────────────────────────────

/** «يترشح لمسؤولية اللجنة المالية» / «يترشح لمنصب الرئيس». */
export const candidacyLabel = (positionTitle: string) =>
  positionTitle.startsWith('مسؤول ') ? { lead: 'يترشح لمسؤولية', target: positionTitle.slice('مسؤول '.length) } : { lead: 'يترشح لمنصب', target: positionTitle };

export interface CandidateCardData {
  id: string;
  full_name: string;
  photo_url: string | null;
  program: string | null;
  position_title: string;
  committee: string | null;
  group_key: string;
  election_id: string;
  election_title: string;
  phase: GeneralPhase;
  cards_hidden: boolean;
}

/** One approved candidate's card; readable without an account (for shared links). */
export const fetchCandidateCard = (id: string) => rpc<CandidateCardData | null>('election_candidate_card', { p_id: id });

export const candidateShareUrl = (id: string) => `${window.location.origin}/candidate/${id}`;

export const candidateShareLinks = (name: string, positionTitle: string, id: string) => {
  const url = candidateShareUrl(id);
  const { lead, target } = candidacyLabel(positionTitle);
  const text = `${name} — ${lead} ${target} في انتخابات جمعية عون وسند الخيرية. اطّلع على البرنامج الانتخابي:`;
  return {
    url, text,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    snapchat: `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(url)}`,
  };
};
