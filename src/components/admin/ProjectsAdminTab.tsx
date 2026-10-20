import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FolderHeart, Plus, Edit2, Trash2, Loader2, X, Save, Camera, Eye, EyeOff, Star, ImageOff, Play } from 'lucide-react';
import {
  adminDeleteProject, adminListProjects, adminSaveProject, removeSiteImage, toEmbedUrl, uploadSiteImage, type Project,
} from '../../lib/siteApi';

const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-pink-300';

const ProjectForm = ({ project, nextOrder, onClose, onSaved }: { project: Project | null; nextOrder: number; onClose: () => void; onSaved: () => void }) => {
  const [form, setForm] = useState({
    title: project?.title ?? '', subtitle: project?.subtitle ?? '', category: project?.category ?? '', description: project?.description ?? '',
    video_url: project?.video_url ?? '', sort_order: String(project?.sort_order ?? nextOrder),
    is_published: project?.is_published ?? true, is_featured: project?.is_featured ?? true,
  });
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(project?.image_url ?? null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (saving) return;
    if (form.title.trim().length < 2) { toast.error('اسم المشروع مطلوب'); return; }
    setSaving(true);
    let uploaded: { url: string; path: string } | null = null;
    try {
      if (image) uploaded = await uploadSiteImage(image, 'projects');
      // A YouTube link without an image uses the video thumbnail.
      const yt = toEmbedUrl(form.video_url)?.match(/embed\/([\w-]+)/)?.[1];
      const autoThumb = !uploaded && !preview && yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : null;
      await adminSaveProject(project?.id ?? null, {
        title: form.title.trim(), subtitle: form.subtitle.trim(), category: form.category.trim(), description: form.description.trim(),
        video_url: toEmbedUrl(form.video_url.trim()) ?? '', sort_order: Number(form.sort_order) || 0,
        is_published: form.is_published, is_featured: form.is_featured,
        ...(uploaded ? { image_url: uploaded.url, image_path: uploaded.path } : autoThumb ? { image_url: autoThumb, image_path: null } : {}),
      });
      if (uploaded && project?.image_path) await removeSiteImage(project.image_path);
      toast.success(project ? 'تم تحديث المشروع' : 'تمت إضافة المشروع');
      onSaved();
    } catch (err) {
      if (uploaded) await removeSiteImage(uploaded.path);
      toast.error(err instanceof Error ? err.message : 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4" dir="rtl" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full sm:max-w-2xl max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#211d45] text-white">
          <h3 className="text-lg font-black">{project ? 'تعديل المشروع' : 'مشروع جديد'}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" aria-label="إغلاق"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative w-full aspect-[16/8] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <ImageOff className="w-10 h-10 text-slate-300" />}
            <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-sm py-2 flex items-center justify-center gap-1.5"><Camera className="w-4 h-4" /> {preview ? 'تغيير الصورة' : 'رفع صورة'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (f) { setImage(f); setPreview(URL.createObjectURL(f)); }
          }} />
          <label className="block"><span className="block text-sm font-bold mb-1.5">اسم المشروع *</span>
            <input value={form.title} onChange={e => set('title', e.target.value)} maxLength={150} className={inputCls} /></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block"><span className="block text-sm font-bold mb-1.5">التصنيف (يظهر كعنوان البطاقة)</span>
              <input value={form.category} onChange={e => set('category', e.target.value)} className={inputCls} placeholder="مثال: المساعدات الإنسانية" /></label>
            <label className="block"><span className="block text-sm font-bold mb-1.5">عنوان فرعي</span>
              <input value={form.subtitle} onChange={e => set('subtitle', e.target.value)} className={inputCls} placeholder="مثال: دعم الأسر المحتاجة" /></label>
          </div>
          <label className="block"><span className="block text-sm font-bold mb-1.5">التفاصيل</span>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} className={inputCls} /></label>
          <label className="block"><span className="block text-sm font-bold mb-1.5">رابط فيديو يوتيوب (اختياري)</span>
            <input value={form.video_url} onChange={e => set('video_url', e.target.value)} dir="ltr" className={inputCls} placeholder="https://youtu.be/..." /></label>
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 font-bold text-sm"><input type="checkbox" checked={form.is_published} onChange={e => set('is_published', e.target.checked)} className="w-4 h-4" /> منشور</label>
            <label className="flex items-center gap-2 font-bold text-sm"><input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} className="w-4 h-4" /> يظهر في «أبرز مشاريعنا»</label>
            <label className="flex items-center gap-2 font-bold text-sm">الترتيب <input type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" /></label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#211d45] flex items-center gap-2 disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ</button>
        </div>
      </motion.div>
    </div>
  );
};

