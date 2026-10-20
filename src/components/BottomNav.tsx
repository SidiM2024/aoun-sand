import { Home, HeartHandshake, Vote, Users, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

// Fixed app-style tab bar: الرئيسية، مشاريعنا، الانتخابات، عن الجمعية، حسابي.
export const BottomNav = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const fr = language === 'fr';

  const navItems = [
    { path: '/',          label: isRTL ? 'الرئيسية'   : fr ? 'Accueil'   : 'Home',      icon: Home },
    { path: '/projects',  label: isRTL ? 'مشاريعنا'   : fr ? 'Projets'   : 'Projects',  icon: HeartHandshake },
    { path: '/elections', label: isRTL ? 'الانتخابات' : fr ? 'Élections' : 'Elections', icon: Vote },
    { path: '/about',     label: isRTL ? 'عن الجمعية' : fr ? 'À propos'  : 'About',     icon: Users },
    { path: '/account',   label: isRTL ? 'حسابي'      : fr ? 'Compte'    : 'Account',   icon: User },
  ];

  return (
    <nav
      aria-label={isRTL ? 'التنقل السفلي' : 'Bottom navigation'}
      className="fixed bottom-0 inset-x-0 z-40 bg-[#211d45] rounded-t-[28px] shadow-[0_-8px_30px_rgba(33,29,69,0.25)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="max-w-2xl mx-auto grid grid-cols-5 h-[74px] px-1" dir={isRTL ? 'rtl' : 'ltr'}>
        {navItems.map(item => {
          const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
          return (
            <li key={item.path} className="flex items-center justify-center">
              <Link
                to={item.path}
                id={`bottom-nav-${item.path.replace('/', '') || 'home'}`}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-col items-center justify-center gap-1 w-full"
              >
                <span className={`flex items-center justify-center rounded-2xl transition-all ${isActive ? 'w-12 h-10 bg-[#f7b2b0] text-[#211d45] shadow-lg shadow-[#f7b2b0]/30' : 'w-10 h-8 text-white/85'}`}>
                  <item.icon className={`w-[22px] h-[22px] ${isActive ? 'stroke-[2.4]' : 'stroke-[1.7]'}`} />
                </span>
                <span className={`text-[11px] sm:text-xs whitespace-nowrap ${isActive ? 'font-black text-[#f7b2b0]' : 'font-medium text-white/80'}`}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
