import { supabase } from './supabase';
import { getAdminToken } from './adminSession';

// Data access for the public website (homepage stats, projects, homepage content,
// elections) and the matching admin functions. Everything goes through the RPCs in
// supabase/migrations/20261020000000_site_v2_elections_projects_auth.sql.

const isMissingFunction = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || (error.message ?? '').includes('Could not find the function'));

export class SiteError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

const MESSAGES: Record<string, string> = {
  ADMIN_FORBIDDEN: 'ليست لديك صلاحية لهذا القسم.',
  ADMIN_UNAUTHORIZED: 'انتهت الجلسة، يرجى تسجيل الدخول من جديد.',
  VOTE_LOGIN_REQUIRED: 'يجب تسجيل الدخول بحساب عضو للتصويت.',
  VOTE_NOT_FOUND: 'هذا الاقتراع غير موجود.',
  VOTE_CLOSED: 'التصويت غير مفتوح حالياً لهذا الاقتراع.',
  VOTE_NOT_ELIGIBLE: 'حسابك غير مؤهل للتصويت في هذا الاقتراع (يشترط عضو معتمد).',
  VOTE_BAD_CHOICES: 'اختيارك غير صالح، راجع عدد المرشحين المسموح به.',
  VOTE_ALREADY_CAST: 'لقد صوّتّ مسبقاً في هذا الاقتراع.',
  ELECTION_NO_CANDIDATES: 'أضف مرشحاً واحداً على الأقل قبل فتح التصويت.',
  ELECTION_HAS_VOTES: 'لا يمكن تنفيذ هذا التعديل بعد بدء التصويت.',
  ELECTION_IS_OPEN: 'أغلق التصويت أولاً قبل حذف الاقتراع.',
  NOT_FOUND: 'العنصر غير موجود، ربما حُذف.',
};

const toError = (error: { code?: string; message?: string }) => {
  const m = error.message ?? '';
  const key = Object.keys(MESSAGES).find(k => m.includes(k));
  if (key) return new SiteError(MESSAGES[key], key);
  if (isMissingFunction(error)) return new SiteError('هذه الميزة تحتاج تشغيل ملف قاعدة البيانات 20261020000000 في Supabase.', 'not_installed');
  if (m.toLowerCase().includes('failed to fetch')) return new SiteError('تعذّر الاتصال بالخادم، تحقق من الإنترنت.', 'network');
  return new SiteError(m ? `حدث خطأ: ${m}` : 'حدث خطأ غير متوقع.', error.code);
};

const rpc = async <T>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw toError(error);
  return data as T;
};

// ─── Homepage statistics ──────────────────────────────────────────────────────

export interface HomeStats {
  members: number;
  approved_members: number;
  mahaja_students: number;
  donations_total: number;
  expenses_total: number;
  balance: number;
}

export const fetchHomeStats = async (): Promise<HomeStats | null> => {
  const { data, error } = await supabase.rpc('public_home_stats');
  if (error) {
    if (!isMissingFunction(error)) console.error('public_home_stats failed', error);
    return null;
  }
  const n = (v: unknown) => Number(v ?? 0) || 0;
  return {
    members: n(data.members), approved_members: n(data.approved_members), mahaja_students: n(data.mahaja_students),
    donations_total: n(data.donations_total), expenses_total: n(data.expenses_total), balance: n(data.balance),
  };
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  image_url: string | null;
  image_path: string | null;
  video_url: string | null;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
}

/** Projects shown before the database table exists (the previously hard-coded list). */
export const FALLBACK_PROJECTS: Project[] = [
  ['سقيا الجمعية في غزة العزة', 'المساعدات الإنسانية', 'مشروع سقيا الجمعية في غزة لتوفير المياه.', 'nDQYphxF6UU'],
  ['السقاية رقم 11', 'الخدمات المجتمعية', 'مشروع السقاية رقم 11 لتوزيع المياه.', '86LU416opIc'],
  ['سقاية رقم 4', 'الخدمات المجتمعية', 'مشروع السقاية رقم 4 لتوفير المياه للمحتاجين.', 'ZLop_RsrDBw'],
  ['شرح كتاب الأخضري', 'دعم التعليم', 'شرح مبسط لكتاب الأخضري.', 'fQgr-BUSW1c'],
].map(([title, category, description, yt], i) => ({
  id: `fallback-${i}`, title, subtitle: null, description, category,
  image_url: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`, image_path: null,
  video_url: `https://www.youtube.com/embed/${yt}`, is_published: true, is_featured: true, sort_order: i, created_at: '',
}));

