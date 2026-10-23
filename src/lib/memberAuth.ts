import { supabase } from './supabase';

// Member sign-in / sign-up helpers.
//
// New members choose their own password. Older accounts were created with a password
// derived from the phone number (`${phone}Awn1!`); they keep working, and after signing in
// that way the member is asked to set a personal password (see SetPasswordPrompt).
// Other rules:
//  * email is trimmed / lower-cased; the phone must match ^[234][0-9]{7}$;
//  * the same field also accepts a real password (set via "forgot password" / account page);
//  * a failed login no longer sends existing members to the sign-up form;
//  * unconfirmed emails get a clear message and a "resend" action;
//  * the profile row is created by the database from sign-up metadata, so registration
//    also works when Supabase does not return a session.

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Phone numbers must be exactly 8 digits starting with 2, 3 or 4 (same rule as the database). */
export const PHONE_REGEX = /^[234][0-9]{7}$/;
export const PHONE_RULE_AR = 'رقم الهاتف يجب أن يتكون من 8 أرقام بالضبط ويبدأ بـ 2 أو 3 أو 4.';
export const normalizePhone = (phone: string) => phone.trim();
export const isValidPhone = (phone: string) => PHONE_REGEX.test(phone.trim());

export const derivedPassword = (phone: string) => `${phone.trim()}Awn1!`;

export const PASSWORD_RULE_AR = 'كلمة المرور: 8 أحرف على الأقل، وتحتوي على حروف وأرقام، ولا تكون رقم الهاتف.';
/** Returns an Arabic error, or null when the password is acceptable. */
export const passwordProblem = (password: string, phone?: string): string | null => {
  const p = password ?? '';
  if (p.length < 8) return 'كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.';
  if (p.length > 72) return 'كلمة المرور طويلة جدًا.';
  if (!/[A-Za-z\u0600-\u06FF]/.test(p) || !/[0-9\u0660-\u0669]/.test(p)) return 'كلمة المرور يجب أن تحتوي على حروف وأرقام.';
  if (phone && (p.includes(phone.trim()) || p === derivedPassword(phone))) return 'لا تستخدم رقم هاتفك ككلمة مرور.';
  return null;
};

// Accounts that signed in with the phone-derived password are asked to set a real one.
const WEAK_KEY = 'aoun_weak_password_uid';
export const markWeakPassword = (userId: string | null) => {
  try { if (userId) localStorage.setItem(WEAK_KEY, userId); else localStorage.removeItem(WEAK_KEY); } catch { /* storage unavailable */ }
};
export const hasWeakPassword = (userId: string | undefined | null) => {
  try { return !!userId && localStorage.getItem(WEAK_KEY) === userId; } catch { return false; }
};

const isMissingFunction = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || (error.message ?? '').includes('Could not find the function'));

const redirectUrl = (path: string) => `${window.location.origin}${path}`;

export type LoginResult =
  | { status: 'ok'; weakPassword: boolean }
  | { status: 'no_account' }
  | { status: 'wrong_secret' }
  | { status: 'unconfirmed' }
  | { status: 'error'; message: string };

export const memberLogin = async (emailInput: string, secretInput: string): Promise<LoginResult> => {
  const email = normalizeEmail(emailInput);
  const secret = secretInput.trim();
  const candidates: string[] = [];
  if (isValidPhone(secret)) candidates.push(derivedPassword(secret)); // older accounts
  if (secret.length >= 6 && !candidates.includes(secret)) candidates.push(secret);
  if (candidates.length === 0) return { status: 'error', message: `أدخل رقم الهاتف المسجل أو كلمة المرور. ${PHONE_RULE_AR}` };

  let unconfirmed = false;
  for (const password of candidates) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      await ensureMyProfile();
      const weakPassword = password === derivedPassword(secret);
      markWeakPassword(weakPassword ? data.user?.id ?? null : null);
      return { status: 'ok', weakPassword };
    }
    const msg = error.message.toLowerCase();
    if (msg.includes('email not confirmed')) { unconfirmed = true; break; }
    if (msg.includes('rate limit') || error.status === 429) return { status: 'error', message: 'محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.' };
    if (!msg.includes('invalid login credentials')) return { status: 'error', message: error.message };
  }
  if (unconfirmed) return { status: 'unconfirmed' };

  const { data, error } = await supabase.rpc('member_account_status', { p_email: email });
  if (error) return isMissingFunction(error) ? { status: 'no_account' } : { status: 'wrong_secret' };
  if (data === 'none') return { status: 'no_account' };
  if (data === 'unconfirmed') return { status: 'unconfirmed' };
  return { status: 'wrong_secret' };
};

