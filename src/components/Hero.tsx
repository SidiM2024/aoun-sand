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

      <section class="bg-[#1f1b3a] text-white py-12 px-4">
  <div class="max-w-6xl mx-auto text-center">
    <h2 class="text-3xl font-bold mb-2">📅 جدول العمل السنوي لجمعية عون وسند</h2>
    <p class="text-gray-300 mb-10">2025 - 2026</p>

    <div class="grid md:grid-cols-4 sm:grid-cols-2 grid-cols-1 gap-6">
      <div class="bg-[#2b2654] rounded-2xl shadow-lg p-5 border border-gray-600 hover:scale-[1.02] transition">
        <h3 class="bg-[#7b6cd9] text-white py-2 px-3 rounded-md font-semibold inline-block mb-3">20 أكتوبر 2025</h3>
        <p class="text-sm leading-relaxed text-gray-200">
          انطلاق حملة الانتساب للجمعية، تهدف إلى استقبال الأعضاء الجدد وتعريفهم برسالة الجمعية وأهدافها.
        </p>
      </div>

      <div class="bg-[#2b2654] rounded-2xl shadow-lg p-5 border border-gray-600 hover:scale-[1.02] transition">
        <h3 class="bg-[#7b6cd9] text-white py-2 px-3 rounded-md font-semibold inline-block mb-3">نوفمبر 2025</h3>
        <p class="text-sm leading-relaxed text-gray-200">
          إطلاق حملة التبرع بالدم بالتعاون مع المركز الوطني، مساهمة في العمل الإنساني لطلبة الجامعات.
        </p>
      </div>

      <div class="bg-[#2b2654] rounded-2xl shadow-lg p-5 border border-gray-600 hover:scale-[1.02] transition">
        <h3 class="bg-[#7b6cd9] text-white py-2 px-3 rounded-md font-semibold inline-block mb-3">29 ديسمبر 2025</h3>
        <p class="text-sm leading-relaxed text-gray-200">
          إقامة حفل مرور عام من العطاء، تكريم الأعضاء المتطوعين، وانطلاق حملة إفطار الصائم الرمضانية.
        </p>
      </div>

      <div class="bg-[#2b2654] rounded-2xl shadow-lg p-5 border border-gray-600 hover:scale-[1.02] transition">
        <h3 class="bg-[#7b6cd9] text-white py-2 px-3 rounded-md font-semibold inline-block mb-3">17 فبراير 2026</h3>
        <p class="text-sm leading-relaxed text-gray-200">
          إطلاق الحملة الرمضانية لتوزيع السلال الغذائية، برامج صحية وتوعوية خلال شهر رمضان المبارك.
        </p>
      </div>
    </div>

    <div class="mt-10 grid md:grid-cols-2 grid-cols-1 gap-6 text-gray-200">
      <div class="bg-[#292550] rounded-2xl p-5 border border-gray-600">
        <h4 class="font-semibold text-yellow-400 mb-2">طوال العام</h4>
        <p class="text-sm leading-relaxed">استمرار برنامج السقايات الشهرية ومتابعة مشاريع الجمعية الدائمة.</p>
      </div>
      <div class="bg-[#292550] rounded-2xl p-5 border border-gray-600">
        <h4 class="font-semibold text-yellow-400 mb-2">في العطل الصغيرة</h4>
        <p class="text-sm leading-relaxed">مشروع إدخال الماء للأسر المحتاجة وأنشطة تطوعية موسمية.</p>
      </div>
    </div>

    <div class="mt-8 text-sm text-gray-300 italic">
      ⚠️ الجدول قابل للتغيير حسب الظروف والمستجدات.
    </div>
  </div>
</section>


      {/* 🔷 قسم التقرير المالي - عنوان + بطاقة واحدة صغيرة */}
      <div className="mt-16 px-4 flex flex-col items-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-teal-600 dark:text-teal-400 font-arabic text-center animate-fadeIn">
          التقرير المالي لشهر سبتمبر 2025
        </h2>

        <div className="bg-white/90 dark:bg-slate-800/80 rounded-3xl shadow-xl p-6 md:p-8 text-center backdrop-blur-sm max-w-sm w-full animate-fadeIn">
          <div className="flex flex-col items-center gap-3">
            <Calendar className="w-8 h-8 text-teal-600 dark:text-teal-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 font-arabic">الشهر</h3>
            <p className="text-xl font-bold text-teal-600 dark:text-teal-400 font-arabic">سبتمبر 2025</p>

            <Wallet className="w-8 h-8 text-teal-600 dark:text-teal-400 mt-4" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 font-arabic">إجمالي المبلغ</h3>
            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 font-arabic">103,000 MRU</p>

            <Link
              to="/donate"
              className="mt-6 inline-block bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white font-semibold text-lg px-6 py-3 rounded-xl shadow-lg transition-all duration-300 hover:scale-105"
            >
              💚 تبرع الآن
            </Link>
          </div>
        </div>
      </div>

      {/* تأثير التدرج السفلي */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-slate-900 to-transparent"></div>
    </section>
  );
};
