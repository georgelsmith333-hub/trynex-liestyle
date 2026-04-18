import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageCircle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    category: "Shipping & Delivery",
    question: "How long does delivery take?",
    answer: "Standard delivery takes 3–5 business days across Bangladesh. Dhaka orders usually arrive within 2–3 business days. We deliver to all 64 districts of Bangladesh.",
  },
  {
    category: "Shipping & Delivery",
    question: "Is there free shipping?",
    answer: "Yes! Orders above ৳1,500 qualify for free shipping. Orders below this amount have a flat ৳100 delivery fee regardless of location.",
  },
  {
    category: "Shipping & Delivery",
    question: "Do you deliver outside Bangladesh?",
    answer: "Currently we only deliver within Bangladesh. International shipping is planned for a future phase.",
  },
  {
    category: "Shipping & Delivery",
    question: "How can I track my order?",
    answer: "You can track your order on our Track Order page using your order number and phone number. You'll also receive WhatsApp updates when your order ships.",
  },
  {
    category: "Returns & Refunds",
    question: "What is your return policy?",
    answer: "We accept returns within 7 days of delivery for manufacturing defects or wrong items sent. Custom-printed items cannot be returned unless there is a printing defect. Please contact us via WhatsApp before returning.",
  },
  {
    category: "Returns & Refunds",
    question: "How do I get a refund?",
    answer: "Refunds are processed within 3–5 business days after we receive and inspect the returned item. Refunds are issued via bKash, Nagad, or Rocket — whichever you used to pay.",
  },
  {
    category: "Returns & Refunds",
    question: "What if my order arrives damaged?",
    answer: "We're so sorry if this happens. Please photograph the damaged item and contact us on WhatsApp within 48 hours of receiving it. We'll send a replacement or issue a full refund.",
  },
  {
    category: "Sizing & Products",
    question: "How do I choose the right size?",
    answer: "Each product page has a detailed size chart showing chest, length, and shoulder measurements in both CM and inches. For custom orders, you can also provide your exact measurements.",
  },
  {
    category: "Sizing & Products",
    question: "What fabric quality do you use?",
    answer: "We use 230–320 GSM premium cotton-polyester blend fabric for T-shirts and hoodies. This ensures durability, print longevity, and a premium feel that lasts hundreds of washes.",
  },
  {
    category: "Sizing & Products",
    question: "What printing method do you use?",
    answer: "We use DTG (Direct-to-Garment) printing for photo-quality designs and screen printing for bulk orders. Both methods are colorfast and wash-resistant.",
  },
  {
    category: "Custom Orders",
    question: "Can I order with my own design?",
    answer: "Absolutely! Use our Design Studio to upload your artwork, add text, choose colors, and preview exactly how your design will look. You can also send us your design via WhatsApp.",
  },
  {
    category: "Custom Orders",
    question: "What file formats do you accept for custom designs?",
    answer: "We accept PNG, JPG, PDF, and SVG files. For best print quality, use PNG or SVG at 300 DPI or higher. Our Design Studio will automatically optimize your upload.",
  },
  {
    category: "Custom Orders",
    question: "Do you handle bulk corporate orders?",
    answer: "Yes! We specialize in bulk corporate orders (50+ pieces) with branded packaging, custom labels, and volume discounts. Contact us via WhatsApp at 01903426915 for a bulk quote.",
  },
  {
    category: "Payments",
    question: "What payment methods do you accept?",
    answer: "We accept bKash, Nagad, Rocket (mobile banking), and Cash on Delivery (COD). For COD, a 15% advance payment is required to confirm your order.",
  },
  {
    category: "Payments",
    question: "Is Cash on Delivery available?",
    answer: "Yes, COD is available across Bangladesh. We require a 15% advance via bKash, Nagad, or Rocket to confirm your order. The remaining amount is paid when the product arrives.",
  },
  {
    category: "Payments",
    question: "Is my payment information secure?",
    answer: "We never store your mobile banking credentials. All payments are processed directly through the official bKash, Nagad, and Rocket apps using Send Money. Your financial data stays safe.",
  },
  {
    category: "Account & Orders",
    question: "Do I need an account to order?",
    answer: "No, you can order as a guest using just your phone number. Creating an account lets you track orders, save your wishlist, and access exclusive member discounts.",
  },
  {
    category: "Account & Orders",
    question: "Can I modify or cancel my order?",
    answer: "You can cancel or modify within 2 hours of placing your order. After that, production begins and changes may not be possible. Contact us immediately via WhatsApp if you need to make changes.",
  },
];

const categories = [...new Set(faqs.map((f) => f.category))];

function FAQAccordion({ item, index }: { item: FAQItem; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="border border-gray-200 rounded-2xl overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-white hover:bg-orange-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-inset"
      >
        <span className="font-semibold text-gray-900 text-sm sm:text-base">{item.question}</span>
        <ChevronDown
          className={`w-5 h-5 text-orange-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4 bg-orange-50/30">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.answer,
    },
  })),
};

export default function FAQ() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = activeCategory
    ? faqs.filter((f) => f.category === activeCategory)
    : faqs;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="FAQ — Frequently Asked Questions | TryNex Lifestyle"
        description="Answers to common questions about shipping, returns, custom orders, sizing, and payments at TryNex Lifestyle Bangladesh."
        jsonLd={faqSchema}
      />
      <Navbar />

      <main className="flex-1 pt-header">
        <div
          className="py-16 px-4 text-center"
          style={{ background: "linear-gradient(135deg, #fff8f5 0%, #fff 100%)" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <span className="inline-block text-xs font-black uppercase tracking-[0.2em] text-orange-500 mb-3">
              Help Center
            </span>
            <h1 className="text-4xl md:text-5xl font-black font-display text-gray-900 mb-4">
              Frequently Asked<br />
              <span style={{ color: "#E85D04" }}>Questions</span>
            </h1>
            <p className="text-gray-500 text-lg max-w-lg mx-auto">
              Everything you need to know about TryNex. Can't find the answer?{" "}
              <a
                href="https://wa.me/8801903426915"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 font-bold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded"
              >
                Chat with us on WhatsApp
              </a>
            </p>
          </motion.div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pb-20">
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            <button
              onClick={() => setActiveCategory(null)}
              aria-pressed={activeCategory === null}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                activeCategory === null
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                aria-pressed={activeCategory === cat}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                  activeCategory === cat
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map((item, i) => (
              <FAQAccordion key={item.question} item={item} index={i} />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 p-8 rounded-3xl text-center"
            style={{ background: "linear-gradient(135deg, #fff8f5, #fff0e8)" }}
          >
            <MessageCircle className="w-10 h-10 text-orange-500 mx-auto mb-3" aria-hidden="true" />
            <h3 className="font-black text-gray-900 text-xl mb-2">Still have questions?</h3>
            <p className="text-gray-500 mb-5">Our team replies within minutes on WhatsApp</p>
            <a
              href="https://wa.me/8801903426915?text=Hi%2C%20I%20have%20a%20question%20about%20TryNex"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-black text-sm shadow-lg transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              style={{ background: "#25D366", boxShadow: "0 6px 24px rgba(37,211,102,0.35)" }}
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" /> Chat on WhatsApp
            </a>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
