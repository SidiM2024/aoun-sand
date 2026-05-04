import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

export const AuthPage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, isAdmin } = useAuth();
  const isRTL = language === 'ar';

  React.useEffect(() => {
    if (user || isAdmin) {
      navigate('/', { replace: true });
    }
  }, [user, isAdmin, navigate]);

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'check' | 'signup'>('check');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Check/Login form
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Signup extra fields
  const [fullName, setFullName] = useState('');
  const [membershipType, setMembershipType] = useState('عضو');
  const [currentStatus, setCurrentStatus] = useState('أدرس');
  const [location, setLocation] = useState('');
  const [nationalId, setNationalId] = useState('');

  const validatePhone = (p: string) => {
    return /^[234]\d{7}$/.test(p);
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!email || !phone) {
      setErrorMsg(isRTL ? 'الرجاء إدخال البريد الإلكتروني ورقم الهاتف' : 'Please enter email and phone');
      return;
    }

    if (!validatePhone(phone)) {
      setErrorMsg(isRTL ? 'رقم الهاتف غير صالح. يجب أن يتكون من 8 أرقام ويبدأ بـ 2، 3، أو 4.' : 'Invalid phone. Must be 8 digits and start with 2, 3, or 4.');
      return;
    }
    
    setIsLoading(true);
    // Append a secure suffix to phone to ensure it meets any password requirements (min 6 chars)
    const securePassword = `${phone}Awn1!`;

    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: securePassword,
    });

    if (error) {
      if (error.message === 'Failed to fetch') {
        setErrorMsg(isRTL ? 'تعذر الاتصال بالخادم، يرجى التأكد من اتصالك بالإنترنت.' : 'Failed to connect to the server. Please check your internet connection.');
      } else if (error.message.includes('Invalid login credentials')) {
        // User not found or wrong password (phone). Assume not found and go to signup.
        setStep('signup');
        setErrorMsg(''); // Clear error on step change
      } else {
        setErrorMsg(error.message);
      }
    } else {
      toast.success(isRTL ? 'تم تسجيل الدخول بنجاح!' : 'Logged in successfully!');
      navigate('/');
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!validatePhone(phone)) {
      setErrorMsg(isRTL ? 'رقم الهاتف غير صالح. يجب أن يتكون من 8 أرقام ويبدأ بـ 2، 3، أو 4.' : 'Invalid phone. Must be 8 digits and start with 2, 3, or 4.');
      return;
    }

    setIsLoading(true);
    const securePassword = `${phone}Awn1!`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password: securePassword,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
          membership_type: membershipType,
          current_status: currentStatus,
          location,
          national_id: nationalId
        }
      }
    });

    if (error) {
      if (error.message === 'Failed to fetch') {
        setErrorMsg(isRTL ? 'تعذر الاتصال بالخادم، يرجى التأكد من اتصالك بالإنترنت.' : 'Failed to connect to the server. Please check your internet connection.');
      } else {
        setErrorMsg(error.message);
      }
    } else {
      // Insert into users table
      if (data.user) {
        const { error: dbError } = await supabase.from('users').insert([{
          id: data.user.id,
          full_name: fullName,
          email: email,
          phone: phone,
          membership_type: membershipType,
          current_status: currentStatus,
          location: location,
          national_id: nationalId
        }]);
        if (dbError) {
          console.error("DB Insert Error:", dbError);
          // Don't block login if insert fails (maybe already exists), but show warning
        }
        
        // Auto sign-in just in case signUp didn't create a session (depends on Supabase settings)
        if (!data.session) {
          await supabase.auth.signInWithPassword({
            email,
            password: securePassword,
          });
        }

        toast.success(isRTL ? 'تم إنشاء الحساب وتسجيل الدخول بنجاح!' : 'Account created and logged in successfully!');
        navigate('/');
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-slate-900 dark:to-indigo-950">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/50"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
            {isRTL ? 'مرحباً بك' : 'Welcome'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed">
            {step === 'check' 
              ? (isRTL 
                ? 'الرجاء إدخال البريد الإلكتروني ورقم الهاتف (8 أرقام). إذا كان لديك حساب سيتم تسجيل الدخول، وإلا سيتم توجيهك لإنشاء حساب جديد.' 
                : 'Please enter your email and 8-digit phone number. If registered, you will be logged in; otherwise, you will be redirected to sign up.')
              : (isRTL 
                ? 'أكمل بياناتك لإنشاء الحساب' 
                : 'Complete your details to sign up')}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm border border-red-200 dark:border-red-800"
            >
              {errorMsg}
            </motion.div>
          )}

          {step === 'check' ? (
            <motion.form 
              key="check"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleCheck} 
              className="space-y-5"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isRTL ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isRTL ? 'رقم الهاتف' : 'Phone Number'}
                </label>
                <input 
                  type="tel" 
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  dir="ltr"
                />
              </div>
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/30 transform transition-all active:scale-95 disabled:opacity-70"
              >
                {isLoading ? (isRTL ? 'جاري التحقق...' : 'Checking...') : (isRTL ? 'متابعة' : 'Continue')}
              </button>
            </motion.form>
          ) : (
            <motion.form 
              key="signup"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSignup} 
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isRTL ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <input 
                  type="text" 
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isRTL ? 'نوع الانتساب' : 'Membership'}
                  </label>
                  <select 
                    value={membershipType}
                    onChange={(e) => setMembershipType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="عضو">{isRTL ? 'عضو' : 'Member'}</option>
                    <option value="منتسب">{isRTL ? 'منتسب' : 'Affiliate'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isRTL ? 'الحالة الحالية' : 'Status'}
                  </label>
                  <select 
                    value={currentStatus}
                    onChange={(e) => setCurrentStatus(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="أدرس">{isRTL ? 'أدرس' : 'Studying'}</option>
                    <option value="أعمل">{isRTL ? 'أعمل' : 'Working'}</option>
                    <option value="لا شيء">{isRTL ? 'لا شيء' : 'None'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isRTL ? 'مكان السكن' : 'Location'}
                </label>
                <input 
                  type="text" 
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isRTL ? 'الرقم الوطني' : 'National ID'}
                </label>
                <input 
                  type="text" 
                  required
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setStep('check')}
                  className="w-1/3 py-3 px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition-all"
                >
                  {isRTL ? 'رجوع' : 'Back'}
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-2/3 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/30 transform transition-all active:scale-95 disabled:opacity-70"
                >
                  {isLoading ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء حساب' : 'Sign Up')}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
