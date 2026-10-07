import { supabase } from './supabase';

// ─── Dashboard sections ───────────────────────────────────────────────────────
// Keep in sync with public.admin_all_sections() in
// supabase/migrations/20261008000000_admin_sections_and_mahaja_attendance.sql.

export const ADMIN_SECTIONS = [
  { id: 'users', label: 'المستخدمين' },
  { id: 'approvals', label: 'طلبات الموافقة' },
  { id: 'memberships', label: 'رسوم الانتساب' },
  { id: 'finance', label: 'المالية' },
  { id: 'user_donations', label: 'التبرعات الواردة' },
  { id: 'donations', label: 'التبرعات' },
  { id: 'patients', label: 'إدارة المرضى' },
  { id: 'mahaja', label: 'المحجة البيضاء' },
  { id: 'requests', label: 'الطلبات' },
  { id: 'notifications', label: 'الإشعارات' },
  { id: 'voting', label: 'التصويت' },
  { id: 'competitions', label: 'المسابقات' },
  { id: 'media', label: 'الوسائط' },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]['id'];
export const ALL_SECTION_IDS = ADMIN_SECTIONS.map(s => s.id) as AdminSectionId[];

/** One-click groups shown in the admin form. */
export const SECTION_PRESETS: { label: string; sections: AdminSectionId[] }[] = [
  { label: 'المالية فقط', sections: ['finance', 'memberships', 'user_donations'] },
  { label: 'المحجة البيضاء فقط', sections: ['mahaja'] },
  { label: 'إدارة المرضى فقط', sections: ['patients'] },
  { label: 'الأعضاء والمنتسبون', sections: ['users', 'approvals', 'memberships'] },
  { label: 'الطلبات', sections: ['requests'] },
  { label: 'المحتوى والتواصل', sections: ['notifications', 'voting', 'competitions', 'media', 'donations'] },
];

export interface AdminSessionInfo {
  kind: 'auth' | 'legacy';
  id: string;
  username: string;
  label: string;
  role: string;
  is_super: boolean;
  sections: string[];
}

// ─── Token storage ────────────────────────────────────────────────────────────

const TOKEN_KEY = 'admin_session_token';
const OLD_MAHAJA_KEY = 'mahaja_students_token';

export const getAdminToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(OLD_MAHAJA_KEY); } catch { return null; }
};

export const setAdminToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(OLD_MAHAJA_KEY);
  } catch { /* storage unavailable */ }
};

const clearLegacyFlags = () => {
  for (const storage of [localStorage, sessionStorage]) {
    try { storage.removeItem('admin_auth'); storage.removeItem('admin_role'); } catch { /* ignore */ }
  }
};

const isMissingFunction = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || (error.message ?? '').includes('Could not find the function'));

// ─── Login / session ──────────────────────────────────────────────────────────

export type AdminLoginResult =
  | { ok: true; session: AdminSessionInfo | null; legacyFallback?: boolean }
  | { ok: false; message: string; notFound?: boolean };

/**
 * Logs in a dashboard (system_admins) administrator and stores the server session.
 * Falls back to the old verify_admin_login flow only while the permissions
 * migration has not been applied yet.
 */
