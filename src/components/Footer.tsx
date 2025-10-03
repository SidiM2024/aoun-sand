import { Heart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const Footer = () => {
  const { t, language } = useLanguage();

  return (
    <footer className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white py-12 transition-colors duration-300">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <img
                src="/ABC.jpg"
                alt="Logo"
                className="h-16 w-16 object-contain rounded-full shadow-xl hover:scale-110 transition-transform duration-300"
              />
              <div>
                <h3 className={`text-2xl font-bold text-teal-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {language === 'ar' ? 'عون وسند' : language === 'fr' ? 'Aide et Soutien' : 'Aid & Support'}
                </h3>
                <p className={`text-gray-400 text-sm ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t.footer.description}
                </p>
              </div>
            </div>

            <div className="text-center md:text-right">
              <p className={`text-gray-400 flex items-center gap-2 justify-center md:justify-end ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t.footer.rights} © {new Date().getFullYear()}
              </p>
              <p className={`text-gray-500 text-sm mt-2 flex items-center gap-2 justify-center md:justify-end ${language === 'ar' ? 'font-arabic' : ''}`}>
                {language === 'ar' ? 'صُنع بكل' : language === 'fr' ? 'Fait avec' : 'Made with'}
                <Heart className="w-4 h-4 text-red-500 animate-pulse" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
