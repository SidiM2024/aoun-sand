import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, Vote } from 'lucide-react';
import { CandidateElectionCard } from '../components/elections/CandidateElectionCard';
import { fetchCandidateCard, type CandidateCardData } from '../lib/generalElections';

// Public page of one candidate's card: what shared links (WhatsApp, Facebook, Snapchat) open.
// Readable without an account; while voting is open the cards are hidden for everyone.
export const CandidateCardPage = () => {
  const { id } = useParams();
  const [card, setCard] = useState<CandidateCardData | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    if (!id) { setCard(null); return; }
    fetchCandidateCard(id).then(c => { if (alive) setCard(c); }).catch(() => { if (alive) setCard(null); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (card) document.title = `${card.full_name} — مترشح | جمعية عون وسند الخيرية`;
  }, [card]);

  return (
    <div className="min-h-screen bg-[#f4f2fa] dark:bg-slate-950 flex flex-col items-center px-3 py-6 sm:py-10" dir="rtl">
      <div className="w-full max-w-md">
        {card === undefined ? (
          <div className="flex justify-center py-24"><Loader2 className="w-10 h-10 animate-spin text-[#e2706a]" /></div>
        ) : card === null ? (
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-8 text-center space-y-3">
            <p className="font-black text-[#262150] dark:text-white text-lg">البطاقة غير متاحة</p>
            <p className="text-slate-500 text-sm">قد يكون الرابط غير صحيح، أو لم تُعتمد هذه البطاقة بعد.</p>
          </div>
        ) : card.cards_hidden ? (
          <div className="rounded-3xl bg-[#262150] text-white p-8 text-center space-y-3">
            <Vote className="w-10 h-10 mx-auto text-[#f4b4a8]" />
            <p className="font-black text-lg">التصويت جارٍ الآن</p>
            <p className="text-white/80 text-sm">بطاقات المترشحين مخفية أثناء التصويت. شارك بصوتك من صفحة الانتخابات.</p>
          </div>
        ) : (
          <CandidateElectionCard id={card.id} fullName={card.full_name} photoUrl={card.photo_url} program={card.program}
            positionTitle={card.position_title} electionTitle={card.election_title} expanded />
        )}
        <Link to="/elections" className="mt-5 w-full py-3.5 rounded-2xl bg-[#e2706a] text-white font-black flex items-center justify-center gap-2">
          <Vote className="w-5 h-5" /> صفحة الانتخابات
        </Link>
      </div>
    </div>
  );
};
