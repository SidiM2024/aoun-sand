import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { AlertCircle, Copy, Download, Image as ImageIcon, Link2, Loader2, RefreshCw, Share2, X } from 'lucide-react';
import { candidateShareLinks } from '../../lib/generalElections';
import { cardImageFileName, renderCandidateCardImage } from '../../lib/candidateCardImage';

// Sheet to share a candidate's card as a picture. The picture is prepared as soon as the sheet
// opens, so the share button hands it to the phone's share menu (WhatsApp, Telegram…) right
// away. Without file sharing in the browser: download the picture, or share the card's link.

export const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47a9.4 9.4 0 0 1 6.7 2.78 9.41 9.41 0 0 1 2.77 6.7c0 5.23-4.25 9.46-9.47 9.46zm8.06-17.53A11.33 11.33 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2 .52 3.96 1.52 5.69L.55 23.6l6.04-1.58a11.36 11.36 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.19-5.9-3.33-8.05z" />
  </svg>
);
export const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
    <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.27h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
  </svg>
);
export const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
    <path d="M12.21 1.5c1.2 0 4.35.33 5.83 3.64.5 1.11.38 3 .29 4.52l-.01.21c.08.05.22.1.43.1.31-.02.68-.12 1.08-.31.12-.06.25-.07.34-.07.15 0 .3.03.42.07.36.13.58.38.58.66.01.36-.31.67-.96.92-.07.03-.15.05-.25.08-.35.11-.88.28-1.02.62-.08.17-.05.4.08.67l.01.01c.04.1 1.13 2.57 3.55 2.97.19.03.32.2.31.38 0 .05-.01.11-.04.16-.18.42-.94.74-2.32.95-.05.06-.09.27-.12.41-.03.13-.06.27-.1.41-.06.2-.2.3-.41.3h-.02c-.1 0-.23-.02-.4-.05a4.79 4.79 0 0 0-.94-.1c-.22 0-.45.01-.68.05-.45.08-.84.35-1.29.66-.64.45-1.37.96-2.47.96h-.12c-1.1 0-1.82-.51-2.46-.96-.45-.31-.83-.58-1.29-.66a4.02 4.02 0 0 0-.68-.05c-.4 0-.71.06-.94.11-.15.03-.29.05-.4.05-.29 0-.4-.18-.44-.32-.04-.14-.07-.28-.1-.42-.03-.14-.07-.36-.12-.41-1.47-.23-2.25-.55-2.42-.97a.37.37 0 0 1-.03-.15.37.37 0 0 1 .31-.38c2.42-.4 3.51-2.87 3.55-2.98l.01-.01c.14-.27.17-.5.08-.67-.14-.34-.67-.51-1.02-.62a2.3 2.3 0 0 1-.25-.08c-.89-.35-1.01-.75-.96-1.02.07-.38.53-.62.92-.62.11 0 .21.02.29.06.45.21.85.32 1.19.32.25 0 .41-.06.5-.11l-.03-.48c-.1-1.52-.22-3.41.28-4.52C7.84 1.84 10.98 1.51 12.17 1.5h.04z" />
  </svg>
);

export interface ShareCardTarget {
  id: string;
  fullName: string;
  photoUrl: string | null;
  positionTitle: string;
  program: string | null;
  electionTitle: string;
}

type Status = 'loading' | 'ready' | 'error';

