import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-5 z-50 w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-110"
          style={{
            bottom: "calc(1.5rem + var(--mobile-sticky-offset, 0px) + env(safe-area-inset-bottom, 0px))",
            background: "linear-gradient(135deg, #E85D04, #FB8500)",
            boxShadow: "0 4px 16px rgba(232,93,4,0.35)",
          }}
          aria-label="Back to top"
        >
          <ChevronUp className="w-5 h-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