/** Creates the signed-in member's profile row if it is missing (older accounts). */
export const ensureMyProfile = async (extra: Record<string, unknown> = {}) => {
  const { error } = await supabase.rpc('ensure_my_profile', { p_data: extra });
  if (!error) return;
  if (!isMissingFunction(error)) { console.warn('ensure_my_profile failed', error.message); return; }
  // Database update not installed yet: previous client-side behaviour.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { data: existing } = await supabase.from('users').select('id').eq('id', auth.user.id).maybeSingle();
  if (existing) return;
  await supabase.from('users').insert([{
    id: auth.user.id, email: auth.user.email, phone: '20000000', full_name: 'مستخدم جديد', membership_type: 'عضو',
    current_status: 'لا شيء', location: '', national_id: '', approval_status: 'Pending Approval',
  }]);
};

export interface SignupData {
  email: string;
  password: string;
  phone: string;
  full_name: string;
  location: string;
  is_mahaja: boolean;
  membership_type?: string;
  current_status?: string;
  national_id?: string;
  date_of_birth?: string;
}

export type SignupResult =
  | { status: 'ok'; userId: string; hasSession: boolean }
  | { status: 'taken'; fields: ('email' | 'phone' | 'national_id')[] }
  | { status: 'confirm_required' }
  | { status: 'error'; message: string };

export const memberSignup = async (input: SignupData): Promise<SignupResult> => {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone)) return { status: 'error', message: PHONE_RULE_AR };
  const weak = passwordProblem(input.password, phone);
  if (weak) return { status: 'error', message: weak };

  const { data: avail, error: availError } = await supabase.rpc('member_check_available', {
    p_email: email, p_phone: phone, p_national_id: input.national_id ?? '', p_is_mahaja: input.is_mahaja,
  });
  if (!availError && avail) {
    const fields = (['email', 'phone', 'national_id'] as const).filter(f => avail[`${f}_taken`]);
    if (fields.length) return { status: 'taken', fields };
  }

  const metadata = {
    full_name: input.full_name.trim(), phone, location: input.location.trim(), is_mahaja: input.is_mahaja,
    membership_type: input.membership_type ?? '', current_status: input.current_status ?? '',
    national_id: input.national_id ?? '', date_of_birth: input.date_of_birth ?? '', password_set: true,
  };
  const { data, error } = await supabase.auth.signUp({
    email, password: input.password, options: { data: metadata, emailRedirectTo: redirectUrl('/auth') },
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already registered')) return { status: 'taken', fields: ['email'] };
    if (msg.includes('phone_invalid')) return { status: 'error', message: PHONE_RULE_AR };
    if (msg.includes('password')) return { status: 'error', message: PASSWORD_RULE_AR };
    if (msg.includes('rate limit')) return { status: 'error', message: 'تعذّر إرسال بريد التأكيد (تجاوز الحد المسموح). يجب إيقاف خيار «Confirm email» في إعدادات Supabase، أو المحاولة بعد ساعة.' };
    return { status: 'error', message: error.message };
  }
  // With email confirmation on, Supabase returns an obfuscated user for existing emails.
  if (!data.user || (data.user.identities && data.user.identities.length === 0)) return { status: 'taken', fields: ['email'] };

  // Accounts are confirmed automatically by the database (no confirmation email), so sign in right away.
  let hasSession = !!data.session;
  if (!hasSession) {
    const signIn = await supabase.auth.signInWithPassword({ email, password: input.password });
    if (signIn.error?.message.toLowerCase().includes('email not confirmed')) return { status: 'confirm_required' };
    hasSession = !signIn.error;
  }
  return { status: 'ok', userId: data.user.id, hasSession };
};

export const resendConfirmation = async (email: string) => {
  const { error } = await supabase.auth.resend({ type: 'signup', email: normalizeEmail(email), options: { emailRedirectTo: redirectUrl('/auth') } });
  if (error) throw new Error(error.message);
};

export const requestPasswordReset = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: redirectUrl('/reset-password') });
  if (error) throw new Error(error.message.toLowerCase().includes('rate limit') ? 'طلبات كثيرة. حاول بعد قليل.' : error.message);
};

export const updatePassword = async (password: string) => {
  const { data, error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('same') || m.includes('different')) throw new Error('اختر كلمة مرور مختلفة عن الحالية.');
    if (m.includes('weak') || m.includes('password')) throw new Error(PASSWORD_RULE_AR);
    throw new Error(error.message);
  }
  if (data.user?.id && hasWeakPassword(data.user.id)) markWeakPassword(null);
};
