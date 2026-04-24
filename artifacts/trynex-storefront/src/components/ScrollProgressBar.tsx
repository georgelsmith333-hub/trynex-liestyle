import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";

export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);
  const spring = useSpring(progress, { stiffness: 260, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
        setProgress(pct);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { spring.set(progress); }, [progress, spring]);

  return (
    <motion.div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "3px",
        zIndex: 9999,
        background: "linear-gradient(90deg, #E85D04, #FB8500, #FFC947)",
        scaleX: spring,
        transformOrigin: "0%",
        boxShadow: "0 0 12px rgba(232,93,4,0.6)",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  );
}
