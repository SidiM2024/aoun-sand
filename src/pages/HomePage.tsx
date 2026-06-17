import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Users, TrendingUp, HandHeart, Sparkles,
  BookOpen, Video, Info, Heart, ArrowLeft, ArrowRight,
  Target, CheckCircle2, Bell, Receipt
} from 'lucide-react';
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

/* ── Quick Links Data ── */
const getQuickLinks = (isRTL: boolean, lang: string) => [
  { path: '/about',              label: isRTL ? 'من نحن'              : (lang === 'fr' ? 'À propos'      : 'About Us'),              icon: Info,     bg: 'bg-blue-50 dark:bg-blue-900/20',    color: 'text-blue-500'   },
  { path: '/donate',             label: isRTL ? 'تبرع الآن'          : (lang === 'fr' ? 'Faire un don'  : 'Donate Now'),            icon: Heart,    bg: 'bg-rose-50 dark:bg-rose-900/20',    color: 'text-rose-500'   },
  { path: '/donation-expenses',  label: isRTL ? 'مصاريف التبرعات'   : (lang === 'fr' ? 'Dépenses'      : 'Donation Expenses'),     icon: Receipt,  bg: 'bg-amber-50 dark:bg-amber-900/20',  color: 'text-amber-500'  },
  { path: '/contact',            label: isRTL ? 'اتصل بنا'          : (lang === 'fr' ? 'Contact'        : 'Contact Us'),            icon: Info,     bg: 'bg-cyan-50 dark:bg-cyan-900/20',    color: 'text-cyan-500'   },
];

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
  const quickLinks = getQuickLinks(isRTL, language);

  // Only show donation section if admin has published public campaigns
  const publicCampaigns = (settings?.campaigns || []).filter((c: any) => c.is_public === true && c.status === 'active');
  const showDonationsSection = settingsLoaded && settings?.is_visible === true && publicCampaigns.length > 0;

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 overflow-x-hidden" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Background ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-indigo-400/10 dark:bg-indigo-500/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] rounded-full bg-teal-400/10 dark:bg-teal-500/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 w-[300px] h-[300px] rounded-full bg-purple-400/10 dark:bg-purple-500/10 blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-20">

        {/* ═══ HERO ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 text-sm font-semibold mb-5 select-none">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{hp.platform || 'Official Members Platform'}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-800 dark:text-white leading-tight mb-4">
            {hp.welcome || 'Welcome'}{' '}
            {userProfile?.full_name && (
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-500 bg-clip-text text-transparent">
                {userProfile.full_name}
              </span>
            )}
          </h1>

          <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            {hp.welcomeDesc || 'We are delighted to have you join us in making an impact and giving.'}
          </p>

          {/* ── User Counter Card ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="inline-block mt-10 relative group"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-teal-400 to-emerald-500 blur-xl opacity-25 group-hover:opacity-40 transition-opacity duration-500" />
            <div className="relative flex items-center gap-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/60 dark:border-slate-700/60 rounded-3xl px-6 py-5 shadow-2xl">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div className="text-start">
                {/* ✅ Updated label as per requirement */}
                <p className="text-xs sm:text-sm font-bold text-slate-400 mb-1 leading-snug">
                  {isRTL ? 'عدد المسجلين في الجمعية' : (language === 'fr' ? 'Membres inscrits' : 'Registered Members')}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-black text-slate-800 dark:text-white tabular-nums">
                    +{animatedMembers.toLocaleString()}
                  </span>
                  <span className="text-lg font-bold text-teal-500">
                    {isRTL ? 'عضو' : (language === 'fr' ? 'membre' : 'Member')}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* ═══ DONATION CAMPAIGNS (above Quick Links — shown only when admin publishes) ═══ */}
        <AnimatePresence>
          {showDonationsSection && (
            <motion.div
              key="donation-banner"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5 }}
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

        {/* ═══ QUICK LINKS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="mb-14"
          aria-label="Quick Links"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-slate-700 dark:text-slate-200 mb-6 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            {isRTL ? 'روابط سريعة' : (language === 'fr' ? 'Liens rapides' : 'Quick Links')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {quickLinks.map((lnk, i) => (
              <motion.div key={lnk.path} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.07 }}>
                <Link to={lnk.path} id={`quick-link-${lnk.path.replace('/', '')}`}
                  className="flex flex-col items-center justify-center p-4 sm:p-5 bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:-translate-y-1 active:scale-95 transition-all duration-200 group text-center gap-3">
                  <div className={`w-11 h-11 rounded-xl sm:rounded-2xl ${lnk.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <lnk.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${lnk.color}`} />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight">{lnk.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══ POLLS ═══ */}
        <PollsSection />

      </div>
    </div>
  );
};
