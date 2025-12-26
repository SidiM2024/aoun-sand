import { Heart, Users, Video, Calendar, Wallet, Info, ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useState } from 'react';

export const Hero = () => {
  const { t, language } = useLanguage();
  const [showVideo, setShowVideo] = useState(false);

  return (
    <section
      id="home"
      className="relative pt-32 pb-20 bg-slate-50 dark:bg-slate-900 transition-colors duration-300 overflow-hidden"
    >
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-float animation-delay-500"></div>
      </div>

      <div className="container-custom relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Title & Subtitle */}
          <div className="mb-12 animate-fadeIn">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 dark:from-teal-400 dark:via-cyan-400 dark:to-blue-400 bg-clip-text text-transparent leading-tight">
              {t.hero.title}
            </h1>

            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-8 leading-relaxed max-w-3xl mx-auto">
              {t.hero.subtitle}
            </p>

            {/* License & Date */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-10 bg-white/50 dark:bg-slate-800/50 inline-flex px-6 py-2 rounded-full backdrop-blur-sm border border-slate-200 dark:border-slate-700">
              <span className="font-semibold">{t.hero.license}</span>
              <span className="hidden sm:inline">•</span>
              <span>{t.hero.date}</span>
            </div>
          </div>

          {/* New "Al-Mahajja Al-Baida" Button */}
          <div className="mb-8 animate-slideUp">
            <Link
              to="/lessons"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <BookOpen className="w-8 h-8 group-hover:scale-110 transition-transform" />
              <span className="text-xl md:text-2xl font-bold">
                {language === 'ar' ? 'المحجة البيضاء' : 'The White Path'}
              </span>
            </Link>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16 animate-slideUp animation-delay-200">
            <Link to="/donate" className="btn-primary group">
              <Heart className="w-5 h-5 group-hover:animate-pulse" />
              <span>{language === 'ar' ? 'تبرع الآن' : 'Donate Now'}</span>
            </Link>

            <Link to="/membership" className="btn-secondary group">
              <Users className="w-5 h-5" />
              <span>{language === 'ar' ? 'الانتساب' : 'Membership'}</span>
            </Link>

            <Link to="/about" className="btn-outline group">
              <Info className="w-5 h-5" />
              <span>{language === 'ar' ? 'تعرف علينا' : 'About Us'}</span>
            </Link>
          </div>

          {/* Video Section */}
          <div className="max-w-3xl mx-auto relative mb-20 animate-slideUp animation-delay-300">
            {!showVideo ? (
              <div
                className="relative rounded-2xl overflow-hidden shadow-2xl cursor-pointer group aspect-video border-4 border-white dark:border-slate-800"
                onClick={() => setShowVideo(true)}
              >
                <img
                  src="https://img.youtube.com/vi/Q0jCQP8YveY/maxresdefault.jpg"
                  alt="Intro Video"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="w-20 h-20 bg-white/90 text-teal-600 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-all duration-300">
                    <Video className="w-8 h-8 fill-current ml-1" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-video border-4 border-white dark:border-slate-800">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/Q0jCQP8YveY?autoplay=1&rel=0"
                  title="Intro Video"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
                <button
                  onClick={() => setShowVideo(false)}
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Gaza Donation Callout */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 mb-20 border border-slate-100 dark:border-slate-700 animate-slideUp animation-delay-400">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-full md:w-1/2">
                <img
                  src="/Gaza.jpg"
                  alt="Gaza Donation"
                  className="w-full h-64 object-cover rounded-2xl shadow-lg"
                />
              </div>
              <div className="w-full md:w-1/2 text-center md:text-right">
                <h2 className="text-3xl font-bold mb-4 text-slate-800 dark:text-white">
                  {language === 'ar' ? 'حملة إغاثة أهلنا في غزة' : 'Gaza Relief Campaign'}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                  {language === 'ar'
                    ? 'ساهم معنا في تقديم المساعدات العاجلة والضرورية لأهلنا في قطاع غزة. تبرعك يصنع فرقاً وينقذ حياة.'
                    : 'Contribute with us to provide urgent and necessary aid to our people in the Gaza Strip. Your donation makes a difference and saves lives.'}
                </p>
                <Link to="/donate" className="btn-accent w-full md:w-auto">
                  {language === 'ar' ? 'تبرع لغزة الآن' : 'Donate for Gaza'}
                </Link>
              </div>
            </div>
          </div>

          {/* Annual Schedule */}
          <section className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-2xl mb-20 relative overflow-hidden animate-slideUp animation-delay-500">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl"></div>

            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-2 text-center flex items-center justify-center gap-3">
                <Calendar className="w-8 h-8 text-teal-400" />
                {language === 'ar' ? 'جدول العمل السنوي' : 'Annual Schedule'}
              </h2>
              <p className="text-slate-400 mb-10 text-center">2025 - 2026</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { date: '20 Oct 2025', text: language === 'ar' ? 'انطلاق حملة الانتساب للجمعية' : 'Membership Campaign Launch' },
                  { date: 'Nov 2025', text: language === 'ar' ? 'حملة التبرع بالدم' : 'Blood Donation Campaign' },
                  { date: '29 Dec 2025', text: language === 'ar' ? 'حفل تكريم المتطوعين' : 'Volunteers Ceremony' },
                  { date: '17 Feb 2026', text: language === 'ar' ? 'الحملة الرمضانية' : 'Ramadan Campaign' },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 hover:border-teal-500/50 transition-colors">
                    <span className="inline-block px-3 py-1 bg-teal-500/20 text-teal-400 rounded-lg text-sm font-bold mb-3">
                      {item.date}
                    </span>
                    <p className="text-slate-300 text-sm">{item.text}</p>
                  </div>
                ))}
              </div>

              <p className="mt-8 text-xs text-slate-500 text-center">
                {language === 'ar' ? '⚠️ الجدول قابل للتعديل حسب الظروف والمستجدات' : '⚠️ Schedule subject to change'}
              </p>
            </div>
          </section>

          {/* Financial Report */}
          <div className="max-w-sm mx-auto animate-slideUp animation-delay-500">
            <div className="card p-8 text-center border-t-4 border-teal-500">
              <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">
                {language === 'ar' ? 'التقرير المالي - سبتمبر 2025' : 'Financial Report - Sep 2025'}
              </h3>

              <div className="space-y-6">
                <div>
                  <p className="text-sm text-slate-500 mb-1">{language === 'ar' ? 'إجمالي التبرعات' : 'Total Donations'}</p>
                  <p className="text-3xl font-bold text-teal-600 dark:text-teal-400 flex items-center justify-center gap-2">
                    <Wallet className="w-6 h-6" />
                    103,000
                    <span className="text-sm text-slate-400 font-normal">MRU</span>
                  </p>
                </div>

                <Link to="/donate" className="btn-outline w-full justify-center">
                  {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
