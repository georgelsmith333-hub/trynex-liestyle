import { motion } from "framer-motion";
import { Facebook, Instagram, Youtube, MessageCircle, Mail, Phone } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";

interface Channel {
  label: string;
  handle: string;
  href: string;
  Icon: typeof Facebook;
  gradient: string;
  shadow: string;
  description: string;
  cta: string;
}

export function ConnectWithUs() {
  const settings = useSiteSettings();

  const facebookUrl = settings.facebookUrl || "https://facebook.com/trynexlifestyle";
  const instagramUrl = settings.instagramUrl || "https://instagram.com/trynex.lifestyle";
  const youtubeUrl = settings.youtubeUrl || "https://youtube.com/@trynex";
  const phoneRaw = (settings.phone || "+8801903426915").replace(/[^+0-9]/g, "");
  const whatsappUrl = `https://wa.me/${phoneRaw.replace(/^\+/, "")}`;
  const email = settings.email || "hello@trynexshop.com";

  const handleFromUrl = (url: string, fallback: string) =>
    url.replace(/.*(?:facebook\.com|instagram\.com|youtube\.com\/?@?)\//i, "").replace(/\/$/, "") || fallback;

  const channels: Channel[] = [
    {
      label: "WhatsApp",
      handle: "Chat with us",
      href: whatsappUrl,
      Icon: MessageCircle,
      gradient: "linear-gradient(135deg, #25D366, #128C7E)",
      shadow: "0 8px 24px rgba(37,211,102,0.25)",
      description: "Fastest replies — order, custom designs, or support",
      cta: "Open chat",
    },
    {
      label: "Facebook",
      handle: handleFromUrl(facebookUrl, "trynexlifestyle"),
      href: facebookUrl,
      Icon: Facebook,
      gradient: "linear-gradient(135deg, #1877F2, #0a5fcf)",
      shadow: "0 8px 24px rgba(24,119,242,0.25)",
      description: "Daily updates, customer reviews & live drops",
      cta: "Like our page",
    },
    {
      label: "Instagram",
      handle: "@" + handleFromUrl(instagramUrl, "trynex.lifestyle"),
      href: instagramUrl,
      Icon: Instagram,
      gradient: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
      shadow: "0 8px 24px rgba(225,48,108,0.25)",
      description: "Behind-the-scenes, new products & customer photos",
      cta: "Follow us",
    },
    {
      label: "YouTube",
      handle: handleFromUrl(youtubeUrl, "@trynex"),
      href: youtubeUrl,
      Icon: Youtube,
      gradient: "linear-gradient(135deg, #FF0000, #c40000)",
      shadow: "0 8px 24px rgba(255,0,0,0.22)",
      description: "How-to videos, product walkthroughs & tutorials",
      cta: "Subscribe",
    },
    {
      label: "Call us",
      handle: settings.phone || "+8801903426915",
      href: `tel:${phoneRaw}`,
      Icon: Phone,
      gradient: "linear-gradient(135deg, #E85D04, #FB8500)",
      shadow: "0 8px 24px rgba(232,93,4,0.28)",
      description: "10am – 10pm, 7 days a week",
      cta: "Call now",
    },
    {
      label: "Email",
      handle: email,
      href: `mailto:${email}`,
      Icon: Mail,
      gradient: "linear-gradient(135deg, #475569, #1e293b)",
      shadow: "0 8px 24px rgba(30,41,59,0.22)",
      description: "Order issues, bulk enquiries & partnerships",
      cta: "Send email",
    },
  ];

  return (
    <section className="py-16 px-4 bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4"
            style={{ background: "linear-gradient(135deg, rgba(232,93,4,0.1), rgba(251,133,0,0.1))", color: "#E85D04", border: "1px solid rgba(232,93,4,0.15)" }}>
            We're here for you
          </span>
          <h2 className="text-3xl md:text-4xl font-black font-display text-gray-900 mt-4">
            Connect with TryNex
          </h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            Reach us on the platform you love — every channel below is monitored daily.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
          {channels.map((c, i) => {
            const isExternal = c.href.startsWith("http");
            return (
              <motion.a
                key={c.label}
                href={c.href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                aria-label={`${c.cta} on ${c.label}`}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 p-4 md:p-5 transition-shadow hover:shadow-lg"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-start gap-3 md:gap-4">
                  <div
                    className="shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-white"
                    style={{ background: c.gradient, boxShadow: c.shadow }}
                  >
                    <c.Icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-bold text-gray-900 text-sm md:text-base truncate">{c.label}</p>
                      <span className="hidden md:inline text-[10px] font-bold uppercase tracking-wider text-gray-400 group-hover:text-orange-500 transition-colors">
                        {c.cta} →
                      </span>
                    </div>
                    <p className="text-[11px] md:text-xs text-gray-500 truncate">{c.handle}</p>
                    <p className="hidden md:block text-xs text-gray-500 mt-1.5 leading-relaxed">{c.description}</p>
                  </div>
                </div>
                <div
                  className="absolute inset-x-0 bottom-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: c.gradient }}
                />
              </motion.a>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Trusted by 10,000+ customers across Bangladesh
        </p>
      </div>
    </section>
  );
}
