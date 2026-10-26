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
  program: string;
  created_at: string;
}

export interface GeneralElection {
  id: string;
  title: string;
  description: string | null;
  eligibility: 'approved' | 'registered';
  is_published: boolean;
  phase: GeneralPhase;
  server_now: string;
  /** True while voting is open: cards (photos, programmes) are hidden, only the voting form shows. */
  cards_hidden?: boolean;
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
};

const isMissingFunction = (e: { code?: string; message?: string }) =>
  e.code === 'PGRST202' || e.code === '42883' || (e.message ?? '').includes('Could not find the function');

const toError = (error: { code?: string; message?: string }) => {
  const m = error.message ?? '';
  const key = Object.keys(MESSAGES).find(k => m.includes(k));
  if (key) return new SiteError(MESSAGES[key], key);
  if (isMissingFunction(error)) return new SiteError('نظام الانتخابات العامة يحتاج تشغيل ملف قاعدة البيانات 20261024000000 في Supabase.', 'not_installed');
  if (m.toLowerCase().includes('failed to fetch')) return new SiteError('تعذّر الاتصال بالخادم، تحقق من الإنترنت.', 'network');
  return new SiteError(m ? `حدث خطأ: ${m}` : 'حدث خطأ غير متوقع.', error.code);
};

const rpc = async <T>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw toError(error);
  return data as T;
};
const adminRpc = <T>(fn: string, args: Record<string, unknown> = {}) => rpc<T>(fn, { ...args, p_token: getAdminToken() });

// ─── Members ──────────────────────────────────────────────────────────────────

export const fetchGeneralElections = async () => (await rpc<GeneralElection[] | null>('general_elections_public')) ?? [];

export const applyForPosition = (electionId: string, positionId: string, data: { full_name: string; photo_url: string; photo_path: string; program: string }) =>
  rpc<{ id: string; status: ApplicationStatus }>('election_apply', { p_election_id: electionId, p_position_id: positionId, p_data: data });

export const withdrawApplication = async (applicationId: string) => {
  const path = await rpc<string | null>('election_application_withdraw', { p_application_id: applicationId });
  if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
};

export const votePosition = (electionId: string, positionId: string, applicationId: string) =>
  rpc<{ success: boolean }>('election_vote_position', { p_election_id: electionId, p_position_id: positionId, p_application_id: applicationId });

// ─── Candidate photo ──────────────────────────────────────────────────────────

const PHOTO_BUCKET = 'election-photos';
const MAX_PHOTO = 5 * 1024 * 1024;

/** Phone photos are resized to a reasonable JPEG before upload. */
const compress = async (file: File): Promise<Blob> => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.86));
    if (blob) return blob;
  } catch { /* not decodable here: upload as is if allowed */ }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new SiteError('نوع الصورة غير مدعوم. اختر صورة JPG أو PNG.');
  return file;
};

export const uploadCandidatePhoto = async (file: File, userId: string) => {
  if (!file.type.startsWith('image/')) throw new SiteError('الملف المختار ليس صورة.');
  const blob = await compress(file);
  if (blob.size > MAX_PHOTO) throw new SiteError('حجم الصورة كبير جدًا (الحد 5 ميغابايت).');
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000' });
  if (error) throw new SiteError(error.message.includes('Bucket not found')
    ? 'مساحة صور المترشحين غير مهيأة. شغّل ملف قاعدة البيانات 20261024000000.'
    : `تعذّر رفع الصورة: ${error.message}`);
  return { url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl, path };
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
