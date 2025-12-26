import { Heart, Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';

export const Footer = () => {
  const { t, language } = useLanguage();

  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-8">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <img
                src="/ABC.jpg"
                alt="Logo"
                className="h-16 w-16 object-cover rounded-full shadow-xl border-2 border-slate-700"
              />
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {language === 'ar' ? 'عون وسند' : language === 'fr' ? 'Aide et Soutien' : 'Aid & Support'}
                </h3>
                <p className="text-teal-500 text-sm font-medium">
                  {language === 'ar' ? 'معاً نصنع الأمل' : 'Together Creating Hope'}
                </p>
              </div>
            </div>
            <p className="text-slate-400 leading-relaxed">
              {t.footer.description}
            </p>
            <div className="flex gap-4">
              <a href="#" className="p-2 bg-slate-800 rounded-full hover:bg-teal-600 hover:text-white transition-all duration-300">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-slate-800 rounded-full hover:bg-pink-600 hover:text-white transition-all duration-300">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-slate-800 rounded-full hover:bg-sky-500 hover:text-white transition-all duration-300">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold text-lg mb-6 relative inline-block after:content-[''] after:absolute after:w-1/2 after:h-1 after:bg-teal-500 after:-bottom-2 after:left-0">
              {language === 'ar' ? 'روابط سريعة' : 'Quick Links'}
            </h4>
            <ul className="space-y-3">
              <li><Link to="/about" className="hover:text-teal-400 transition-colors flex items-center gap-2"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>{t.nav.about}</Link></li>
              <li><Link to="/projects" className="hover:text-teal-400 transition-colors flex items-center gap-2"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>{t.nav.projects}</Link></li>
              <li><Link to="/volunteer" className="hover:text-teal-400 transition-colors flex items-center gap-2"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>{t.nav.volunteer}</Link></li>
              <li><Link to="/membership" className="hover:text-teal-400 transition-colors flex items-center gap-2"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>{t.nav.membership}</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-white font-bold text-lg mb-6 relative inline-block after:content-[''] after:absolute after:w-1/2 after:h-1 after:bg-teal-500 after:-bottom-2 after:left-0">
              {language === 'ar' ? 'تواصل معنا' : 'Contact Us'}
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-teal-500 mt-1 shrink-0" />
                <span>Nouakchott, Mauritania</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-teal-500 shrink-0" />
                <span dir="ltr">+222 12 34 56 78</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-teal-500 shrink-0" />
                <span>contact@aoun-sand.com</span>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-white font-bold text-lg mb-6 relative inline-block after:content-[''] after:absolute after:w-1/2 after:h-1 after:bg-teal-500 after:-bottom-2 after:left-0">
              {language === 'ar' ? 'النشرة البريدية' : 'Newsletter'}
            </h4>
            <p className="text-slate-400 mb-4 text-sm">
              {language === 'ar' ? 'اشترك ليصلك كل جديد عن نشاطاتنا' : 'Subscribe to get latest updates'}
            </p>
            <form className="space-y-3">
              <input
                type="email"
                placeholder={language === 'ar' ? 'بريدك الإلكتروني' : 'Your email'}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500 text-white placeholder-slate-500"
              />
              <button className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-colors">
                {language === 'ar' ? 'اشترك' : 'Subscribe'}
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 mt-8 text-center">
          <p className="flex items-center justify-center gap-2 text-slate-500 text-sm">
            {t.footer.rights} © {new Date().getFullYear()}
            <span className="mx-2">|</span>
            {language === 'ar' ? 'صُنع بكل' : 'Made with'}
            <Heart className="w-4 h-4 text-rose-500 animate-pulse fill-rose-500" />
          </p>
        </div>
      </div>
    </footer>
  );
};
