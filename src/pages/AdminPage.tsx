import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, Bell, Vote, Upload, LogOut, CheckCircle2, Trash2, ShieldAlert } from 'lucide-react';

export const AdminPage = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [activeTab, setActiveTab] = useState<'users' | 'notifications' | 'voting' | 'media'>('users');
  
  // Dashboard state
  const [usersCount, setUsersCount] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Notifications state
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMsg, setNotificationMsg] = useState('');
  
  // Voting state
  const [pollTitle, setPollTitle] = useState('');
  const [pollDesc, setPollDesc] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [polls, setPolls] = useState<any[]>([]);

  // Media state
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  useEffect(() => {
    if (localStorage.getItem('admin_auth') === 'true') {
      setIsAuthenticated(true);
      fetchDashboardData();
    }
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    // Fetch users
    const { data: usersData, count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact' });
    if (usersData) {
      setUsers(usersData);
      setUsersCount(usersCount || 0);
    }

    // Fetch polls
    const { data: pollsData } = await supabase
      .from('polls')
      .select('*, poll_options(*), poll_votes(*)');
    if (pollsData) {
      setPolls(pollsData);
    }
    
    setIsLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const envUsername = import.meta.env.VITE_ADMIN_USERNAME;
    const envPassword = import.meta.env.VITE_ADMIN_PASSWORD;

    if (username === envUsername && password === envPassword) {
      localStorage.setItem('admin_auth', 'true');
      setIsAuthenticated(true);
      fetchDashboardData();
      toast.success(isRTL ? 'تم تسجيل الدخول بنجاح' : 'Logged in successfully');
    } else {
      toast.error(isRTL ? 'بيانات الدخول خاطئة' : 'Invalid credentials');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    setIsAuthenticated(false);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Save it directly to DB only
      const { error } = await supabase.from('notifications').insert([{
        title: notificationTitle,
        message: notificationMsg
      }]);
      
      if (error) {
        throw error;
      }
      
      toast.success(isRTL ? 'تم إرسال الإشعار بنجاح!' : 'Notification sent successfully!');
      setNotificationTitle('');
      setNotificationMsg('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = pollOptions.filter(o => o.trim() !== '');
    if (validOptions.length < 2) {
      toast.error(isRTL ? 'أضف خيارين على الأقل' : 'Add at least 2 options');
      return;
    }

    const { data: newPoll, error: pollError } = await supabase
      .from('polls')
      .insert([{ title: pollTitle, description: pollDesc }])
      .select()
      .single();

    if (pollError) {
      toast.error(pollError.message);
      return;
    }

    const optionsToInsert = validOptions.map(opt => ({
      poll_id: newPoll.id,
      option_text: opt
    }));

    const { error: optionsError } = await supabase
      .from('poll_options')
      .insert(optionsToInsert);

    if (optionsError) {
      toast.error(optionsError.message);
    } else {
      toast.success(isRTL ? 'تم إنشاء التصويت!' : 'Poll created!');
      setPollTitle('');
      setPollDesc('');
      setPollOptions(['', '']);
      fetchDashboardData();
    }
  };

  const handleDeletePoll = async (id: string) => {
    const { error } = await supabase.from('polls').delete().eq('id', id);
    if (!error) {
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      fetchDashboardData();
    } else {
      toast.error(error.message);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile) return;

    const fileExt = mediaFile.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    setIsLoading(true);
    const { error } = await supabase.storage
      .from('media')
      .upload(filePath, mediaFile);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? 'تم رفع الملف بنجاح' : 'File uploaded successfully');
      setMediaFile(null);
    }
    setIsLoading(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 pt-24">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 border border-slate-200 dark:border-slate-700"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              {isRTL ? 'دخول المسؤول' : 'Admin Login'}
            </h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'اسم المستخدم' : 'Username'}
              </label>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'كلمة المرور' : 'Password'}
              </label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium shadow-lg shadow-red-500/30 transition-all"
            >
              {isRTL ? 'تسجيل الدخول' : 'Sign In'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-24 pb-12">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
              {isRTL ? 'لوحة تحكم الإدارة' : 'Admin Dashboard'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {isRTL ? 'إدارة المستخدمين، الإشعارات، التصويتات والميديا' : 'Manage users, notifications, polls, and media'}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>{isRTL ? 'تسجيل الخروج' : 'Logout'}</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 flex lg:flex-col gap-1 overflow-x-auto">
              {[
                { id: 'users', icon: Users, label: isRTL ? 'المستخدمين' : 'Users' },
                { id: 'notifications', icon: Bell, label: isRTL ? 'الإشعارات' : 'Notifications' },
                { id: 'voting', icon: Vote, label: isRTL ? 'التصويت' : 'Voting' },
                { id: 'media', icon: Upload, label: isRTL ? 'الوسائط' : 'Media' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors whitespace-nowrap ${
                    activeTab === tab.id 
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 min-h-[500px]">
            <AnimatePresence mode="wait">
              {activeTab === 'users' && (
                <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-800 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{usersCount}</h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{isRTL ? 'إجمالي المستخدمين' : 'Total Users'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">{isRTL ? 'قائمة المستخدمين' : 'User List'}</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50">
                          <th className="p-4 text-sm font-medium text-slate-600 dark:text-slate-400">{isRTL ? 'الاسم' : 'Name'}</th>
                          <th className="p-4 text-sm font-medium text-slate-600 dark:text-slate-400">{isRTL ? 'البريد/الهاتف' : 'Email/Phone'}</th>
                          <th className="p-4 text-sm font-medium text-slate-600 dark:text-slate-400">{isRTL ? 'النوع' : 'Type'}</th>
                          <th className="p-4 text-sm font-medium text-slate-600 dark:text-slate-400">{isRTL ? 'الحالة' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u, i) => (
                          <tr key={i} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="p-4 text-slate-800 dark:text-slate-200">{u.full_name}</td>
                            <td className="p-4 text-slate-600 dark:text-slate-400 text-sm">
                              <div>{u.email}</div>
                              <div>{u.phone}</div>
                            </td>
                            <td className="p-4 text-slate-800 dark:text-slate-200">{u.membership_type}</td>
                            <td className="p-4 text-slate-800 dark:text-slate-200">{u.current_status}</td>
                          </tr>
                        ))}
                        {users.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-500">
                              {isRTL ? 'لا يوجد مستخدمين بعد' : 'No users yet'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {activeTab === 'notifications' && (
                <motion.div key="notifications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">
                    {isRTL ? 'إرسال إشعار للجميع' : 'Send Broadcast Notification'}
                  </h3>
                  <form onSubmit={handleSendNotification} className="max-w-2xl space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {isRTL ? 'عنوان الإشعار' : 'Title'}
                      </label>
                      <input 
                        type="text" 
                        required
                        value={notificationTitle}
                        onChange={(e) => setNotificationTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {isRTL ? 'نص الإشعار' : 'Message'}
                      </label>
                      <textarea 
                        required
                        rows={4}
                        value={notificationMsg}
                        onChange={(e) => setNotificationMsg(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium shadow-md transition-colors"
                    >
                      {isLoading ? (isRTL ? 'جاري الإرسال...' : 'Sending...') : (isRTL ? 'إرسال الإشعار' : 'Send Notification')}
                    </button>
                  </form>
                </motion.div>
              )}

              {activeTab === 'voting' && (
                <motion.div key="voting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">
                    {isRTL ? 'إنشاء تصويت جديد' : 'Create New Poll'}
                  </h3>
                  <form onSubmit={handleCreatePoll} className="max-w-2xl space-y-4 mb-12">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {isRTL ? 'عنوان التصويت' : 'Poll Title'}
                      </label>
                      <input 
                        type="text" required
                        value={pollTitle} onChange={(e) => setPollTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {isRTL ? 'الوصف' : 'Description'}
                      </label>
                      <textarea 
                        rows={2}
                        value={pollDesc} onChange={(e) => setPollDesc(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {isRTL ? 'الخيارات' : 'Options'}
                      </label>
                      {pollOptions.map((opt, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder={`${isRTL ? 'خيار' : 'Option'} ${idx + 1}`}
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...pollOptions];
                              newOpts[idx] = e.target.value;
                              setPollOptions(newOpts);
                            }}
                            className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      ))}
                      <button 
                        type="button" 
                        onClick={() => setPollOptions([...pollOptions, ''])}
                        className="text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:underline"
                      >
                        {isRTL ? '+ إضافة خيار آخر' : '+ Add another option'}
                      </button>
                    </div>
                    <button 
                      type="submit" 
                      className="py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium shadow-md transition-colors"
                    >
                      {isRTL ? 'حفظ التصويت' : 'Save Poll'}
                    </button>
                  </form>

                  <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">
                    {isRTL ? 'التصويتات الحالية' : 'Active Polls'}
                  </h3>
                  <div className="space-y-4">
                    {polls.map((poll: any) => (
                      <div key={poll.id} className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-bold text-lg text-slate-800 dark:text-white">{poll.title}</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{poll.description}</p>
                          </div>
                          <button 
                            onClick={() => handleDeletePoll(poll.id)}
                            className="text-red-500 hover:text-red-700 p-2"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {poll.poll_options?.map((opt: any) => {
                            const votesCount = poll.poll_votes?.filter((v: any) => v.option_id === opt.id).length || 0;
                            return (
                              <div key={opt.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                <span>{opt.option_text}</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{votesCount} {isRTL ? 'أصوات' : 'votes'}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-4 text-sm text-slate-500">
                          {isRTL ? 'إجمالي المصوتين:' : 'Total Voters:'} {poll.poll_votes?.length || 0}
                        </div>
                      </div>
                    ))}
                    {polls.length === 0 && (
                      <p className="text-slate-500 text-center py-4">{isRTL ? 'لا توجد تصويتات' : 'No polls found'}</p>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'media' && (
                <motion.div key="media" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">
                    {isRTL ? 'رفع الوسائط (صور / صوتيات)' : 'Upload Media (Images / Audio)'}
                  </h3>
                  <form onSubmit={handleFileUpload} className="max-w-xl">
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-8 text-center bg-slate-50 dark:bg-slate-900/50 mb-6">
                      <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden"
                        accept="image/*,audio/*"
                        onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                      />
                      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-4">
                          <Upload className="w-8 h-8" />
                        </div>
                        <span className="text-slate-700 dark:text-slate-300 font-medium text-lg">
                          {mediaFile ? mediaFile.name : (isRTL ? 'اضغط لاختيار ملف' : 'Click to select a file')}
                        </span>
                        <span className="text-slate-500 text-sm mt-2">
                          {isRTL ? 'يدعم الصور والملفات الصوتية' : 'Supports images and audio files'}
                        </span>
                      </label>
                    </div>
                    <button 
                      type="submit" 
                      disabled={!mediaFile || isLoading}
                      className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium shadow-md transition-colors"
                    >
                      {isLoading ? (isRTL ? 'جاري الرفع...' : 'Uploading...') : (isRTL ? 'رفع الملف' : 'Upload File')}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
