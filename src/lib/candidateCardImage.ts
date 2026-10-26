// Picture of a candidate's card (JPEG, 1080×1350) drawn on a canvas, to share it as an image
// (WhatsApp, Telegram…) or download it. Drawn from the data, not copied from the page, so the
// picture never contains the site's buttons or other interface elements.

import { candidacyLabel } from './generalElections';

export interface CardImageInput {
  id: string;
  fullName: string;
  photoUrl: string | null;
  positionTitle: string;
  program: string | null;
  electionTitle: string;
  url: string;
}

const W = 1080;
const H = 1350;
const NAVY = '#262150';
const PEACH = '#f4b4a8';
const CORAL = '#e2706a';
const FONT = 'Cairo, "Segoe UI", Tahoma, sans-serif';

const loadImage = (src: string, cors: boolean) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  if (cors) img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('IMAGE_LOAD'));
  img.src = src;
});

// The candidate's photo comes from storage (another origin): it is read with CORS so the canvas
// stays exportable. A separate URL avoids reusing a cached copy fetched without CORS.
const loadPhoto = async (url: string | null) => {
  if (!url) return null;
  try { return await loadImage(`${url}${url.includes('?') ? '&' : '?'}card=1`, true); }
  catch { return null; }
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Splits text into lines no wider than maxWidth (words never cut); at most maxLines, with "…".
const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) => {
  const lines: string[] = [];
  const paragraphs = text.replace(/\r/g, '').split('\n').map(p => p.trim()).filter(Boolean);
  let truncated = false;
  outer: for (const para of paragraphs) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) { line = next; continue; }
      lines.push(line);
      line = word;
      if (lines.length === maxLines) { truncated = true; break outer; }
    }
    if (line) lines.push(line);
    if (lines.length >= maxLines) { truncated = lines.length > maxLines || para !== paragraphs[paragraphs.length - 1]; break; }
  }
  const out = lines.slice(0, maxLines);
  if (truncated && out.length) {
    let last = out[out.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    out[out.length - 1] = `${last.replace(/[\s.،,…:]+$/u, '')}…`;
  }
  return out;
};

