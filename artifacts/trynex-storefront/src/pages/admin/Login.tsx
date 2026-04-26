import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, Eye, EyeOff, ShieldCheck, Smartphone, ArrowLeft, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { nukeAndReload } from "@/lib/cache-recovery";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

type LoginStep = "password" | "totp" | "reset";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<LoginStep>("password");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [partialToken, setPartialToken] = useState("");
  const [resetKey, setResetKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function apiPost(path: string, body: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data: Record<string, unknown> = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error((data.message as string) || "Request failed"), { status: res.status, data });
    return data;
  }

  function issueSession(data: { token?: string }) {
    if (data.token) {
      sessionStorage.setItem("trynex_admin_token", data.token);
    }
    setLocation("/admin");
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsPending(true);
    try {
      const data = await apiPost("/admin/login", { username: "admin", password });
      if (data.requiresTotp) {
        setPartialToken(data.partialToken);
        setStep("totp");
      } else {
        issueSession(data);
      }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 400) {
        setErrorMsg("Updating app to the latest version…");
        await nukeAndReload("admin-login 400 (stale SW likely)");
        return;
      }
      if (status === 401) {
        setErrorMsg("Incorrect password. Please try again.");
      } else if (status === 405 || status === 404) {
        setErrorMsg("Server unreachable: API route is misconfigured.");
      } else if (status && status >= 500) {
        setErrorMsg("Server error. Please try again in a moment.");
      } else {
        const message = err instanceof Error ? err.message : "";
        if (message.toLowerCase().includes("network") || message.toLowerCase().includes("failed to fetch")) {
          setErrorMsg("Cannot reach the server. Check your internet connection.");
        } else {
          setErrorMsg(message || "Login failed. Please try again.");
        }
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsPending(true);
    try {
      const data = await apiPost("/admin/login-totp", { partialToken, totpCode });
      issueSession(data);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        setErrorMsg("Invalid code or session expired. Please log in again.");
        setStep("password");
        setTotpCode("");
        setPartialToken("");
      } else {
        setErrorMsg("Verification failed. Please try again.");
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (newPassword.length < 12) {
      setErrorMsg("New password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }
    setIsPending(true);
    try {
      const data = await apiPost("/admin/reset-password", { resetKey, newPassword });
      setSuccessMsg(data.message || "Password reset successfully. You can now log in with your new password.");
      setResetKey("");
      setNewPassword("");
      setConfirmPassword("");
      setStep("password");
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 403) {
        setErrorMsg("Invalid reset key. Please check and try again.");
      } else if (status === 503) {
        setErrorMsg("Master reset is not configured on this server.");
      } else {
        setErrorMsg("Reset failed. Please try again.");
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #FFF8F3 0%, #FFF4EE 50%, #FFFBF5 100%)" }}>

      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #FB8500, transparent)", filter: "blur(80px)" }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, #E85D04, transparent)", filter: "blur(80px)" }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="p-8 rounded-3xl bg-white border border-gray-100"
          style={{ boxShadow: "0 20px 60px rgba(232,93,4,0.08), 0 4px 20px rgba(0,0,0,0.08)" }}>

          <div className="text-center mb-8">
            <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-5"
              style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 8px 24px rgba(232,93,4,0.3)" }}>
              {step === "totp" ? (
                <Smartphone className="w-7 h-7 text-white" />
              ) : step === "reset" ? (
                <KeyRound className="w-7 h-7 text-white" />
              ) : (
                <Lock className="w-7 h-7 text-white" />
              )}
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
                style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>T</div>
              <h1 className="text-2xl font-black font-display tracking-tight text-gray-900">
                TRY<span style={{ color: "#E85D04" }}>NEX</span>
              </h1>
            </div>
            <p className="text-sm text-gray-400 font-semibold">
              {step === "totp"
                ? "Two-Factor Verification"
                : step === "reset"
                ? "Master Password Reset"
                : "Admin Panel · Restricted Access"}
            </p>
          </div>

          {errorMsg && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl text-sm font-semibold text-center mb-5 bg-red-50 border border-red-200 text-red-600"
            >
              {errorMsg}
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl text-sm font-semibold text-center mb-5 bg-green-50 border border-green-200 text-green-700"
            >
              {successMsg}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {step === "password" && (
              <motion.form
                key="password-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handlePasswordSubmit}
                className="space-y-4"
              >
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
                  style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 6px 24px rgba(232,93,4,0.3)" }}
                >
                  <Lock className="w-4 h-4" />
                  {isPending ? "Verifying..." : "Access Admin Panel"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("reset"); setErrorMsg(""); setSuccessMsg(""); }}
                  className="w-full text-xs text-gray-400 hover:text-orange-500 transition-colors py-1 text-center"
                >
                  Forgot password? Use master reset key
                </button>
              </motion.form>
            )}

            {step === "totp" && (
              <motion.form
                key="totp-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleTotpSubmit}
                className="space-y-4"
              >
                <p className="text-sm text-gray-500 text-center mb-2">
                  Open your authenticator app and enter the 6-digit code for <strong>TryNex Admin</strong>.
                </p>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Authenticator Code</label>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9 ]{6,7}"
                    maxLength={7}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/[^0-9 ]/g, ""))}
                    placeholder="000 000"
                    autoComplete="one-time-code"
                    className="w-full px-4 py-3.5 rounded-xl text-center text-xl font-mono font-bold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending || totpCode.replace(/\s/g, "").length < 6}
                  className="w-full py-4 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 6px 24px rgba(232,93,4,0.3)" }}
                >
                  <ShieldCheck className="w-4 h-4" />
                  {isPending ? "Verifying..." : "Verify & Sign In"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("password"); setErrorMsg(""); setTotpCode(""); }}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1 flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to password
                </button>
              </motion.form>
            )}

            {step === "reset" && (
              <motion.form
                key="reset-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleResetSubmit}
                className="space-y-4"
              >
                <p className="text-sm text-gray-500 text-center mb-2">
                  Enter the master reset key and a new admin password. This also disables 2FA and revokes all sessions.
                </p>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Master Reset Key</label>
                  <input
                    required
                    type="password"
                    value={resetKey}
                    onChange={e => setResetKey(e.target.value)}
                    placeholder="Enter master reset key"
                    autoComplete="off"
                    className="w-full px-4 py-3.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">New Password <span className="text-orange-400">(min 12 chars)</span></label>
                  <input
                    required
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Set new admin password"
                    autoComplete="new-password"
                    minLength={12}
                    className="w-full px-4 py-3.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Confirm New Password</label>
                  <input
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    className="w-full px-4 py-3.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending || !resetKey || !newPassword || !confirmPassword}
                  className="w-full py-4 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 6px 24px rgba(232,93,4,0.3)" }}
                >
                  <KeyRound className="w-4 h-4" />
                  {isPending ? "Resetting..." : "Reset Admin Password"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("password"); setErrorMsg(""); setResetKey(""); setNewPassword(""); setConfirmPassword(""); }}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1 flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to login
                </button>
              </motion.form>
            )}
          </AnimatePresence>

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
