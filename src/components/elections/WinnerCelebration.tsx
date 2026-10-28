import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Crown, PartyPopper, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchGeneralElections, resultLabel } from '../../lib/generalElections';

// «مبارك النجاح!»: shown once (per application, on this device) to a candidate who won a position
// in announced results, when they open the site. Loaded on demand; the confetti is a short canvas
// animation that stops by itself and is skipped when the device asks for reduced motion.

interface Win { applicationId: string; name: string; position: string; election: string }

const seenKey = (id: string) => `win_celebrated_${id}`;
const COLORS = ['#F2C94C', '#F6B4A6', '#ffffff', '#e2706a', '#8f86d6'];

const Confetti = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
    resize();
    const count = innerWidth < 640 ? 90 : 150;
    const parts = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.6,
      vx: (Math.random() - 0.5) * 2.2, vy: 2 + Math.random() * 3.5,
      r: 4 + Math.random() * 5, a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.25,
      c: COLORS[Math.floor(Math.random() * COLORS.length)], round: Math.random() < 0.35,
    }));
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalAlpha = elapsed > 4200 ? Math.max(0, 1 - (elapsed - 4200) / 800) : 1;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.a += p.va; p.vy += 0.02;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.6, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.r, -p.r / 2.5, p.r * 2, p.r / 1.25);
        ctx.restore();
      }
      if (elapsed < 5000) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 w-full h-full" />;
};

export const WinnerCelebration = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [win, setWin] = useState<Win | null>(null);

  useEffect(() => {
    if (!user) { setWin(null); return; }
    let alive = true;
    // A little after the page has loaded, so the site itself is never slowed down.
    const t = setTimeout(async () => {
      try {
        const elections = await fetchGeneralElections();
        for (const e of elections) {
          if (e.phase !== 'results' || !e.my) continue;
          for (const a of e.my.applications) {
            const p = e.positions.find(x => x.id === a.position_id);
            if (a.status !== 'approved' || !p || p.winner_application_id !== a.id) continue;
            let seen = false;
            try { seen = localStorage.getItem(seenKey(a.id)) === '1'; } catch { /* storage blocked */ }
            if (!seen && alive) { setWin({ applicationId: a.id, name: a.full_name, position: p.title, election: e.title }); return; }
          }
        }
      } catch { /* the celebration is optional */ }
    }, 1500);
    return () => { alive = false; clearTimeout(t); };
  }, [user]);

  if (!win) return null;
  const close = () => {
    try { localStorage.setItem(seenKey(win.applicationId), '1'); } catch { /* storage blocked */ }
    setWin(null);
  };

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#120f29]/80 backdrop-blur-sm" dir="rtl" role="dialog" aria-modal="true" aria-label="مبارك النجاح" onClick={close}>
      <Confetti />
      <div onClick={ev => ev.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-[32px] bg-gradient-to-br from-[#1d1938] via-[#29244C] to-[#3a3270] text-white text-center px-6 pt-10 pb-6 shadow-2xl ring-2 ring-[#F2C94C]/70 animate-[celebrate-in_0.5s_cubic-bezier(.2,1.4,.4,1)]">
        <style>{'@keyframes celebrate-in{from{opacity:0;transform:scale(.85) translateY(20px)}to{opacity:1;transform:none}}'}</style>
        <span aria-hidden className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-[#F2C94C]/20 blur-2xl" />
        <span aria-hidden className="absolute -bottom-20 -right-12 w-56 h-56 rounded-full bg-[#F6B4A6]/15 blur-2xl" />
        <button onClick={close} aria-label="إغلاق" className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><X className="w-5 h-5" /></button>
        <div className="relative mx-auto w-24 h-24 rounded-full bg-[#F2C94C] text-[#1d1938] flex items-center justify-center shadow-lg shadow-[#F2C94C]/40">
          <Crown className="w-12 h-12" />
        </div>
        <h2 className="relative mt-5 text-4xl font-black">مبارك النجاح!</h2>
        <p className="relative mt-3 text-lg font-black text-[#F6B4A6]">{win.name}</p>
        <p className="relative mt-1 text-white/85 leading-relaxed">{resultLabel(win.position, true).lead.replace('فاز', 'فزتَ')} <b className="text-[#F2C94C]">{resultLabel(win.position, true).target}</b> في {win.election}.</p>
        <p className="relative mt-3 text-sm text-white/70 leading-relaxed">ثقة الأعضاء أمانة، ونتمنى لك التوفيق في خدمة الجمعية: «عون للمحتاج وسند للضعيف».</p>
        <div className="relative mt-6 grid grid-cols-2 gap-2">
          <button onClick={() => { close(); navigate('/elections'); }} className="py-3 rounded-2xl bg-[#F2C94C] text-[#1d1938] font-black flex items-center justify-center gap-1.5">
            <PartyPopper className="w-5 h-5" /> عرض النتائج
          </button>
          <button onClick={close} className="py-3 rounded-2xl bg-white/10 hover:bg-white/20 font-bold">شكرًا</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
