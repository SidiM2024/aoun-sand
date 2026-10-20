import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Users, HandHeart, Heart, ArrowLeft, ArrowRight, Target, CheckCircle2, GraduationCap, HandCoins,
  User, Vote, FileText, ChevronLeft, ChevronRight, TrendingUp, Wallet, BarChart3, Play,
} from 'lucide-react';
import {
  CURRENCY, DEFAULT_HOMEPAGE, fetchHomeStats, fetchHomepageSettings, fetchPublicProjects, formatMoney,
  type HomeStats, type HomepageSettings, type Project,
} from '../lib/siteApi';

/* ── Animated Counter ── */
const useCounter = (target: number, duration = 2000) => {
  const [count, setCount] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setCount(Math.floor(p * target));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);
  return count;
};

/* ── Removed old Quick Links Data ── */

/* ── Campaign Card ── */
const CampaignCard = ({ campaign, isRTL }: { campaign: any; isRTL: boolean }) => {
  const percent = Math.min(100, Math.round((campaign.current_amount / Math.max(campaign.target_amount, 1)) * 100));
  const isComplete = campaign.status === 'completed' || percent >= 100;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="relative bg-white dark:bg-slate-800/80 rounded-3xl p-5 border border-slate-100 dark:border-slate-700 shadow-md hover:shadow-xl transition-all overflow-hidden group"
    >
      {/* Glow top */}
      <div className={`absolute top-0 inset-x-0 h-1 rounded-t-3xl ${isComplete ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} />

      {isComplete && (
        <div className="absolute top-4 end-4">
          <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      )}

      <div className="mb-3 pe-10">
        <h4 className="font-bold text-base text-slate-800 dark:text-white leading-snug mb-1">{campaign.title}</h4>
        {campaign.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{campaign.description}</p>
        )}
      </div>

      {/* Amounts */}
      <div className="flex justify-between items-center text-xs font-bold mb-2" dir="ltr">
        <span className={`text-base font-black ${isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
          {campaign.current_amount.toLocaleString()} <span className="text-xs font-medium text-slate-400">MRO</span>
        </span>
        <span className="text-slate-400 font-medium">
          {isRTL ? 'من' : 'of'} {campaign.target_amount.toLocaleString()} MRO
        </span>
      </div>

      {/* Progress */}
      <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${percent}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.34, 1.56, 0.64, 1] }}
          className={`h-full rounded-full ${isComplete ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Users className="w-3.5 h-3.5" />
          <span>{campaign.donors_count || 0} {isRTL ? 'متبرع' : 'donors'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-black ${isComplete ? 'text-emerald-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
            {percent}%
          </span>
          <Link
            to="/donate"
            className="text-xs font-bold px-3 py-1 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
            onClick={e => e.stopPropagation()}
          >
            {isRTL ? 'تبرع' : 'Donate'}
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Donation Banner (shows when admin publishes campaigns) ── */
const DonationBanner = ({ campaigns, settings, isRTL, language }: { campaigns: any[]; settings: any; isRTL: boolean; language: string }) => {
  const donationRef = useRef(null);
  const isDonationInView = useInView(donationRef, { once: true, margin: '-60px' });
  const totalDonations = settings?.campaigns?.reduce((s: number, c: any) => s + (c.current_amount || 0), 0) || settings?.total_donations || 0;
  const animatedDonations = useCounter(totalDonations, 2500);

  return (
    <motion.section
      ref={donationRef}
      initial={{ opacity: 0, y: 30 }}
      animate={isDonationInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Donations"
      className="mb-10"
    >
      {/* Banner Header */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-rose-500 p-6 sm:p-8 mb-5 shadow-xl shadow-indigo-500/20">
        {/* Animated blobs */}
        <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -start-8 w-32 h-32 rounded-full bg-rose-400/20 blur-xl" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-inner shrink-0">
              <HandHeart className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-white/60 uppercase tracking-widest">
                  {isRTL ? 'حملة التبرعات' : 'Donation Campaign'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-400 text-white px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  {isRTL ? 'نشطة' : 'Live'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                {isRTL
                  ? (settings?.title_ar || 'معاً نصنع الأثر')
                  : (language === 'fr' ? (settings?.title_fr || 'Ensemble') : (settings?.title_en || 'Together We Make an Impact'))}
              </h2>
              {(isRTL ? settings?.desc_ar : language === 'fr' ? settings?.desc_fr : settings?.desc_en) && (
                <p className="text-sm text-white/70 mt-1 leading-relaxed line-clamp-2">
                  {isRTL ? settings?.desc_ar : language === 'fr' ? settings?.desc_fr : settings?.desc_en}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Collected amount */}
            <div className="bg-white/15 backdrop-blur-md rounded-2xl px-4 py-3 text-center border border-white/20">
              <p className="text-xs text-white/60 font-semibold mb-0.5">
                {isRTL ? 'إجمالي التبرعات' : 'Total Collected'}
              </p>
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className="text-2xl font-black text-white tabular-nums">{animatedDonations.toLocaleString()}</span>
                <span className="text-xs font-bold text-white/70">MRO</span>
              </div>
            </div>

            <Link
              to="/donate"
              className="flex items-center gap-2 px-5 py-3.5 bg-white text-indigo-700 hover:bg-indigo-50 active:scale-95 font-black text-sm rounded-2xl shadow-lg transition-all group"
            >
              <Heart className="w-4 h-4 fill-current group-hover:scale-125 transition-transform" />
              {isRTL ? 'تبرع الآن' : 'Donate Now'}
              {isRTL ? <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> : <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </Link>
          </div>
        </div>
      </div>

      {/* Campaign Cards */}
      {campaigns.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Target className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {isRTL ? `حملات التبرع النشطة (${campaigns.length})` : `Active Campaigns (${campaigns.length})`}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map((campaign: any) => (
              <CampaignCard key={campaign.id} campaign={campaign} isRTL={isRTL} />
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
};

/* ── Main Component ── */
const NAVY = '#211d45';

/** Hero slider (content managed from the dashboard → «الصفحة الرئيسية»). */
const HeroSlider = ({ settings, greeting }: { settings: HomepageSettings; greeting: string | null }) => {
  const slides = settings.slides;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => { setIndex(i => (i >= slides.length ? 0 : i)); }, [slides.length]);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setIndex(i => (i + 1) % slides.length), 6500);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  const go = (d: number) => setIndex(i => (i + d + slides.length) % slides.length);
  const slide = slides[index] ?? DEFAULT_HOMEPAGE.slides[0];
  const internal = slide.cta_link?.startsWith('/');

  return (
    <section
      aria-roledescription="carousel"
      aria-label="أبرز رسائل الجمعية"
      className="relative overflow-hidden text-white"
      style={{ background: NAVY }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(dx > 0 ? 1 : -1); // RTL: swipe right = next
        touchX.current = null;
      }}
    >
      {/* Image on the left, fading into navy */}
      <AnimatePresence mode="wait">
        <motion.div key={slide.image_url + index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
          className="absolute inset-y-0 left-0 w-[62%] sm:w-[55%]">
          {slide.image_url && <img src={slide.image_url} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0" style={{ background: `linear-gradient(to left, ${NAVY} 2%, rgba(33,29,69,0.55) 45%, rgba(33,29,69,0.15) 100%)` }} />
        </motion.div>
      </AnimatePresence>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-10 pb-24 sm:pt-16 sm:pb-28 min-h-[440px] sm:min-h-[480px] flex flex-col justify-center" dir="rtl">
        <AnimatePresence mode="wait">
          <motion.div key={index} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.45 }}
            className="max-w-[70%] sm:max-w-md md:max-w-lg ms-0" aria-live="polite">
            {greeting && <p className="text-[#f7b2b0] text-sm font-bold mb-2">{greeting}</p>}
            <p className="text-2xl sm:text-3xl font-medium text-white/95 mb-2">{slide.kicker}</p>
            <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-4">
              {slide.title}{' '}
              <span className="text-[#f7b2b0]">{slide.highlight}</span>
            </h1>
            <p className="text-white/85 text-base sm:text-xl leading-relaxed mb-7">{slide.description}</p>
            {slide.cta_label && (internal ? (
              <Link to={slide.cta_link} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#f7b2b0] text-[#211d45] font-black text-base sm:text-lg shadow-lg shadow-[#f7b2b0]/25 hover:bg-[#fac6c3] active:scale-95 transition-all">
                {slide.cta_label} <Heart className="w-5 h-5" />
              </Link>
            ) : (
              <a href={slide.cta_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#f7b2b0] text-[#211d45] font-black text-base sm:text-lg shadow-lg hover:bg-[#fac6c3] active:scale-95 transition-all">
                {slide.cta_label} <Heart className="w-5 h-5" />
              </a>
            ))}
          </motion.div>
        </AnimatePresence>

        {slides.length > 1 && (
          <div className="absolute bottom-14 sm:bottom-16 inset-x-0 flex items-center justify-center gap-3">
            <button onClick={() => go(-1)} className="hidden sm:flex w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center" aria-label="الشريحة السابقة"><ChevronRight className="w-5 h-5" /></button>
            {slides.map((_, i) => (
              <button key={i} onClick={() => setIndex(i)} aria-label={`الشريحة ${i + 1}`} aria-current={i === index}
                className={`h-3 rounded-full transition-all ${i === index ? 'w-3 bg-[#f7b2b0]' : 'w-3 bg-white/40 hover:bg-white/60'}`} />
            ))}
            <button onClick={() => go(1)} className="hidden sm:flex w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center" aria-label="الشريحة التالية"><ChevronLeft className="w-5 h-5" /></button>
          </div>
        )}
      </div>
    </section>
  );
};

const StatCounter = ({ value }: { value: number }) => {
  const animated = useCounter(value, 1600);
  return <>{formatMoney(animated)}</>;
};

const StatsCard = ({ stats }: { stats: HomeStats | null }) => {
  const items = [
    { icon: Users, value: stats?.members, unit: 'عضو', label: 'في الجمعية', strong: false },
    { icon: GraduationCap, value: stats?.mahaja_students, unit: 'طالب وطالبة', label: 'في معهد المحجة البيضاء', strong: false },
    { icon: HandHeart, value: stats?.donations_total, unit: CURRENCY, label: 'إجمالي التبرعات', strong: true },
    { icon: HandCoins, value: stats?.expenses_total, unit: CURRENCY, label: 'مصاريف التبرعات', strong: true },
  ];
  return (
    <section aria-label="إحصائيات الجمعية" className="relative z-10 -mt-12 sm:-mt-14 mx-3 sm:mx-auto max-w-5xl bg-white dark:bg-slate-900 rounded-[28px] shadow-xl shadow-[#211d45]/10 border border-slate-100 dark:border-slate-800">
      <div className="grid grid-cols-4 divide-x divide-x-reverse divide-slate-100 dark:divide-slate-800 py-5 sm:py-7">
        {items.map(it => (
          <div key={it.label} className="flex flex-col items-center text-center px-1.5 sm:px-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#fde3e1] dark:bg-[#f7b2b0]/15 flex items-center justify-center mb-2 sm:mb-3">
              <it.icon className="w-6 h-6 sm:w-8 sm:h-8 text-[#211d45] dark:text-[#f7b2b0]" />
            </div>
            <p className="text-base sm:text-2xl font-black text-[#211d45] dark:text-white tabular-nums leading-tight" dir="ltr">
              {stats ? <StatCounter value={it.value ?? 0} /> : <span className="inline-block w-12 h-5 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />}
            </p>
            <p className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{it.unit}</p>
            <p className={`text-[10px] sm:text-sm mt-1 leading-tight ${it.strong ? 'font-black text-[#211d45] dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{it.label}</p>
            <span className="mt-2 w-8 h-1 rounded-full bg-[#ef8f88]" />
          </div>
        ))}
      </div>
    </section>
  );
};

