import { useState } from 'react';
import toast from 'react-hot-toast';
import { BadgeCheck, ChevronDown, Copy, ListChecks, Share2, UserRound, Users } from 'lucide-react';
import { candidacyLabel, candidateShareLinks } from '../../lib/generalElections';

// Candidate card, after the association's design: navy frame with the logo and the election
// title, white card with the photo, the name, the position and the electoral programme,
// the association's slogan, and share buttons (WhatsApp, Facebook, Snapchat).

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47a9.4 9.4 0 0 1 6.7 2.78 9.41 9.41 0 0 1 2.77 6.7c0 5.23-4.25 9.46-9.47 9.46zm8.06-17.53A11.33 11.33 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2 .52 3.96 1.52 5.69L.55 23.6l6.04-1.58a11.36 11.36 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.19-5.9-3.33-8.05z" />
  </svg>
);
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
    <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.27h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
  </svg>
);
const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
    <path d="M12.21 1.5c1.2 0 4.35.33 5.83 3.64.5 1.11.38 3 .29 4.52l-.01.21c.08.05.22.1.43.1.31-.02.68-.12 1.08-.31.12-.06.25-.07.34-.07.15 0 .3.03.42.07.36.13.58.38.58.66.01.36-.31.67-.96.92-.07.03-.15.05-.25.08-.35.11-.88.28-1.02.62-.08.17-.05.4.08.67l.01.01c.04.1 1.13 2.57 3.55 2.97.19.03.32.2.31.38 0 .05-.01.11-.04.16-.18.42-.94.74-2.32.95-.05.06-.09.27-.12.41-.03.13-.06.27-.1.41-.06.2-.2.3-.41.3h-.02c-.1 0-.23-.02-.4-.05a4.79 4.79 0 0 0-.94-.1c-.22 0-.45.01-.68.05-.45.08-.84.35-1.29.66-.64.45-1.37.96-2.47.96h-.12c-1.1 0-1.82-.51-2.46-.96-.45-.31-.83-.58-1.29-.66a4.02 4.02 0 0 0-.68-.05c-.4 0-.71.06-.94.11-.15.03-.29.05-.4.05-.29 0-.4-.18-.44-.32-.04-.14-.07-.28-.1-.42-.03-.14-.07-.36-.12-.41-1.47-.23-2.25-.55-2.42-.97a.37.37 0 0 1-.03-.15.37.37 0 0 1 .31-.38c2.42-.4 3.51-2.87 3.55-2.98l.01-.01c.14-.27.17-.5.08-.67-.14-.34-.67-.51-1.02-.62a2.3 2.3 0 0 1-.25-.08c-.89-.35-1.01-.75-.96-1.02.07-.38.53-.62.92-.62.11 0 .21.02.29.06.45.21.85.32 1.19.32.25 0 .41-.06.5-.11l-.03-.48c-.1-1.52-.22-3.41.28-4.52C7.84 1.84 10.98 1.51 12.17 1.5h.04z" />
  </svg>
);

export interface CandidateElectionCardProps {
  id: string;
  fullName: string;
  photoUrl: string | null;
  positionTitle: string;
  program: string | null;
  electionTitle: string;
  /** Share buttons only for approved candidates (their card is public). */
  shareable?: boolean;
  /** Small status line shown on the candidate's own, not yet approved, card. */
  statusNote?: string;
  /** Show the whole programme from the start (public card page). */
  expanded?: boolean;
}

