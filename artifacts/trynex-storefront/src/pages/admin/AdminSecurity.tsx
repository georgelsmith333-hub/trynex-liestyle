import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, ShieldCheck, ShieldOff, KeyRound, Smartphone, Trash2, RefreshCw, Eye, EyeOff, CheckCircle, AlertCircle, LogOut, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  return sessionStorage.getItem("trynex_admin_token") || "";
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || "Request failed"), { status: res.status });
  return data;
}

interface Session {
  id: number;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent: string | null;
  ip: string | null;
}

type TotpStep = "idle" | "scanning" | "confirming";

export default function AdminSecurity() {
  const [, setLocation] = useLocation();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpStep, setTotpStep] = useState<TotpStep>("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Change password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changePwTotp, setChangePwTotp] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isPending, setIsPending] = useState(false);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadMe() {
    try {
      const data = await apiFetch("/admin/me");
      setTotpEnabled(data.admin?.totpEnabled ?? false);
    } catch {
      setLocation("/admin/login");
    }
  }

  async function loadSessions() {
    setLoadingSessions(true);
    try {
      const data = await apiFetch("/admin/sessions");
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }

  useEffect(() => {
    loadMe();
    loadSessions();
  }, []);

  async function startTotpSetup() {
    setIsPending(true);
    try {
      const data = await apiFetch("/admin/totp-setup");
      setQrDataUrl(data.qrDataUrl);
      setTotpSecret(data.secret);
      setTotpStep("scanning");
    } catch (err: unknown) {
      showToast("error", (err as Error).message || "Could not generate QR code");
    } finally {
      setIsPending(false);
    }
  }

  async function confirmTotpEnable() {
    if (!totpCode || !totpSecret) return;
    setIsPending(true);
    try {
      await apiFetch("/admin/totp-enable", {
        method: "POST",
        body: JSON.stringify({ secret: totpSecret, totpCode }),
      });
      setTotpEnabled(true);
      setTotpStep("idle");
      setTotpCode("");
      setQrDataUrl("");
      setTotpSecret("");
      showToast("success", "Two-factor authentication is now active.");
    } catch (err: unknown) {
      showToast("error", (err as Error).message || "Invalid code. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function confirmTotpDisable() {
    if (!disableCode) return;
    setIsPending(true);
    try {
      await apiFetch("/admin/totp-disable", {
        method: "POST",
        body: JSON.stringify({ totpCode: disableCode }),
      });
      setTotpEnabled(false);
      setShowDisable(false);
      setDisableCode("");
      showToast("success", "Two-factor authentication has been disabled.");
    } catch (err: unknown) {
      showToast("error", (err as Error).message || "Invalid code. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      showToast("error", "New passwords do not match.");
      return;
    }
    if (newPw.length < 8) {
      showToast("error", "Password must be at least 8 characters.");
      return;
    }
    setIsPending(true);
    try {
      await apiFetch("/admin/change-password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: currentPw,
          newPassword: newPw,
          ...(totpEnabled ? { totpCode: changePwTotp } : {}),
        }),
      });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setChangePwTotp("");
      showToast("success", "Password changed successfully.");
    } catch (err: unknown) {
      showToast("error", (err as Error).message || "Password change failed.");
    } finally {
      setIsPending(false);
    }
  }

  async function revokeSession(id: number) {
    try {
      await apiFetch(`/admin/sessions/${id}`, { method: "DELETE" });
      setSessions(s => s.filter(x => x.id !== id));
      showToast("success", "Session revoked.");
    } catch {
      showToast("error", "Could not revoke session.");
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" });
  }

  function shortenUA(ua: string | null) {
    if (!ua) return "Unknown browser";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    return ua.slice(0, 30);
  }

  const cardClass = "bg-white rounded-2xl border border-gray-100 p-6 shadow-sm";
  const inputClass = "w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5";
  const btnPrimary = "px-5 py-2.5 rounded-xl font-bold text-white text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]";
  const btnDanger = "px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all border";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Security Settings</h1>
            <p className="text-sm text-gray-500">Manage authentication, 2FA, and active sessions</p>
          </div>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-xl flex items-center gap-3 font-semibold text-sm ${
                toast.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-600"
              }`}
            >
              {toast.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2FA Section */}
        <div className={cardClass}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Smartphone className={`w-5 h-5 ${totpEnabled ? "text-green-500" : "text-gray-400"}`} />
              <div>
                <h2 className="font-black text-gray-900">Two-Factor Authentication</h2>
                <p className="text-sm text-gray-500">
                  {totpEnabled ? "Active — your account is protected with an authenticator app." : "Not enabled — add an extra layer of security."}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${totpEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {totpEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          {!totpEnabled && totpStep === "idle" && (
            <button
              onClick={startTotpSetup}
              disabled={isPending}
              className={btnPrimary}
              style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
            >
              <ShieldCheck className="w-4 h-4" />
              {isPending ? "Generating..." : "Enable 2FA"}
            </button>
          )}

          {totpStep === "scanning" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app.
              </p>
              <div className="flex justify-center">
                <img src={qrDataUrl} alt="TOTP QR Code" className="w-48 h-48 rounded-xl border border-gray-200 p-2" />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Can't scan? Enter this code manually:</p>
                <code className="text-sm font-mono font-bold text-gray-800 tracking-wider break-all">{totpSecret}</code>
              </div>
              <div>
                <label className={labelClass}>Enter the 6-digit code from your app</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/[^0-9 ]/g, ""))}
                  placeholder="000 000"
                  className={inputClass + " text-center text-xl font-mono tracking-[0.3em]"}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={confirmTotpEnable}
                  disabled={isPending || totpCode.replace(/\s/g, "").length < 6}
                  className={btnPrimary}
                  style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
                >
                  <CheckCircle className="w-4 h-4" />
                  {isPending ? "Verifying..." : "Activate 2FA"}
                </button>
                <button
                  onClick={() => { setTotpStep("idle"); setTotpCode(""); setQrDataUrl(""); setTotpSecret(""); }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {totpEnabled && !showDisable && (
            <button
              onClick={() => setShowDisable(true)}
              className={`${btnDanger} border-red-200 text-red-600 bg-red-50 hover:bg-red-100`}
            >
              <ShieldOff className="w-4 h-4" />
              Disable 2FA
            </button>
          )}

          {totpEnabled && showDisable && (
            <div className="space-y-3 border-t border-gray-100 pt-4 mt-4">
              <p className="text-sm font-semibold text-red-600">Enter your current authenticator code to confirm disabling 2FA:</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={7}
                value={disableCode}
                onChange={e => setDisableCode(e.target.value.replace(/[^0-9 ]/g, ""))}
                placeholder="000 000"
                className={inputClass + " text-center text-xl font-mono tracking-[0.3em]"}
              />
              <div className="flex gap-3">
                <button
                  onClick={confirmTotpDisable}
                  disabled={isPending || disableCode.replace(/\s/g, "").length < 6}
                  className={`${btnDanger} border-red-300 bg-red-500 text-white hover:bg-red-600`}
                >
                  {isPending ? "Disabling..." : "Confirm Disable"}
                </button>
                <button
                  onClick={() => { setShowDisable(false); setDisableCode(""); }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Change Password Section */}
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-5">
            <KeyRound className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="font-black text-gray-900">Change Admin Password</h2>
              <p className="text-sm text-gray-500">Use a strong, unique password of at least 8 characters.</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className={labelClass}>Current Password</label>
              <div className="relative">
                <input
                  required
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  className={inputClass + " pr-12"}
                />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>New Password</label>
                <div className="relative">
                  <input
                    required
                    type={showNewPw ? "text" : "password"}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    className={inputClass + " pr-12"}
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>Confirm New Password</label>
                <input
                  required
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                  className={inputClass + (confirmPw && confirmPw !== newPw ? " border-red-300 ring-1 ring-red-200" : "")}
                />
              </div>
            </div>

            {totpEnabled && (
              <div>
                <label className={labelClass}>Authenticator Code (required)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  value={changePwTotp}
                  onChange={e => setChangePwTotp(e.target.value.replace(/[^0-9 ]/g, ""))}
                  placeholder="000 000"
                  required
                  className={inputClass + " text-center font-mono tracking-[0.3em]"}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || !currentPw || !newPw || !confirmPw || (totpEnabled && !changePwTotp)}
              className={btnPrimary}
              style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
            >
              <KeyRound className="w-4 h-4" />
              {isPending ? "Saving..." : "Change Password"}
            </button>
          </form>
        </div>

        {/* Active Sessions */}
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-blue-500" />
              <div>
                <h2 className="font-black text-gray-900">Active Sessions</h2>
                <p className="text-sm text-gray-500">Revoke any session you don't recognise.</p>
              </div>
            </div>
            <button onClick={loadSessions} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loadingSessions ? (
            <div className="text-center py-6 text-gray-400 text-sm">Loading sessions…</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">No active sessions found.</div>
          ) : (
            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-start gap-3">
                    <Monitor className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-gray-800">{shortenUA(s.userAgent)}</p>
                      <p className="text-xs text-gray-500">IP: {s.ip || "—"} · Last used: {formatDate(s.lastUsedAt)}</p>
                      <p className="text-xs text-gray-400">Expires: {formatDate(s.expiresAt)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => revokeSession(s.id)}
                    className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                    title="Revoke session"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
