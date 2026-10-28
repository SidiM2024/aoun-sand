import { useState } from 'react';
import { Award, Crown, Download, Hourglass, Loader2, Megaphone, RefreshCw, Scale, Share2, Sparkles, Trophy, UserRound, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { candidateShareUrl, resultLabel, groupPositions, type GeneralCandidate, type GeneralElection, type GeneralPosition } from '../../lib/generalElections';
import { renderResultCardImage, resultCardFileName } from '../../lib/resultCardImage';
import { ShareCardSheet } from './ShareCardSheet';

// After voting: «ترقبوا النتائج النهائية» until the administration announces the results, then
// the official results (winners first, then the other candidates), from the announced data.

const fmt = (n: number) => n.toLocaleString('ar-MA');

// ─── Waiting for the announcement ────────────────────────────────────────────

export const ResultsWaiting = ({ e, lastUpdated, refreshing, onRefresh }: {
  e: GeneralElection; lastUpdated: Date | null; refreshing: boolean; onRefresh: () => void;
}) => (
  <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#1d1938] via-[#29244C] to-[#3a3270] text-white px-5 py-10 sm:px-10 sm:py-14 text-center">
    <span aria-hidden className="absolute -top-20 -left-16 w-64 h-64 rounded-full bg-[#F6B4A6]/15 blur-2xl" />
    <span aria-hidden className="absolute -bottom-24 -right-10 w-72 h-72 rounded-full bg-[#F2C94C]/10 blur-2xl" />
    <div className="relative mx-auto w-24 h-24 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
      <span aria-hidden className="absolute inset-0 rounded-full border-2 border-[#F6B4A6]/60 animate-ping [animation-duration:2.4s]" />
      <Hourglass className="w-11 h-11 text-[#F6B4A6] animate-[spin_6s_ease-in-out_infinite]" />
    </div>
    <p className="relative mt-6 text-sm font-black tracking-wide text-[#F6B4A6]">انتهى التصويت</p>
    <h3 className="relative mt-2 text-3xl sm:text-4xl font-black leading-tight">ترقبوا النتائج النهائية</h3>
    <p className="relative mt-4 max-w-xl mx-auto text-white/80 leading-loose">
      شكرًا لكل من شارك في انتخابات جمعية عون وسند الخيرية. يجري الآن اعتماد النتائج، وستُعلن رسميًا من طرف إدارة الجمعية،
      وتظهر في هذه الصفحة فور إعلانها.
    </p>
    {(e.voters_total ?? 0) > 0 && (
      <div className="relative mt-7 inline-flex flex-wrap justify-center gap-3">
        <span className="px-4 py-2 rounded-2xl bg-white/10 font-bold flex items-center gap-2"><Users className="w-4 h-4 text-[#F6B4A6]" /> {fmt(e.voters_total ?? 0)} عضوًا شاركوا</span>
        {e.total_votes != null && <span className="px-4 py-2 rounded-2xl bg-white/10 font-bold">{fmt(e.total_votes)} صوتًا</span>}
      </div>
    )}
    <button onClick={onRefresh} className="relative mt-7 mx-auto flex items-center gap-1.5 text-xs text-white/60 hover:text-white">
      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> الصفحة تتحدث تلقائيًا
      {lastUpdated ? ` · ${lastUpdated.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })}` : ''}
    </button>
  </div>
);

// ─── Official results ────────────────────────────────────────────────────────

interface Row { c: GeneralCandidate; p: GeneralPosition; votes: number; pct: number }

const Photo = ({ c, ring, size }: { c: GeneralCandidate; ring: string; size: string }) => {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`${size} shrink-0 rounded-full overflow-hidden bg-[#efedf6] flex items-center justify-center`} style={{ boxShadow: `0 0 0 4px ${ring}` }}>
      {c.photo_url && !failed
        ? <img src={c.photo_url} alt={c.full_name} loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover" />
        : <UserRound className="w-1/2 h-1/2 text-[#29244C]/50" />}
    </span>
  );
};

