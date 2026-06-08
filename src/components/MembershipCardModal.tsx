import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Printer, CreditCard, RotateCcw } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import { useMembershipCard } from '../hooks/useMembershipCard';

interface MembershipCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MembershipCardModal: React.FC<MembershipCardModalProps> = ({ isOpen, onClose }) => {
  // ── ALL HOOKS MUST BE AT TOP LEVEL (no hooks after conditional returns) ──
  const { userProfile } = useAuth();
  const { card, isLoading, isGenerating, generateCard } = useMembershipCard();
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && !isLoading && !card && !isGenerating) {
      generateCard();
    }
  }, [isOpen, isLoading, card, isGenerating, generateCard]);

  // Compute values safely (use empty strings when data not ready)
  const membershipId = userProfile?.unique_short_id || card?.card_id || '---';
  const verifyUrl = membershipId !== '---'
    ? `${window.location.origin}/verify-card/${membershipId}`
    : `${window.location.origin}/verify-card/`;
  const issueDate = card
    ? new Date(card.issue_date).toLocaleDateString('ar-SA')
    : '---';

  // ── Canvas export function (must be a regular function, not a hook) ──
  const exportCard = useCallback(async (format: 'png' | 'pdf') => {
    if (!userProfile) return;
    setIsExporting(true);
    setExportError(null);

    try {
      await document.fonts.ready;

      // Card dimensions (px at 300 DPI)
      const MM = 300 / 25.4; // px per mm at 300dpi
      const CW = Math.round(85.6 * MM);
      const CH = Math.round(53.98 * MM);
      const GAP = Math.round(5 * MM);
      const TOTAL_H = CH * 2 + GAP;

      const canvas = document.createElement('canvas');
      canvas.width = CW;
      canvas.height = TOTAL_H;
      const ctx = canvas.getContext('2d')!;

      // ── Background ──
      ctx.fillStyle = '#f0f4f8';
      ctx.fillRect(0, 0, CW, TOTAL_H);

      // ── FRONT FACE ──
      const grad = ctx.createLinearGradient(0, 0, CW, CH);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(1, '#26233f');
      ctx.fillStyle = grad;
      roundRect(ctx, 0, 0, CW, CH, MM * 3);
      ctx.fill();

      // Glow
      const glow = ctx.createRadialGradient(CW, 0, 0, CW, 0, MM * 25);
      glow.addColorStop(0, 'rgba(247,178,176,0.3)');
      glow.addColorStop(1, 'rgba(247,178,176,0)');
      ctx.fillStyle = glow;
      roundRect(ctx, 0, 0, CW, CH, MM * 3);
      ctx.fill();

      // Logo
      const logo = await loadImage(`${window.location.origin}/ABC.jpg`);
      const lx = CW - MM * 10, ly = MM * 3.5, lr = MM * 3.5;
      ctx.save();
      ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
      if (logo) ctx.drawImage(logo, lx - lr, ly - lr, lr * 2, lr * 2);
      ctx.restore();
      ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.strokeStyle = '#f7b2b0'; ctx.lineWidth = MM * 0.4; ctx.stroke();

      // Org name
      ctx.textAlign = 'right'; ctx.direction = 'rtl';
      ctx.font = `bold ${MM * 2.8}px Cairo, Arial`; ctx.fillStyle = '#f7b2b0';
      ctx.fillText('جمعية عون وسند الخيرية', CW - MM * 8, MM * 5.5);
      ctx.font = `${MM * 2}px Cairo, Arial`; ctx.fillStyle = 'rgba(199,210,254,0.8)';
      ctx.fillText('الخيرية التطوعية', CW - MM * 8, MM * 8.2);

      // Badge pill
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, MM * 3, MM * 3.5, MM * 18, MM * 5, MM * 2.5); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = MM * 0.2; ctx.stroke();
      ctx.textAlign = 'center'; ctx.font = `bold ${MM * 2}px Cairo, Arial`; ctx.fillStyle = '#fff';
      ctx.fillText('بطاقة عضوية رسمية', MM * 12, MM * 7);

      // Separator
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = MM * 0.2;
      ctx.beginPath(); ctx.moveTo(MM * 3, MM * 12); ctx.lineTo(CW - MM * 3, MM * 12); ctx.stroke();

      // Photo
      const pw = MM * 14, ph = MM * 17, px_ = CW - MM * 21, py_ = MM * 14;
      ctx.fillStyle = '#334155'; roundRect(ctx, px_, py_, pw, ph, MM * 1.5); ctx.fill();
      if (userProfile.avatar_url) {
        const av = await loadImage(userProfile.avatar_url);
        if (av) { ctx.save(); roundRect(ctx, px_, py_, pw, ph, MM * 1.5); ctx.clip(); ctx.drawImage(av, px_, py_, pw, ph); ctx.restore(); }
      } else {
        ctx.font = `bold ${MM * 6}px Cairo, Arial`; ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText(userProfile.full_name.charAt(0), px_ + pw / 2, py_ + ph * 0.65);
      }
      ctx.strokeStyle = '#f7b2b0'; ctx.lineWidth = MM * 0.5;
      roundRect(ctx, px_, py_, pw, ph, MM * 1.5); ctx.stroke();

      // QR code from the visible canvas
      const qrCanvas = qrRef.current;
      if (qrCanvas) {
        const qrSize = MM * 12;
        const qrX = px_ + (pw - qrSize) / 2;
        const qrY = MM * 33;
        ctx.fillStyle = '#fff';
        roundRect(ctx, qrX - MM * 1, qrY - MM * 1, qrSize + MM * 2, qrSize + MM * 2, MM * 1); ctx.fill();
        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
        ctx.font = `${MM * 1.5}px Cairo, Arial`; ctx.fillStyle = 'rgba(199,210,254,0.75)';
        ctx.textAlign = 'center';
        ctx.fillText('تحقق من العضوية', px_ + pw / 2, qrY + qrSize + MM * 2.5);
      }

      // User data fields
      const dx = CW - MM * 22;
      let dy = MM * 15;
      const drawField = (label: string, value: string, y: number) => {
        ctx.textAlign = 'right'; ctx.direction = 'rtl';
        ctx.font = `${MM * 1.8}px Cairo, Arial`; ctx.fillStyle = 'rgba(165,180,252,0.85)';
        ctx.fillText(label, dx, y);
        ctx.font = `bold ${MM * 2.6}px Cairo, Arial`; ctx.fillStyle = '#fff';
        ctx.fillText(value || '---', dx, y + MM * 3.5);
      };
      drawField('الاسم الكامل', userProfile.full_name, dy); dy += MM * 8.5;
      // Two-column
      ctx.font = `${MM * 1.8}px Cairo, Arial`; ctx.fillStyle = 'rgba(165,180,252,0.85)';
      ctx.textAlign = 'right'; ctx.fillText('رقم العضوية', dx, dy);
      ctx.fillText('الصفة', dx - MM * 18, dy);
      ctx.font = `bold ${MM * 2.4}px Cairo, Arial`;
      ctx.fillStyle = '#f7b2b0'; ctx.fillText(membershipId, dx, dy + MM * 3.5);
      ctx.fillStyle = '#fff'; ctx.fillText(userProfile.membership_type || '---', dx - MM * 18, dy + MM * 3.5);
      dy += MM * 8;
      ctx.font = `${MM * 1.8}px Cairo, Arial`; ctx.fillStyle = 'rgba(165,180,252,0.85)';
      ctx.fillText('تاريخ الإصدار', dx, dy);
      ctx.fillText('المدينة', dx - MM * 18, dy);
      ctx.font = `bold ${MM * 2.4}px Cairo, Arial`; ctx.fillStyle = '#fff';
      ctx.fillText(issueDate, dx, dy + MM * 3.5);
      ctx.fillText(userProfile.location || 'نواكشوط', dx - MM * 18, dy + MM * 3.5);

      // ── BACK FACE ──
      const BY = CH + GAP;
      ctx.fillStyle = '#fff';
      roundRect(ctx, 0, BY, CW, CH, MM * 3); ctx.fill();

      // Dark header
      ctx.fillStyle = '#26233f';
      ctx.fillRect(0, BY, CW, MM * 10);

      ctx.textAlign = 'right'; ctx.direction = 'rtl';
      ctx.font = `bold ${MM * 2.5}px Cairo, Arial`; ctx.fillStyle = '#f7b2b0';
      ctx.fillText('تعليمات هامة للاستخدام', CW - MM * 4, BY + MM * 6.5);

      const instructions = [
        'هذه البطاقة ملك لجمعية عون وسند الخيرية وتستخدم لإثبات العضوية.',
        'يرجى إبراز هذه البطاقة عند حضور الاجتماعات والأنشطة الرسمية.',
        'في حالة فقدان البطاقة، يرجى إبلاغ الإدارة فوراً عبر الموقع الرسمي.',
        'استخدام هذه البطاقة يخضع للوائح والقوانين الداخلية للجمعية.',
      ];
      let iy = BY + MM * 16;
      instructions.forEach(line => {
        ctx.fillStyle = '#f7b2b0'; ctx.beginPath();
        ctx.arc(CW - MM * 4.5, iy - MM * 0.7, MM * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.font = `${MM * 2}px Cairo, Arial`; ctx.fillStyle = '#334155';
        ctx.textAlign = 'right'; ctx.fillText(line, CW - MM * 6, iy);
        iy += MM * 7.8;
      });

      // Footer
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, BY + CH - MM * 6, CW, MM * 6);
      ctx.font = `${MM * 1.8}px Cairo, Arial`; ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left'; ctx.direction = 'ltr';
      ctx.fillText('Awn & Sanad Charity – Mauritania', MM * 3, BY + CH - MM * 2);
      ctx.textAlign = 'right';
      ctx.fillText('www.awnwasand.site', CW - MM * 3, BY + CH - MM * 2);

      // ── Save ──
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const safeName = (userProfile.full_name || 'member').replace(/\s+/g, '_');

      if (format === 'png') {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `Awn_Sanad_Card_${safeName}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } else {
        const W = 85.6, H = 53.98 * 2 + 5;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [W, H] });
        pdf.addImage(dataUrl, 'PNG', 0, 0, W, H);
        pdf.save(`Awn_Sanad_Card_${safeName}.pdf`);
      }
    } catch (err) {
      console.error('Export error:', err);
      setExportError('حدث خطأ أثناء التصدير، يرجى المحاولة مجدداً.');
    } finally {
      setIsExporting(false);
    }
  }, [userProfile, membershipId, issueDate]);

  // ── Guard: render nothing if not open or no user ──
  if (!isOpen || !userProfile) return null;

  return (
    <AnimatePresence>
      <div
        dir="rtl"
        style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(10px)' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          style={{ borderRadius: '28px', boxShadow: '0 30px 80px -10px rgba(0,0,0,0.5)', width: '100%', maxWidth: '520px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3" style={{ fontFamily: '"Cairo", sans-serif' }}>
              <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1e1b4b] to-[#26233f] flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 text-[#f7b2b0]" />
              </span>
              معاينة البطاقة الرسمية
            </h2>
            <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-8 bg-slate-50 dark:bg-slate-950/40">

            {isLoading || isGenerating || !card ? (
              <div className="py-16 flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-[#f7b2b0]/30 border-t-[#f7b2b0] animate-spin" />
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm" style={{ fontFamily: '"Cairo", sans-serif' }}>
                  جاري تحضير بطاقتك الرسمية…
                </p>
              </div>
            ) : (
              <>
                {/* ── 3D Flip Card ── */}
                <div
                  className="shrink-0 cursor-pointer"
                  style={{ perspective: '1000px', width: '324px', height: '204px', position: 'relative' }}
                  onClick={() => setIsFlipped(f => !f)}
                >
                  <motion.div
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.55, ease: 'easeInOut' }}
                    style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
                  >
                    {/* Front */}
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'translateZ(1px)' }}>
                      <CardFrontPreview
                        userProfile={userProfile}
                        membershipId={membershipId}
                        issueDate={issueDate}
                        verifyUrl={verifyUrl}
                        qrRef={qrRef}
                      />
                    </div>
                    {/* Back */}
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg) translateZ(1px)' }}>
                      <CardBackPreview />
                    </div>
                  </motion.div>

                  {/* Flip hint */}
                  <div
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                    style={{ position: 'absolute', bottom: '-28px', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, padding: '3px 12px', borderRadius: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', whiteSpace: 'nowrap', fontFamily: '"Cairo", sans-serif' }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    انقر للقلب
                  </div>
                </div>

                {/* Error */}
                {exportError && (
                  <div className="w-full max-w-[324px] bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-sm text-rose-600 dark:text-rose-400 font-bold" style={{ fontFamily: '"Cairo", sans-serif' }}>
                    {exportError}
                  </div>
                )}

                {/* Buttons */}
                <div className="w-full max-w-[324px] flex flex-col gap-3" style={{ fontFamily: '"Cairo", sans-serif' }}>
                  <button
                    onClick={() => exportCard('png')}
                    disabled={isExporting}
                    className="w-full py-3.5 rounded-2xl text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #26233f 100%)', boxShadow: '0 6px 24px -6px rgba(30,27,75,0.45)' }}
                  >
                    {isExporting
                      ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      : <Download className="w-4 h-4 text-[#f7b2b0]" />}
                    تنزيل البطاقة كصورة (PNG)
                  </button>

                  <button
                    onClick={() => exportCard('pdf')}
                    disabled={isExporting}
                    className="w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <Printer className="w-4 h-4" />
                    حفظ للطباعة (PDF)
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ─── Helper: roundRect polyfill ───────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Helper: load image with CORS ────────────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ─── Sub-component: Front face preview ───────────────────────────────────────
interface CardFrontPreviewProps {
  userProfile: { full_name: string; membership_type?: string; avatar_url?: string; location?: string };
  membershipId: string;
  issueDate: string;
  verifyUrl: string;
  qrRef: React.RefObject<HTMLCanvasElement>;
}

const CardFrontPreview: React.FC<CardFrontPreviewProps> = ({ userProfile, membershipId, issueDate, verifyUrl, qrRef }) => (
  <div style={{ width: '324px', height: '204px', borderRadius: '16px', overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #1e1b4b 0%, #26233f 100%)', fontFamily: '"Cairo", "Noto Sans Arabic", sans-serif', direction: 'rtl', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px -10px rgba(30,27,75,0.7)' }}>
    {/* Glow */}
    <div style={{ position: 'absolute', top: '-50px', right: '-30px', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(247,178,176,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />

    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px 9px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '20px', padding: '3px 9px' }}>
        <span style={{ fontSize: '8px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>بطاقة عضوية رسمية</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#f7b2b0', lineHeight: 1.2 }}>جمعية عون وسند</div>
          <div style={{ fontSize: '8px', color: 'rgba(199,210,254,0.8)' }}>الخيرية التطوعية</div>
        </div>
        <div style={{ width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #f7b2b0', background: '#fff', flexShrink: 0 }}>
          <img src="/ABC.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>
    </div>

    {/* Body */}
    <div style={{ flex: 1, display: 'flex', padding: '9px 13px', gap: '10px', alignItems: 'flex-start' }}>
      {/* Details */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div>
          <div style={{ fontSize: '7px', color: 'rgba(165,180,252,0.8)', marginBottom: '1px' }}>الاسم الكامل</div>
          <div style={{ fontSize: '13px', fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{userProfile.full_name}</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '7px', color: 'rgba(165,180,252,0.8)', marginBottom: '1px' }}>رقم العضوية</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#f7b2b0' }}>{membershipId}</div>
          </div>
          <div>
            <div style={{ fontSize: '7px', color: 'rgba(165,180,252,0.8)', marginBottom: '1px' }}>الصفة</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>{userProfile.membership_type || '---'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '7px', color: 'rgba(165,180,252,0.8)', marginBottom: '1px' }}>تاريخ الإصدار</div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#fff' }}>{issueDate}</div>
          </div>
          <div>
            <div style={{ fontSize: '7px', color: 'rgba(165,180,252,0.8)', marginBottom: '1px' }}>المدينة</div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#fff' }}>{userProfile.location || 'نواكشوط'}</div>
          </div>
        </div>
      </div>

      {/* Photo + QR */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
        <div style={{ width: '52px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #f7b2b0', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {userProfile.avatar_url
            ? <img src={userProfile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: '20px', fontWeight: 900, color: '#94a3b8' }}>{userProfile.full_name.charAt(0)}</span>}
        </div>
        <div style={{ background: '#fff', padding: '2px', borderRadius: '4px' }}>
          <QRCodeCanvas ref={qrRef} value={verifyUrl} size={42} level="H" />
        </div>
        <div style={{ fontSize: '6px', color: 'rgba(199,210,254,0.7)', textAlign: 'center' }}>تحقق من العضوية</div>
      </div>
    </div>
  </div>
);

// ─── Sub-component: Back face preview ────────────────────────────────────────
const CardBackPreview: React.FC = () => (
  <div style={{ width: '324px', height: '204px', borderRadius: '16px', overflow: 'hidden', background: '#fff', border: '1px solid #e2e8f0', fontFamily: '"Cairo", "Noto Sans Arabic", sans-serif', direction: 'rtl', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px -10px rgba(0,0,0,0.2)' }}>
    <div style={{ background: '#26233f', height: '38px', display: 'flex', alignItems: 'center', padding: '0 14px', flexShrink: 0 }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#f7b2b0' }}>تعليمات هامة للاستخدام</span>
    </div>
    <div style={{ flex: 1, padding: '11px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
      {[
        'هذه البطاقة ملك لجمعية عون وسند الخيرية وتستخدم لإثبات العضوية.',
        'يرجى إبراز هذه البطاقة عند حضور الاجتماعات والأنشطة الرسمية.',
        'في حالة فقدان البطاقة، يرجى إبلاغ الإدارة فوراً عبر الموقع الرسمي.',
        'استخدام هذه البطاقة يخضع للوائح والقوانين الداخلية للجمعية.',
      ].map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
          <span style={{ color: '#f7b2b0', fontSize: '9px', marginTop: '2px', flexShrink: 0 }}>●</span>
          <span style={{ fontSize: '9px', color: '#334155', lineHeight: 1.5, fontWeight: 600 }}>{t}</span>
        </div>
      ))}
    </div>
    <div style={{ background: '#f1f5f9', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0 }}>
      <span style={{ fontSize: '7px', color: '#64748b', fontWeight: 600 }}>www.awnwasand.site</span>
      <span style={{ fontSize: '7px', color: '#94a3b8' }}>Awn &amp; Sanad Charity – Mauritania</span>
    </div>
  </div>
);
