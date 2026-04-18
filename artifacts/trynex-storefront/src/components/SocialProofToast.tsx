import { useState, useEffect } from "react";
import { ShoppingBag, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BD_DISTRICTS = [
  "Dhaka", "Chittagong", "Rajshahi", "Sylhet", "Khulna", "Rangpur",
  "Gazipur", "Narayanganj", "Comilla", "Cox's Bazar", "Mymensingh",
  "Barisal", "Bogra", "Jessore", "Dinajpur", "Tangail",
];

const PRODUCTS = [
  "Custom T-Shirt", "Premium Hoodie", "Oversized Tee", "Custom Mug",
  "Graphic Tee", "Polo Shirt", "Custom Cap", "Sweatshirt",
];

const TIMES = ["2 minutes ago", "5 minutes ago", "just now", "8 minutes ago", "12 minutes ago", "3 minutes ago"];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function SocialProofToast() {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState({ district: "", product: "", time: "" });

  useEffect(() => {
    const showToast = () => {
      setData({
        district: getRandomItem(BD_DISTRICTS),
        product: getRandomItem(PRODUCTS),
        time: getRandomItem(TIMES),
      });
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    };

    const initialDelay = setTimeout(showToast, 15000);
    const interval = setInterval(showToast, 30000 + Math.random() * 20000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -100, y: 20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-6 left-5 z-50 max-w-[280px] sm:max-w-xs"
        >
          <div
            className="flex items-start gap-3 p-3.5 rounded-2xl backdrop-blur-xl"
            style={{
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(232,93,4,0.12)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(232,93,4,0.08)' }}>
              <ShoppingBag className="w-4 h-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800 leading-snug">
                Someone from <span className="text-orange-600 inline-flex items-center gap-0.5"><MapPin className="w-3 h-3 inline" />{data.district}</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                purchased <strong className="text-gray-700">{data.product}</strong>
              </p>
              <p className="text-[10px] text-gray-400 mt-1">{data.time}</p>
            </div>
            <button
              onClick={() => setVisible(false)}
              className="text-gray-300 hover:text-gray-500 text-xs mt-0.5 shrink-0"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
