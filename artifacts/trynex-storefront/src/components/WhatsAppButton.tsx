import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { X, MessageCircle, Minus } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const DEFAULT_MESSAGE = "Hello TryNex! I'm interested in placing a custom order. Can you help me?";

export function WhatsAppButton() {
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const settings = useSiteSettings();
  const whatsappNumber = settings.whatsappNumber?.replace(/[^0-9]/g, '') || "";

  useEffect(() => {
    const timer = setTimeout(() => setMinimized(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const hasSeenTooltip = sessionStorage.getItem('trynex_wa_tooltip');
    let showTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;
    if (!hasSeenTooltip) {
      showTimer = setTimeout(() => {
        setShowTooltip(true);
        sessionStorage.setItem('trynex_wa_tooltip', '1');
        hideTimer = setTimeout(() => setShowTooltip(false), 5000);
      }, 4000);
    }
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const handleChat = () => {
    if (!whatsappNumber) return;
    const num = whatsappNumber.startsWith('88') ? whatsappNumber : `88${whatsappNumber}`;
    const url = `https://wa.me/${num}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!whatsappNumber) return null;

  if (minimized) {
    return (
      <motion.button
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setMinimized(false)}
        className="fixed left-4 z-[9998] w-12 h-12 rounded-full flex items-center justify-center shadow-md touch-target"
        style={{ background: '#25D366', bottom: 'calc(1.5rem + var(--mobile-sticky-offset, 0px) + env(safe-area-inset-bottom, 0px))' }}
        aria-label="Open WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </motion.button>
    );
  }

  return (
    <div
      className="fixed left-4 z-[9998] flex flex-col items-start gap-2"
      style={{ bottom: 'calc(1.5rem + var(--mobile-sticky-offset, 0px) + env(safe-area-inset-bottom, 0px))' }}
    >
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            className="bg-white rounded-2xl shadow-xl p-4 w-56 border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">TN</span>
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900">TryNex Support</p>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <p className="text-xs text-green-600 font-semibold">Online Now</p>
                </div>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="ml-auto -mr-1 touch-target rounded-full hover:bg-gray-100"
                aria-label="Close chat preview"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Hi! Need help with your order or a custom design? Chat with us!
            </p>
            <button
              onClick={handleChat}
              className="w-full py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
              style={{ background: '#25D366' }}
            >
              <MessageCircle className="w-4 h-4" />
              Chat on WhatsApp
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTooltip && !expanded && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.9 }}
            className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold shadow-lg whitespace-nowrap"
          >
            Need help? Chat with us!
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-gray-900 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1.5">
        <motion.button
          onClick={() => { setExpanded(!expanded); setShowTooltip(false); }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg relative"
          style={{ background: '#25D366', boxShadow: '0 4px 20px rgba(37,211,102,0.4)' }}
          aria-label="Chat on WhatsApp"
        >
          {/* Persistent pulse ring — draws attention to the chat button */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: '2.5px solid #25D366' }}
            animate={{ scale: [1, 1.65, 1], opacity: [0.55, 0, 0.55] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: '1.5px solid #25D366' }}
            animate={{ scale: [1, 2.1, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </motion.button>
        <motion.button
          onClick={() => { setExpanded(false); setMinimized(true); }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="touch-target rounded-full bg-white shadow-md border border-gray-200"
          aria-label="Minimize WhatsApp"
        >
          <Minus className="w-4 h-4 text-gray-500" />
        </motion.button>
      </div>
    </div>
  );
}
