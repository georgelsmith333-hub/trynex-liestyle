import { createContext, useContext } from "react";
import { useScroll, type MotionValue } from "framer-motion";

interface ScrollContextValue {
  scrollY: MotionValue<number>;
  scrollYProgress: MotionValue<number>;
}

const ScrollContext = createContext<ScrollContextValue | null>(null);

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const { scrollY, scrollYProgress } = useScroll();
  return (
    <ScrollContext.Provider value={{ scrollY, scrollYProgress }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScrollProgress(): ScrollContextValue {
  const ctx = useContext(ScrollContext);
  if (!ctx) {
    throw new Error("useScrollProgress must be used within ScrollProvider");
  }
  return ctx;
}
