import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, TrendingUp, HandHeart, Sparkles } from 'lucide-react';

// Counter Hook
const useCounter = (end: number, duration: number = 2) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);

  return count;
};

export const HomePage = () => {
  const { userProfile, loading } = useAuth();
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';

  const [usersCount, setUsersCount] = useState(0);
  const [settings, setSettings] = useState<any>(null);

  // Fetch data
  useEffect(() => {
    const fetchUsersCount = async () => {
      const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
      if (count !== null) setUsersCount(count);
    };

    const fetchSettings = async () => {
      const { data } = await supabase.from('site_settings').select('value').eq('id', 'donation_section').single();
      if (data) {
        setSettings(data.value);
      }
    };

    fetchUsersCount();
    fetchSettings();

    // Subscriptions
    const usersSub = supabase.channel('public:users_count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, () => {
        setUsersCount(prev => prev + 1);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'users' }, () => {
        setUsersCount(prev => Math.max(0, prev - 1));
      })
      .subscribe();

    const settingsSub = supabase.channel('public:site_settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_settings', filter: "id=eq.donation_section" }, (payload) => {
        setSettings(payload.new.value);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(usersSub);
      supabase.removeChannel(settingsSub);
    };
  }, []);

  const animatedCount = useCounter(usersCount, 2);
  const animatedDonations = useCounter(settings?.total_donations || 0, 2);

  if (loading) return null; // Handled by App.tsx ProtectedRoute

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute top-[20%] left-[-5%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '2s' }} />

      <div className="container-custom max-w-6xl mx-auto pt-32 pb-24 relative z-10 px-4 lg:px-8">
        
        {/* Welcome Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mb-6 font-medium text-sm border border-indigo-100 dark:border-indigo-800/50">
            <Sparkles className="w-4 h-4" />
            {(t as any).homePage?.platform || 'Official Members Platform'}
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-800 dark:text-white mb-6 leading-tight">
            {(t as any).homePage?.welcome || 'Welcome'} <span className="bg-gradient-to-r from-indigo-600 to-teal-500 bg-clip-text text-transparent">{userProfile?.full_name || ''}</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
            {(t as any).homePage?.welcomeDesc || 'We are delighted to have you join us in making an impact and giving. Together we build a supportive and proactive community.'}
          </p>

          {/* Members Counter Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-12 inline-block relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-emerald-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500"></div>
            <div className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 md:p-8 shadow-2xl flex items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div className="text-start">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  {(t as any).homePage?.totalMembers || 'Total Members'}
                </p>
                <div className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <span>+</span>
                  <span>{animatedCount.toLocaleString()}</span>
                  <span className="text-xl md:text-2xl font-bold text-teal-500 mt-2">{(t as any).homePage?.member || 'Member'}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Premium Donations Section */}
        {settings?.is_visible && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="relative rounded-[3rem] overflow-hidden bg-white/40 dark:bg-slate-800/40 backdrop-blur-3xl border border-white/60 dark:border-slate-700/60 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]"
          >
            {/* Background elements inside the card */}
            <div className="absolute top-0 right-0 w-[60%] h-full bg-gradient-to-l from-indigo-50/80 to-transparent dark:from-indigo-900/20 z-0"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-teal-100/50 to-transparent dark:from-teal-900/20 rounded-full blur-3xl z-0 -translate-x-1/2 translate-y-1/2"></div>
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 p-8 md:p-14 lg:p-20 items-center">
              <div>
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-8 transform -rotate-6">
                  <HandHeart className="w-7 h-7 text-white" />
                </div>
                
                <h2 className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white mb-6 leading-tight">
                  {isRTL ? settings.title_ar : (language === 'fr' ? settings.title_fr : settings.title_en || settings.title_fr)}
                </h2>
                
                <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-10">
                  {isRTL ? settings.desc_ar : (language === 'fr' ? settings.desc_fr : settings.desc_en || settings.desc_fr)}
                </p>

                <div className="flex gap-4">
                  <button className="px-8 py-4 bg-slate-800 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-lg hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors shadow-lg shadow-slate-900/20 dark:shadow-white/20">
                    {(t as any).homePage?.contribute || 'Contribute Now'}
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] blur-2xl opacity-20 dark:opacity-40 animate-pulse-slow"></div>
                <div className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-700 shadow-2xl flex flex-col items-center justify-center text-center overflow-hidden group">
                  
                  {/* Decorative corner */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-full blur-2xl opacity-50 group-hover:scale-150 transition-transform duration-700"></div>

                  <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-800">
                    <TrendingUp className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                  </div>

                  <p className="text-lg font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                    {(t as any).homePage?.totalDonations || 'Total Donations'}
                  </p>

                  <div className="flex items-baseline justify-center gap-3">
                    <span className="text-6xl md:text-7xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      {animatedDonations.toLocaleString()}
                    </span>
                    <span className="text-2xl font-bold text-slate-400">MRU</span>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full mt-10 overflow-hidden relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: '75%' }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      viewport={{ once: true }}
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 rtl:left-auto rtl:right-0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
