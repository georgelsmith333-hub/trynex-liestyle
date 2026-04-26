import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getApiUrl, getAuthHeaders } from "@/lib/utils";
import {
  Search, ExternalLink, CheckCircle2, AlertCircle, Loader2,
  Send, RefreshCw, Trash2, Eye, EyeOff, MapPin, Clock,
} from "lucide-react";
import { motion } from "framer-motion";

interface SeoStatus {
  sitemapUrl: string;
  lastPingAt: string | null;
  lastPingStatus: string | null;
  gscServiceAccountConfigured: boolean;
}

export default function AdminSEO() {
  const [status, setStatus] = useState<SeoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [removingConfig, setRemovingConfig] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [showJson, setShowJson] = useState(false);
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [jsonError, setJsonError] = useState("");

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch(getApiUrl("/api/admin/seo/status"), { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to load SEO status");
      setStatus(await r.json());
    } catch (e: any) {
      setError(e.message || "Failed to load SEO status");
    }
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  const flash = (msg: string) => {
    setError("");
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  const flashError = (msg: string) => {
    setSuccessMsg("");
    setError(msg);
    setTimeout(() => setError(""), 8000);
  };

  const handlePingGoogle = async () => {
    setPinging(true);
    setError("");
    setSuccessMsg("");
    try {
      const r = await fetch(getApiUrl("/api/admin/seo/ping-google"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Ping failed");
      flash(data.success
        ? `Google notified successfully (HTTP ${data.httpCode}). Google will crawl your sitemap soon.`
        : `Ping completed with a note: ${data.message}`);
      await fetchStatus();
    } catch (e: any) {
      flashError(e.message || "Failed to ping Google");
    }
    setPinging(false);
  };

  const handleSubmitGSC = async () => {
    setSubmitting(true);
    setError("");
    setSuccessMsg("");
    try {
      const r = await fetch(getApiUrl("/api/admin/seo/submit-gsc"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Submission failed");
      flash(data.success
        ? "Sitemap submitted to Google Search Console via API."
        : `Submission note: ${data.message}`);
      await fetchStatus();
    } catch (e: any) {
      flashError(e.message || "Submission failed");
    }
    setSubmitting(false);
  };

  const handleSaveConfig = async () => {
    setJsonError("");
    if (!serviceAccountJson.trim()) {
      setJsonError("Please paste the JSON key file contents");
      return;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(serviceAccountJson.trim());
    } catch {
      setJsonError("Invalid JSON — please paste the entire service account key file");
      return;
    }
    if (!parsed.private_key || !parsed.client_email) {
      setJsonError("JSON must include private_key and client_email fields");
      return;
    }

    setSavingConfig(true);
    setError("");
    setSuccessMsg("");
    try {
      const r = await fetch(getApiUrl("/api/admin/seo/gsc-config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ serviceAccountJson: serviceAccountJson.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Save failed");
      flash("Service account key saved. You can now use the API submission button.");
      setServiceAccountJson("");
      await fetchStatus();
    } catch (e: any) {
      flashError(e.message || "Failed to save config");
    }
    setSavingConfig(false);
  };

  const handleRemoveConfig = async () => {
    if (!confirm("Remove the Google Search Console service account credentials?")) return;
    setRemovingConfig(true);
    try {
      await fetch(getApiUrl("/api/admin/seo/gsc-config"), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      flash("Service account credentials removed.");
      await fetchStatus();
    } catch (e: any) {
      flashError(e.message || "Failed to remove config");
    }
    setRemovingConfig(false);
  };

  const lastPingOk = status?.lastPingStatus?.startsWith("ok:");
  const lastPingMsg = status?.lastPingStatus?.replace(/^(ok|error):/, "") ?? "";

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md"
              style={{ background: "linear-gradient(135deg,#4285F4,#34A853)" }}
            >
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black font-display text-gray-900">Google Search Console</h1>
              <p className="text-sm text-gray-500">Submit your sitemap so Google indexes trynexshop.com immediately.</p>
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 font-medium whitespace-pre-wrap">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div className="text-sm text-green-700 font-medium">{successMsg}</div>
          </div>
        )}

        {/* Sitemap Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" /> Sitemap Status
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Your sitemap is live and accessible at the URL below.</p>
            </div>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="p-10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <code className="flex-1 text-sm font-mono text-gray-800 break-all">{status?.sitemapUrl}</code>
                <a
                  href={status?.sitemapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 shrink-0"
                  title="Preview sitemap"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {status?.lastPingAt && (
                <div className={`flex items-start gap-3 p-3 rounded-xl border ${lastPingOk ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"}`}>
                  <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${lastPingOk ? "text-green-600" : "text-amber-600"}`} />
                  <div className="text-sm">
                    <span className={`font-semibold ${lastPingOk ? "text-green-700" : "text-amber-700"}`}>
                      Last submission:
                    </span>{" "}
                    <span className="text-gray-600">
                      {new Date(status.lastPingAt).toLocaleString()} — {lastPingMsg}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handlePingGoogle}
                  disabled={pinging}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm shadow-md disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #4285F4, #1a73e8)" }}
                >
                  {pinging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Ping Google (Quick Notify)
                </button>

                <button
                  onClick={handleSubmitGSC}
                  disabled={submitting || !status?.gscServiceAccountConfigured}
                  title={!status?.gscServiceAccountConfigured ? "Configure a service account below first" : undefined}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #34A853, #188038)" }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Submit via API
                </button>
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed">
                <strong>Ping Google</strong> sends a lightweight notification to Google's crawl queue. This endpoint is deprecated by Google and may return a non-200 response — that is normal and does not affect indexing.{" "}
                <strong>Submit via API</strong> uses the official Google Search Console API and is the recommended method (requires a service account below).
              </p>
            </div>
          )}
        </motion.div>

        {/* Manual Steps Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Manual Submission — Step-by-Step</h2>
            <p className="text-xs text-gray-500 mt-0.5">Follow these steps in Google Search Console to confirm receipt.</p>
          </div>
          <div className="p-6 space-y-4">
            {[
              {
                step: 1,
                title: "Open Google Search Console",
                desc: "Sign in with the Google account that owns trynexshop.com.",
                link: { href: "https://search.google.com/search-console", label: "Open Search Console →" },
              },
              {
                step: 2,
                title: "Select the trynexshop.com property",
                desc: "If it is not listed, click Add Property and verify ownership using the HTML tag method (paste the verification meta tag in Settings → SEO → Google Site Verification).",
              },
              {
                step: 3,
                title: "Go to Sitemaps",
                desc: "In the left sidebar click Indexing → Sitemaps.",
              },
              {
                step: 4,
                title: "Enter the sitemap URL and submit",
                desc: 'In the "Add a new sitemap" box enter:',
                code: "sitemap.xml",
              },
              {
                step: 5,
                title: "Confirm receipt",
                desc: "Google will show the sitemap as Pending or Success. Refresh in a few minutes. No errors means you are done.",
              },
            ].map(({ step, title, desc, link, code }) => (
              <div key={step} className="flex gap-4">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black text-white mt-0.5"
                  style={{ background: "linear-gradient(135deg,#4285F4,#34A853)" }}>
                  {step}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{title}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{desc}</div>
                  {code && (
                    <code className="inline-block mt-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-800 text-xs font-mono">
                      {code}
                    </code>
                  )}
                  {link && (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-sm text-blue-600 hover:underline font-semibold"
                    >
                      {link.label} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Service Account Config Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">API Credentials (Optional)</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Paste a Google service account JSON key to enable the "Submit via API" button.
              </p>
            </div>
            {status?.gscServiceAccountConfigured && (
              <span className="text-[10px] font-black tracking-wider px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> CONFIGURED
              </span>
            )}
          </div>

          <div className="p-6 space-y-4">
            <div className="text-sm text-gray-600 space-y-1.5 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="font-semibold text-blue-800">How to create a service account:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Open <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Google Cloud Console</a></li>
                <li>Create a project → Enable the <strong>Google Search Console API</strong></li>
                <li>Go to IAM &amp; Admin → Service Accounts → Create service account</li>
                <li>Create a JSON key and download it</li>
                <li>In Google Search Console, add the service account email as a <strong>Full user</strong></li>
                <li>Paste the entire JSON key file below</li>
              </ol>
            </div>

            <div className="relative">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                Service Account JSON Key
              </label>
              <textarea
                value={showJson ? serviceAccountJson : serviceAccountJson.replace(/./g, (_, i) => i < 40 ? serviceAccountJson[i] : "•")}
                onChange={(e) => { setServiceAccountJson(e.target.value); setJsonError(""); }}
                placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..."}'
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-xs font-mono resize-none"
              />
              <button
                type="button"
                onClick={() => setShowJson(p => !p)}
                className="absolute top-9 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600"
              >
                {showJson ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {jsonError && (
              <p className="text-sm text-red-600 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {jsonError}
              </p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig || !serviceAccountJson.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm shadow-md disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #4285F4, #1a73e8)" }}
              >
                {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save Credentials
              </button>

              {status?.gscServiceAccountConfigured && (
                <button
                  onClick={handleRemoveConfig}
                  disabled={removingConfig}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-red-600 text-sm border border-red-200 hover:bg-red-50 disabled:opacity-50"
                >
                  {removingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Remove
                </button>
              )}
            </div>

            <p className="text-[11px] text-gray-400">
              The JSON key is stored in your database (admin-only access) and is never sent back to the browser after saving.
            </p>
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
