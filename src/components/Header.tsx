import { useState, useEffect } from 'react';
import { Menu, X, Sun, Moon, Globe, Home, Info, FolderHeart, HandHeart, CreditCard, HeartHandshake, Phone, Youtube, Mail } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();

  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const languages = [
    { code: 'ar' as const, label: 'العربية', flag: '🇲🇷' },
    { code: 'fr' as const, label: 'Français', flag: '🇫🇷' },
    { code: 'en' as const, label: 'English', flag: '🇬🇧' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', label: t.nav.home, icon: Home },
    { path: '/about', label: t.nav.about, icon: Info },
    { path: '/projects', label: t.nav.projects, icon: FolderHeart },
    { path: '/volunteer', label: t.nav.volunteer, icon: HandHeart },
    { path: '/membership', label: t.nav.membership, icon: CreditCard },
    { path: '/donate', label: t.nav.donate, icon: HeartHandshake },
    { path: '/lessons', label: language === 'ar' ? 'الدروس' : 'Lessons', icon: Youtube },
    { path: '/contact', label: t.nav.contact, icon: Phone },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
      ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg'
      : 'bg-white dark:bg-slate-900 shadow-sm'
      }`}>

      <nav className="container-custom py-2">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative overflow-hidden rounded-full shadow-lg">
              <img
                src="/ABC.jpg"
                alt="Logo"
                className="h-10 w-10 md:h-12 md:w-12 object-cover transform group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
              {language === 'ar' ? 'عون وسند' : language === 'fr' ? 'Aide et Soutien' : 'Aid & Support'}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link px-3 py-2 flex items-center gap-2 ${isActive(item.path) ? 'active' : ''
                  }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-slate-600 dark:text-slate-300"
                aria-label="Change language"
              >
                <Globe className="w-5 h-5" />
                <span className="text-sm font-medium">{languages.find(l => l.code === language)?.flag}</span>
              </button>

              {isLangMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-2 animate-fadeIn overflow-hidden">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors flex items-center gap-3 ${language === lang.code ? 'text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/10' : 'text-slate-600 dark:text-slate-300'
                        }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="font-medium">{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="xl:hidden p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="xl:hidden mt-4 pb-4 animate-slideDown border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeMenu}
                  className={`mobile-nav-link ${isActive(item.path) ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' : ''
                    }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
            {/* Mobile Contact Info */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-400">
              <a href="tel:32203250" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>32203250</span>
              </a>
              <a href="mailto:associationaidesoutien@gmail.com" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>associationaidesoutien@gmail.com</span>
              </a>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};
