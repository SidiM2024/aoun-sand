import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle, BarChart3, CalendarDays, Edit2, FileDown, HandCoins, HandHeart, History, Loader2, Plus, Receipt, RefreshCw, Save,
  Search, Trash2, Users, Wallet, X,
} from 'lucide-react';
import { formatStudentCode } from '../../../../lib/mahajaStudents';
import {
  ACTION_LABELS, ENTITY_LABELS, EXPENSE_CATEGORIES, FREQUENCIES, MOVEMENT_LABELS, PERIOD_KINDS, SPONSOR_STATUSES, deleteFinance, fmtDate, fmtMoney,
  frequencyLabel, getOverview, getStudentOptions, listFinance, periodRange, saveFinance, statusInfo,
  type Donation, type Expense, type Filters, type Frequency, type LogEntry, type Movement, type MovementKind, type Overview, type Payment,
  type PeriodKind, type Sponsor, type SponsorStatus, type StudentOption,
} from '../../../../lib/mahajaFinance';
import type { FinanceTable } from '../../../../utils/mahajaFinancePdf';

// Finance of the Al-Mahaja institute: donations, expenses, student sponsorships, statistics,
// reports and the record of operations. Separate from the association's finance system.

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';
const card = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800';
const btnNavy = 'px-4 py-2.5 rounded-xl font-black text-white bg-[#262150] hover:bg-[#332c6b] flex items-center justify-center gap-2 disabled:opacity-60';
const btnSoft = 'px-3 py-2 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 disabled:opacity-60';
const IN = '#059669';
const OUT = '#dc2626';

type Tab = 'overview' | 'donations' | 'expenses' | 'sponsors' | 'reports' | 'log';
const TABS: { id: Tab; label: string; icon: typeof Wallet }[] = [
  { id: 'overview', label: 'الإحصائيات', icon: BarChart3 },
  { id: 'donations', label: 'التبرعات', icon: HandHeart },
  { id: 'expenses', label: 'المصاريف', icon: Receipt },
  { id: 'sponsors', label: 'كفالة الطلاب', icon: HandCoins },
  { id: 'reports', label: 'التقارير', icon: FileDown },
  { id: 'log', label: 'سجل العمليات', icon: History },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const errMsg = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const exportPdf = async (opts: Parameters<typeof import('../../../../utils/mahajaFinancePdf')['exportFinancePdf']>[0]) => {
  try {
    const { exportFinancePdf } = await import('../../../../utils/mahajaFinancePdf');
    await exportFinancePdf(opts);
    toast.success('تم تنزيل الملف');
  } catch (err) { toast.error(errMsg(err, 'تعذّر إنشاء ملف PDF')); }
};

const rangeLabel = (f: Filters) => (f.from || f.to ? `${f.from ? `من ${fmtDate(f.from)}` : ''} ${f.to ? `إلى ${fmtDate(f.to)}` : ''}`.trim() : 'كل الفترات');

// ─── Shared pieces ───────────────────────────────────────────────────────────

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4" dir="rtl" onClick={onClose}>
    <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
      className="w-full sm:max-w-lg max-h-[94dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl">
      <div className="sticky top-0 z-10 bg-[#262150] text-white px-5 py-4 flex items-center justify-between">
        <h3 className="font-black">{title}</h3>
        <button onClick={onClose} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  </div>
);

const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <label className="block"><span className="block text-sm font-bold mb-1.5">{label}{required ? ' *' : ''}</span>{children}</label>
);

const FilterBar = ({ filters, setFilters, children }: { filters: Filters; setFilters: (f: Filters) => void; children?: React.ReactNode }) => (
  <div className={`${card} p-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] items-end`}>
    <label className="relative block">
      <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
      <input value={filters.q ?? ''} onChange={e => setFilters({ ...filters, q: e.target.value })} placeholder="بحث…" className={`${inputCls} ps-9`} />
    </label>
    <div className="grid grid-cols-2 gap-2">
      <input type="date" aria-label="من تاريخ" value={filters.from ?? ''} onChange={e => setFilters({ ...filters, from: e.target.value })} className={inputCls} />
      <input type="date" aria-label="إلى تاريخ" value={filters.to ?? ''} onChange={e => setFilters({ ...filters, to: e.target.value })} className={inputCls} />
    </div>
    {children}
  </div>
);

function useFinanceList<T>(kind: Parameters<typeof listFinance>[0], filters: Filters) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setRows(await listFinance<T>(kind, filters)); setError(''); }
    catch (err) { setError(errMsg(err, 'تعذّر التحميل')); setRows(r => r ?? []); }
  }, [kind, filters]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);
  return { rows, error, reload: load };
}

const ListState = ({ rows, error, empty }: { rows: unknown[] | null; error: string; empty: string }) => {
  if (error) return <p className="p-6 text-center font-bold text-red-600">{error}</p>;
  if (!rows) return <div className="py-10 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-indigo-500" /></div>;
  if (rows.length === 0) return <p className={`${card} p-8 text-center text-slate-500 font-bold`}>{empty}</p>;
  return null;
};

const confirmDelete = (what: string) => window.confirm(`حذف ${what} نهائيًا؟ تُسجَّل العملية في سجل العمليات.`);

// ─── Overview ────────────────────────────────────────────────────────────────

