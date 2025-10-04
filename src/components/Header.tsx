import { useState } from 'react';
import { Menu, X, Sun, Moon, Globe } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  const languages = [
    { code: 'ar' as const, label: 'العربية', flag: '🇲🇷' },
    { code: 'fr' as const, label: 'Français', flag: '🇫🇷' },
    { code: 'en' as const, label: 'English', flag: '🇬🇧' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-md transition-all duration-300">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* شعار الجمعية + الاسم */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => scrollToSection('home')}
          >
            <img
              src="/ABC.jpg"
              alt="Logo"
              className="h-12 w-12 object-contain rounded-full shadow-lg hover:scale-110 transition-transform duration-300"
            />
            <span className="text-xl font-bold text-teal-600 dark:text-teal-400">
              {language === 'ar' ? 'عون وسند' : language === 'fr' ? 'Aide et Soutien' : 'Aid & Support'}
            </span>
          </div>

          {/* قائمة التنقل على الكمبيوتر */}
          <div className="hidden lg:flex items-center gap-6">
            <button onClick={() => scrollToSection('home')} className="nav-link">{t.nav.home}</button>
            <button onClick={() => scrollToSection('about')} className="nav-link">{t.nav.about}</button>
            <button onClick={() => scrollToSection('projects')} className="nav-link">{t.nav.projects}</button>
            <button onClick={() => scrollToSection('volunteer')} className="nav-link">{t.nav.volunteer}</button>
            <button onClick={() => scrollToSection('donate')} className="nav-link">{t.nav.donate}</button>
            <button onClick={() => scrollToSection('contact')} className="nav-link">{t.nav.contact}</button>
          </div>

          {/* أيقونات التحكم */}
          <div className="flex items-center gap-3">
            {/* تبديل الوضع الليلي */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-all duration-300 hover:rotate-180"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              ) : (
                <Sun className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              )}
            </button>

            {/* تغيير اللغة */}
            <div className="relative">
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-all duration-300 flex items-center gap-1"
                aria-label="Change language"
              >
                <Globe className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {languages.find(l => l.code === language)?.flag}
                </span>
              </button>

              {isLangMenuOpen && (
                <div className="absolute right-0 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl py-2 min-w-[150px] animate-fadeIn">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 ${
                        language === lang.code ? 'bg-teal-50 dark:bg-teal-900/30' : ''
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span className="text-slate-700 dark:text-slate-300">{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* زر القائمة على الهاتف */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-all duration-300"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6 text-slate-700 dark:text-slate-300" />
              ) : (
                <Menu className="w-6 h-6 text-slate-700 dark:text-slate-300" />
              )}
            </button>
          </div>
        </div>

        {/* قائمة الهاتف */}
        {isMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 animate-slideDown">
            <div className="flex flex-col gap-3">
              <button onClick={() => scrollToSection('home')} className="mobile-nav-link">{t.nav.home}</button>
              <button onClick={() => scrollToSection('about')} className="mobile-nav-link">{t.nav.about}</button>
              <button onClick={() => scrollToSection('projects')} className="mobile-nav-link">{t.nav.projects}</button>
              <button onClick={() => scrollToSection('volunteer')} className="mobile-nav-link">{t.nav.volunteer}</button>
              <button onClick={() => scrollToSection('donate')} className="mobile-nav-link">{t.nav.donate}</button>
              <button onClick={() => scrollToSection('contact')} className="mobile-nav-link">{t.nav.contact}</button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};
