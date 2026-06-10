import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { BookOpen, Video, Download, ExternalLink, Calendar, Search, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MahajaCourse {
  id: string;
  title: string;
  description: string;
  content_link: string;
  image_url: string;
  created_at: string;
}

interface MahajaBook {
  id: string;
  title: string;
  description: string;
  download_link: string;
  cover_image_url: string;
  created_at: string;
}

export const MahajaDashboard = () => {
  const { language } = useLanguage();
  const { logout } = useAuth();
  const isRTL = language === 'ar';
  
  const [courses, setCourses] = useState<MahajaCourse[]>([]);
  const [books, setBooks] = useState<MahajaBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'courses' | 'books'>('courses');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [coursesRes, booksRes] = await Promise.all([
          supabase.from('mahaja_courses').select('*').eq('is_published', true).order('created_at', { ascending: false }),
          supabase.from('mahaja_books').select('*').eq('is_published', true).order('created_at', { ascending: false })
        ]);
        
        if (coursesRes.data) setCourses(coursesRes.data);
        if (booksRes.data) setBooks(booksRes.data);
      } catch (err) {
        console.error('Error fetching mahaja content:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const filteredCourses = courses.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()) || (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase())));
  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()) || (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase())));

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] pb-24" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header Section */}
      <div className="relative pt-24 pb-12 overflow-hidden bg-gradient-to-br from-teal-900 to-emerald-900">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1584285406087-b649d06634d1?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/20 blur-[120px] pointer-events-none animate-pulse-slow"></div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="absolute top-0 right-4 rtl:left-4 rtl:right-auto">
            <button 
              onClick={logout}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl backdrop-blur-md transition-colors text-sm font-bold border border-white/10"
            >
              <LogOut className="w-4 h-4" />
              {isRTL ? 'تسجيل الخروج' : 'Logout'}
            </button>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-20 h-20 mx-auto bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-xl mb-6 text-emerald-400"
          >
            <BookOpen className="w-10 h-10" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight"
          >
            {isRTL ? 'منصة المحجة البيضاء' : 'Al-Mahaja Al-Baydaa'}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-emerald-100/80 text-lg md:text-xl max-w-2xl mx-auto"
          >
            {isRTL ? 'مكتبة شاملة للدورات العلمية والكتب الإسلامية الموثوقة' : 'A comprehensive library for scientific courses and authentic Islamic books'}
          </motion.p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-2 flex flex-col md:flex-row gap-4 justify-between items-center border border-slate-200 dark:border-slate-700">
          
          <div className="flex gap-2 w-full md:w-auto p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl">
            <button
              onClick={() => setActiveTab('courses')}
              className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all ${
                activeTab === 'courses' 
                  ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Video className="w-5 h-5" />
              {isRTL ? 'الدورات العلمية' : 'Courses'}
            </button>
            <button
              onClick={() => setActiveTab('books')}
              className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all ${
                activeTab === 'books' 
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              {isRTL ? 'الكتب والمراجع' : 'Books'}
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder={isRTL ? 'البحث...' : 'Search...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rtl:pr-11 rtl:pl-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
            <Search className="w-5 h-5 text-slate-400 absolute top-1/2 -translate-y-1/2 left-4 rtl:right-4 rtl:left-auto pointer-events-none" />
          </div>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-white dark:bg-slate-800 rounded-3xl h-80 border border-slate-200 dark:border-slate-700"></div>
              ))}
            </div>
          ) : (
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {activeTab === 'courses' ? (
                filteredCourses.length > 0 ? (
                  filteredCourses.map(course => (
                    <div key={course.id} className="group bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full">
                      <div className="aspect-video w-full bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
                        {course.image_url ? (
                          <img src={course.image_url} alt={course.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-teal-50 dark:bg-teal-900/20">
                            <Video className="w-12 h-12 text-teal-300 dark:text-teal-700" />
                          </div>
                        )}
                        <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5 shadow-sm">
                          <Video className="w-3.5 h-3.5" />
                          {isRTL ? 'دورة' : 'Course'}
                        </div>
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 line-clamp-2">{course.title}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 line-clamp-3 flex-1">{course.description}</p>
                        <a 
                          href={course.content_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full py-3 px-4 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 text-teal-600 dark:text-teal-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors mt-auto"
                        >
                          {isRTL ? 'مشاهدة الدورة' : 'Watch Course'}
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center">
                    <Video className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'لا توجد دورات متاحة' : 'No courses available'}</h3>
                  </div>
                )
              ) : (
                filteredBooks.length > 0 ? (
                  filteredBooks.map(book => (
                    <div key={book.id} className="group bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full">
                      <div className="aspect-[3/4] w-full bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
                        {book.cover_image_url ? (
                          <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20">
                            <BookOpen className="w-16 h-16 text-emerald-300 dark:text-emerald-700" />
                          </div>
                        )}
                        <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 shadow-sm">
                          <BookOpen className="w-3.5 h-3.5" />
                          {isRTL ? 'كتاب' : 'Book'}
                        </div>
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 line-clamp-2">{book.title}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 line-clamp-3 flex-1">{book.description}</p>
                        <a 
                          href={book.download_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full py-3 px-4 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors mt-auto"
                        >
                          {isRTL ? 'تحميل الكتاب' : 'Download Book'}
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center">
                    <BookOpen className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'لا توجد كتب متاحة' : 'No books available'}</h3>
                  </div>
                )
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
