import { useState } from 'react';
import { BadgeCheck, ChevronDown, ListChecks, Share2, UserRound, Users } from 'lucide-react';
import { candidacyLabel } from '../../lib/generalElections';
import { ShareCardSheet } from './ShareCardSheet';

// Candidate card, after the association's design: navy frame with the logo and the election
// title, white card with the photo, the name, the position and the electoral programme,
// the association's slogan, and sharing the card as a picture (or its link).

export interface CandidateElectionCardProps {
  id: string;
  fullName: string;
  photoUrl: string | null;
  positionTitle: string;
  program: string | null;
  electionTitle: string;
  /** Sharing only for approved candidates (their card is public). */
  shareable?: boolean;
  /** Small status line shown on the candidate's own, not yet approved, card. */
  statusNote?: string;
  /** Show the whole programme from the start (public card page, card viewer). */
  expanded?: boolean;
}

export const CandidateElectionCard = ({ id, fullName, photoUrl, positionTitle, program, electionTitle, shareable = true, statusNote, expanded = false }: CandidateElectionCardProps) => {
  const [open, setOpen] = useState(expanded);
  const [sharing, setSharing] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const { lead, target } = candidacyLabel(positionTitle);
  const longProgram = (program ?? '').length > 260 || (program ?? '').split('\n').length > 6;

  return (
    <article className="w-full min-w-0 rounded-[28px] bg-[#262150] p-3 sm:p-5 text-white shadow-xl shadow-[#262150]/25 flex flex-col relative overflow-hidden" dir="rtl" aria-label={`بطاقة المترشح ${fullName}`}>
      <span aria-hidden className="absolute -top-16 -left-16 w-44 h-44 rounded-full bg-[#f4b4a8]/10" />
      {/* Header: logo + association */}
      <header className="relative flex items-center gap-3 mb-3 sm:mb-4 px-1">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-[#f4b4a8] bg-[#262150] overflow-hidden shrink-0 flex items-center justify-center">
          <img src="/aoun-logo.png" alt="شعار جمعية عون وسند" className="w-[85%] h-[85%] object-contain" />
        </div>
        <div className="min-w-0">
          <p className="font-black text-[15px] sm:text-lg leading-tight">جمعية عون وسند الخيرية</p>
          <p className="text-xs sm:text-sm text-[#f4b4a8] font-bold truncate">{electionTitle}</p>
        </div>
      </header>

      {/* White card */}
      <div className="relative flex-1 rounded-3xl bg-white text-[#262150] px-4 sm:px-5 pt-4 sm:pt-5 pb-5 flex flex-col items-center text-center">
        <span className="px-4 py-1 rounded-full bg-[#262150] text-[#f4b4a8] text-sm font-black flex items-center gap-1.5"><BadgeCheck className="w-4 h-4" /> مترشح</span>
        <div className="mt-4 w-32 h-32 min-[380px]:w-36 min-[380px]:h-36 sm:w-40 sm:h-40 rounded-full border-[5px] border-[#f4b4a8] bg-[#efedf6] overflow-hidden flex items-center justify-center shrink-0 shadow-lg shadow-[#262150]/15">
          {photoUrl && !photoFailed
            ? <img src={photoUrl} alt={fullName} loading="lazy" onError={() => setPhotoFailed(true)} className="w-full h-full object-cover" />
            : <span className="flex flex-col items-center text-[#262150]/70"><UserRound className="w-14 h-14" /><span className="text-xs font-bold mt-1">صورة المترشح</span></span>}
        </div>
        <h3 className="mt-4 text-xl min-[380px]:text-2xl font-black leading-snug break-words max-w-full">{fullName}</h3>
        <p className="mt-3 max-w-full px-4 py-2 rounded-2xl bg-[#fde8e4] text-sm flex items-center gap-x-2 gap-y-0.5 flex-wrap justify-center">
          <Users className="w-4 h-4 text-[#262150]/70 shrink-0" />
          <span className="text-[#262150]/70">{lead}</span>
          <b className="font-black break-words">{target}</b>
        </p>
        {statusNote && <p className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-2xl leading-relaxed">{statusNote}</p>}

        <div className="w-full h-px bg-slate-200 my-4" />

        <div className="w-full text-start">
          <h4 className="font-black text-base sm:text-lg flex items-center gap-2 mb-2"><ListChecks className="w-5 h-5 text-[#e2706a]" /> البرنامج الانتخابي</h4>
          {program ? (
            <>
              <p className={`text-slate-600 leading-loose whitespace-pre-wrap break-words text-[15px] ${open ? '' : 'line-clamp-6'}`}>{program}</p>
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
      <footer className="relative text-center mt-4">
        <p className="text-lg min-[380px]:text-xl font-black text-[#f4b4a8]">«عون للمحتاج وسند للضعيف»</p>
        <p className="text-sm text-white/85 mt-1">صوتك أمانة – شارك في التصويت</p>
      </footer>

      {shareable && (
        <button onClick={() => setSharing(true)}
          className="relative mt-4 w-full py-3.5 rounded-2xl bg-[#f4b4a8] text-[#262150] font-black flex items-center justify-center gap-2 hover:bg-[#f7c4ba] transition-colors">
          <Share2 className="w-5 h-5" /> مشاركة صورة البطاقة
        </button>
      )}
      {sharing && (
        <ShareCardSheet card={{ id, fullName, photoUrl, positionTitle, program, electionTitle }} onClose={() => setSharing(false)} />
      )}
    </article>
  );
};
