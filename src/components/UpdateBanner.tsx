import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { isNewVersionAvailable } from '../lib/appUpdate';

// Shown when a newer version of the site has been deployed while this tab was open.
export const UpdateBanner = () => {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let alive = true;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      if (await isNewVersionAvailable() && alive) setAvailable(true);
    };
    const timer = window.setInterval(() => void check(), 5 * 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  if (!available || dismissed) return null;
  return (
    <div className="fixed top-3 inset-x-3 z-[200] flex justify-center pointer-events-none" dir="rtl">
      <div role="status" className="pointer-events-auto w-full max-w-md rounded-2xl bg-[#262150] text-white shadow-2xl px-4 py-3 flex items-center gap-3">
        <RefreshCw className="w-5 h-5 text-[#f4b4a8] shrink-0" />
        <p className="flex-1 text-sm font-bold leading-snug">يتوفر تحديث جديد للموقع</p>
        <button onClick={() => window.location.reload()} className="px-3 py-1.5 rounded-xl bg-[#f4b4a8] text-[#262150] text-sm font-black whitespace-nowrap">تحديث الآن</button>
        <button onClick={() => setDismissed(true)} aria-label="إغلاق" className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
};
