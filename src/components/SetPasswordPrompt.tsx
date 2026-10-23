import { useState } from 'react';
import toast from 'react-hot-toast';
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PASSWORD_RULE_AR, hasWeakPassword, passwordProblem, updatePassword } from '../lib/memberAuth';

// Shown after a member signed in with the old phone-derived password: anyone who knows the
// member's email and phone could do the same, so we ask for a personal password.
const LATER_KEY = 'aoun_set_password_later';

export const SetPasswordPrompt = () => {
  const { user, userProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem(LATER_KEY) === '1'; } catch { return false; } });

  if (!user || hidden || !hasWeakPassword(user.id)) return null;
  const problem = password ? passwordProblem(password, userProfile?.phone) : null;

  const save = async () => {
    const err = passwordProblem(password, userProfile?.phone);
    if (err) { toast.error(err); return; }
    if (password !== password2) { toast.error('كلمتا المرور غير متطابقتين.'); return; }
    setBusy(true);
    try {
      await updatePassword(password);
      toast.success('تم تعيين كلمة المرور. استخدمها في المرات القادمة مع بريدك الإلكتروني.');
      setHidden(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذّر حفظ كلمة المرور');
    } finally {
      setBusy(false);
    }
  };

  const later = () => { try { sessionStorage.setItem(LATER_KEY, '1'); } catch { /* ignore */ } setHidden(true); };
  const field = 'w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-400';

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4" dir="rtl">
      <div role="dialog" aria-modal="true" aria-labelledby="setpw-title" className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center"><ShieldAlert className="w-7 h-7" /></div>
        <h2 id="setpw-title" className="text-xl font-black text-slate-800 dark:text-white">احمِ حسابك بكلمة مرور خاصة</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          دخلت برقم الهاتف. رقم الهاتف ليس سرًّا، لذلك عيّن كلمة مرور خاصة بك واستخدمها من الآن مع بريدك الإلكتروني. بياناتك لن تتغير.
        </p>
        <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور الجديدة" className={field} dir="ltr" />
        <input type="password" autoComplete="new-password" value={password2} onChange={e => setPassword2(e.target.value)} placeholder="تأكيد كلمة المرور" className={field} dir="ltr" />
        <p className={`text-xs ${problem ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{problem ?? PASSWORD_RULE_AR}</p>
        <button onClick={() => void save()} disabled={busy} className="w-full py-3.5 rounded-2xl font-black text-white bg-[#211d45] flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />} حفظ كلمة المرور
        </button>
        <button onClick={later} disabled={busy} className="w-full py-2 text-sm font-bold text-slate-500">لاحقًا (سيُطلب منك ذلك مجددًا)</button>
      </div>
    </div>
  );
};
