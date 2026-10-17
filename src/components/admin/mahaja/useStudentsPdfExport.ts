import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { exportAllStudentsPdf, exportStudentPdf } from '../../../utils/studentsPdf';

/** Runs the PDF exports with a live progress toast; ignores clicks while one is running. */
export const useStudentsPdfExport = () => {
  const [busy, setBusy] = useState<'all' | string | null>(null);
  const running = useRef(false);

  const run = useCallback(async (key: 'all' | string, task: (progress: (m: string) => void) => Promise<string>) => {
    if (running.current) return;
    running.current = true;
    setBusy(key);
    const id = toast.loading('جاري تجهيز ملف PDF…');
    try {
      const done = await task(message => toast.loading(message, { id }));
      toast.success(done, { id });
    } catch (err) {
      console.error('Students PDF export failed', err);
      toast.error(err instanceof Error ? err.message : 'تعذّر إنشاء ملف PDF، حاول مرة أخرى', { id });
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, []);

  const exportAll = useCallback(() => run('all', async progress => {
    const count = await exportAllStudentsPdf(progress);
    return `تم تنزيل ملف PDF لجميع الطلاب (${count})`;
  }), [run]);

  const exportOne = useCallback((studentId: string) => run(studentId, async progress => {
    await exportStudentPdf(studentId, progress);
    return 'تم تنزيل ملف الطالب PDF';
  }), [run]);

  return { busy, exportAll, exportOne };
};
