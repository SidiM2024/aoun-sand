import {
  ATTENDANCE_STATUSES, CHECKOUT_STATUSES, STILL_INSIDE_LABEL, formatStudentCode, formatTime, isCheckedIn, periodLabel,
  type AttendancePeriod, type AttendanceRecord, type MahajaStudent, type ReportRow,
} from '../lib/mahajaStudents';
import { ensureFonts } from './studentCard';
import { NAVY, buildPdf, emptyLine, sectionTitle, statTiles, table, type Block, type ExportProgress } from './studentsPdf';

// Daily (per period or both periods) and weekly attendance reports, A4 PDF.
// Same look as the students archive: canvas-rendered pages, institute header, page numbers.

const ENTRY_COLORS: Record<string, string> = { present: '#059669', absent: '#dc2626', late: '#f59e0b', left_early: '#f97316', excused: '#0284c7' };
const EXIT_COLORS: Record<string, string> = { left: '#4f46e5', left_early: '#f97316' };
const UNSET = '#94a3b8';
const INSIDE = '#0f766e';

const longDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export interface PeriodCounts {
  total: number; present: number; late: number; absent: number; excused: number;
  left: number; left_early: number; inside: number; unset: number;
}

/** Live counters for one period (used on screen and in the PDF). */
export const countPeriod = (students: MahajaStudent[], records: Map<string, AttendanceRecord>): PeriodCounts => {
  const c: PeriodCounts = { total: students.length, present: 0, late: 0, absent: 0, excused: 0, left: 0, left_early: 0, inside: 0, unset: 0 };
  students.forEach(s => {
    const r = records.get(s.id);
    if (!r) { c.unset += 1; return; }
    if (r.status === 'present' || r.status === 'left_early') c.present += 1;
    else if (r.status === 'late') c.late += 1;
    else if (r.status === 'absent') c.absent += 1;
    else if (r.status === 'excused') c.excused += 1;
    const exit = r.status === 'left_early' ? 'left_early' : r.checkout_status;
    if (exit === 'left') c.left += 1;
    else if (exit === 'left_early') c.left_early += 1;
    else if (isCheckedIn(r.status)) c.inside += 1;
  });
  return c;
};

const periodBlocks = (period: AttendancePeriod, students: MahajaStudent[], records: Map<string, AttendanceRecord>, withTitle: boolean): Block[] => {
  const c = countPeriod(students, records);
  const blocks: Block[] = [];
  if (withTitle) blocks.push(sectionTitle(periodLabel(period)));
  blocks.push(statTiles([
    { label: 'حاضر', value: String(c.present), color: ENTRY_COLORS.present },
    { label: 'متأخر', value: String(c.late), color: '#b7791f' },
    { label: 'غائب', value: String(c.absent), color: ENTRY_COLORS.absent },
    { label: 'بعذر', value: String(c.excused), color: ENTRY_COLORS.excused },
    { label: 'خرج مبكرًا', value: String(c.left_early), color: EXIT_COLORS.left_early },
    { label: 'لم يُسجَّل', value: String(c.unset), color: UNSET },
  ]));
  if (students.length === 0) { blocks.push(emptyLine('لا يوجد طلاب')); return blocks; }
  blocks.push(...table(
    [
      { label: '#', width: 0.7 }, { label: 'الطالب', width: 3.4 }, { label: 'الدخول', width: 1.7 }, { label: 'وقت الدخول', width: 1.4 },
      { label: 'الخروج', width: 1.9 }, { label: 'وقت الخروج', width: 1.4 }, { label: 'المشرف', width: 2 }, { label: 'ملاحظة', width: 2.2 },
    ],
    students.map((s, i) => {
      const r = records.get(s.id);
      if (!r) {
        return { cells: [String(i + 1), `${s.full_name}\n${formatStudentCode(s)}`, 'لم يُسجَّل', '—', '—', '—', '—', '—'], chips: [null, null, UNSET, null, null, null, null, null] };
      }
      const exit = r.status === 'left_early' ? 'left_early' : r.checkout_status ?? null;
      const inside = isCheckedIn(r.status) || r.status === 'left_early';
      const exitLabel = !inside ? '—' : exit ? CHECKOUT_STATUSES.find(x => x.id === exit)!.label : STILL_INSIDE_LABEL;
      const entryLabel = r.status === 'left_early' ? 'حاضر' : ATTENDANCE_STATUSES.find(a => a.id === r.status)?.label ?? r.status;
      const who = r.checkout_by && r.checkout_by !== r.recorded_by ? `${r.recorded_by} / ${r.checkout_by}` : r.recorded_by;
      return {
        cells: [String(i + 1), `${s.full_name}\n${formatStudentCode(s)}`, entryLabel, formatTime(r.check_in_at), exitLabel, formatTime(r.check_out_at), who, r.note || '—'],
        chips: [null, null, ENTRY_COLORS[r.status === 'left_early' ? 'present' : r.status] ?? NAVY, null, inside ? (exit ? EXIT_COLORS[exit] : INSIDE) : null, null, null, null],
      };
    }),
  ));
  return blocks;
};

const byStudent = (records: AttendanceRecord[], period: AttendancePeriod) =>
  new Map(records.filter(r => (r.period ?? 'morning') === period).map(r => [r.student_id, r]));

/**
 * Daily report. `periods` = one period, or both for the full day.
 * `students` is the list shown on screen (already filtered to the supervisor's classes).
 */
