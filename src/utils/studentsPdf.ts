import jsPDF from 'jspdf';
import {
  ATTENDANCE_STATUSES, checkoutLabel, computeAttendanceStats, formatTime, isCheckedIn, periodLabel, describeLog, formatAge, formatAhzab, formatDateTime, formatDay,
  formatStudentCode, getStudent, getStudentDetails, isSuspended, listStudents, StudentsError,
  type AttendanceStats, type MahajaStudent, type StudentDetails,
} from '../lib/mahajaStudents';
import { drawFlower, drawStarPattern, ensureFonts, loadEmblem, loadRemoteImage, renderStudentCard, roundRect } from './studentCard';

// Archive-quality A4 export of the Mahaja students.
// Every page is drawn on a canvas (so Arabic shaping, the Cairo font and the photos
// render exactly as in the browser) and then placed full-page in an A4 PDF.
// All data comes from the database at export time.

const PW = 1654; // A4 at 200 dpi
const PH = 2339;
const M = 80; // side margin
const HEADER_H = 250;
const FOOTER_H = 110;
const CONTENT_TOP = HEADER_H + 40;
const CONTENT_BOTTOM = PH - FOOTER_H - 30;
const GAP = 22;
const CW = PW - 2 * M; // content width

export const NAVY = '#262150';
const NAVY_DEEP = '#1c1842';
const PINK = '#f2b8c6';
const PINK_SOFT = '#f9dfe6';
const PINK_DEEP = '#e48fa6';
const INK = '#1f1b45';
const MUTED = '#6b6888';
const LINE = '#e3e0ef';
const LAVENDER = '#cfc9ec';
const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';

type Ctx = CanvasRenderingContext2D;
type Drawable = CanvasImageSource & { width: number; height: number };

export interface Block {
  h: number;
  draw: (ctx: Ctx, top: number) => void;
  /** Keep on the same page as the following block (section titles, table headers). */
  keepWithNext?: boolean;
}

export interface DocMeta {
  title: string;
  subtitle: string;
  issuedAt: Date;
  totalLabel: string;
}

export type ExportProgress = (message: string) => void;

// ─── Text helpers ─────────────────────────────────────────────────────────────

const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

const measureCtx = (() => {
  let ctx: Ctx | null = null;
  return () => (ctx ??= document.createElement('canvas').getContext('2d')!);
})();

/** Word-wraps text to maxWidth (long words are split). */
const wrap = (text: string, weight: number, size: number, maxWidth: number, maxLines = Infinity): string[] => {
  const ctx = measureCtx();
  ctx.font = font(weight, size);
  ctx.direction = 'rtl';
  const lines: string[] = [];
  for (const paragraph of String(text ?? '').split(/\n+/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
      if (line) lines.push(line);
      if (ctx.measureText(word).width <= maxWidth) { line = word; continue; }
      let chunk = '';
      for (const ch of word) {
        if (ctx.measureText(chunk + ch).width > maxWidth) { lines.push(chunk); chunk = ch; } else chunk += ch;
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }
  if (lines.length === 0) lines.push('—');
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, '') + ' …';
    return cut;
  }
  return lines;
};

const text = (ctx: Ctx, value: string, x: number, y: number, weight: number, size: number, color: string,
  { align = 'right' as CanvasTextAlign, ltr = false } = {}) => {
  ctx.save();
  ctx.font = font(weight, size);
  ctx.fillStyle = color;
  ctx.direction = ltr ? 'ltr' : 'rtl';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
  ctx.restore();
};

const textWidth = (value: string, weight: number, size: number) => {
  const ctx = measureCtx();
  ctx.font = font(weight, size);
  return ctx.measureText(value).width;
};

