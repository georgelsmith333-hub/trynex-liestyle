import { useState, useEffect, useRef } from "react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { Flame, Megaphone, Gift, Zap, CreditCard, Award, Star, X } from "lucide-react";

const ICON_MAP = [Flame, Star, Gift, Zap, CreditCard, Award];

const DEFAULT_ANNOUNCEMENTS = [
  "Free delivery on orders above ৳1500!",
  "COD available",
  "WhatsApp: 01903426915",
];

export function AnnouncementBar() {
  const settings = useSiteSettings();
  const enabled = settings.announcementEnabled !== false;
  const autoHide = settings.announcementAutoHide === true;
  const barColor = settings.announcementColor || "#E85D04";

  const [visible, setVisible] = useState(true);
  const barRef = useRef<HTMLDivElement>(null);

  // Reset visibility whenever the bar is re-enabled or messages change so admin toggles take effect.
  useEffect(() => {
    setVisible(enabled);
  }, [enabled, settings.announcementBar]);

  // Keep the CSS layout variable in sync with whether the bar is showing.
  useEffect(() => {
    const updateHeight = () => {
      const showing = enabled && visible;
      const h = showing && barRef.current ? barRef.current.offsetHeight : 0;
      document.documentElement.style.setProperty('--announcement-height', `${h}px`);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [visible, enabled]);

  // Optional auto-hide (admin-configurable, default OFF).
  useEffect(() => {
    if (!enabled || !autoHide || !visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      document.documentElement.style.setProperty('--announcement-height', '0px');
    }, 6000);
    return () => clearTimeout(t);
  }, [visible, enabled, autoHide]);

  if (!enabled) return null;

  const announcements = settings.announcementBar
    ? settings.announcementBar.split('|').map(t => t.trim()).filter(Boolean)
    : DEFAULT_ANNOUNCEMENTS;

  const handleClose = () => {
    setVisible(false);
    document.documentElement.style.setProperty('--announcement-height', '0px');
  };

  const doubled = [...announcements, ...announcements];

  return (
    <div
      ref={barRef}
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease',
        pointerEvents: visible ? 'auto' : 'none',
        background: `linear-gradient(90deg, ${barColor}, ${barColor}cc, ${barColor})`,
        height: '36px',
      }}
    >
      <div className="overflow-hidden h-full flex items-center relative">
        <div className="animate-ticker flex items-center">
          {doubled.map((text, i) => {
            const Icon = ICON_MAP[i % ICON_MAP.length];
            return (
              <span key={i} className="flex items-center gap-2 whitespace-nowrap px-8 text-white/95 text-[13px] font-semibold">
                <Icon className="w-3.5 h-3.5 text-orange-200 shrink-0" />
                <span>{text}</span>
                <span className="mx-4 text-orange-300/40">◆</span>
              </span>
            );
          })}
        </div>
        <button
          onClick={handleClose}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/15 transition-all flex-shrink-0"
          aria-label="Close announcement"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
