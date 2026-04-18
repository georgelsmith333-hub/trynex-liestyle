import { useEffect } from "react";
import Lenis from "lenis";

let lenisInstance: Lenis | null = null;
let rafId: number | null = null;

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function useLenis() {
  useEffect(() => {
    if (lenisInstance) return;

    if (isTouchDevice()) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    lenisInstance = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    });

    function raf(time: number) {
      lenisInstance?.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lenisInstance?.destroy();
      lenisInstance = null;
    };
  }, []);
}
