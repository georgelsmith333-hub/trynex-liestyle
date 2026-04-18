import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { FileText } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="Terms of Service"
        description="TryNex Lifestyle terms of service. Read our terms and conditions for using our website and purchasing products."
        canonical="/terms-of-service"
      />
      <Navbar />
      <main className="flex-1 pt-header pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-10">
            <span className="section-eyebrow mb-4">
              <FileText className="w-3 h-3" /> Terms
            </span>
            <h1 className="section-heading mt-4">Terms of Service</h1>
            <p className="text-gray-500 mt-4 max-w-2xl">
              By using TryNex Lifestyle's website and services, you agree to the following terms and conditions.
            </p>
            <p className="text-xs text-gray-400 mt-2">Last updated: April 7, 2026</p>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">1. General</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                These Terms of Service govern your use of the TryNex Lifestyle website (trynexshop.com) and all related services. By placing an order, you confirm that you are at least 18 years old (or have parental consent) and agree to be bound by these terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">2. Products & Pricing</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                All prices are displayed in Bangladeshi Taka (BDT/৳) and are inclusive of applicable taxes. We reserve the right to change prices at any time without prior notice. Product images are for illustration purposes; actual colors may vary slightly due to screen differences.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">3. Orders & Payment</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                An order is confirmed once we verify the advance payment (15% for COD, full amount for mobile banking). We reserve the right to cancel any order due to stock availability, pricing errors, or suspicious activity. Accepted payment methods include bKash, Nagad, Rocket, and Cash on Delivery (COD).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">4. Custom Orders</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Custom-designed products are made to your specifications. Once production begins, custom orders cannot be cancelled. Please review your design details carefully before confirming. TryNex is not responsible for errors in customer-provided designs or text.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">5. Shipping & Delivery</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                We ship to all 64 districts of Bangladesh. Delivery times are estimates and may vary due to external factors. Please refer to our{" "}
                <a href="/shipping-policy" className="text-orange-600 font-bold hover:underline">Shipping Policy</a>{" "}
                for detailed information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">6. Returns & Refunds</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Returns and refunds are subject to our{" "}
                <a href="/return-policy" className="text-orange-600 font-bold hover:underline">Return & Refund Policy</a>.
                Please review it before making a purchase.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">7. Intellectual Property</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                All content on this website — including logos, images, text, designs, and graphics — is the property of TryNex Lifestyle and is protected by intellectual property laws. You may not reproduce, distribute, or use any content without our written permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">8. Limitation of Liability</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                TryNex Lifestyle shall not be liable for any indirect, incidental, or consequential damages arising from the use of our website or products. Our total liability for any claim shall not exceed the amount paid for the specific product in question.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">9. Changes to Terms</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                We reserve the right to update these terms at any time. Changes will be effective immediately upon posting on this page. Continued use of our website constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">10. Contact</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                For any questions about these terms, please contact us at{" "}
                <a href="mailto:hello@trynexshop.com" className="text-orange-600 font-bold hover:underline">hello@trynexshop.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
