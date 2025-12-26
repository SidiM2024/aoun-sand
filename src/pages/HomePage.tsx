import { Hero } from '../components/Hero';
import { About } from '../components/About';
import { Projects } from '../components/Projects';
import { Link } from 'react-router-dom';
import { Video, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const HomePage = () => {
  const { language } = useLanguage();

  return (
    <div className="overflow-hidden">
      <Hero />

      {/* Lessons Preview Section */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="container-custom">
          <div className="flex flex-col md:flex-row items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white mb-4">
                {language === 'ar' ? 'دروس المحجة البيضاء' : 'Al-Mahjah Al-Bayda Lessons'}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl">
                {language === 'ar'
                  ? 'سلسلة دروس علمية وتربوية تهدف إلى نشر الوعي الديني وتزكية النفوس'
                  : 'Educational and spiritual lessons aimed at spreading religious awareness'}
              </p>
            </div>
            <Link
              to="/lessons"
              className="mt-6 md:mt-0 btn-outline flex items-center gap-2"
            >
              <span>{language === 'ar' ? 'عرض كل الدروس' : 'View All Lessons'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Link key={i} to="/lessons" className="group card">
                <div className="aspect-video bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center bg-teal-50 dark:bg-slate-800">
                    <Video className="w-12 h-12 text-teal-200 dark:text-slate-700" />
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300">
                      <ArrowRight className="w-5 h-5 text-teal-600" />
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="h-4 w-24 bg-teal-100 dark:bg-teal-900/30 rounded mb-3"></div>
                  <div className="h-6 w-3/4 bg-slate-100 dark:bg-slate-700 rounded mb-2"></div>
                  <div className="h-4 w-1/2 bg-slate-50 dark:bg-slate-800 rounded"></div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <About />
      <Projects />
    </div>
  );
};
