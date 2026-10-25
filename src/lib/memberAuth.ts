import { supabase } from './supabase';

// Member sign-in / sign-up helpers.
//
// Members sign in with their email and their registered phone number: the account password
// is derived from the phone (`${phone}Awn1!`). There is no email confirmation and no
// password reset. Other rules:
//  * email is trimmed / lower-cased; the phone must match ^[234][0-9]{7}$;
//  * a failed login does not send existing members to the sign-up form;
//  * the profile row is created by the database from sign-up metadata, so registration
//    also works when Supabase does not return a session.

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Phone numbers must be exactly 8 digits starting with 2, 3 or 4 (same rule as the database). */
export const PHONE_REGEX = /^[234][0-9]{7}$/;
export const PHONE_RULE_AR = 'رقم الهاتف يجب أن يتكون من 8 أرقام بالضبط ويبدأ بـ 2 أو 3 أو 4.';
export const normalizePhone = (phone: string) => phone.trim();
export const isValidPhone = (phone: string) => PHONE_REGEX.test(phone.trim());

export const derivedPassword = (phone: string) => `${phone.trim()}Awn1!`;

const isMissingFunction = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || (error.message ?? '').includes('Could not find the function'));

export type LoginResult =
  | { status: 'ok' }
  | { status: 'no_account' }
  | { status: 'wrong_secret' }
  | { status: 'error'; message: string };

export const memberLogin = async (emailInput: string, phoneInput: string): Promise<LoginResult> => {
  const email = normalizeEmail(emailInput);
  const phone = normalizePhone(phoneInput);
  if (!isValidPhone(phone)) return { status: 'error', message: `أدخل رقم الهاتف المسجل. ${PHONE_RULE_AR}` };

  const { error } = await supabase.auth.signInWithPassword({ email, password: derivedPassword(phone) });
  if (!error) {
    await ensureMyProfile();
    return { status: 'ok' };
  }
  const msg = error.message.toLowerCase();
  if (msg.includes('rate limit') || error.status === 429) return { status: 'error', message: 'محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.' };
  if (msg.includes('email not confirmed')) {
    // Accounts are confirmed automatically by the database; this only happens if that update is missing.
    return { status: 'error', message: 'حسابك موجود لكنه غير مفعّل بعد. تواصل مع إدارة الجمعية لتفعيله.' };
  }
  if (!msg.includes('invalid login credentials')) return { status: 'error', message: error.message };

  const { data, error: statusError } = await supabase.rpc('member_account_status', { p_email: email });
  if (statusError) return isMissingFunction(statusError) ? { status: 'no_account' } : { status: 'wrong_secret' };
  return data === 'none' ? { status: 'no_account' } : { status: 'wrong_secret' };
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
    national_id: input.national_id ?? '', date_of_birth: input.date_of_birth ?? '',
  };
  const { data, error } = await supabase.auth.signUp({ email, password: derivedPassword(phone), options: { data: metadata } });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already registered')) return { status: 'taken', fields: ['email'] };
    if (msg.includes('phone_invalid')) return { status: 'error', message: PHONE_RULE_AR };
    if (msg.includes('rate limit')) return { status: 'error', message: 'محاولات تسجيل كثيرة. حاول بعد قليل، أو أوقف خيار «Confirm email» في إعدادات Supabase.' };
    return { status: 'error', message: error.message };
  }
  // With email confirmation on, Supabase returns an obfuscated user for existing emails.
  if (!data.user || (data.user.identities && data.user.identities.length === 0)) return { status: 'taken', fields: ['email'] };

  // Accounts are confirmed automatically by the database, so sign in right away.
  let hasSession = !!data.session;
  if (!hasSession) {
    const signIn = await supabase.auth.signInWithPassword({ email, password: derivedPassword(phone) });
    if (signIn.error?.message.toLowerCase().includes('email not confirmed')) return { status: 'confirm_required' };
    hasSession = !signIn.error;
  }
  return { status: 'ok', userId: data.user.id, hasSession };
};
