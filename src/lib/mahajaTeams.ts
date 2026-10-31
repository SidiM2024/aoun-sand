import { supabase } from './supabase';
import { getStudentsToken, StudentsError } from './mahajaStudents';

// Teams of 5 Mahaja students and the daily follow-up of each team (database: 20261104000000).

export type TeamPeriod = 'morning' | 'evening' | 'both';
export const TEAM_PERIODS: { id: TeamPeriod; label: string }[] = [
  { id: 'morning', label: 'صباحًا' },
  { id: 'evening', label: 'مساءً' },
  { id: 'both', label: 'صباحًا ومساءً' },
];
export const teamPeriodLabel = (p: string | null | undefined) => TEAM_PERIODS.find(x => x.id === p)?.label ?? '—';
export const TEAM_SIZE = 5;

export interface TeamMember { id: string; full_name: string; student_number: number; status?: string; photo_url?: string | null }
export interface MahajaTeam {
  id: string;
  team_number: number;
  members: TeamMember[];
  last_followup: string | null;
  followups_count: number;
}
export interface TeamsOverview { can_manage: boolean; today: string; unassigned: number | null; teams: MahajaTeam[] }

export interface FollowupStudent {
  student_id: string;
  student_name: string;
  student_number?: number | null;
  from_surah?: number | null;
  from_ayah?: number | null;
  to_surah?: number | null;
  to_ayah?: number | null;
  memorized?: boolean | null;
  reviewed_old?: boolean | null;
  repetitions?: number | null;
  supervisor_note?: string | null;
}
export interface TeamFollowup {
  team_id: string;
  team_number: number;
  date: string;
  exists: boolean;
  period: TeamPeriod | null;
  note: string | null;
  recorded_by: string | null;
  updated_by: string | null;
  updated_at: string | null;
  students: FollowupStudent[];
  dates: string[];
}
export interface FollowupRecord extends Omit<TeamFollowup, 'exists' | 'dates' | 'updated_at'> { id: string }

const MESSAGES: Record<string, string> = {
  TEAMS_MANAGER_ONLY: 'هذه العملية خاصة بمشرف المحجة المسؤول عن جميع الطلاب.',
  TEAM_TOO_LARGE: 'لا يمكن أن يضم الفريق أكثر من 5 طلاب.',
  TEAM_HAS_FOLLOWUPS: 'لا يمكن حذف فريق له متابعات محفوظة.',
  FOLLOWUP_PERIOD_REQUIRED: 'اختر نوع الدوام.',
  FOLLOWUP_FUTURE_DATE: 'لا يمكن تسجيل متابعة لتاريخ لم يأتِ بعد.',
  FOLLOWUP_NO_STUDENTS: 'لا يوجد طلاب في هذا الفريق.',
  ADMIN_FORBIDDEN: 'ليست لديك صلاحية على هذا الفريق.',
  ADMIN_UNAUTHORIZED: 'انتهت جلسة الدخول. أعد تسجيل الدخول إلى لوحة التحكم.',
  BAD_RANGE: 'فترة التقرير غير صحيحة.',
  NOT_FOUND: 'العنصر غير موجود، ربما حُذف.',
};

const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, { ...args, p_token: getStudentsToken() });
  if (error) {
    const m = error.message ?? '';
    const key = Object.keys(MESSAGES).find(k => m.includes(k));
    if (key) throw new StudentsError(MESSAGES[key], key);
    if (error.code === 'PGRST202' || m.includes('Could not find the function')) {
      throw new StudentsError('ميزة الفرق تحتاج تشغيل ملف قاعدة البيانات 20261104000000 في Supabase.', 'not_installed');
    }
    throw new StudentsError(m.includes('Failed to fetch') ? 'تعذّر الاتصال بالخادم، تحقق من الإنترنت.' : `حدث خطأ: ${m}`, error.code);
  }
  return data as T;
};

export const getTeams = () => call<TeamsOverview>('mahaja_teams_list', {});
export const distributeTeams = () => call<{ placed: number; new_teams: number }>('mahaja_teams_distribute', {});
export const setTeamMembers = (teamId: string | null, studentIds: string[]) =>
  call<{ id: string; team_number: number }>('mahaja_team_set_members', { p_team_id: teamId, p_student_ids: studentIds });
export const deleteTeam = (teamId: string) => call<void>('mahaja_team_delete', { p_team_id: teamId });
export const getFollowup = (teamId: string, date: string) => call<TeamFollowup>('mahaja_team_followup_get', { p_team_id: teamId, p_date: date });
export const saveFollowup = (teamId: string, date: string, data: { period: TeamPeriod; note: string; students: FollowupStudent[] }) =>
  call<TeamFollowup>('mahaja_team_followup_save', { p_team_id: teamId, p_date: date, p_data: data });
export const getFollowupsReport = async (from: string, to: string, teamId: string | null) =>
  (await call<FollowupRecord[] | null>('mahaja_team_followups_report', { p_from: from, p_to: to, p_team_id: teamId })) ?? [];

// ─── Report ranges ────────────────────────────────────────────────────────────

