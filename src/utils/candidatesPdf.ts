import jsPDF from 'jspdf';
import {
  STATUS_INFO, adminGetGeneral, candidatesLabel, formatMrDateTime, groupPositions, votingStarted,
  type AdminApplication, type AdminGeneralElection, type ApplicationStatus, type GeneralPosition,
} from '../lib/generalElections';
import { ensureFonts, loadImage, loadRemoteImage, roundRect } from './studentCard';

// Candidates report of a general election (dashboard): A4 PDF, cover page with summary and
// table of contents, then one section per committee / office with every candidate registered
// in it (photo, name, position, status, account details, dates, programme). Pages are drawn
// on a canvas (Arabic shaping and the Cairo font render as in the browser) and placed full-page
// in the PDF. The data is fetched from the database at export time, so new candidates are
// always included.

const PW = 1654; // A4 at 200 dpi
const PH = 2339;
const M = 96; // side margin
const HEADER_H = 170;
const FOOTER_H = 120;
const CONTENT_TOP = HEADER_H + 56;
const CONTENT_BOTTOM = PH - FOOTER_H - 40;
const GAP = 20;
const CW = PW - 2 * M;

const NAVY = '#29244C';
const NAVY_DEEP = '#1d1938';
const PINK = '#F6B4A6';
const PINK_SOFT = '#fdeee9';
const CORAL = '#e2706a';
const INK = '#1f1b45';
const MUTED = '#6b6888';
const LINE = '#e6e3ef';
const ZEBRA = '#f8f7fc';
const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';

const STATUS_COLOR: Record<ApplicationStatus, { bg: string; fg: string }> = {
  approved: { bg: '#d9f2e6', fg: '#0f6b45' },
  pending: { bg: '#fdf0cf', fg: '#8a5a00' },
  rejected: { bg: '#fde0e0', fg: '#a12a2a' },
};

type Ctx = CanvasRenderingContext2D;
type Drawable = CanvasImageSource & { width: number; height: number };

interface Block {
  h: number;
  draw: (ctx: Ctx, top: number) => void;
  /** Keep on the same page as the following block (section titles). */
  keepWithNext?: boolean;
  /** Key of the section that starts with this block (table of contents). */
  section?: string;
}

export type ExportProgress = (message: string) => void;

export class CandidatesPdfError extends Error {}

// ─── Text helpers ─────────────────────────────────────────────────────────────

const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

const measure = (() => {
  let ctx: Ctx | null = null;
  return () => (ctx ??= document.createElement('canvas').getContext('2d')!);
})();

const textWidth = (value: string, weight: number, size: number) => {
  const ctx = measure();
  ctx.font = font(weight, size);
  ctx.direction = 'rtl';
  return ctx.measureText(value).width;
};

/** Word-wraps text to maxWidth (long words split); keeps the line breaks typed by the candidate. */
const wrap = (value: string, weight: number, size: number, maxWidth: number): string[] => {
  const lines: string[] = [];
  for (const paragraph of String(value ?? '').replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, weight, size) <= maxWidth) { line = next; continue; }
      if (line) lines.push(line);
      if (textWidth(word, weight, size) <= maxWidth) { line = word; continue; }
      let chunk = '';
      for (const ch of word) {
        if (textWidth(chunk + ch, weight, size) > maxWidth) { lines.push(chunk); chunk = ch; } else chunk += ch;
      }
      line = chunk;
    }
    lines.push(line);
  }
  while (lines.length > 1 && !lines[lines.length - 1]) lines.pop();
  return lines.length ? lines : ['—'];
};