export const fetchPublicProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase.from('projects').select('*').order('sort_order').order('created_at');
  if (error) return FALLBACK_PROJECTS;
  return (data ?? []) as Project[];
};

export const adminListProjects = () => rpc<Project[]>('projects_admin_list', { p_token: getAdminToken() });
export const adminSaveProject = (id: string | null, data: Partial<Project>) =>
  rpc<Project>('project_save', { p_id: id, p_data: data, p_token: getAdminToken() });
export const adminDeleteProject = async (id: string) => {
  const path = await rpc<string | null>('project_delete', { p_id: id, p_token: getAdminToken() });
  await removeSiteImage(path);
};

/** YouTube embed/watch/short links → embed URL (or null). */
export const toEmbedUrl = (url: string | null | undefined) => {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
};

// ─── Homepage content ─────────────────────────────────────────────────────────

export interface HeroSlide {
  kicker: string;
  title: string;
  highlight: string;
  description: string;
  cta_label: string;
  cta_link: string;
  image_url: string;
}

export interface HomepageSettings {
  slides: HeroSlide[];
  show_stats: boolean;
  show_projects: boolean;
  show_transparency: boolean;
  show_campaigns: boolean;
  transparency_title: string;
  transparency_subtitle: string;
}

export const DEFAULT_HOMEPAGE: HomepageSettings = {
  slides: [
    {
      kicker: 'معاً نصنع الأمل..',
      title: 'ونترك أثراً',
      highlight: 'يدوم',
      description: 'جمعية تطوعية تجمعنا على الخير، ونفتح أبواب العلم، ونحول عطائكم إلى مبادرات تمس حياة الناس.',
      cta_label: 'كن عوناً وسنداً',
      cta_link: '/donate',
      image_url: '/Gaza.jpg',
    },
    {
      kicker: 'معهد المحجة البيضاء',
      title: 'نفتح أبواب',
      highlight: 'العلم',
      description: 'حلقات لتحفيظ القرآن الكريم وتعليم العلوم الشرعية لأبناء الحي، بإشراف أساتذة متطوعين.',
      cta_label: 'تعرّف على مشاريعنا',
      cta_link: '/projects',
      image_url: '/DEDE.jpg',
    },
    {
      kicker: 'صوتك يصنع الفرق',
      title: 'شارك في',
      highlight: 'الانتخابات',
      description: 'شارك في اختيار ممثلي الجمعية وصناعة مستقبلها عبر الانتخابات الإلكترونية الآمنة.',
      cta_label: 'صفحة الانتخابات',
      cta_link: '/elections',
      image_url: '/YAHYA.jpg',
    },
  ],
  show_stats: true,
  show_projects: true,
  show_transparency: true,
  show_campaigns: true,
  transparency_title: 'شفافية العطاء',
  transparency_subtitle: 'كل تبرع يصنع فرقاً في حياة الناس',
};

export const fetchHomepageSettings = async (): Promise<HomepageSettings> => {
  const { data } = await supabase.from('site_settings').select('value').eq('id', 'homepage').maybeSingle();
  const value = (data?.value ?? {}) as Partial<HomepageSettings>;
  return { ...DEFAULT_HOMEPAGE, ...value, slides: value.slides?.length ? value.slides : DEFAULT_HOMEPAGE.slides };
};

export const adminSaveHomepage = (value: HomepageSettings) =>
  rpc<HomepageSettings>('homepage_settings_save', { p_value: value, p_token: getAdminToken() });

