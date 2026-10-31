import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowRight, CalendarDays, Check, ClipboardList, Edit2, FileDown, Loader2, Plus, RefreshCw, Save, Search, Shuffle, Trash2, Users, UsersRound, X,
} from 'lucide-react';
import { formatDay, formatStudentCode, isSuspended, type MahajaStudent } from '../../../lib/mahajaStudents';
import {
  REPORT_KINDS, SURAHS, TEAM_PERIODS, TEAM_SIZE, deleteTeam, distributeTeams, getFollowup, getTeams, reportRange, saveFollowup, setTeamMembers,
  wirdError, type FollowupStudent, type MahajaTeam, type ReportKind, type TeamFollowup, type TeamPeriod, type TeamsOverview,
} from '../../../lib/mahajaTeams';

// Teams of 5 students (الفرق) and the daily follow-up of each team, inside the Mahaja section.

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';
const btnNavy = 'px-4 py-2.5 rounded-xl font-black text-white bg-[#262150] hover:bg-[#332c6b] flex items-center justify-center gap-2 disabled:opacity-60';
const btnSoft = 'px-4 py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 disabled:opacity-60';

type View = { kind: 'list' } | { kind: 'followup'; team: MahajaTeam } | { kind: 'members'; team: MahajaTeam | null };

// ─── Members of one team ─────────────────────────────────────────────────────

