import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, CreditCard, Calendar, Phone, Mail, MapPin, Hash, ShieldCheck, QrCode } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import QRCode from 'qrcode';

interface MembershipCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MembershipCardModal: React.FC<MembershipCardModalProps> = ({ isOpen, onClose }) => {
  const { userProfile } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [cardId, setCardId] = useState<string>('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen || !userProfile) return;

    const fetchCard = async () => {
      try {
        const { data } = await supabase
          .from('membership_cards')
          .select('*')
          .eq('user_id', userProfile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.card_id) {
          setCardId(data.card_id);
          const verifyUrl = `${window.location.origin}/verify-card/${data.card_id}`;
          const qr = await QRCode.toDataURL(verifyUrl, { width: 160, margin: 1 });
          setQrDataUrl(qr);
        } else {
          // Fallback QR using short ID
          const fallbackUrl = `${window.location.origin}/verify-card/${userProfile.unique_short_id || userProfile.id}`;
          const qr = await QRCode.toDataURL(fallbackUrl, { width: 160, margin: 1 });
          setQrDataUrl(qr);
          setCardId(userProfile.unique_short_id || userProfile.id);
        }
      } catch (err) {
        console.error('Error fetching membership card:', err);
      }
    };

    fetchCard();
  }, [isOpen, userProfile]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `membership-card-${userProfile?.unique_short_id || 'card'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (!userProfile) return null;

  const joinYear = userProfile.date_of_birth
    ? new Date(userProfile.date_of_birth).getFullYear()
    : new Date().getFullYear();

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <div className="flex justify-end mb-3">
              <button
                onClick={onClose}
                className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Card */}
            <div
              ref={cardRef}
              className="relative rounded-[1.75rem] overflow-hidden shadow-2xl select-none"
              dir="rtl"
              style={{
                background: 'linear-gradient(135deg, #26233f 0%, #3b2d6b 40%, #1e3a5f 100%)',
              }}
            >
              {/* Decorative blobs */}
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/5 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-[#f7b2b0]/10 blur-2xl pointer-events-none" />

              {/* Header */}
              <div className="relative z-10 flex items-center gap-4 px-6 pt-6 pb-5 border-b border-white/10">
                <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center border-2 border-[#f7b2b0]/50 shadow-lg shrink-0">
                  <img src="/ABC.jpg" alt="Logo" className="w-full h-full object-cover rounded-full" />
                </div>
                <div>
                  <h3 className="text-white font-black text-lg leading-tight">جمعية عون وسند الخيرية</h3>
                  <p className="text-[#f7b2b0] text-xs font-semibold mt-0.5">بطاقة العضوية الرسمية</p>
                </div>
                <div className="ms-auto">
                  <ShieldCheck className="w-6 h-6 text-[#f7b2b0]" />
                </div>
              </div>

              {/* Body */}
              <div className="relative z-10 px-6 py-5 flex gap-4">
                {/* Avatar */}
                <div className="shrink-0">
                  {userProfile.avatar_url ? (
                    <img
                      src={userProfile.avatar_url}
                      alt={userProfile.full_name}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#f7b2b0] to-rose-400 flex items-center justify-center border-2 border-white/20 shadow-lg">
                      <span className="text-white text-3xl font-black uppercase">
                        {userProfile.full_name?.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-white font-black text-xl leading-tight truncate">{userProfile.full_name}</p>

                  {userProfile.unique_short_id && (
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-[#f7b2b0]" />
                      <span className="text-[#f7b2b0] text-xs font-mono font-bold">{userProfile.unique_short_id}</span>
                    </div>
                  )}

                  {userProfile.membership_type && (
                    <div className="inline-flex items-center gap-1.5 bg-[#f7b2b0]/15 border border-[#f7b2b0]/30 text-[#f7b2b0] px-2.5 py-1 rounded-full text-xs font-bold">
                      <CreditCard className="w-3 h-3" />
                      {userProfile.membership_type}
                    </div>
                  )}

                  {userProfile.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-white/50" />
                      <span className="text-white/70 text-xs">{userProfile.phone}</span>
                    </div>
                  )}

                  {userProfile.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-white/50" />
                      <span className="text-white/70 text-xs">{userProfile.location}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* QR + Status Footer */}
              <div className="relative z-10 flex items-center justify-between gap-4 px-6 pb-6 pt-2 border-t border-white/10 mt-1">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-white/60 text-xs">سنة الانضمام: {joinYear}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${userProfile.approval_status === 'Approved' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="text-white/60 text-xs">
                      {userProfile.approval_status === 'Approved' ? 'عضو مفعّل' : userProfile.approval_status}
                    </span>
                  </div>
                </div>

                {qrDataUrl && (
                  <div className="bg-white rounded-xl p-1.5 shadow-lg">
                    <img src={qrDataUrl} alt="QR" className="w-16 h-16" />
                  </div>
                )}
              </div>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 bg-white text-slate-800 hover:bg-slate-100 font-bold rounded-2xl shadow-lg transition-colors disabled:opacity-60"
            >
              {downloading
                ? <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin" />
                : <Download className="w-5 h-5" />
              }
              {isRTL ? 'تنزيل البطاقة' : 'Download Card'}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