const QuickCards = () => {
  const cards = [
    { to: '/account', icon: User, title: 'حسابي', desc: 'إدارة بياناتك ومساهماتك' },
    { to: '/elections', icon: FileText, title: 'الانتخابات', desc: 'شارك في صناعة مستقبل الجمعية' },
    { to: '/projects', icon: HandHeart, title: 'مشاريعنا', desc: 'تعرّف على مبادراتنا وإنجازاتنا' },
    { to: '/about', icon: Users, title: 'عن الجمعية', desc: 'رؤيتنا ورسالتنا وأهدافنا' },
  ];
  return (
    <section aria-label="روابط سريعة" className="grid grid-cols-4 gap-2.5 sm:gap-5">
      {cards.map(c => (
        <Link key={c.to} to={c.to} className="group bg-white dark:bg-slate-900 rounded-3xl p-3 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col items-center text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#fde3e1] dark:bg-[#f7b2b0]/15 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-105 transition-transform">
            <c.icon className="w-6 h-6 sm:w-8 sm:h-8 text-[#211d45] dark:text-[#f7b2b0]" />
          </div>
          <h3 className="font-black text-sm sm:text-lg text-[#211d45] dark:text-white">{c.title}</h3>
          <p className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 leading-snug mt-1">{c.desc}</p>
        </Link>
      ))}
    </section>
  );
};