// ─── Images (site-media bucket) ───────────────────────────────────────────────

const MAX_IMAGE = 5 * 1024 * 1024;

export const uploadSiteImage = async (file: File, folder: 'projects' | 'homepage' | 'candidates') => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new SiteError('نوع الصورة غير مدعوم (JPG أو PNG أو WEBP).');
  if (file.size > MAX_IMAGE) throw new SiteError('حجم الصورة يتجاوز 5 ميغابايت.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('site-media').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw new SiteError(error.message.includes('Bucket not found')
    ? 'مساحة الصور غير مهيأة. شغّل ملف قاعدة البيانات 20261020000000.'
    : `تعذّر رفع الصورة: ${error.message}`);
  return { url: supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl, path };
};

export const removeSiteImage = async (path: string | null | undefined) => {
  if (!path) return;
  const { error } = await supabase.storage.from('site-media').remove([path]);
  if (error) console.warn('Could not remove image', path, error.message);
};

// ─── Elections ────────────────────────────────────────────────────────────────

export type ElectionPhase = 'draft' | 'upcoming' | 'open' | 'ended' | 'closed';

export interface Candidate {
  id: string;
  full_name: string;
  photo_url: string | null;
  photo_path: string | null;
  bio: string | null;
  program: string | null;
  sort_order: number;
  votes: number | null;
}

export interface Election {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: 'draft' | 'open' | 'closed';
  phase: ElectionPhase;
  results_visible: boolean;
  /** Listed on the members' elections page (independent of whether voting is open). */
  is_published?: boolean;
  max_choices: number;
  eligibility: 'approved' | 'registered';
  voters_count: number;
  ballots_count: number | null;
  has_voted: boolean;
  is_eligible: boolean;
  eligible_count?: number;
  candidates: Candidate[];
}

export const PHASE_LABELS: Record<ElectionPhase, string> = {
  draft: 'لم يُفتح التصويت بعد', upcoming: 'لم يبدأ بعد', open: 'التصويت مفتوح', ended: 'انتهى الوقت', closed: 'مغلق',
};

export const fetchPublicElections = () => rpc<Election[]>('elections_public');
export const castVote = (electionId: string, candidateIds: string[]) =>
  rpc<{ success: boolean }>('election_cast_vote', { p_election_id: electionId, p_candidate_ids: candidateIds });

export const adminListElections = () => rpc<Election[]>('elections_admin_list', { p_token: getAdminToken() });
export const adminSaveElection = (id: string | null, data: Record<string, unknown>) =>
  rpc<Election>('election_save', { p_id: id, p_data: data, p_token: getAdminToken() });
export const adminSetElectionStatus = (id: string, status: Election['status']) =>
  rpc<Election>('election_set_status', { p_id: id, p_status: status, p_token: getAdminToken() });
export const adminSetResultsVisible = (id: string, visible: boolean) =>
  rpc<Election>('election_set_results_visible', { p_id: id, p_visible: visible, p_token: getAdminToken() });
export const adminSetElectionPublished = (id: string, published: boolean) =>
  rpc<Election>('election_set_published', { p_id: id, p_published: published, p_token: getAdminToken() });
export const adminDeleteElection = async (id: string) => {
  const paths = await rpc<string[]>('election_delete', { p_id: id, p_token: getAdminToken() });
  await Promise.all((paths ?? []).map(p => removeSiteImage(p)));
};
export const adminSaveCandidate = (id: string | null, electionId: string, data: Record<string, unknown>) =>
  rpc<Candidate>('candidate_save', { p_id: id, p_election_id: electionId, p_data: data, p_token: getAdminToken() });
export const adminDeleteCandidate = async (id: string) => {
  const path = await rpc<string | null>('candidate_delete', { p_id: id, p_token: getAdminToken() });
  await removeSiteImage(path);
};

// ─── Formatting ───────────────────────────────────────────────────────────────

export const formatMoney = (n: number) => Math.round(n).toLocaleString('en-US');
export const CURRENCY = 'أوقية جديدة';