/** Pill with text; drawn so its RIGHT edge is at x. Returns its width. */
const chip = (ctx: Ctx, value: string, xRight: number, cy: number, bg: string, fg: string, size = 22, ltr = false) => {
  const w = textWidth(value, 700, size) + 36;
  const h = size + 18;
  roundRect(ctx, xRight - w, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  text(ctx, value, xRight - w / 2, cy + 1, 700, size, fg, { align: 'center', ltr });
  return w;
};

const shrink = (img: HTMLImageElement, max = 520): Drawable => {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  if (scale === 1) return img;
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const cx = c.getContext('2d')!;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, c.width, c.height);
  return c;
};

const drawCover = (ctx: Ctx, img: Drawable, x: number, y: number, w: number, h: number, r: number) => {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + Math.min(0, (h - dh) * 0.3), dw, dh);
  ctx.restore();
};

const drawPlaceholder = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#dcdbeb';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#a9a8c8';
  ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.36, w * 0.22, 0, Math.PI * 2); ctx.fill();
  roundRect(ctx, x + w * 0.12, y + h * 0.66, w * 0.76, h * 0.5, w * 0.3);
  ctx.fill();
  ctx.restore();
};

// ─── Page chrome ──────────────────────────────────────────────────────────────

const drawHeader = (ctx: Ctx, meta: DocMeta, emblem: HTMLImageElement | null) => {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, HEADER_H);
  g.addColorStop(0, NAVY_DEEP);
  g.addColorStop(1, NAVY);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PW, HEADER_H);
  ctx.beginPath();
  ctx.rect(0, 0, PW, HEADER_H);
  ctx.clip();
  drawStarPattern(ctx, LAVENDER, 0.08, 96, PW, HEADER_H);
  ctx.restore();
  ctx.fillStyle = PINK;
  ctx.fillRect(0, HEADER_H, PW, 12);

  let titleRight = PW - M;
  if (emblem) {
    const eh = 190, ew = (emblem.width / emblem.height) * eh;
    ctx.drawImage(emblem, PW - M - ew, (HEADER_H - eh) / 2, ew, eh);
    titleRight = PW - M - ew - 36;
  }
  text(ctx, meta.title, titleRight, 92, 900, 56, '#ffffff');
  text(ctx, meta.subtitle, titleRight, 160, 600, 28, LAVENDER);

  // Left side: totals and issue date.
  const issued = meta.issuedAt.toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.save();
  roundRect(ctx, M, 62, 360, 126, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fill();
  ctx.restore();
  text(ctx, meta.totalLabel, M + 180, 104, 800, 30, '#ffffff', { align: 'center' });
  text(ctx, `تاريخ الإصدار: ${issued}`, M + 180, 152, 600, 22, LAVENDER, { align: 'center' });
};

const drawFooter = (ctx: Ctx, page: number, total: number, meta: DocMeta) => {
  const y = PH - FOOTER_H;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, y); ctx.lineTo(PW - M, y);
  ctx.stroke();
  drawFlower(ctx, PW / 2, y, 16, PINK_DEEP);
  text(ctx, 'معهد المحجة البيضاء للعلوم الشرعية — أرشيف رسمي', PW - M, y + 50, 600, 22, MUTED);
  text(ctx, `صفحة ${page} من ${total}`, M, y + 50, 800, 24, INK, { align: 'left' });
  text(ctx, formatDateTime(meta.issuedAt.toISOString()), PW / 2, y + 50, 600, 20, MUTED, { align: 'center' });
};

// ─── Blocks ───────────────────────────────────────────────────────────────────

export const sectionTitle = (label: string): Block => ({
  h: 70,
  keepWithNext: true,
  draw: (ctx, top) => {
    ctx.fillStyle = NAVY;
    roundRect(ctx, PW - M - 10, top + 14, 10, 42, 5);
    ctx.fill();
    text(ctx, label, PW - M - 28, top + 36, 800, 34, INK);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(M, top + 66); ctx.lineTo(PW - M - 28 - textWidth(label, 800, 34) - 20, top + 66);
    ctx.stroke();
  },
});

