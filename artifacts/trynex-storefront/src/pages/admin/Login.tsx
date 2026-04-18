import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { mutateAsync: login, isPending } = useAdminLogin();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      const res = await login({ data: { username: "admin", password } });
      if (res.token) {
        localStorage.setItem('trynex_admin_token', res.token);
        setLocation("/admin");
      } else {
        setErrorMsg("Incorrect password. Please try again.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.toLowerCase().includes("network") || message.toLowerCase().includes("failed to fetch")) {
        setErrorMsg("Cannot reach the server. Check your internet connection.");
      } else {
        setErrorMsg("Incorrect password. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #FFF8F3 0%, #FFF4EE 50%, #FFFBF5 100%)' }}>

      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FB8500, transparent)', filter: 'blur(80px)' }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #E85D04, transparent)', filter: 'blur(80px)' }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="p-8 rounded-3xl bg-white border border-gray-100"
          style={{ boxShadow: '0 20px 60px rgba(232,93,4,0.08), 0 4px 20px rgba(0,0,0,0.08)' }}>

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-5"
              style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 8px 24px rgba(232,93,4,0.3)' }}>
              <Lock className="w-7 h-7 text-white" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
                style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>T</div>
              <h1 className="text-2xl font-black font-display tracking-tight text-gray-900">
                TRY<span style={{ color: '#E85D04' }}>NEX</span>
              </h1>
            </div>
            <p className="text-sm text-gray-400 font-semibold">Admin Panel · Restricted Access</p>
          </div>

          {/* Error */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl text-sm font-semibold text-center mb-5 bg-red-50 border border-red-200 text-red-600"
            >
              {errorMsg}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Admin Password</label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3.5 pr-12 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !password}
              className="w-full py-4 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.3)' }}
            >
              <Lock className="w-4 h-4" />
              {isPending ? "Verifying..." : "Access Admin Panel"}
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
            <span>Secured · TryNex Lifestyle</span>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          © {new Date().getFullYear()} TryNex Lifestyle · All rights reserved
        </p>
      </motion.div>
    </div>
  );
}
