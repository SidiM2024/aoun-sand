import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { BookOpen, Video, Plus, Trash2, Edit2, Save, Link as LinkIcon } from 'lucide-react';

export const MahajaTab = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [activeSubTab, setActiveSubTab] = useState<'courses' | 'books'>('courses');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    fetchItems();
  }, [activeSubTab]);

  const fetchItems = async () => {
    setLoading(true);
    const table = activeSubTab === 'courses' ? 'mahaja_courses' : 'mahaja_books';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchItems error:', error);
      toast.error(isRTL ? 'خطأ في جلب البيانات' : 'Error fetching data');
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const handleAddNew = () => {
    if (isEditing) return;
    const newItem: any = { id: 'new', title: '', description: '', is_published: true };
    if (activeSubTab === 'courses') {
      newItem.content_link = '';
    } else {
      newItem.download_link = '';
    }
    setItems([newItem, ...items]);
    setIsEditing('new');
    setEditForm(newItem);
  };

  const handleSave = async (id: string) => {
    if (isSaving) return;

    const linkField = activeSubTab === 'courses' ? 'content_link' : 'download_link';

    if (!editForm.title?.trim()) {
      toast.error(isRTL ? 'العنوان مطلوب' : 'Title is required');
      return;
    }
    if (!editForm[linkField]?.trim()) {
      toast.error(isRTL ? 'الرابط مطلوب' : 'Link is required');
      return;
    }

    setIsSaving(true);
    const isNew = id === 'new';
    const table = activeSubTab === 'courses' ? 'mahaja_courses' : 'mahaja_books';

    const payload =
      activeSubTab === 'courses'
        ? {
            title: editForm.title.trim(),
            description: editForm.description?.trim() || '',
            content_link: editForm.content_link.trim(),
            is_published: true,
          }
        : {
            title: editForm.title.trim(),
            description: editForm.description?.trim() || '',
            download_link: editForm.download_link.trim(),
            is_published: true,
          };

    try {
      let error;
      if (isNew) {
        ({ error } = await supabase.from(table).insert([payload]));
      } else {
        ({ error } = await supabase.from(table).update(payload).eq('id', id));
      }

      if (error) {
        console.error('Save error:', error);
        throw error;
      }

      toast.success(isNew
        ? (isRTL ? '✓ تمت الإضافة بنجاح' : '✓ Added successfully')
        : (isRTL ? '✓ تم التحديث بنجاح' : '✓ Updated successfully'));
      setIsEditing(null);
      await fetchItems();
    } catch (err: any) {
      toast.error(err?.message || (isRTL ? 'حدث خطأ أثناء الحفظ' : 'Error saving'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'new') {
      setItems(items.filter(i => i.id !== 'new'));
      setIsEditing(null);
      return;
    }
    if (!window.confirm(isRTL ? 'هل أنت متأكد من الحذف؟' : 'Are you sure?')) return;

    const table = activeSubTab === 'courses' ? 'mahaja_courses' : 'mahaja_books';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? '✓ تم الحذف بنجاح' : '✓ Deleted successfully');
      await fetchItems();
    }
  };

  const linkField = activeSubTab === 'courses' ? 'content_link' : 'download_link';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6"
    >
      {/* Header */}
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
              activeSubTab === 'courses'
                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <Video className="w-4 h-4" />
            {isRTL ? 'الدورات' : 'Courses'}
          </button>
          <button
            onClick={() => { setActiveSubTab('books'); setIsEditing(null); }}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
              activeSubTab === 'books'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {isRTL ? 'الكتب' : 'Books'}
          </button>
        </div>
      </div>

      {/* Add Button */}
      <button
        onClick={handleAddNew}
        disabled={!!isEditing}
        className="w-full mb-6 py-4 border-2 border-dashed border-teal-200 dark:border-teal-900/50 hover:border-teal-400 dark:hover:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="w-6 h-6" />
        <span className="font-bold">{isRTL ? 'إضافة عنصر جديد' : 'Add New Item'}</span>
      </button>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            if (isEditing === item.id) {
              return (
                <div key={item.id} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border-2 border-teal-300 dark:border-teal-700 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isRTL ? 'العنوان' : 'Title'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.title || ''}
                      onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none"
                      placeholder={isRTL ? 'أدخل العنوان...' : 'Enter title...'}
                    />
                  </div>

                  {/* Link */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {activeSubTab === 'courses'
                        ? (isRTL ? 'رابط الدورة' : 'Course Link')
                        : (isRTL ? 'رابط الكتاب' : 'Book Link')}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2 items-center">
                      <div className="bg-teal-100 dark:bg-teal-900/30 px-3 py-3 rounded-xl">
                        <LinkIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <input
                        type="url"
                        value={editForm[linkField] || ''}
                        onChange={e => setEditForm({ ...editForm, [linkField]: e.target.value })}
                        placeholder="https://..."
                        dir="ltr"
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isRTL ? 'الوصف' : 'Description'}
                    </label>
                    <textarea
                      value={editForm.description || ''}
                      onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white h-28 resize-none focus:ring-2 focus:ring-teal-500 outline-none"
                      placeholder={isRTL ? 'أدخل الوصف...' : 'Enter description...'}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      disabled={isSaving}
                      onClick={() => {
                        setIsEditing(null);
                        if (item.id === 'new') setItems(prev => prev.filter(i => i.id !== 'new'));
                      }}
                      className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      disabled={isSaving}
                      onClick={() => handleSave(item.id)}
                      className="px-6 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                    >
                      {isSaving
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Save className="w-4 h-4" />}
                      {isSaving
                        ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                        : (isRTL ? 'حفظ ونشر' : 'Save & Publish')}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={item.id} className="flex items-start gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{item.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      item.is_published
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {item.is_published ? (isRTL ? 'منشور' : 'Published') : (isRTL ? 'مخفي' : 'Hidden')}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-1">
                      {item.description}
                    </p>
                  )}
                  {item[linkField] && (
                    <a
                      href={item[linkField]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1"
                    >
                      <LinkIcon className="w-3 h-3" />
                      {item[linkField].length > 60 ? item[linkField].substring(0, 60) + '...' : item[linkField]}
                    </a>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setIsEditing(item.id); setEditForm({ ...item }); }}
                    className="p-2.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2.5 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {items.length === 0 && !loading && (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="font-medium">{isRTL ? 'لا توجد بيانات. أضف عنصراً جديداً.' : 'No items yet. Add a new one.'}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
