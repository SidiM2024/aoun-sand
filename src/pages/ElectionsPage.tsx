import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { PollsSection } from '../components/PollsSection';
import { Shield } from 'lucide-react';

export const ElectionsPage = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-24 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container-custom max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mb-6 shadow-sm">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-800 dark:text-white mb-4">
            {isRTL ? 'الانتخابات والتصويت' : 'Elections & Voting'}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {isRTL 
              ? 'شارك في صناعة القرار ودعم مسيرة الجمعية من خلال التصويت في الانتخابات والاستطلاعات المتاحة.' 
              : 'Participate in decision-making and support the association by voting in available elections and polls.'}
          </p>
        </div>

        <PollsSection />
      </div>
    </div>
  );
};
