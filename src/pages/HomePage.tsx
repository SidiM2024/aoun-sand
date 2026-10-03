import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Users, TrendingUp, HandHeart, Sparkles,
  BookOpen, Info, Heart, ArrowLeft, ArrowRight,
  Target, CheckCircle2, Trophy, CreditCard, ChevronLeft, ChevronRight, Vote, MessageCircle, Map, DollarSign, Globe, PlayCircle
} from 'lucide-react';
import { Projects } from '../components/Projects';
import { PollsSection } from '../components/PollsSection';

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
export const HomePage = () => {
  const { userProfile } = useAuth();
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';
  const hp = (t as any).homePage || {};

  const [usersCount, setUsersCount] = useState(0);
  const [settings, setSettings] = useState<any>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  /* ── Fetch accurate user count via RPC (reads auth.users) ── */
  const fetchUsersCount = async () => {
    // Primary: RPC reads directly from auth.users (most accurate)
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_registered_count');
    if (!rpcErr && rpcData !== null) {
      setUsersCount(Number(rpcData));
      return;
    }
    // Fallback: count from public.users
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    if (count !== null) setUsersCount(count);
  };

  /* ── Fetch donation settings ── */
  const fetchSettings = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('id', 'donation_section')
      .maybeSingle();
    if (data?.value) setSettings(data.value);
    else setSettings(null);
    setSettingsLoaded(true);
  };

  useEffect(() => {
    // Initial load
    fetchUsersCount();
    fetchSettings();

    // Periodic refresh — safety net for missed realtime events
    const interval = setInterval(() => {
      fetchUsersCount();
      fetchSettings(); // ✅ also refresh settings so donations always stay current
    }, 30000);

    // Realtime: user joins → re-fetch accurate count from auth.users
    const ch1 = supabase.channel('hp:users:v4')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' },
        () => fetchUsersCount())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'users' },
        () => fetchUsersCount())
      .subscribe();

    // Realtime: donation settings change — always re-fetch for reliability
    // (payload.new only works if REPLICA IDENTITY FULL is set on the table)
    const ch2 = supabase.channel('hp:settings:v5')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'site_settings', filter: 'id=eq.donation_section' },
        () => fetchSettings())
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'site_settings', filter: 'id=eq.donation_section' },
        () => fetchSettings())
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'site_settings', filter: 'id=eq.donation_section' },
        () => { setSettings(null); setSettingsLoaded(true); })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, []);

  const animatedMembers = useCounter(usersCount, 2000);

  // Only show donation section if admin has published public campaigns
  const publicCampaigns = (settings?.campaigns || []).filter((c: any) => c.is_public === true && c.status === 'active');
  const showDonationsSection = settingsLoaded && settings?.is_visible === true && publicCampaigns.length > 0;

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 overflow-x-hidden" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Background Hero & Wave ── */}
      <div aria-hidden className="absolute top-0 left-0 right-0 h-[620px] sm:h-[660px] bg-[#1a1c2e] z-0 overflow-hidden" style={{ background: 'linear-gradient(135deg, #1b1935 0%, #291d38 100%)' }}>
        {/* Soft glows in background */}
        <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 bottom-0 left-0 opacity-20" style={{ backgroundImage: 'url(/Gaza.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
        
        {/* Wave SVG matching the mockup */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-[60px] sm:h-[100px] text-slate-50 dark:text-slate-950 preserve-3d" preserveAspectRatio="none" viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 50C240 100 480 0 720 50C960 100 1200 0 1440 50V100H0V50Z" fill="currentColor" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-44 sm:pt-48 pb-20">
        {/* ═══ HERO TEXT ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="website-hero mb-16 relative flex flex-col items-center sm:items-start text-center sm:text-start"
        >
          <p className="text-sm sm:text-base text-rose-200/90 font-medium mb-1">
            {isRTL ? 'جمعية عون وسند الخيرية ترحب بكم' : 'Aoun & Sanad Charity welcomes you'}
          </p>

          <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight max-w-2xl mb-6">
            {isRTL ? 'معاً نصنع الأمل،' : 'Together, we create hope,'}<br/>
            {isRTL ? 'ونترك أثراً يدوم.' : 'and leave a lasting impact.'}
          </h1>
          <p className="text-white/80 text-base sm:text-lg leading-relaxed max-w-xl mb-8">
            {isRTL 
              ? 'جمعية تطوعية تجمعنا على الخير، ندعم المحتاجين، ونفتح أبواب العلم، ونحول عطائكم إلى مبادرات تمس حياة الناس.' 
              : 'A volunteer association supporting people in need, opening doors to education, and turning your generosity into meaningful action.'}
          </p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-3">
            <Link to="/donate" className="btn bg-rose-200 hover:bg-rose-300 text-slate-900 font-bold px-8 shadow-lg shadow-rose-200/20">
              {isRTL ? 'كن عوناً وسنداً' : 'Make a difference'} <Heart className="w-4 h-4 text-rose-600" />
            </Link>
          </div>
          {userProfile?.full_name && <p className="text-indigo-200 mt-5 font-medium">{isRTL ? 'أهلًا بك، ' : 'Welcome, '}{userProfile.full_name}</p>}
        </motion.section>

        {/* ═══ QUICK LINKS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-12 relative z-20"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { to: '/about', icon: Info, title: isRTL ? 'عن الجمعية' : 'About Us', desc: isRTL ? 'تعرف على رؤيتنا وأهدافنا وقيمنا ورسالتنا' : 'Our vision and mission' },
              { to: '/projects', icon: Heart, title: isRTL ? 'مشاريعنا' : 'Projects', desc: isRTL ? 'مبادرات نوعية تصنع فرقاً في المجتمع' : 'Qualitative initiatives' },
              { to: '/lessons', icon: BookOpen, title: isRTL ? 'الدروس والمحاضرات' : 'Lessons', desc: isRTL ? 'مجتمع معرفي .. لعلم ينتفع به' : 'Knowledge society' },
              { to: '/contact', icon: MessageCircle, title: isRTL ? 'تواصل معنا' : 'Contact Us', desc: isRTL ? 'نحن هنا لخدمتكم واستقبال استفساراتكم' : 'We are here to serve you' },
              { to: '/donate', icon: HandHeart, title: isRTL ? 'التبرع' : 'Donate', desc: isRTL ? 'مساهمتكم يستمر الأثر' : 'Your contribution matters' },
              { to: '/elections', icon: Vote, title: isRTL ? 'الانتخابات' : 'Elections', desc: isRTL ? 'شارك في انتخابات الجمعية' : 'Participate in elections' },
            ].map((link, idx) => (
              <Link key={idx} to={link.to} className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md border border-slate-100 dark:border-slate-700 transition-all flex flex-col items-center text-center group">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <link.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">{link.title}</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mb-3">{link.desc}</p>
                <div className="mt-auto w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-rose-100 group-hover:text-rose-600 transition-colors">
                  {isRTL ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                </div>
              </Link>
            ))}
          </div>
        </motion.section>

        {/* ═══ ELECTIONS SECTION (From Design) ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-12 grid lg:grid-cols-[1fr_400px] gap-6"
        >
          {/* Left Side: Elections Promo */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl p-8 sm:p-12 border border-indigo-100 dark:border-indigo-800/50 flex flex-col justify-center items-center text-center sm:items-start sm:text-start relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-200/40 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
            
            <div className="relative z-10 w-full flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-white shadow-xl flex items-center justify-center shrink-0">
                <Vote className="w-12 h-12 text-indigo-900" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl sm:text-4xl font-black text-indigo-950 dark:text-white mb-4">
                  {isRTL ? 'صفحة الانتخابات' : 'Elections Page'}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-lg mb-8 max-w-md">
                  {isRTL 
                    ? 'شارك في صناعة القرار ودعم مسيرة الجمعية. تظهر جميع الأصوات والمرشحين الذين يتم إضافتهم من قبل الإدارة مباشرة في صفحة الانتخابات.' 
                    : 'Participate in decision making. View all polls and candidates added by the administration directly.'}
                </p>
                <Link to="/elections" className="inline-flex items-center gap-2 bg-indigo-950 hover:bg-indigo-900 text-white px-6 py-3 rounded-xl font-bold transition-colors">
                  {isRTL ? 'الانتقال إلى صفحة الانتخابات' : 'Go to Elections Page'}
                  {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </Link>
              </div>
            </div>
          </div>

          {/* Right Side: Recent Elections List / Polls */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{isRTL ? 'أحدث الانتخابات' : 'Recent Elections'}</h3>
            </div>
            
            {/* Real Polls logic mixed with custom layout */}
            <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: '350px' }}>
               <PollsSection />
            </div>
          </div>
        </motion.section>

        {/* ═══ SECONDARY ACTION BAR ═══ */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 border border-slate-100 dark:border-slate-700 shadow-sm mb-16 flex flex-wrap justify-between items-center gap-4 text-center sm:text-start">
          <div className="flex items-center justify-center gap-2 text-indigo-950 dark:text-white font-bold w-full sm:w-auto">
            <Globe className="w-5 h-5 text-rose-400" />
            <span>{isRTL ? 'مبادرات مستدامة' : 'Sustainable Initiatives'}</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center justify-center gap-2 text-indigo-950 dark:text-white font-bold w-full sm:w-auto">
            <HandHeart className="w-5 h-5 text-rose-400" />
            <span>{isRTL ? 'خدمة المجتمع' : 'Community Service'}</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center justify-center gap-2 text-indigo-950 dark:text-white font-bold w-full sm:w-auto">
            <BookOpen className="w-5 h-5 text-rose-400" />
            <span>{isRTL ? 'نشر العلم' : 'Spreading Knowledge'}</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center justify-center gap-2 text-indigo-950 dark:text-white font-bold w-full sm:w-auto">
            <Users className="w-5 h-5 text-rose-400" />
            <span>{isRTL ? 'دعم المحتاجين' : 'Supporting the Needy'}</span>
          </div>
        </div>

        {/* ═══ DONATION CAMPAIGNS (Preserved) ═══ */}
        <AnimatePresence>
          {showDonationsSection && (
            <motion.div
              key="donation-banner"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-12"
            >
              <DonationBanner
                campaigns={publicCampaigns}
                settings={settings}
                isRTL={isRTL}
                language={language}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <Projects />

      </div>
    </div>
  );
};
