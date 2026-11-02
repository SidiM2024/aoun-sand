import { supabase } from './supabase';
import { getStudentsToken, StudentsError } from './mahajaStudents';

// Finance of the Al-Mahaja institute (database: 20261105000000). Separate from the association's
// finance: its own tables and functions, managers of the Mahaja section only.

export const CURRENCY = 'أوقية';
export const fmtMoney = (n: number | string | null | undefined) =>
  `${Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${CURRENCY}`;

export interface Donation { id: string; donor_name: string; donor_phone: string | null; amount: number; donation_date: string; notes: string | null; created_by: string | null; updated_by: string | null }
export interface Expense { id: string; description: string; category: string; amount: number; expense_date: string; notes: string | null; created_by: string | null; updated_by: string | null }
export type Frequency = 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'once';
export type SponsorStatus = 'active' | 'paused' | 'ended';
export interface Sponsor {
  id: string; sponsor_name: string; sponsor_phone: string | null; amount: number; frequency: Frequency; start_date: string;
  status: SponsorStatus; status_changed_at: string | null; notes: string | null;
  students: { id: string; full_name: string; student_number: number }[];
  students_count: number; received: number; due: number; overdue: number; last_payment: string | null;
}
export interface Payment { id: string; sponsor_id: string; sponsor_name: string; amount: number; payment_date: string; period_label: string | null; notes: string | null; created_by: string | null }
export type MovementKind = 'donation' | 'expense' | 'payment';
export interface Movement { kind: MovementKind; id: string; op_date: string; label: string; detail: string; amount: number; notes: string | null }
export interface LogEntry { id: number; action: 'created' | 'updated' | 'deleted'; entity: string; summary: string | null; actor: string | null; created_at: string }
export interface Overview {
  today: string; me: string;
  donations_total: number; donations_count: number; expenses_total: number; expenses_count: number;
  sponsorship_received: number; sponsorship_due: number; sponsorship_overdue: number; balance: number;
  sponsors_count: number; sponsors_active: number; sponsored_students: number;
  month: { donations: number; payments: number; expenses: number };
  categories: { category: string; total: number }[];
  latest: Movement[];
}
export interface StudentOption { id: string; full_name: string; student_number: number; status: string; sponsored: boolean }
export interface Filters { from?: string; to?: string; q?: string; type?: string; sponsor_id?: string }

export const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: 'monthly', label: 'شهرية' }, { id: 'quarterly', label: 'كل 3 أشهر' }, { id: 'semiannual', label: 'كل 6 أشهر' },
  { id: 'yearly', label: 'سنوية' }, { id: 'once', label: 'مرة واحدة' },
];
export const SPONSOR_STATUSES: { id: SponsorStatus; label: string; cls: string }[] = [
  { id: 'active', label: 'نشطة', cls: 'bg-emerald-100 text-emerald-800' },
  { id: 'paused', label: 'متوقفة مؤقتًا', cls: 'bg-amber-100 text-amber-800' },
  { id: 'ended', label: 'منتهية', cls: 'bg-slate-200 text-slate-700' },
];
export const EXPENSE_CATEGORIES = ['رواتب ومكافآت', 'فواتير (كهرباء وماء)', 'لوازم تعليمية', 'إيجار', 'صيانة', 'تغذية', 'نقل', 'أخرى'];
export const MOVEMENT_LABELS: Record<MovementKind, string> = { donation: 'تبرع', expense: 'مصروف', payment: 'دفعة كفالة' };
export const ENTITY_LABELS: Record<string, string> = { donation: 'تبرع', expense: 'مصروف', sponsor: 'كفالة', payment: 'دفعة كفالة' };
export const ACTION_LABELS: Record<string, string> = { created: 'إضافة', updated: 'تعديل', deleted: 'حذف' };
export const frequencyLabel = (f: string) => FREQUENCIES.find(x => x.id === f)?.label ?? f;
export const statusInfo = (s: string) => SPONSOR_STATUSES.find(x => x.id === s) ?? SPONSOR_STATUSES[0];

