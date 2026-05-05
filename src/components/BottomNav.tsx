import { Home, FolderHeart, HeartHandshake, CreditCard, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

export const BottomNav = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const navItems = [
    { path: '/', label: isRTL ? 'الرئيسية' : 'Home', icon: Home },
    { path: '/projects', label: isRTL ? 'المشاريع' : 'Projects', icon: FolderHeart },
    { path: '/donate', label: isRTL ? 'التبرع' : 'Donate', icon: HeartHandshake },
    { path: '/membership', label: isRTL ? 'الانتساب' : 'Membership', icon: CreditCard },
    { path: '/account', label: isRTL ? 'الحساب' : 'Account', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe z-50">
      <nav className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/account' && location.pathname === '/admin');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive 
                  ? 'text-teal-600 dark:text-teal-400' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'fill-current opacity-20 stroke-[1.5]' : 'stroke-[1.5]'}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
