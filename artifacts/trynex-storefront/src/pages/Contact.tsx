import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Clock, Send, MessageCircle, CheckCircle2, Facebook, Instagram } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useToast } from "@/hooks/use-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.55, ease: [0.23, 1, 0.32, 1] } }),
};

export default function Contact() {
  const settings = useSiteSettings();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setSubmitted(true);
    toast({ title: "Message sent!", description: "We'll get back to you within 24 hours." });
  };

  const phone = settings.phone || "+880 1XXX-XXXXXX";
  const email = settings.email || "hello@trynex.com.bd";
  const address = settings.address || "Dhaka, Bangladesh";

  const contactItems = [
    {
      icon: Phone,
      label: "Phone & WhatsApp",
      value: phone,
      sub: "Available 10AM – 8PM (Sat–Thu)",
      color: "#16a34a",
      bg: "#f0fdf4",
      href: `https://wa.me/${phone.replace(/\D/g, "")}`,
    },
    {
      icon: Mail,
      label: "Email",
      value: email,
      sub: "We reply within 24 hours",
      color: "#2563eb",
      bg: "#eff6ff",
      href: `mailto:${email}`,
    },
    {
      icon: MapPin,
      label: "Location",
      value: address,
      sub: "Serving all 64 districts",
      color: "#E85D04",
      bg: "#fff4ee",
      href: undefined,
    },
    {
      icon: Clock,
      label: "Business Hours",
      value: "Sat – Thu: 10AM to 8PM",
      sub: "Friday: Closed",
      color: "#7c3aed",
      bg: "#f5f3ff",
      href: undefined,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="Contact Us"
        description="Get in touch with TryNex Lifestyle — Bangladesh's #1 custom apparel brand. We're here to help with orders, custom designs, and any queries."
        canonical="/contact"
      />
      <Navbar />
      <main className="flex-1" style={{ paddingTop: "calc(var(--announcement-height, 0px) + 4.25rem)" }}>

        {/* Hero */}
        <section className="py-16 px-4 text-center relative overflow-hidden" style={{ background: "linear-gradient(135deg,#fff8f4 0%,#fff3ea 50%,#ffeedd 100%)" }}>
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{ backgroundImage: "radial-gradient(circle,#E85D04 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
          <motion.div initial="hidden" animate="visible" className="relative z-10 max-w-2xl mx-auto">
            <motion.div custom={0} variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-5"
              style={{ background: "#fff4ee", color: "#E85D04", border: "1.5px solid #fdd5b4" }}>
              <MessageCircle className="w-4 h-4" /> We'd love to hear from you
            </motion.div>
            <motion.h1 custom={1} variants={fadeUp}
              className="font-display font-black leading-tight mb-4 text-gray-900"
              style={{ fontSize: "clamp(2.2rem,6vw,3.5rem)", letterSpacing: "-0.03em" }}>
              Contact <span style={{ color: "#E85D04" }}>Us</span>
            </motion.h1>
            <motion.p custom={2} variants={fadeUp} className="text-gray-600 text-lg leading-relaxed">
              Have a question, custom order request, or just want to say hello? Our team is always here to help.
            </motion.p>
          </motion.div>
        </section>

        {/* Contact Info Cards */}
        <section className="py-12 px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {contactItems.map((item, i) => (
              <motion.div key={item.label} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                {item.href ? (
                  <a href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
                    className="block p-5 rounded-2xl border transition-all hover:shadow-lg hover:-translate-y-0.5"
                    style={{ background: item.bg, borderColor: `${item.color}22` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${item.color}15` }}>
                      <item.icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">{item.label}</div>
                    <div className="font-bold text-gray-800 text-sm leading-snug">{item.value}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{item.sub}</div>
                  </a>
                ) : (
                  <div className="p-5 rounded-2xl border" style={{ background: item.bg, borderColor: `${item.color}22` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${item.color}15` }}>
                      <item.icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">{item.label}</div>
                    <div className="font-bold text-gray-800 text-sm leading-snug">{item.value}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{item.sub}</div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </section>

        {/* Form + Social */}
        <section className="py-8 pb-20 px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">

            {/* Contact Form */}
            <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/60 p-8">
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                      style={{ background: "linear-gradient(135deg,#dcfce7,#bbf7d0)" }}>
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">Message Sent!</h3>
                    <p className="text-gray-500 mb-6">We've received your message and will get back to you within 24 hours.</p>
                    <button onClick={() => { setSubmitted(false); setForm({ name: "", email: "", phone: "", subject: "", message: "" }); }}
                      className="px-6 py-2.5 rounded-xl font-bold text-sm text-white"
                      style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)" }}>
                      Send Another
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-black text-gray-900 mb-1">Send a Message</h2>
                    <p className="text-gray-500 text-sm mb-6">Fill in the form and we'll respond within 24 hours.</p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Full Name *</label>
                          <input name="name" value={form.name} onChange={handleChange} placeholder="Your name" required
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Phone (optional)</label>
                          <input name="phone" value={form.phone} onChange={handleChange} placeholder="+880 1XXX-XXXXXX" type="tel"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Email (optional)</label>
                        <input name="email" value={form.email} onChange={handleChange} placeholder="your@email.com" type="email"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Subject</label>
                        <select name="subject" value={form.subject} onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:border-orange-400 outline-none transition-all bg-white">
                          <option value="">Select a topic...</option>
                          <option value="Custom Order">Custom Order</option>
                          <option value="Bulk Order">Bulk / Corporate Order</option>
                          <option value="Order Status">Order Status</option>
                          <option value="Design Help">Design Help</option>
                          <option value="Return / Exchange">Return or Exchange</option>
                          <option value="General Query">General Query</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Message *</label>
                        <textarea name="message" value={form.message} onChange={handleChange} required rows={5}
                          placeholder="Tell us how we can help you..."
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all resize-none" />
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)", boxShadow: "0 6px 20px rgba(232,93,4,0.35)" }}>
                        {loading ? (
                          <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending...</>
                        ) : (
                          <><Send className="w-4 h-4" /> Send Message</>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>

            {/* Right: WhatsApp CTA + Social + FAQ */}
            <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }} className="space-y-5">

              {/* WhatsApp */}
              <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-4 p-5 rounded-2xl border transition-all hover:shadow-lg hover:-translate-y-0.5 block"
                style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", borderColor: "#bbf7d0" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#16a34a" }}>
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-black text-gray-900 text-sm">Chat on WhatsApp</div>
                  <div className="text-xs text-gray-600 mt-0.5">Usually replies within minutes</div>
                </div>
              </a>

              {/* Social Links */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">Follow Us</div>
                <div className="space-y-3">
                  {[
                    { icon: Facebook, label: "Facebook Page", sub: "Daily updates & offers", color: "#1877f2", bg: "#eff6ff", href: settings.facebookUrl || "https://facebook.com" },
                    { icon: Instagram, label: "Instagram", sub: "Behind-the-scenes & designs", color: "#e1306c", bg: "#fff0f6", href: settings.instagramUrl || "https://instagram.com" },
                  ].map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]"
                      style={{ background: s.bg }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: s.color }}>
                        <s.icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 text-sm">{s.label}</div>
                        <div className="text-[11px] text-gray-500">{s.sub}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Quick FAQs */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">Quick Answers</div>
                <div className="space-y-3 text-sm">
                  {[
                    { q: "How long does delivery take?", a: "3–7 business days across Bangladesh." },
                    { q: "Can I order just 1 item?", a: "Yes! No minimum order quantity." },
                    { q: "Do you do bulk/corporate orders?", a: "Yes — discounts available for 10+ pieces." },
                    { q: "What's your return policy?", a: "Free exchange within 7 days for defects." },
                  ].map((faq) => (
                    <div key={faq.q} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                      <div className="font-bold text-gray-800">{faq.q}</div>
                      <div className="text-gray-500 mt-0.5">{faq.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
