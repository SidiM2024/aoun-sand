import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Upload, FileText, CheckCircle, Clock, XCircle, CreditCard, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export const UserRequestsPage = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [activeTab, setActiveTab] = useState<'requests' | 'payments'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form states
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
      
      const requestsSub = supabase.channel('public:user_requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_requests', filter: `user_id=eq.${user.id}` }, payload => {
          fetchData(); // Simplest way to sync
        }).subscribe();
        
      const paymentsSub = supabase.channel('public:user_payments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_payments', filter: `user_id=eq.${user.id}` }, payload => {
          fetchData();
        }).subscribe();

      return () => {
        supabase.removeChannel(requestsSub);
        supabase.removeChannel(paymentsSub);
      };
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    const [reqsRes, paysRes, methodsRes] = await Promise.all([
      supabase.from('user_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('user_payments').select('*, payment_methods(name)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('payment_methods').select('*').eq('is_active', true)
    ]);

    if (reqsRes.data) setRequests(reqsRes.data);
    if (paysRes.data) setPayments(paysRes.data);
    if (methodsRes.data) setPaymentMethods(methodsRes.data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يجب أن يكون الملف صورة' : 'File must be an image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error(isRTL ? 'حجم الملف يجب أن لا يتجاوز 5 ميجابايت' : 'File size must not exceed 5MB');
      return;
    }

    setReceiptFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const uploadReceipt = async (file: File) => {
    setIsUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${user?.id}-${Date.now()}.${ext}`;
    
    // We assume there is a 'receipts' bucket, matching flutter app
    const { data, error } = await supabase.storage.from('receipts').upload(fileName, file);
    
    setIsUploading(false);
    
    if (error) {
      console.error(error);
      toast.error(isRTL ? 'فشل رفع الصورة' : 'Failed to upload image');
      return null;
    }
    
    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isLoading || isUploading) return;
    
    setIsLoading(true);
    try {
      let receipt_url = null;
      if (receiptFile) {
        receipt_url = await uploadReceipt(receiptFile);
        if (!receipt_url) {
          setIsLoading(false);
          return;
        }
      }

      if (activeTab === 'requests') {
        const { error } = await supabase.from('user_requests').insert({
          user_id: user.id,
          request_type: type,
          amount: amount ? parseFloat(amount) : null,
          notes,
          receipt_url
        });
        if (error) throw error;
        toast.success(isRTL ? 'تم إرسال الطلب بنجاح' : 'Request submitted successfully');
      } else {
        const { error } = await supabase.from('user_payments').insert({
          user_id: user.id,
          amount: parseFloat(amount),
          method_id: methodId,
          notes,
          receipt_url
        });
        if (error) throw error;
        toast.success(isRTL ? 'تم إرسال الدفعة بنجاح' : 'Payment submitted successfully');
      }

      // Reset form
      setShowForm(false);
      setType('');
      setAmount('');
      setMethodId('');
      setNotes('');
      setReceiptFile(null);
      setPreviewUrl(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || (isRTL ? 'حدث خطأ' : 'An error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };
  
  const getStatusText = (status: string) => {
    if (status === 'approved') return isRTL ? 'مقبول' : 'Approved';
    if (status === 'rejected') return isRTL ? 'مرفوض' : 'Rejected';
    return isRTL ? 'قيد الانتظار' : 'Pending';
  };

  return (
    <div className="container-custom py-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <h1 className="section-title mb-8">{isRTL ? 'طلباتي ومدفوعاتي' : 'My Requests & Payments'}</h1>
      
      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => { setActiveTab('requests'); setShowForm(false); }}
          className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'requests' ? 'bg-primary text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
        >
          <FileText className="w-5 h-5" />
          {isRTL ? 'الطلبات' : 'Requests'}
        </button>
        <button 
          onClick={() => { setActiveTab('payments'); setShowForm(false); }}
          className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'payments' ? 'bg-primary text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
        >
          <CreditCard className="w-5 h-5" />
          {isRTL ? 'المدفوعات' : 'Payments'}
        </button>
      </div>

      {!showForm ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              {activeTab === 'requests' ? (isRTL ? 'سجل الطلبات' : 'Requests History') : (isRTL ? 'سجل المدفوعات' : 'Payments History')}
            </h2>
            <button 
              onClick={() => setShowForm(true)}
              className="btn-primary"
            >
              <Plus className="w-5 h-5" />
              {isRTL ? 'إضافة جديد' : 'Add New'}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(activeTab === 'requests' ? requests : payments).map(item => (
              <div key={item.id} className="card p-6 border-l-4 border-primary hover:border-secondary">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {new Date(item.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                    </span>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white mt-1">
                      {activeTab === 'requests' ? item.request_type : (item.payment_methods?.name || 'Payment')}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full text-sm font-medium">
                    {getStatusIcon(item.status)}
                    <span className="text-slate-700 dark:text-slate-200">{getStatusText(item.status)}</span>
                  </div>
                </div>
                
                {item.amount && (
                  <div className="mb-2">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">{isRTL ? 'المبلغ:' : 'Amount:'} </span>
                    <span className="font-bold text-primary">{item.amount} MRU</span>
                  </div>
                )}
                
                {item.approved_amount && (
                  <div className="mb-2">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">{isRTL ? 'المبلغ المعتمد:' : 'Approved Amount:'} </span>
                    <span className="font-bold text-green-600">{item.approved_amount} MRU</span>
                  </div>
                )}
                
                {item.notes && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    {item.notes}
                  </p>
                )}
                
                {item.receipt_url && (
                  <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:text-primary-light">
                    <FileText className="w-4 h-4" />
                    {isRTL ? 'عرض المرفق' : 'View Attachment'}
                  </a>
                )}
              </div>
            ))}
            {(activeTab === 'requests' ? requests : payments).length === 0 && (
              <div className="col-span-full text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">
                  {isRTL ? 'لا توجد سجلات لعرضها' : 'No records to display'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 md:p-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
            {activeTab === 'requests' ? (isRTL ? 'طلب جديد' : 'New Request') : (isRTL ? 'دفعة جديدة' : 'New Payment')}
          </h2>

          {activeTab === 'requests' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isRTL ? 'نوع الطلب' : 'Request Type'}
              </label>
              <input 
                type="text" 
                required 
                value={type}
                onChange={e => setType(e.target.value)}
                className="input-field" 
                placeholder={isRTL ? 'مثال: مساعدة مالية، استفسار...' : 'e.g. Financial aid, Inquiry...'}
              />
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isRTL ? 'طريقة الدفع' : 'Payment Method'}
              </label>
              <select 
                required 
                value={methodId}
                onChange={e => setMethodId(e.target.value)}
                className="input-field"
              >
                <option value="">{isRTL ? 'اختر طريقة الدفع' : 'Select Payment Method'}</option>
                {paymentMethods.map(method => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isRTL ? 'المبلغ' : 'Amount'} {activeTab === 'requests' && <span className="text-slate-400 text-xs">({isRTL ? 'اختياري' : 'Optional'})</span>}
            </label>
            <input 
              type="number" 
              required={activeTab === 'payments'}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="input-field" 
              placeholder="0.00"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isRTL ? 'ملاحظات' : 'Notes'}
            </label>
            <textarea 
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input-field" 
            />
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isRTL ? 'إرفاق صورة الإيصال' : 'Attach Receipt Image'}
            </label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                {previewUrl ? (
                  <div className="relative w-full h-full p-2">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                    <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                      <span className="font-bold">{isRTL ? 'اضغط للرفع' : 'Click to upload'}</span>
                    </p>
                    <p className="text-xs text-slate-400">PNG, JPG, JPEG (Max: 5MB)</p>
                  </div>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>
            {isUploading && (
              <p className="text-sm text-primary mt-2 flex items-center gap-2">
                <span className="animate-spin border-2 border-primary border-t-transparent rounded-full w-4 h-4"></span>
                {isRTL ? 'جاري رفع الصورة...' : 'Uploading image...'}
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button 
              type="button" 
              onClick={() => setShowForm(false)}
              className="btn-outline flex-1"
              disabled={isLoading || isUploading}
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
            <button 
              type="submit" 
              className="btn-primary flex-1"
              disabled={isLoading || isUploading}
            >
              {isLoading ? (isRTL ? 'جاري الإرسال...' : 'Submitting...') : (isRTL ? 'إرسال' : 'Submit')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
