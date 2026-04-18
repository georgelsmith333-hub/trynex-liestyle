import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="Privacy Policy"
        description="TryNex Lifestyle privacy policy. Learn how we collect, use, and protect your personal data."
        canonical="/privacy-policy"
      />
      <Navbar />
      <main className="flex-1 pt-header pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-10">
            <span className="section-eyebrow mb-4">
              <ShieldCheck className="w-3 h-3" /> Privacy
            </span>
            <h1 className="section-heading mt-4">Privacy Policy</h1>
            <p className="text-gray-500 mt-4 max-w-2xl">
              Your privacy matters to us. This policy explains how TryNex Lifestyle collects, uses, and protects your information.
            </p>
            <p className="text-xs text-gray-400 mt-2">Last updated: April 7, 2026</p>
          </div>

          <div className="prose prose-sm prose-gray max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">1. Information We Collect</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">When you shop with us or interact with our website, we may collect:</p>
              <ul className="space-y-2">
                {[
                  "Personal details: Name, email address, phone number, shipping address",
                  "Order information: Products purchased, quantities, payment method, order history",
                  "Payment data: Last 4 digits of mobile banking number (we never store full payment credentials)",
                  "Device data: Browser type, IP address, and cookies for analytics purposes",
                  "Communication data: Messages sent via WhatsApp, email, or our contact forms",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">2. How We Use Your Data</h2>
              <ul className="space-y-2">
                {[
                  "To process and fulfill your orders",
                  "To send order confirmations, shipping updates, and delivery notifications",
                  "To improve our products and customer experience",
                  "To send promotional offers (only with your consent)",
                  "To prevent fraud and ensure security",
                  "To comply with legal obligations",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">3. Data Sharing</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                We do not sell, rent, or trade your personal information to third parties. We may share data only with trusted service providers who assist in order fulfillment and delivery, and only as necessary to complete your order.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">4. Cookies & Analytics</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Our website uses cookies and third-party analytics services (Google Analytics, Facebook Pixel) to understand visitor behavior and improve our services. You can disable cookies in your browser settings, though this may affect your experience on our site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">5. Data Security</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                We implement appropriate security measures to protect your personal data against unauthorized access, alteration, or destruction. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">6. Your Rights</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">You have the right to:</p>
              <ul className="space-y-2">
                {[
                  "Request access to your personal data",
                  "Request correction of inaccurate data",
                  "Request deletion of your data",
                  "Opt out of marketing communications at any time",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-black text-gray-900 mb-3">7. Contact Us</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                For any privacy-related questions or requests, contact us at{" "}
                <a href="mailto:hello@trynexshop.com" className="text-orange-600 font-bold hover:underline">hello@trynexshop.com</a>{" "}
                or reach out via WhatsApp.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