export const exportDailyAttendancePdf = async (opts: {
  date: string;
  periods: AttendancePeriod[];
  students: (period: AttendancePeriod) => MahajaStudent[];
  records: AttendanceRecord[];
  scopeLabel: string;
  onProgress?: ExportProgress;
}) => {
  await ensureFonts();
  const both = opts.periods.length > 1;
  const blocks: Block[] = [];
  opts.periods.forEach(p => blocks.push(...periodBlocks(p, opts.students(p), byStudent(opts.records, p), both)));
  const title = both ? 'التقرير اليومي للحضور والغياب' : `تقرير الحضور — ${periodLabel(opts.periods[0])}`;
  const count = new Set(opts.periods.flatMap(p => opts.students(p).map(s => s.id))).size;
  await buildPdf(blocks, {
    title,
    subtitle: `${longDay(opts.date)} — ${opts.scopeLabel}`,
    totalLabel: `عدد الطلاب: ${count}`,
    issuedAt: new Date(),
  }, `Mahaja_Attendance_${opts.date}_${both ? 'day' : opts.periods[0]}.pdf`, opts.onProgress);
};

export interface WeeklyStudentStats {
  student: MahajaStudent;
  sessions: number; present: number; late: number; absent: number; excused: number; left_early: number;
  rate: number | null;
  morning: { sessions: number; attended: number; absent: number };
  evening: { sessions: number; attended: number; absent: number };
}

/** Attended = present or late. Rate = attended ÷ (sessions − excused). */
export const buildWeeklyStats = (students: MahajaStudent[], rows: ReportRow[]): WeeklyStudentStats[] => {
  const map = new Map<string, ReportRow[]>();
  rows.forEach(r => map.set(r.student_id, [...(map.get(r.student_id) ?? []), r]));
  return students.map(student => {
    const rs = map.get(student.id) ?? [];
    const sum = (k: keyof ReportRow, list = rs) => list.reduce((a, r) => a + Number(r[k] ?? 0), 0);
    const part = (p: AttendancePeriod) => {
      const l = rs.filter(r => r.period === p);
      return { sessions: sum('sessions', l), attended: sum('present', l) + sum('late', l), absent: sum('absent', l) };
    };
    const sessions = sum('sessions'), excused = sum('excused'), present = sum('present'), late = sum('late');
    const counted = sessions - excused;
    return {
      student, sessions, present, late, absent: sum('absent'), excused, left_early: sum('left_early'),
      rate: counted > 0 ? Math.round(((present + late) / counted) * 100) : null,
      morning: part('morning'), evening: part('evening'),
    };
  });
};

export const exportWeeklyAttendancePdf = async (opts: {
  from: string; to: string; stats: WeeklyStudentStats[]; scopeLabel: string; onProgress?: ExportProgress;
}) => {
  await ensureFonts();
  const s = opts.stats;
  const total = (k: 'sessions' | 'present' | 'late' | 'absent' | 'excused' | 'left_early') => s.reduce((a, x) => a + x[k], 0);
  const counted = total('sessions') - total('excused');
  const rate = counted > 0 ? `${Math.round(((total('present') + total('late')) / counted) * 100)}%` : '—';
  const blocks: Block[] = [
    sectionTitle('الإجمالي'),
    statTiles([
      { label: 'الحصص المسجلة', value: String(total('sessions')) },
      { label: 'حضور', value: String(total('present')), color: ENTRY_COLORS.present },
      { label: 'غياب', value: String(total('absent')), color: ENTRY_COLORS.absent },
      { label: 'تأخر', value: String(total('late')), color: '#b7791f' },
      { label: 'خروج مبكر', value: String(total('left_early')), color: EXIT_COLORS.left_early },
      { label: 'نسبة الحضور', value: rate, color: NAVY },
    ]),
    sectionTitle('تفاصيل الطلاب'),
  ];
  if (s.length === 0) blocks.push(emptyLine('لا يوجد طلاب'));
  else blocks.push(...table(
    [
      { label: 'الطالب', width: 3.2 }, { label: 'حضور', width: 1 }, { label: 'غياب', width: 1 }, { label: 'تأخر', width: 1 },
      { label: 'خروج مبكر', width: 1.3 }, { label: 'بعذر', width: 1 }, { label: 'النسبة', width: 1.2 },
      { label: 'الصباح', width: 1.9 }, { label: 'المساء', width: 1.9 },
    ],
    s.map(x => ({
      cells: [
        `${x.student.full_name}\n${formatStudentCode(x.student)}`, String(x.present), String(x.absent), String(x.late),
        String(x.left_early), String(x.excused), x.rate === null ? '—' : `${x.rate}%`,
        x.morning.sessions ? `حضر ${x.morning.attended} من ${x.morning.sessions}` : '—',
        x.evening.sessions ? `حضر ${x.evening.attended} من ${x.evening.sessions}` : '—',
      ],
      chips: [null, null, null, null, null, null, x.rate === null ? null : x.rate >= 80 ? '#059669' : x.rate >= 50 ? '#f59e0b' : '#dc2626', null, null],
    })),
  ));
  blocks.push(emptyLine('نسبة الحضور = (حاضر + متأخر) ÷ (الحصص المسجلة باستثناء الغياب بعذر)'));
  await buildPdf(blocks, {
    title: 'التقرير الأسبوعي للحضور والغياب',
    subtitle: `من ${longDay(opts.from)} إلى ${longDay(opts.to)} — ${opts.scopeLabel}`,
    totalLabel: `عدد الطلاب: ${s.length}`,
    issuedAt: new Date(),
  }, `Mahaja_Attendance_Week_${opts.from}_${opts.to}.pdf`, opts.onProgress);
};
