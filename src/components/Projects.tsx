import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HandHeart, Heart, Play, X, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { fetchPublicProjects, toEmbedUrl, type Project } from '../lib/siteApi';

// Projects managed from the dashboard (لوحة التحكم ← المشاريع).
export const Projects = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [category, setCategory] = useState('all');
  const [open, setOpen] = useState<Project | null>(null);
  const [fav, setFav] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('fav_projects') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    void fetchPublicProjects().then(setProjects);
    const ch = supabase.channel('projects:page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => void fetchPublicProjects().then(setProjects))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  // Open a project linked from the homepage (/projects#<id>).
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id && projects) setOpen(projects.find(p => p.id === id) ?? null);
  }, [projects]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toggleFav = (id: string) => setFav(f => {
    const next = f.includes(id) ? f.filter(x => x !== id) : [...f, id];
    try { localStorage.setItem('fav_projects', JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  const categories = useMemo(() => [...new Set((projects ?? []).map(p => p.category).filter(Boolean))] as string[], [projects]);
  const visible = (projects ?? []).filter(p => category === 'all' || p.category === category);
  const embed = toEmbedUrl(open?.video_url);

  return (
    <section id="projects" className="pb-12 bg-[#f7f6fb] dark:bg-slate-950 min-h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-[#211d45] text-white px-5 pt-8 pb-16 rounded-b-[32px]">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-3"><HandHeart className="w-8 h-8 text-[#f7b2b0]" /> {isRTL ? 'مشاريعنا' : 'Our projects'}</h1>
          <p className="text-white/75 mt-2 max-w-xl">{isRTL ? 'مبادرات الجمعية في سقيا الماء والمساعدات الإنسانية ودعم التعليم والخدمات المجتمعية.' : 'Our initiatives in water, aid, education and community service.'}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-8">
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-2">
            {['all', ...categories].map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold shadow-sm transition-colors ${category === c ? 'bg-[#f7b2b0] text-[#211d45]' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}>
                {c === 'all' ? (isRTL ? 'الكل' : 'All') : c}
              </button>
            ))}
          </div>
        )}

        {projects === null ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-[#ef8f88]" /></div>
        ) : visible.length === 0 ? (
          <p className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center text-slate-500 font-bold">{isRTL ? 'لا توجد مشاريع منشورة حالياً' : 'No projects yet'}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {visible.map(p => (
              <article key={p.id} id={p.id} className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow flex flex-col">
                <button onClick={() => setOpen(p)} className="relative aspect-[16/10] bg-slate-100 dark:bg-slate-800 overflow-hidden text-start" aria-label={p.title}>
                  {p.image_url ? <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center"><HandHeart className="w-12 h-12 text-slate-300" /></div>}
                  {p.video_url && <span className="absolute inset-0 flex items-center justify-center"><span className="w-14 h-14 rounded-full bg-black/55 text-white flex items-center justify-center"><Play className="w-6 h-6 ms-1" /></span></span>}
                  {p.category && <span className="absolute top-3 start-3 px-3 py-1 rounded-full bg-white/90 text-[#211d45] text-xs font-bold">{p.category}</span>}
                </button>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-black text-lg text-[#211d45] dark:text-white leading-snug">{p.title}</h2>
                    <button onClick={() => toggleFav(p.id)} aria-pressed={fav.includes(p.id)} aria-label={isRTL ? 'المفضلة' : 'Favorite'}
                      className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${fav.includes(p.id) ? 'bg-[#ef8f88] text-white' : 'bg-[#fde3e1] text-[#e2706a]'}`}>
                      <Heart className={`w-5 h-5 ${fav.includes(p.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                  {p.subtitle && <p className="text-sm text-[#e2706a] font-bold mt-0.5">{p.subtitle}</p>}
                  {p.description && <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed line-clamp-3">{p.description}</p>}
                  <button onClick={() => setOpen(p)} className="mt-auto pt-4 text-sm font-black text-[#211d45] dark:text-[#f7b2b0] self-start">{isRTL ? 'عرض التفاصيل ←' : 'Details →'}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-4" onClick={() => setOpen(null)}>
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} onClick={e => e.stopPropagation()}
              className="relative w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-label={open.title}>
              <button onClick={() => setOpen(null)} className="absolute top-3 end-3 z-10 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center" aria-label={isRTL ? 'إغلاق' : 'Close'}><X className="w-5 h-5" /></button>
              <div className="aspect-video bg-black">
                {embed ? <iframe src={embed} title={open.title} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  : open.image_url ? <img src={open.image_url} alt="" className="w-full h-full object-cover" /> : null}
              </div>
              <div className="p-5 sm:p-6">
                {open.category && <span className="inline-block px-3 py-1 rounded-full bg-[#fde3e1] text-[#211d45] text-xs font-bold mb-2">{open.category}</span>}
                <h2 className="text-2xl font-black text-[#211d45] dark:text-white">{open.title}</h2>
                {open.subtitle && <p className="text-[#e2706a] font-bold mt-1">{open.subtitle}</p>}
                {open.description && <p className="text-slate-600 dark:text-slate-300 mt-3 leading-relaxed whitespace-pre-wrap">{open.description}</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};
