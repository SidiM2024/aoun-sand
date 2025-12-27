import { useState } from 'react';
import { Users, CreditCard, Star, Phone, ArrowRight, ArrowLeft, UserPlus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const MembershipPage = () => {
  const { language } = useLanguage();
  const [viewMode, setViewMode] = useState<'SELECTION' | 'FORM' | 'PAYMENT'>('SELECTION');

  // WhatsApp redirection function
  const handlePaymentClick = (type: 'MEMBER' | 'ASSOCIATE') => {
    const phoneNumber = '22232203250'; // Mauritania code +222
    const userType = type === 'MEMBER' ? 'منتسب' : 'عضو';

    // Message: أنا .......... قد أرسلت رسوم انتسابي لشهر .......... بصفتي (منتسب / عضو).
    const message = `أنا .......... قد أرسلت رسوم انتسابي لشهر .......... بصفتي ${userType}.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
  };

  const isAr = language === 'ar';

  return (
    <div className="pt-24 pb-16 min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="container-custom">

        {/* Header Section */}
        <div className="text-center mb-12 animate-fadeIn">
          <h1 className="section-title mb-4">
            {isAr ? 'صفحة الانتساب' : 'Membership Page'}
          </h1>
          <p className="section-subtitle max-w-2xl mx-auto">
            {isAr
              ? 'انضم إلينا الآن وكن شريكاً في الخير والعطاء'
              : 'Join us now and be a partner in giving and goodness'}
          </p>
        </div>

        <div className="max-w-4xl mx-auto">

          {/* Main Content Area */}
          <div className="relative min-h-[400px]">

            {/* VIEW: SELECTION */}
            {viewMode === 'SELECTION' && (
              <div className="grid md:grid-cols-2 gap-6 md:gap-8 animate-slideUp">
                {/* Option 1: Membership (Form) */}
                <button
                  onClick={() => setViewMode('FORM')}
                  className="group relative overflow-hidden bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-100 dark:border-slate-700 text-center flex flex-col items-center justify-center min-h-[300px]"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-16 translate-x-16 blur-2xl group-hover:bg-blue-500/20 transition-all"></div>

                  <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <UserPlus className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  </div>

                  <h3 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white">
                    {isAr ? 'الانتساب' : 'Membership'}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {isAr ? 'املأ استمارة الانتساب لتصبح جزءاً من عائلتنا' : 'Fill out the membership form to become part of our family'}
                  </p>
                </button>

                {/* Option 2: Pay Fees */}
                <button
                  onClick={() => setViewMode('PAYMENT')}
                  className="group relative overflow-hidden bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-100 dark:border-slate-700 text-center flex flex-col items-center justify-center min-h-[300px]"
                >
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-500/10 rounded-full translate-y-16 -translate-x-16 blur-2xl group-hover:bg-teal-500/20 transition-all"></div>

                  <div className="w-20 h-20 bg-teal-100 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <CreditCard className="w-10 h-10 text-teal-600 dark:text-teal-400" />
                  </div>

                  <h3 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white">
                    {isAr ? 'دفع رسوم الانتساب' : 'Pay Membership Fees'}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {isAr ? 'سديد رسوم عضويتك الشهرية بسهولة' : 'Easily pay your monthly membership fees'}
                  </p>
                </button>
              </div>
            )}

            {/* VIEW: FORM */}
            {viewMode === 'FORM' && (
              <div className="animate-fadeIn">
                <button
                  onClick={() => setViewMode('SELECTION')}
                  className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors"
                >
                  {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
                  <span>{isAr ? 'رجوع' : 'Back'}</span>
                </button>

                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
                  <div className="relative w-full h-[1400px] md:h-[1300px]">
                    <iframe
                      src="https://docs.google.com/forms/d/e/1FAIpQLSe68xfuS3BNgHDJjWsd8Lr-CXm69EE4cyknp0uqRNkfU6p5_w/viewform?embedded=true"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      title="Membership Form"
                      className="absolute inset-0 w-full h-full"
                    >
                      Loading…
                    </iframe>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: PAYMENT */}
            {viewMode === 'PAYMENT' && (
              <div className="animate-fadeIn max-w-2xl mx-auto">
                <button
                  onClick={() => setViewMode('SELECTION')}
                  className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors"
                >
                  {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
                  <span>{isAr ? 'رجوع' : 'Back'}</span>
                </button>

                <div className="bg-gradient-to-br from-teal-600 to-cyan-700 rounded-3xl p-8 md:p-12 text-white shadow-2xl relative overflow-hidden text-center">
                  {/* Decorative Background */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-900/20 rounded-full translate-y-16 -translate-x-16 blur-2xl"></div>

                  <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-8">
                      {isAr ? 'اختر صفتك' : 'Choose Your Status'}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                      <button
                        onClick={() => handlePaymentClick('MEMBER')}
                        className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-2xl p-6 transition-all transform hover:scale-105"
                      >
                        <UserPlus className="w-12 h-12 mx-auto mb-4 text-white" />
                        <span className="text-xl font-bold block">{isAr ? 'منتسب' : 'Member'}</span>
                      </button>

                      <button
                        onClick={() => handlePaymentClick('ASSOCIATE')}
                        className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-2xl p-6 transition-all transform hover:scale-105"
                      >
                        <Users className="w-12 h-12 mx-auto mb-4 text-white" />
                        <span className="text-xl font-bold block">{isAr ? 'عضو' : 'Associate'}</span>
                      </button>
                    </div>

                    <p className="text-teal-100 mb-8 max-w-lg mx-auto">
                      {isAr
                        ? 'سيتم توجيهك تلقائياً إلى واتساب لإرسال رسالة تأكيد الدفع.'
                        : 'You will be automatically redirected to WhatsApp to send the payment confirmation message.'}
                    </p>

                    <div className="inline-block bg-white/10 rounded-xl p-4 backdrop-blur-md border border-white/10">
                      <div className="flex items-center gap-3 justify-center mb-1 text-teal-200 text-sm">
                        <Phone className="w-4 h-4" />
                        <span>{isAr ? 'للاستفسار' : 'For inquiries'}</span>
                      </div>
                      <p className="text-xl font-mono font-bold tracking-widest">32203250</p>
                    </div>

                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