const OverviewTab = ({ data, onRefresh }: { data: Overview | null; onRefresh: () => void }) => {
  if (!data) return <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  const tiles = [
    { label: 'إجمالي التبرعات', value: fmtMoney(data.donations_total), sub: `${data.donations_count} عملية`, color: 'text-emerald-700' },
    { label: 'إجمالي المصاريف', value: fmtMoney(data.expenses_total), sub: `${data.expenses_count} عملية`, color: 'text-red-600' },
    { label: 'الكفالات المستلمة', value: fmtMoney(data.sponsorship_received), sub: `المستحق: ${fmtMoney(data.sponsorship_due)}`, color: 'text-indigo-700' },
    { label: 'الرصيد المتبقي', value: fmtMoney(data.balance), sub: 'تبرعات + كفالات − مصاريف', color: data.balance < 0 ? 'text-red-600' : 'text-[#262150]' },
    { label: 'كفالات متأخرة', value: fmtMoney(data.sponsorship_overdue), sub: 'مستحق لم يُستلم', color: data.sponsorship_overdue > 0 ? 'text-amber-700' : 'text-slate-600' },
    { label: 'المتكفلون / الطلاب المكفولون', value: `${data.sponsors_active} / ${data.sponsored_students}`, sub: `إجمالي الكفالات: ${data.sponsors_count}`, color: 'text-[#262150]' },
  ];
  const maxCat = Math.max(1, ...data.categories.map(c => Number(c.total)));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">تتحدث الأرقام تلقائيًا مع كل عملية.</p>
        <button onClick={onRefresh} className={btnSoft}><RefreshCw className="w-4 h-4" /> تحديث</button>
      </div>
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map(t => (
          <div key={t.label} className={`${card} p-4`}>
            <p className="text-xs font-bold text-slate-500">{t.label}</p>
            <p className={`mt-1 text-xl sm:text-2xl font-black tabular-nums ${t.color}`}>{t.value}</p>
            <p className="mt-1 text-xs text-slate-400">{t.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={`${card} p-4 min-w-0`}>
          <h4 className="font-black mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-500" /> هذا الشهر</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>التبرعات</span><b className="text-emerald-700 tabular-nums">{fmtMoney(data.month.donations)}</b></li>
            <li className="flex justify-between"><span>دفعات الكفالة</span><b className="text-indigo-700 tabular-nums">{fmtMoney(data.month.payments)}</b></li>
            <li className="flex justify-between"><span>المصاريف</span><b className="text-red-600 tabular-nums">{fmtMoney(data.month.expenses)}</b></li>
            <li className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2"><span className="font-bold">الصافي</span>
              <b className="tabular-nums">{fmtMoney(Number(data.month.donations) + Number(data.month.payments) - Number(data.month.expenses))}</b></li>
          </ul>
          {data.categories.length > 0 && (
            <>
              <h4 className="font-black mt-5 mb-2 text-sm">المصاريف حسب التصنيف</h4>
              <ul className="space-y-2">
                {data.categories.map(c => (
                  <li key={c.category} className="text-xs">
                    <div className="flex justify-between mb-1"><span className="font-bold">{c.category}</span><span className="tabular-nums">{fmtMoney(c.total)}</span></div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-red-400" style={{ width: `${(Number(c.total) / maxCat) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className={`${card} p-4 min-w-0`}>
          <h4 className="font-black mb-3 flex items-center gap-2"><History className="w-4 h-4 text-indigo-500" /> آخر العمليات المالية</h4>
          {data.latest.length === 0 ? <p className="text-sm text-slate-500 text-center py-6">لا توجد عمليات بعد</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.latest.map(m => (
                <li key={`${m.kind}-${m.id}`} className="py-2 flex items-center gap-2 text-sm">
                  <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${m.kind === 'expense' ? 'bg-red-50 text-red-600' : m.kind === 'payment' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>{MOVEMENT_LABELS[m.kind]}</span>
                  <span className="flex-1 min-w-0"><span className="block truncate">{m.label}</span><span className="block text-xs text-slate-400">{fmtDate(m.op_date)}</span></span>
                  <b className={`tabular-nums whitespace-nowrap ${m.kind === 'expense' ? 'text-red-600' : 'text-emerald-700'}`}>{m.kind === 'expense' ? '−' : '+'}{fmtMoney(m.amount)}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Donations ───────────────────────────────────────────────────────────────

const DonationForm = ({ item, onClose, onSaved }: { item: Donation | null; onClose: () => void; onSaved: () => void }) => {
  const [f, setF] = useState({ name: item?.donor_name ?? '', phone: item?.donor_phone ?? '', amount: item ? String(item.amount) : '', date: item?.donation_date ?? todayISO(), notes: item?.notes ?? '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (f.name.trim().length < 2 || !(Number(f.amount) > 0) || !f.date) { toast.error('أكمل اسم المتبرع والمبلغ والتاريخ'); return; }
    setBusy(true);
    try { await saveFinance('donation', item?.id ?? null, f); toast.success(item ? 'تم تعديل التبرع' : 'تمت إضافة التبرع'); onSaved(); }
    catch (err) { toast.error(errMsg(err, 'تعذّر الحفظ')); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={item ? 'تعديل تبرع' : 'تبرع جديد'} onClose={onClose}>
      <Field label="اسم المتبرع" required><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} maxLength={120} className={inputCls} /></Field>
      <Field label="رقم الهاتف"><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} inputMode="tel" dir="ltr" className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="المبلغ (أوقية)" required><input type="number" min={0} step="0.01" inputMode="decimal" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} className={inputCls} /></Field>
        <Field label="التاريخ" required><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
      </div>
      <Field label="ملاحظات"><textarea rows={2} maxLength={1000} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className={inputCls} /></Field>
      <button onClick={() => void save()} disabled={busy} className={`${btnNavy} w-full`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ</button>
    </Modal>
  );
};

const DonationsTab = ({ onChanged }: { onChanged: () => void }) => {
  const [filters, setFilters] = useState<Filters>({});
  const { rows, error, reload } = useFinanceList<Donation>('donations', filters);
  const [editing, setEditing] = useState<Donation | null | undefined>(undefined);
  const total = (rows ?? []).reduce((a, r) => a + Number(r.amount), 0);
  const done = () => { setEditing(undefined); void reload(); onChanged(); };
  const remove = async (d: Donation) => {
    if (!confirmDelete(`تبرع ${d.donor_name}`)) return;
    try { await deleteFinance('donation', d.id); toast.success('تم الحذف'); void reload(); onChanged(); } catch (err) { toast.error(errMsg(err, 'تعذّر الحذف')); }
  };
  const pdf = () => void exportPdf({
    title: 'سجل التبرعات', subtitle: `مالية المعهد — ${rangeLabel(filters)}`, totalLabel: `الإجمالي: ${fmtMoney(total)}`,
    tiles: [{ label: 'عدد التبرعات', value: String(rows?.length ?? 0) }, { label: 'الإجمالي', value: fmtMoney(total), color: IN }],
    tables: [{
      title: 'التبرعات', columns: [{ label: '#', width: 0.5 }, { label: 'التاريخ', width: 1.4 }, { label: 'المتبرع', width: 2.6 }, { label: 'الهاتف', width: 1.6 }, { label: 'المبلغ', width: 1.8 }, { label: 'ملاحظات', width: 2.6 }],
      rows: (rows ?? []).map((r, i) => ({ cells: [String(i + 1), fmtDate(r.donation_date), r.donor_name, r.donor_phone ?? '—', fmtMoney(r.amount), r.notes ?? '—'] })),
    }],
    fileName: `Mahaja_Donations_${todayISO()}.pdf`,
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setEditing(null)} className={btnNavy}><Plus className="w-4 h-4" /> تبرع جديد</button>
        <button onClick={pdf} disabled={!rows?.length} className={btnSoft}><FileDown className="w-4 h-4" /> PDF</button>
        <span className="ms-auto font-black text-emerald-700 tabular-nums">الإجمالي: {fmtMoney(total)}</span>
      </div>
      <FilterBar filters={filters} setFilters={setFilters} />
      <ListState rows={rows} error={error} empty="لا توجد تبرعات" />
      <div className="grid gap-2">
        {rows?.map(d => (
          <div key={d.id} className={`${card} p-3 flex flex-wrap items-center gap-3`}>
            <div className="flex-1 min-w-[180px]">
              <p className="font-black">{d.donor_name} <span className="text-xs font-bold text-slate-400" dir="ltr">{d.donor_phone ?? ''}</span></p>
              <p className="text-xs text-slate-500">{fmtDate(d.donation_date)}{d.notes ? ` — ${d.notes}` : ''}</p>
            </div>
            <b className="text-emerald-700 tabular-nums">{fmtMoney(d.amount)}</b>
            <button onClick={() => setEditing(d)} aria-label="تعديل" className={btnSoft}><Edit2 className="w-4 h-4" /></button>
            <button onClick={() => void remove(d)} aria-label="حذف" className="p-2 rounded-xl bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      {editing !== undefined && <DonationForm item={editing} onClose={() => setEditing(undefined)} onSaved={done} />}
    </div>
  );
};

// ─── Expenses ────────────────────────────────────────────────────────────────

const ExpenseForm = ({ item, onClose, onSaved }: { item: Expense | null; onClose: () => void; onSaved: () => void }) => {
  const [f, setF] = useState({ description: item?.description ?? '', category: item?.category ?? '', amount: item ? String(item.amount) : '', date: item?.expense_date ?? todayISO(), notes: item?.notes ?? '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (f.description.trim().length < 2 || f.category.trim().length < 2 || !(Number(f.amount) > 0) || !f.date) { toast.error('أكمل الوصف والتصنيف والمبلغ والتاريخ'); return; }
    setBusy(true);
    try { await saveFinance('expense', item?.id ?? null, f); toast.success(item ? 'تم تعديل المصروف' : 'تمت إضافة المصروف'); onSaved(); }
    catch (err) { toast.error(errMsg(err, 'تعذّر الحفظ')); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={item ? 'تعديل مصروف' : 'مصروف جديد'} onClose={onClose}>
      <Field label="وصف المصروف" required><input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} maxLength={200} className={inputCls} /></Field>
      <Field label="التصنيف" required>
        <input list="mahaja-expense-categories" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} maxLength={60} placeholder="اختر أو اكتب تصنيفًا" className={inputCls} />
        <datalist id="mahaja-expense-categories">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="المبلغ (أوقية)" required><input type="number" min={0} step="0.01" inputMode="decimal" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} className={inputCls} /></Field>
        <Field label="تاريخ الصرف" required><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
      </div>
      <Field label="ملاحظات"><textarea rows={2} maxLength={1000} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className={inputCls} /></Field>
      <button onClick={() => void save()} disabled={busy} className={`${btnNavy} w-full`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ</button>
    </Modal>
  );
};

const ExpensesTab = ({ onChanged, categories }: { onChanged: () => void; categories: string[] }) => {
  const [filters, setFilters] = useState<Filters>({});
  const { rows, error, reload } = useFinanceList<Expense>('expenses', filters);
  const [editing, setEditing] = useState<Expense | null | undefined>(undefined);
  const total = (rows ?? []).reduce((a, r) => a + Number(r.amount), 0);
  const done = () => { setEditing(undefined); void reload(); onChanged(); };
  const remove = async (x: Expense) => {
    if (!confirmDelete(`مصروف «${x.description}»`)) return;
    try { await deleteFinance('expense', x.id); toast.success('تم الحذف'); void reload(); onChanged(); } catch (err) { toast.error(errMsg(err, 'تعذّر الحذف')); }
  };
  const allCats = [...new Set([...categories, ...EXPENSE_CATEGORIES])];
  const pdf = () => void exportPdf({
    title: 'سجل المصاريف', subtitle: `مالية المعهد — ${rangeLabel(filters)}${filters.type ? ` — ${filters.type}` : ''}`, totalLabel: `الإجمالي: ${fmtMoney(total)}`,
    tiles: [{ label: 'عدد المصاريف', value: String(rows?.length ?? 0) }, { label: 'الإجمالي', value: fmtMoney(total), color: OUT }],
    tables: [{
      title: 'المصاريف', columns: [{ label: '#', width: 0.5 }, { label: 'التاريخ', width: 1.4 }, { label: 'الوصف', width: 2.8 }, { label: 'التصنيف', width: 1.7 }, { label: 'المبلغ', width: 1.8 }, { label: 'ملاحظات', width: 2.3 }],
      rows: (rows ?? []).map((r, i) => ({ cells: [String(i + 1), fmtDate(r.expense_date), r.description, r.category, fmtMoney(r.amount), r.notes ?? '—'] })),
    }],
    fileName: `Mahaja_Expenses_${todayISO()}.pdf`,
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setEditing(null)} className={btnNavy}><Plus className="w-4 h-4" /> مصروف جديد</button>
        <button onClick={pdf} disabled={!rows?.length} className={btnSoft}><FileDown className="w-4 h-4" /> PDF</button>
        <span className="ms-auto font-black text-red-600 tabular-nums">الإجمالي: {fmtMoney(total)}</span>
      </div>
      <FilterBar filters={filters} setFilters={setFilters}>
        <select aria-label="التصنيف" value={filters.type ?? ''} onChange={e => setFilters({ ...filters, type: e.target.value || undefined })} className={inputCls}>
          <option value="">كل التصنيفات</option>
          {allCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </FilterBar>
      <ListState rows={rows} error={error} empty="لا توجد مصاريف" />
      <div className="grid gap-2">
        {rows?.map(x => (
          <div key={x.id} className={`${card} p-3 flex flex-wrap items-center gap-3`}>
            <div className="flex-1 min-w-[180px]">
              <p className="font-black">{x.description} <span className="ms-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">{x.category}</span></p>
              <p className="text-xs text-slate-500">{fmtDate(x.expense_date)}{x.notes ? ` — ${x.notes}` : ''}</p>
            </div>
            <b className="text-red-600 tabular-nums">{fmtMoney(x.amount)}</b>
            <button onClick={() => setEditing(x)} aria-label="تعديل" className={btnSoft}><Edit2 className="w-4 h-4" /></button>
            <button onClick={() => void remove(x)} aria-label="حذف" className="p-2 rounded-xl bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      {editing !== undefined && <ExpenseForm item={editing} onClose={() => setEditing(undefined)} onSaved={done} />}
    </div>
  );
};

// ─── Sponsorships ────────────────────────────────────────────────────────────

const SponsorForm = ({ item, onClose, onSaved }: { item: Sponsor | null; onClose: () => void; onSaved: () => void }) => {
  const [f, setF] = useState({
    name: item?.sponsor_name ?? '', phone: item?.sponsor_phone ?? '', amount: item ? String(item.amount) : '', frequency: (item?.frequency ?? 'monthly') as Frequency,
    date: item?.start_date ?? todayISO(), status: (item?.status ?? 'active') as SponsorStatus, status_date: item?.status_changed_at ?? '', notes: item?.notes ?? '',
  });
  const [ids, setIds] = useState<string[]>(item?.students.map(s => s.id) ?? []);
  const [options, setOptions] = useState<StudentOption[] | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getStudentOptions().then(setOptions).catch(err => { toast.error(errMsg(err, 'تعذّر تحميل الطلاب')); setOptions([]); }); }, []);
  const byId = new Map((options ?? []).map(s => [s.id, s]));
  const list = (options ?? []).filter(s => !ids.includes(s.id) && (!q.trim() || s.full_name.includes(q.trim()) || formatStudentCode(s).includes(q.trim().toUpperCase())));

  const save = async () => {
    if (f.name.trim().length < 2 || !(Number(f.amount) > 0) || !f.date) { toast.error('أكمل اسم المتكفل والمبلغ وتاريخ البداية'); return; }
    setBusy(true);
    try { await saveFinance('sponsor', item?.id ?? null, { ...f, student_ids: ids }); toast.success(item ? 'تم تعديل الكفالة' : 'تمت إضافة الكفالة'); onSaved(); }
    catch (err) { toast.error(errMsg(err, 'تعذّر الحفظ')); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={item ? 'تعديل كفالة' : 'كفالة جديدة'} onClose={onClose}>
      <Field label="اسم المتكفل" required><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} maxLength={120} className={inputCls} /></Field>
      <Field label="رقم الهاتف"><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} inputMode="tel" dir="ltr" className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="مبلغ الكفالة لكل دفعة" required><input type="number" min={0} step="0.01" inputMode="decimal" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} className={inputCls} /></Field>
        <Field label="دورية الدفع" required>
          <select value={f.frequency} onChange={e => setF({ ...f, frequency: e.target.value as Frequency })} className={inputCls}>
            {FREQUENCIES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </Field>
        <Field label="تاريخ بداية الكفالة" required><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
        <Field label="الحالة">
          <select value={f.status} onChange={e => setF({ ...f, status: e.target.value as SponsorStatus })} className={inputCls}>
            {SPONSOR_STATUSES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </Field>
        {f.status !== 'active' && (
          <Field label={f.status === 'ended' ? 'تاريخ الانتهاء' : 'تاريخ التوقف'}><input type="date" value={f.status_date} onChange={e => setF({ ...f, status_date: e.target.value })} className={inputCls} /></Field>
        )}
      </div>
      <div>
        <span className="block text-sm font-bold mb-1.5">الطلاب المكفولون ({ids.length})</span>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {ids.map(id => (
            <span key={id} className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 text-xs font-bold flex items-center gap-1">
              {byId.get(id)?.full_name ?? item?.students.find(s => s.id === id)?.full_name ?? '—'}
              <button onClick={() => setIds(x => x.filter(y => y !== id))} aria-label="إزالة"><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث عن طالب من طلاب المحجة" className={inputCls} />
        <ul className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {options === null ? <li className="p-3 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></li> : list.slice(0, 50).map(s => (
            <li key={s.id}><button onClick={() => setIds(x => [...x, s.id])} className="w-full p-2.5 text-start text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Plus className="w-4 h-4 text-indigo-600" /><span className="flex-1">{s.full_name} <span className="text-xs text-slate-400">{formatStudentCode(s)}</span></span>
              {s.sponsored && <span className="text-[11px] font-bold text-amber-700">مكفول</span>}
            </button></li>
          ))}
        </ul>
      </div>
      <Field label="ملاحظات"><textarea rows={2} maxLength={1000} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className={inputCls} /></Field>
      <button onClick={() => void save()} disabled={busy} className={`${btnNavy} w-full`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ</button>
    </Modal>
  );
};

const PaymentForm = ({ sponsor, item, onClose, onSaved }: { sponsor: Sponsor; item: Payment | null; onClose: () => void; onSaved: () => void }) => {
  const [f, setF] = useState({ amount: item ? String(item.amount) : String(sponsor.amount), date: item?.payment_date ?? todayISO(), period_label: item?.period_label ?? '', notes: item?.notes ?? '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!(Number(f.amount) > 0) || !f.date) { toast.error('أكمل المبلغ والتاريخ'); return; }
    setBusy(true);
    try { await saveFinance('payment', item?.id ?? null, { ...f, sponsor_id: sponsor.id }); toast.success('تم تسجيل الدفعة'); onSaved(); }
    catch (err) { toast.error(errMsg(err, 'تعذّر الحفظ')); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={`${item ? 'تعديل دفعة' : 'تسجيل دفعة'} — ${sponsor.sponsor_name}`} onClose={onClose}>
      <p className="text-sm text-slate-500">المستحق حتى اليوم: <b>{fmtMoney(sponsor.due)}</b> — المستلم: <b>{fmtMoney(sponsor.received)}</b> — المتأخر: <b className="text-amber-700">{fmtMoney(sponsor.overdue)}</b></p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="المبلغ المستلم" required><input type="number" min={0} step="0.01" inputMode="decimal" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} className={inputCls} /></Field>
        <Field label="تاريخ الاستلام" required><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
      </div>
      <Field label="الفترة المدفوعة (مثال: نوفمبر 2026)"><input value={f.period_label} onChange={e => setF({ ...f, period_label: e.target.value })} maxLength={60} className={inputCls} /></Field>
      <Field label="ملاحظات"><textarea rows={2} maxLength={1000} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className={inputCls} /></Field>
      <button onClick={() => void save()} disabled={busy} className={`${btnNavy} w-full`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ الدفعة</button>
    </Modal>
  );
};

const PaymentsList = ({ sponsor, onClose, onChanged }: { sponsor: Sponsor; onClose: () => void; onChanged: () => void }) => {
  const filters = useMemo<Filters>(() => ({ sponsor_id: sponsor.id }), [sponsor.id]);
  const { rows, error, reload } = useFinanceList<Payment>('payments', filters);
  const [editing, setEditing] = useState<Payment | null | undefined>(undefined);
  const remove = async (p: Payment) => {
    if (!confirmDelete('هذه الدفعة')) return;
    try { await deleteFinance('payment', p.id); toast.success('تم الحذف'); void reload(); onChanged(); } catch (err) { toast.error(errMsg(err, 'تعذّر الحذف')); }
  };
  const pdf = () => void exportPdf({
    title: 'دفعات الكفالة', subtitle: `${sponsor.sponsor_name} — ${frequencyLabel(sponsor.frequency)} — ${fmtMoney(sponsor.amount)} — منذ ${fmtDate(sponsor.start_date)}`,
    totalLabel: `المستلم: ${fmtMoney(sponsor.received)}`,
    tiles: [{ label: 'المستحق', value: fmtMoney(sponsor.due) }, { label: 'المستلم', value: fmtMoney(sponsor.received), color: IN }, { label: 'المتأخر', value: fmtMoney(sponsor.overdue), color: '#b45309' }],
    tables: [
      { title: 'الطلاب المكفولون', columns: [{ label: '#', width: 0.5 }, { label: 'الطالب', width: 4 }, { label: 'الرقم', width: 1.5 }],
        rows: sponsor.students.map((s, i) => ({ cells: [String(i + 1), s.full_name, formatStudentCode(s)] })), empty: 'لا يوجد طلاب مرتبطون' },
      { title: 'الدفعات', columns: [{ label: '#', width: 0.5 }, { label: 'التاريخ', width: 1.5 }, { label: 'الفترة', width: 2 }, { label: 'المبلغ', width: 1.8 }, { label: 'ملاحظات', width: 2.6 }],
        rows: (rows ?? []).map((p, i) => ({ cells: [String(i + 1), fmtDate(p.payment_date), p.period_label ?? '—', fmtMoney(p.amount), p.notes ?? '—'] })), empty: 'لا توجد دفعات' },
    ],
    fileName: `Mahaja_Sponsorship_${todayISO()}.pdf`,
  });
  return (
    <Modal title={`دفعات — ${sponsor.sponsor_name}`} onClose={onClose}>
      <div className="flex gap-2">
        <button onClick={() => setEditing(null)} className={`${btnNavy} flex-1`}><Plus className="w-4 h-4" /> تسجيل دفعة</button>
        <button onClick={pdf} className={btnSoft}><FileDown className="w-4 h-4" /> PDF</button>
      </div>
      <ListState rows={rows} error={error} empty="لا توجد دفعات بعد" />
      <ul className="space-y-2">
        {rows?.map(p => (
          <li key={p.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center gap-2 text-sm">
            <span className="flex-1"><b className="tabular-nums text-emerald-700">{fmtMoney(p.amount)}</b> — {fmtDate(p.payment_date)}{p.period_label ? ` — ${p.period_label}` : ''}</span>
            <button onClick={() => setEditing(p)} aria-label="تعديل" className="p-1.5 rounded-lg hover:bg-white"><Edit2 className="w-4 h-4" /></button>
            <button onClick={() => void remove(p)} aria-label="حذف" className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
          </li>
        ))}
      </ul>
      {editing !== undefined && <PaymentForm sponsor={sponsor} item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); void reload(); onChanged(); }} />}
    </Modal>
  );
};

const SponsorsTab = ({ onChanged }: { onChanged: () => void }) => {
  const [filters, setFilters] = useState<Filters>({});
  const { rows, error, reload } = useFinanceList<Sponsor>('sponsors', filters);
  const [editing, setEditing] = useState<Sponsor | null | undefined>(undefined);
  const [paying, setPaying] = useState<Sponsor | null>(null);
  const [payments, setPayments] = useState<Sponsor | null>(null);
  const changed = () => { void reload(); onChanged(); };
  const remove = async (s: Sponsor) => {
    if (!confirmDelete(`كفالة ${s.sponsor_name}`)) return;
    try { await deleteFinance('sponsor', s.id); toast.success('تم الحذف'); changed(); } catch (err) { toast.error(errMsg(err, 'تعذّر الحذف')); }
  };
  const sum = (k: 'received' | 'due' | 'overdue') => (rows ?? []).reduce((a, r) => a + Number(r[k]), 0);
  const pdf = () => void exportPdf({
    title: 'سجل كفالات الطلاب', subtitle: filters.type ? statusInfo(filters.type).label : 'كل الكفالات', totalLabel: `عدد الكفالات: ${rows?.length ?? 0}`,
    tiles: [{ label: 'المستحق', value: fmtMoney(sum('due')) }, { label: 'المستلم', value: fmtMoney(sum('received')), color: IN }, { label: 'المتأخر', value: fmtMoney(sum('overdue')), color: '#b45309' }],
    tables: [{
      title: 'الكفالات', columns: [
        { label: 'المتكفل', width: 2.2 }, { label: 'الطلاب المكفولون', width: 2.5 }, { label: 'المبلغ والدورية', width: 2 }, { label: 'البداية', width: 1.6 },
        { label: 'الحالة', width: 1.2 }, { label: 'المستلم', width: 1.6 }, { label: 'المتأخر', width: 1.6 }],
      rows: (rows ?? []).map(s => ({
        cells: [`${s.sponsor_name}${s.sponsor_phone ? `\n${s.sponsor_phone}` : ''}`, s.students.map(x => x.full_name).join('، ') || '—',
          `${fmtMoney(s.amount)}\n${frequencyLabel(s.frequency)}`, fmtDate(s.start_date), statusInfo(s.status).label, fmtMoney(s.received), fmtMoney(s.overdue)],
        chips: [null, null, null, null, s.status === 'active' ? '#059669' : s.status === 'paused' ? '#d97706' : '#64748b', null, Number(s.overdue) > 0 ? '#b45309' : null],
      })),
    }],
    fileName: `Mahaja_Sponsorships_${todayISO()}.pdf`,
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setEditing(null)} className={btnNavy}><Plus className="w-4 h-4" /> كفالة جديدة</button>
        <button onClick={pdf} disabled={!rows?.length} className={btnSoft}><FileDown className="w-4 h-4" /> PDF</button>
        <span className="ms-auto text-sm font-bold">المستلم: <b className="text-emerald-700 tabular-nums">{fmtMoney(sum('received'))}</b> — المتأخر: <b className="text-amber-700 tabular-nums">{fmtMoney(sum('overdue'))}</b></span>
      </div>
      <div className={`${card} p-3 grid gap-2 sm:grid-cols-[1fr_auto]`}>
        <label className="relative block">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
          <input value={filters.q ?? ''} onChange={e => setFilters({ ...filters, q: e.target.value })} placeholder="بحث بالمتكفل أو الطالب…" className={`${inputCls} ps-9`} />
        </label>
        <select aria-label="الحالة" value={filters.type ?? ''} onChange={e => setFilters({ ...filters, type: e.target.value || undefined })} className={inputCls}>
          <option value="">كل الحالات</option>
          {SPONSOR_STATUSES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <ListState rows={rows} error={error} empty="لا توجد كفالات" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {rows?.map(s => (
          <article key={s.id} className={`${card} p-4 flex flex-col min-w-0`} aria-label={`كفالة ${s.sponsor_name}`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-black truncate">{s.sponsor_name}</p>
                <p className="text-xs text-slate-500" dir="ltr">{s.sponsor_phone ?? ''}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black ${statusInfo(s.status).cls}`}>{statusInfo(s.status).label}</span>
            </div>
            <p className="mt-2 text-sm"><b className="tabular-nums">{fmtMoney(s.amount)}</b> — {frequencyLabel(s.frequency)} — منذ {fmtDate(s.start_date)}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 flex items-start gap-1.5"><Users className="w-4 h-4 shrink-0 mt-0.5" /> {s.students_count} طالب: {s.students.map(x => x.full_name).join('، ') || '—'}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800"><b className="block text-sm tabular-nums">{fmtMoney(s.due)}</b>المستحق</div>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20"><b className="block text-sm tabular-nums text-emerald-700">{fmtMoney(s.received)}</b>المستلم</div>
              <div className={`p-2 rounded-xl ${Number(s.overdue) > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                <b className={`block text-sm tabular-nums ${Number(s.overdue) > 0 ? 'text-amber-700' : ''}`}>{fmtMoney(s.overdue)}</b>المتأخر</div>
            </div>
            {Number(s.overdue) > 0 && <p className="mt-2 text-xs font-bold text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> دفعات متأخرة{s.last_payment ? ` — آخر دفعة ${fmtDate(s.last_payment)}` : ' — لا دفعات بعد'}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setPaying(s)} className={`${btnNavy} flex-1 py-2 text-sm`}><HandCoins className="w-4 h-4" /> تسجيل دفعة</button>
              <button onClick={() => setPayments(s)} className={`${btnSoft} text-sm`}><History className="w-4 h-4" /> الدفعات</button>
              <button onClick={() => setEditing(s)} aria-label="تعديل" className={btnSoft}><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => void remove(s)} aria-label="حذف" className="p-2 rounded-xl bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </article>
        ))}
      </div>
      {editing !== undefined && <SponsorForm item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); changed(); }} />}
      {paying && <PaymentForm sponsor={paying} item={null} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); changed(); }} />}
      {payments && <PaymentsList sponsor={payments} onClose={() => { setPayments(null); changed(); }} onChanged={changed} />}
    </div>
  );
};

// ─── Reports ─────────────────────────────────────────────────────────────────

const REPORT_TITLES: Record<PeriodKind, string> = { day: 'اليومي', month: 'الشهري', year: 'السنوي', custom: 'لفترة محددة' };

const ReportsTab = ({ today }: { today: string }) => {
  const [kind, setKind] = useState<PeriodKind>('month');
  const [day, setDay] = useState(today);
  const [to, setTo] = useState(today);
  const [type, setType] = useState<'' | MovementKind>('');
  const [q, setQ] = useState('');
  const range = periodRange(kind, day, to);
  const filters = useMemo<Filters>(() => ({ from: range.from, to: range.to, type: type || undefined, q }), [range.from, range.to, type, q]);
  const { rows, error } = useFinanceList<Movement>('movements', filters);
  const totals = (k: MovementKind) => (rows ?? []).filter(r => r.kind === k).reduce((a, r) => a + Number(r.amount), 0);
  const income = totals('donation') + totals('payment');
  const net = income - totals('expense');
  const periodText = range.from === range.to ? fmtDate(range.from) : `من ${fmtDate(range.from)} إلى ${fmtDate(range.to)}`;

  const pdf = () => {
    const t: FinanceTable = {
      title: 'العمليات', columns: [{ label: '#', width: 0.5 }, { label: 'التاريخ', width: 1.3 }, { label: 'النوع', width: 1.3 }, { label: 'البيان', width: 2.6 }, { label: 'التفاصيل', width: 1.8 }, { label: 'المبلغ', width: 1.8 }, { label: 'ملاحظات', width: 2 }],
      rows: (rows ?? []).map((m, i) => ({
        cells: [String(i + 1), fmtDate(m.op_date), MOVEMENT_LABELS[m.kind], m.label, m.detail || '—', `${m.kind === 'expense' ? '−' : '+'}${fmtMoney(m.amount)}`, m.notes ?? '—'],
        chips: [null, null, m.kind === 'expense' ? OUT : m.kind === 'payment' ? '#4f46e5' : IN, null, null, null, null],
      })),
      empty: 'لا توجد عمليات في هذه الفترة',
    };
    void exportPdf({
      title: `التقرير المالي ${REPORT_TITLES[kind]}`,
      subtitle: `مالية المعهد — ${periodText}${type ? ` — ${MOVEMENT_LABELS[type]} فقط` : ''}${q ? ` — بحث: ${q}` : ''}`,
      totalLabel: `الصافي: ${fmtMoney(net)}`,
      tiles: [
        { label: 'التبرعات', value: fmtMoney(totals('donation')), color: IN },
        { label: 'دفعات الكفالة', value: fmtMoney(totals('payment')), color: '#4f46e5' },
        { label: 'المصاريف', value: fmtMoney(totals('expense')), color: OUT },
        { label: 'المداخيل', value: fmtMoney(income) },
        { label: 'الصافي', value: fmtMoney(net), color: net < 0 ? OUT : IN },
        { label: 'عدد العمليات', value: String(rows?.length ?? 0) },
      ],
      tables: [t],
      fileName: `Mahaja_Finance_${kind}_${range.from}_${range.to}.pdf`,
    });
  };

  return (
    <div className="space-y-3">
      <div className={`${card} p-4 space-y-3`}>
        <div className="grid grid-cols-4 gap-1.5">
          {PERIOD_KINDS.map(p => (
            <button key={p.id} onClick={() => setKind(p.id)} aria-pressed={kind === p.id}
              className={`py-2 rounded-xl text-sm font-black border-2 ${kind === p.id ? 'border-[#262150] bg-[#262150] text-white' : 'border-slate-200 dark:border-slate-700'}`}>{p.label}</button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label={kind === 'custom' ? 'من' : kind === 'day' ? 'اليوم' : kind === 'month' ? 'أي يوم من الشهر' : 'أي يوم من السنة'}>
            <input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)} className={inputCls} /></Field>
          {kind === 'custom' && <Field label="إلى"><input type="date" value={to} onChange={e => e.target.value && setTo(e.target.value)} className={inputCls} /></Field>}
          <Field label="نوع العملية">
            <select value={type} onChange={e => setType(e.target.value as '' | MovementKind)} className={inputCls}>
              <option value="">كل العمليات</option>
              {(Object.keys(MOVEMENT_LABELS) as MovementKind[]).map(k => <option key={k} value={k}>{MOVEMENT_LABELS[k]}</option>)}
            </select></Field>
          <Field label="بحث"><input value={q} onChange={e => setQ(e.target.value)} className={inputCls} placeholder="اسم، تصنيف، ملاحظة…" /></Field>
        </div>
        <p className="text-sm text-slate-500 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> {periodText}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[['التبرعات', totals('donation'), 'text-emerald-700'], ['دفعات الكفالة', totals('payment'), 'text-indigo-700'], ['المصاريف', totals('expense'), 'text-red-600'], ['الصافي', net, net < 0 ? 'text-red-600' : 'text-[#262150]']].map(([l, v, c]) => (
          <div key={l as string} className={`${card} p-3 text-center`}><b className={`block tabular-nums ${c}`}>{fmtMoney(v as number)}</b><span className="text-xs text-slate-500">{l}</span></div>
        ))}
      </div>
      <button onClick={pdf} disabled={!rows} className={`${btnNavy} w-full py-3`}><FileDown className="w-5 h-5" /> تنزيل / طباعة التقرير PDF</button>
      <ListState rows={rows} error={error} empty="لا توجد عمليات في هذه الفترة" />
      {!!rows?.length && (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
              {['التاريخ', 'النوع', 'البيان', 'التفاصيل', 'المبلغ'].map(h => <th key={h} className="p-2.5 text-start font-bold">{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(m => (
                <tr key={`${m.kind}-${m.id}`} className="border-b border-slate-50 dark:border-slate-800/60">
                  <td className="p-2.5 whitespace-nowrap">{fmtDate(m.op_date)}</td>
                  <td className="p-2.5 whitespace-nowrap font-bold">{MOVEMENT_LABELS[m.kind]}</td>
                  <td className="p-2.5">{m.label}</td>
                  <td className="p-2.5 text-slate-500">{m.detail || '—'}</td>
                  <td className={`p-2.5 whitespace-nowrap font-black tabular-nums ${m.kind === 'expense' ? 'text-red-600' : 'text-emerald-700'}`}>{m.kind === 'expense' ? '−' : '+'}{fmtMoney(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Log ─────────────────────────────────────────────────────────────────────

const LogTab = () => {
  const [filters, setFilters] = useState<Filters>({});
  const { rows, error } = useFinanceList<LogEntry>('log', filters);
  const when = (iso: string) => new Date(iso).toLocaleString('ar-MA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const pdf = () => void exportPdf({
    title: 'سجل العمليات المالية', subtitle: `مالية المعهد — ${rangeLabel(filters)}`, totalLabel: `عدد العمليات: ${rows?.length ?? 0}`,
    tables: [{
      title: 'العمليات', columns: [{ label: 'الوقت', width: 2 }, { label: 'العملية', width: 1.2 }, { label: 'القسم', width: 1.3 }, { label: 'التفاصيل', width: 4 }, { label: 'المشرف', width: 1.6 }],
      rows: (rows ?? []).map(l => ({ cells: [when(l.created_at), ACTION_LABELS[l.action] ?? l.action, ENTITY_LABELS[l.entity] ?? l.entity, l.summary ?? '—', l.actor ?? '—'],
        chips: [null, l.action === 'deleted' ? OUT : l.action === 'created' ? IN : '#4f46e5', null, null, null] })),
    }],
    fileName: `Mahaja_Finance_Log_${todayISO()}.pdf`,
  });
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={pdf} disabled={!rows?.length} className={btnSoft}><FileDown className="w-4 h-4" /> PDF</button></div>
      <FilterBar filters={filters} setFilters={setFilters}>
        <select aria-label="القسم" value={filters.type ?? ''} onChange={e => setFilters({ ...filters, type: e.target.value || undefined })} className={inputCls}>
          <option value="">كل الأقسام</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </FilterBar>
      <ListState rows={rows} error={error} empty="لا توجد عمليات مسجلة" />
      <ul className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
        {rows?.map(l => (
          <li key={l.id} className="p-3 text-sm flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${l.action === 'deleted' ? 'bg-red-50 text-red-600' : l.action === 'created' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>{ACTION_LABELS[l.action] ?? l.action}</span>
            <span className="flex-1 min-w-[160px]">{l.summary}</span>
            <span className="text-xs text-slate-500">{l.actor} — {when(l.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ─── Section ─────────────────────────────────────────────────────────────────

export const MahajaFinanceSection = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    try { setOverview(await getOverview()); setError(''); }
    catch (err) { setError(errMsg(err, 'تعذّر تحميل البيانات المالية')); }
  }, []);
  useEffect(() => { void loadOverview(); }, [loadOverview]);

  if (error && !overview) {
    return (
      <div className="p-6 rounded-2xl bg-amber-50 text-amber-900 text-center space-y-3" dir="rtl">
        <AlertTriangle className="w-8 h-8 mx-auto" />
        <p className="font-bold">{error}</p>
        <button onClick={() => void loadOverview()} className={`${btnSoft} mx-auto`}><RefreshCw className="w-4 h-4" /> إعادة المحاولة</button>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-3xl bg-[#262150] text-white p-5 flex flex-wrap items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><Wallet className="w-6 h-6 text-pink-200" /></div>
        <div className="flex-1 min-w-[200px]">
          <h3 className="text-xl font-black">مالية معهد المحجة البيضاء</h3>
          <p className="text-sm text-white/70">نظام مستقل عن مالية الجمعية: التبرعات، المصاريف، كفالة الطلاب، والتقارير.</p>
        </div>
        {overview && (
          <div className="px-4 py-2 rounded-2xl bg-white/10 text-center">
            <div className="text-xl font-black tabular-nums">{fmtMoney(overview.balance)}</div>
            <div className="text-xs text-pink-100/80 font-bold">الرصيد المتبقي</div>
          </div>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id}
            className={`px-3.5 py-2 rounded-xl text-sm font-black whitespace-nowrap flex items-center gap-1.5 ${tab === t.id ? 'bg-[#262150] text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <OverviewTab data={overview} onRefresh={() => void loadOverview()} />}
      {tab === 'donations' && <DonationsTab onChanged={() => void loadOverview()} />}
      {tab === 'expenses' && <ExpensesTab onChanged={() => void loadOverview()} categories={overview?.categories.map(c => c.category) ?? []} />}
      {tab === 'sponsors' && <SponsorsTab onChanged={() => void loadOverview()} />}
      {tab === 'reports' && <ReportsTab today={overview?.today ?? todayISO()} />}
      {tab === 'log' && <LogTab />}
    </div>
  );
};
