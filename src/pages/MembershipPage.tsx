import { Users, Send, User, Phone, MapPin, CreditCard, Star } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useState } from 'react';

export const MembershipPage = () => {
  const { language } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    state: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Construct WhatsApp Message
    const message = `*طلب انتساب جديد*%0A%0A*الاسم:* ${formData.name}%0A*الهاتف:* ${formData.phone}%0A*الولاية:* ${formData.state}`;
    const whatsappUrl = `https://wa.me/22232203250?text=${message}`;

    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');

    // Reset Form
    setFormData({ name: '', phone: '', state: '' });
  };

  return (
    <div className="pt-24 pb-16 min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="container-custom">

        {/* Header Section */}
        <div className="text-center mb-16 animate-fadeIn">
          <h1 className="section-title mb-4">
            {language === 'ar' ? 'صفحة الانتساب' : 'Membership Page'}
          </h1>
          <p className="section-subtitle max-w-2xl mx-auto">
            {language === 'ar'
              ? 'انضم إلينا الآن وكن شريكاً في الخير والعطاء'
              : 'Join us now and be a partner in giving and goodness'}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">

          {/* Section 1: Monthly Fee Payment */}
          <div className="order-2 lg:order-1 animate-slideRight">
            <div className="bg-gradient-to-br from-teal-600 to-cyan-700 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group">
              {/* Decorative Background Circles */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-900/20 rounded-full translate-y-16 -translate-x-16 blur-2xl"></div>

              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
                  <CreditCard className="w-8 h-8 text-white" />
                </div>

                <h2 className="text-3xl font-bold mb-4">
                  {language === 'ar' ? 'دفع الرسوم الشهرية' : 'Monthly Fee Payment'}
                </h2>

                <p className="text-teal-100 text-lg mb-8 leading-relaxed">
                  {language === 'ar'
                    ? 'مساهمتك الشهرية تضمن استمرار أنشطتنا وتساعد في وصول الخير لأكبر عدد من المستفيدين.'
                    : 'Your monthly contribution ensures the continuity of our activities and helps reach more beneficiaries.'}
                </p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full"><Star className="w-4 h-4" /></div>
                    <span>{language === 'ar' ? 'دعم مستمر للمشاريع الخيرية' : 'Continuous support for charity projects'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full"><Users className="w-4 h-4" /></div>
                    <span>{language === 'ar' ? 'عضوية فاعلة في المجتمع' : 'Active membership in the community'}</span>
                  </div>
                </div>

                <div className="bg-white/10 rounded-xl p-6 backdrop-blur-md border border-white/20">
                  <p className="text-sm text-teal-200 mb-1">{language === 'ar' ? 'للإستفسار أو الدفع يرجى التواصل على:' : 'For inquiries or payment please contact:'}</p>
                  <p className="text-2xl font-bold font-mono tracking-wider">32203250</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Membership Form */}
          <div className="order-1 lg:order-2 animate-slideLeft">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-8">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <Send className="w-6 h-6 text-teal-600" />
                {language === 'ar' ? 'استمارة الانتساب' : 'Membership Form'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {language === 'ar' ? 'الاسم' : 'Name'}
                  </label>
                  <div className="relative">
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 rtl:right-4 rtl:left-auto ltr:left-auto ltr:right-4" />
                    {/* Lucide icons direction might need explicit handling in RTL if not auto-mirrored, but absolute positioning needs care. 
                                            In RTL layout (dir="rtl"), "right-4" places it on the right start. 
                                            Let's use a simpler approach for the icon position based on the input padding.
                                        */}
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      {/* Icon placeholder for better positioning control manually if needed, 
                                               but the previous code used absolute right-3. 
                                               Let's stick to standard input group styling. */}
                    </div>

                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 outline-none transition-all pr-10" // pr-10 for icon space
                      placeholder={language === 'ar' ? 'أدخل اسمك الكريم' : 'Enter your name'}
                      required
                    />
                    <User className="absolute top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 right-3" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 outline-none transition-all pr-10"
                      placeholder="32203250"
                      required
                    />
                    <Phone className="absolute top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 right-3" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {language === 'ar' ? 'الولاية' : 'State'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-teal-500 outline-none transition-all pr-10"
                      placeholder={language === 'ar' ? 'نواكشوط، ...' : 'Nouakchott, ...'}
                      required
                    />
                    <MapPin className="absolute top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 right-3" />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-xl font-bold text-lg bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  {language === 'ar' ? 'إرسال الطلب' : 'Submit Application'}
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
