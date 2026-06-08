import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Printer, ShieldCheck } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
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
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  // Automatically generate card if not exists
  useEffect(() => {
    if (isOpen && !isLoading && !card && !isGenerating) {
      generateCard();
    }
  }, [isOpen, isLoading, card, isGenerating, generateCard]);

  if (!isOpen || !userProfile) return null;

  const downloadPDF = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [85.6, 53.98] // Standard CR80 ID Card size
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 53.98);
      pdf.save(`Membership_Card_${userProfile.full_name}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const downloadPNG = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `Membership_Card_${userProfile.full_name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error("Error generating PNG:", error);
    }
  };

  const printCard = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true });
      const dataUrl = canvas.toDataURL('image/png');
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Membership Card</title>
              <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }
                img { width: 85.6mm; height: 53.98mm; border-radius: 4mm; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                @media print {
                  @page { margin: 0; size: auto; }
                  body { background: none; }
                  img { box-shadow: none; }
                }
              </style>
            </head>
            <body>
              <img src="${dataUrl}" onload="window.print(); window.close();" />
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (error) {
      console.error("Error printing card:", error);
    }
  };

  const verifyUrl = card ? `${window.location.origin}/verify-card/${card.card_id}` : '';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-lg border border-slate-200 dark:border-slate-800"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[#26233f] dark:text-[#f7b2b0]" />
              البطاقة الرسمية
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 md:p-8 flex flex-col items-center">
            {isLoading || isGenerating || !card ? (
              <div className="py-20 flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-[#f7b2b0] border-t-[#26233f] rounded-full animate-spin mb-4" />
                <p className="text-slate-500 font-medium">جاري تجهيز بطاقتك...</p>
              </div>
            ) : (
              <>
                {/* 3D Card Container */}
                <div 
                  className="relative w-full max-w-[340px] aspect-[1.58/1] perspective-1000 mb-8 cursor-pointer group"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <motion.div
                    className="w-full h-full relative preserve-3d transition-transform duration-700"
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {/* --- FRONT FACE --- */}
                    <div 
                      ref={!isFlipped ? cardRef : null}
                      className="absolute inset-0 backface-hidden w-full h-full rounded-2xl overflow-hidden shadow-xl border border-slate-200 flex flex-col"
                      style={{ backfaceVisibility: 'hidden', backgroundColor: '#ffffff' }}
                    >
                      {/* Top Banner */}
                      <div className="h-16 w-full flex items-center px-4" style={{ backgroundColor: '#26233f' }}>
                         <img src="/ABC.jpg" alt="Logo" className="h-10 w-10 object-cover rounded-full border-2 border-[#f7b2b0]" crossOrigin="anonymous" />
                         <div className="ms-3 flex flex-col text-white">
                           <span className="font-bold text-[15px] leading-tight" style={{ color: '#f7b2b0' }}>جمعية عون وسند الخيرية</span>
                           <span className="text-[10px] opacity-80">بطاقة عضوية رسمية</span>
                         </div>
                      </div>

                      {/* Body */}
                      <div className="flex-1 flex px-4 py-3 relative bg-white">
                        <div className="flex-1 space-y-2 relative z-10 text-right w-full">
                          <div className="mb-2">
                            <p className="text-[10px] text-slate-400 font-bold mb-0.5">الاسم الكامل</p>
                            <p className="text-sm font-black text-[#26233f]">{userProfile.full_name}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold mb-0.5">رقم العضوية</p>
                              <p className="text-xs font-bold text-slate-700">{card.card_id}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold mb-0.5">الصفة</p>
                              <p className="text-xs font-bold text-[#f7b2b0]">{userProfile.membership_type}</p>
                            </div>
                          </div>

                           <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold mb-0.5">رقم الهوية</p>
                              <p className="text-xs font-bold text-slate-700">{userProfile.national_id || '---'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold mb-0.5">تاريخ الانضمام</p>
                              <p className="text-xs font-bold text-slate-700">{new Date(card.issue_date).toLocaleDateString('ar-SA')}</p>
                            </div>
                          </div>
                        </div>

                        {/* Right side - Profile Pic & Status */}
                        <div className="w-20 flex flex-col items-center justify-start shrink-0 ms-2">
                          <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-[#26233f] mb-2 bg-slate-100 flex justify-center items-center">
                            {userProfile.avatar_url ? (
                              <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" crossOrigin="anonymous" />
                            ) : (
                              <span className="text-xl font-bold text-slate-400">{userProfile.full_name.charAt(0)}</span>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f7b2b0]/20 text-[#26233f]">
                            {card.status}
                          </span>
                        </div>
                        
                        {/* Watermark Logo */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                           <img src="/ABC.jpg" alt="Watermark" className="w-40 h-40 object-contain grayscale" crossOrigin="anonymous" />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="h-6 w-full flex items-center justify-between px-4 text-white" style={{ backgroundColor: '#26233f' }}>
                        <span className="text-[8px]">هذه البطاقة ملك لجمعية عون وسند الخيرية</span>
                      </div>
                    </div>

                    {/* --- BACK FACE --- */}
                    <div 
                      ref={isFlipped ? cardRef : null}
                      className="absolute inset-0 backface-hidden w-full h-full rounded-2xl overflow-hidden shadow-xl border border-slate-200 flex flex-col rotate-y-180"
                      style={{ backfaceVisibility: 'hidden', backgroundColor: '#ffffff', transform: 'rotateY(180deg)' }}
                    >
                      <div className="h-10 w-full" style={{ backgroundColor: '#26233f' }}></div>
                      
                      <div className="flex-1 p-4 flex items-center justify-between">
                         <div className="w-2/3 text-right space-y-2 pr-2">
                            <h4 className="text-sm font-bold text-[#26233f] border-b border-slate-100 pb-1">تعليمات هامة</h4>
                            <ul className="text-[8px] text-slate-600 list-disc list-inside space-y-1 leading-relaxed">
                              <li>تستخدم هذه البطاقة لإثبات العضوية داخل الجمعية ولا تعتبر وثيقة رسمية حكومية.</li>
                              <li>يرجى إبراز البطاقة عند حضور الاجتماعات أو الفعاليات الخاصة بالجمعية.</li>
                              <li>في حال الفقدان، يرجى إبلاغ إدارة الجمعية فوراً لاستخراج بدل فاقد.</li>
                            </ul>
                         </div>
                         <div className="w-1/3 flex flex-col items-center justify-center">
                            <div className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                              <QRCodeCanvas value={verifyUrl} size={64} level="H" />
                            </div>
                            <p className="text-[7px] text-slate-400 mt-1 text-center font-medium leading-tight">امسح الرمز للتحقق</p>
                         </div>
                      </div>

                      <div className="h-10 w-full flex items-center justify-center px-4 relative">
                         <div className="w-full border-t border-dashed border-slate-300 absolute top-0"></div>
                         <div className="text-center w-full flex justify-between items-center px-4 opacity-70">
                           <span className="text-[10px] text-slate-800 font-bold italic font-serif">Awn & Sanad</span>
                           <span className="text-[8px] text-slate-500">{verifyUrl.replace('https://', '')}</span>
                         </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
                
                <p className="text-xs text-slate-400 mb-6 flex items-center gap-1">
                  انقر على البطاقة لقلبها
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                </p>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-3 w-full">
                  <button onClick={downloadPDF} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-[#26233f] transition-colors border border-slate-100 hover:border-indigo-100">
                    <Download className="w-5 h-5" />
                    <span className="text-xs font-bold">PDF</span>
                  </button>
                  <button onClick={downloadPNG} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-[#26233f] transition-colors border border-slate-100 hover:border-indigo-100">
                    <Download className="w-5 h-5" />
                    <span className="text-xs font-bold">صورة</span>
                  </button>
                  <button onClick={printCard} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-[#26233f] transition-colors border border-slate-100 hover:border-indigo-100">
                    <Printer className="w-5 h-5" />
                    <span className="text-xs font-bold">طباعة</span>
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