export const CandidateElectionCard = ({ id, fullName, photoUrl, positionTitle, program, electionTitle, shareable = true, statusNote, expanded = false }: CandidateElectionCardProps) => {
  const [open, setOpen] = useState(expanded);
  const { lead, target } = candidacyLabel(positionTitle);
  const links = candidateShareLinks(fullName, positionTitle, id);
  const longProgram = (program ?? '').length > 260 || (program ?? '').split('\n').length > 6;

  const nativeShare = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: fullName, text: links.text, url: links.url }); return; }
      await navigator.clipboard.writeText(links.url);
      toast.success('تم نسخ رابط البطاقة');
    } catch { /* cancelled */ }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(links.url); toast.success('تم نسخ رابط البطاقة'); }
    catch { toast.error('تعذّر النسخ'); }
  };

  return (
    <article className="rounded-[28px] bg-[#262150] p-4 sm:p-5 text-white shadow-xl shadow-[#262150]/25 flex flex-col" dir="rtl" aria-label={`بطاقة المترشح ${fullName}`}>
      {/* Header: logo + association */}
      <header className="flex items-center gap-3 mb-4">
        <div className="w-14 h-14 rounded-full border-2 border-[#f4b4a8] bg-[#262150] overflow-hidden shrink-0 flex items-center justify-center">
          <img src="/aoun-logo.png" alt="شعار جمعية عون وسند" className="w-full h-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="font-black text-base sm:text-lg leading-tight">جمعية عون وسند الخيرية</p>
          <p className="text-sm text-[#f4b4a8] font-bold truncate">{electionTitle}</p>
        </div>
      </header>

      {/* White card */}
      <div className="flex-1 rounded-3xl bg-white text-[#262150] px-4 sm:px-5 pt-5 pb-5 flex flex-col items-center text-center">
        <span className="px-4 py-1.5 rounded-full bg-[#262150] text-[#f4b4a8] text-sm font-black flex items-center gap-1.5"><BadgeCheck className="w-4 h-4" /> مترشح</span>
        <div className="mt-4 w-36 h-36 sm:w-40 sm:h-40 rounded-full border-[5px] border-[#f4b4a8] bg-[#efedf6] overflow-hidden flex items-center justify-center">
          {photoUrl
            ? <img src={photoUrl} alt={fullName} loading="lazy" className="w-full h-full object-cover" />
            : <span className="flex flex-col items-center text-[#262150]/70"><UserRound className="w-14 h-14" /><span className="text-xs font-bold mt-1">صورة المترشح</span></span>}
        </div>
        <h3 className="mt-4 text-2xl font-black leading-snug">{fullName}</h3>
        <p className="mt-3 px-4 py-2 rounded-2xl bg-[#fde8e4] text-sm flex items-center gap-2 flex-wrap justify-center">
          <Users className="w-4 h-4 text-[#262150]/70" />
          <span className="text-[#262150]/70">{lead}</span>
          <b className="font-black">{target}</b>
        </p>
        {statusNote && <p className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">{statusNote}</p>}

        <div className="w-full h-px bg-slate-200 my-4" />

        <div className="w-full text-start">
          <h4 className="font-black text-lg flex items-center gap-2 mb-2"><ListChecks className="w-5 h-5" /> البرنامج الانتخابي</h4>
          {program ? (
            <>
              <p className={`text-slate-600 leading-loose whitespace-pre-wrap text-[15px] ${open ? '' : 'line-clamp-6'}`}>{program}</p>
              {longProgram && (
                <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="mt-2 text-sm font-black text-[#e2706a] flex items-center gap-1">
                  {open ? 'إخفاء التفاصيل' : 'عرض البرنامج كاملًا'} <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
              )}
            </>
          ) : <p className="text-slate-400 text-sm">—</p>}
        </div>
      </div>

      {/* Slogan */}
      <footer className="text-center mt-4">
        <p className="text-xl font-black text-[#f4b4a8]">«عون للمحتاج وسند للضعيف»</p>
        <p className="text-sm text-white/85 mt-1">صوتك أمانة – شارك في التصويت</p>
      </footer>

      {shareable && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs font-bold text-white/70 text-center mb-2">شارك البطاقة</p>
          <div className="flex items-center justify-center gap-2">
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="مشاركة على واتساب" title="واتساب"
              className="w-11 h-11 rounded-full bg-[#25D366] text-white flex items-center justify-center hover:scale-105 transition-transform"><WhatsAppIcon /></a>
            <a href={links.facebook} target="_blank" rel="noopener noreferrer" aria-label="مشاركة على فيسبوك" title="فيسبوك"
              className="w-11 h-11 rounded-full bg-[#1877F2] text-white flex items-center justify-center hover:scale-105 transition-transform"><FacebookIcon /></a>
            <a href={links.snapchat} target="_blank" rel="noopener noreferrer" aria-label="مشاركة على سناب شات" title="سناب شات"
              className="w-11 h-11 rounded-full bg-[#FFFC00] text-black flex items-center justify-center hover:scale-105 transition-transform"><SnapchatIcon /></a>
            <button onClick={() => void copy()} aria-label="نسخ الرابط" title="نسخ الرابط"
              className="w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"><Copy className="w-5 h-5" /></button>
            <button onClick={() => void nativeShare()} aria-label="مشاركة" title="مشاركة"
              className="w-11 h-11 rounded-full bg-[#f4b4a8] text-[#262150] flex items-center justify-center hover:scale-105 transition-transform"><Share2 className="w-5 h-5" /></button>
          </div>
        </div>
      )}
    </article>
  );
};
