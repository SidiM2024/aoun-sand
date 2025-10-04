import { useState } from 'react';
import { Heart, CheckCircle2, Copy, MessageCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Bank {
  name: string;
  image: string;
}

export const Donation = () => {
  const { t, language } = useLanguage();
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const donationNumber = '32203250';

  const handleCopy = () => {
    navigator.clipboard.writeText(donationNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBankSelect = (bank: string) => {
    setSelectedBank(bank);
  };

  const handleBack = () => {
    setSelectedBank(null);
  };

  const banks: Bank[] = [
    { name: 'بنكيلي', image: '/bank.jpg' },
    { name: 'مصرفي', image: '/mas.jpg' },
    { name: 'السداد', image: '/salad.jpg' },
    { name: 'بيم بانك', image: '/bin.jpg' },
    { name: 'غازا بي', image: '/Gaza.jpg' },
    { name: 'كليك', image: '/klik.jpg' },
  ];

  return (
    <section
      id="donate"
      className="py-20 bg-gradient-to-br from-rose-50 via-pink-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          {!selectedBank ? (
            <>
              <div className="text-center mb-12 animate-fadeIn">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-full mb-6 shadow-2xl">
                  <Heart className="w-10 h-10 text-white animate-pulse" />
                </div>
                <h2 className={`section-title ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t.donation.title}
                </h2>
                <p className={`text-xl text-gray-600 dark:text-gray-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t.donation.subtitle}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 animate-slideUp">
                {banks.map((bank, index) => (
                  <button
                    key={index}
                    onClick={() => handleBankSelect(bank.name)}
                    className="group flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-full shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 hover:scale-105"
                    style={{ animationDelay: `${index * 0.08}s` }}
                    aria-label={`اختر ${bank.name}`}
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center mb-3">
                      <img
                        src={bank.image}
                        alt={bank.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className={`text-lg font-bold text-gray-800 dark:text-white text-center ${language === 'ar' ? 'font-arabic' : ''}`}>
                      {bank.name}
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
                    {t.donation.successTitle}
                  </h3>
                  <p className={`text-gray-600 dark:text-gray-300 mb-2 ${language === 'ar' ? 'font-arabic' : ''}`}>
                    {t.donation.donationNumber}:
                  </p>
                </div>

                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-slate-700 dark:to-slate-600 rounded-xl p-6 mb-8">
                  <div className="flex flex-col items-center justify-center gap-4 mb-4">
                    <p className="text-4xl font-bold text-teal-600 dark:text-teal-400 tracking-wider">
                      {donationNumber}
                    </p>
                    <button
                      onClick={handleCopy}
                      className="p-3 bg-teal-500 hover:bg-teal-600 text-white rounded-full transition-all duration-300 transform hover:scale-110"
                      aria-label="Copy number"
                    >
                      {copied ? <CheckCircle2 className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                    </button>
                  </div>
                  {copied && (
                    <p className="text-sm text-green-600 dark:text-green-400 animate-fadeIn">
                      ✓ {language === 'ar' ? 'تم النسخ!' : language === 'fr' ? 'Copié!' : 'Copied!'}
                    </p>
                  )}
                </div>

                <p className={`text-gray-700 dark:text-gray-300 mb-6 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t.donation.successMessage}
                </p>

                <a
                  href="https://wa.me/32203250?text=%D9%85%D8%AA%D8%A8%D8%B1%D8%B9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 mb-6"
                >
                  <MessageCircle className="w-6 h-6" />
                  {t.donation.contactMessage}
                </a>

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
