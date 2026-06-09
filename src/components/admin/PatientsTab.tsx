import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { 
  Search, Plus, Trash2, Edit, Eye, User, Users, FileText, Phone, MapPin, 
  Activity, Stethoscope, AlertCircle, CheckCircle, PauseCircle, Clock, 
  Save, X, Filter, RefreshCw, ShieldCheck
} from 'lucide-react';


type PatientStatus = 'قيد المتابعة' | 'مكتمل' | 'موقوف';
type ServiceType = 'فحص' | 'عملية' | 'تأمين صحي' | 'أخرى';

interface Patient {
  id: string;
  full_name: string;
  phone: string;
  age: number;
  address: string;
  health_condition: string;
  notes: string;
  status: PatientStatus;
  unique_id: string;
  created_at: string;
}

interface PatientService {
  id: string;
  patient_id: string;
  service_type: ServiceType;
  service_date: string;
  description: string;
  cost: number;
  notes: string;
  created_at: string;
}

export function PatientsTab() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<PatientService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'الكل' | PatientStatus>('الكل');

  // Modals state
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<PatientService | null>(null);
  
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    age: '',
    address: '',
    health_condition: '',
    notes: '',
    status: 'قيد المتابعة' as PatientStatus
  });

  const [serviceFormData, setServiceFormData] = useState({
    service_type: 'فحص' as ServiceType,
    service_date: new Date().toISOString().split('T')[0],
    description: '',
    cost: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
    setupRealtime();
  }, []);

  const setupRealtime = () => {
    supabase.channel('patients-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_services' }, () => fetchData())
      .subscribe();
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [patientsRes, servicesRes] = await Promise.all([
        supabase.from('patients').select('*').order('created_at', { ascending: false }),
        supabase.from('patient_services').select('*').order('service_date', { ascending: false })
      ]);

      if (patientsRes.error) throw patientsRes.error;
      if (servicesRes.error) throw servicesRes.error;

      setPatients(patientsRes.data || []);
      setServices(servicesRes.data || []);
    } catch (error: any) {
      console.error(error);
      toast.error(isRTL ? 'حدث خطأ في جلب البيانات' : 'Error fetching data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = 
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.phone?.includes(searchTerm) ||
      p.unique_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'الكل' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Statistics
  const stats = {
    total: patients.length,
    active: patients.filter(p => p.status === 'قيد المتابعة').length,
    completed: patients.filter(p => p.status === 'مكتمل').length,
    suspended: patients.filter(p => p.status === 'موقوف').length,
    totalCheckups: services.filter(s => s.service_type === 'فحص').length,
    totalSurgeries: services.filter(s => s.service_type === 'عملية').length,
  };

  // --- Handlers for Patient ---
  const handleOpenPatientModal = (patient?: Patient) => {
    if (patient) {
      setEditingPatient(patient);
      setFormData({
        full_name: patient.full_name || '',
        phone: patient.phone || '',
        age: patient.age?.toString() || '',
        address: patient.address || '',
        health_condition: patient.health_condition || '',
        notes: patient.notes || '',
        status: patient.status || 'قيد المتابعة'
      });
    } else {
      setEditingPatient(null);
      setFormData({
        full_name: '',
        phone: '',
        age: '',
        address: '',
        health_condition: '',
        notes: '',
        status: 'قيد المتابعة'
      });
    }
    setIsPatientModalOpen(true);
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(isRTL ? 'جاري الحفظ...' : 'Saving...');
    try {
      const payload = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
      };

      if (editingPatient) {
        const { error } = await supabase.from('patients').update(payload).eq('id', editingPatient.id);
        if (error) throw error;
        toast.success(isRTL ? 'تم التحديث بنجاح' : 'Updated successfully', { id: loadingToast });
      } else {
        const { error } = await supabase.from('patients').insert([payload]);
        if (error) throw error;
        toast.success(isRTL ? 'تمت الإضافة بنجاح' : 'Added successfully', { id: loadingToast });
      }
      setIsPatientModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message, { id: loadingToast });
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف هذا المريض وكل ما يتعلق به؟' : 'Are you sure you want to delete this patient?')) return;
    setIsDeleting(id);
    try {
      const { error } = await supabase.from('patients').delete().eq('id', id);
      if (error) throw error;
      toast.success(isRTL ? 'تم الحذف بنجاح' : 'Deleted successfully');
      if (selectedPatient?.id === id) setIsDetailsModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleOpenDetails = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsDetailsModalOpen(true);
  };

  // --- Handlers for Services ---
  const handleOpenServiceModal = (service?: PatientService) => {
    if (service) {
      setEditingService(service);
      setServiceFormData({
        service_type: service.service_type,
        service_date: service.service_date,
        description: service.description || '',
        cost: service.cost?.toString() || '',
        notes: service.notes || ''
      });
    } else {
      setEditingService(null);
      setServiceFormData({
        service_type: 'فحص',
        service_date: new Date().toISOString().split('T')[0],
        description: '',
        cost: '',
        notes: ''
      });
    }
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    
    const loadingToast = toast.loading(isRTL ? 'جاري الحفظ...' : 'Saving...');
    try {
      const payload = {
        ...serviceFormData,
        patient_id: selectedPatient.id,
        cost: serviceFormData.cost ? parseFloat(serviceFormData.cost) : 0,
      };

      if (editingService) {
        const { error } = await supabase.from('patient_services').update(payload).eq('id', editingService.id);
        if (error) throw error;
        toast.success(isRTL ? 'تم تحديث الخدمة' : 'Service updated', { id: loadingToast });
      } else {
        const { error } = await supabase.from('patient_services').insert([payload]);
        if (error) throw error;
        toast.success(isRTL ? 'تمت إضافة الخدمة' : 'Service added', { id: loadingToast });
      }
      setIsServiceModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message, { id: loadingToast });
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!window.confirm(isRTL ? 'حذف هذه الخدمة؟' : 'Delete this service?')) return;
    try {
      const { error } = await supabase.from('patient_services').delete().eq('id', id);
      if (error) throw error;
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    }
  };

  // Helper for Status colors
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'مكتمل': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
      case 'موقوف': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
      default: return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
    }
  };
  
  const getServiceIcon = (type: string) => {
    switch(type) {
      case 'فحص': return <Stethoscope className="w-5 h-5 text-indigo-500" />;
      case 'عملية': return <Activity className="w-5 h-5 text-rose-500" />;
      case 'تأمين صحي': return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
      default: return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: isRTL ? 'إجمالي المرضى' : 'Total Patients', value: stats.total, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: isRTL ? 'قيد المتابعة' : 'Active', value: stats.active, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: isRTL ? 'مكتمل' : 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: isRTL ? 'موقوف' : 'Suspended', value: stats.suspended, icon: PauseCircle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
          { label: isRTL ? 'إجمالي الفحوصات' : 'Total Checkups', value: stats.totalCheckups, icon: Stethoscope, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: isRTL ? 'إجمالي العمليات' : 'Total Surgeries', value: stats.totalSurgeries, icon: Activity, color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center justify-center gap-2 shadow-sm">
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-1 w-full gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400`} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isRTL ? 'بحث بالاسم، الهاتف، أو المعرف...' : 'Search name, phone, or ID...'}
              className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none`}
            />
          </div>
          <div className="relative flex-shrink-0">
            <Filter className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`appearance-none ${isRTL ? 'pr-9 pl-8' : 'pl-9 pr-8'} py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer font-medium`}
            >
              <option value="الكل">{isRTL ? 'جميع الحالات' : 'All Status'}</option>
              <option value="قيد المتابعة">{isRTL ? 'قيد المتابعة' : 'Active'}</option>
              <option value="مكتمل">{isRTL ? 'مكتمل' : 'Completed'}</option>
              <option value="موقوف">{isRTL ? 'موقوف' : 'Suspended'}</option>
            </select>
          </div>
        </div>
        <button 
          onClick={() => handleOpenPatientModal()}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30"
        >
          <Plus className="w-5 h-5" />
          <span>{isRTL ? 'إضافة مريض جديد' : 'Add New Patient'}</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right" dir={isRTL ? 'rtl' : 'ltr'}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm font-bold">
                <th className="px-6 py-4">{isRTL ? 'المعرف' : 'ID'}</th>
                <th className="px-6 py-4">{isRTL ? 'المريض' : 'Patient'}</th>
                <th className="px-6 py-4">{isRTL ? 'الهاتف' : 'Phone'}</th>
                <th className="px-6 py-4">{isRTL ? 'الحالة الصحية' : 'Condition'}</th>
                <th className="px-6 py-4">{isRTL ? 'الحالة' : 'Status'}</th>
                <th className="px-6 py-4 text-center">{isRTL ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-500" />
                    {isRTL ? 'جاري التحميل...' : 'Loading...'}
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                    {isRTL ? 'لا يوجد مرضى مطابقين للبحث' : 'No patients found'}
                  </td>
                </tr>
              ) : (
                filteredPatients.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-slate-500">{p.unique_id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                          {p.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white">{p.full_name}</p>
                          <p className="text-sm text-slate-500">{p.age ? `${p.age} ${isRTL ? 'سنة' : 'years'}` : '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium" dir="ltr">{p.phone || '-'}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">{p.health_condition || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${getStatusBadge(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleOpenDetails(p)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                          title={isRTL ? 'عرض الملف' : 'View Profile'}
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleOpenPatientModal(p)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title={isRTL ? 'تعديل' : 'Edit'}
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeletePatient(p.id)}
                          disabled={isDeleting === p.id}
                          className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors disabled:opacity-50"
                          title={isRTL ? 'حذف' : 'Delete'}
                        >
                          {isDeleting === p.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Add/Edit Modal */}
      <AnimatePresence>
        {isPatientModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <div className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center z-10">
                <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                  <User className="w-6 h-6 text-indigo-500" />
                  {editingPatient ? (isRTL ? 'تعديل بيانات المريض' : 'Edit Patient') : (isRTL ? 'إضافة مريض جديد' : 'Add New Patient')}
                </h3>
                <button onClick={() => setIsPatientModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSavePatient} className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'الاسم الكامل *' : 'Full Name *'}</label>
                    <input type="text" required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'رقم الهاتف' : 'Phone'}</label>
                    <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'العمر' : 'Age'}</label>
                    <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'الحالة' : 'Status'}</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as PatientStatus})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold">
                      <option value="قيد المتابعة">{isRTL ? 'قيد المتابعة' : 'Active'}</option>
                      <option value="مكتمل">{isRTL ? 'مكتمل' : 'Completed'}</option>
                      <option value="موقوف">{isRTL ? 'موقوف' : 'Suspended'}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'العنوان' : 'Address'}</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'الحالة الصحية / نوع المرض *' : 'Health Condition *'}</label>
                  <input type="text" required value={formData.health_condition} onChange={e => setFormData({...formData, health_condition: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'ملاحظات إضافية' : 'Notes'}</label>
                  <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="submit" className="flex-1 flex justify-center items-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30">
                    <Save className="w-5 h-5" />
                    <span>{isRTL ? 'حفظ البيانات' : 'Save'}</span>
                  </button>
                  <button type="button" onClick={() => setIsPatientModalOpen(false)} className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors">
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Patient Details & Services Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && selectedPatient && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 flex justify-between items-start rounded-t-3xl text-white">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-white/20 rounded-lg text-sm font-bold backdrop-blur-sm">
                      {selectedPatient.unique_id}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold backdrop-blur-sm ${selectedPatient.status === 'مكتمل' ? 'bg-emerald-500/30' : selectedPatient.status === 'موقوف' ? 'bg-rose-500/30' : 'bg-amber-500/30'}`}>
                      {selectedPatient.status}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black">{selectedPatient.full_name}</h2>
                  <p className="mt-2 text-indigo-100 font-medium flex items-center gap-2">
                    <Stethoscope className="w-5 h-5" />
                    {selectedPatient.health_condition}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setIsDetailsModalOpen(false); handleOpenPatientModal(selectedPatient); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm">
                    <Edit className="w-5 h-5" />
                  </button>
                  <button onClick={() => setIsDetailsModalOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><Phone className="w-6 h-6" /></div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">{isRTL ? 'الهاتف' : 'Phone'}</p>
                      <p className="font-bold text-slate-800 dark:text-white" dir="ltr">{selectedPatient.phone || '-'}</p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><User className="w-6 h-6" /></div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">{isRTL ? 'العمر' : 'Age'}</p>
                      <p className="font-bold text-slate-800 dark:text-white">{selectedPatient.age ? `${selectedPatient.age} ${isRTL ? 'سنة' : 'yrs'}` : '-'}</p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><MapPin className="w-6 h-6" /></div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">{isRTL ? 'العنوان' : 'Address'}</p>
                      <p className="font-bold text-slate-800 dark:text-white truncate">{selectedPatient.address || '-'}</p>
                    </div>
                  </div>
                </div>

                {selectedPatient.notes && (
                  <div className="mb-8 bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-200 dark:border-amber-800/30">
                    <h4 className="font-bold text-amber-800 dark:text-amber-500 flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5" />
                      {isRTL ? 'ملاحظات:' : 'Notes:'}
                    </h4>
                    <p className="text-amber-700 dark:text-amber-300/80 whitespace-pre-wrap">{selectedPatient.notes}</p>
                  </div>
                )}

                <div className="flex justify-between items-end mb-6">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                    <Activity className="w-6 h-6 text-indigo-500" />
                    {isRTL ? 'سجل الخدمات المقدمة' : 'Services Timeline'}
                  </h3>
                  <button 
                    onClick={() => handleOpenServiceModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isRTL ? 'إضافة خدمة' : 'Add Service'}</span>
                  </button>
                </div>

                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
                  {services.filter(s => s.patient_id === selectedPatient.id).length === 0 ? (
                    <div className="text-center py-12 relative z-10">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <FileText className="w-8 h-8" />
                      </div>
                      <p className="text-slate-500 font-medium">{isRTL ? 'لا توجد خدمات مسجلة لهذا المريض بعد.' : 'No services recorded yet.'}</p>
                    </div>
                  ) : (
                    services.filter(s => s.patient_id === selectedPatient.id).map((service, index) => (
                      <div key={service.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-950 bg-white dark:bg-slate-800 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          {getServiceIcon(service.service_type)}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg mb-2 ${
                                service.service_type === 'عملية' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' :
                                service.service_type === 'تأمين صحي' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400'
                              }`}>
                                {service.service_type}
                              </span>
                              <h4 className="font-bold text-lg text-slate-800 dark:text-white">{service.description || (isRTL ? 'بدون وصف' : 'No description')}</h4>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenServiceModal(service)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteService(service.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {service.service_date}
                          </p>
                          {service.notes && <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl mb-3">{service.notes}</p>}
                          {service.cost > 0 && (
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
                              {isRTL ? 'التكلفة: ' : 'Cost: '} {service.cost} MRU
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Service Modal */}
      <AnimatePresence>
        {isServiceModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-500" />
                  {editingService ? (isRTL ? 'تعديل الخدمة' : 'Edit Service') : (isRTL ? 'إضافة خدمة جديدة' : 'Add New Service')}
                </h3>
                <button onClick={() => setIsServiceModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSaveService} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'نوع الخدمة *' : 'Type *'}</label>
                    <select required value={serviceFormData.service_type} onChange={e => setServiceFormData({...serviceFormData, service_type: e.target.value as ServiceType})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold">
                      <option value="فحص">{isRTL ? 'فحص طبي' : 'Checkup'}</option>
                      <option value="عملية">{isRTL ? 'عملية جراحية' : 'Surgery'}</option>
                      <option value="تأمين صحي">{isRTL ? 'تأمين صحي' : 'Insurance'}</option>
                      <option value="أخرى">{isRTL ? 'خدمة أخرى' : 'Other'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'التاريخ *' : 'Date *'}</label>
                    <input type="date" required value={serviceFormData.service_date} onChange={e => setServiceFormData({...serviceFormData, service_date: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'وصف مختصر *' : 'Description *'}</label>
                  <input type="text" required value={serviceFormData.description} onChange={e => setServiceFormData({...serviceFormData, description: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder={isRTL ? 'مثال: فحص رنين مغناطيسي...' : 'e.g., MRI Scan...'} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'التكلفة (إن وجدت)' : 'Cost'}</label>
                  <div className="relative">
                    <input type="number" step="0.01" value={serviceFormData.cost} onChange={e => setServiceFormData({...serviceFormData, cost: e.target.value})} className={`w-full ${isRTL ? 'pl-16 pr-4' : 'pr-16 pl-4'} py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none`} dir="ltr" />
                    <span className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-slate-400 font-bold`}>MRU</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{isRTL ? 'ملاحظات' : 'Notes'}</label>
                  <textarea rows={2} value={serviceFormData.notes} onChange={e => setServiceFormData({...serviceFormData, notes: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="submit" className="flex-1 flex justify-center items-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30">
                    <Save className="w-5 h-5" />
                    <span>{isRTL ? 'حفظ' : 'Save'}</span>
                  </button>
                  <button type="button" onClick={() => setIsServiceModalOpen(false)} className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors">
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
