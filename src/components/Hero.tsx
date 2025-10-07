import { Heart, Users, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

export const Hero = () => {
  const { t, language } = useLanguage();

  return (
    <section id="home" className="pt-24 pb-16 bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-8 animate-fadeIn">
            <h1 className={`text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent ${language === 'ar' ? 'font-arabic' : ''}`}>
              {t.hero.title}
            </h1>
            <p className={`text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-6 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
              {t.hero.subtitle}
            </p>
            <div className="flex flex-col items-center gap-2 text-sm text-gray-600 dark:text-gray-400 animate-slideUp">
              <p className="font-semibold">{t.hero.license}</p>
              <p>{t.hero.date}</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-12 animate-slideUp" style={{ animationDelay: '0.2s' }}>
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

          {/* قسم الفيديو embed جذاب ومتجاوب */}
          <div className="max-w-3xl mx-auto animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl hover:shadow-3xl transition-shadow duration-300">
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent z-10"></div>
              
              <div className="w-full aspect-video">
                <iframe
                  className="w-full h-full rounded-2xl"
                  src="https://www.youtube.com/embed/Q0jCQP8YveY"
                  title="فيديو تعريف جمعية عون وسند"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 text-white bg-black/40 px-3 py-1 rounded-full">
                <Video className="w-5 h-5" />
                <span className="font-semibold">{t.hero.watchVideo}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-slate-900 to-transparent"></div>
    </section>
  );
};
