import jsPDF from 'jspdf';
import { formatAge, formatAhzab, formatStudentCode, type MahajaStudent } from '../lib/mahajaStudents';

// The card is drawn directly on a canvas (like the membership card) so that the
// Cairo font, the logo and the student's photo always render identically in the
// preview, the PNG and the PDF. Every call reads the student object it is given,
// so a re-download after an edit always shows the latest data.

const W = 1586;
const H = 992;

const NAVY = '#262150';
const NAVY_DEEP = '#1c1842';
const PINK = '#f2b8c6';
const PINK_SOFT = '#f9dfe6';
const PINK_DEEP = '#e48fa6';
const PAPER = '#f8f7fb';
const INK = '#1f1b45';
const LAVENDER = '#cfc9ec';
const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';

// Lucide icon outlines (24×24 viewBox) drawn as Path2D.
const ICONS: Record<string, string[]> = {
  user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'],
  calendar: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18', 'M8 14h.01', 'M12 14h.01', 'M16 14h.01', 'M8 18h.01', 'M12 18h.01', 'M16 18h.01'],
  home: ['m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  book: ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'],
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('image load failed: ' + src));
  img.src = src;
});

/** Fetches the photo as a blob so the canvas is never tainted by a cross-origin image. */
const loadRemoteImage = async (url: string): Promise<HTMLImageElement | null> => {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    const objectUrl = URL.createObjectURL(await res.blob());
    try { return await loadImage(objectUrl); } finally { setTimeout(() => URL.revokeObjectURL(objectUrl), 0); }
  } catch {
    return null;
  }
};

let emblemPromise: Promise<HTMLImageElement | null> | null = null;
const loadEmblem = () => (emblemPromise ??= loadImage('/mahaja-emblem.png').catch(() => { emblemPromise = null; return null; }));

const ensureFonts = async () => {
  if (!('fonts' in document)) return;
  await Promise.all(['400', '600', '700', '800', '900'].map(w => document.fonts.load(`${w} 40px "Cairo"`, 'المحجة')).map(p => p.catch(() => undefined)));
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

const drawIcon = (ctx: CanvasRenderingContext2D, name: string, cx: number, cy: number, size: number, color: string) => {
  ctx.save();
  const s = size / 24;
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of ICONS[name]) ctx.stroke(new Path2D(d));
  ctx.restore();
};

/** Eight-pointed star lattice used as the faint Islamic pattern. */
const drawStarPattern = (ctx: CanvasRenderingContext2D, color: string, alpha: number, cell = 92) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let y = -cell; y < H + cell; y += cell) {
    for (let x = -cell; x < W + cell; x += cell) {
      const cx = x + cell / 2, cy = y + cell / 2, r = cell * 0.36;
      ctx.beginPath();
      ctx.rect(cx - r * 0.72, cy - r * 0.72, r * 1.44, r * 1.44);
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(cx + r, cy); ctx.lineTo(cx + cell / 2, cy);
      ctx.moveTo(cx, cy + r); ctx.lineTo(cx, cy + cell / 2);
      ctx.stroke();
    }
  }
  ctx.restore();
};

const drawFlower = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) => {
  ctx.save();
  ctx.fillStyle = fill;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((Math.PI / 2) * i);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.55, -r * 0.45, 0, -r);
    ctx.quadraticCurveTo(-r * 0.55, -r * 0.45, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
};

/** Writes text that shrinks (then ellipsises) to fit maxWidth. */
const fitText = (
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number,
  { size, weight = 700, color = INK, minSize = 20, direction = 'rtl' as CanvasDirection, align = 'right' as CanvasTextAlign } = { size: 34 },
) => {
  ctx.save();
  ctx.direction = direction;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && s > minSize) { s -= 1; ctx.font = `${weight} ${s}px ${FONT}`; }
  let out = text;
  if (ctx.measureText(out).width > maxWidth) {
    while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) out = out.slice(0, -1);
    out += '…';
  }
  ctx.fillText(out, x, y);
  ctx.restore();
};

