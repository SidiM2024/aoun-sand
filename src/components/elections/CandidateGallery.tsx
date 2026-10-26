import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Eye, Share2, UserRound, X } from 'lucide-react';
import { candidacyLabel, type GeneralCandidate } from '../../lib/generalElections';
import { CandidateElectionCard } from './CandidateElectionCard';
import { ShareCardSheet } from './ShareCardSheet';

// Gallery of the approved candidates: compact tiles (a row on phones, a grid on larger screens);
// a tile opens the full card in a viewer where members move from one candidate to the next.

export interface GalleryItem {
  candidate: GeneralCandidate;
  positionTitle: string;
}

const Tile = ({ item, onOpen, onShare }: { item: GalleryItem; onOpen: () => void; onShare: () => void }) => {
  const { candidate: c, positionTitle } = item;
  const { lead, target } = candidacyLabel(positionTitle);
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <article className="group min-w-0 rounded-3xl bg-white dark:bg-slate-900 border border-[#262150]/10 dark:border-white/10 shadow-sm hover:shadow-xl hover:shadow-[#262150]/10 transition-shadow overflow-hidden flex sm:flex-col"
      aria-label={`المترشح ${c.full_name}`}>
      {/* Photo on a navy band (side band on phones, top band on larger screens). */}
      <button onClick={onOpen} tabIndex={-1} aria-hidden
        className="relative shrink-0 w-[104px] sm:w-full sm:h-24 bg-[#262150] flex items-center justify-center overflow-visible">
        <span className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-[#f4b4a8]/10" />
        <span className="relative w-[76px] h-[76px] sm:w-28 sm:h-28 sm:translate-y-1/2 rounded-full border-4 border-[#f4b4a8] bg-[#efedf6] overflow-hidden flex items-center justify-center shadow-lg">
          {c.photo_url && !photoFailed
            ? <img src={c.photo_url} alt="" loading="lazy" onError={() => setPhotoFailed(true)} className="w-full h-full object-cover" />
            : <UserRound className="w-10 h-10 text-[#262150]/60" />}
        </span>
      </button>
      <div className="flex-1 min-w-0 p-3.5 sm:pt-[4.5rem] sm:px-5 sm:pb-5 flex flex-col sm:items-center sm:text-center">
        <button onClick={onOpen} className="text-start sm:text-center">
          <h4 className="font-black text-[17px] sm:text-xl leading-snug text-[#262150] dark:text-white line-clamp-2 break-words">{c.full_name}</h4>
        </button>
        <p className="mt-1.5 self-start sm:self-center max-w-full inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#fde8e4] dark:bg-[#f4b4a8]/15 text-xs sm:text-sm">
          <span className="text-[#262150]/70 dark:text-white/70 shrink-0">{lead}</span>
          <b className="font-black text-[#262150] dark:text-white truncate">{target}</b>
        </p>
        {c.program && <p className="mt-2 text-[13px] sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 break-words">{c.program}</p>}
        <div className="mt-auto pt-3 flex gap-2 w-full">
          <button onClick={onOpen}
            className="flex-1 min-w-0 py-2.5 rounded-2xl bg-[#262150] text-white text-sm font-black flex items-center justify-center gap-1.5 hover:bg-[#332c6b] transition-colors">
            <Eye className="w-4 h-4 shrink-0" /> عرض البطاقة
          </button>
          <button onClick={onShare} aria-label={`مشاركة بطاقة ${c.full_name}`} title="مشاركة صورة البطاقة"
            className="w-11 shrink-0 rounded-2xl bg-[#f4b4a8] text-[#262150] flex items-center justify-center hover:bg-[#f7c4ba] transition-colors">
            <Share2 className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </article>
  );
};

