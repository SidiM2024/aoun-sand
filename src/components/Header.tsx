import { useState } from 'react';
import { Menu, X, Sun, Moon, Globe } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();

  const closeMenu = () => setIsMenuOpen(false);

  const languages = [
    { code: 'ar' as const, label: 'العربية', flag: '🇲🇷' },
    { code: 'fr' as const, label: 'Français', flag: '🇫🇷' },
    { code: 'en' as const, label: 'English', flag: '🇬🇧' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-md transition-all duration-300">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <img
              src="/ABC.jpg"
              alt="Logo"
              className="h-12 w-12 object-contain rounded-full shadow-lg hover:scale-110 transition-transform duration-300"
            />
            <span className="text-xl font-bold text-teal-600 dark:text-teal-400 hidden sm:block">
              {language === 'ar' ? 'عون وسند' : language === 'fr' ? 'Aide et Soutien' : 'Aid & Support'}
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-6">
            <Link to="/" className={`nav-link ${isActive('/') ? 'text-teal-600 dark:text-teal-400' : ''}`}>{t.nav.home}</Link>
            <Link to="/about" className={`nav-link ${isActive('/about') ? 'text-teal-600 dark:text-teal-400' : ''}`}>{t.nav.about}</Link>
            <Link to="/projects" className={`nav-link ${isActive('/projects') ? 'text-teal-600 dark:text-teal-400' : ''}`}>{t.nav.projects}</Link>
            <Link to="/volunteer" className={`nav-link ${isActive('/volunteer') ? 'text-teal-600 dark:text-teal-400' : ''}`}>{t.nav.volunteer}</Link>
            <Link to="/membership" className={`nav-link ${isActive('/membership') ? 'text-teal-600 dark:text-teal-400' : ''}`}>{t.nav.membership}</Link>
            <Link to="/donate" className={`nav-link ${isActive('/donate') ? 'text-teal-600 dark:text-teal-400' : ''}`}>{t.nav.donate}</Link>
            <Link to="/contact" className={`nav-link ${isActive('/contact') ? 'text-teal-600 dark:text-teal-400' : ''}`}>{t.nav.contact}</Link>
          </div>

          <div className="flex items-center gap-3">
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

        {isMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 animate-slideDown">
            <div className="flex flex-col gap-3">
              <Link to="/" onClick={closeMenu} className="mobile-nav-link">{t.nav.home}</Link>
              <Link to="/about" onClick={closeMenu} className="mobile-nav-link">{t.nav.about}</Link>
              <Link to="/projects" onClick={closeMenu} className="mobile-nav-link">{t.nav.projects}</Link>
              <Link to="/volunteer" onClick={closeMenu} className="mobile-nav-link">{t.nav.volunteer}</Link>
              <Link to="/membership" onClick={closeMenu} className="mobile-nav-link">{t.nav.membership}</Link>
              <Link to="/donate" onClick={closeMenu} className="mobile-nav-link">{t.nav.donate}</Link>
              <Link to="/contact" onClick={closeMenu} className="mobile-nav-link">{t.nav.contact}</Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};