const fit = (value: string, weight: number, size: number, maxWidth: number) => {
  if (textWidth(value, weight, size) <= maxWidth) return value;
  let v = value;
  while (v.length > 1 && textWidth(`${v}…`, weight, size) > maxWidth) v = v.slice(0, -1);
  return `${v.trimEnd()}…`;
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

/** Pill drawn with its RIGHT edge at x; returns its width. */
const chip = (ctx: Ctx, value: string, xRight: number, cy: number, bg: string, fg: string, size = 22) => {
  const w = textWidth(value, 800, size) + 34;
  const h = size + 18;
  roundRect(ctx, xRight - w, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  text(ctx, value, xRight - w / 2, cy + 1, 800, size, fg, { align: 'center' });
  return w;
};

const shrink = (img: HTMLImageElement, max = 320): Drawable => {
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

const drawRoundPhoto = (ctx: Ctx, img: Drawable | null, cx: number, cy: number, r: number) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = PINK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#e7e5f1';
  ctx.fill();
  ctx.clip();
  if (img) {
    const s = Math.max((2 * r) / img.width, (2 * r) / img.height);
    ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
  } else {
    ctx.fillStyle = '#b6b3cf';
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.18, r * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.68, r * 0.62, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
};

// ─── Report data ──────────────────────────────────────────────────────────────

interface Section {
  key: string;
  title: string;
  group: string;
  position: GeneralPosition;
  items: AdminApplication[];
}

const STATUS_ORDER: Record<ApplicationStatus, number> = { approved: 0, pending: 1, rejected: 2 };

/** One section per position (committee / office), in the dashboard order; every application exactly once. */
const buildSections = (e: AdminGeneralElection): Section[] => {
  const byPosition = new Map<string, AdminApplication[]>();
  for (const a of e.applications) {
    const list = byPosition.get(a.position_id) ?? [];
    list.push(a);
    byPosition.set(a.position_id, list);
  }
  const sections: Section[] = [];
  for (const g of groupPositions(e.positions)) {
    for (const p of g.items) {
      const items = (byPosition.get(p.id) ?? []).sort((x, y) =>
        STATUS_ORDER[x.status] - STATUS_ORDER[y.status] || x.full_name.localeCompare(y.full_name, 'ar'));
      byPosition.delete(p.id);
      // Disabled positions only appear if someone applied to them.
      if (!p.is_active && items.length === 0) continue;
      sections.push({ key: p.id, title: p.committee ? p.committee : p.title, group: g.title, position: p, items });
    }
  }
  // Applications whose position is not listed any more (safety net: nobody is left out).
  const rest = [...byPosition.values()].flat();
  if (rest.length) {
    sections.push({
      key: 'other', title: 'مناصب أخرى', group: 'مناصب أخرى', items: rest,
      position: { id: 'other', title: 'مناصب أخرى', group_key: 'other', committee: null, role: '', sort_order: 999, is_active: false,
        candidates_count: null, voters_count: null, top_votes: null, tie: null, winner_application_id: null, tie_resolved: null, candidates: [] },
    });
  }
  return sections;
};

// ─── Blocks ───────────────────────────────────────────────────────────────────

const groupTitle = (label: string): Block => ({
  h: 86,
  keepWithNext: true,
  draw: (ctx, top) => {
    roundRect(ctx, M, top, CW, 76, 22);
    ctx.fillStyle = NAVY;
    ctx.fill();
    text(ctx, label, PW - M - 34, top + 39, 900, 36, '#ffffff');
    ctx.fillStyle = PINK;
    roundRect(ctx, M + 26, top + 30, 70, 16, 8);
    ctx.fill();
  },
});

const sectionHeader = (s: Section, showVotes: boolean): Block => {
  const counts = { approved: 0, pending: 0, rejected: 0 } as Record<ApplicationStatus, number>;
  s.items.forEach(a => { counts[a.status]++; });
  return {
    h: 128,
    keepWithNext: true,
    section: s.key,
    draw: (ctx, top) => {
      roundRect(ctx, M, top, CW, 118, 24);
      ctx.fillStyle = PINK_SOFT;
      ctx.fill();
      ctx.fillStyle = CORAL;
      roundRect(ctx, PW - M - 14, top + 22, 14, 74, 7);
      ctx.fill();
      text(ctx, s.title, PW - M - 40, top + 42, 900, 38, INK);
      const sub = s.position.committee ? `المنصب: ${s.position.title}` : s.group;
      text(ctx, sub + (s.position.is_active ? '' : ' — منصب موقوف'), PW - M - 40, top + 88, 600, 24, MUTED);
      // Counters on the left.
      let x = M + 24;
      const pills: [string, string, string][] = [
        [candidatesLabel(s.items.length), NAVY, '#ffffff'],
        ...(counts.approved ? [[`${counts.approved} مقبول`, STATUS_COLOR.approved.bg, STATUS_COLOR.approved.fg] as [string, string, string]] : []),
        ...(counts.pending ? [[`${counts.pending} قيد المراجعة`, STATUS_COLOR.pending.bg, STATUS_COLOR.pending.fg] as [string, string, string]] : []),
        ...(counts.rejected ? [[`${counts.rejected} مرفوض`, STATUS_COLOR.rejected.bg, STATUS_COLOR.rejected.fg] as [string, string, string]] : []),
        ...(showVotes && s.position.voters_count !== null ? [[`${s.position.voters_count} مصوّت`, '#ffffff', NAVY] as [string, string, string]] : []),
      ];
      for (const [label, bg, fg] of pills.reverse()) {
        const w = textWidth(label, 800, 22) + 34;
        chip(ctx, label, x + w, top + 59, bg, fg, 22);
        x += w + 12;
      }
    },
  };
};

const emptySection = (): Block => ({
  h: 90,
  draw: (ctx, top) => {
    roundRect(ctx, M, top, CW, 80, 20);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, 'لا يوجد مترشحون مسجلون في هذا القسم', PW / 2, top + 40, 700, 26, MUTED, { align: 'center' });
  },
});

interface CandidateRow {
  a: AdminApplication;
  n: number;
  photo: Drawable | null;
  votes: number | null;
  winner: boolean;
}

const PHOTO_R = 92;
const INFO_RIGHT = PW - M - 40 - PHOTO_R * 2 - 40; // text column, right of the photo
const INFO_W = INFO_RIGHT - (M + 36);

/** Candidate card: number, round photo, name, position, status, details. The programme follows as its own blocks. */
const candidateCard = ({ a, n, photo, votes, winner }: CandidateRow): Block => {
  const details: [string, string, boolean?][] = [
    ['اللجنة / المنصب', a.position_title],
    ['صاحب الحساب', a.account_name ?? '—'],
    ['الهاتف', a.account_phone ?? '—', true],
    ['البريد الإلكتروني', a.account_email ?? '—', true],
    ['تاريخ الترشح', formatMrDateTime(a.created_at)],
    ...(a.reviewed_by ? [['المراجعة', `${a.reviewed_by}${a.reviewed_at ? ` — ${formatMrDateTime(a.reviewed_at)}` : ''}`] as [string, string]] : []),
    ...(a.review_note ? [['ملاحظة الإدارة', a.review_note] as [string, string]] : []),
    ...(a.photo_updated_at ? [['آخر تحديث للصورة', formatMrDateTime(a.photo_updated_at)] as [string, string]] : []),
  ];
  const labelW = 230;
  const valueW = INFO_W - labelW;
  const rows = details.map(([label, value, ltr]) => ({ label, lines: ltr ? [fit(value, 600, 24, valueW)] : wrap(value, 600, 24, valueW), ltr: !!ltr }));
  const nameLines = wrap(a.full_name, 900, 36, INFO_W - 60);
  const detailsH = rows.reduce((h, r) => h + r.lines.length * 36 + 10, 0);
  const contentH = 30 + nameLines.length * 50 + 64 + detailsH + 20;
  const h = Math.max(contentH, PHOTO_R * 2 + 90);
  return {
    h,
    keepWithNext: true, // with the start of the programme
    draw: (ctx, top) => {
      roundRect(ctx, M, top, CW, h, 28);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = winner ? '#f2c94c' : LINE;
      ctx.lineWidth = winner ? 4 : 2;
      ctx.stroke();
      // Number badge.
      const bx = PW - M - 34, by = top + 34;
      ctx.beginPath(); ctx.arc(bx - 4, by + 4, 26, 0, Math.PI * 2); ctx.fillStyle = NAVY; ctx.fill();
      text(ctx, String(n), bx - 4, by + 5, 900, 26, '#ffffff', { align: 'center' });
      // Photo.
      const pcx = PW - M - 40 - PHOTO_R, pcy = top + 40 + PHOTO_R;
      drawRoundPhoto(ctx, photo, pcx, pcy, PHOTO_R);
      // Name + status.
      let y = top + 52;
      nameLines.forEach(l => { text(ctx, l, INFO_RIGHT, y, 900, 36, INK); y += 50; });
      let xr = INFO_RIGHT;
      xr -= chip(ctx, STATUS_INFO[a.status].label, xr, y + 6, STATUS_COLOR[a.status].bg, STATUS_COLOR[a.status].fg, 22) + 12;
      if (winner) xr -= chip(ctx, 'فائز', xr, y + 6, '#f2c94c', NAVY_DEEP, 22) + 12;
      if (votes !== null) chip(ctx, `${votes} صوت`, xr, y + 6, NAVY, '#ffffff', 22);
      y += 52;
      // Details.
      for (const r of rows) {
        text(ctx, r.label, INFO_RIGHT, y + 4, 700, 22, MUTED);
        r.lines.forEach((l, i) => text(ctx, l, INFO_RIGHT - labelW, y + 4 + i * 36, 600, 24, INK, { align: 'right', ltr: r.ltr }));
        y += r.lines.length * 36 + 10;
      }
    },
  };
};

const PROGRAM_SIZE = 25;
const PROGRAM_LINE = 42;
const PROGRAM_CHUNK = 12; // lines per block: long programmes continue on the next page

/** The candidate's electoral programme, split into blocks of a few lines. */
const programBlocks = (a: AdminApplication): Block[] => {
  const lines = wrap(a.program, 600, PROGRAM_SIZE, CW - 110);
  const blocks: Block[] = [{
    h: 52,
    keepWithNext: true,
    draw: (ctx, top) => {
      roundRect(ctx, M + 30, top, CW - 30, 52, 16);
      ctx.fillStyle = ZEBRA;
      ctx.fill();
      text(ctx, 'البرنامج الانتخابي', PW - M - 30, top + 27, 800, 26, NAVY);
    },
  }];
  for (let i = 0; i < lines.length; i += PROGRAM_CHUNK) {
    const part = lines.slice(i, i + PROGRAM_CHUNK);
    const h = part.length * PROGRAM_LINE + 16;
    blocks.push({
      h,
      draw: (ctx, top) => {
        ctx.fillStyle = PINK;
        ctx.fillRect(PW - M - 8, top - GAP, 4, h + GAP);
        part.forEach((l, k) => text(ctx, l, PW - M - 30, top + 22 + k * PROGRAM_LINE, 600, PROGRAM_SIZE, '#3d3a5c'));
      },
    });
  }
  // Space after the candidate.
  blocks.push({ h: 8, draw: () => undefined });
  return blocks;
};

// ─── Pages ────────────────────────────────────────────────────────────────────

const paginate = (blocks: Block[]): Block[][] => {
  const pages: Block[][] = [[]];
  let y = CONTENT_TOP;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    let need = b.h;
    // Keep titles with the beginning of what follows them.
    // (every block is shorter than a page, so the whole next block is kept with the title).
    for (let j = i; blocks[j]?.keepWithNext && blocks[j + 1]; j++) need += GAP + blocks[j + 1].h;
    if (pages[pages.length - 1].length > 0 && y + need > CONTENT_BOTTOM) {
      pages.push([]);
      y = CONTENT_TOP;
    }
    pages[pages.length - 1].push(b);
    y += b.h + GAP;
  }
  return pages;
};

interface Meta {
  election: string;
  issuedAt: Date;
}

const drawHeader = (ctx: Ctx, meta: Meta, logo: HTMLImageElement | null) => {
  const g = ctx.createLinearGradient(0, 0, PW, 0);
  g.addColorStop(0, NAVY_DEEP);
  g.addColorStop(1, NAVY);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PW, HEADER_H);
  ctx.fillStyle = PINK;
  ctx.fillRect(0, HEADER_H, PW, 8);
  let right = PW - M;
  if (logo) {
    const lh = 104, lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, PW - M - lw, (HEADER_H - lh) / 2, lw, lh);
    right -= lw + 30;
  }
  text(ctx, 'جمعية عون وسند الخيرية', right, 64, 900, 40, '#ffffff');
  text(ctx, `تقرير المترشحين — ${meta.election}`, right, 116, 600, 26, PINK);
};

