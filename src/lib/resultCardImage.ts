// Results card of one candidate (PNG, 1080×1350), drawn on a canvas from the announced results:
// photo, name, position, votes, «ناجح» badge for the winners or a word of thanks for the others.

import { resultLabel } from './generalElections';
import { drawCover, drawPlaceholder, loadPhoto, roundRect, wrap } from './candidateCardImage';

export interface ResultCardInput {
  id: string;
  fullName: string;
  photoUrl: string | null;
  positionTitle: string;
  electionTitle: string;
  votes: number;
  pct: number;
  winner: boolean;
  url: string;
}

const W = 1080;
const H = 1350;
const NAVY = '#29244C';
const NAVY_DEEP = '#1d1938';
const PINK = '#F6B4A6';
const GOLD = '#F2C94C';
const GOLD_DEEP = '#C9971C';
const FONT = 'Cairo, "Segoe UI", Tahoma, sans-serif';

const loadLogo = () => new Promise<HTMLImageElement | null>(resolve => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = '/aoun-logo.png';
});

const star = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
};

export async function renderResultCardImage(input: ResultCardInput): Promise<Blob> {
  try {
    await Promise.all(['900', '800', '700', '600'].map(w => document.fonts.load(`${w} 40px Cairo`, 'عون وسند')));
  } catch { /* fallback fonts */ }
  const [logo, photo] = await Promise.all([loadLogo(), loadPhoto(input.photoUrl)]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNSUPPORTED');
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';
  const mid = W / 2;
  const accent = input.winner ? GOLD : PINK;

  // Background.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, NAVY_DEEP);
  g.addColorStop(1, NAVY);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = input.winner ? 'rgba(242,201,76,0.10)' : 'rgba(246,180,166,0.08)';
  ctx.beginPath(); ctx.arc(W - 40, 70, 260, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(40, H - 120, 220, 0, Math.PI * 2); ctx.fill();
  if (input.winner) {
    ctx.fillStyle = 'rgba(242,201,76,0.55)';
    [[120, 250, 14], [960, 300, 18], [90, 620, 10], [990, 700, 12], [150, 1000, 16], [930, 1060, 10]].forEach(([x, y, r]) => star(ctx, x, y, r));
  }

  // Header.
  const logoR = 54;
  const logoCx = W - 76 - logoR;
  ctx.beginPath(); ctx.arc(logoCx, 100, logoR, 0, Math.PI * 2);
  ctx.fillStyle = NAVY; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = PINK; ctx.stroke();
  if (logo) {
    const s = Math.min((logoR * 1.7) / logo.naturalWidth, (logoR * 1.7) / logo.naturalHeight);
    ctx.drawImage(logo, logoCx - (logo.naturalWidth * s) / 2, 100 - (logo.naturalHeight * s) / 2, logo.naturalWidth * s, logo.naturalHeight * s);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 46px ${FONT}`;
  ctx.fillText('جمعية عون وسند الخيرية', logoCx - logoR - 26, 78);
  ctx.fillStyle = PINK;
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText(wrap(ctx, `النتائج الرسمية — ${input.electionTitle}`, logoCx - logoR - 100, 1)[0] ?? '', logoCx - logoR - 26, 132);

  // White card.
  const cx = 64, cy = 210, cw = W - 128, ch = 930;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  roundRect(ctx, cx, cy, cw, ch, 56); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
  if (input.winner) { roundRect(ctx, cx, cy, cw, ch, 56); ctx.lineWidth = 8; ctx.strokeStyle = GOLD; ctx.stroke(); }
  ctx.textAlign = 'center';

  // Badge.
  const badge = input.winner ? 'ناجح' : 'مترشح';
  ctx.font = `900 40px ${FONT}`;
  const bw = ctx.measureText(badge).width + (input.winner ? 140 : 100);
  roundRect(ctx, mid - bw / 2, cy + 36, bw, 72, 36);
  ctx.fillStyle = input.winner ? GOLD : NAVY; ctx.fill();
  ctx.fillStyle = input.winner ? NAVY_DEEP : PINK;
  ctx.fillText(badge, mid + (input.winner ? 22 : 0), cy + 74);
  if (input.winner) { ctx.fillStyle = NAVY_DEEP; star(ctx, mid - ctx.measureText(badge).width / 2 - 14, cy + 72, 18); }

  // Photo.
  const pr = 150, pcy = cy + 140 + pr;
  ctx.beginPath(); ctx.arc(mid, pcy, pr + 14, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
  if (photo) drawCover(ctx, photo, mid, pcy, pr); else drawPlaceholder(ctx, mid, pcy, pr);

  // Name.
  let y = pcy + pr + 14 + 66;
  ctx.fillStyle = NAVY;
  let size = 64;
  ctx.font = `900 ${size}px ${FONT}`;
  while (size > 46 && ctx.measureText(input.fullName).width > cw - 100) { size -= 4; ctx.font = `900 ${size}px ${FONT}`; }
  for (const l of wrap(ctx, input.fullName, cw - 100, 2)) { ctx.fillText(l, mid, y); y += size * 1.25; }

  // Position.
  const { lead, target } = resultLabel(input.positionTitle, input.winner);
  ctx.font = `700 32px ${FONT}`;
  ctx.fillStyle = 'rgba(41,36,76,0.7)';
  ctx.fillText(wrap(ctx, `${lead} ${target}`, cw - 120, 1)[0] ?? '', mid, y + 4);
  y += 70;

  // Votes.
  roundRect(ctx, mid - 260, y, 520, 150, 36);
  ctx.fillStyle = input.winner ? '#FFF6DA' : '#F6F5FB'; ctx.fill();
  ctx.fillStyle = input.winner ? GOLD_DEEP : NAVY;
  ctx.font = `900 76px ${FONT}`;
  ctx.direction = 'ltr';
  ctx.fillText(input.votes.toLocaleString('ar-MA'), mid, y + 62);
  ctx.direction = 'rtl';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = 'rgba(41,36,76,0.75)';
  ctx.fillText(`صوت — ${input.pct.toLocaleString('ar-MA')}٪ من أصوات المنصب`, mid, y + 122);
  y += 196;

  // Message.
  ctx.font = `800 34px ${FONT}`;
  ctx.fillStyle = input.winner ? GOLD_DEEP : '#e2706a';
  const msg = input.winner ? 'مبارك النجاح وثقة الأعضاء' : 'شكرًا لعطائك… والمسيرة مستمرة';
  ctx.fillText(msg, mid, Math.min(y, cy + ch - 50));

  // Footer.
  ctx.fillStyle = PINK; ctx.font = `900 50px ${FONT}`;
  ctx.fillText('«عون للمحتاج وسند للضعيف»', mid, 1210);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `700 26px ${FONT}`;
  ctx.direction = 'ltr';
  ctx.fillText(input.url.replace(/^https?:\/\//, ''), mid, 1280);

  return new Promise<Blob>((resolve, reject) => {
    try { canvas.toBlob(b => (b ? resolve(b) : reject(new Error('EXPORT_FAILED'))), 'image/png'); }
    catch (err) { reject(err); }
  });
}

export const resultCardFileName = (id: string) => `awn-sanad-result-${id.slice(0, 8)}.png`;
