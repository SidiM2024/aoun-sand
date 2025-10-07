import { CheckCircle2, Users, FileText, HandHeart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const MembershipPage = () => {
  const { t, language } = useLanguage();

  const benefits = t.membership.benefits.map((benefit, index) => {
    const icons = [HandHeart, FileText, Users, CheckCircle2];
    return {
      icon: icons[index] || CheckCircle2,
      text: benefit,
    };
  });

  return (
    <div className="pt-20">
      <section className="py-20 bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12 animate-fadeIn">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full mb-6 shadow-xl">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h1 className={`text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t.membership.title}
              </h1>
              <p className={`text-xl text-gray-700 dark:text-gray-300 mb-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t.membership.subtitle}
              </p>
              <p className={`text-lg text-gray-600 dark:text-gray-400 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t.membership.description}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 md:p-12 mb-12 animate-slideUp">
              <h2 className={`text-3xl font-bold mb-8 text-teal-600 dark:text-teal-400 flex items-center gap-3 ${language === 'ar' ? 'font-arabic' : ''}`}>
                <CheckCircle2 className="w-8 h-8" />
                {t.membership.benefitsTitle}
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                {benefits.map((benefit, index) => {
                  const Icon = benefit.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-6 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-slate-700 dark:to-slate-600 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <p className={`text-gray-700 dark:text-gray-300 font-medium ${language === 'ar' ? 'font-arabic text-right flex-1' : ''}`}>
                        {benefit.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gradient-to-br from-teal-600 to-cyan-600 dark:from-teal-700 dark:to-cyan-700 rounded-2xl shadow-2xl p-8 md:p-12 text-center text-white animate-fadeIn">
              <FileText className="w-16 h-16 mx-auto mb-6" />
              <h3 className={`text-3xl font-bold mb-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t.membership.formTitle}
              </h3>
              <a
                href="#"
                className="inline-block px-8 py-4 bg-white text-teal-600 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 mb-6"
              >
                {t.membership.formButton}
              </a>
              <p className={`text-lg font-semibold mt-6 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t.membership.closingMessage}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
