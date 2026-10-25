import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LogOut, User, Phone, Mail, MapPin, CreditCard, Activity, FileText, Hash, Camera, Calendar, Edit2, Save, X, Loader2,
  Vote, ShieldCheck, Clock, XCircle, Ban, ChevronLeft, BadgeCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { MembershipCardModal } from '../components/MembershipCardModal';

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  Approved: { label: 'عضو معتمد', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: BadgeCheck },
  'Pending Approval': { label: 'بانتظار الاعتماد', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  Rejected: { label: 'مرفوض', cls: 'bg-red-100 text-red-700', icon: XCircle },
  Suspended: { label: 'موقوف', cls: 'bg-rose-100 text-rose-700', icon: Ban },
};

const STATUS_OPTIONS = ['أدرس', 'أعمل', 'أبحث عن عمل', 'طالب علم', 'لا شيء'];

export const AccountPage = () => {
  const { user, userProfile, logout } = useAuth();
  // Local copy so edits show immediately even if realtime is not enabled.
  const [profile, setProfile] = useState(userProfile);
  useEffect(() => { setProfile(userProfile); }, [userProfile]);

  const [membership, setMembership] = useState<{ status: string; created_at: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ location: '', current_status: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Latest membership-fee record (existing «رسوم الانتساب» system); optional.
    void supabase.from('user_memberships').select('status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setMembership(data?.[0] ?? null), () => setMembership(null));
  }, [user]);

  const saveProfile = async (patch: Record<string, string>) => {
    const { data, error } = await supabase.rpc('member_update_profile', { p_data: patch });
    if (!error) { setProfile(p => (p ? { ...p, ...(data ?? patch) } : p)); return; }
    if (error.code !== 'PGRST202' && !(error.message ?? '').includes('Could not find the function')) throw error;
    // Database update not installed yet: previous direct update.
    const { error: e2 } = await supabase.from('users').update(patch).eq('id', user!.id);
    if (e2) throw e2;
    setProfile(p => (p ? { ...p, ...patch } : p));
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('اختر صورة'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('حجم الصورة يتجاوز 5 ميغابايت'); return; }
    setUploading(true);
    try {
      const fileName = `${user.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      await saveProfile({ avatar_url: supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl });
      toast.success('تم تحديث الصورة');
    } catch (err) {
      console.error(err);
      toast.error('تعذّر تحديث الصورة');
    } finally {
      setUploading(false);
    }
  };

  const startEdit = () => {
    setForm({ location: profile?.location ?? '', current_status: profile?.current_status ?? '' });
    setEditing(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (form.location.trim().length > 120) { toast.error('مكان السكن طويل جداً'); return; }
    setSaving(true);
    try {
      await saveProfile({ location: form.location.trim(), current_status: form.current_status.trim() });
      toast.success('تم حفظ التعديلات');
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const status = STATUS[profile?.approval_status ?? ''] ?? STATUS['Pending Approval'];
  const maskedId = profile?.national_id && profile.national_id !== 'N/A' && profile.national_id.length > 4
    ? `${'•'.repeat(profile.national_id.length - 4)}${profile.national_id.slice(-4)}` : profile?.national_id || '—';
   
  const joined = (profile as any)?.created_at ? new Date((profile as any).created_at).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

  const details = profile ? [
    { label: 'رقم العضوية', value: profile.unique_short_id || 'يُمنح بعد الاعتماد', icon: Hash, ltr: true },
    { label: 'البريد الإلكتروني', value: profile.email || user?.email || '—', icon: Mail, ltr: true },
    { label: 'رقم الهاتف', value: profile.phone, icon: Phone, ltr: true },
    { label: 'الرقم الوطني', value: maskedId, icon: FileText, ltr: true },
    { label: 'نوع الانتساب', value: profile.membership_type || '—', icon: CreditCard },
    { label: 'الحالة الحالية', value: profile.current_status || '—', icon: Activity },
    { label: 'مكان السكن', value: profile.location || '—', icon: MapPin },
    ...(profile.date_of_birth ? [{ label: 'تاريخ الميلاد', value: new Date(profile.date_of_birth).toLocaleDateString('ar-MA'), icon: Calendar }] : []),
    ...(joined ? [{ label: 'تاريخ التسجيل', value: joined, icon: Calendar }] : []),
  ] : [{ label: 'البريد الإلكتروني', value: user?.email || '', icon: Mail, ltr: true }];

  return (
    <div className="min-h-screen pt-[calc(76px+env(safe-area-inset-top))] pb-8 bg-[#f7f6fb] dark:bg-slate-950" dir="rtl">
      {/* Profile header */}
      <div className="bg-[#211d45] text-white px-5 pt-8 pb-20 rounded-b-[32px]">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center">
          <label className="relative cursor-pointer group" aria-label="تغيير الصورة الشخصية">
            <input type="file" accept="image/*" onChange={onAvatar} className="hidden" />
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt={profile.full_name} className="w-28 h-28 rounded-full object-cover border-4 border-[#f7b2b0] shadow-xl" />
              : <div className="w-28 h-28 rounded-full bg-[#f7b2b0] text-[#211d45] flex items-center justify-center text-4xl font-black border-4 border-white/20">{profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}</div>}
            <span className="absolute bottom-1 end-1 w-9 h-9 rounded-full bg-white text-[#211d45] flex items-center justify-center shadow-lg">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </span>
          </label>
          <h1 className="text-2xl sm:text-3xl font-black mt-4">{profile?.full_name || 'حسابي'}</h1>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {profile?.unique_short_id && <span className="px-3 py-1 rounded-full bg-white/10 text-sm font-bold" dir="ltr">{profile.unique_short_id}</span>}
            {profile && <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1.5 ${status.cls}`}><status.icon className="w-4 h-4" /> {status.label}</span>}
            {profile?.membership_type && <span className="px-3 py-1 rounded-full bg-[#f7b2b0]/20 text-[#f7b2b0] text-sm font-bold">{profile.membership_type}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 -mt-12 space-y-4">
        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'بطاقة العضوية', icon: CreditCard, onClick: () => setCardOpen(true), disabled: !profile },
            { label: 'طلباتي ومدفوعاتي', icon: FileText, to: '/requests' },
            { label: 'الانتخابات', icon: Vote, to: '/elections' },
          ].map(a => {
            const inner = <><div className="w-12 h-12 rounded-full bg-[#fde3e1] dark:bg-[#f7b2b0]/15 flex items-center justify-center mb-2"><a.icon className="w-6 h-6 text-[#211d45] dark:text-[#f7b2b0]" /></div><span className="text-xs sm:text-sm font-black text-[#211d45] dark:text-white">{a.label}</span></>;
            const cls = 'bg-white dark:bg-slate-900 rounded-3xl p-3 sm:p-4 shadow-md border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center hover:-translate-y-0.5 transition-transform disabled:opacity-50';
            return a.to ? <Link key={a.label} to={a.to} className={cls}>{inner}</Link>
              : <button key={a.label} onClick={a.onClick} disabled={a.disabled} className={cls}>{inner}</button>;
          })}
        </div>

        {/* Membership status */}
        {profile && (
          <section className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800">
            <h2 className="font-black text-[#211d45] dark:text-white flex items-center gap-2 mb-3"><ShieldCheck className="w-5 h-5 text-[#ef8f88]" /> حالة الانتساب</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-xs font-bold text-slate-500">حالة العضوية</p>
                <p className="font-black text-[#211d45] dark:text-white mt-0.5">{status.label}</p>
                {profile.approval_status !== 'Approved' && <p className="text-xs text-slate-500 mt-1">يعتمد المشرف العضوية بعد مراجعة البيانات. الأعضاء المعتمدون فقط يصوّتون في الانتخابات.</p>}
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-xs font-bold text-slate-500">رسوم الانتساب</p>
                <p className="font-black text-[#211d45] dark:text-white mt-0.5">
                  {membership ? ({ approved: 'مدفوعة ومؤكدة', pending: 'قيد المراجعة', rejected: 'مرفوضة — راجع الإدارة' } as Record<string, string>)[membership.status] ?? membership.status : 'لا يوجد دفع مسجل'}
                </p>
                {membership && <p className="text-xs text-slate-500 mt-1">آخر طلب: {new Date(membership.created_at).toLocaleDateString('ar-MA')}</p>}
              </div>
            </div>
          </section>
        )}

        {/* Details */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-black text-[#211d45] dark:text-white flex items-center gap-2"><User className="w-5 h-5 text-[#ef8f88]" /> بياناتي</h2>
            {profile && !editing && <button onClick={startEdit} className="px-4 py-2 rounded-xl bg-[#fde3e1] text-[#211d45] font-bold text-sm flex items-center gap-1.5"><Edit2 className="w-4 h-4" /> تعديل</button>}
          </div>

          <AnimatePresence initial={false}>
            {editing && (
              <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={submitEdit} className="overflow-hidden">
                <div className="p-4 space-y-3 bg-[#fdf3f2] dark:bg-slate-800/40">
                  <label className="block"><span className="block text-sm font-bold mb-1">مكان السكن</span>
                    <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} maxLength={120} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" /></label>
                  <label className="block"><span className="block text-sm font-bold mb-1">الحالة الحالية</span>
                    <select value={form.current_status} onChange={e => setForm(f => ({ ...f, current_status: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      {[...new Set([form.current_status, ...STATUS_OPTIONS].filter(Boolean))].map(o => <option key={o} value={o}>{o}</option>)}
                    </select></label>
                  <p className="text-xs text-slate-500">الاسم والبريد والهاتف والرقم الوطني تُعدَّل عن طريق إدارة الجمعية حفاظاً على صحة العضوية (رقم الهاتف مرتبط بتسجيل الدخول).</p>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 font-bold flex items-center gap-1.5"><X className="w-4 h-4" /> إلغاء</button>
                    <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-[#211d45] text-white font-bold flex items-center gap-1.5 disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ</button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            {details.map(d => (
              <div key={d.label} className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#fde3e1] dark:bg-[#f7b2b0]/15 text-[#211d45] dark:text-[#f7b2b0] flex items-center justify-center shrink-0"><d.icon className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{d.label}</dt>
                  <dd className="font-bold text-slate-800 dark:text-slate-100 break-words" dir={'ltr' in d && d.ltr ? 'ltr' : undefined} style={'ltr' in d && d.ltr ? { textAlign: 'right' } : undefined}>{d.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <button onClick={logout} className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors">
          <LogOut className="w-5 h-5" /> تسجيل الخروج
        </button>
      </div>

      {profile && <MembershipCardModal isOpen={cardOpen} onClose={() => setCardOpen(false)} />}
    </div>
  );
};