const MembersEditor = ({ team, teams, students, onBack, onSaved }: {
  team: MahajaTeam | null; teams: MahajaTeam[]; students: MahajaStudent[]; onBack: () => void; onSaved: () => void;
}) => {
  const [ids, setIds] = useState<string[]>(team?.members.map(m => m.id) ?? []);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const teamOf = useMemo(() => {
    const map = new Map<string, number>();
    teams.forEach(t => t.members.forEach(m => map.set(m.id, t.team_number)));
    return map;
  }, [teams]);
  const q = search.trim().toLowerCase();
  const list = students.filter(s => !ids.includes(s.id) && (!q || s.full_name.toLowerCase().includes(q) || formatStudentCode(s).toLowerCase().includes(q)));
  const byId = new Map(students.map(s => [s.id, s]));

  const save = async () => {
    setSaving(true);
    try {
      const r = await setTeamMembers(team?.id ?? null, ids);
      toast.success(team ? `تم حفظ أعضاء الفريق ${r.team_number}` : `تم إنشاء الفريق ${r.team_number}`);
      onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'تعذّر الحفظ'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="رجوع" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><ArrowRight className="w-5 h-5" /></button>
        <h4 className="font-black text-lg">{team ? `أعضاء الفريق ${team.team_number}` : 'فريق جديد'}</h4>
        <span className="ms-auto px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-black">{ids.length} / {TEAM_SIZE}</span>
      </div>
      <ul className="space-y-2">
        {ids.length === 0 && <li className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-center text-sm text-slate-500">لا أعضاء بعد</li>}
        {ids.map((id, i) => {
          const s = byId.get(id);
          return (
            <li key={id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
              <span className="w-7 h-7 rounded-full bg-[#262150] text-white text-sm font-black flex items-center justify-center">{i + 1}</span>
              <span className="flex-1 min-w-0"><b className="block truncate">{s?.full_name ?? '—'}</b>{s && <span className="text-xs text-slate-500">{formatStudentCode(s)}</span>}</span>
              <button onClick={() => setIds(x => x.filter(y => y !== id))} aria-label="إزالة" className="p-2 rounded-xl text-red-600 hover:bg-red-50"><X className="w-4 h-4" /></button>
            </li>
          );
        })}
      </ul>
      {ids.length < TEAM_SIZE && (
        <div className="space-y-2">
          <label className="relative block">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="أضف طالبًا: ابحث بالاسم أو الرقم" className={`${inputCls} ps-9`} />
          </label>
          <ul className="max-h-60 overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {list.slice(0, 60).map(s => {
              const current = teamOf.get(s.id);
              return (
                <li key={s.id}>
                  <button onClick={() => setIds(x => [...x, s.id])} className="w-full p-3 flex items-center gap-3 text-start hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Plus className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="flex-1 min-w-0"><b className="block truncate text-sm">{s.full_name}</b><span className="text-xs text-slate-500">{formatStudentCode(s)}{isSuspended(s) ? ' — موقوف' : ''}</span></span>
                    <span className={`text-xs font-bold whitespace-nowrap ${current ? 'text-amber-700' : 'text-slate-400'}`}>{current ? `في الفريق ${current} (سيُنقل)` : 'بلا فريق'}</span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="p-4 text-center text-sm text-slate-500">لا نتائج</li>}
          </ul>
        </div>
      )}
      <button onClick={() => void save()} disabled={saving} className={`${btnNavy} w-full`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ الأعضاء
      </button>
    </div>
  );
};

// ─── Follow-up form ──────────────────────────────────────────────────────────

const YesNo = ({ value, onChange, label }: { value: boolean | null | undefined; onChange: (v: boolean) => void; label: string }) => (
  <div>
    <span className="block text-xs font-bold text-slate-500 mb-1">{label}</span>
    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={label}>
      {[true, false].map(v => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`py-2 rounded-xl text-sm font-black border-2 ${value === v ? (v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-400 bg-red-50 text-red-600') : 'border-slate-200 dark:border-slate-700'}`}>
          {v ? 'نعم' : 'لا'}
        </button>
      ))}
    </div>
  </div>
);

const SurahAyah = ({ label, surah, ayah, onSurah, onAyah }: {
  label: string; surah?: number | null; ayah?: number | null; onSurah: (v: number | null) => void; onAyah: (v: number | null) => void;
}) => (
  <div>
    <span className="block text-xs font-bold text-slate-500 mb-1">{label}</span>
    <div className="grid grid-cols-[1fr_5.5rem] gap-1.5">
      <select value={surah ?? ''} onChange={e => onSurah(e.target.value ? Number(e.target.value) : null)} aria-label={`${label}: السورة`} className={inputCls}>
        <option value="">السورة</option>
        {SURAHS.map(([name], i) => <option key={name} value={i + 1}>{i + 1}. {name}</option>)}
      </select>
      <input type="number" inputMode="numeric" min={1} max={surah ? SURAHS[surah - 1][1] : 286} value={ayah ?? ''} placeholder="الآية" aria-label={`${label}: الآية`}
        onChange={e => onAyah(e.target.value ? Math.max(1, Number(e.target.value)) : null)} className={inputCls} />
    </div>
  </div>
);

const FollowupForm = ({ team, today, onBack, onSaved }: { team: MahajaTeam; today: string; onBack: () => void; onSaved: () => void }) => {
  const [date, setDate] = useState(today);
  const [data, setData] = useState<TeamFollowup | null>(null);
  const [period, setPeriod] = useState<TeamPeriod | null>(null);
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<FollowupStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const f = await getFollowup(team.id, d);
      setData(f); setPeriod(f.period); setNote(f.note ?? ''); setRows(f.students); setTried(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'تعذّر تحميل المتابعة'); }
    finally { setLoading(false); }
  }, [team.id]);
  useEffect(() => { void load(date); }, [date, load]);

  const set = (i: number, patch: Partial<FollowupStudent>) => setRows(r => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const errors = rows.map(wirdError);

  const save = async () => {
    setTried(true);
    if (!period) { toast.error('اختر نوع الدوام'); return; }
    if (errors.some(Boolean)) { toast.error('صحّح أرقام الآيات المشار إليها'); return; }
    setSaving(true);
    try {
      const f = await saveFollowup(team.id, date, { period, note, students: rows });
      setData(f); setRows(f.students);
      toast.success(`تم حفظ متابعة الفريق ${team.team_number} ليوم ${formatDay(date)}`);
      onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'تعذّر الحفظ'); }
    finally { setSaving(false); }
  };

  const dayPdf = async () => {
    setPdfBusy(true);
    try {
      const { exportTeamsReport } = await import('../../../utils/teamsPdf');
      const n = await exportTeamsReport({ kind: 'day', day: date, teamId: team.id, teamLabel: `الفريق ${team.team_number}` });
      if (!n) toast('لا توجد متابعة محفوظة لهذا اليوم بعد', { icon: 'ℹ️' });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'تعذّر إنشاء الملف'); }
    finally { setPdfBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onBack} aria-label="رجوع" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><ArrowRight className="w-5 h-5" /></button>
        <h4 className="font-black text-lg">نموذج متابعة — الفريق {team.team_number}</h4>
        {data?.exists && <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black flex items-center gap-1"><Check className="w-3.5 h-3.5" /> محفوظة</span>}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
        <label className="block"><span className="block text-xs font-bold text-slate-500 mb-1">التاريخ</span>
          <input type="date" value={date} max={today} onChange={e => e.target.value && setDate(e.target.value)} className={inputCls} /></label>
        <label className="block"><span className="block text-xs font-bold text-slate-500 mb-1">المتابعات السابقة</span>
          <select value={data?.dates.includes(date) ? date : ''} onChange={e => e.target.value && setDate(e.target.value)} className={inputCls}>
            <option value="">{data?.dates.length ? `اختر تاريخًا (${data.dates.length})` : 'لا توجد متابعات سابقة'}</option>
            {data?.dates.map(d => <option key={d} value={d}>{formatDay(d)}</option>)}
          </select></label>
        <div className="sm:col-span-2">
          <span className="block text-xs font-bold text-slate-500 mb-1">نوع الدوام *</span>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="نوع الدوام">
            {TEAM_PERIODS.map(p => (
              <button key={p.id} type="button" role="radio" aria-checked={period === p.id} onClick={() => setPeriod(p.id)}
                className={`py-2.5 rounded-xl text-sm font-black border-2 ${period === p.id ? 'border-[#262150] bg-[#262150] text-white' : tried && !period ? 'border-red-300' : 'border-slate-200 dark:border-slate-700'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <div className="py-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div> : (
        <>
          {rows.length === 0 && <p className="p-6 rounded-2xl bg-amber-50 text-amber-800 text-center font-bold text-sm">لا يوجد طلاب في هذا الفريق.</p>}
          <div className="space-y-3">
            {rows.map((s, i) => (
              <div key={s.student_id} className="p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-pink-200 text-[#262150] text-sm font-black flex items-center justify-center">{i + 1}</span>
                  <b className="flex-1 min-w-0 truncate">{s.student_name}</b>
                  {s.student_number && <span className="text-xs text-slate-500">{formatStudentCode({ student_number: s.student_number })}</span>}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <SurahAyah label="الورد من" surah={s.from_surah} ayah={s.from_ayah} onSurah={v => set(i, { from_surah: v })} onAyah={v => set(i, { from_ayah: v })} />
                  <SurahAyah label="إلى" surah={s.to_surah} ayah={s.to_ayah} onSurah={v => set(i, { to_surah: v })} onAyah={v => set(i, { to_ayah: v })} />
                </div>
                {tried && errors[i] && <p className="text-xs font-bold text-red-600">{errors[i]}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <YesNo label="هل حفظ الورد؟" value={s.memorized} onChange={v => set(i, { memorized: v })} />
                  <YesNo label="راجع الأحزاب القديمة على الأستاذ؟" value={s.reviewed_old} onChange={v => set(i, { reviewed_old: v })} />
                  <label className="block col-span-2 sm:col-span-1"><span className="block text-xs font-bold text-slate-500 mb-1">عدد مرات التكرار</span>
                    <input type="number" inputMode="numeric" min={0} max={1000} value={s.repetitions ?? ''} onChange={e => set(i, { repetitions: e.target.value === '' ? null : Math.min(1000, Math.max(0, Number(e.target.value))) })} className={inputCls} /></label>
                </div>
                <label className="block"><span className="block text-xs font-bold text-slate-500 mb-1">ملاحظات المشرف عن التحسن</span>
                  <textarea rows={2} maxLength={1000} value={s.supervisor_note ?? ''} onChange={e => set(i, { supervisor_note: e.target.value })} className={inputCls} /></label>
              </div>
            ))}
          </div>
          <label className="block"><span className="block text-xs font-bold text-slate-500 mb-1">ملاحظة عامة عن الفريق (اختياري)</span>
            <textarea rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} className={inputCls} /></label>
          {data?.exists && (data.updated_by || data.recorded_by) && (
            <p className="text-xs text-slate-500">آخر حفظ: {data.updated_by || data.recorded_by}{data.updated_at ? ` — ${new Date(data.updated_at).toLocaleString('ar-MA')}` : ''}</p>
          )}
          <div className="grid grid-cols-[1fr_auto] gap-2 sticky bottom-0 bg-white dark:bg-slate-900 pt-2">
            <button onClick={() => void save()} disabled={saving || rows.length === 0} className={btnNavy}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ المتابعة
            </button>
            <button onClick={() => void dayPdf()} disabled={pdfBusy || !data?.exists} className={btnSoft} title="تقرير هذا اليوم PDF">
              {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Reports ─────────────────────────────────────────────────────────────────

const ReportsPanel = ({ teams, today }: { teams: MahajaTeam[]; today: string }) => {
  const [kind, setKind] = useState<ReportKind>('day');
  const [day, setDay] = useState(today);
  const [teamId, setTeamId] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const range = reportRange(kind, day);

  const run = async () => {
    setProgress('جاري التحضير…');
    try {
      const { exportTeamsReport } = await import('../../../utils/teamsPdf');
      const t = teams.find(x => x.id === teamId);
      const n = await exportTeamsReport({ kind, day, teamId: teamId || null, teamLabel: t ? `الفريق ${t.team_number}` : 'جميع الفرق', onProgress: setProgress });
      toast.success(n ? `تم تنزيل التقرير (${n} متابعة)` : 'تم تنزيل التقرير: لا توجد متابعات في هذه الفترة');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'تعذّر إنشاء الملف'); }
    finally { setProgress(null); }
  };

  return (
    <div className="space-y-4">
      <div>
        <span className="block text-sm font-bold mb-2">نوع التقرير</span>
        <div className="grid grid-cols-4 gap-1.5">
          {REPORT_KINDS.map(k => (
            <button key={k.id} onClick={() => setKind(k.id)} aria-pressed={kind === k.id}
              className={`py-2.5 rounded-xl text-sm font-black border-2 ${kind === k.id ? 'border-[#262150] bg-[#262150] text-white' : 'border-slate-200 dark:border-slate-700'}`}>{k.label}</button>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block"><span className="block text-sm font-bold mb-1.5">{kind === 'day' ? 'اليوم' : kind === 'week' ? 'آخر يوم في الأسبوع' : kind === 'month' ? 'أي يوم من الشهر' : 'أي يوم من السنة'}</span>
          <input type="date" value={day} max={today} onChange={e => e.target.value && setDay(e.target.value)} className={inputCls} /></label>
        <label className="block"><span className="block text-sm font-bold mb-1.5">الفرق</span>
          <select value={teamId} onChange={e => setTeamId(e.target.value)} className={inputCls}>
            <option value="">جميع الفرق</option>
            {teams.map(t => <option key={t.id} value={t.id}>الفريق {t.team_number}</option>)}
          </select></label>
      </div>
      <p className="text-sm text-slate-500 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> الفترة: {range.from === range.to ? formatDay(range.from) : `من ${formatDay(range.from)} إلى ${formatDay(range.to)}`}</p>
      <button onClick={() => void run()} disabled={!!progress} className={`${btnNavy} w-full py-3`}>
        {progress ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />} {progress ?? 'تنزيل التقرير PDF'}
      </button>
    </div>
  );
};

// ─── Modal ───────────────────────────────────────────────────────────────────

export const TeamsModal = ({ students, onClose }: { students: MahajaStudent[]; onClose: () => void }) => {
  const [data, setData] = useState<TeamsOverview | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'teams' | 'reports'>('teams');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await getTeams()); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'تعذّر تحميل الفرق'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const distribute = async () => {
    if (!window.confirm('توزيع جميع الطلاب الذين ليس لهم فريق، حسب ترتيبهم، على فرق من 5 طلاب؟')) return;
    setBusy('distribute');
    try {
      const r = await distributeTeams();
      toast.success(r.placed ? `تم توزيع ${r.placed} طالبًا${r.new_teams ? ` وإنشاء ${r.new_teams} فرق جديدة` : ''}` : 'كل الطلاب موزعون على الفرق');
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'تعذّر التوزيع'); }
    finally { setBusy(null); }
  };

  const remove = async (t: MahajaTeam) => {
    if (!window.confirm(`حذف الفريق ${t.team_number}؟ يصبح أعضاؤه بلا فريق.`)) return;
    setBusy(t.id);
    try { await deleteTeam(t.id); toast.success('تم حذف الفريق'); await load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'تعذّر الحذف'); }
    finally { setBusy(null); }
  };

  const back = () => { setView({ kind: 'list' }); void load(); };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4" dir="rtl" onClick={onClose}>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="الفرق والمتابعة"
        className="w-full sm:max-w-3xl max-h-[96dvh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className="bg-[#262150] text-white px-5 py-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-black flex items-center gap-2"><UsersRound className="w-5 h-5 text-pink-200" /> الفرق والمتابعة</h3>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>
        {view.kind === 'list' && (
          <div className="px-4 pt-3 flex gap-2">
            {([['teams', 'الفرق', Users], ['reports', 'التقارير', FileDown]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id}
                className={`px-4 py-2 rounded-xl text-sm font-black flex items-center gap-1.5 ${tab === id ? 'bg-[#262150] text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {!data ? (
            error ? <p className="p-6 text-center font-bold text-red-600">{error}</p> : <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : view.kind === 'followup' ? (
            <FollowupForm team={view.team} today={data.today} onBack={back} onSaved={() => void load()} />
          ) : view.kind === 'members' ? (
            <MembersEditor team={view.team} teams={data.teams} students={students} onBack={back} onSaved={back} />
          ) : tab === 'reports' ? (
            <ReportsPanel teams={data.teams} today={data.today} />
          ) : (
            <div className="space-y-4">
              {data.can_manage && (
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex flex-wrap items-center gap-3">
                  <p className="flex-1 min-w-[200px] text-sm font-bold text-indigo-900 dark:text-indigo-200">
                    {data.teams.length === 0 ? 'لم تُنشأ الفرق بعد. وزّع الطلاب حسب ترتيبهم على فرق من 5.' : `طلاب بلا فريق: ${data.unassigned ?? 0}. الطلاب الجدد ينضمون تلقائيًا إلى آخر فريق.`}
                  </p>
                  <button onClick={() => void distribute()} disabled={!!busy || !data.unassigned} className={btnNavy}>
                    {busy === 'distribute' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />} توزيع الطلاب على الفرق
                  </button>
                  <button onClick={() => setView({ kind: 'members', team: null })} className={btnSoft}><Plus className="w-4 h-4" /> فريق جديد</button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-slate-600 dark:text-slate-300">{data.teams.length} فريقًا</p>
                <button onClick={() => void load()} className="text-sm font-bold text-slate-500 flex items-center gap-1"><RefreshCw className="w-4 h-4" /> تحديث</button>
              </div>
              {data.teams.length === 0 && <p className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-center text-slate-500 font-bold">لا توجد فرق بعد.</p>}
              <div className="grid sm:grid-cols-2 gap-3">
                {data.teams.map(t => (
                  <article key={t.id} className="p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 flex flex-col" aria-label={`الفريق ${t.team_number}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-xl bg-[#262150] text-white font-black">الفريق {t.team_number}</span>
                      <span className={`text-xs font-black ${t.members.length < TEAM_SIZE ? 'text-amber-700' : 'text-emerald-700'}`}>{t.members.length} / {TEAM_SIZE}</span>
                    </div>
                    <ol className="space-y-1 text-sm flex-1">
                      {t.members.map((m, i) => <li key={m.id} className="truncate"><span className="text-slate-400 tabular-nums">{i + 1}.</span> {m.full_name}{m.status === 'suspended' ? <span className="text-xs text-red-500"> (موقوف)</span> : null}</li>)}
                      {t.members.length === 0 && <li className="text-slate-400">بلا أعضاء</li>}
                    </ol>
                    <p className="mt-2 text-xs text-slate-500">{t.last_followup ? `آخر متابعة: ${formatDay(t.last_followup)} — ${t.followups_count} متابعة` : 'لا متابعات بعد'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => setView({ kind: 'followup', team: t })} className={`${btnNavy} flex-1 py-2 text-sm`}><ClipboardList className="w-4 h-4" /> نموذج المتابعة</button>
                      {data.can_manage && <button onClick={() => setView({ kind: 'members', team: t })} className={`${btnSoft} py-2 text-sm`}><Edit2 className="w-4 h-4" /> الأعضاء</button>}
                      {data.can_manage && t.followups_count === 0 && (
                        <button onClick={() => void remove(t)} disabled={busy === t.id} aria-label={`حذف الفريق ${t.team_number}`} className="px-3 py-2 rounded-xl bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