const drawHeader = (ctx: CanvasRenderingContext2D, emblem: HTMLImageElement | null) => {
  // Navy header with a soft wave edge.
  const wave = (offset: number) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, 300 + offset);
    ctx.bezierCurveTo(W * 0.78, 330 + offset, W * 0.62, 395 + offset, W * 0.42, 352 + offset);
    ctx.bezierCurveTo(W * 0.25, 318 + offset, W * 0.12, 250 + offset, 0, 270 + offset);
    ctx.closePath();
  };
  ctx.save();
  wave(26);
  const pinkGrad = ctx.createLinearGradient(0, 0, W, 0);
  pinkGrad.addColorStop(0, PINK);
  pinkGrad.addColorStop(0.5, PINK_SOFT);
  pinkGrad.addColorStop(1, PINK);
  ctx.fillStyle = pinkGrad;
  ctx.fill();

  wave(0);
  const navyGrad = ctx.createLinearGradient(0, 0, 0, 380);
  navyGrad.addColorStop(0, NAVY_DEEP);
  navyGrad.addColorStop(1, NAVY);
  ctx.fillStyle = navyGrad;
  ctx.fill();
  ctx.clip();
  drawStarPattern(ctx, LAVENDER, 0.09);

  // Corner sweeps echoing the template's top-left curve.
  ctx.strokeStyle = PINK;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 40);
  ctx.bezierCurveTo(120, 90, 160, 220, 300, 270);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Mihrab arch outline at the top-right.
  ctx.strokeStyle = 'rgba(207,201,236,0.18)';
  ctx.lineWidth = 4;
  for (const inset of [0, 22]) {
    ctx.beginPath();
    ctx.moveTo(1330 + inset, 330);
    ctx.lineTo(1330 + inset, 170);
    ctx.quadraticCurveTo(1330 + inset, 90 + inset, 1440, 40 + inset);
    ctx.quadraticCurveTo(1550 - inset, 90 + inset, 1550 - inset, 170);
    ctx.lineTo(1550 - inset, 330);
    ctx.stroke();
  }
  ctx.restore();

  // Emblem.
  if (emblem) {
    const eh = 290, ew = (emblem.width / emblem.height) * eh;
    ctx.drawImage(emblem, 1125 - ew / 2, 38, ew, eh);
  }

  // Title + subtitle.
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 12;
  ctx.font = `900 100px ${FONT}`;
  ctx.fillText('المحجة البيضاء', 640, 158);
  ctx.shadowBlur = 0;
  ctx.fillStyle = LAVENDER;
  ctx.font = `600 44px ${FONT}`;
  ctx.fillText('للعلوم الشرعية', 640, 252);
  // Ornament line under the subtitle.
  ctx.strokeStyle = LAVENDER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(450, 292); ctx.lineTo(830, 292);
  ctx.stroke();
  ctx.fillStyle = LAVENDER;
  for (const x of [446, 834]) { ctx.beginPath(); ctx.arc(x, 292, 6, 0, Math.PI * 2); ctx.fill(); }
  drawFlower(ctx, 640, 296, 16, '#ffffff');
  ctx.restore();
};

