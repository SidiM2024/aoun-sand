import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Landmark, Plus, Edit2, Trash2, Play, Square, Eye, EyeOff, Users, Loader2, X, Save, UserPlus, Camera, UserRound, RefreshCw, RotateCcw, Vote,
} from 'lucide-react';
import {
  adminDeleteCandidate, adminDeleteElection, adminListElections, adminSaveCandidate, adminSaveElection, adminSetElectionStatus,
  adminSetResultsVisible, PHASE_LABELS, removeSiteImage, uploadSiteImage, type Candidate, type Election,
} from '../../lib/siteApi';

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : '');
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString('ar-MA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-300';

const Modal = ({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) => (
  <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4" dir="rtl" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full sm:max-w-2xl max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-[#211d45] text-white">
        <h3 className="text-lg font-black">{title}</h3>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" aria-label="إغلاق"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-6 overflow-y-auto space-y-4">{children}</div>
      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">{footer}</div>
    </motion.div>
  </div>
);

const ElectionForm = ({ election, onClose, onSaved }: { election: Election | null; onClose: () => void; onSaved: () => void }) => {
  const [title, setTitle] = useState(election?.title ?? '');
  const [description, setDescription] = useState(election?.description ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(election?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(election?.ends_at ?? null));
  const [maxChoices, setMaxChoices] = useState(String(election?.max_choices ?? 1));
  const [eligibility, setEligibility] = useState<Election['eligibility']>(election?.eligibility ?? 'approved');
  const [saving, setSaving] = useState(false);
  const locked = (election?.voters_count ?? 0) > 0;

  const save = async () => {
    if (saving) return;
    if (title.trim().length < 3) { toast.error('عنوان الاقتراع مطلوب (3 أحرف على الأقل)'); return; }
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) { toast.error('موعد النهاية يجب أن يكون بعد موعد البداية'); return; }
    const max = Number(maxChoices);
    if (!Number.isInteger(max) || max < 1 || max > 50) { toast.error('عدد الاختيارات بين 1 و50'); return; }
    setSaving(true);
    try {
      await adminSaveElection(election?.id ?? null, {
        title: title.trim(), description: description.trim(), starts_at: fromLocalInput(startsAt), ends_at: fromLocalInput(endsAt),
        max_choices: max, eligibility,
      });
      toast.success(election ? 'تم تحديث الاقتراع' : 'تم إنشاء الاقتراع كمسودة. أضف المرشحين ثم افتح التصويت.');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={election ? 'تعديل الاقتراع' : 'اقتراع جديد'} onClose={onClose} footer={<>
      <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800">إلغاء</button>
      <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#211d45] flex items-center gap-2 disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ</button>
    </>}>
      <label className="block"><span className="block text-sm font-bold mb-1.5">عنوان الاقتراع *</span>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} className={inputCls} placeholder="مثال: انتخاب المكتب التنفيذي 2026" /></label>
      <label className="block"><span className="block text-sm font-bold mb-1.5">الوصف</span>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputCls} /></label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block"><span className="block text-sm font-bold mb-1.5">بداية التصويت</span>
          <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} className={inputCls} /></label>
        <label className="block"><span className="block text-sm font-bold mb-1.5">نهاية التصويت</span>
          <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} className={inputCls} /></label>
        <label className="block"><span className="block text-sm font-bold mb-1.5">عدد المرشحين الذين يختارهم العضو</span>
          <input type="number" min={1} max={50} value={maxChoices} onChange={e => setMaxChoices(e.target.value)} disabled={locked} className={inputCls} /></label>
        <label className="block"><span className="block text-sm font-bold mb-1.5">من يحق له التصويت</span>
          <select value={eligibility} onChange={e => setEligibility(e.target.value as Election['eligibility'])} disabled={locked} className={inputCls}>
            <option value="approved">الأعضاء المعتمدون فقط</option>
            <option value="registered">كل الأعضاء المسجلين</option>
          </select></label>
      </div>
      <p className="text-xs text-slate-500">التصويت يقبل فقط عندما تكون الحالة «مفتوح» والوقت بين البداية والنهاية (إن حُدّدتا). طلاب المحجة البيضاء غير مشمولين.</p>
      {locked && <p className="text-xs text-amber-600 font-bold">بدأ التصويت: لا يمكن تغيير عدد الاختيارات أو شروط الأهلية.</p>}
    </Modal>
  );
};