export const adminLogin = async (username: string, password: string): Promise<AdminLoginResult> => {
  const { data, error } = await supabase.rpc('admin_login', { p_username: username.trim(), p_password: password });
  if (!error) {
    if (data?.success) {
      setAdminToken(data.token);
      // Kept for older code paths that still read these flags; the server session is authoritative.
      localStorage.setItem('admin_auth', 'true');
      localStorage.setItem('admin_role', data.admin?.role ?? '');
      return { ok: true, session: data.admin as AdminSessionInfo };
    }
    return { ok: false, message: data?.message === 'Account is disabled' ? 'هذا الحساب معطّل. تواصل مع المشرف الرئيسي.' : 'اسم المستخدم أو كلمة المرور غير صحيحة.', notFound: true };
  }
  if (!isMissingFunction(error)) return { ok: false, message: 'تعذّر الاتصال بالخادم، حاول مرة أخرى.' };

  // Permissions migration not installed yet: previous behaviour.
  const legacy = await supabase.rpc('verify_admin_login', { p_username: username.trim(), p_password: password });
  if (legacy.error) return { ok: false, message: 'legacy_error', notFound: true };
  if (legacy.data?.success) {
    for (const storage of [sessionStorage, localStorage]) {
      storage.setItem('admin_auth', 'true');
      storage.setItem('admin_role', legacy.data.admin.role);
    }
    return { ok: true, session: null, legacyFallback: true };
  }
  return { ok: false, message: legacy.data?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة.', notFound: true };
};

export type SessionCheck =
  | { status: 'valid'; session: AdminSessionInfo }
  | { status: 'invalid' }
  | { status: 'not_installed' }
  | { status: 'offline' };

/** Asks the server who the current admin is (Supabase Auth admin or dashboard session token). */
export const fetchAdminSession = async (): Promise<SessionCheck> => {
  const { data, error } = await supabase.rpc('admin_session_info', { p_token: getAdminToken() });
  if (error) return isMissingFunction(error) ? { status: 'not_installed' } : { status: 'offline' };
  if (!data) return { status: 'invalid' };
  return { status: 'valid', session: data as AdminSessionInfo };
};

export const adminLogout = async () => {
  const token = getAdminToken();
  setAdminToken(null);
  clearLegacyFlags();
  if (token) await supabase.rpc('admin_logout', { p_token: token }).then(() => undefined, () => undefined);
};

export const forgetAdminSession = () => { setAdminToken(null); clearLegacyFlags(); };

export const canAccessSection = (session: Pick<AdminSessionInfo, 'is_super' | 'sections'> | null, section: string) =>
  !!session && (session.is_super || session.sections.includes(section));

// ─── Admin management (Super Admin) ───────────────────────────────────────────

export interface ManagedAdmin {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
  permissions: string[];
  sections: string[];
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string | null;
}

export class AdminApiError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

const adminError = (error: { code?: string; message?: string }): AdminApiError => {
  const m = error.message ?? '';
  if (m.includes('ADMIN_FORBIDDEN')) return new AdminApiError('هذه العملية متاحة للمشرف الرئيسي فقط.', 'forbidden');
  if (m.includes('ADMIN_UNAUTHORIZED')) return new AdminApiError('انتهت الجلسة، يرجى تسجيل الدخول من جديد.', 'unauthorized');
  if (m.includes('ADMIN_LAST_SUPER')) return new AdminApiError('لا يمكن تنفيذ ذلك: يجب أن يبقى مشرف رئيسي واحد نشط على الأقل.', 'last_super');
  if (m.includes('ADMIN_SELF')) return new AdminApiError('لا يمكنك تعطيل أو حذف حسابك الحالي.', 'self');
  if (m.includes('ADMIN_BAD_USERNAME')) return new AdminApiError('اسم المستخدم غير صالح (3–64 حرفاً لاتينياً أو أرقاماً أو @ . _ - +).', 'invalid');
  if (m.includes('ADMIN_WEAK_PASSWORD')) return new AdminApiError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.', 'invalid');
  if (m.includes('ADMIN_NOT_FOUND')) return new AdminApiError('المشرف غير موجود، ربما حُذف.', 'not_found');
  if (error.code === '23505') return new AdminApiError('اسم المستخدم مستخدم من قبل مشرف آخر.', 'duplicate');
  if (isMissingFunction(error)) return new AdminApiError('نظام الصلاحيات غير مثبت في قاعدة البيانات. شغّل ملف الترحيل 20261008000000 في Supabase.', 'not_installed');
  return new AdminApiError(m ? `حدث خطأ: ${m}` : 'حدث خطأ غير متوقع.', error.code);
};

export const listAdmins = async (): Promise<ManagedAdmin[]> => {
  const { data, error } = await supabase.rpc('admin_list', { p_token: getAdminToken() });
  if (error) throw adminError(error);
  return (data ?? []) as ManagedAdmin[];
};

export interface AdminInput {
  username: string;
  password?: string;
  display_name?: string;
  role: string;
  permissions: string[];
  sections: string[];
}

export const saveAdmin = async (id: string | null, input: AdminInput): Promise<ManagedAdmin> => {
  const { data, error } = await supabase.rpc('admin_save', { p_id: id, p_data: input, p_token: getAdminToken() });
  if (error) throw adminError(error);
  return data as ManagedAdmin;
};

export const setAdminActive = async (id: string, active: boolean) => {
  const { error } = await supabase.rpc('admin_set_active', { p_id: id, p_active: active, p_token: getAdminToken() });
  if (error) throw adminError(error);
};

export const deleteAdmin = async (id: string) => {
  const { error } = await supabase.rpc('admin_delete', { p_id: id, p_token: getAdminToken() });
  if (error) throw adminError(error);
};