export const statTiles = (tiles: { label: string; value: string; color?: string }[]): Block => {
  const perRow = Math.min(tiles.length, 6);
  const gap = 18;
  const w = (CW - gap * (perRow - 1)) / perRow;
  const rows = Math.ceil(tiles.length / perRow);
  const tileH = 120;
  return {
    h: rows * tileH + (rows - 1) * gap,
    draw: (ctx, top) => {
      tiles.forEach((t, i) => {
        const r = Math.floor(i / perRow), c = i % perRow;
        const x = PW - M - (c + 1) * w - c * gap;
        const y = top + r * (tileH + gap);
        roundRect(ctx, x, y, w, tileH, 22);
        ctx.fillStyle = '#f6f5fb';
        ctx.fill();
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 2;
        ctx.stroke();
        text(ctx, t.value, x + w / 2, y + 48, 900, 40, t.color ?? INK, { align: 'center' });
        text(ctx, t.label, x + w / 2, y + 92, 700, 22, MUTED, { align: 'center' });
      });
    },
  };
};

interface StudentBlockData {
  student: MahajaStudent;
  photo: Drawable | null;
  stats: AttendanceStats | null;
  index: number;
}

/** One student: photo on the right, every recorded field next to it. */
const studentBlock = ({ student: s, photo, stats, index }: StudentBlockData): Block => {
  const pad = 26;
  const photoW = 180, photoH = 224;
  const contentRight = PW - M - pad - photoW - 34;
  const contentLeft = M + pad;
  const contentW = contentRight - contentLeft;
  const suspended = isSuspended(s);

  // Name line
  const nameLines = wrap(s.full_name, 900, 38, contentW - 260, 2);
  const nameH = nameLines.length * 48;

  // Field grid (3 columns)
  const fields: { label: string; value: string; ltr?: boolean }[] = [
    { label: 'الاسم الكامل للولي', value: s.guardian_name },
    { label: 'رقم هاتف الولي', value: s.guardian_phone, ltr: true },
    { label: 'العمر', value: formatAge(s.age) },
    { label: 'مكان السكن', value: s.address },
    { label: 'عدد أحزاب القرآن', value: formatAhzab(s.quran_ahzab) },
    { label: 'الحالة', value: suspended ? `موقوف${s.status_reason ? ` — ${s.status_reason}` : ''}` : 'نشط' },
    { label: 'تاريخ التسجيل', value: formatDateTime(s.created_at) },
    { label: 'آخر تحديث', value: formatDateTime(s.updated_at) },
    { label: 'سُجّل بواسطة', value: s.created_by || '—' },
  ];
  const cols = 3, colGap = 24;
  const colW = (contentW - colGap * (cols - 1)) / cols;
  const cells = fields.map(f => ({ ...f, lines: f.ltr ? [f.value] : wrap(f.value, 700, 25, colW, 3) }));
  const rowHeights: number[] = [];
  for (let i = 0; i < cells.length; i += cols) {
    const maxLines = Math.max(...cells.slice(i, i + cols).map(c => c.lines.length));
    rowHeights.push(28 + maxLines * 33 + 10);
  }
  const gridH = rowHeights.reduce((a, b) => a + b, 0);

  // Attendance summary + notes + UUID
  const summary = stats && stats.total > 0
    ? `الحضور: ${stats.total} يوم مسجّل • حاضر ${stats.present} • غائب ${stats.absent} • متأخر ${stats.late} • خرج مبكرًا ${stats.left_early} • بعذر ${stats.excused} • نسبة الحضور ${stats.rate === null ? '—' : `${stats.rate}%`}`
    : stats ? 'الحضور: لا توجد سجلات حضور بعد' : '';
  const summaryLines = summary ? wrap(summary, 600, 22, contentW) : [];
  const noteLines = s.notes ? wrap(s.notes, 600, 23, contentW, 14) : [];
  const extraH = (summaryLines.length ? summaryLines.length * 30 + 12 : 0) + (noteLines.length ? 32 + noteLines.length * 32 + 8 : 0) + 28;

  const contentH = nameH + 14 + gridH + extraH;
  const sideH = photoH + 58;
  const h = Math.max(contentH, sideH) + pad * 2;

  return {
    h,
    draw: (ctx, top) => {
      // Card
      ctx.save();
      ctx.shadowColor = 'rgba(38,33,80,0.08)';
      ctx.shadowBlur = 16;
      roundRect(ctx, M, top, CW, h, 26);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
      roundRect(ctx, M, top, CW, h, 26);
      ctx.strokeStyle = suspended ? '#f3b7b7' : LINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = suspended ? '#e45b5b' : NAVY;
      roundRect(ctx, PW - M - 8, top + 24, 8, h - 48, 4);
      ctx.fill();

      // Photo + code
      const px = PW - M - pad - photoW, py = top + pad;
      if (photo) drawCover(ctx, photo, px, py, photoW, photoH, 22);
      else drawPlaceholder(ctx, px, py, photoW, photoH, 22);
      roundRect(ctx, px, py, photoW, photoH, 22);
      ctx.strokeStyle = PINK;
      ctx.lineWidth = 5;
      ctx.stroke();
      if (suspended) {
        ctx.fillStyle = 'rgba(228,91,91,0.9)';
        roundRect(ctx, px + 14, py + 14, photoW - 28, 40, 12);
        ctx.fill();
        text(ctx, 'موقوف', px + photoW / 2, py + 35, 800, 22, '#fff', { align: 'center' });
      }
      const codeW = textWidth(formatStudentCode(s), 800, 24) + 40;
      roundRect(ctx, px + (photoW - codeW) / 2, py + photoH + 14, codeW, 42, 21);
      ctx.fillStyle = PINK_SOFT;
      ctx.fill();
      text(ctx, formatStudentCode(s), px + photoW / 2, py + photoH + 36, 800, 24, NAVY, { align: 'center', ltr: true });

      // Serial number
      ctx.beginPath();
      ctx.arc(M + pad + 24, top + pad + 26, 26, 0, Math.PI * 2);
      ctx.fillStyle = NAVY;
      ctx.fill();
      text(ctx, String(index), M + pad + 24, top + pad + 27, 800, 22, '#fff', { align: 'center', ltr: true });

      // Name + status
      let y = top + pad + 26;
      nameLines.forEach((line, i) => text(ctx, line, contentRight, y + i * 48, 900, 38, INK));
      const statusLabel = suspended ? 'موقوف' : 'نشط';
      chip(ctx, statusLabel, M + pad + 66 + textWidth(statusLabel, 700, 22) + 36, top + pad + 26,
        suspended ? '#fde3e3' : '#dff5ea', suspended ? '#b42323' : '#167a4a', 22);
      y = top + pad + nameH + 14;

      // Grid
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(contentLeft, y - 6); ctx.lineTo(contentRight, y - 6);
      ctx.stroke();
      for (let r = 0; r < rowHeights.length; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = cells[r * cols + c];
          if (!cell) continue;
          const xr = contentRight - c * (colW + colGap);
          text(ctx, cell.label, xr, y + 18, 600, 20, MUTED);
          cell.lines.forEach((line, i) => text(ctx, line, xr, y + 48 + i * 33, 700, 25, INK, cell.ltr ? { align: 'right', ltr: true } : {}));
        }
        y += rowHeights[r];
      }

      // Attendance summary
      if (summaryLines.length) {
        roundRect(ctx, contentLeft, y - 4, contentW, summaryLines.length * 30 + 10, 12);
        ctx.fillStyle = '#f6f5fb';
        ctx.fill();
        summaryLines.forEach((line, i) => text(ctx, line, contentRight - 16, y + 12 + i * 30, 600, 22, INK));
        y += summaryLines.length * 30 + 12;
      }
      // General notes
      if (noteLines.length) {
        text(ctx, 'ملاحظات:', contentRight, y + 16, 800, 22, MUTED);
        y += 32;
        noteLines.forEach((line, i) => text(ctx, line, contentRight, y + 16 + i * 32, 600, 23, INK));
        y += noteLines.length * 33 + 10;
      }
      // Unique ID
      text(ctx, `ID: ${s.id}`, contentLeft, top + h - pad - 8, 600, 17, '#9a97b5', { align: 'left', ltr: true });
    },
  };
};

