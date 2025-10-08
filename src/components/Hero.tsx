import { Heart, Users, Video, Calendar, Wallet, Banknote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useState } from 'react';

export const Hero = () => {
  const { t, language } = useLanguage();
  const [showVideo, setShowVideo] = useState(false);

  return (
    <section
      id="home"
      className="relative pt-24 pb-16 bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 
      dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300 overflow-hidden"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto text-center">
          {/* العنوان والوصف */}
          <div className="mb-8 animate-fadeIn">
            <h1
              className={`text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-teal-600 to-cyan-600 
              dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent ${
                language === 'ar' ? 'font-arabic' : ''
              }`}
            >
              {t.hero.title}
            </h1>
            <p
              className={`text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-6 leading-relaxed ${
                language === 'ar' ? 'font-arabic' : ''
              }`}
            >
              {t.hero.subtitle}
            </p>
            <div className="flex flex-col items-center gap-2 text-sm text-gray-600 dark:text-gray-400 animate-slideUp">
              <p className="font-semibold">{t.hero.license}</p>
              <p>{t.hero.date}</p>
            </div>
          </div>

          {/* الأزرار */}
          <div
            className="flex flex-wrap justify-center gap-4 mb-12 animate-slideUp"
            style={{ animationDelay: '0.2s' }}
          >
            <Link to="/about" className="btn-primary flex items-center gap-2">
              <Heart className="w-5 h-5" />
              {t.hero.learnMore}
            </Link>
            <Link to="/donate" className="btn-secondary flex items-center gap-2">
              <Heart className="w-5 h-5" />
              {t.hero.donateNow}
            </Link>
            <Link to="/membership" className="btn-outline flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t.hero.membership}
            </Link>
          </div>

          {/* الفيديو */}
          <div className="max-w-3xl mx-auto relative animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            {!showVideo && (
              <div
                className="relative rounded-2xl overflow-hidden shadow-2xl cursor-pointer group"
                onClick={() => setShowVideo(true)}
              >
                <img
                  src="https://img.youtube.com/vi/Q0jCQP8YveY/maxresdefault.jpg"
                  alt="فيديو تعريفي"
                  className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition"></div>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-white/80 text-teal-700 rounded-full p-4 md:p-6 shadow-lg hover:scale-110 transition">
                    <Video className="w-8 h-8 md:w-10 md:h-10" />
                  </div>
                </div>
              </div>
            )}

            {showVideo && (
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <iframe
                  className="w-full h-[400px] md:h-[500px] rounded-2xl"
                  src="https://www.youtube.com/embed/Q0jCQP8YveY?autoplay=1&rel=0&modestbranding=1"
                  title="فيديو تعريف جمعية عون وسند"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
                <button
                  onClick={() => setShowVideo(false)}
                  className="absolute top-3 right-3 bg-white/80 hover:bg-white text-black rounded-full px-3 py-1 shadow-md"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* الصورة تحت الفيديو */}
          <div className="mt-8 flex flex-col items-center">
            <img
              src="/Gaza.jpg"
              alt="تبرع جمعية لأهلنا في غزة"
              className="w-full max-w-md h-auto rounded-lg shadow-lg object-cover"
            />
            <h2 className="mt-4 text-xl md:text-2xl font-semibold text-teal-700 dark:text-teal-400 text-center">
              تبرع جمعية لأهلنا في غزة
            </h2>
          </div>
        </div>
      </div>

      {/* 🔷 قسم التقرير المالي الشهري (محسن) */}
      <div className="mt-16 px-4">
        <div className="bg-white/80 dark:bg-slate-800/80 rounded-3xl shadow-xl p-6 md:p-10 text-center backdrop-blur-sm animate-fadeIn">
          <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent font-arabic">
            التقرير المالي لشهر سبتمبر
          </h2>

          {/* البطاقات */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 p-6 rounded-2xl shadow-md flex flex-col items-center gap-3 hover:scale-105 hover:shadow-2xl transition-all duration-500 animate-slideUp">
              <Calendar className="w-10 h-10 text-teal-600 dark:text-teal-400" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 font-arabic">الشهر</h3>
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 font-arabic">سبتمبر 2025</p>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 p-6 rounded-2xl shadow-md flex flex-col items-center gap-3 hover:scale-105 hover:shadow-2xl transition-all duration-500 animate-slideUp delay-150">
              <Wallet className="w-10 h-10 text-teal-600 dark:text-teal-400" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 font-arabic">إجمالي المبلغ</h3>
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 font-arabic">103,000 MRU</p>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 p-6 rounded-2xl shadow-md flex flex-col items-center gap-3 hover:scale-105 hover:shadow-2xl transition-all duration-500 animate-slideUp delay-300">
              <Banknote className="w-10 h-10 text-teal-600 dark:text-teal-400" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 font-arabic">رقم بنكيلي</h3>
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 select-all font-mono">
                32203250
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-arabic">(انسخ الرقم للتحويل)</p>
            </div>
          </div>

          {/* زر التبرع */}
          <Link
            to="/donate"
            className="mt-8 inline-block bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white font-semibold text-lg px-8 py-3 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 animate-slideUp delay-450"
          >
            💚 تبرع الآن
          </Link>

          <p className="mt-6 text-sm text-gray-600 dark:text-gray-400 font-arabic animate-slideUp delay-550">
            تبرعاتكم تساهم في استمرار مشاريع الجمعية الخيرية لخدمة المحتاجين.
          </p>
        </div>
      </div>

      {/* تأثير التدرج السفلي */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-slate-900 to-transparent"></div>
    </section>
  );
};
