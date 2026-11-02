import { ensureFonts } from './studentCard';
import { buildPdf, emptyLine, sectionTitle, statTiles, table, type Block, type ExportProgress } from './studentsPdf';

// PDF exports of the institute's finance (tables, records, reports), same A4 layout as the
// other Mahaja documents (institute header, page numbers, issue date).

export interface FinanceTable {
  title: string;
  columns: { label: string; width: number }[];
  rows: { cells: string[]; chips?: (string | null)[] }[];
  empty?: string;
}

export const exportFinancePdf = async (opts: {
  title: string;
  subtitle: string;
  totalLabel: string;
  tiles?: { label: string; value: string; color?: string }[];
  tables: FinanceTable[];
  footnote?: string;
  fileName: string;
  onProgress?: ExportProgress;
}) => {
  await ensureFonts();
  const blocks: Block[] = [];
  if (opts.tiles?.length) {
    blocks.push(sectionTitle('الملخص'));
    // At most 6 tiles per row (the engine's layout).
    for (let i = 0; i < opts.tiles.length; i += 6) blocks.push(statTiles(opts.tiles.slice(i, i + 6)));
  }
  for (const t of opts.tables) {
    blocks.push(sectionTitle(t.title));
    if (t.rows.length === 0) blocks.push(emptyLine(t.empty ?? 'لا توجد بيانات'));
    else blocks.push(...table(t.columns, t.rows));
  }
  if (opts.footnote) blocks.push(emptyLine(opts.footnote));
  await buildPdf(blocks, { title: opts.title, subtitle: opts.subtitle, totalLabel: opts.totalLabel, issuedAt: new Date() }, opts.fileName, opts.onProgress);
};
