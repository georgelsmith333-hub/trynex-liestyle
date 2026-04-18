import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { motion } from "framer-motion";
import { Ruler, Shirt, Info } from "lucide-react";

const TSHIRT_SIZES = [
  { size: "S", chest: "36", length: "27", shoulder: "16.5" },
  { size: "M", chest: "38", length: "28", shoulder: "17.5" },
  { size: "L", chest: "40", length: "29", shoulder: "18.5" },
  { size: "XL", chest: "42", length: "30", shoulder: "19.5" },
  { size: "2XL", chest: "44", length: "31", shoulder: "20.5" },
  { size: "3XL", chest: "46", length: "32", shoulder: "21.5" },
];

const HOODIE_SIZES = [
  { size: "S", chest: "38", length: "26", shoulder: "17" },
  { size: "M", chest: "40", length: "27", shoulder: "18" },
  { size: "L", chest: "42", length: "28", shoulder: "19" },
  { size: "XL", chest: "44", length: "29", shoulder: "20" },
  { size: "2XL", chest: "46", length: "30", shoulder: "21" },
  { size: "3XL", chest: "48", length: "31", shoulder: "22" },
];

const TIPS = [
  "Measure a garment you already own and love for the best comparison.",
  "If you're between sizes, we recommend going one size up for a comfortable fit.",
  "Our fabrics have minimal shrinkage (less than 3%) after washing.",
  "For oversized fit, order 1-2 sizes above your regular size.",
];

function SizeTable({ title, icon, sizes }: { title: string; icon: React.ReactNode; sizes: typeof TSHIRT_SIZES }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(232,93,4,0.08)", color: "#E85D04" }}>
          {icon}
        </div>
        <h2 className="text-lg font-black font-display text-gray-900">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Size</th>
              <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Chest (in)</th>
              <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Length (in)</th>
              <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Shoulder (in)</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((row, i) => (
              <tr key={row.size} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                <td className="px-6 py-3.5 font-black text-gray-900">{row.size}</td>
                <td className="px-6 py-3.5 text-center text-gray-600">{row.chest}"</td>
                <td className="px-6 py-3.5 text-center text-gray-600">{row.length}"</td>
                <td className="px-6 py-3.5 text-center text-gray-600">{row.shoulder}"</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SizeGuide() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SEOHead
        title="Size Guide | TryNex Lifestyle — Find Your Perfect Fit"
        description="Find your perfect fit with the TryNex Lifestyle size guide. Detailed measurement charts for T-shirts, Hoodies, and more. All measurements in inches."
      />
      <Navbar />

      <main className="flex-1 pt-header">
        <div
          className="py-16 px-4"
          style={{ background: "linear-gradient(135deg, #1a0a00 0%, #3d1500 50%, #5c2200 100%)" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
              style={{ background: "rgba(251,133,0,0.15)" }}>
              <Ruler className="w-7 h-7 text-orange-400" />
            </div>
            <h1 className="text-3xl md:text-5xl font-black font-display text-white mb-4">Size Guide</h1>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Find your perfect fit. All measurements are in inches and refer to body measurements, not garment measurements.
            </p>
          </motion.div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <SizeTable title="T-Shirts & Polo Shirts" icon={<Shirt className="w-5 h-5" />} sizes={TSHIRT_SIZES} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <SizeTable title="Hoodies & Sweatshirts" icon={<Shirt className="w-5 h-5" />} sizes={HOODIE_SIZES} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-3xl border border-gray-100 shadow-sm p-7"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(232,93,4,0.08)", color: "#E85D04" }}>
                <Info className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black font-display text-gray-900">Fitting Tips</h2>
            </div>
            <ul className="space-y-3">
              {TIPS.map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-3xl p-8 text-center"
            style={{ background: "linear-gradient(135deg, #fff8f5, #fff0e8)", border: "1px solid #fed7aa" }}
          >
            <p className="text-gray-700 mb-1 font-semibold">Not sure about your size?</p>
            <p className="text-gray-500 text-sm">
              Message us on WhatsApp at <strong className="text-orange-600">01903426915</strong> with your height and weight, and we'll recommend the perfect size for you.
            </p>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