const SectionTitle = ({ title, action }: { title: string; action?: { to: string; label: string } }) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-xl sm:text-2xl font-black text-[#211d45] dark:text-white flex items-center gap-2">
      <span className="w-1.5 h-7 rounded-full bg-[#ef8f88]" /> {title}
    </h2>
    {action && (
      <Link to={action.to} className="flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-[#211d45] dark:border-slate-600 text-[#211d45] dark:text-white text-sm font-bold hover:bg-[#211d45] hover:text-white transition-colors">
        {action.label} <ChevronLeft className="w-4 h-4" />
      </Link>
    )}
  </div>
);

const useFavorites = () => {
  const [fav, setFav] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('fav_projects') || '[]'); } catch { return []; }
  });
  const toggle = (id: string) => setFav(f => {
    const next = f.includes(id) ? f.filter(x => x !== id) : [...f, id];
    try { localStorage.setItem('fav_projects', JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  return { fav, toggle };
};

export const ProjectCard = ({ project, liked, onLike }: { project: Project; liked: boolean; onLike: () => void }) => (
  <article className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow flex flex-col h-full">
    <Link to={`/projects#${project.id}`} className="relative block aspect-[16/10] bg-slate-100 dark:bg-slate-800 overflow-hidden">
      {project.image_url
        ? <img src={project.image_url} alt={project.title} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
        : <div className="w-full h-full flex items-center justify-center"><HandHeart className="w-10 h-10 text-slate-300" /></div>}
      {project.video_url && <span className="absolute bottom-2 start-2 w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center"><Play className="w-4 h-4" /></span>}
    </Link>
    <div className="p-3.5 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="font-black text-[#211d45] dark:text-white text-sm sm:text-base leading-snug">{project.category || project.title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{project.category ? project.title : project.subtitle}</p>
      </div>
      <button onClick={onLike} aria-pressed={liked} aria-label={liked ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${liked ? 'bg-[#ef8f88] text-white' : 'bg-[#fde3e1] text-[#e2706a] hover:bg-[#fbd0cc]'}`}>
        <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
      </button>
    </div>
  </article>
);

const Transparency = ({ stats, settings }: { stats: HomeStats | null; settings: HomepageSettings }) => {
  const tiles = [
    { label: 'إجمالي التبرعات', value: stats?.donations_total, icon: HandHeart, box: 'bg-[#eef3ff] border-[#dbe4fb]', iconBg: 'bg-[#dbe6ff] text-[#211d45]', text: 'text-[#211d45]' },
    { label: 'إجمالي المصروفات', value: stats?.expenses_total, icon: TrendingUp, box: 'bg-white border-[#f6d6d3]', iconBg: 'bg-[#fde3e1] text-[#e2504a]', text: 'text-[#211d45]' },
    { label: 'الرصيد المتبقي', value: stats?.balance, icon: Wallet, box: 'bg-[#eaf8ef] border-[#cdeedb]', iconBg: 'bg-[#cfeedd] text-[#13834b]', text: 'text-[#13834b]' },
  ];
  return (
    <section aria-label={settings.transparency_title} className="rounded-[28px] bg-[#fde8e6] dark:bg-[#f7b2b0]/10 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#211d45] dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#ef8f88]" /> {settings.transparency_title}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{settings.transparency_subtitle}</p>
        </div>
        <Link to="/donation-expenses" className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-[#211d45] dark:border-slate-500 text-[#211d45] dark:text-white text-sm font-bold hover:bg-[#211d45] hover:text-white transition-colors">
          تفاصيل أكثر <ChevronLeft className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {tiles.map(t => (
          <div key={t.label} className={`rounded-2xl border p-3 sm:p-4 ${t.box} dark:bg-slate-900 dark:border-slate-800`}>
            <div className="flex flex-col sm:flex-row-reverse sm:items-center sm:justify-between gap-2">
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0 ${t.iconBg}`}><t.icon className="w-5 h-5 sm:w-7 sm:h-7" /></div>
              <div className="min-w-0">
                <p className={`text-sm sm:text-2xl font-black tabular-nums ${t.text} dark:text-white`} dir="ltr" style={{ textAlign: 'right' }}>
                  {stats ? <StatCounter value={t.value ?? 0} /> : '—'}
                </p>
                <p className="text-[10px] sm:text-xs text-slate-500">{CURRENCY}</p>
              </div>
            </div>
            <p className={`mt-2 text-xs sm:text-base font-black ${t.text} dark:text-white`}>{t.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export const HomePage = () => {
  const { userProfile } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [stats, setStats] = useState<HomeStats | null>(null);
  const [home, setHome] = useState<HomepageSettings>(DEFAULT_HOMEPAGE);
  const [projects, setProjects] = useState<Project[]>([]);
   
  const [settings, setSettings] = useState<any>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const { fav, toggle } = useFavorites();

  const loadStats = useCallback(async () => { const s = await fetchHomeStats(); if (s) setStats(s); }, []);

  /* ── Donation campaigns settings (existing feature) ── */
  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('id', 'donation_section').maybeSingle();
    setSettings(data?.value ?? null);
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    void loadStats();
    void fetchSettings();
    void fetchHomepageSettings().then(setHome);
    void fetchPublicProjects().then(setProjects);

    // Live figures: refresh on a timer, when the tab regains focus and on realtime changes.
    const interval = setInterval(() => { void loadStats(); void fetchSettings(); }, 60000);
    const onFocus = () => { void loadStats(); };
    window.addEventListener('focus', onFocus);
    const channel = supabase.channel('home:live:v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => void loadStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donation_revenues' }, () => void loadStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donation_expenses' }, () => void loadStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => { void fetchSettings(); void fetchHomepageSettings().then(setHome); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => void fetchPublicProjects().then(setProjects))
      .subscribe();
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); void supabase.removeChannel(channel); };
  }, [loadStats, fetchSettings]);

   
  const publicCampaigns = (settings?.campaigns || []).filter((c: any) => c.is_public === true && c.status === 'active');
  const showDonationsSection = home.show_campaigns && settingsLoaded && settings?.is_visible === true && publicCampaigns.length > 0;
  const featured = projects.filter(p => p.is_featured).slice(0, 8);
  const greeting = userProfile?.full_name ? `أهلاً بك، ${userProfile.full_name.split(' ')[0]}` : null;

  return (
    <div className="relative min-h-screen bg-[#f7f6fb] dark:bg-slate-950 overflow-x-hidden pt-[calc(76px+env(safe-area-inset-top))]" dir="rtl">
      <HeroSlider settings={home} greeting={greeting} />

      {home.show_stats && <StatsCard stats={stats} />}

      <div className={`max-w-5xl mx-auto px-3 sm:px-6 pb-10 space-y-8 ${home.show_stats ? 'mt-6' : 'mt-8'}`}>
        <QuickCards />

        {home.show_projects && featured.length > 0 && (
          <section aria-label="أبرز مشاريعنا">
            <SectionTitle title="أبرز مشاريعنا" action={{ to: '/projects', label: 'عرض الكل' }} />
            <div className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible">
              {featured.map(p => (
                <div key={p.id} className="snap-start shrink-0 w-[64%] sm:w-auto">
                  <ProjectCard project={p} liked={fav.includes(p.id)} onLike={() => toggle(p.id)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {home.show_transparency && <Transparency stats={stats} settings={home} />}

        {/* ═══ DONATION CAMPAIGNS (existing feature) ═══ */}
        <AnimatePresence>
          {showDonationsSection && (
            <motion.div key="donation-banner" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.5 }}>
              <DonationBanner campaigns={publicCampaigns} settings={settings} isRTL={isRTL} language={language} />
            </motion.div>
          )}
        </AnimatePresence>

        <Link to="/elections" className="flex items-center gap-4 p-4 sm:p-5 rounded-3xl bg-[#211d45] text-white hover:bg-[#2c2760] transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-[#f7b2b0] text-[#211d45] flex items-center justify-center shrink-0"><Vote className="w-6 h-6" /></div>
          <div className="flex-1">
            <p className="font-black text-lg">الانتخابات الإلكترونية</p>
            <p className="text-sm text-white/70">صوتك سري ومحمي، ومرة واحدة لكل اقتراع.</p>
          </div>
          {isRTL ? <ArrowLeft className="w-5 h-5 text-[#f7b2b0]" /> : <ArrowRight className="w-5 h-5 text-[#f7b2b0]" />}
        </Link>
      </div>
    </div>
  );
};
