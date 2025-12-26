import { useState, useEffect } from 'react';
import { Menu, X, Sun, Moon, Globe, Home, Info, FolderHeart, HandHeart, CreditCard, HeartHandshake, Phone, Youtube, Facebook, Mail } from 'lucide-react';
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

  const socialLinks = [
    {
      name: 'Facebook',
      icon: Facebook,
      url: 'https://www.facebook.com/share/1AxfWAYLhF/',
      color: 'hover:text-blue-600',
    },
    {
      name: 'YouTube',
      icon: Youtube,
      url: 'https://youtube.com/@associationaidesoutien?si=elgJjASNN8qbD80E',
      color: 'hover:text-red-600',
    },
    {
      name: 'TikTok',
      icon: () => (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      ),
      url: 'https://www.tiktok.com/@association645?_t=ZM-8yMLLxhDYBh&_r=1',
      color: 'hover:text-black dark:hover:text-white',
    },
    {
      name: 'Snapchat',
      icon: () => (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.389.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.149-.052-.227.015-.195.181-.465.437-.509 3.304-.54 4.79-3.879 4.836-3.984l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.347-.81-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.287.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z" />
        </svg>
      ),
      url: 'https://www.snapchat.com/add/jmywnwsnd?share_id=e5wqH4uz-YU&locale=ar-MR',
      color: 'hover:text-yellow-500',
    },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
      ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg'
      : 'bg-white dark:bg-slate-900 shadow-sm'
      }`}>
      {/* Top Bar with Contact Info & Socials */}
      <div className="bg-teal-600 dark:bg-slate-800 text-white py-1 text-xs md:text-sm">
        <div className="container-custom flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="tel:32203250" className="flex items-center gap-1 hover:text-teal-100 transition-colors">
              <Phone className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">32203250</span>
            </a>
            <a href="mailto:associationaidesoutien@gmail.com" className="flex items-center gap-1 hover:text-teal-100 transition-colors">
              <Mail className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">associationaidesoutien@gmail.com</span>
            </a>
          </div>
          <div className="flex items-center gap-3">
            {socialLinks.map((social, index) => {
              const Icon = social.icon;
              return (
                <a
                  key={index}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-teal-200 transition-colors bg-white/10 p-1 rounded-full"
                  aria-label={social.name}
                >
                  <Icon className="w-3 h-3 md:w-4 md:h-4" />
                </a>
              );
            })}
          </div>
        </div>
      </div>

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