const drawBadge = (ctx: CanvasRenderingContext2D) => {
  const cx = 790, cy = 392, w = 520, h = 104, notch = 34;
  const shape = (pad: number) => {
    const x0 = cx - w / 2 - pad, x1 = cx + w / 2 + pad, y0 = cy - h / 2 - pad, y1 = cy + h / 2 + pad;
    ctx.beginPath();
    ctx.moveTo(x0 + notch, y0);
    ctx.lineTo(x1 - notch, y0);
    ctx.quadraticCurveTo(x1, y0, x1 + notch * 0.6, cy);
    ctx.quadraticCurveTo(x1, y1, x1 - notch, y1);
    ctx.lineTo(x0 + notch, y1);
    ctx.quadraticCurveTo(x0, y1, x0 - notch * 0.6, cy);
    ctx.quadraticCurveTo(x0, y0, x0 + notch, y0);
    ctx.closePath();
  };
  ctx.save();
  ctx.shadowColor = 'rgba(38,33,80,0.18)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  shape(10);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = PINK;
  ctx.lineWidth = 4;
  ctx.stroke();
  shape(0);
  ctx.fillStyle = PINK_SOFT;
  ctx.fill();
  ctx.strokeStyle = PINK_DEEP;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawFlower(ctx, cx - w / 2 + 8, cy, 18, PINK_DEEP);
  drawFlower(ctx, cx + w / 2 - 8, cy, 18, PINK_DEEP);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.font = `900 74px ${FONT}`;
  ctx.fillText('بطاقة طالب', cx, cy + 4);
  ctx.restore();
};

const drawPhoto = (ctx: CanvasRenderingContext2D, photo: HTMLImageElement | null) => {
  const x = 84, y = 450, w = 372, h = 420, r = 36;
  ctx.save();
  ctx.shadowColor = 'rgba(38,33,80,0.15)';
  ctx.shadowBlur = 20;
  roundRect(ctx, x - 12, y - 12, w + 24, h + 24, r + 10);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = PINK;
  ctx.lineWidth = 6;
  ctx.stroke();

  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#dcdbeb';
  ctx.fill();
  ctx.clip();
  if (photo) {
    // object-fit: cover, biased toward the top so faces are not cropped.
    const scale = Math.max(w / photo.width, h / photo.height);
    const dw = photo.width * scale, dh = photo.height * scale;
    ctx.drawImage(photo, x + (w - dw) / 2, y + Math.min(0, (h - dh) * 0.3), dw, dh);
  } else {
    ctx.fillStyle = '#a9a8c8';
    ctx.beginPath(); ctx.arc(x + w / 2, y + 150, 86, 0, Math.PI * 2); ctx.fill();
    roundRect(ctx, x + 38, y + 260, w - 76, 200, 90);
    ctx.fill();
  }
  ctx.restore();
  drawFlower(ctx, x + w / 2, y + h + 14, 20, PINK_DEEP);
};