const CandidateForm = ({ electionId, candidate, onClose, onSaved }: { electionId: string; candidate: Candidate | null; onClose: () => void; onSaved: () => void }) => {
  const [name, setName] = useState(candidate?.full_name ?? '');
  const [bio, setBio] = useState(candidate?.bio ?? '');
  const [program, setProgram] = useState(candidate?.program ?? '');
  const [order, setOrder] = useState(String(candidate?.sort_order ?? 0));
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(candidate?.photo_url ?? null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (saving) return;
    if (name.trim().length < 2) { toast.error('اسم المرشح مطلوب'); return; }
    setSaving(true);
    let uploaded: { url: string; path: string } | null = null;
    try {
      if (photo) uploaded = await uploadSiteImage(photo, 'candidates');
      await adminSaveCandidate(candidate?.id ?? null, electionId, {
        full_name: name.trim(), bio: bio.trim(), program: program.trim(), sort_order: Number(order) || 0,
        ...(uploaded ? { photo_url: uploaded.url, photo_path: uploaded.path } : {}),
      });
      if (uploaded && candidate?.photo_path) await removeSiteImage(candidate.photo_path);
      toast.success(candidate ? 'تم تحديث المرشح' : 'تمت إضافة المرشح');
      onSaved();
    } catch (err) {
      if (uploaded) await removeSiteImage(uploaded.path);
      toast.error(err instanceof Error ? err.message : 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={candidate ? 'تعديل المرشح' : 'إضافة مرشح'} onClose={onClose} footer={<>
      <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800">إلغاء</button>
      <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#211d45] flex items-center gap-2 disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ</button>
    </>}>
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative w-24 h-28 rounded-2xl overflow-hidden bg-[#fde3e1] flex items-center justify-center shrink-0">
          {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <UserRound className="w-10 h-10 text-[#e2706a]" />}
          <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-xs py-1 flex items-center justify-center gap-1"><Camera className="w-3.5 h-3.5" /> صورة</span>
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (f) { setPhoto(f); setPreview(URL.createObjectURL(f)); }
        }} />
        <label className="block flex-1"><span className="block text-sm font-bold mb-1.5">اسم المرشح *</span>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={150} className={inputCls} /></label>
      </div>
      <label className="block"><span className="block text-sm font-bold mb-1.5">نبذة عن المرشح</span>
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} className={inputCls} /></label>
      <label className="block"><span className="block text-sm font-bold mb-1.5">البرنامج الانتخابي</span>
        <textarea value={program} onChange={e => setProgram(e.target.value)} rows={5} className={inputCls} /></label>
      <label className="block w-40"><span className="block text-sm font-bold mb-1.5">الترتيب</span>
        <input type="number" value={order} onChange={e => setOrder(e.target.value)} className={inputCls} /></label>
    </Modal>
  );
};

