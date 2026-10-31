import { formatStudentCode } from '../lib/mahajaStudents';
import { REPORT_KINDS, getFollowupsReport, reportRange, teamPeriodLabel, wirdLabel, type FollowupRecord, type ReportKind } from '../lib/mahajaTeams';
import { ensureFonts } from './studentCard';
import { NAVY, buildPdf, emptyLine, sectionTitle, statTiles, table, type Block, type ExportProgress } from './studentsPdf';

// Follow-up reports of the teams (daily, weekly, monthly, yearly), one team or all the teams,
// with the same A4 layout as the other Mahaja reports. Data fetched at export time.

const longDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const YES = '#059669';
const NO = '#dc2626';
const yesNo = (v: boolean | null | undefined) => (v === true ? 'نعم' : v === false ? 'لا' : '—');
const yesNoColor = (v: boolean | null | undefined) => (v === true ? YES : v === false ? NO : null);

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

export const exportTeamsReport = async (opts: {
  kind: ReportKind; day: string; teamId: string | null; teamLabel: string; onProgress?: ExportProgress;
}) => {
  const { from, to } = reportRange(opts.kind, opts.day);
  opts.onProgress?.('جاري جلب المتابعات…');
  const records: FollowupRecord[] = await getFollowupsReport(from, to, opts.teamId);
  await ensureFonts();

  const lines = records.flatMap(r => r.students);
  // Percentages over the lines where the question was answered.
  const memorized = lines.filter(s => s.memorized === true).length;
  const memorizedAnswered = lines.filter(s => s.memorized != null).length;
  const reviewed = lines.filter(s => s.reviewed_old === true).length;
  const reviewedAnswered = lines.filter(s => s.reviewed_old != null).length;
  const reps = lines.filter(s => typeof s.repetitions === 'number');
  const avgReps = reps.length ? (reps.reduce((a, s) => a + (s.repetitions ?? 0), 0) / reps.length).toFixed(1) : '—';
  const teams = [...new Set(records.map(r => r.team_number))];

  const blocks: Block[] = [
    sectionTitle('الملخص'),
    statTiles([
      { label: 'الفرق', value: String(teams.length) },
      { label: 'المتابعات', value: String(records.length) },
      { label: 'متابعات الطلاب', value: String(lines.length) },
      { label: 'حفظوا الورد', value: pct(memorized, memorizedAnswered), color: YES },
      { label: 'راجعوا الأحزاب', value: pct(reviewed, reviewedAnswered), color: NAVY },
      { label: 'متوسط التكرار', value: avgReps },
    ]),
  ];
  if (records.length === 0) blocks.push(emptyLine('لا توجد متابعات مسجلة في هذه الفترة'));

  for (const r of records) {
    blocks.push(sectionTitle(`الفريق ${r.team_number} — ${longDay(r.date)} — الدوام: ${teamPeriodLabel(r.period)}`));
    blocks.push(...table(
      [
        { label: '#', width: 0.6 }, { label: 'الطالب', width: 3 }, { label: 'الورد اليومي', width: 3.4 },
        { label: 'حفظ الورد', width: 1.2 }, { label: 'راجع الأحزاب', width: 1.4 }, { label: 'التكرار', width: 1 }, { label: 'ملاحظات المشرف', width: 3.2 },
      ],
      r.students.map((s, i) => ({
        cells: [
          String(i + 1),
          `${s.student_name}${s.student_number ? `\n${formatStudentCode({ student_number: s.student_number })}` : ''}`,
          wirdLabel(s), yesNo(s.memorized), yesNo(s.reviewed_old),
          typeof s.repetitions === 'number' ? String(s.repetitions) : '—', s.supervisor_note || '—',
        ],
        chips: [null, null, null, yesNoColor(s.memorized), yesNoColor(s.reviewed_old), null, null],
      })),
    ));
    const by = r.updated_by || r.recorded_by;
    if (r.note || by) blocks.push(emptyLine([r.note ? `ملاحظة عامة: ${r.note}` : '', by ? `المشرف: ${by}` : ''].filter(Boolean).join(' — ')));
  }

  const kindLabel = REPORT_KINDS.find(k => k.id === opts.kind)?.label ?? '';
  await buildPdf(blocks, {
    title: `تقرير متابعة الفرق — ${kindLabel}`,
    subtitle: `${from === to ? longDay(from) : `من ${longDay(from)} إلى ${longDay(to)}`} — ${opts.teamLabel}`,
    totalLabel: `عدد المتابعات: ${records.length}`,
    issuedAt: new Date(),
  }, `Mahaja_Teams_${opts.kind}_${from}_${to}${opts.teamId ? '_team' : ''}.pdf`, opts.onProgress);
  return records.length;
};