/** Simple table (used for the single-student file). Each row is its own block so it can break across pages. */
export const table = (columns: { label: string; width: number }[], rows: { cells: string[]; chips?: (string | null)[] }[]): Block[] => {
  const totalW = columns.reduce((a, c) => a + c.width, 0);
  const widths = columns.map(c => (c.width / totalW) * CW);
  const header: Block = {
    h: 58,
    keepWithNext: true,
    draw: (ctx, top) => {
      roundRect(ctx, M, top, CW, 58, 14);
      ctx.fillStyle = NAVY;
      ctx.fill();
      let xr = PW - M;
      columns.forEach((c, i) => { text(ctx, c.label, xr - 20, top + 30, 800, 22, '#fff'); xr -= widths[i]; });
    },
  };
  const body: Block[] = rows.map((row, ri) => {
    const lines = row.cells.map((v, i) => (row.chips?.[i] ? [v] : wrap(v, 600, 22, widths[i] - 40)));
    const h = Math.max(...lines.map(l => l.length)) * 32 + 26;
    return {
      h,
      draw: (ctx, top) => {
        if (ri % 2 === 0) { ctx.fillStyle = '#f8f7fc'; ctx.fillRect(M, top, CW, h); }
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(M, top + h); ctx.lineTo(PW - M, top + h); ctx.stroke();
        let xr = PW - M;
        lines.forEach((cellLines, i) => {
          const chipColor = row.chips?.[i];
          if (chipColor) {
            chip(ctx, cellLines[0], xr - 20, top + 30, chipColor, '#fff', 20);
          } else {
            cellLines.forEach((line, li) => text(ctx, line, xr - 20, top + 29 + li * 32, 600, 22, INK));
          }
          xr -= widths[i];
        });
      },
    };
  });
  return [header, ...body];
};

