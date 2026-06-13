import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { BookOpen, Video, Plus, Trash2, Edit2, Save, X, Image as ImageIcon, FileText, UploadCloud } from 'lucide-react';

export const MahajaTab = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [activeSubTab, setActiveSubTab] = useState<'courses' | 'books'>('courses');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  useEffect(() => {
    fetchItems();
  }, [activeSubTab]);

  const fetchItems = async () => {
    setLoading(true);
    const table = activeSubTab === 'courses' ? 'mahaja_courses' : 'mahaja_books';
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    
    if (error) {
      toast.error(isRTL ? 'خطأ في جلب البيانات' : 'Error fetching data');
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const handleAddNew = () => {
    const newItem: any = {
      id: 'new',
      title: '',
      description: '',
      is_published: false,
    };
    if (activeSubTab === 'courses') {
      newItem['content_link' as keyof typeof newItem] = '';
      newItem['image_url' as keyof typeof newItem] = '';
    } else {
      newItem['download_link' as keyof typeof newItem] = '';
      newItem['cover_image_url' as keyof typeof newItem] = '';
    }
    setItems([newItem, ...items]);
    setIsEditing('new');
    setEditForm(newItem);
  };

  const handleSave = async (id: string) => {
    const table = activeSubTab === 'courses' ? 'mahaja_courses' : 'mahaja_books';
    const isNew = id === 'new';
    
    // basic validation
    if (!editForm.title) {
      toast.error(isRTL ? 'العنوان مطلوب' : 'Title is required');
      return;
    }

    const { id: _, created_at, updated_at, ...saveData } = editForm;

    try {
      if (isNew) {
        const { error } = await supabase.from(table).insert([saveData]);
        if (error) throw error;
        toast.success(isRTL ? 'تمت الإضافة بنجاح' : 'Added successfully');
      } else {
        const { error } = await supabase.from(table).update(saveData).eq('id', id);
        if (error) throw error;
        toast.success(isRTL ? 'تم التحديث بنجاح' : 'Updated successfully');
      }
      setIsEditing(null);
      fetchItems();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'new') {
      setItems(items.filter(i => i.id !== 'new'));
      setIsEditing(null);
      return;
    }
    if (!window.confirm(isRTL ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?')) return;
    
    const table = activeSubTab === 'courses' ? 'mahaja_courses' : 'mahaja_books';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? 'تم الحذف بنجاح' : 'Deleted successfully');
      fetchItems();
    }
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'الرجاء اختيار ملف صورة صالح' : 'Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الصورة يجب أن لا يتجاوز 5 ميجابايت' : 'Image size must be less than 5MB');
      return;
    }

    // Sanitize file name
    const fileExt = file.name.split('.').pop();
    const safeName = file.name.replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `mahaja-${Date.now()}-${safeName.substring(0, 10)}.${fileExt}`;

    try {
      toast.loading(isRTL ? 'جاري الرفع...' : 'Uploading...', { id: 'upload' });
      
      const { data, error } = await supabase.storage.from('mahaja_content').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
      
      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(error.message);
      }
      
      const { data: urlData } = supabase.storage.from('mahaja_content').getPublicUrl(fileName);
      const url = urlData.publicUrl;
      
      const imageField = activeSubTab === 'courses' ? 'image_url' : 'cover_image_url';
      setEditForm({ ...editForm, [imageField]: url });
      
      toast.success(isRTL ? 'تم رفع الصورة' : 'Image uploaded', { id: 'upload' });
    } catch (err: any) {
      console.error('Upload failed catch block:', err);
      toast.error(err.message || (isRTL ? 'فشل الرفع' : 'Upload failed'), { id: 'upload' });
    }
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Validate file size (max 20MB for books/courses)
    if (file.size > 20 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الملف يجب أن لا يتجاوز 20 ميجابايت' : 'File size must be less than 20MB');
      return;
    }

    const fileExt = file.name.split('.').pop();
    const safeName = file.name.replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `mahaja-file-${Date.now()}-${safeName.substring(0, 10)}.${fileExt}`;

    try {
      toast.loading(isRTL ? 'جاري الرفع...' : 'Uploading...', { id: 'upload_file' });
      
      const { data, error } = await supabase.storage.from('mahaja_content').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
      
      if (error) {
        console.error('Supabase file upload error:', error);
        throw new Error(error.message);
      }
      
      const { data: urlData } = supabase.storage.from('mahaja_content').getPublicUrl(fileName);
      const url = urlData.publicUrl;
      
      const linkField = activeSubTab === 'courses' ? 'content_link' : 'download_link';
      setEditForm({ ...editForm, [linkField]: url });
      
      toast.success(isRTL ? 'تم رفع الملف' : 'File uploaded', { id: 'upload_file' });
    } catch (err: any) {
      console.error('File upload failed:', err);
      toast.error(err.message || (isRTL ? 'فشل الرفع' : 'Upload failed'), { id: 'upload_file' });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-teal-500" />
            {isRTL ? 'إدارة المحجة البيضاء' : 'Mahaja Management'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {isRTL ? 'إضافة وتعديل الدورات والكتب' : 'Manage courses and books'}
          </p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => { setActiveSubTab('courses'); setIsEditing(null); }}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
              activeSubTab === 'courses' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Video className="w-4 h-4" />
            {isRTL ? 'الدورات' : 'Courses'}
          </button>
          <button
            onClick={() => { setActiveSubTab('books'); setIsEditing(null); }}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
              activeSubTab === 'books' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {isRTL ? 'الكتب' : 'Books'}
          </button>
        </div>
      </div>

      <button
        onClick={handleAddNew}
        disabled={isEditing === 'new'}
        className="w-full mb-6 py-4 border-2 border-dashed border-teal-200 dark:border-teal-900/50 hover:border-teal-400 dark:hover:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors disabled:opacity-50"
      >
        <Plus className="w-6 h-6" />
        <span className="font-bold">{isRTL ? 'إضافة عنصر جديد' : 'Add New Item'}</span>
      </button>

      {loading && !isEditing ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            const isEditingThis = isEditing === item.id;
            const linkField = activeSubTab === 'courses' ? 'content_link' : 'download_link';
            const imgField = activeSubTab === 'courses' ? 'image_url' : 'cover_image_url';
            
            if (isEditingThis) {
              return (
                <div key={item.id} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-teal-200 dark:border-teal-800 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{isRTL ? 'العنوان' : 'Title'}</label>
                      <input 
                        type="text" 
                        value={editForm.title || ''} 
                        onChange={e => setEditForm({...editForm, title: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{isRTL ? 'الرابط أو الملف' : 'Link or File'}</label>
                      <div className="flex gap-2 items-center">
                        <label className="cursor-pointer bg-slate-200 dark:bg-slate-700 px-4 py-3 rounded-xl flex items-center justify-center" title={isRTL ? 'رفع ملف' : 'Upload file'}>
                          {activeSubTab === 'courses' ? <Video className="w-5 h-5 text-slate-600 dark:text-slate-300" /> : <FileText className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
                          <input type="file" accept={activeSubTab === 'courses' ? 'video/*,audio/*' : '.pdf,.doc,.docx,.zip'} className="hidden" onChange={uploadFile} />
                        </label>
                        <input 
                          type="text" 
                          value={editForm[linkField] || ''} 
                          onChange={e => setEditForm({...editForm, [linkField]: e.target.value})}
                          placeholder={isRTL ? 'رابط الملف أو ارفع ملفاً' : 'File URL or upload file'}
                          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-left" dir="ltr"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{isRTL ? 'الوصف' : 'Description'}</label>
                      <textarea 
                        value={editForm.description || ''} 
                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-24" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{isRTL ? 'الصورة' : 'Image'}</label>
                      <div className="flex gap-2 items-center">
                        <label className="cursor-pointer bg-slate-200 dark:bg-slate-700 px-4 py-3 rounded-xl flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                          <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
                        </label>
                        <input 
                          type="text" 
                          value={editForm[imgField] || ''} 
                          onChange={e => setEditForm({...editForm, [imgField]: e.target.value})}
                          placeholder="Image URL"
                          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-left" dir="ltr"
                        />
                      </div>
                      {editForm[imgField] && (
                        <img src={editForm[imgField]} alt="Preview" className="h-20 object-cover mt-2 rounded-lg border border-slate-200 dark:border-slate-700" />
                      )}
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={editForm.is_published || false} 
                          onChange={e => setEditForm({...editForm, is_published: e.target.checked})}
                          className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className="font-bold text-slate-700 dark:text-slate-300">{isRTL ? 'منشور (يظهر للمستخدمين)' : 'Published'}</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={() => { setIsEditing(null); if (item.id === 'new') fetchItems(); }} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button onClick={() => handleSave(item.id)} className="px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      {isRTL ? 'حفظ' : 'Save'}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={item.id} className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                  {item[imgField] ? (
                    <img src={item[imgField]} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 text-center sm:text-start">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2 justify-center sm:justify-start">
                    {item.title}
                    <span className={`text-xs px-2 py-1 rounded-full ${item.is_published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {item.is_published ? (isRTL ? 'منشور' : 'Published') : (isRTL ? 'مخفي' : 'Hidden')}
                    </span>
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mt-1">{item.description}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setIsEditing(item.id); setEditForm(item); }} className="p-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              {isRTL ? 'لا توجد بيانات' : 'No data found'}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