const drawRows = (ctx: CanvasRenderingContext2D, student: MahajaStudent) => {
  const rows: { icon: string; label: string; value: string; ltr?: boolean; boxLeft?: number }[] = [
    { icon: 'user', label: 'الاسم الكامل للطالب', value: student.full_name },
    { icon: 'users', label: 'الاسم الكامل للولي', value: student.guardian_name },
    { icon: 'phone', label: 'رقم هاتف الولي', value: student.guardian_phone, ltr: true },
    { icon: 'calendar', label: 'العمر', value: formatAge(student.age) },
    { icon: 'home', label: 'مكان السكن', value: student.address },
    { icon: 'book', label: 'عدد أحزاب القرآن عند الطالب', value: formatAhzab(student.quran_ahzab), boxLeft: 975 },
  ];
  const top = 470, step = 74, rowH = 62;
  const iconX = 1446, iconW = 70, labelRight = iconX - 22, valueLeft = 512;

  rows.forEach((row, i) => {
    const cy = top + i * step + rowH / 2;
    const boxRight = row.boxLeft ?? 1098;

    // Pink label band fading to the left.
    const band = ctx.createLinearGradient(boxRight - 20, 0, iconX + iconW, 0);
    band.addColorStop(0, 'rgba(249,223,230,0)');
    band.addColorStop(0.18, PINK_SOFT);
    band.addColorStop(1, '#f6d0da');
    ctx.fillStyle = band;
    roundRect(ctx, boxRight - 20, cy - rowH / 2, iconX + iconW - boxRight + 20, rowH, 12);
    ctx.fill();

    // Navy icon tile.
    roundRect(ctx, iconX, cy - rowH / 2 - 3, iconW, rowH + 6, 14);
    ctx.fillStyle = NAVY;
    ctx.fill();
    drawIcon(ctx, row.icon, iconX + iconW / 2, cy, 34, '#ffffff');

    fitText(ctx, row.label, labelRight - 6, cy + 2, labelRight - boxRight - 18, { size: 34, weight: 800, color: INK, minSize: 24 });

    // White value box.
    roundRect(ctx, valueLeft, cy - rowH / 2, boxRight - valueLeft, rowH, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(38,33,80,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const pad = 24, maxW = boxRight - valueLeft - pad * 2;
    if (row.ltr) {
      fitText(ctx, row.value, boxRight - pad, cy + 2, maxW, { size: 34, weight: 700, color: INK, direction: 'ltr', align: 'right' });
    } else {
      fitText(ctx, row.value, boxRight - pad, cy + 2, maxW, { size: 34, weight: 700, color: INK });
    }
  });
};

const drawFooter = (ctx: CanvasRenderingContext2D, student: MahajaStudent) => {
  // Student ID pill under the photo.
  const code = formatStudentCode(student);
  const px = 84, py = 905, pw = 372, ph = 56;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 28);
  ctx.fillStyle = NAVY;
  ctx.fill();
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PINK;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText('رقم الطالب', px + pw - 26, py + ph / 2 + 2);
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(code, px + 26, py + ph / 2 + 2);
  ctx.restore();

  // Ornamental divider.
  ctx.save();
  const y = 930;
  ctx.strokeStyle = PINK_DEEP;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(560, y); ctx.lineTo(760, y);
  ctx.moveTo(820, y); ctx.lineTo(1020, y);
  ctx.stroke();
  drawFlower(ctx, 790, y, 26, PINK_DEEP);
  drawFlower(ctx, 548, y, 12, PINK_DEEP);
  drawFlower(ctx, 1032, y, 12, PINK_DEEP);

  // Registration date + full UUID for verification.
  const date = new Date(student.created_at).toLocaleDateString('ar-MA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(31,27,69,0.75)';
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(`تاريخ التسجيل: ${date}`, 1512, y);
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(31,27,69,0.4)';
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText(student.id, 1170, 966);
  ctx.restore();
};

/** Renders the student card onto a canvas. `scale` 2 gives a 3172×1984 print-quality image. */
export const renderStudentCard = async (student: MahajaStudent, scale = 2): Promise<HTMLCanvasElement> => {
  const [emblem, photo] = await Promise.all([
    loadEmblem(),
    student.photo_url ? loadRemoteImage(student.photo_url) : Promise.resolve(null),
    ensureFonts(),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.imageSmoothingQuality = 'high';

  // Card body.
  roundRect(ctx, 0, 0, W, H, 44);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  drawStarPattern(ctx, '#d9d3ea', 0.35, 120);
  drawHeader(ctx, emblem);
  drawBadge(ctx);
  drawPhoto(ctx, photo);
  drawRows(ctx, student);
  drawFooter(ctx, student);
  ctx.restore();

  // Thin outer frame.
  roundRect(ctx, 2, 2, W - 4, H - 4, 42);
  ctx.strokeStyle = 'rgba(38,33,80,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  return canvas;
};

export const studentCardDataUrl = async (student: MahajaStudent, scale = 1) =>
  (await renderStudentCard(student, scale)).toDataURL('image/png');

const fileBase = (student: MahajaStudent) =>
  `Mahaja_Student_${formatStudentCode(student)}_${student.full_name.trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '')}`;

const triggerDownload = (href: string, filename: string) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const downloadStudentCardPng = async (student: MahajaStudent) => {
  const canvas = await renderStudentCard(student, 2);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG export failed');
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${fileBase(student)}.png`);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

/** PDF at ID-1 card size (85.6 × 54 mm) for printing. */
export const downloadStudentCardPdf = async (student: MahajaStudent) => {
  const canvas = await renderStudentCard(student, 2);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 53.5] });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 53.5, undefined, 'FAST');
  pdf.save(`${fileBase(student)}.pdf`);
};
