import { Link, useLocation } from "wouter";
import { Facebook, Instagram, Mail, MapPin, Phone, Truck, ShieldCheck, Clock, Youtube, Heart, ExternalLink, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useToast } from "@/hooks/use-toast";

const PAYMENT_BADGES = [
  { name: "bKash", color: "#e2136e", bg: "#fde8f1" },
  { name: "Nagad", color: "#f7941d", bg: "#fff3e0" },
  { name: "Rocket", color: "#8b2291", bg: "#f3e5f5" },
  { name: "COD", color: "#16a34a", bg: "#f0fdf4" },
];

export function Footer() {
  const [, setLocation] = useLocation();
  const [tapCount, setTapCount] = useState(0);
  const [tapTimer, setTapTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [tapFeedback, setTapFeedback] = useState(false);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const settings = useSiteSettings();
  const { toast } = useToast();

  const facebookUrl = settings.facebookUrl?.trim() || "";
  const instagramUrl = settings.instagramUrl?.trim() || "";
  const youtubeUrl = settings.youtubeUrl?.trim() || "";
  const contactPhone = settings.phone?.trim() || "";
  const contactEmail = settings.email?.trim() || "";
  const contactAddress = settings.address?.trim() || "";
  const phoneHref = contactPhone.replace(/[^+0-9]/g, '');
  const socialLinks = [
    facebookUrl ? { icon: Facebook, href: facebookUrl, color: "#1877f2" } : null,
    instagramUrl ? { icon: Instagram, href: instagramUrl, color: "#e1306c" } : null,
    youtubeUrl ? { icon: Youtube, href: youtubeUrl, color: "#ff0000" } : null,
  ].filter(Boolean) as Array<{ icon: typeof Facebook; href: string; color: string }>;

  const handleSecretTap = useCallback(() => {
    setTapFeedback(true);
    setTimeout(() => setTapFeedback(false), 200);
    setTapCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setTimeout(() => setLocation("/admin/login"), 100);
        return 0;
      }
      return next;
    });
    if (tapTimer) clearTimeout(tapTimer);
    const t = setTimeout(() => setTapCount(0), 3000);
    setTapTimer(t);
  }, [tapTimer, setLocation]);

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || subscribing) return;
    setSubscribing(true);
    // Simulate brief async confirmation so users see a pending state.
    setTimeout(() => {
      setSubscribing(false);
      setSubscribed(true);
      toast({ title: "✓ Subscribed!", description: "Watch your inbox for exclusive deals." });
    }, 400);
  };

  return (
    <footer className="bg-gray-950 text-gray-300 overflow-hidden relative">
      <div className="footer-glow-strip w-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-12 border-b border-white/5">
          {[
            { icon: Truck, title: "Nationwide Delivery", desc: "Fast shipping to all 64 districts of Bangladesh", color: "#60a5fa" },
            { icon: ShieldCheck, title: "Premium Quality", desc: "230-320GSM fabric & vibrant prints that last", color: "#4ade80" },
            { icon: Clock, title: "24/7 Support", desc: "Always here via WhatsApp, Call or Email", color: "#FB8500" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                whileHover={{ y: -3 }}
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: `${item.color}18`, border: `1px solid ${item.color}25` }}>
                  <Icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm mb-0.5">{item.title}</h4>
                  <p className="text-xs text-gray-500 leading-snug">{item.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="py-10 border-b border-white/5">
          <div className="max-w-xl mx-auto text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
              style={{ background: 'rgba(232,93,4,0.15)', color: '#FB8500', border: '1px solid rgba(232,93,4,0.25)' }}>
              Newsletter
            </span>
            <h3 className="text-2xl font-black font-display text-white mb-2">Get Exclusive Deals & Updates</h3>
            <p className="text-sm text-gray-500 mb-5">Be the first to know about new collections, flash sales, and special offers!</p>
            {subscribed ? (
              <div className="py-3 px-6 rounded-2xl text-sm font-bold" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
                You're subscribed! Watch your inbox for great deals.
              </div>
            ) : (
              <form onSubmit={handleNewsletter} className="flex gap-2 max-w-sm mx-auto">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 text-gray-900"
                  style={{ background: 'white', border: '1.5px solid rgba(255,255,255,0.1)', boxShadow: 'none' }}
                />
                <button type="submit"
                  disabled={subscribing}
                  aria-busy={subscribing}
                  className="px-5 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
                  {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 py-14">

          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-5 group">
              <div className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(150deg, #1E1508 0%, #2C1E0E 55%, #1A1207 100%)',
                  boxShadow: '0 0 0 1.5px rgba(212,160,23,0.6), 0 6px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,215,100,0.1)',
                }}>
                <svg width="24" height="24" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M6 9h14" stroke="#D4A017" strokeWidth="2.6" strokeLinecap="round"/>
                  <path d="M13 9v11" stroke="#D4A017" strokeWidth="2.6" strokeLinecap="round"/>
                  <path d="M21 4 L21.8 6.2 L24 7 L21.8 7.8 L21 10 L20.2 7.8 L18 7 L20.2 6.2 Z" fill="#FFD966"/>
                  <circle cx="5" cy="5.5" r="1.1" fill="#D4A017" opacity="0.65"/>
                </svg>
              </div>
              <span className="text-2xl font-black font-display tracking-tight text-white">
                {(() => {
                  const name = settings.siteName?.trim() || "TryNex Lifestyle";
                  const parts = name.split(' ');
                  const head = parts[0];
                  const tail = parts.slice(1).join(' ');
                  return (
                    <>{head}{tail && <span style={{ color: '#FB8500' }}>{` ${tail}`}</span>}
                      <span className="block text-[9px] font-semibold text-gray-500 tracking-[0.2em] uppercase">{settings.tagline || "You imagine, we craft"}</span>
                    </>
                  );
                })()}
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-500 mb-6 max-w-xs">
              {settings.tagline || ""} {settings.footerDescription || ""}
            </p>

            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">We Accept</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {PAYMENT_BADGES.map((p) => (
                <span key={p.name}
                  className="px-3 py-1.5 rounded-lg text-xs font-black"
                  style={{ background: p.bg, color: p.color, border: `1px solid ${p.color}30` }}>
                  {p.name}
                </span>
              ))}
            </div>

            <div className="flex gap-3">
              {socialLinks.map(({ icon: Icon, href, color }) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 hover:-translate-y-1 hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${color}22`;
                    e.currentTarget.style.border = `1px solid ${color}55`;
                    e.currentTarget.style.boxShadow = `0 4px 16px ${color}30`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ width: '1.1rem', height: '1.1rem', color }} />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-600 mb-4">Shop</p>
            <ul className="space-y-3">
              {[
                { label: "All Products", href: "/products" },
                { label: "T-Shirts", href: "/products?category=t-shirts" },
                { label: "Hoodies", href: "/products?category=hoodies" },
                { label: "Caps", href: "/products?category=caps" },
                { label: "Mugs", href: "/products?category=mugs" },
                { label: "Custom Order", href: "/design-studio" },
                { label: "Gift Hampers", href: "/hampers" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href}
                    className="text-sm text-gray-500 hover:text-orange-400 transition-colors font-medium">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-600 mb-4">Help</p>
            <ul className="space-y-3">
              {[
                { label: "Track Your Order", href: "/track" },
                { label: "FAQ", href: "/faq" },
                { label: "About Us", href: "/about" },
                { label: "Blog & Tips", href: "/blog" },
                { label: "Refer & Earn", href: "/referral" },
                { label: "Size Guide", href: "/size-guide" },
                { label: "Shipping Policy", href: "/shipping-policy" },
                { label: "Return Policy", href: "/return-policy" },
                { label: "Privacy Policy", href: "/privacy-policy" },
                { label: "Terms of Service", href: "/terms-of-service" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href}
                    className="text-sm text-gray-500 hover:text-orange-400 transition-colors font-medium">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-600 mb-4">Contact</p>
            <ul className="space-y-4 mb-6">
              {contactAddress && (
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-500">{contactAddress}</span>
                </li>
              )}
              {contactPhone && (
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-orange-500 shrink-0" />
                  <a href={`tel:${phoneHref}`} className="text-sm text-gray-500 hover:text-orange-400 transition-colors">{contactPhone}</a>
                </li>
              )}
              {contactEmail && (
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-orange-500 shrink-0" />
                  <a href={`mailto:${contactEmail}`} className="text-sm text-gray-500 hover:text-orange-400 transition-colors">{contactEmail}</a>
                </li>
              )}
            </ul>
            <Link href="/products"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white text-xs transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 4px 16px rgba(232,93,4,0.35)' }}>
              Shop Now <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="py-6 border-t border-white/5 flex flex-col items-center gap-3">
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            Made with
            <Heart className="w-3 h-3 fill-orange-500 text-orange-500" />
            in Bangladesh
          </p>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()}{settings.siteName?.trim() ? ` ${settings.siteName.trim()}.` : ""} All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-gray-600">
            <Link href="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms-of-service" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
            <button
              onClick={handleSecretTap}
              aria-hidden="true"
              tabIndex={-1}
              className="select-none cursor-default"
              style={{
                opacity: tapFeedback ? 0.2 : 0.04,
                fontSize: '1rem',
                color: '#FB8500',
                transition: 'opacity 0.15s',
                userSelect: 'none',
              }}
            >
              ✦
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