const MESSAGES: Record<string, string> = {
  TEAMS_MANAGER_ONLY: 'الإدارة المالية للمعهد خاصة بمشرف المحجة المسؤول (المشرف الرئيسي أو مشرف المحجة غير المقيّد بحلقات).',
  ADMIN_FORBIDDEN: 'ليست لديك صلاحية على مالية المعهد.',
  ADMIN_UNAUTHORIZED: 'انتهت جلسة الدخول. أعد تسجيل الدخول إلى لوحة التحكم.',
  FIN_BAD_AMOUNT: 'أدخل مبلغًا صحيحًا أكبر من صفر.',
  FIN_DATE_REQUIRED: 'التاريخ مطلوب.',
  FIN_INVALID_DATA: 'بعض البيانات غير صحيحة: تحقق من الاسم (حرفان على الأقل) ورقم الهاتف والتاريخ.',
  FIN_MISSING_DATA: 'أكمل الحقول المطلوبة.',
  FIN_SPONSOR_HAS_PAYMENTS: 'لا يمكن حذف كفالة لها دفعات مسجلة. غيّر حالتها إلى «منتهية» بدل الحذف.',
  FIN_BAD_STATUS: 'حالة الكفالة غير صحيحة.',
  NOT_FOUND: 'العنصر غير موجود، ربما حُذف.',
};

const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, { ...args, p_token: getStudentsToken() });
  if (error) {
    const m = error.message ?? '';
    const key = Object.keys(MESSAGES).find(k => m.includes(k));
    if (key) throw new StudentsError(MESSAGES[key], key);
    if (error.code === 'PGRST202' || m.includes('Could not find the function')) {
      throw new StudentsError('النظام المالي للمعهد يحتاج تشغيل ملف قاعدة البيانات 20261105000000 في Supabase.', 'not_installed');
    }
    throw new StudentsError(m.includes('Failed to fetch') ? 'تعذّر الاتصال بالخادم، تحقق من الإنترنت.' : `حدث خطأ: ${m}`, error.code);
  }
  return data as T;
};

export const getOverview = () => call<Overview>('mahaja_fin_overview', {});
export const listFinance = async <T>(kind: 'donations' | 'expenses' | 'sponsors' | 'payments' | 'movements' | 'log', filters: Filters = {}) =>
  (await call<T[] | null>('mahaja_fin_list', { p_kind: kind, p_filters: filters })) ?? [];
export const saveFinance = <T>(kind: 'donation' | 'expense' | 'sponsor' | 'payment', id: string | null, data: Record<string, unknown>) =>
  call<T>('mahaja_fin_save', { p_kind: kind, p_id: id, p_data: data });
export const deleteFinance = (kind: 'donation' | 'expense' | 'sponsor' | 'payment', id: string) =>
  call<void>('mahaja_fin_delete', { p_kind: kind, p_id: id });
export const getStudentOptions = async () => (await call<StudentOption[] | null>('mahaja_fin_student_options', {})) ?? [];

// ─── Periods ──────────────────────────────────────────────────────────────────

export type PeriodKind = 'day' | 'month' | 'year' | 'custom';
export const PERIOD_KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'day', label: 'يومي' }, { id: 'month', label: 'شهري' }, { id: 'year', label: 'سنوي' }, { id: 'custom', label: 'فترة محددة' },
];
const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
export const periodRange = (kind: PeriodKind, day: string, customTo?: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  if (kind === 'day') return { from: day, to: day };
  if (kind === 'month') return { from: iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))), to: iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))) };
  if (kind === 'year') return { from: `${d.getUTCFullYear()}-01-01`, to: `${d.getUTCFullYear()}-12-31` };
  return { from: day, to: customTo && customTo >= day ? customTo : day };
};
export const fmtDate = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString('ar-MA', { year: 'numeric', month: '2-digit', day: '2-digit' });
