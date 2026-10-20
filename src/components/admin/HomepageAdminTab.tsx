import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Home, Save, Loader2, Plus, Trash2, ArrowUp, ArrowDown, Camera, RotateCcw, BarChart3 } from 'lucide-react';
import {
  adminSaveHomepage, CURRENCY, DEFAULT_HOMEPAGE, fetchHomeStats, fetchHomepageSettings, formatMoney, removeSiteImage, uploadSiteImage,
  type HeroSlide, type HomeStats, type HomepageSettings,
} from '../../lib/siteApi';

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-300';

export const HomepageAdminTab = () => {
  const [value, setValue] = useState<HomepageSettings | null>(null);
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploaded, setUploaded] = useState<string[]>([]); // new images not yet saved

  useEffect(() => {
    void fetchHomepageSettings().then(setValue);
    void fetchHomeStats().then(setStats);
  }, []);

  if (!value) return <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-teal-500" /></div>;

  const setSlide = (i: number, patch: Partial<HeroSlide>) =>
    setValue(v => v && ({ ...v, slides: v.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, d: number) => setValue(v => {
    if (!v) return v;
    const slides = [...v.slides];
    const j = i + d;
    if (j < 0 || j >= slides.length) return v;
    [slides[i], slides[j]] = [slides[j], slides[i]];
    return { ...v, slides };
  });

  const upload = async (i: number, file: File) => {
    setUploading(i);
    try {
      const { url, path } = await uploadSiteImage(file, 'homepage');
      setUploaded(u => [...u, path]);
      setSlide(i, { image_url: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر رفع الصورة');
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (saving) return;
    if (value.slides.length === 0) { toast.error('أضف شريحة واحدة على الأقل'); return; }
    if (value.slides.some(s => !s.title.trim())) { toast.error('كل شريحة تحتاج عنواناً'); return; }
    setSaving(true);
    try {
      await adminSaveHomepage(value);
      // Remove uploaded images that are no longer used by any slide.
      const used = new Set(value.slides.map(s => s.image_url));
      await Promise.all(uploaded.filter(p => ![...used].some(u => u.includes(p))).map(p => removeSiteImage(p)));
      setUploaded([]);
      toast.success('تم حفظ محتوى الصفحة الرئيسية، ويظهر للزوار مباشرة');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const toggles: [keyof HomepageSettings, string][] = [
    ['show_stats', 'بطاقة الإحصائيات (الأعضاء، الطلاب، التبرعات، المصاريف)'],
    ['show_projects', 'أبرز مشاريعنا'],
    ['show_transparency', 'شفافية العطاء (التبرعات، المصروفات، الرصيد)'],
    ['show_campaigns', 'حملات التبرع المنشورة من قسم «التبرعات»'],
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2"><Home className="w-7 h-7 text-teal-500" /> محتوى الصفحة الرئيسية</h2>
          <p className="text-sm text-slate-500 mt-1">الشرائح الترحيبية والأقسام الظاهرة. الأرقام تُحسب تلقائياً ولا تُعدَّل يدوياً.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.confirm('استعادة المحتوى الافتراضي؟ (لن يُحفظ حتى تضغط حفظ)') && setValue(DEFAULT_HOMEPAGE)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold flex items-center gap-2"><RotateCcw className="w-4 h-4" /> افتراضي</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#211d45] flex items-center gap-2 disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ</button>
        </div>
      </div>

      {/* Live figures */}
      <section className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
        <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 mb-3"><BarChart3 className="w-5 h-5 text-teal-500" /> الأرقام الظاهرة الآن (تلقائية)</h3>
        {stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
            {[
              ['الأعضاء المسجلون', formatMoney(stats.members)], ['منهم معتمدون', formatMoney(stats.approved_members)], ['طلاب المحجة', formatMoney(stats.mahaja_students)],
              ['إجمالي التبرعات', formatMoney(stats.donations_total)], ['مصاريف التبرعات', formatMoney(stats.expenses_total)], ['الرصيد المتبقي', formatMoney(stats.balance)],
            ].map(([l, v]) => (
              <div key={l} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60"><div className="text-xl font-black" dir="ltr">{v}</div><div className="text-xs font-bold text-slate-500">{l}</div></div>
            ))}
          </div>
        ) : <p className="text-sm text-amber-600 font-bold">تعذّر حساب الأرقام — تأكد من تشغيل ملف قاعدة البيانات 20261020000000.</p>}
        <p className="text-xs text-slate-500 mt-3">المصدر: جدول الأعضاء، وجدول طلاب المحجة البيضاء (غير الموقوفين)، وإيرادات ومصاريف التبرعات في النظام المالي. المبالغ بـ{CURRENCY}.</p>
      </section>

      {/* Sections */}
      <section className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
        <h3 className="font-black text-slate-800 dark:text-white">الأقسام الظاهرة</h3>
        {toggles.map(([k, label]) => (
          <label key={k} className="flex items-center gap-3 font-bold text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={value[k] as boolean} onChange={e => setValue({ ...value, [k]: e.target.checked })} className="w-5 h-5 accent-teal-600" /> {label}
          </label>
        ))}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <label className="block"><span className="block text-sm font-bold mb-1">عنوان قسم الشفافية</span>
            <input value={value.transparency_title} onChange={e => setValue({ ...value, transparency_title: e.target.value })} className={inputCls} /></label>
          <label className="block"><span className="block text-sm font-bold mb-1">وصف قسم الشفافية</span>
            <input value={value.transparency_subtitle} onChange={e => setValue({ ...value, transparency_subtitle: e.target.value })} className={inputCls} /></label>
        </div>
      </section>

      {/* Slides */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-800 dark:text-white">الشرائح الترحيبية ({value.slides.length})</h3>
          <button onClick={() => setValue({ ...value, slides: [...value.slides, { ...DEFAULT_HOMEPAGE.slides[0], kicker: '', title: 'عنوان جديد', highlight: '', description: '' }] })}
            className="px-4 py-2 rounded-xl font-bold bg-teal-50 text-teal-700 flex items-center gap-1.5"><Plus className="w-4 h-4" /> شريحة</button>
        </div>
        {value.slides.map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
            <div>
              <label className="relative block aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer">
                {s.image_url && <img src={s.image_url} alt="" className="w-full h-full object-cover" />}
                <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-xs py-1.5 flex items-center justify-center gap-1">
                  {uploading === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />} تغيير الصورة
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(i, f); }} />
              </label>
              <div className="flex gap-2 mt-2">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="flex-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40 flex justify-center" aria-label="تقديم"><ArrowUp className="w-4 h-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === value.slides.length - 1} className="flex-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40 flex justify-center" aria-label="تأخير"><ArrowDown className="w-4 h-4" /></button>
                <button onClick={() => setValue({ ...value, slides: value.slides.filter((_, j) => j !== i) })} disabled={value.slides.length === 1} className="flex-1 p-2 rounded-xl bg-red-50 text-red-600 disabled:opacity-40 flex justify-center" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block"><span className="block text-xs font-bold mb-1">السطر الأول</span><input value={s.kicker} onChange={e => setSlide(i, { kicker: e.target.value })} className={inputCls} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="block text-xs font-bold mb-1">العنوان</span><input value={s.title} onChange={e => setSlide(i, { title: e.target.value })} className={inputCls} /></label>
                <label className="block"><span className="block text-xs font-bold mb-1">كلمة مميزة (وردية)</span><input value={s.highlight} onChange={e => setSlide(i, { highlight: e.target.value })} className={inputCls} /></label>
              </div>
              <label className="block sm:col-span-2"><span className="block text-xs font-bold mb-1">الوصف</span><textarea value={s.description} onChange={e => setSlide(i, { description: e.target.value })} rows={2} className={inputCls} /></label>
              <label className="block"><span className="block text-xs font-bold mb-1">نص الزر</span><input value={s.cta_label} onChange={e => setSlide(i, { cta_label: e.target.value })} className={inputCls} /></label>
              <label className="block"><span className="block text-xs font-bold mb-1">رابط الزر</span>
                <select value={['/donate', '/projects', '/elections', '/about', '/contact', '/account'].includes(s.cta_link) ? s.cta_link : 'custom'} onChange={e => e.target.value !== 'custom' && setSlide(i, { cta_link: e.target.value })} className={inputCls}>
                  <option value="/donate">التبرع</option><option value="/projects">مشاريعنا</option><option value="/elections">الانتخابات</option>
                  <option value="/about">عن الجمعية</option><option value="/contact">تواصل معنا</option><option value="/account">حسابي</option><option value="custom">رابط آخر…</option>
                </select>
                {!['/donate', '/projects', '/elections', '/about', '/contact', '/account'].includes(s.cta_link) && (
                  <input value={s.cta_link} onChange={e => setSlide(i, { cta_link: e.target.value })} dir="ltr" className={`${inputCls} mt-2`} placeholder="https://..." />
                )}
              </label>
            </div>
          </div>
        ))}
      </section>
    </motion.div>
  );
};
