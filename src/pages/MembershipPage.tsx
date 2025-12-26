import { CheckCircle2, Users, CreditCard, User, Mail, Phone, ShieldCheck, Lock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useState } from 'react';

export const MembershipPage = () => {
  const { t, language } = useLanguage();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    membershipType: 'standard',
    cardNumber: '',
    expiryDate: '',
    cvv: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(prev => prev + 1);
    } else {
      // Mock submission
      alert(language === 'ar' ? 'تم استلام طلب العضوية بنجاح!' : 'Membership application received successfully!');
      setStep(1);
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        membershipType: 'standard',
        cardNumber: '',
        expiryDate: '',
        cvv: ''
      });
    }
  };

  const benefits = t.membership.benefits.map((benefit, index) => ({
    text: benefit,
  }));

  return (
    <div className="pt-24 pb-16 min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container-custom">
        {/* Header Section */}
        <div className="text-center mb-12 animate-fadeIn">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full mb-6 shadow-xl">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="section-title mb-4">
            {t.membership.title}
          </h1>
          <p className="section-subtitle">
            {t.membership.subtitle}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Benefits Section */}
          <div className="space-y-8 animate-slideLeft">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-700">
              <h2 className="text-2xl font-bold mb-6 text-teal-600 dark:text-teal-400 flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8" />
                {t.membership.benefitsTitle}
              </h2>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 bg-teal-100 dark:bg-teal-900/50 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium pt-1">
                      {benefit.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-teal-600 to-cyan-600 rounded-2xl shadow-xl p-8 text-white text-center">
              <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-90" />
              <h3 className="text-2xl font-bold mb-2">
                {language === 'ar' ? 'دفع آمن ومحمي' : 'Secure & Protected Payment'}
              </h3>
              <p className="opacity-90">
                {language === 'ar'
                  ? 'جميع معاملاتك مشفرة ومحمية بأحدث تقنيات الأمان'
                  : 'All your transactions are encrypted and protected with the latest security technologies'}
              </p>
            </div>
          </div>

          {/* Membership Form */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-100 dark:border-slate-700 animate-slideRight">
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-8 relative">
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-200 dark:bg-slate-700 -z-10"></div>
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${step >= s
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/30 scale-110'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                >
                  {s}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <User className="w-5 h-5 text-teal-500" />
                    {language === 'ar' ? 'المعلومات الشخصية' : 'Personal Information'}
                  </h3>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                    </label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className="input-field pr-10"
                        placeholder={language === 'ar' ? 'أدخل اسمك الكامل' : 'Enter your full name'}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                    </label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="input-field pr-10"
                        placeholder="example@domain.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                    </label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="input-field pr-10"
                        placeholder="+222 ..."
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 animate-fadeIn">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-500" />
                    {language === 'ar' ? 'نوع العضوية' : 'Membership Type'}
                  </h3>

                  <div className="grid gap-4">
                    <label className={`relative flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.membershipType === 'standard'
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-teal-200'
                      }`}>
                      <input
                        type="radio"
                        name="membershipType"
                        value="standard"
                        checked={formData.membershipType === 'standard'}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                      />
                      <div className="mr-4 flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800 dark:text-white">
                            {language === 'ar' ? 'عضوية عادية' : 'Standard Membership'}
                          </span>
                          <span className="text-teal-600 dark:text-teal-400 font-bold">
                            1000 MRU / {language === 'ar' ? 'سنة' : 'Year'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          {language === 'ar' ? 'جميع الميزات الأساسية' : 'All basic features included'}
                        </p>
                      </div>
                    </label>

                    <label className={`relative flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.membershipType === 'premium'
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-teal-200'
                      }`}>
                      <input
                        type="radio"
                        name="membershipType"
                        value="premium"
                        checked={formData.membershipType === 'premium'}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                      />
                      <div className="mr-4 flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800 dark:text-white">
                            {language === 'ar' ? 'عضوية ذهبية' : 'Premium Membership'}
                          </span>
                          <span className="text-teal-600 dark:text-teal-400 font-bold">
                            2500 MRU / {language === 'ar' ? 'سنة' : 'Year'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          {language === 'ar' ? 'ميزات إضافية ودعم خاص' : 'Extra features and priority support'}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6 animate-fadeIn">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-teal-500" />
                    {language === 'ar' ? 'بيانات الدفع' : 'Payment Details'}
                  </h3>

                  <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-slate-600 dark:text-slate-400">
                        {language === 'ar' ? 'المبلغ الإجمالي' : 'Total Amount'}
                      </span>
                      <span className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                        {formData.membershipType === 'standard' ? '1000' : '2500'} MRU
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-12 bg-white rounded border border-slate-200 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">VISA</span>
                      </div>
                      <div className="h-8 w-12 bg-white rounded border border-slate-200 flex items-center justify-center">
                        <span className="text-xs font-bold text-red-500">MC</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {language === 'ar' ? 'رقم البطاقة' : 'Card Number'}
                      </label>
                      <div className="relative">
                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                          type="text"
                          name="cardNumber"
                          value={formData.cardNumber}
                          onChange={handleInputChange}
                          className="input-field pr-10 font-mono"
                          placeholder="0000 0000 0000 0000"
                          maxLength={19}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {language === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}
                        </label>
                        <input
                          type="text"
                          name="expiryDate"
                          value={formData.expiryDate}
                          onChange={handleInputChange}
                          className="input-field text-center"
                          placeholder="MM/YY"
                          maxLength={5}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          CVV
                        </label>
                        <input
                          type="text"
                          name="cvv"
                          value={formData.cvv}
                          onChange={handleInputChange}
                          className="input-field text-center"
                          placeholder="123"
                          maxLength={3}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(prev => prev - 1)}
                    className="w-full py-3 rounded-xl font-bold border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {language === 'ar' ? 'السابق' : 'Back'}
                  </button>
                )}
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-lg shadow-teal-500/30 hover:shadow-xl hover:scale-[1.02] transition-all"
                >
                  {step === 3
                    ? (language === 'ar' ? 'إتمام الدفع' : 'Complete Payment')
                    : (language === 'ar' ? 'التالي' : 'Next')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