const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number) => {
  const s = Math.max((2 * r) / img.naturalWidth, (2 * r) / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
};

const drawPlaceholder = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#efedf6';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(38,33,80,0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.18, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.62, r * 0.6, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export async function renderCandidateCardImage(input: CardImageInput): Promise<Blob> {
  // Cairo (the site's font) must be ready before drawing, otherwise the text falls back.
  try {
    await Promise.all(['900', '800', '700', '600'].map(w => document.fonts.load(`${w} 40px Cairo`, 'عون وسند')));
  } catch { /* fallback fonts */ }
  const [logo, photo] = await Promise.all([loadImage('/aoun-logo.png', false).catch(() => null), loadPhoto(input.photoUrl)]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNSUPPORTED');
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';

  // Background: navy with soft peach shapes.
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(244,180,168,0.08)';
  ctx.beginPath(); ctx.arc(W - 40, 60, 260, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(30, H - 120, 220, 0, Math.PI * 2); ctx.fill();

  // Header: logo + association + election title (right-aligned, as on the site).
  const logoR = 62;
  const logoCx = W - 70 - logoR;
  const headCy = 110;
  ctx.beginPath(); ctx.arc(logoCx, headCy, logoR, 0, Math.PI * 2);
  ctx.fillStyle = NAVY; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = PEACH; ctx.stroke();
  if (logo) {
    const s = Math.min((logoR * 1.7) / logo.naturalWidth, (logoR * 1.7) / logo.naturalHeight);
    ctx.drawImage(logo, logoCx - (logo.naturalWidth * s) / 2, headCy - (logo.naturalHeight * s) / 2, logo.naturalWidth * s, logo.naturalHeight * s);
  }
  const textRight = logoCx - logoR - 28;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 50px ${FONT}`;
  ctx.fillText('جمعية عون وسند الخيرية', textRight, headCy - 26);
  ctx.fillStyle = PEACH;
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText(wrap(ctx, input.electionTitle, textRight - 70, 1)[0] ?? '', textRight, headCy + 36);

  // White card: measured first, then sized to its content and centred between header and footer.
  const cx = 64, cw = W - 128;
  const areaTop = 205, areaBottom = 1135;
  const mid = W / 2;
  const pr = 145;

  let nameSize = 66;
  ctx.font = `900 ${nameSize}px ${FONT}`;
  while (nameSize > 48 && ctx.measureText(input.fullName).width > cw - 100) { nameSize -= 4; ctx.font = `900 ${nameSize}px ${FONT}`; }
  const nameLines = wrap(ctx, input.fullName, cw - 100, 2);

  const { lead, target } = candidacyLabel(input.positionTitle);
  ctx.font = `600 32px ${FONT}`;
  const leadW = ctx.measureText(lead).width;
  ctx.font = `900 36px ${FONT}`;
  const targetLine = wrap(ctx, target, cw - 140 - leadW - 20, 1)[0] ?? target;
  const targetW = ctx.measureText(targetLine).width;

  // Offsets from the card's top.
  const photoCy = 125 + pr;
  const nameY = photoCy + pr + 12 + 64;
  const chipY = nameY + nameLines.length * nameSize * 1.3 - 18;
  const afterChip = chipY + 76 + 40;
  const lineH = 46;
  const textY = afterChip + 86;
  const program = (input.program ?? '').trim();
  ctx.font = `600 30px ${FONT}`;
  const maxProgramLines = Math.min(5, Math.max(0, Math.floor((areaBottom - areaTop - 44 - textY) / lineH) + 1));
  const programLines = program ? wrap(ctx, program, cw - 120, maxProgramLines) : [];
  const ch = programLines.length ? textY + (programLines.length - 1) * lineH + 23 + 44 : chipY + 76 + 50;
  const cy = Math.round(areaTop + Math.max(0, (areaBottom - areaTop - ch) / 2));

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  roundRect(ctx, cx, cy, cw, ch, 56); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
  ctx.textAlign = 'center';

  // "مترشح" badge.
  ctx.font = `900 34px ${FONT}`;
  const badgeW = ctx.measureText('مترشح').width + 90;
  roundRect(ctx, mid - badgeW / 2, cy + 36, badgeW, 62, 31); ctx.fillStyle = NAVY; ctx.fill();
  ctx.fillStyle = PEACH; ctx.fillText('مترشح', mid, cy + 67);

  // Photo.
  ctx.beginPath(); ctx.arc(mid, cy + photoCy, pr + 12, 0, Math.PI * 2); ctx.fillStyle = PEACH; ctx.fill();
  if (photo) drawCover(ctx, photo, mid, cy + photoCy, pr); else drawPlaceholder(ctx, mid, cy + photoCy, pr);

  // Name (up to 2 lines, smaller font when long).
  ctx.fillStyle = NAVY;
  ctx.font = `900 ${nameSize}px ${FONT}`;
  nameLines.forEach((l, i) => ctx.fillText(l, mid, cy + nameY + i * nameSize * 1.3));

  // Position chip: "يترشح لمسؤولية" + bold committee (RTL: lead on the right, target on its left).
  const chipW = Math.min(cw - 60, leadW + targetW + 90);
  roundRect(ctx, mid - chipW / 2, cy + chipY, chipW, 76, 38); ctx.fillStyle = '#fde8e4'; ctx.fill();
  const startX = mid + (leadW + 20 + targetW) / 2;
  ctx.textAlign = 'right';
  ctx.font = `600 32px ${FONT}`; ctx.fillStyle = 'rgba(38,33,80,0.7)';
  ctx.fillText(lead, startX, cy + chipY + 40);
  ctx.font = `900 36px ${FONT}`; ctx.fillStyle = NAVY;
  ctx.fillText(targetLine, startX - leadW - 20, cy + chipY + 40);

  // Programme excerpt.
  if (programLines.length) {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(cx + 60, cy + afterChip - 14, cw - 120, 2);
    ctx.fillStyle = NAVY; ctx.font = `900 36px ${FONT}`;
    ctx.fillText('البرنامج الانتخابي', cx + cw - 60, cy + afterChip + 30);
    ctx.font = `600 30px ${FONT}`; ctx.fillStyle = '#475569';
    programLines.forEach((l, i) => ctx.fillText(l, cx + cw - 60, cy + textY + i * lineH));
  }

  // Footer: slogan + link.
  ctx.textAlign = 'center';
  ctx.fillStyle = PEACH; ctx.font = `900 54px ${FONT}`;
  ctx.fillText('«عون للمحتاج وسند للضعيف»', mid, 1200);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `700 32px ${FONT}`;
  ctx.fillText('صوتك أمانة – شارك في التصويت', mid, 1262);
  ctx.fillStyle = CORAL; ctx.font = `700 26px ${FONT}`;
  ctx.direction = 'ltr';
  ctx.fillText(input.url.replace(/^https?:\/\//, ''), mid, 1314);

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('EXPORT_FAILED'))), 'image/jpeg', 0.92);
    } catch (err) { reject(err); }
  });
}

export const cardImageFileName = (id: string) => `awn-sanad-candidate-${id.slice(0, 8)}.jpg`;
