import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl, formatPrice } from "@/lib/utils";
import { Gift, Copy, Check, Users, Share2, Sparkles, TrendingUp, Wallet, ShoppingBag, ArrowRight, BadgeCheck } from "lucide-react";
import { motion } from "framer-motion";

interface ReferralData {
  id: number;
  code: string;
  ownerName: string;
  ownerEmail: string;
  discountPercent: number;
  totalUses: number;
  totalEarnings: number;
  active: boolean;
}

export default function Referral() {
  const { toast } = useToast();
  const { customer, isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [myReferral, setMyReferral] = useState<ReferralData | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(false);

  useEffect(() => {
    if (isAuthenticated && customer?.email) {
      setName(customer.name);
      setEmail(customer.email);
      setLoadingEarnings(true);
      fetch(getApiUrl(`/api/referrals/my/${encodeURIComponent(customer.email)}`))
        .then(r => r.json())
        .then(data => {
          if (data.referral) {
            setMyReferral(data.referral);
            setReferralCode(data.referral.code);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingEarnings(false));
    }
  }, [isAuthenticated, customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/referrals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerName: name, ownerEmail: email, ownerPhone: phone || undefined }),
      });
      const data = await res.json();
      if (data.referral) {
        setReferralCode(data.referral.code);
        setMyReferral(data.referral);
        toast({ title: "Your code is ready!", description: data.message });
      }
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = referralCode ? `${window.location.origin}?ref=${referralCode}` : "";

  const copyCode = async () => {
    if (!referralCode) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copied!", description: "Share it with friends to earn rewards." });
    setTimeout(() => setCopied(false), 3000);
  };

  const shareCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.share({
        title: "Get 10% off at TryNex!",
        text: `Use my referral link to get 10% off your first order at TryNex Lifestyle!`,
        url: shareUrl,
      });
    } catch {
      copyCode();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SEOHead title="Refer & Earn 10% | TryNex Lifestyle" description="Refer friends to TryNex and earn 10% credit. They get 10% off their first order!" />
      <Navbar />

      <section className="pt-header py-10 sm:py-16 px-4" style={{ background: "linear-gradient(135deg, #1C1917, #292524)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold mb-4 sm:mb-6"
              style={{ background: "rgba(232,93,4,0.2)", color: "#FB8500", border: "1px solid rgba(232,93,4,0.3)" }}>
              <Gift className="w-4 h-4" /> Referral Program
            </span>
            <h1 className="text-3xl md:text-5xl font-black font-display text-white leading-tight mb-3 sm:mb-4">
              Refer Friends,<br /><span style={{ color: "#FB8500" }}>Earn 10% Credit</span>
            </h1>
            <p className="text-gray-400 text-sm sm:text-lg max-w-lg mx-auto">
              Share your unique link. Your friends get <strong className="text-white">10% off</strong> their first order.
              You earn <strong className="text-white">10% credit</strong> from every sale they make.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-8 sm:py-12 px-4 -mt-6">
        <div className="max-w-lg mx-auto">
          {!referralCode ? (
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6 sm:p-8 space-y-4"
            >
              <h2 className="font-black text-xl text-gray-900 text-center">Get Your Referral Code</h2>
              <p className="text-center text-sm text-gray-500">
                {isAuthenticated ? "We've filled in your details. Just click generate!" : "Enter your info to get started."}
              </p>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Your Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Enter your name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="your@email.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Phone (Optional)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="01XXXXXXXXX" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
                {loading ? "Creating..." : <><Sparkles className="w-4 h-4" /> Generate My Code</>}
              </button>
            </motion.form>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6 sm:p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
                  <Gift className="w-7 h-7 text-white" />
                </div>
                <h2 className="font-black text-xl text-gray-900">Your Referral Code</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-orange-600">{referralCode}</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <p className="text-xs text-orange-700 font-medium break-all">{shareUrl}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={copyCode}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                  <button onClick={shareCode}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white"
                    style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                </div>
              </div>

              {myReferral && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-orange-500" /> Your Earnings
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-xl bg-orange-50">
                      <p className="text-2xl font-black text-orange-600">{myReferral.totalUses || 0}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Referrals</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-green-50">
                      <p className="text-2xl font-black text-green-600">{formatPrice(myReferral.totalEarnings || 0)}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Earned</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-blue-50">
                      <p className="text-2xl font-black text-blue-600">10%</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Commission</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    Earnings accumulate as store credit. Contact us via WhatsApp to redeem.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </section>

      <section className="py-10 sm:py-14 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-black font-display text-gray-900 text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: Gift, title: "1. Get Your Code", desc: "Sign up above to receive your unique referral link instantly", color: "#E85D04" },
              { icon: Share2, title: "2. Share & Earn", desc: "Send the link to friends — they get 10% off their first order", color: "#2563eb" },
              { icon: Wallet, title: "3. Collect 10% Credit", desc: "You earn 10% of every sale as store credit. Track your earnings above", color: "#16a34a" },
            ].map(({ icon: Icon, title, desc, color }, i) => (
              <motion.div key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-5 sm:p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: `${color}12` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="font-bold text-gray-900 mb-1.5 text-sm">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-14 px-4 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-black font-display text-gray-900 text-center mb-6">FAQ</h2>
          <div className="space-y-3">
            {[
              { q: "How much do my friends save?", a: "They get 10% off their first order when they use your referral link." },
              { q: "How much do I earn?", a: "You earn 10% of every sale made through your referral link as store credit." },
              { q: "How do I redeem my earnings?", a: "Your earnings accumulate as store credit. Contact us via WhatsApp or visit your Account page to check your balance and request a payout or apply it to your next order." },
              { q: "Is there a limit to how many people I can refer?", a: "No! Refer as many friends as you want. There's no cap on your earnings." },
              { q: "Do I need an account?", a: "You can create a referral code without an account, but we recommend signing up so you can track your earnings on your Account page." },
            ].map(({ q, a }) => (
              <div key={q} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="font-bold text-sm text-gray-900 mb-1">{q}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!isAuthenticated && (
        <section className="py-10 px-4">
          <div className="max-w-md mx-auto text-center bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 sm:p-8">
            <BadgeCheck className="w-10 h-10 text-white mx-auto mb-3" />
            <h3 className="text-xl font-black text-white mb-2">Create an Account</h3>
            <p className="text-orange-100 text-sm mb-4">Sign up to track your referral earnings, order history, and more.</p>
            <a href="/signup" className="inline-flex items-center gap-2 bg-white text-orange-600 font-bold text-sm px-6 py-3 rounded-xl hover:bg-orange-50 transition-all">
              Sign Up Free <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
