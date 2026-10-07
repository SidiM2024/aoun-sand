import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileText, Loader2 } from 'lucide-react';
import type { MahajaStudent } from '../../../lib/mahajaStudents';
import { downloadStudentCardPdf, downloadStudentCardPng } from '../../../utils/studentCard';

interface Props {
  student: MahajaStudent;
  compact?: boolean;
}

/** PNG / PDF download buttons. The card is rendered from the student record passed in, so it always reflects the latest data. */
export const CardDownloadButtons = ({ student, compact = false }: Props) => {
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null);

  const run = async (format: 'png' | 'pdf') => {
    if (busy) return;
    setBusy(format);
    const toastId = toast.loading('جاري تجهيز البطاقة…');
    try {
      if (format === 'png') await downloadStudentCardPng(student);
      else await downloadStudentCardPdf(student);
      toast.success('تم تنزيل البطاقة بنجاح', { id: toastId });
    } catch (err) {
      console.error('Student card export failed', err);
      toast.error('تعذّر تنزيل البطاقة، حاول مرة أخرى', { id: toastId });
    } finally {
      setBusy(null);
    }
  };

  const base = compact
    ? 'flex-1 px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60'
    : 'px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60';

  return (
    <div className={`flex gap-2 ${compact ? 'w-full' : ''}`}>
      <button type="button" onClick={() => run('png')} disabled={!!busy} className={`${base} bg-[#262150] text-white hover:bg-[#332c6b]`} title="تنزيل البطاقة كصورة PNG">
        {busy === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PNG
      </button>
      <button type="button" onClick={() => run('pdf')} disabled={!!busy} className={`${base} bg-pink-100 text-[#262150] hover:bg-pink-200`} title="تنزيل البطاقة كملف PDF للطباعة">
        {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
      </button>
    </div>
  );
};