const drawFooter = (ctx: Ctx, page: number, total: number, meta: Meta) => {
  const y = PH - FOOTER_H;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(PW - M, y); ctx.stroke();
  ctx.fillStyle = PINK;
  ctx.beginPath(); ctx.arc(PW / 2, y, 9, 0, Math.PI * 2); ctx.fill();
  text(ctx, 'جمعية عون وسند الخيرية — وثيقة داخلية لإدارة الانتخابات', PW - M, y + 54, 600, 22, MUTED);
  text(ctx, `صفحة ${page} من ${total}`, M, y + 54, 800, 24, INK, { align: 'left' });
  text(ctx, `أُعدّ في ${formatMrDateTime(meta.issuedAt.toISOString())}`, PW / 2, y + 54, 600, 20, MUTED, { align: 'center' });
};

interface CoverData {
  meta: Meta;
  total: number;
  counts: Record<ApplicationStatus, number>;
  sections: { title: string; count: number; page: number; group: string }[];
  phaseLabel: string;
}

const drawCover = (ctx: Ctx, d: CoverData, logo: HTMLImageElement | null, totalPages: number) => {
  // Navy band with the association.
  const bandH = 900;
  const g = ctx.createLinearGradient(0, 0, 0, bandH);
  g.addColorStop(0, NAVY_DEEP);
  g.addColorStop(1, NAVY);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PW, bandH);
  ctx.fillStyle = 'rgba(246,180,166,0.10)';
  ctx.beginPath(); ctx.arc(PW - 60, 80, 330, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(80, bandH - 40, 240, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PINK;
  ctx.fillRect(0, bandH, PW, 14);

  if (logo) {
    const lh = 230, lw = (logo.width / logo.height) * lh;
    ctx.save();
    ctx.beginPath(); ctx.arc(PW / 2, 250, 175, 0, Math.PI * 2);
    ctx.fillStyle = NAVY; ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = PINK; ctx.stroke();
    ctx.restore();
    ctx.drawImage(logo, PW / 2 - lw / 2, 250 - lh / 2, lw, lh);
  }
  text(ctx, 'جمعية عون وسند الخيرية', PW / 2, 510, 900, 74, '#ffffff', { align: 'center' });
  text(ctx, '«عون للمحتاج وسند للضعيف»', PW / 2, 590, 700, 34, PINK, { align: 'center' });
  text(ctx, 'تقرير المترشحين', PW / 2, 700, 900, 62, '#ffffff', { align: 'center' });
  text(ctx, fit(d.meta.election, 700, 36, CW), PW / 2, 778, 700, 36, PINK, { align: 'center' });
  const issued = d.meta.issuedAt.toLocaleDateString('ar-MA', { timeZone: 'Africa/Nouakchott', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  text(ctx, `تاريخ الإعداد: ${issued}`, PW / 2, 846, 600, 28, 'rgba(255,255,255,0.85)', { align: 'center' });

  // Summary tiles.
  const tiles: [string, string, string][] = [
    [String(d.total), 'إجمالي المترشحين', NAVY],
    [String(d.counts.approved), 'مقبول', STATUS_COLOR.approved.fg],
    [String(d.counts.pending), 'قيد المراجعة', STATUS_COLOR.pending.fg],
    [String(d.counts.rejected), 'مرفوض', STATUS_COLOR.rejected.fg],
    [String(d.sections.length), 'الأقسام', CORAL],
  ];
  const tw = (CW - 4 * 20) / 5;
  tiles.forEach(([v, l, color], i) => {
    const x = PW - M - (i + 1) * tw - i * 20;
    roundRect(ctx, x, 980, tw, 150, 26);
    ctx.fillStyle = '#f6f5fb'; ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, v, x + tw / 2, 1038, 900, 54, color, { align: 'center' });
    text(ctx, l, x + tw / 2, 1098, 700, 24, MUTED, { align: 'center' });
  });
  text(ctx, `مرحلة الانتخابات عند الإعداد: ${d.phaseLabel}`, PW - M, 1180, 700, 24, MUTED);

  // Table of contents.
  text(ctx, 'فهرس الأقسام', PW - M, 1260, 900, 38, INK);
  ctx.fillStyle = CORAL;
  roundRect(ctx, PW - M - textWidth('فهرس الأقسام', 900, 38) - 30, 1250, 18, 18, 9);
  ctx.fill();
  const rowH = Math.min(56, (PH - 140 - 1310) / Math.max(1, d.sections.length));
  const size = Math.min(26, rowH * 0.5);
  d.sections.forEach((s, i) => {
    const y = 1310 + i * rowH;
    if (i % 2 === 0) { ctx.fillStyle = ZEBRA; ctx.fillRect(M, y, CW, rowH); }
    const label = `${s.title}`;
    text(ctx, label, PW - M - 24, y + rowH / 2, 700, size, INK);
    text(ctx, s.group, PW - M - 24 - textWidth(label, 700, size) - 24, y + rowH / 2, 600, size * 0.8, MUTED);
    text(ctx, candidatesLabel(s.count), M + 230, y + rowH / 2, 700, size * 0.9, s.count ? NAVY : MUTED, { align: 'center' });
    text(ctx, `ص ${s.page}`, M + 40, y + rowH / 2, 800, size, CORAL, { align: 'left' });
  });

  // Footer.
  const y = PH - FOOTER_H;
  ctx.strokeStyle = LINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(PW - M, y); ctx.stroke();
  text(ctx, 'وثيقة داخلية — تحتوي على بيانات شخصية للمترشحين، يُرجى عدم نشرها', PW - M, y + 54, 600, 22, MUTED);
  text(ctx, `صفحة 1 من ${totalPages}`, M, y + 54, 800, 24, INK, { align: 'left' });
};

// ─── Export ───────────────────────────────────────────────────────────────────

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
  Promise.race([p, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
};

const PHASE_LABELS: Record<string, string> = {
  setup: 'الإعداد', nominations_upcoming: 'قبل فتح الترشح', nominations: 'الترشح مفتوح', nominations_closed: 'انتهى الترشح',
  voting_scheduled: 'التصويت مجدول', voting: 'التصويت مفتوح', voting_closed: 'انتهى التصويت', results: 'النتائج معلنة',
};

const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Builds and downloads the candidates report of one general election (fresh data from the database). */
export const exportCandidatesPdf = async (electionId: string, onProgress?: ExportProgress) => {
  onProgress?.('جاري جلب بيانات المترشحين…');
  const e = await adminGetGeneral(electionId);
  if (!e) throw new CandidatesPdfError('تعذّر جلب بيانات الانتخابات.');
  await ensureFonts();

  const sections = buildSections(e);
  // Completeness check: every application exactly once.
  const listed = sections.flatMap(s => s.items.map(a => a.id));
  if (listed.length !== e.applications.length || new Set(listed).size !== listed.length) {
    throw new CandidatesPdfError('تعذّر تنظيم المترشحين حسب اللجان. أعد المحاولة.');
  }

  onProgress?.(`جاري تحميل صور ${e.applications.length} مترشح…`);
  const logo = await loadImage('/aoun-logo.png').catch(() => null);
  const photos = new Map<string, Drawable | null>();
  await mapLimit(e.applications, 6, async a => {
    const img = a.photo_url ? await withTimeout(loadRemoteImage(a.photo_url), 10000, null) : null;
    photos.set(a.id, img ? shrink(img) : null);
  });

  // Votes / winners are shown once voting has started (the dashboard always sees them).
  const showVotes = votingStarted(e.phase);
  const blocks: Block[] = [];
  let n = 0;
  let lastGroup = '';
  for (const s of sections) {
    if (s.group !== lastGroup) { blocks.push(groupTitle(s.group)); lastGroup = s.group; }
    blocks.push(sectionHeader(s, showVotes));
    if (s.items.length === 0) { blocks.push(emptySection()); continue; }
    for (const a of s.items) {
      n++;
      const c = s.position.candidates.find(x => x.id === a.id);
      blocks.push(candidateCard({
        a, n, photo: photos.get(a.id) ?? null,
        votes: showVotes && c ? c.votes ?? 0 : null,
        winner: e.phase === 'results' && s.position.winner_application_id === a.id,
      }));
      blocks.push(...programBlocks(a));
    }
  }

  const pages = paginate(blocks);
  const totalPages = pages.length + 1;
  const sectionPages = sections.map(s => ({
    title: s.title, group: s.group, count: s.items.length,
    page: pages.findIndex(pg => pg.some(b => b.section === s.key)) + 2,
  }));
  const counts = { approved: 0, pending: 0, rejected: 0 } as Record<ApplicationStatus, number>;
  e.applications.forEach(a => { counts[a.status]++; });
  const meta: Meta = { election: e.title, issuedAt: new Date() };

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: `تقرير المترشحين — ${e.title}`, subject: 'المترشحون حسب اللجان', creator: 'جمعية عون وسند الخيرية', author: 'لوحة التحكم' });
  const canvas = document.createElement('canvas');
  canvas.width = PW;
  canvas.height = PH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new CandidatesPdfError('المتصفح لا يدعم إنشاء الملف.');
  ctx.imageSmoothingQuality = 'high';

  const addPage = (first: boolean) => {
    if (!first) pdf.addPage('a4', 'portrait');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.86), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  };

  onProgress?.(`جاري إنشاء الصفحة 1 من ${totalPages}…`);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PW, PH);
  drawCover(ctx, { meta, total: e.applications.length, counts, sections: sectionPages, phaseLabel: PHASE_LABELS[e.phase] ?? e.phase }, logo, totalPages);
  addPage(true);
  for (let p = 0; p < pages.length; p++) {
    onProgress?.(`جاري إنشاء الصفحة ${p + 2} من ${totalPages}…`);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PW, PH);
    drawHeader(ctx, meta, logo);
    let y = CONTENT_TOP;
    for (const b of pages[p]) { b.draw(ctx, y); y += b.h + GAP; }
    drawFooter(ctx, p + 2, totalPages, meta);
    addPage(false);
    await new Promise(r => setTimeout(r, 0)); // keep the page responsive
  }
  onProgress?.('جاري حفظ الملف…');
  pdf.save(`awn-sanad-candidates-${stamp(meta.issuedAt)}.pdf`);
  return { candidates: n, sections: sections.length, pages: totalPages };
};
