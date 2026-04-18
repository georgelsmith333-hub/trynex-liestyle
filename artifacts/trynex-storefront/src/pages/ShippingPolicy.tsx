import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Truck, Clock, MapPin, Package, ShieldCheck, AlertCircle } from "lucide-react";

const SHIPPING_ZONES = [
  { zone: "Dhaka City", time: "24 hours", cost: "৳60" },
  { zone: "Dhaka Division", time: "24-48 hours", cost: "৳80" },
  { zone: "Chittagong Division", time: "24-48 hours", cost: "৳100" },
  { zone: "Other Divisions", time: "24-48 hours", cost: "৳100" },
];

export default function ShippingPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="Shipping Policy"
        description="TryNex Lifestyle shipping policy. Fast delivery across all 64 districts of Bangladesh. Free shipping on orders above ৳1,500."
        canonical="/shipping-policy"
        keywords="trynex shipping, bangladesh delivery, free shipping bd"
      />
      <Navbar />
      <main className="flex-1 pt-header pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
          <div className="mb-6 sm:mb-10">
            <span className="section-eyebrow mb-4">
              <Truck className="w-3 h-3" /> Shipping
            </span>
            <h1 className="section-heading mt-4">Shipping Policy</h1>
            <p className="text-gray-500 mt-4 max-w-2xl">
              We deliver to all 64 districts of Bangladesh. Orders above ৳1,500 qualify for free shipping.
            </p>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-orange-500" /> Delivery Zones & Timeframes
              </h2>
              <div className="overflow-hidden rounded-2xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-5 py-3 font-black text-gray-600 text-xs uppercase tracking-wider">Zone</th>
                      <th className="text-left px-5 py-3 font-black text-gray-600 text-xs uppercase tracking-wider">Delivery Time</th>
                      <th className="text-left px-5 py-3 font-black text-gray-600 text-xs uppercase tracking-wider">Shipping Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SHIPPING_ZONES.map((z, i) => (
                      <tr key={z.zone} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-5 py-3.5 font-semibold text-gray-800">{z.zone}</td>
                        <td className="px-5 py-3.5 text-gray-600">{z.time}</td>
                        <td className="px-5 py-3.5 font-bold text-orange-600">{z.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-green-600 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Free shipping on all orders above ৳1,500
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" /> Processing Time
              </h2>
              <div className="p-5 rounded-2xl bg-green-50 border border-green-100">
                <p className="text-sm text-gray-700 leading-relaxed">
                  All orders are processed and shipped within <strong className="text-green-600">24-48 hours</strong> of payment confirmation. Ready-made products typically ship within <strong className="text-green-600">24 hours</strong>. Processing does not include weekends or public holidays.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-500" /> Order Tracking
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Once your order is shipped, you will receive a tracking update. You can track your order anytime on our <a href="/track" className="text-orange-600 font-bold hover:underline">Track Order</a> page using your order number and email address.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" /> Important Notes
              </h2>
              <ul className="space-y-3">
                {[
                  "Delivery times may vary during peak seasons, holidays, or adverse weather conditions.",
                  "Ensure your shipping address and phone number are accurate to avoid delivery delays.",
                  "Someone must be available to receive the package at the delivery address.",
                  "For Cash on Delivery (COD) orders, the remaining balance must be paid upon delivery.",
                  "If a delivery attempt fails, we will contact you to reschedule.",
                ].map((note) => (
                  <li key={note} className="flex items-start gap-3 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