const CardActions = ({ busy, onDownload, onShare, light }: { busy: boolean; onDownload: () => void; onShare: () => void; light?: boolean }) => (
  <div className="mt-4 grid grid-cols-2 gap-2">
    <button onClick={onDownload} disabled={busy}
      className={`py-2.5 rounded-2xl text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-60 ${light ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-slate-100 dark:bg-slate-800 text-[#29244C] dark:text-white'}`}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} تنزيل PNG
    </button>
    <button onClick={onShare}
      className={`py-2.5 rounded-2xl text-sm font-black flex items-center justify-center gap-1.5 ${light ? 'bg-[#F2C94C] text-[#1d1938]' : 'bg-[#29244C] text-white'}`}>
      <Share2 className="w-4 h-4" /> مشاركة
    </button>
  </div>
);

export const ElectionResultsView = ({ e }: { e: GeneralElection }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [sharing, setSharing] = useState<Row | null>(null);

  const positions = e.positions.filter(p => p.is_active && p.candidates.length > 0);
  const rowsOf = (p: GeneralPosition): Row[] => {
    const total = p.candidates.reduce((s, x) => s + (x.votes ?? 0), 0);
    return p.candidates.map(c => ({ c, p, votes: c.votes ?? 0, pct: total > 0 ? Math.round(((c.votes ?? 0) / total) * 100) : 0 }));
  };
  // One seat per position: its winner (top votes, or the tie resolved by the administration).
  const winners = groupPositions(positions).flatMap(g => g.items).flatMap(p => rowsOf(p).filter(r => r.c.id === p.winner_application_id));
  const tied = positions.filter(p => !p.winner_application_id && p.tie);
  const others = positions.flatMap(p => rowsOf(p).filter(r => r.c.id !== p.winner_application_id))
    .sort((a, b) => a.p.sort_order - b.p.sort_order || b.votes - a.votes);

  const imageFor = (r: Row) => (url: string) => renderResultCardImage({
    id: r.c.id, fullName: r.c.full_name, photoUrl: r.c.photo_url, positionTitle: r.p.title, electionTitle: e.title,
    votes: r.votes, pct: r.pct, winner: r.p.winner_application_id === r.c.id, url,
  });

  const download = async (r: Row) => {
    if (busy) return;
    setBusy(r.c.id);
    try {
      const blob = await imageFor(r)(candidateShareUrl(r.c.id));
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = resultCardFileName(r.c.id);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 2000);
      toast.success('تم تنزيل البطاقة');
    } catch {
      toast.error('تعذّر إنشاء صورة البطاقة. أعد المحاولة.');
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-8">
      {/* Winners */}
      <section>
        <div className="text-center mb-5">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-800 text-sm font-black"><Trophy className="w-4 h-4" /> النتائج الرسمية</span>
          <h3 className="mt-2 text-2xl sm:text-3xl font-black text-[#29244C] dark:text-white">الفائزون في الانتخابات</h3>
        </div>
        {winners.length === 0 ? (
          <p className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/50 text-center font-bold text-slate-500">لم يُحسم أي منصب بعد.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {winners.map(r => {
              const { lead, target } = resultLabel(r.p.title, true);
              return (
                <article key={r.c.id} aria-label={`الفائز ${r.c.full_name}`}
                  className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1d1938] to-[#29244C] text-white p-5 shadow-xl shadow-[#29244C]/20 ring-2 ring-[#F2C94C]/70">
                  <span aria-hidden className="absolute -top-10 -left-10 w-36 h-36 rounded-full bg-[#F2C94C]/15" />
                  <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-[#F2C94C] text-[#1d1938] text-xs font-black flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> ناجح</span>
                  <div className="relative flex items-center gap-4">
                    <Photo c={r.c} ring="#F2C94C" size="w-20 h-20 sm:w-24 sm:h-24" />
                    <div className="min-w-0 pe-14">
                      <h4 className="text-xl font-black leading-snug break-words">{r.c.full_name}</h4>
                      <p className="mt-1 text-sm text-white/75"><span>{lead}</span> <b className="text-[#F6B4A6]">{target}</b></p>
                    </div>
                  </div>
                  <div className="relative mt-4 flex items-end justify-between gap-3 p-3 rounded-2xl bg-white/10">
                    <span><span className="text-3xl font-black tabular-nums text-[#F2C94C]">{fmt(r.votes)}</span> <span className="text-sm font-bold text-white/75">صوت</span></span>
                    <span className="text-sm font-black text-white/80 tabular-nums">{fmt(r.pct)}٪</span>
                  </div>
                  <CardActions light busy={busy === r.c.id} onDownload={() => void download(r)} onShare={() => setSharing(r)} />
                </article>
              );
            })}
          </div>
        )}
      </section>

      {tied.length > 0 && (
        <section className="space-y-2">
          {tied.map(p => (
            <p key={p.id} className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold text-sm flex items-center gap-2">
              <Scale className="w-5 h-5 shrink-0" /> {p.title}: تعادل في الصدارة، ويُحسم وفق قواعد الجمعية.
            </p>
          ))}
        </section>
      )}

      {/* Other candidates */}
      {others.length > 0 && (
        <section>
          <div className="mb-4">
            <h3 className="text-xl font-black text-[#29244C] dark:text-white flex items-center gap-2"><Award className="w-5 h-5 text-[#e2706a]" /> بقية المترشحين</h3>
            <p className="mt-1 text-sm text-slate-500">لكل من ترشّح شكرٌ وتقدير: بادرتم بخدمة الجمعية، وعطاؤكم يبقى أثرًا لا تختصره النتائج.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map(r => {
              const isTied = !r.p.winner_application_id && r.p.tie && r.votes === r.p.top_votes;
              return (
                <article key={r.c.id} aria-label={`المترشح ${r.c.full_name}`} className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-4 flex flex-col">
                  <div className="flex items-center gap-3">
                    <Photo c={r.c} ring="#F6B4A6" size="w-16 h-16" />
                    <div className="min-w-0">
                      <h4 className="font-black text-[#29244C] dark:text-white leading-snug break-words">{r.c.full_name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{r.p.title}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <span><span className="text-2xl font-black tabular-nums text-[#29244C] dark:text-white">{fmt(r.votes)}</span> <span className="text-sm text-slate-500 font-bold">صوت</span></span>
                    <span className="text-sm font-black text-[#e2706a] tabular-nums">{fmt(r.pct)}٪</span>
                  </div>
                  <p className="mt-3 p-3 rounded-2xl bg-[#FDF0EC] dark:bg-[#F6B4A6]/10 text-[13px] leading-relaxed text-[#29244C] dark:text-white/85 flex gap-2">
                    {isTied
                      ? <><Scale className="w-4 h-4 shrink-0 mt-0.5 text-[#e2706a]" /> تعادل في الصدارة، بانتظار الحسم.</>
                      : <><Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-[#e2706a]" /> شكرًا لعطائك وثقتك بالجمعية. كل خطوة في الخدمة تصنع أثرًا، والمسيرة مستمرة.</>}
                  </p>
                  <CardActions busy={busy === r.c.id} onDownload={() => void download(r)} onShare={() => setSharing(r)} />
                </article>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-xs text-slate-500 flex items-center gap-1.5"><Megaphone className="w-4 h-4 shrink-0" /> النتائج كما أعلنتها إدارة الجمعية، لكل منصب مقعد واحد.</p>

      {sharing && (
        <ShareCardSheet
          card={{ id: sharing.c.id, fullName: sharing.c.full_name, photoUrl: sharing.c.photo_url, positionTitle: sharing.p.title, program: null, electionTitle: e.title }}
          render={imageFor(sharing)} fileName={resultCardFileName(sharing.c.id)} heading="مشاركة بطاقة النتيجة"
          shareText={sharing.p.winner_application_id === sharing.c.id
            ? `مبارك لـ ${sharing.c.full_name} الفوز بـ${sharing.p.title} في انتخابات جمعية عون وسند الخيرية`
            : `${sharing.c.full_name} — ${sharing.p.title}: ${fmt(sharing.votes)} صوت في انتخابات جمعية عون وسند الخيرية`}
          onClose={() => setSharing(null)} />
      )}
    </div>
  );
};
