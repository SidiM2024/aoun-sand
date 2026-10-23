import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound, Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { passwordProblem, updatePassword } from '../lib/memberAuth';

// Target of the "forgot password" email: the link signs the member in with a
// recovery session, then they choose a new password here.
export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let settled = false;
    const ready = () => { settled = true; setState('ready'); };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) ready();
    });
    void supabase.auth.getSession().then(({ data }) => { if (data.session) ready(); });
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const urlError = hash.get('error_description') || new URLSearchParams(window.location.search).get('error_description');
    const t = setTimeout(() => { if (!settled) setState('invalid'); }, urlError ? 0 : 4000);
    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const weak = passwordProblem(password); if (weak) { toast.error(weak); return; }
    if (password !== confirm) { toast.error('كلمتا المرور غير متطابقتين'); return; }
    setSaving(true);
    try {
      await updatePassword(password);
      toast.success('تم تعيين كلمة المرور. من الآن ادخل بالبريد الإلكتروني وكلمة المرور الجديدة.');
      navigate('/account', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر تعيين كلمة المرور');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f7f6fb] dark:bg-slate-950" dir="rtl">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="bg-[#211d45] p-6 flex justify-center"><img src="/aoun-logo.png" alt="جمعية عون وسند الخيرية" className="h-16" /></div>
        <div className="p-6 sm:p-8">
          {state === 'checking' && <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-[#ef8f88]" /></div>}
          {state === 'invalid' && (
            <div className="text-center space-y-4">
              <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
              <h1 className="text-xl font-black text-[#211d45] dark:text-white">الرابط غير صالح أو منتهي الصلاحية</h1>
              <p className="text-slate-600 dark:text-slate-300">اطلب رابطاً جديداً من صفحة تسجيل الدخول ← «نسيت كلمة المرور».</p>
              <Link to="/auth" className="inline-block px-6 py-3 rounded-2xl bg-[#211d45] text-white font-bold">تسجيل الدخول</Link>
            </div>
          )}
          {state === 'ready' && (
            <form onSubmit={submit} className="space-y-4">
              <div className="text-center mb-2">
                <KeyRound className="w-10 h-10 mx-auto text-[#ef8f88] mb-2" />
                <h1 className="text-2xl font-black text-[#211d45] dark:text-white">كلمة مرور جديدة</h1>
                <p className="text-sm text-slate-500 mt-1">8 أحرف على الأقل. بعد الحفظ تدخل بالبريد الإلكتروني وكلمة المرور هذه.</p>
              </div>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required minLength={8}
                  placeholder="كلمة المرور الجديدة" dir="ltr" className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-[#f7b2b0]" />
                <button type="button" onClick={() => setShow(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={show ? 'إخفاء' : 'إظهار'}>{show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
              </div>
              <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required
                placeholder="تأكيد كلمة المرور" dir="ltr" className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-[#f7b2b0]" />
              <button type="submit" disabled={saving} className="w-full py-4 rounded-2xl bg-[#211d45] text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                {saving && <Loader2 className="w-5 h-5 animate-spin" />} حفظ كلمة المرور
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
