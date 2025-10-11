import { Heart, Users, Video, Calendar, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useState } from 'react';

export const Hero = () => {
  const { t, language } = useLanguage();
  const [showVideo, setShowVideo] = useState(false);

  return (
    <section
      id="home"
      className="relative pt-24 pb-16 bg-gradient-to-b from-[#eef5ff] via-[#e8f8f5] to-[#f7faff] 
      dark:from-[#0f172a] dark:via-[#1e293b] dark:to-[#0f172a] transition-all duration-300 overflow-hidden"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto text-center">
          {/* العنوان والوصف */}
          <div className="mb-8">
            <h1
              className={`text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-teal-600 to-cyan-500 
              dark:from-cyan-400 dark:via-teal-400 dark:to-blue-400 bg-clip-text text-transparent ${
                language === 'ar' ? 'font-arabic' : ''
              }`}
            >
              {t.hero.title}
            </h1>
            <p
              className={`text-base md:text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed ${
                language === 'ar' ? 'font-arabic' : ''
              }`}
            >
              {t.hero.subtitle}
            </p>
          </div>

          {/* الأزرار */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <Link to="/about" className="btn-primary flex items-center gap-2 px-4 py-2 text-sm md:text-base rounded-xl">
              <Heart className="w-4 h-4" />
              {t.hero.learnMore}
            </Link>
            <Link to="/donate" className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm md:text-base rounded-xl">
              <Heart className="w-4 h-4" />
              {t.hero.donateNow}
            </Link>
            <Link to="/membership" className="btn-outline flex items-center gap-2 px-4 py-2 text-sm md:text-base rounded-xl">
              <Users className="w-4 h-4" />
              {t.hero.membership}
            </Link>
          </div>

          {/* الفيديو */}
          <div className="max-w-2xl mx-auto relative">
            {!showVideo ? (
              <div
                className="relative rounded-2xl overflow-hidden shadow-lg cursor-pointer group"
                onClick={() => setShowVideo(true)}
              >
                <img
                  src="https://img.youtube.com/vi/Q0jCQP8YveY/maxresdefault.jpg"
                  alt="فيديو تعريفي"
                  className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition"></div>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-white/90 text-teal-700 rounded-full p-4 shadow-md hover:scale-110 transition">
                    <Video className="w-6 h-6 md:w-8 md:h-8" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden shadow-xl">
                <iframe
                  className="w-full h-[240px] sm:h-[300px] md:h-[400px]"
                  src="https://www.youtube.com/embed/Q0jCQP8YveY?autoplay=1&rel=0"
                  title="فيديو الجمعية"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                ></iframe>
                <button
                  onClick={() => setShowVideo(false)}
                  className="absolute top-3 right-3 bg-white/80 hover:bg-white text-black rounded-full px-2 py-1 shadow"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* 📅 جدول العمل السنوي */}
          <section className="mt-16 bg-gradient-to-r from-[#1b1b2f] via-[#1f1b3a] to-[#1b1b2f] text-white py-10 px-4 rounded-3xl shadow-inner">
            <h2 className="text-2xl md:text-3xl font-bold mb-3 text-center">📅 جدول العمل السنوي</h2>
            <p className="text-gray-300 mb-8 text-center">2025 - 2026</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { date: '20 أكتوبر 2025', text: 'انطلاق حملة الانتساب للجمعية.' },
                { date: 'نوفمبر 2025', text: 'حملة التبرع بالدم بالتعاون مع المركز الوطني.' },
                { date: '29 ديسمبر 2025', text: 'حفل مرور عام وتكريم الأعضاء المتطوعين.' },
                { date: '17 فبراير 2026', text: 'الحملة الرمضانية لتوزيع السلال الغذائية.' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-[#26224a] hover:bg-[#312c5e] rounded-2xl shadow-md p-4 border border-gray-700 hover:scale-[1.02] transition"
                >
                  <h3 className="bg-[#7b6cd9] text-white py-1 px-3 rounded-md text-sm font-semibold inline-block mb-2">
                    {item.date}
                  </h3>
                  <p className="text-xs text-gray-200 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-200">
              <div className="bg-[#292550] rounded-2xl p-4 border border-gray-700 text-sm">
                <h4 className="font-semibold text-yellow-400 mb-1">طوال العام</h4>
                استمرار برنامج السقايات الشهرية ومتابعة المشاريع.
              </div>
              <div className="bg-[#292550] rounded-2xl p-4 border border-gray-700 text-sm">
                <h4 className="font-semibold text-yellow-400 mb-1">في العطل الصغيرة</h4>
                أنشطة موسمية ومشاريع إدخال الماء.
              </div>
            </div>

            <p className="mt-5 text-xs text-gray-400 italic text-center">
              ⚠️ الجدول قابل للتعديل حسب الظروف والمستجدات.
            </p>
          </section>

          {/* 🔷 التقرير المالي */}
          <div className="mt-14 px-4">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-teal-600 dark:text-teal-400 text-center">
              التقرير المالي لشهر سبتمبر 2025
            </h2>
            <div className="bg-white/90 dark:bg-slate-800/80 rounded-2xl shadow-md p-6 max-w-xs mx-auto text-center">
              <Calendar className="w-7 h-7 text-teal-600 dark:text-teal-400 mx-auto mb-2" />
              <p className="text-sm text-gray-700 dark:text-gray-300">الشهر</p>
              <p className="text-lg font-bold text-teal-600 dark:text-teal-400">سبتمبر 2025</p>
              <Wallet className="w-7 h-7 text-teal-600 dark:text-teal-400 mx-auto mt-3 mb-2" />
              <p className="text-sm text-gray-700 dark:text-gray-300">إجمالي المبلغ</p>
              <p className="text-xl font-bold text-teal-600 dark:text-teal-400">103,000 MRU</p>
              <Link
                to="/donate"
                className="mt-4 inline-block bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-md transition-transform hover:scale-105"
              >
                💚 تبرع الآن
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
