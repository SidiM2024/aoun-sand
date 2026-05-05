import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LogOut, User, Phone, Mail, MapPin, CreditCard, Activity, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

export const AccountPage = () => {
  const { user, userProfile, logout } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const details = userProfile ? [
    { label: isRTL ? 'الاسم الكامل' : 'Full Name', value: userProfile.full_name, icon: User },
    { label: isRTL ? 'البريد الإلكتروني' : 'Email', value: userProfile.email, icon: Mail },
    { label: isRTL ? 'رقم الهاتف' : 'Phone', value: userProfile.phone, icon: Phone },
    { label: isRTL ? 'الرقم الوطني' : 'National ID', value: userProfile.national_id, icon: FileText },
    { label: isRTL ? 'الانتساب' : 'Membership', value: userProfile.membership_type, icon: CreditCard },
    { label: isRTL ? 'الحالة الحالية' : 'Status', value: userProfile.current_status, icon: Activity },
    { label: isRTL ? 'السكن' : 'Location', value: userProfile.location, icon: MapPin },
  ] : [
    { label: isRTL ? 'البريد الإلكتروني' : 'Email', value: user?.email || '', icon: Mail },
  ];

  return (
    <div className="min-h-screen pt-20 pb-24 px-4 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-md mx-auto space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 text-center"
        >
          <div className="w-20 h-20 bg-teal-100 dark:bg-teal-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-teal-600 dark:text-teal-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">{userProfile?.full_name || (isRTL ? 'مستخدم' : 'User')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{userProfile?.email || user?.email}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden"
        >
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-white">{isRTL ? 'المعلومات الشخصية' : 'Personal Information'}</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {details.map((detail, idx) => (
              <div key={idx} className="p-4 flex items-center gap-4">
                <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg text-teal-600 dark:text-teal-400">
                  <detail.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{detail.label}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{detail.value}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={logout}
          className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>{isRTL ? 'تسجيل الخروج' : 'Log Out'}</span>
        </motion.button>
      </div>
    </div>
  );
};
