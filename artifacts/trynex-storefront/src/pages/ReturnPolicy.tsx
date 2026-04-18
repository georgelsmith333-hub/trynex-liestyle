import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { RotateCcw, ShieldCheck, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function ReturnPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="Return & Refund Policy"
        description="TryNex Lifestyle return and refund policy. We stand behind every product. Easy returns within 3 days for defective or incorrect items."
        canonical="/return-policy"
        keywords="trynex returns, refund policy, exchange policy bangladesh"
      />
      <Navbar />
      <main className="flex-1 pt-header pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-10">
            <span className="section-eyebrow mb-4">
              <RotateCcw className="w-3 h-3" /> Returns
            </span>
            <h1 className="section-heading mt-4">Return & Refund Policy</h1>
            <p className="text-gray-500 mt-4 max-w-2xl">
              We stand behind every product we craft. If something isn't right, we'll make it right.
            </p>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" /> Return Window
              </h2>
              <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100">
                <p className="text-sm text-gray-700 leading-relaxed">
                  You may request a return or exchange within <strong>3 days</strong> of receiving your order. Items must be unused, unwashed, and in their original packaging with all tags attached.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" /> Eligible for Returns
              </h2>
              <ul className="space-y-3">
                {[
                  "Defective or damaged products received",
                  "Wrong item delivered (different size, color, or product)",
                  "Print quality issues (fading, misalignment, blurring)",
                  "Missing items from your order",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" /> Not Eligible for Returns
              </h2>
              <ul className="space-y-3">
                {[
                  "Products that have been worn, washed, or altered",
                  "Custom-designed items unless there is a production defect",
                  "Items returned after the 3-day return window",
                  "Products damaged due to customer misuse",
                  "Sale or clearance items (final sale)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-orange-500" /> How to Request a Return
              </h2>
              <div className="space-y-4">
                {[
                  { step: "1", title: "Contact Us", desc: "Reach out via WhatsApp or email within 3 days of delivery with your order number and photos of the issue." },
                  { step: "2", title: "Approval", desc: "Our team will review your request within 24 hours and provide return instructions." },
                  { step: "3", title: "Ship It Back", desc: "Pack the item securely and ship it to our address. Return shipping costs are covered for defective items." },
                  { step: "4", title: "Refund or Exchange", desc: "Once received and inspected, we'll process your refund or send a replacement within 3-5 business days." },
                ].map((s) => (
                  <div key={s.step} className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0"
                      style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
                      {s.step}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{s.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" /> Refund Methods
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Refunds are processed via the original payment method (bKash, Nagad, Rocket). For COD orders, refunds are sent to your preferred mobile banking account. Refund processing takes 3-5 business days after the returned item is received and approved.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