export const emptyLine = (message: string): Block => ({
  h: 60,
  draw: (ctx, top) => text(ctx, message, PW / 2, top + 30, 600, 24, MUTED, { align: 'center' }),
});

const imageBlock = (img: HTMLCanvasElement, maxW = CW * 0.8): Block => {
  const w = Math.min(maxW, img.width);
  const h = (img.height / img.width) * w;
  return { h, draw: (ctx, top) => ctx.drawImage(img, (PW - w) / 2, top, w, h) };
};

// ─── Pagination & output ──────────────────────────────────────────────────────

const paginate = (blocks: Block[]): Block[][] => {
  const pages: Block[][] = [[]];
  let y = CONTENT_TOP;
  const limit = CONTENT_BOTTOM - CONTENT_TOP;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    // Keep a title / table header together with what follows it.
    let need = b.h;
    if (b.keepWithNext && blocks[i + 1]) need += GAP + Math.min(blocks[i + 1].h, limit - b.h - GAP);
    const page = pages[pages.length - 1];
    if (page.length > 0 && y + need > CONTENT_BOTTOM) {
      pages.push([]);
      y = CONTENT_TOP;
    }
    pages[pages.length - 1].push(b);
    y += b.h + GAP;
  }
  return pages;
};

export const buildPdf = async (blocks: Block[], meta: DocMeta, fileName: string, onProgress?: ExportProgress) => {
  const emblem = await loadEmblem();
  const pages = paginate(blocks);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: meta.title, subject: meta.subtitle, creator: 'معهد المحجة البيضاء', author: 'لوحة تحكم المشرف' });

  const canvas = document.createElement('canvas');
  canvas.width = PW;
  canvas.height = PH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';

  for (let p = 0; p < pages.length; p++) {
    onProgress?.(`جاري إنشاء الصفحة ${p + 1} من ${pages.length}…`);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PW, PH);
    drawHeader(ctx, meta, emblem);
    let y = CONTENT_TOP;
    for (const b of pages[p]) { b.draw(ctx, y); y += b.h + GAP; }
    drawFooter(ctx, p + 1, pages.length, meta);
    if (p > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    // Yield so the UI stays responsive on phones.
    await new Promise(r => setTimeout(r, 0));
  }
  onProgress?.('جاري حفظ الملف…');
  pdf.save(fileName);
};

