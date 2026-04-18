import { motion } from "framer-motion";
import { Shirt, Star, Heart, Award, Zap, Globe, Users, Package } from "lucide-react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";

const stats = [
  { value: "5,000+", label: "Happy Customers", icon: Users },
  { value: "64", label: "Districts Covered", icon: Globe },
  { value: "48h", label: "Production Time", icon: Zap },
  { value: "98%", label: "Satisfaction Rate", icon: Star },
];

const values = [
  {
    icon: Heart,
    title: "Made with Passion",
    desc: "Every piece is crafted by skilled artisans in Bangladesh who take pride in their work. Quality is not an afterthought — it's our foundation.",
  },
  {
    icon: Award,
    title: "Premium Materials",
    desc: "We source only 230–320 GSM premium cotton-polyester fabric. Your custom apparel should feel as good as it looks, wash after wash.",
  },
  {
    icon: Shirt,
    title: "Your Vision, Our Craft",
    desc: "From a single custom hoodie to a 500-piece corporate order, we treat every order with the same dedication to detail and precision.",
  },
  {
    icon: Package,
    title: "Fast & Reliable Delivery",
    desc: "We deliver to all 64 districts of Bangladesh within 3–5 business days. Dhaka orders often arrive in 2 days.",
  },
];

const timeline = [
  {
    year: "2020",
    title: "The Beginning",
    desc: "TryNex started in a small Dhaka apartment with a single printing machine and a big dream — to make premium custom apparel accessible to every Bangladeshi.",
  },
  {
    year: "2021",
    title: "First 500 Customers",
    desc: "Word spread fast. Our first viral Facebook post brought 500 orders in a single week. We scaled production to meet demand without compromising quality.",
  },
  {
    year: "2022",
    title: "Going National",
    desc: "We expanded delivery to all 64 districts. Students, startups, and corporations across Bangladesh started trusting TryNex for their custom apparel needs.",
  },
  {
    year: "2023",
    title: "Design Studio Launch",
    desc: "We launched our online Design Studio — letting customers design their apparel directly in the browser and preview results before ordering.",
  },
  {
    year: "2024",
    title: "5,000+ Happy Customers",
    desc: "Today, TryNex serves thousands of customers from Dhaka to Cox's Bazar. Our 98% satisfaction rate reflects our commitment to quality and service.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="About TryNex Lifestyle | Bangladesh's Premium Custom Apparel Brand"
        description="The story behind TryNex Lifestyle — Bangladesh's #1 custom apparel brand. Learn about our mission, values, and commitment to premium manufacturing."
      />
      <Navbar />

      <main className="flex-1 pt-header">
        <div
          className="relative overflow-hidden py-20 px-4"
          style={{ background: "linear-gradient(135deg, #1a0a00 0%, #3d1500 50%, #5c2200 100%)" }}
        >
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: "radial-gradient(circle at 25% 25%, white 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 max-w-4xl mx-auto text-center"
          >
            <span className="inline-block text-xs font-black uppercase tracking-[0.2em] text-orange-400 mb-4">
              Our Story
            </span>
            <h1 className="text-4xl md:text-6xl font-black font-display text-white mb-6 leading-tight">
              You Imagine,<br />
              <span style={{ color: "#FB8500" }}>We Craft.</span>
            </h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto leading-relaxed">
              TryNex Lifestyle was born from a simple belief: everyone in Bangladesh deserves access to premium custom apparel — without compromising on quality, speed, or service.
            </p>
          </motion.div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-6 rounded-3xl border border-orange-100 bg-orange-50"
              >
                <stat.icon className="w-7 h-7 text-orange-500 mx-auto mb-3" aria-hidden="true" />
                <div className="text-3xl font-black font-display" style={{ color: "#E85D04" }}>
                  {stat.value}
                </div>
                <div className="text-xs font-semibold text-gray-500 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="text-xs font-black uppercase tracking-[0.2em] text-orange-500">Our Mission</span>
              <h2 className="text-3xl font-black font-display text-gray-900 mt-2 mb-4">
                Premium apparel for every Bangladeshi
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                We believe that premium quality shouldn't be reserved for international brands. Bangladesh has world-class manufacturing capability — TryNex proves that home-grown brands can deliver products that rival anything imported.
              </p>
              <p className="text-gray-600 leading-relaxed">
                From a student who wants a custom hoodie to a startup needing 200 branded shirts, we treat every order with the same care and precision. When you choose TryNex, you choose Bangladesh-made excellence.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 gap-4"
            >
              {values.map((v) => (
                <div key={v.title} className="p-5 rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
                    <v.icon className="w-5 h-5 text-orange-500" aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-sm text-gray-900 mb-1">{v.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="mb-20">
            <h2 className="text-3xl font-black font-display text-gray-900 text-center mb-12">
              Our <span style={{ color: "#E85D04" }}>Journey</span>
            </h2>
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-orange-200 hidden md:block" aria-hidden="true" />
              <div className="space-y-8">
                {timeline.map((item, i) => (
                  <motion.div
                    key={item.year}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="relative md:pl-20"
                  >
                    <div
                      className="hidden md:flex absolute left-0 top-1 w-16 h-16 rounded-2xl items-center justify-center font-black text-white text-sm"
                      style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
                      aria-hidden="true"
                    >
                      {item.year}
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="md:hidden text-xs font-black text-orange-500">{item.year}</span>
                        <h3 className="font-black text-gray-900">{item.title}</h3>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Team Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mb-20"
            aria-labelledby="team-heading"
          >
            <div className="text-center mb-12">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-orange-500 mb-3 block">The People</span>
              <h2 id="team-heading" className="text-3xl md:text-4xl font-black font-display tracking-tight text-gray-900">
                Our Team
              </h2>
              <p className="text-gray-500 mt-3 max-w-xl mx-auto">
                A small but passionate team of designers, craftspeople, and delivery experts — all working together to bring your vision to life.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { name: "Nabil Rahman", role: "Founder & CEO", initials: "NR", color: "#E85D04", desc: "Launched TryNex from his bedroom in Dhaka with a mission to democratize premium custom apparel for all Bangladeshis." },
                { name: "Tasnim Hossain", role: "Head of Design", initials: "TH", color: "#FB8500", desc: "Former fashion designer with 8 years of experience crafting premium garments. Leads our design studio and quality control." },
                { name: "Arif Chowdhury", role: "Operations Lead", initials: "AC", color: "#d97706", desc: "Oversees production, supplier relationships, and logistics to ensure every order arrives on time and meets our standards." },
              ].map((member, i) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="bg-white rounded-3xl p-7 border border-gray-100 shadow-sm text-center"
                >
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-5 select-none"
                    style={{ background: `linear-gradient(135deg, ${member.color}, #FB8500)` }}
                    aria-hidden="true"
                  >
                    {member.initials}
                  </div>
                  <p className="font-black text-gray-900 text-lg mb-1">{member.name}</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-3">{member.role}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{member.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-3xl p-10 text-center"
            style={{ background: "linear-gradient(135deg, #fff8f5, #fff0e8)", border: "1px solid #fed7aa" }}
          >
            <span className="text-4xl" role="img" aria-label="Bangladesh flag">🇧🇩</span>
            <h2 className="text-2xl font-black font-display text-gray-900 mt-4 mb-3">
              Proudly Made in Bangladesh
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto mb-6">
              Every product is manufactured in Bangladesh by skilled local craftspeople. By choosing TryNex, you're supporting local industry and helping Bangladesh build world-class manufacturing brands.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-white text-sm shadow-lg transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 6px 24px rgba(232,93,4,0.35)" }}
              >
                <Shirt className="w-4 h-4" aria-hidden="true" /> Shop Our Collection
              </Link>
              <Link
                href="/design-studio"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-gray-900 text-sm border-2 border-gray-200 hover:border-orange-400 hover:text-orange-600 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                Create Your Design
              </Link>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
