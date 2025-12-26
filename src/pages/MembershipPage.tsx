import { Users, CreditCard, Star, Phone } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const MembershipPage = () => {
  const { language } = useLanguage();

  return (
    <div className="pt-24 pb-16 min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="container-custom">

        {/* Header Section */}
        <div className="text-center mb-12 animate-fadeIn">
          <h1 className="section-title mb-4">
            {language === 'ar' ? 'صفحة الانتساب' : 'Membership Page'}
          </h1>
          <p className="section-subtitle max-w-2xl mx-auto">
            {language === 'ar'
              ? 'انضم إلينا الآن وكن شريكاً في الخير والعطاء'
              : 'Join us now and be a partner in giving and goodness'}
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-16">

          {/* Section 1: Google Form Embed (First Element) */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden animate-slideUp border border-slate-100 dark:border-slate-700">
            <div className="relative w-full h-[1400px] md:h-[1300px]">
              <iframe
                src="https://docs.google.com/forms/d/e/1FAIpQLSe68xfuS3BNgHDJjWsd8Lr-CXm69EE4cyknp0uqRNkfU6p5_w/viewform?embedded=true"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                title="Membership Form"
                className="absolute inset-0 w-full h-full"
              >
                Loading…
              </iframe>
            </div>
          </div>

          {/* Section 2: Monthly Fee Payment (Second Element) */}
          <div className="animate-slideUp animation-delay-200">
            <div className="bg-gradient-to-br from-teal-600 to-cyan-700 rounded-3xl p-8 md:p-12 text-white shadow-2xl relative overflow-hidden group text-center">
              {/* Decorative Background Circles */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-900/20 rounded-full translate-y-16 -translate-x-16 blur-2xl"></div>

              <div className="relative z-10 max-w-2xl mx-auto">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm mx-auto">
                  <CreditCard className="w-10 h-10 text-white" />
                </div>

                <h2 className="text-3xl font-bold mb-4">
                  {language === 'ar' ? 'دفع الرسوم الشهرية' : 'Monthly Fee Payment'}
                </h2>

                <p className="text-teal-100 text-lg mb-8 leading-relaxed">
                  {language === 'ar'
                    ? 'مساهمتك الشهرية تضمن استمرار أنشطتنا وتساعد في وصول الخير لأكبر عدد من المستفيدين.'
                    : 'Your monthly contribution ensures the continuity of our activities and helps reach more beneficiaries.'}
                </p>

                <div className="space-y-4 mb-8 flex flex-col items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full"><Star className="w-5 h-5" /></div>
                    <span className="text-lg">{language === 'ar' ? 'دعم مستمر للمشاريع الخيرية' : 'Continuous support for charity projects'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full"><Users className="w-5 h-5" /></div>
                    <span className="text-lg">{language === 'ar' ? 'عضوية فاعلة في المجتمع' : 'Active membership in the community'}</span>
                  </div>
                </div>

                <div className="bg-white/10 rounded-2xl p-8 backdrop-blur-md border border-white/20 inline-block w-full max-w-md hover:bg-white/15 transition-colors">
                  <p className="text-teal-200 mb-2 font-medium">{language === 'ar' ? 'للإستفسار أو الدفع يرجى التواصل على:' : 'For inquiries or payment please contact:'}</p>
                  <p className="text-4xl font-bold font-mono tracking-wider flex items-center justify-center gap-3">
                    <Phone className="w-8 h-8" />
                    32203250
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