export const ProjectsAdminTab = () => {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setProjects(await adminListProjects()); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'تعذّر التحميل'); setProjects(cur => cur ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const quick = async (p: Project, patch: Partial<Project>, ok: string) => {
    if (busy) return;
    setBusy(p.id);
    try {
      await adminSaveProject(p.id, { title: p.title, subtitle: p.subtitle, category: p.category, description: p.description, video_url: p.video_url, sort_order: p.sort_order, is_published: p.is_published, is_featured: p.is_featured, ...patch });
      toast.success(ok); await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'حدث خطأ'); }
    finally { setBusy(null); }
  };

  const remove = async (p: Project) => {
    if (busy || !window.confirm(`حذف المشروع «${p.title}» نهائياً؟`)) return;
    setBusy(p.id);
    try { await adminDeleteProject(p.id); toast.success('تم حذف المشروع'); await load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'حدث خطأ'); }
    finally { setBusy(null); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2"><FolderHeart className="w-7 h-7 text-pink-500" /> مشاريع الجمعية</h2>
          <p className="text-sm text-slate-500 mt-1">تظهر المشاريع المنشورة في صفحة «مشاريعنا»، والمميزة منها في الصفحة الرئيسية.</p>
        </div>
        <button onClick={() => setEditing(null)} className="px-5 py-2.5 rounded-xl font-bold text-white bg-[#211d45] flex items-center gap-2 self-start"><Plus className="w-5 h-5" /> مشروع جديد</button>
      </div>

      {projects === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-pink-500" /></div>
      ) : projects.length === 0 ? (
        <p className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center font-bold text-slate-500 border border-slate-200 dark:border-slate-800">{error || 'لا توجد مشاريع بعد'}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => (
            <article key={p.id} className={`bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border ${p.is_published ? 'border-slate-200 dark:border-slate-800' : 'border-dashed border-slate-300 opacity-75'}`}>
              <div className="relative aspect-[16/9] bg-slate-100 dark:bg-slate-800">
                {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-8 h-8 text-slate-300" /></div>}
                {p.video_url && <span className="absolute bottom-2 start-2 w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center"><Play className="w-4 h-4" /></span>}
                <div className="absolute top-2 start-2 flex gap-1">
                  {!p.is_published && <span className="px-2 py-0.5 rounded-full bg-slate-800 text-white text-xs font-bold">مخفي</span>}
                  {p.is_featured && <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-xs font-bold">مميز</span>}
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs font-bold text-pink-600">{p.category || '—'}</p>
                <h3 className="font-black text-slate-800 dark:text-white">{p.title}</h3>
                {p.description && <p className="text-sm text-slate-500 line-clamp-2 mt-1">{p.description}</p>}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <button onClick={() => setEditing(p)} className="p-2 rounded-xl bg-indigo-50 text-indigo-700 flex justify-center" title="تعديل" aria-label="تعديل"><Edit2 className="w-4 h-4" /></button>
                  <button disabled={busy === p.id} onClick={() => quick(p, { is_published: !p.is_published }, p.is_published ? 'تم إخفاء المشروع' : 'تم نشر المشروع')} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 flex justify-center" title={p.is_published ? 'إخفاء' : 'نشر'} aria-label={p.is_published ? 'إخفاء' : 'نشر'}>{p.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  <button disabled={busy === p.id} onClick={() => quick(p, { is_featured: !p.is_featured }, p.is_featured ? 'أُزيل من المميزة' : 'أُضيف إلى المميزة')} className={`p-2 rounded-xl flex justify-center ${p.is_featured ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-slate-800'}`} title="مميز" aria-label="مميز"><Star className="w-4 h-4" /></button>
                  <button disabled={busy === p.id} onClick={() => remove(p)} className="p-2 rounded-xl bg-red-50 text-red-600 flex justify-center" title="حذف" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <ProjectForm project={editing} nextOrder={(projects?.length ?? 0) + 1} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); void load(); }} />
      )}
    </motion.div>
  );
};