export const ElectionsAdminTab = () => {
  const [elections, setElections] = useState<Election[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [editElection, setEditElection] = useState<Election | null | undefined>(undefined);
  const [editCandidate, setEditCandidate] = useState<{ electionId: string; candidate: Candidate | null } | null>(null);

  const load = useCallback(async () => {
    try { setElections(await adminListElections()); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'تعذّر التحميل'); setElections(cur => cur ?? []); }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20000); // live participation counts
    return () => clearInterval(t);
  }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); toast.success(ok); await load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'حدث خطأ'); }
    finally { setBusy(null); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2"><Landmark className="w-7 h-7 text-indigo-500" /> إدارة الانتخابات</h2>
          <p className="text-sm text-slate-500 mt-1">اقتراعات سرية: صوت واحد لكل عضو مؤهل، ولا يمكن تعديل الأصوات.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4" /> تحديث</button>
          <button onClick={() => setEditElection(null)} className="px-5 py-2.5 rounded-xl font-bold text-white bg-[#211d45] flex items-center gap-2"><Plus className="w-5 h-5" /> اقتراع جديد</button>
        </div>
      </div>

      {elections === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : elections.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800">
          <Vote className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="font-bold text-slate-500">{error || 'لا توجد اقتراعات بعد'}</p>
        </div>
      ) : elections.map(e => {
        const eligible = e.eligible_count ?? 0;
        const turnout = eligible > 0 ? Math.round((e.voters_count / eligible) * 100) : 0;
        const total = e.ballots_count ?? 0;
        return (
          <article key={e.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-black text-slate-800 dark:text-white">{e.title}</h3>
                <p className="text-sm text-slate-500 mt-1">من {fmt(e.starts_at)} إلى {fmt(e.ends_at)} • {e.max_choices === 1 ? 'مرشح واحد' : `حتى ${e.max_choices} مرشحين`} • {e.eligibility === 'approved' ? 'الأعضاء المعتمدون' : 'كل المسجلين'}</p>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-xs font-black ${e.phase === 'open' ? 'bg-emerald-100 text-emerald-700' : e.phase === 'draft' ? 'bg-slate-100 text-slate-600' : e.phase === 'upcoming' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'}`}>{PHASE_LABELS[e.phase]}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['المؤهلون للتصويت', eligible], ['المشاركون', e.voters_count], ['نسبة المشاركة', `${turnout}%`], ['إجمالي الأصوات', total],
              ].map(([l, v]) => (
                <div key={l as string} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-center">
                  <div className="text-2xl font-black text-slate-800 dark:text-white">{v}</div>
                  <div className="text-xs font-bold text-slate-500">{l}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {e.status !== 'open' && (
                <button disabled={!!busy} onClick={() => act(e.id + 'open', () => adminSetElectionStatus(e.id, 'open'), 'تم فتح التصويت')}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white flex items-center gap-1.5 disabled:opacity-60"><Play className="w-4 h-4" /> فتح التصويت</button>
              )}
              {e.status === 'open' && (
                <button disabled={!!busy} onClick={() => window.confirm('إغلاق التصويت الآن؟') && act(e.id + 'close', () => adminSetElectionStatus(e.id, 'closed'), 'تم إغلاق التصويت')}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-800 text-white flex items-center gap-1.5 disabled:opacity-60"><Square className="w-4 h-4" /> إغلاق التصويت</button>
              )}
              {e.status !== 'draft' && e.voters_count === 0 && (
                <button disabled={!!busy} onClick={() => act(e.id + 'draft', () => adminSetElectionStatus(e.id, 'draft'), 'أُعيد إلى مسودة (مخفي عن الأعضاء)')}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> إرجاع لمسودة</button>
              )}
              <button disabled={!!busy} onClick={() => act(e.id + 'res', () => adminSetResultsVisible(e.id, !e.results_visible), e.results_visible ? 'تم إخفاء النتائج عن الزوار' : 'النتائج ظاهرة للزوار الآن')}
                className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 ${e.results_visible ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}>
                {e.results_visible ? <><EyeOff className="w-4 h-4" /> إخفاء النتائج</> : <><Eye className="w-4 h-4" /> إظهار النتائج للزوار</>}
              </button>
              <button onClick={() => setEditElection(e)} className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 flex items-center gap-1.5"><Edit2 className="w-4 h-4" /> تعديل</button>
              <button onClick={() => setEditCandidate({ electionId: e.id, candidate: null })} disabled={e.voters_count > 0}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-pink-50 text-pink-700 flex items-center gap-1.5 disabled:opacity-50" title={e.voters_count > 0 ? 'بدأ التصويت' : ''}><UserPlus className="w-4 h-4" /> إضافة مرشح</button>
              <button disabled={!!busy || e.status === 'open'} title={e.status === 'open' ? 'أغلق التصويت أولاً' : ''}
                onClick={() => window.confirm(`حذف «${e.title}» نهائياً مع مرشحيه وأصواته؟`) && act(e.id + 'del', () => adminDeleteElection(e.id), 'تم حذف الاقتراع')}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 flex items-center gap-1.5 disabled:opacity-50"><Trash2 className="w-4 h-4" /> حذف</button>
            </div>

            {e.candidates.length === 0 ? (
              <p className="text-sm text-amber-600 font-bold">لا يوجد مرشحون بعد — أضف مرشحاً لتتمكن من فتح التصويت.</p>
            ) : (
              <ul className="space-y-2">
                {[...e.candidates].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)).map(c => {
                  const pct = total > 0 ? Math.round(((c.votes ?? 0) / total) * 100) : 0;
                  return (
                    <li key={c.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#fde3e1] shrink-0 flex items-center justify-center">
                        {c.photo_url ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" /> : <UserRound className="w-6 h-6 text-[#e2706a]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-slate-800 dark:text-white truncate">{c.full_name}</p>
                          <p className="text-sm font-black text-slate-700 dark:text-slate-200 shrink-0">{c.votes ?? 0} صوت • {pct}%</p>
                        </div>
                        <div className="h-2 mt-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                      </div>
                      <button onClick={() => setEditCandidate({ electionId: e.id, candidate: c })} className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50" aria-label="تعديل"><Edit2 className="w-4 h-4" /></button>
                      <button disabled={!!busy || e.voters_count > 0} onClick={() => window.confirm(`حذف المرشح ${c.full_name}؟`) && act(c.id, () => adminDeleteCandidate(c.id), 'تم حذف المرشح')}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-slate-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> النتائج هنا للمشرفين دائماً؛ للأعضاء فقط عند تفعيل «إظهار النتائج». لا يظهر لأحد من صوّت لمن.</p>
          </article>
        );
      })}

      <AnimatePresence>
        {editElection !== undefined && <ElectionForm election={editElection} onClose={() => setEditElection(undefined)} onSaved={() => { setEditElection(undefined); void load(); }} />}
        {editCandidate && <CandidateForm electionId={editCandidate.electionId} candidate={editCandidate.candidate} onClose={() => setEditCandidate(null)} onSaved={() => { setEditCandidate(null); void load(); }} />}
      </AnimatePresence>
    </motion.div>
  );
};
