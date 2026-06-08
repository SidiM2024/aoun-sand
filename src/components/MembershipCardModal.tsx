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
  const { userProfile } = useAuth();
  const { card, isLoading, isGenerating, generateCard } = useMembershipCard();
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Refs for visible card faces (used directly for canvas capture)
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const qrFrontRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && !isLoading && !card && !isGenerating) {
      generateCard();
    }
  }, [isOpen, isLoading, card, isGenerating, generateCard]);

  if (!isOpen || !userProfile) return null;

  // Use the existing unique_short_id from user profile as membership number
  const membershipId = userProfile.unique_short_id || card?.card_id || '---';
  const verifyUrl = `${window.location.origin}/verify-card/${membershipId}`;
  const issueDate = card ? new Date(card.issue_date).toLocaleDateString('ar-SA') : '---';

  // ─── Canvas-based export (reliable Arabic rendering) ─────────────────────
  const drawCardOnCanvas = useCallback(async (
    ctx: CanvasRenderingContext2D,
    face: 'front' | 'back',
    offsetY: number,
    W: number,
    H: number,
    scale: number
  ) => {
    const mm = (v: number) => v * scale;

    if (face === 'front') {
      // Background gradient
      const grad = ctx.createLinearGradient(0, offsetY, mm(W), offsetY + mm(H));
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(1, '#26233f');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(0, offsetY, mm(W), mm(H), mm(3));
      ctx.fill();

      // Subtle glow top-right
      const glowR = ctx.createRadialGradient(mm(W), offsetY, 0, mm(W), offsetY, mm(20));
      glowR.addColorStop(0, 'rgba(247,178,176,0.25)');
      glowR.addColorStop(1, 'rgba(247,178,176,0)');
      ctx.fillStyle = glowR;
      ctx.beginPath();
      ctx.roundRect(0, offsetY, mm(W), mm(H), mm(3));
      ctx.fill();

      // Header strip
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, offsetY, mm(W), mm(10));

      // Load logo
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        logo.onload = () => resolve();
        logo.onerror = () => resolve();
        logo.src = `${window.location.origin}/ABC.jpg`;
      });

      // Logo circle
      const logoX = mm(W) - mm(10);
      const logoY = offsetY + mm(3.5);
      const logoR = mm(3.5);
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.clip();
      if (logo.complete && logo.naturalWidth > 0) {
        ctx.drawImage(logo, logoX - logoR, logoY - logoR, logoR * 2, logoR * 2);
      }
      ctx.restore();

      // Logo border
      ctx.beginPath();
      ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2);
      ctx.strokeStyle = '#f7b2b0';
      ctx.lineWidth = mm(0.4);
      ctx.stroke();

      // Association name (RTL)
      ctx.textAlign = 'right';
      ctx.direction = 'rtl';
      ctx.font = `bold ${mm(2.8)}px Cairo, Arial`;
      ctx.fillStyle = '#f7b2b0';
      ctx.fillText('جمعية عون وسند الخيرية', mm(W) - mm(8.5), offsetY + mm(5.5));

      ctx.font = `${mm(2)}px Cairo, Arial`;
      ctx.fillStyle = 'rgba(199,210,254,0.8)';
      ctx.fillText('الخيرية التطوعية', mm(W) - mm(8.5), offsetY + mm(8.2));

      // "بطاقة عضوية" pill on left
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      const pillW = mm(18);
      const pillH = mm(4.5);
      const pillX = mm(3);
      const pillY = offsetY + mm(3.8);
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = mm(0.2);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = `bold ${mm(2)}px Cairo, Arial`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('بطاقة عضوية رسمية', pillX + pillW / 2, pillY + pillH * 0.68);

      // Separator line
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = mm(0.2);
      ctx.beginPath();
      ctx.moveTo(mm(3), offsetY + mm(12));
      ctx.lineTo(mm(W) - mm(3), offsetY + mm(12));
      ctx.stroke();

      // Profile photo area (right side)
      const photoX = mm(W) - mm(21);
      const photoY = offsetY + mm(14);
      const photoW = mm(14);
      const photoH = mm(17);
      const photoR = mm(1.5);

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(photoX, photoY, photoW, photoH, photoR);
      ctx.fill();

      // Load profile picture
      if (userProfile.avatar_url) {
        const avatar = new Image();
        avatar.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          avatar.onload = () => resolve();
          avatar.onerror = () => resolve();
          avatar.src = userProfile.avatar_url!;
        });
        if (avatar.complete && avatar.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(photoX, photoY, photoW, photoH, photoR);
          ctx.clip();
          ctx.drawImage(avatar, photoX, photoY, photoW, photoH);
          ctx.restore();
        }
      } else {
        // Initials fallback
        ctx.font = `bold ${mm(6)}px Cairo, Arial`;
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText(userProfile.full_name.charAt(0), photoX + photoW / 2, photoY + photoH * 0.6);
      }

      // Photo border
      ctx.strokeStyle = '#f7b2b0';
      ctx.lineWidth = mm(0.5);
      ctx.beginPath();
      ctx.roundRect(photoX, photoY, photoW, photoH, photoR);
      ctx.stroke();

      // QR Code (below photo)
      const qrCanvas = qrFrontRef.current;
      if (qrCanvas) {
        const qrSize = mm(12);
        const qrX = mm(W) - mm(21) + (mm(14) - qrSize) / 2;
        const qrY = offsetY + mm(33);
        // White background for QR
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(qrX - mm(1), qrY - mm(1), qrSize + mm(2), qrSize + mm(2), mm(1));
        ctx.fill();
        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
        ctx.font = `${mm(1.5)}px Cairo, Arial`;
        ctx.fillStyle = 'rgba(199,210,254,0.7)';
        ctx.textAlign = 'center';
        ctx.fillText('تحقق من العضوية', qrX + qrSize / 2, qrY + qrSize + mm(2.5));
      }

      // User details (left side, RTL)
      const detailX = mm(W) - mm(22);
      let detailY = offsetY + mm(15);
      const lineGap = mm(7.5);

      const drawField = (label: string, value: string, y: number) => {
        ctx.textAlign = 'right';
        ctx.font = `${mm(1.8)}px Cairo, Arial`;
        ctx.fillStyle = 'rgba(165,180,252,0.85)';
        ctx.fillText(label, detailX, y);
        ctx.font = `bold ${mm(2.6)}px Cairo, Arial`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(value, detailX, y + mm(3.5));
      };

      drawField('الاسم الكامل', userProfile.full_name || '---', detailY);
      detailY += lineGap + mm(1);

      // Two-column row
      ctx.textAlign = 'right';
      ctx.font = `${mm(1.8)}px Cairo, Arial`;
      ctx.fillStyle = 'rgba(165,180,252,0.85)';
      ctx.fillText('رقم العضوية', detailX, detailY);
      ctx.fillText('الصفة', detailX - mm(18), detailY);

      ctx.font = `bold ${mm(2.3)}px Cairo, Arial`;
      ctx.fillStyle = '#f7b2b0';
      ctx.fillText(membershipId, detailX, detailY + mm(3.5));
      ctx.fillStyle = '#ffffff';
      ctx.fillText(userProfile.membership_type || '---', detailX - mm(18), detailY + mm(3.5));
      detailY += lineGap;

      ctx.textAlign = 'right';
      ctx.font = `${mm(1.8)}px Cairo, Arial`;
      ctx.fillStyle = 'rgba(165,180,252,0.85)';
      ctx.fillText('تاريخ الإصدار', detailX, detailY);
      ctx.fillText('المدينة', detailX - mm(18), detailY);
      ctx.font = `bold ${mm(2.3)}px Cairo, Arial`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(issueDate, detailX, detailY + mm(3.5));
      ctx.fillText(userProfile.location || 'نواكشوط', detailX - mm(18), detailY + mm(3.5));

    } else {
      // ── BACK FACE ──────────────────────────────────────────────────────────
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(0, offsetY, mm(W), mm(H), mm(3));
      ctx.fill();

      // Dark header bar
      ctx.fillStyle = '#26233f';
      ctx.fillRect(0, offsetY, mm(W), mm(10));

      ctx.font = `bold ${mm(2.5)}px Cairo, Arial`;
      ctx.fillStyle = '#f7b2b0';
      ctx.textAlign = 'right';
      ctx.fillText('تعليمات هامة للاستخدام', mm(W) - mm(4), offsetY + mm(6.5));

      // Instructions
      const instructions = [
        'هذه البطاقة ملك لجمعية عون وسند الخيرية وتستخدم لإثبات العضوية.',
        'يرجى إبراز هذه البطاقة عند حضور الاجتماعات والأنشطة الرسمية.',
        'في حالة فقدان البطاقة، يرجى إبلاغ الإدارة فوراً عبر الموقع الرسمي.',
        'استخدام هذه البطاقة يخضع للوائح والقوانين الداخلية للجمعية.',
      ];

      let iy = offsetY + mm(15);
      instructions.forEach((line) => {
        // Bullet
        ctx.fillStyle = '#f7b2b0';
        ctx.beginPath();
        ctx.arc(mm(W) - mm(4.5), iy - mm(0.7), mm(0.8), 0, Math.PI * 2);
        ctx.fill();
        // Text
        ctx.font = `${mm(2)}px Cairo, Arial`;
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'right';
        ctx.fillText(line, mm(W) - mm(6), iy);
        iy += mm(7.5);
      });

      // Footer bar
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, offsetY + mm(H) - mm(6), mm(W), mm(6));

      ctx.font = `${mm(1.8)}px Cairo, Arial`;
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.fillText('Awn & Sanad Charity – Mauritania', mm(3), offsetY + mm(H) - mm(2));
      ctx.textAlign = 'right';
      ctx.fillText('www.awnwasand.site', mm(W) - mm(3), offsetY + mm(H) - mm(2));
    }
  }, [userProfile, membershipId, issueDate]);

  const exportCard = useCallback(async (format: 'png' | 'pdf') => {
    if (!userProfile) return;
    setIsExporting(true);
    setExportError(null);

    try {
      // Wait for fonts to be ready
      await document.fonts.ready;

      const CARD_W = 85.6; // mm
      const CARD_H = 53.98; // mm
      const DPI = 300;
      const PX_PER_MM = DPI / 25.4;
      const canvasW = Math.round(CARD_W * PX_PER_MM);
      const canvasH = Math.round(CARD_H * PX_PER_MM * 2) + Math.round(4 * PX_PER_MM); // both faces + 4mm gap

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Clear with white
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Draw front face
      await drawCardOnCanvas(ctx, 'front', 0, CARD_W, CARD_H, PX_PER_MM);

      // Gap between faces
      const gapY = Math.round(CARD_H * PX_PER_MM) + Math.round(4 * PX_PER_MM);

      // Draw back face
      await drawCardOnCanvas(ctx, 'back', gapY, CARD_W, CARD_H, PX_PER_MM);

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const safeName = (userProfile.full_name || 'member').replace(/\s+/g, '_');

      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `Awn_Sanad_Membership_${safeName}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [CARD_W, CARD_H * 2 + 4],
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, CARD_W, CARD_H * 2 + 4);
        pdf.save(`Awn_Sanad_Membership_${safeName}.pdf`);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      setExportError('حدث خطأ أثناء التصدير، يرجى المحاولة مجدداً.');
    } finally {
      setIsExporting(false);
    }
  }, [userProfile, drawCardOnCanvas]);

  // ─── Card Face Components (for visual preview only) ───────────────────────
  const CardFrontPreview = () => (
    <div
      style={{
        width: '324px', height: '204px',
        borderRadius: '16px', overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #26233f 100%)',
        fontFamily: '"Cairo", "Noto Sans Arabic", sans-serif',
        direction: 'rtl', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Glow */}
      <div style={{ position: 'absolute', top: '-40px', right: '-20px', width: '160px', height: '160px', background: 'radial-gradient(circle, rgba(247,178,176,0.3) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', padding: '4px 10px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.05em' }}>بطاقة عضوية رسمية</span>
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
      <div style={{ flex: 1, display: 'flex', padding: '10px 14px 10px', gap: '10px', alignItems: 'flex-start' }}>
        {/* Details */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <div>
            <div style={{ fontSize: '7px', color: 'rgba(165,180,252,0.8)', marginBottom: '1px' }}>الاسم الكامل</div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#ffffff', lineHeight: 1.2 }}>{userProfile.full_name}</div>
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '7px', color: 'rgba(165,180,252,0.8)', marginBottom: '1px' }}>رقم العضوية</div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#f7b2b0', fontFamily: 'monospace' }}>{membershipId}</div>
            </div>
            <div>
              <div style={{ fontSize: '7px', color: 'rgba(165,180,252,0.8)', marginBottom: '1px' }}>الصفة</div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#ffffff' }}>{userProfile.membership_type}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '7px', color: 'rgba(165,180,252,0.8)', marginBottom: '1px' }}>تاريخ الإصدار</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#ffffff' }}>{issueDate}</div>
            </div>
            <div>
              <div style={{ fontSize: '7px', color: 'rgba(165,180,252,0.8)', marginBottom: '1px' }}>المدينة</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#ffffff' }}>{userProfile.location || 'نواكشوط'}</div>
            </div>
          </div>
        </div>

        {/* Photo + QR */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div style={{ width: '54px', height: '62px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #f7b2b0', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {userProfile.avatar_url
              ? <img src={userProfile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '22px', fontWeight: 900, color: '#94a3b8' }}>{userProfile.full_name.charAt(0)}</span>
            }
          </div>
          <div style={{ background: '#ffffff', padding: '3px', borderRadius: '5px' }}>
            <QRCodeCanvas ref={qrFrontRef} value={verifyUrl} size={44} level="H" />
          </div>
          <div style={{ fontSize: '6px', color: 'rgba(199,210,254,0.7)', textAlign: 'center' }}>تحقق من العضوية</div>
        </div>
      </div>
    </div>
  );

  const CardBackPreview = () => (
    <div
      style={{
        width: '324px', height: '204px',
        borderRadius: '16px', overflow: 'hidden', position: 'relative',
        background: '#ffffff', border: '1px solid #e2e8f0',
        fontFamily: '"Cairo", "Noto Sans Arabic", sans-serif',
        direction: 'rtl', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ background: '#26233f', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#f7b2b0' }}>تعليمات هامة للاستخدام</span>
      </div>

      {/* Instructions */}
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '7px' }}>
        {[
          'هذه البطاقة ملك لجمعية عون وسند الخيرية وتستخدم لإثبات العضوية.',
          'يرجى إبراز هذه البطاقة عند حضور الاجتماعات والأنشطة الرسمية.',
          'في حالة فقدان البطاقة، يرجى إبلاغ الإدارة فوراً عبر الموقع الرسمي.',
          'استخدام هذه البطاقة يخضع للوائح والقوانين الداخلية للجمعية.',
        ].map((text, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
            <span style={{ color: '#f7b2b0', fontSize: '10px', marginTop: '1px', flexShrink: 0 }}>●</span>
            <span style={{ fontSize: '9px', color: '#334155', lineHeight: 1.5, fontWeight: 600 }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ background: '#f1f5f9', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0 }}>
        <span style={{ fontSize: '7px', color: '#64748b', fontWeight: 600 }}>www.awnwasand.site</span>
        <span style={{ fontSize: '7px', color: '#94a3b8' }}>Awn &amp; Sanad Charity – Mauritania</span>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)' }} dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          style={{ background: 'var(--modal-bg, #ffffff)', borderRadius: '28px', boxShadow: '0 25px 60px -15px rgba(0,0,0,0.5)', width: '100%', maxWidth: '520px', overflow: 'hidden', border: '1px solid rgba(226,232,240,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}
          className="dark:[--modal-bg:#0f172a]"
        >
          {/* Modal Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(226,232,240,0.7)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: '"Cairo", sans-serif', margin: 0 }}
                className="dark:text-white">
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #1e1b4b, #26233f)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard style={{ width: '18px', height: '18px', color: '#f7b2b0' }} />
              </div>
              معاينة البطاقة الرسمية
            </h2>
            <button onClick={onClose} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'rgba(148,163,184,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
              <X style={{ width: '20px', height: '20px', color: '#64748b' }} />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', background: '#f8fafc' }} className="dark:bg-slate-950/40">
            {isLoading || isGenerating || !card ? (
              <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', border: '4px solid rgba(247,178,176,0.3)', borderTopColor: '#f7b2b0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#64748b', fontFamily: '"Cairo", sans-serif' }}>جاري تحضير بطاقتك الرسمية...</p>
              </div>
            ) : (
              <>
                {/* 3D Flip Container */}
                <div
                  style={{ position: 'relative', width: '324px', height: '204px', cursor: 'pointer', perspective: '1000px' }}
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <motion.div
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                    style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
                  >
                    {/* Front */}
                    <div ref={frontRef} style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '16px', boxShadow: '0 20px 50px -10px rgba(30,27,75,0.6)', transform: 'translateZ(1px)' }}>
                      <CardFrontPreview />
                    </div>
                    {/* Back */}
                    <div ref={backRef} style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '16px', boxShadow: '0 20px 50px -10px rgba(0,0,0,0.25)', transform: 'rotateY(180deg) translateZ(1px)' }}>
                      <CardBackPreview />
                    </div>
                  </motion.div>

                  {/* Flip hint */}
                  <div style={{ position: 'absolute', bottom: '-30px', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', fontWeight: 600, fontFamily: '"Cairo", sans-serif', background: 'white', padding: '4px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', whiteSpace: 'nowrap' }}
                       className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                    <RotateCcw style={{ width: '12px', height: '12px' }} />
                    انقر للقلب
                  </div>
                </div>

                {/* Error message */}
                {exportError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#dc2626', fontFamily: '"Cairo", sans-serif' }}>
                    {exportError}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ width: '100%', maxWidth: '324px', display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: '"Cairo", sans-serif' }}>
                  <button
                    onClick={() => exportCard('png')}
                    disabled={isExporting}
                    style={{ width: '100%', padding: '14px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #1e1b4b 0%, #26233f 100%)', color: '#ffffff', fontSize: '15px', fontWeight: 700, cursor: isExporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isExporting ? 0.7 : 1, transition: 'opacity 0.2s', fontFamily: '"Cairo", sans-serif', boxShadow: '0 6px 20px -4px rgba(30,27,75,0.4)' }}
                  >
                    {isExporting
                      ? <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      : <Download style={{ width: '18px', height: '18px', color: '#f7b2b0' }} />
                    }
                    تنزيل البطاقة كصورة (PNG)
                  </button>

                  <button
                    onClick={() => exportCard('pdf')}
                    disabled={isExporting}
                    style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '2px solid #e2e8f0', background: '#ffffff', color: '#1e293b', fontSize: '15px', fontWeight: 700, cursor: isExporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isExporting ? 0.7 : 1, transition: 'opacity 0.2s', fontFamily: '"Cairo", sans-serif' }}
                    className="dark:bg-slate-800 dark:text-white dark:border-slate-700"
                  >
                    <Printer style={{ width: '18px', height: '18px' }} />
                    حفظ للطباعة (PDF)
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Spin animation */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </AnimatePresence>
  );
};