/** Runs async tasks with limited concurrency. */
const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
};

const loadPhoto = async (s: MahajaStudent): Promise<Drawable | null> => {
  if (!s.photo_url) return null;
  const img = await loadRemoteImage(s.photo_url);
  return img ? shrink(img) : null;
};

// Latin file names only: browsers save non-Latin download names as "download".
export const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ─── Public API ───────────────────────────────────────────────────────────────

/** Exports every registered student (fresh from the database) to one A4 PDF. */
export const exportAllStudentsPdf = async (onProgress?: ExportProgress) => {
  onProgress?.('جاري جلب بيانات الطلاب من قاعدة البيانات…');
  await ensureFonts();
  const students = (await listStudents()).sort((a, b) => a.student_number - b.student_number);
  if (students.length === 0) throw new StudentsError('لا يوجد طلاب مسجلون لتصديرهم.', 'empty');

  // Attendance summaries (skipped if the attendance feature is not installed).
  let statsAvailable = true;
  let loaded = 0;
  const stats = await mapLimit(students, 4, async s => {
    if (!statsAvailable) return null;
    try {
      const d = await getStudentDetails(s.id);
      return computeAttendanceStats(d.attendance);
    } catch (err) {
      if (err instanceof StudentsError && (err.code === 'not_installed' || err.code === 'forbidden')) statsAvailable = false;
      return null;
    } finally {
      onProgress?.(`جاري تحميل السجلات (${++loaded} من ${students.length})…`);
    }
  });

  loaded = 0;
  const photos = await mapLimit(students, 6, async s => {
    const p = await loadPhoto(s);
    onProgress?.(`جاري تحميل الصور (${++loaded} من ${students.length})…`);
    return p;
  });

  const active = students.filter(s => !isSuspended(s)).length;
  const avgAhzab = students.reduce((a, s) => a + s.quran_ahzab, 0) / students.length;
  const places = new Set(students.map(s => s.address.trim().toLowerCase())).size;
  const issuedAt = new Date();

  const blocks: Block[] = [
    statTiles([
      { label: 'إجمالي الطلاب', value: String(students.length) },
      { label: 'الطلاب النشطون', value: String(active), color: '#167a4a' },
      { label: 'الطلاب الموقوفون', value: String(students.length - active), color: '#b42323' },
      { label: 'أماكن السكن', value: String(places) },
      { label: 'متوسط الأحزاب', value: avgAhzab.toFixed(1) },
    ]),
    sectionTitle('بيانات الطلاب'),
    ...students.map((s, i) => studentBlock({ student: s, photo: photos[i], stats: statsAvailable ? stats[i] : null, index: i + 1 })),
  ];

  await buildPdf(blocks, {
    title: 'قائمة طلاب معهد المحجة البيضاء',
    subtitle: 'المحجة البيضاء للعلوم الشرعية — سجل الطلاب المسجلين',
    totalLabel: `إجمالي الطلاب: ${students.length}`,
    issuedAt,
  }, `Mahaja_Students_${stamp(issuedAt)}.pdf`, onProgress);
  return students.length;
};

