import { useState } from 'react';
import { Heart, CheckCircle2, Copy, MessageCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type BankKey = 'بنكيلي' | 'مصرفي' | 'السداد' | 'بيم بانك' | 'غازا بي';

/**
 * أيقونات SVG مبسطة لكل بنك — يمكنك استبدال الـ <svg> بالـ logo الرسمي لاحقاً إذا رغبت.
 * التصاميم هنا مرنة، ملائمة للوضع النهاري والليلي، ومضمّنة داخل الكود لسهولة الاستخدام.
 */
const BankIcons: Record<BankKey, JSX.Element> = {
  'بنكيلي': (
    <svg className="w-12 h-12 mx-auto mb-3" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bankily logo">
      <defs>
        <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#005BBB" />
          <stop offset="1" stopColor="#0AB4FF" />
        </linearGradient>
      </defs>
      <rect rx="12" width="64" height="64" fill="url(#g1)" />
      <path d="M16 40 L28 24 L40 40 Z" fill="#fff" opacity="0.95" />
      <circle cx="48" cy="16" r="6" fill="#fff" opacity="0.95" />
    </svg>
  ),
  'مصرفي': (
    <svg className="w-12 h-12 mx-auto mb-3" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Masrafi logo">
      <rect rx="10" width="64" height="64" fill="#F47A20" />
      <g transform="translate(8,8)" fill="#fff" opacity="0.95">
        <rect x="0" y="0" width="48" height="8" rx="3" />
        <rect x="0" y="16" width="48" height="8" rx="3" />
        <rect x="0" y="32" width="32" height="8" rx="3" />
      </g>
    </svg>
  ),
  'السداد': (
    <svg className="w-12 h-12 mx-auto mb-3" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sedad logo">
      <defs>
        <linearGradient id="g2" x1="0" x2="1">
          <stop offset="0" stopColor="#17A673" />
          <stop offset="1" stopColor="#29D08F" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#g2)" />
      <path d="M22 40 L32 22 L42 40 Z" fill="#fff" opacity="0.98" />
    </svg>
  ),
  'بيم بانك': (
    <svg className="w-12 h-12 mx-auto mb-3" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BIM Bank logo">
      <rect rx="12" width="64" height="64" fill="#FFC107" />
      <g transform="translate(10,12)" fill="#fff" opacity="0.98">
        <circle cx="12" cy="12" r="6" />
        <rect x="28" y="6" width="10" height="12" rx="2" />
        <path d="M0 36 L48 36 L48 32 L0 32 Z" />
      </g>
    </svg>
  ),
  'غازا بي': (
    <svg className="w-12 h-12 mx-auto mb-3" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gaza B logo">
      <rect rx="10" width="64" height="64" fill="#6F42C1" />
      <g transform="translate(8,10)" fill="#fff" opacity="0.95">
        <path d="M8 28 C14 18, 34 18, 40 28 C34 26, 14 26, 8 28 Z" />
        <circle cx="24" cy="12" r="6" />
      </g>
    </svg>
  ),
};

export const Donation = () => {
  const { t, language } = useLanguage();
  const [selectedBank, setSelectedBank] = useState<BankKey | null>(null);
  const [copied, setCopied] = useState(false);

  // رقم التبرع العام — إذا أردت أضع لكل بنك رقم خاص اكتب لي الأرقام.
  const donationNumber = '32203250';

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(donationNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // بعض البيئات قد لا تدعم الحافظة؛ يمكن إضافة بديل لاحقاً
      console.error('Clipboard not available', e);
    }
  };

  const handleBankSelect = (bank: BankKey) => {
    setSelectedBank(bank);
  };

  const handleBack = () => {
    setSelectedBank(null);
  };

  const banks: BankKey[] = ['بنكيلي', 'مصرفي', 'السداد', 'بيم بانك', 'غازا بي'];

  return (
    <section
      id="donate"
      className="py-20 bg-gradient-to-br from-rose-50 via-pink-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {!selectedBank ? (
            <>
              <div className="text-center mb-12 animate-fadeIn">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-full mb-6 shadow-xl">
                  <Heart className="w-10 h-10 text-white animate-pulse" />
                </div>

                <h2 className={`section-title ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t?.donation?.title ?? 'ادعمنا'}
                </h2>
                <p className={`text-xl text-gray-600 dark:text-gray-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t?.donation?.subtitle ?? 'اختر طريقة التبرع المفضلة لديك'}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 animate-slideUp">
                {banks.map((bank, index) => (
                  <button
                    key={bank}
                    onClick={() => handleBankSelect(bank)}
                    className="group p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 hover:bg-gradient-to-br hover:from-teal-50 hover:to-cyan-50 dark:hover:from-slate-700 dark:hover:to-slate-600"
                    style={{ animationDelay: `${index * 0.06}s` }}
                    aria-label={`اختر ${bank}`}
                  >
                    <div className="flex items-center justify-center">
                      {BankIcons[bank]}
                    </div>
                    <p className={`text-lg font-bold text-gray-800 dark:text-white ${language === 'ar' ? 'font-arabic' : ''}`}>
                      {bank}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {language === 'ar' ? 'حساب التبرع' : language === 'fr' ? 'Compte de donation' : 'Donation account'}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="animate-fadeIn">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 md:p-12 text-center">
                <div className="mb-8">
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full mb-6 animate-bounce">
                    <CheckCircle2 className="w-16 h-16 text-green-500" />
                  </div>

                  <h3 className={`text-3xl font-bold text-gray-800 dark:text-white mb-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t?.donation?.successTitle ?? 'معلومات التبرع'}
                  </h3>

                  <p className={`text-gray-600 dark:text-gray-300 mb-2 ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t?.donation?.donationNumberLabel ?? 'رقم الحساب'}:
                  </p>
                </div>

                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-slate-700 dark:to-slate-600 rounded-xl p-6 mb-8">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-teal-600 dark:text-teal-400 tracking-wider">
                        {donationNumber}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {selectedBank}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleCopy}
                        className="p-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-all duration-300 transform hover:scale-110"
                        aria-label="Copy number"
                      >
                        {copied ? <CheckCircle2 className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                      </button>

                      <a
                        href={`https://wa.me/32203250?text=${encodeURIComponent('أريد التبرع عبر ' + selectedBank)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold shadow"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {language === 'ar' ? 'أخبرنا عبر الواتس' : language === 'fr' ? 'Contactez-nous' : 'Contact us'}
                      </a>
                    </div>
                  </div>

                  {copied && (
                    <p className="text-sm text-green-600 dark:text-green-400 animate-fadeIn">
                      ✓ {language === 'ar' ? 'تم النسخ!' : language === 'fr' ? 'Copié!' : 'Copied!'}
                    </p>
                  )}
                </div>

                <p className={`text-gray-700 dark:text-gray-300 mb-6 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t?.donation?.successMessage ?? 'شكراً لدعمكم—تذكروا إرسال إثبات التحويل عبر الواتس للمساعدة في المتابعة.'}
                </p>

                <button
                  onClick={handleBack}
                  className="block w-full mt-4 px-6 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors duration-300"
                >
                  {language === 'ar' ? 'العودة' : language === 'fr' ? 'Retour' : 'Back'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
