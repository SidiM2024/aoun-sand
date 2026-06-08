import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Printer, ShieldCheck, CreditCard } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../../contexts/AuthContext';
import { useMembershipCard } from '../../hooks/useMembershipCard';

interface MembershipCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MembershipCardModal: React.FC<MembershipCardModalProps> = ({ isOpen, onClose }) => {
  const { userProfile } = useAuth();
  const { card, isLoading, isGenerating, generateCard } = useMembershipCard();
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !isLoading && !card && !isGenerating) {
      generateCard();
    }
  }, [isOpen, isLoading, card, isGenerating, generateCard]);

  if (!isOpen || !userProfile) return null;

  const verifyUrl = card ? `${window.location.origin}/verify-card/${card.card_id}` : '';

  // The content of the Front Face (used in both Preview and Export)
  const CardFront = () => (
    <div 
      className="w-[85.6mm] h-[53.98mm] rounded-2xl overflow-hidden shadow-2xl relative flex"
      style={{ 
        background: 'linear-gradient(135deg, #1e1b4b 0%, #26233f 100%)',
        fontFamily: '"Cairo", sans-serif',
        direction: 'rtl'
      }}
    >
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#f7b2b0] rounded-full blur-[80px] opacity-20 pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500 rounded-full blur-[80px] opacity-20 pointer-events-none translate-y-1/3 -translate-x-1/3"></div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4 relative z-10 text-white w-full">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white rounded-full p-0.5 shadow-md flex items-center justify-center">
               <img src="/ABC.jpg" alt="Logo" className="w-full h-full object-cover rounded-full" crossOrigin="anonymous" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wide text-[#f7b2b0] leading-tight">جمعية عون وسند</h2>
              <p className="text-[9px] text-indigo-200 font-medium tracking-wider">الخيرية التطوعية</p>
            </div>
          </div>
          <div className="text-left bg-white/10 px-3 py-1 rounded-full border border-white/20 backdrop-blur-md">
            <p className="text-[9px] font-bold text-white tracking-widest">بطاقة عضوية</p>
          </div>
        </div>

        {/* Body Container */}
        <div className="flex justify-between items-start flex-1 mt-1">
          
          {/* User Details */}
          <div className="space-y-2.5 flex-1 pl-2">
            <div>
              <p className="text-[8px] text-indigo-300 mb-0.5">الاسم الكامل</p>
              <p className="text-sm font-black text-white leading-tight">{userProfile.full_name}</p>
            </div>
            
            <div className="flex gap-4">
              <div>
                <p className="text-[8px] text-indigo-300 mb-0.5">رقم العضوية</p>
                <p className="text-xs font-bold text-[#f7b2b0] tracking-wider">{card?.card_id}</p>
              </div>
              <div>
                <p className="text-[8px] text-indigo-300 mb-0.5">الصفة</p>
                <p className="text-xs font-bold text-white">{userProfile.membership_type}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div>
                <p className="text-[8px] text-indigo-300 mb-0.5">تاريخ الإصدار</p>
                <p className="text-[10px] font-bold text-white">
                  {card ? new Date(card.issue_date).toLocaleDateString('ar-SA') : '---'}
                </p>
              </div>
              <div>
                <p className="text-[8px] text-indigo-300 mb-0.5">المدينة</p>
                <p className="text-[10px] font-bold text-white">{userProfile.location || 'نواكشوط'}</p>
              </div>
            </div>
          </div>

          {/* Profile Pic & QR Code Area */}
          <div className="flex flex-col items-center gap-2">
            {/* Profile Picture */}
            <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden border-2 border-[#f7b2b0] shadow-lg flex items-center justify-center shrink-0">
              {userProfile.avatar_url ? (
                <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" crossOrigin="anonymous" />
              ) : (
                <span className="text-xl font-bold text-slate-800">{userProfile.full_name.charAt(0)}</span>
              )}
            </div>

            {/* QR Code */}
            <div className="bg-white p-1 rounded-lg shadow-md shrink-0">
               <QRCodeCanvas value={verifyUrl} size={48} level="H" />
            </div>
          </div>

        </div>

      </div>
    </div>
  );

  // The content of the Back Face (used in both Preview and Export)
  const CardBack = () => (
    <div 
      className="w-[85.6mm] h-[53.98mm] rounded-2xl overflow-hidden shadow-2xl relative bg-white border border-slate-200 flex flex-col"
      style={{ 
        fontFamily: '"Cairo", sans-serif',
        direction: 'rtl'
      }}
    >
      {/* Header Bar */}
      <div className="h-10 w-full bg-[#26233f] flex items-center px-4 relative overflow-hidden shrink-0">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
         <span className="text-xs font-bold text-[#f7b2b0] relative z-10">تعليمات هامة / Important Instructions</span>
      </div>
      
      {/* Body */}
      <div className="flex-1 p-5 flex flex-col justify-center relative">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
            <ShieldCheck className="w-40 h-40 text-slate-900" />
         </div>
         
         <ul className="text-[10px] text-slate-700 space-y-2 leading-relaxed font-semibold relative z-10 pr-4 list-disc marker:text-[#f7b2b0]">
           <li>هذه البطاقة ملك لجمعية عون وسند الخيرية وتستخدم لإثبات عضوية حاملها.</li>
           <li>يرجى إبراز هذه البطاقة عند حضور الاجتماعات والأنشطة الرسمية.</li>
           <li>في حالة فقدان البطاقة، يرجى إبلاغ الإدارة فوراً عبر الموقع الإلكتروني.</li>
           <li>استخدام هذه البطاقة يخضع للوائح والقوانين الداخلية للجمعية.</li>
         </ul>

         {/* Official Stamp / Signature Area */}
         <div className="absolute bottom-4 left-6 text-center">
            <p className="text-[10px] font-black text-[#26233f] mb-1">الختم الرسمي</p>
            <div className="w-16 h-16 rounded-full border-4 border-dashed border-[#f7b2b0]/40 flex items-center justify-center rotate-12 opacity-80">
              <span className="text-[8px] font-black text-[#26233f] -rotate-12">عون وسند</span>
            </div>
         </div>
      </div>

      {/* Footer Bar */}
      <div className="h-5 w-full bg-slate-100 flex items-center justify-between px-4 shrink-0">
         <span className="text-[7px] text-slate-500 font-bold">Awn & Sanad Charity - Mauritania</span>
         <span className="text-[7px] text-slate-400 font-medium">www.awnwasand.site</span>
      </div>
    </div>
  );

  const exportCards = async (format: 'pdf' | 'png') => {
    if (!exportRef.current || !card || !userProfile) return;
    setIsExporting(true);
    
    try {
      // The export container has front and back rendered normally, top-to-bottom.
      // We will capture it.
      const canvas = await html2canvas(exportRef.current, { 
        scale: 3, // High quality
        useCORS: true,
        backgroundColor: null, // Transparent
      });
      
      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `Awn_Sanad_Membership_${userProfile.full_name}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      } else if (format === 'pdf') {
        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Single PDF page containing both faces
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [85.6, 107.96] // 53.98 * 2 height
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 107.96);
        pdf.save(`Awn_Sanad_Membership_${userProfile.full_name}.pdf`);
      }
    } catch (error) {
      console.error(`Error generating ${format}:`, error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3 font-[Cairo]">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <CreditCard className="w-5 h-5" />
              </div>
              معاينة البطاقة الرسمية
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 md:p-8 flex-1 overflow-y-auto flex flex-col items-center bg-slate-50 dark:bg-slate-950/50">
            {isLoading || isGenerating || !card ? (
              <div className="py-20 flex flex-col items-center">
                <div className="w-14 h-14 border-4 border-[#f7b2b0] border-t-[#26233f] rounded-full animate-spin mb-4 shadow-lg" />
                <p className="text-slate-500 font-bold font-[Cairo]">جاري إنشاء بطاقتك الرسمية...</p>
              </div>
            ) : (
              <>
                {/* 3D Preview Card Container */}
                <div 
                  className="relative w-[340px] aspect-[1.58/1] perspective-1000 mb-10 cursor-pointer group shrink-0"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <motion.div
                    className="w-full h-full relative preserve-3d transition-transform duration-700 ease-out"
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {/* Front Face (Preview) */}
                    <div 
                      className="absolute inset-0 backface-hidden w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] transition-shadow"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <div className="transform scale-[1.01] origin-top-left w-[85.6mm] h-[53.98mm]">
                         <CardFront />
                      </div>
                    </div>

                    {/* Back Face (Preview) */}
                    <div 
                      className="absolute inset-0 backface-hidden w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col rotate-y-180 group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] transition-shadow"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <div className="transform scale-[1.01] origin-top-left w-[85.6mm] h-[53.98mm]">
                        <CardBack />
                      </div>
                    </div>
                  </motion.div>
                  
                  {/* Flip Hint */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-sm text-slate-500 font-bold font-[Cairo] bg-white dark:bg-slate-800 px-4 py-1.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                    <svg className="w-4 h-4 text-[#f7b2b0]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                    انقر للقلب
                  </div>
                </div>

                {/* Actions */}
                <div className="w-full max-w-[340px] flex flex-col gap-3 font-[Cairo]">
                  <button 
                    onClick={() => exportCards('png')} 
                    disabled={isExporting}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#1e1b4b] to-[#26233f] hover:from-[#26233f] hover:to-[#3b3659] text-white font-bold text-base transition-all shadow-lg hover:shadow-xl disabled:opacity-70"
                  >
                    {isExporting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Download className="w-5 h-5 text-[#f7b2b0]" />
                    )}
                    <span>تنزيل البطاقة كصورة (PNG)</span>
                  </button>
                  
                  <button 
                    onClick={() => exportCards('pdf')} 
                    disabled={isExporting}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-base transition-all border-2 border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-70"
                  >
                    <Printer className="w-5 h-5" />
                    <span>حفظ للطباعة (PDF)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* --- HIDDEN EXPORT CONTAINER --- */}
        {/* Rendered strictly for html2canvas to capture both faces cleanly without 3D CSS interfering with RTL */}
        {card && userProfile && (
          <div className="absolute top-0 left-0 -z-50 opacity-0 pointer-events-none" style={{ position: 'fixed', left: '-9999px' }}>
            <div ref={exportRef} className="flex flex-col gap-0 bg-transparent">
               <CardFront />
               {/* Add a tiny gap or line between them if needed, but PDF format works best flush or split */}
               <CardBack />
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};
