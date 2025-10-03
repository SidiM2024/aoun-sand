import { Target, BookOpen, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const About = () => {
  const { t, language } = useLanguage();

  return (
    <section id="about" className="py-20 bg-white dark:bg-slate-900 transition-colors duration-300">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className={`section-title ${language === 'ar' ? 'font-arabic' : ''}`}>
            {t.about.title}
          </h2>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            <div className="animate-slideLeft">
              <p className={`text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-6 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t.about.description}
              </p>
              <div className="relative rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                <img
                  src="/DEDE.jpg"
                  alt="Association activities"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
              </div>
            </div>

            <div className="animate-slideRight">
              <h3 className={`text-3xl font-bold mb-8 text-teal-600 dark:text-teal-400 flex items-center gap-3 ${language === 'ar' ? 'font-arabic' : ''}`}>
                <Target className="w-8 h-8" />
                {t.about.goalsTitle}
              </h3>
              <div className="space-y-4">
                {t.about.goals.map((goal, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-teal-50 dark:bg-slate-800 rounded-xl hover:bg-teal-100 dark:hover:bg-slate-700 transition-all duration-300 transform hover:translate-x-2"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-teal-500 text-white rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <p className={`text-gray-700 dark:text-gray-300 ${language === 'ar' ? 'font-arabic text-right flex-1' : ''}`}>
                      {goal}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-8 md:p-12 shadow-lg animate-fadeIn">
            <div className="flex items-center gap-4 mb-6">
              <Users className="w-10 h-10 text-teal-600 dark:text-teal-400" />
              <h3 className={`text-3xl font-bold text-teal-600 dark:text-teal-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t.about.teamTitle}
              </h3>
            </div>
            <p className={`text-lg text-gray-700 dark:text-gray-300 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
              {t.about.teamDescription}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