const Viewer = ({ items, index, electionTitle, onIndex, onClose }: {
  items: GalleryItem[]; index: number; electionTitle: string; onIndex: (i: number) => void; onClose: () => void;
}) => {
  const scroller = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const item = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [index]);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (document.querySelector('[aria-label="مشاركة بطاقة المترشح"]')) return; // share sheet on top
      if (ev.key === 'Escape') onClose();
      // Right-to-left: the next candidate is on the left.
      if (ev.key === 'ArrowLeft' && hasNext) onIndex(index + 1);
      if (ev.key === 'ArrowRight' && hasPrev) onIndex(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, hasNext, hasPrev, onIndex, onClose]);

  if (!item) return null;
  const onTouchEnd = (ev: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = ev.changedTouches[0].clientX - start.x;
    const dy = ev.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && hasNext) onIndex(index + 1);
    if (dx > 0 && hasPrev) onIndex(index - 1);
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-[#13102b]/90 backdrop-blur-sm flex flex-col" dir="rtl" role="dialog" aria-modal="true" aria-label="بطاقات المترشحين">
      <div className="shrink-0 flex items-center justify-between gap-3 px-3 sm:px-6 py-3 text-white">
        <button onClick={onClose} aria-label="إغلاق" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><X className="w-5 h-5" /></button>
        <p className="min-w-0 text-sm font-bold truncate text-white/85">{item.positionTitle}</p>
        <span className="shrink-0 px-3 py-1 rounded-full bg-white/10 text-sm font-black tabular-nums" aria-live="polite">{index + 1} من {items.length}</span>
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-6"
        onTouchStart={ev => { touch.current = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }; }} onTouchEnd={onTouchEnd}>
        <div className="relative mx-auto w-full max-w-md pb-28 sm:pb-10">
          <CandidateElectionCard key={item.candidate.id} id={item.candidate.id} fullName={item.candidate.full_name}
            photoUrl={item.candidate.photo_url} program={item.candidate.program} positionTitle={item.positionTitle}
            electionTitle={electionTitle} expanded />
        </div>
      </div>

      {/* Desktop: arrows on the sides. */}
      <button onClick={() => onIndex(index - 1)} disabled={!hasPrev} aria-label="المترشح السابق"
        className="hidden sm:flex absolute right-4 lg:right-10 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center disabled:opacity-25">
        <ChevronRight className="w-6 h-6" />
      </button>
      <button onClick={() => onIndex(index + 1)} disabled={!hasNext} aria-label="المترشح التالي"
        className="hidden sm:flex absolute left-4 lg:left-10 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center disabled:opacity-25">
        <ChevronLeft className="w-6 h-6" />
      </button>
      {/* Phones: previous / next bar at the bottom. */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#13102b] via-[#13102b]/95 to-transparent flex gap-2">
        <button onClick={() => onIndex(index - 1)} disabled={!hasPrev}
          className="flex-1 py-3 rounded-2xl bg-white/10 text-white font-black flex items-center justify-center gap-1 disabled:opacity-30"><ChevronRight className="w-5 h-5" /> السابق</button>
        <button onClick={() => onIndex(index + 1)} disabled={!hasNext}
          className="flex-1 py-3 rounded-2xl bg-[#f4b4a8] text-[#262150] font-black flex items-center justify-center gap-1 disabled:opacity-30">التالي <ChevronLeft className="w-5 h-5" /></button>
      </div>
    </div>,
    document.body,
  );
};

export const CandidateGallery = ({ items, electionTitle }: { items: GalleryItem[]; electionTitle: string }) => {
  const [viewing, setViewing] = useState<number | null>(null);
  const [sharing, setSharing] = useState<GalleryItem | null>(null);

  // The list can change while the viewer is open (filter, refresh): stay within bounds.
  useEffect(() => {
    if (viewing !== null && viewing >= items.length) setViewing(items.length ? items.length - 1 : null);
  }, [items.length, viewing]);

  return (
    <>
      <div className="grid gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <Tile key={it.candidate.id} item={it} onOpen={() => setViewing(i)} onShare={() => setSharing(it)} />
        ))}
      </div>
      {viewing !== null && items[viewing] && (
        <Viewer items={items} index={viewing} electionTitle={electionTitle} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
      {sharing && (
        <ShareCardSheet onClose={() => setSharing(null)} card={{
          id: sharing.candidate.id, fullName: sharing.candidate.full_name, photoUrl: sharing.candidate.photo_url,
          positionTitle: sharing.positionTitle, program: sharing.candidate.program, electionTitle,
        }} />
      )}
    </>
  );
};