export type ReportKind = 'day' | 'week' | 'month' | 'year';
export const REPORT_KINDS: { id: ReportKind; label: string }[] = [
  { id: 'day', label: 'يومي' }, { id: 'week', label: 'أسبوعي' }, { id: 'month', label: 'شهري' }, { id: 'year', label: 'سنوي' },
];

const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** Day: that day. Week: the 7 days ending that day. Month / year: the calendar month / year of that day. */
export const reportRange = (kind: ReportKind, day: string): { from: string; to: string } => {
  const d = new Date(`${day}T00:00:00Z`);
  if (kind === 'day') return { from: day, to: day };
  if (kind === 'week') { const f = new Date(d); f.setUTCDate(f.getUTCDate() - 6); return { from: iso(f), to: day }; }
  if (kind === 'month') {
    return { from: iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))), to: iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))) };
  }
  return { from: `${d.getUTCFullYear()}-01-01`, to: `${d.getUTCFullYear()}-12-31` };
};

// ─── Surahs (name, number of ayahs) ───────────────────────────────────────────

export const SURAHS: [string, number][] = [
  ['الفاتحة', 7], ['البقرة', 286], ['آل عمران', 200], ['النساء', 176], ['المائدة', 120], ['الأنعام', 165], ['الأعراف', 206], ['الأنفال', 75],
  ['التوبة', 129], ['يونس', 109], ['هود', 123], ['يوسف', 111], ['الرعد', 43], ['إبراهيم', 52], ['الحجر', 99], ['النحل', 128],
  ['الإسراء', 111], ['الكهف', 110], ['مريم', 98], ['طه', 135], ['الأنبياء', 112], ['الحج', 78], ['المؤمنون', 118], ['النور', 64],
  ['الفرقان', 77], ['الشعراء', 227], ['النمل', 93], ['القصص', 88], ['العنكبوت', 69], ['الروم', 60], ['لقمان', 34], ['السجدة', 30],
  ['الأحزاب', 73], ['سبأ', 54], ['فاطر', 45], ['يس', 83], ['الصافات', 182], ['ص', 88], ['الزمر', 75], ['غافر', 85],
  ['فصلت', 54], ['الشورى', 53], ['الزخرف', 89], ['الدخان', 59], ['الجاثية', 37], ['الأحقاف', 35], ['محمد', 38], ['الفتح', 29],
  ['الحجرات', 18], ['ق', 45], ['الذاريات', 60], ['الطور', 49], ['النجم', 62], ['القمر', 55], ['الرحمن', 78], ['الواقعة', 96],
  ['الحديد', 29], ['المجادلة', 22], ['الحشر', 24], ['الممتحنة', 13], ['الصف', 14], ['الجمعة', 11], ['المنافقون', 11], ['التغابن', 18],
  ['الطلاق', 12], ['التحريم', 12], ['الملك', 30], ['القلم', 52], ['الحاقة', 52], ['المعارج', 44], ['نوح', 28], ['الجن', 28],
  ['المزمل', 20], ['المدثر', 56], ['القيامة', 40], ['الإنسان', 31], ['المرسلات', 50], ['النبأ', 40], ['النازعات', 46], ['عبس', 42],
  ['التكوير', 29], ['الانفطار', 19], ['المطففين', 36], ['الانشقاق', 25], ['البروج', 22], ['الطارق', 17], ['الأعلى', 19], ['الغاشية', 26],
  ['الفجر', 30], ['البلد', 20], ['الشمس', 15], ['الليل', 21], ['الضحى', 11], ['الشرح', 8], ['التين', 8], ['العلق', 19],
  ['القدر', 5], ['البينة', 8], ['الزلزلة', 8], ['العاديات', 11], ['القارعة', 11], ['التكاثر', 8], ['العصر', 3], ['الهمزة', 9],
  ['الفيل', 5], ['قريش', 4], ['الماعون', 7], ['الكوثر', 3], ['الكافرون', 6], ['النصر', 3], ['المسد', 5], ['الإخلاص', 4],
  ['الفلق', 5], ['الناس', 6],
];
export const surahName = (n: number | null | undefined) => (n && SURAHS[n - 1] ? SURAHS[n - 1][0] : '');

/** «البقرة 1 ← البقرة 5», or «—». */
export const wirdLabel = (s: Pick<FollowupStudent, 'from_surah' | 'from_ayah' | 'to_surah' | 'to_ayah'>) => {
  if (!s.from_surah && !s.to_surah) return '—';
  const part = (surah?: number | null, ayah?: number | null) => `${surahName(surah)}${ayah ? ` ${ayah}` : ''}`;
  return `من ${part(s.from_surah, s.from_ayah)} إلى ${part(s.to_surah ?? s.from_surah, s.to_ayah)}`;
};

/**
 * Problem in one student's line: an ayah number beyond its surah. The direction of the portion
 * is free (many students memorise from the end of the Quran towards its beginning).
 */
export const wirdError = (s: FollowupStudent): string | null => {
  const check = (surah?: number | null, ayah?: number | null) => !surah || !ayah || ayah <= (SURAHS[surah - 1]?.[1] ?? 0);
  if (!check(s.from_surah, s.from_ayah) || !check(s.to_surah, s.to_ayah)) return 'رقم الآية أكبر من عدد آيات السورة';
  return null;
};