export const ShareCardSheet = ({ card, onClose, render, fileName, heading, shareText }: {
  card: ShareCardTarget;
  onClose: () => void;
  /** Other picture (e.g. results card); default: the candidate's card. */
  render?: (url: string) => Promise<Blob>;
  fileName?: string;
  heading?: string;
  shareText?: string;
}) => {
  const links = candidateShareLinks(card.fullName, card.positionTitle, card.id);
  const [status, setStatus] = useState<Status>('loading');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const previewRef = useRef<string | null>(null);

  const canShareFiles = !!file && typeof navigator.canShare === 'function' && (() => {
    try { return navigator.canShare({ files: [file] }); } catch { return false; }
  })();

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    (render ? render(links.url) : renderCandidateCardImage({ ...card, url: links.url }))
      .then(blob => {
        if (!alive) return;
        const f = new File([blob], fileName ?? cardImageFileName(card.id), { type: blob.type || 'image/jpeg' });
        const u = URL.createObjectURL(blob);
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = u;
        setFile(f); setPreview(u); setStatus('ready');
      })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, attempt]);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = useCallback(() => {
    if (!file || !preview) return;
    const a = document.createElement('a');
    a.href = preview;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success('تم تنزيل صورة البطاقة');
  }, [file, preview]);

  const shareImage = async () => {
    if (!file) return;
    if (!canShareFiles) { download(); return; }
    setSharing(true);
    try {
      await navigator.share({ files: [file], title: card.fullName, text: `${shareText ?? links.text}\n${links.url}` });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name !== 'AbortError') {
        toast.error('تعذّرت المشاركة المباشرة، فنزّلنا الصورة لتشاركها يدويًا.');
        download();
      }
    } finally { setSharing(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(links.url); toast.success('تم نسخ رابط البطاقة'); }
    catch { toast.error('تعذّر النسخ، انسخ الرابط يدويًا: ' + links.url); }
  };
  const shareLink = async () => {
    if (!navigator.share) { void copyLink(); return; }
    try { await navigator.share({ title: card.fullName, text: links.text, url: links.url }); }
    catch (err) { if ((err as DOMException)?.name !== 'AbortError') void copyLink(); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm" onClick={onClose} dir="rtl">
      <div onClick={ev => ev.stopPropagation()} role="dialog" aria-modal="true" aria-label="مشاركة بطاقة المترشح"
        className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-[28px] p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-lg text-[#262150] dark:text-white flex items-center gap-2"><ImageIcon className="w-5 h-5 text-[#e2706a]" /> {heading ?? 'مشاركة بطاقة المترشح'}</h3>
          <button onClick={onClose} aria-label="إغلاق" className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>

        <div className="mx-auto w-full max-w-[260px] aspect-[4/5] rounded-2xl overflow-hidden bg-[#262150] flex items-center justify-center shadow-lg">
          {status === 'loading' && <span className="flex flex-col items-center gap-2 text-white/80 text-sm font-bold"><Loader2 className="w-8 h-8 animate-spin text-[#f4b4a8]" /> جارٍ تجهيز صورة البطاقة…</span>}
          {status === 'ready' && preview && <img src={preview} alt={`صورة بطاقة ${card.fullName}`} className="w-full h-full object-contain" />}
          {status === 'error' && (
            <span className="flex flex-col items-center gap-2 text-white/90 text-sm font-bold text-center px-4">
              <AlertCircle className="w-8 h-8 text-[#f4b4a8]" /> تعذّر تجهيز الصورة
              <button onClick={() => setAttempt(a => a + 1)} className="mt-1 px-4 py-2 rounded-xl bg-white/10 flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> إعادة المحاولة</button>
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <button onClick={() => void shareImage()} disabled={status !== 'ready' || sharing}
            className="w-full py-3.5 rounded-2xl bg-[#e2706a] text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
            {sharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
            {canShareFiles || status !== 'ready' ? 'مشاركة صورة البطاقة' : 'تنزيل صورة البطاقة'}
          </button>
          {canShareFiles && (
            <button onClick={download} disabled={status !== 'ready'}
              className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[#262150] dark:text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              <Download className="w-5 h-5" /> تنزيل الصورة
            </button>
          )}
          {status === 'ready' && !canShareFiles && (
            <p className="text-xs text-slate-500 text-center leading-relaxed">متصفحك لا يدعم مشاركة الصور مباشرة: نزّل الصورة ثم أرسلها من التطبيق، أو شارك رابط البطاقة.</p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5"><Link2 className="w-4 h-4" /> أو شارك رابط البطاقة</p>
          <div className="grid grid-cols-5 gap-2">
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="مشاركة الرابط على واتساب" title="واتساب"
              className="h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center"><WhatsAppIcon /></a>
            <a href={links.facebook} target="_blank" rel="noopener noreferrer" aria-label="مشاركة الرابط على فيسبوك" title="فيسبوك"
              className="h-12 rounded-2xl bg-[#1877F2] text-white flex items-center justify-center"><FacebookIcon /></a>
            <a href={links.snapchat} target="_blank" rel="noopener noreferrer" aria-label="مشاركة الرابط على سناب شات" title="سناب شات"
              className="h-12 rounded-2xl bg-[#FFFC00] text-black flex items-center justify-center"><SnapchatIcon /></a>
            <button onClick={() => void copyLink()} aria-label="نسخ الرابط" title="نسخ الرابط"
              className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[#262150] dark:text-white flex items-center justify-center"><Copy className="w-5 h-5" /></button>
            <button onClick={() => void shareLink()} aria-label="مشاركة الرابط" title="مشاركة الرابط"
              className="h-12 rounded-2xl bg-[#262150] text-[#f4b4a8] flex items-center justify-center"><Share2 className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
