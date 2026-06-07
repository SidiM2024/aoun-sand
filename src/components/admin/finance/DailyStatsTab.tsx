import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../../lib/supabase';
import { useLanguage } from '../../../contexts/LanguageContext';
import toast from 'react-hot-toast';
import {
  BarChart3, Calendar, Search, X, TrendingUp, Building2, Wallet, RefreshCw
} from 'lucide-react';

interface DailyStat {
  stat_date: string;
  bankily_total: number;
  masrvi_total: number;
  sedad_total: number;
  bim_bank_total: number;
  click_total: number;
  ghaza_abi_total: number;
  other_banks_total: number;
  total_donations: number;
  updated_at: string;
}

export const DailyStatsTab = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [stats, setStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('daily_donation_stats')
        .select('*')
        .order('stat_date', { ascending: false });

      if (filterDateFrom) query = query.gte('stat_date', filterDateFrom);
      if (filterDateTo) query = query.lte('stat_date', filterDateTo);

      const { data, error } = await query;
      if (error) throw error;
      setStats(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(isRTL ? 'خطأ في تحميل الإحصائيات' : 'Error loading statistics');
    } finally {
      setLoading(false);
    }
  }, [filterDateFrom, filterDateTo, isRTL]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const fmt = (n: number) => Number(n).toLocaleString() + ' MRU';

  const totalAllTime = stats.reduce((acc, curr) => acc + Number(curr.total_donations), 0);
  const totalBankily = stats.reduce((acc, curr) => acc + Number(curr.bankily_total), 0);
  const totalOtherBanks = stats.reduce((acc, curr) => acc + Number(curr.other_banks_total), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-5"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute -top-6 -end-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black">{isRTL ? 'الإحصائيات اليومية للتبرعات' : 'Daily Donation Stats'}</h3>
              <p className="text-blue-100 text-xs opacity-90">
                {isRTL ? 'تحديث تلقائي للمداخيل اليومية بناءً على البنوك' : 'Automatic daily updates based on banks'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {isRTL ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 text-center shadow-sm">
          <Wallet className="w-7 h-7 text-indigo-500 mx-auto mb-2" />
          <p className="text-2xl font-black text-slate-800 dark:text-white">{fmt(totalAllTime)}</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{isRTL ? 'إجمالي التبرعات' : 'Total Donations'}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 text-center shadow-sm">
          <Building2 className="w-7 h-7 text-teal-500 mx-auto mb-2" />
          <p className="text-2xl font-black text-slate-800 dark:text-white">{fmt(totalBankily)}</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{isRTL ? 'إجمالي بنكيلي' : 'Bankily Total'}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 text-center shadow-sm">
          <TrendingUp className="w-7 h-7 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-black text-slate-800 dark:text-white">{fmt(totalOtherBanks)}</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{isRTL ? 'البنوك الأخرى' : 'Other Banks'}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{isRTL ? 'تصفية بالتاريخ:' : 'Filter by Date:'}</span>
          </div>
          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            title={isRTL ? 'من تاريخ' : 'From date'}
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            title={isRTL ? 'إلى تاريخ' : 'To date'}
          />
          {(filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
              className="flex items-center gap-1 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              {isRTL ? 'مسح' : 'Clear'}
            </button>
          )}
        </div>
      </div>

      {/* Stats Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 text-start text-xs font-bold text-slate-400 uppercase tracking-wider">{isRTL ? 'التاريخ' : 'Date'}</th>
                  <th className="px-5 py-3.5 text-start text-xs font-bold text-slate-400 uppercase tracking-wider">{isRTL ? 'بنكيلي' : 'Bankily'}</th>
                  <th className="px-5 py-3.5 text-start text-xs font-bold text-slate-400 uppercase tracking-wider">{isRTL ? 'مصرفي' : 'Masrvi'}</th>
                  <th className="px-5 py-3.5 text-start text-xs font-bold text-slate-400 uppercase tracking-wider">{isRTL ? 'سداد' : 'Sedad'}</th>
                  <th className="px-5 py-3.5 text-start text-xs font-bold text-slate-400 uppercase tracking-wider">{isRTL ? 'بيم بنك' : 'BIM Bank'}</th>
                  <th className="px-5 py-3.5 text-start text-xs font-bold text-slate-400 uppercase tracking-wider">{isRTL ? 'أكليك' : 'Click'}</th>
                  <th className="px-5 py-3.5 text-start text-xs font-bold text-slate-400 uppercase tracking-wider">{isRTL ? 'غزة أبي' : 'Ghaza Abi'}</th>
                  <th className="px-5 py-3.5 text-start text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-800">{isRTL ? 'البنوك الأخرى' : 'Other Banks'}</th>
                  <th className="px-5 py-3.5 text-start text-xs font-bold text-slate-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">{isRTL ? 'إجمالي التبرعات' : 'Total'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {stats.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center text-slate-400">
                        <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
                        <p className="font-medium">{isRTL ? 'لا توجد إحصائيات' : 'No stats found'}</p>
                      </div>
                    </td>
                  </tr>
                ) : stats.map((stat) => (
                  <tr key={stat.stat_date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 text-sm font-bold text-slate-800 dark:text-white">
                      {new Date(stat.stat_date).toLocaleDateString(isRTL ? 'ar-MA' : 'en-US')}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">{Number(stat.bankily_total).toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{Number(stat.masrvi_total).toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{Number(stat.sedad_total).toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{Number(stat.bim_bank_total).toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{Number(stat.click_total).toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{Number(stat.ghaza_abi_total).toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm font-bold text-purple-600 dark:text-purple-400 bg-slate-50 dark:bg-slate-800/30">
                      {Number(stat.other_banks_total).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10">
                      {Number(stat.total_donations).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};