/** Exports one student's complete file: data, card, attendance, notes and history. */
export const exportStudentPdf = async (studentId: string, onProgress?: ExportProgress) => {
  onProgress?.('جاري جلب بيانات الطالب…');
  await ensureFonts();
  const student = await getStudent(studentId);
  let details: StudentDetails | null = null;
  try { details = await getStudentDetails(student.id); } catch { details = null; }
  onProgress?.('جاري تحميل الصورة والبطاقة…');
  const [photo, card] = await Promise.all([loadPhoto(student), renderStudentCard(student, 1).catch(() => null)]);
  const stats = details ? computeAttendanceStats(details.attendance) : null;

  const blocks: Block[] = [studentBlock({ student, photo, stats, index: 1 })];

  if (details) {
    blocks.push(sectionTitle('إحصائيات الحضور'), statTiles([
      { label: 'الحصص المسجلة', value: String(stats!.total) },
      { label: 'أيام الحضور', value: String(stats!.present), color: '#167a4a' },
      { label: 'أيام الغياب', value: String(stats!.absent), color: '#b42323' },
      { label: 'مرات التأخر', value: String(stats!.late), color: '#b7791f' },
      { label: 'الخروج المبكر', value: String(stats!.left_early), color: '#c05621' },
      { label: 'نسبة الحضور', value: stats!.rate === null ? '—' : `${stats!.rate}%`, color: NAVY },
    ]));

    blocks.push(sectionTitle('سجل الحضور'));
    if (details.attendance.length === 0) blocks.push(emptyLine('لا توجد سجلات حضور'));
    else {
      const chipColor = (s: string) => ({ present: '#059669', absent: '#dc2626', late: '#f59e0b', left_early: '#f97316', excused: '#0284c7' } as Record<string, string>)[s] ?? NAVY;
      blocks.push(...table(
        [{ label: 'التاريخ والفترة', width: 3 }, { label: 'الدخول', width: 1.8 }, { label: 'الخروج', width: 2.4 }, { label: 'الملاحظة', width: 3 }, { label: 'المشرف', width: 2.4 }],
        details.attendance.map(r => {
          const entry = r.status === 'left_early' ? 'present' : r.status;
          const exit = r.status === 'left_early' ? 'left_early' : r.checkout_status;
          const exitText = !isCheckedIn(entry) ? '—' : `${checkoutLabel(exit)}${r.check_out_at ? ` ${formatTime(r.check_out_at)}` : ''}`;
          return {
            cells: [`${formatDay(r.attendance_date)}\n${periodLabel(r.period)}`, ATTENDANCE_STATUSES.find(a => a.id === entry)?.label ?? entry, exitText, r.note || '—',
                    r.checkout_by && r.checkout_by !== r.recorded_by ? `${r.recorded_by} / ${r.checkout_by}` : r.recorded_by],
            chips: [null, chipColor(entry), null, null, null],
          };
        }),
      ));
    }

    blocks.push(sectionTitle('الملاحظات'));
    if (details.notes.length === 0) blocks.push(emptyLine('لا توجد ملاحظات'));
    else blocks.push(...table(
      [{ label: 'الملاحظة', width: 7 }, { label: 'المشرف والتاريخ', width: 3 }],
      details.notes.map(n => ({ cells: [n.note, `${n.created_by} — ${formatDateTime(n.created_at)}`] })),
    ));

    blocks.push(sectionTitle('سجل الطالب'));
    if (details.log.length === 0) blocks.push(emptyLine('لا يوجد سجل'));
    else blocks.push(...table(
      [{ label: 'العملية', width: 7 }, { label: 'المشرف والتاريخ', width: 3 }],
      details.log.map(e => ({ cells: [describeLog(e), `${e.actor} — ${formatDateTime(e.created_at)}`] })),
    ));
  }

  if (card) blocks.push(sectionTitle('بطاقة الطالب'), imageBlock(card));

  const issuedAt = new Date();
  await buildPdf(blocks, {
    title: 'ملف طالب — معهد المحجة البيضاء',
    subtitle: `${student.full_name} — ${formatStudentCode(student)}`,
    totalLabel: formatStudentCode(student),
    issuedAt,
  }, `Mahaja_Student_File_${formatStudentCode(student)}.pdf`, onProgress);
};
