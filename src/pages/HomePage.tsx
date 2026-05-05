import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Users, TrendingUp, HandHeart, Sparkles,
  BookOpen, Video, Info, Heart, ArrowLeft, ArrowRight,
  Target, CheckCircle2
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
  { path: '/about',      label: isRTL ? 'من نحن'   : (lang === 'fr' ? 'À propos' : 'About Us'),    icon: Info,     bg: 'bg-blue-50 dark:bg-blue-900/20',    color: 'text-blue-500'   },
  { path: '/lessons',    label: isRTL ? 'الدروس'   : (lang === 'fr' ? 'Cours'    : 'Lessons'),     icon: BookOpen, bg: 'bg-teal-50 dark:bg-teal-900/20',    color: 'text-teal-500'   },
  { path: '/volunteer',  label: isRTL ? 'التطوع'   : (lang === 'fr' ? 'Bénévolat': 'Volunteer'),   icon: Users,    bg: 'bg-purple-50 dark:bg-purple-900/20', color: 'text-purple-500' },
  { path: '/donate',     label: isRTL ? 'تبرع الآن': (lang === 'fr' ? 'Faire un don':'Donate Now'),icon: Heart,    bg: 'bg-rose-50 dark:bg-rose-900/20',    color: 'text-rose-500'   },
  { path: '/membership', label: isRTL ? 'الانتساب' : (lang === 'fr' ? 'Adhésion' : 'Membership'),  icon: Video,    bg: 'bg-amber-50 dark:bg-amber-900/20',  color: 'text-amber-500'  },
  { path: '/contact',    label: isRTL ? 'اتصل بنا' : (lang === 'fr' ? 'Contact'  : 'Contact Us'),  icon: Info,     bg: 'bg-cyan-50 dark:bg-cyan-900/20',    color: 'text-cyan-500'   },
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
      whileHover={{ y: -4 }}
      className="relative bg-white dark:bg-slate-800/80 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-md hover:shadow-xl transition-all overflow-hidden group"
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

      <div className="mb-4 pe-10">
        <h4 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white leading-snug mb-1.5">{campaign.title}</h4>
        {campaign.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{campaign.description}</p>
        )}
      </div>

      {/* Amounts */}
      <div className="flex justify-between items-center text-xs font-bold mb-2" dir="ltr">
        <span className={`text-base font-black ${isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
          {campaign.current_amount.toLocaleString()} <span className="text-xs font-medium text-slate-400">MRU</span>
        </span>
        <span className="text-slate-400 font-medium">
          {isRTL ? 'من' : 'of'} {campaign.target_amount.toLocaleString()} MRU
        </span>
      </div>

      {/* Progress */}
      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
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
        <span className={`text-sm font-black ${isComplete ? 'text-emerald-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
          {percent}%
        </span>
      </div>

      {/* Clickable overlay */}
      <Link to="/donate" className="absolute inset-0 z-10" aria-label={`Donate to ${campaign.title}`} />
    </motion.div>
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

  const donationRef = useRef(null);
  const isDonationInView = useInView(donationRef, { once: true, margin: '-100px' });

  /* ── Fetch & Realtime ── */
  useEffect(() => {
    const fetchAll = async () => {
      // Users count
      const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
      if (count !== null) setUsersCount(count);

      // Donation settings — fetch the whole row not just value to handle null
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('id', 'donation_section')
        .maybeSingle(); // maybeSingle doesn't throw if row missing
      if (data?.value) setSettings(data.value);
      setSettingsLoaded(true);
    };

    fetchAll();

    const ch1 = supabase.channel('hp:users')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, () => setUsersCount(p => p + 1))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'users' }, () => setUsersCount(p => Math.max(0, p - 1)))
      .subscribe();

    // Listen to ALL events on site_settings (INSERT + UPDATE)
    const ch2 = supabase.channel('hp:settings:v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings', filter: 'id=eq.donation_section' },
        (payload) => {
          if (payload.new && (payload.new as any).value) {
            setSettings((payload.new as any).value);
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);

  const animatedMembers = useCounter(usersCount, 2000);
  const totalDonations = settings?.campaigns?.reduce((s: number, c: any) => s + (c.current_amount || 0), 0) || settings?.total_donations || 0;
  const animatedDonations = useCounter(totalDonations, 2500);
  const quickLinks = getQuickLinks(isRTL, language);
  const publicCampaigns = (settings?.campaigns || []).filter((c: any) => c.is_public === true);
  const showDonationsSection = settingsLoaded && (settings?.is_visible !== false);

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
          className="text-center mb-14"
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

          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35, duration: 0.5 }} className="inline-block mt-10 relative group">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-teal-400 to-emerald-500 blur-xl opacity-25 group-hover:opacity-40 transition-opacity duration-500" />
            <div className="relative flex items-center gap-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/60 dark:border-slate-700/60 rounded-3xl px-6 py-5 shadow-2xl">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div className="text-start">
                <p className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-widest mb-1">{hp.totalMembers || 'Total Members'}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-black text-slate-800 dark:text-white tabular-nums">+{animatedMembers.toLocaleString()}</span>
                  <span className="text-lg font-bold text-teal-500">{hp.member || 'Member'}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* ═══ QUICK LINKS ═══ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }} className="mb-14" aria-label="Quick Links">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-700 dark:text-slate-200 mb-6 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            {isRTL ? 'روابط سريعة' : (language === 'fr' ? 'Liens rapides' : 'Quick Links')}
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
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

        {/* ═══ DONATIONS SECTION ═══ */}
        {showDonationsSection && (
          <motion.section
            ref={donationRef}
            initial={{ opacity: 0, y: 40 }}
            animate={isDonationInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Donations"
            className="relative rounded-[2rem] sm:rounded-[3rem] overflow-hidden bg-white/50 dark:bg-slate-800/50 backdrop-blur-2xl border border-white/70 dark:border-slate-700/60 shadow-[0_12px_48px_-12px_rgba(99,102,241,0.15)] dark:shadow-[0_12px_48px_-12px_rgba(0,0,0,0.5)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-teal-50/30 dark:from-indigo-900/20 dark:to-teal-900/10 pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-0">
              {/* Info */}
              <div className="p-8 sm:p-10 lg:p-14 flex flex-col justify-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6 -rotate-6">
                  <HandHeart className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-slate-800 dark:text-white mb-4 leading-tight">
                  {isRTL ? (settings?.title_ar || 'معاً نصنع الأثر') : (language === 'fr' ? (settings?.title_fr || 'Ensemble') : (settings?.title_en || 'Together We Make an Impact'))}
                </h2>
                <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
                  {isRTL ? (settings?.desc_ar || 'بفضل مساهماتكم نستمر في خدمة المجتمع') : (language === 'fr' ? (settings?.desc_fr || '') : (settings?.desc_en || ''))}
                </p>
                <Link to="/donate" className="inline-flex items-center gap-2 self-start px-7 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-95 text-white rounded-2xl font-bold text-base shadow-lg shadow-indigo-500/30 transition-all duration-200 group">
                  {hp.contribute || 'Contribute Now'}
                  {isRTL ? <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> : <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </Link>
              </div>

              {/* Counter */}
              <div className="p-8 sm:p-10 lg:p-14 flex items-center justify-center border-t lg:border-t-0 border-s-0 lg:border-s border-slate-100/70 dark:border-slate-700/50">
                <div className="relative w-full max-w-xs">
                  <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 blur-2xl opacity-15 dark:opacity-30" />
                  <div className="relative bg-white dark:bg-slate-800 rounded-[2rem] p-8 sm:p-10 border border-slate-100 dark:border-slate-700 shadow-2xl flex flex-col items-center text-center overflow-hidden">
                    <div className="absolute -top-10 -end-10 w-28 h-28 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-full blur-2xl opacity-40" />
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-50 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mb-5 border border-indigo-100 dark:border-indigo-800 relative z-10">
                      <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 relative z-10">{hp.totalDonations || 'Total Donations'}</p>
                    <div className="flex items-baseline gap-2 relative z-10 mb-6">
                      <span className="text-4xl sm:text-5xl md:text-6xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent tabular-nums">{animatedDonations.toLocaleString()}</span>
                      <span className="text-lg sm:text-xl font-bold text-slate-400">MRU</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden relative z-10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={isDonationInView ? { width: `${totalDonations > 0 ? Math.min(100, (totalDonations / 500000) * 100) : 5}%` } : {}}
                        transition={{ duration: 1.8, ease: 'easeOut', delay: 0.3 }}
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaigns */}
            <AnimatePresence>
              {publicCampaigns.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="border-t border-slate-100/70 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 p-6 sm:p-8 lg:p-10"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                      <Target className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                      {isRTL ? `حملات التبرع النشطة (${publicCampaigns.length})` : `Active Campaigns (${publicCampaigns.length})`}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {publicCampaigns.map((campaign: any) => (
                      <CampaignCard key={campaign.id} campaign={campaign} isRTL={isRTL} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

      </div>
    </div>
  );
};
