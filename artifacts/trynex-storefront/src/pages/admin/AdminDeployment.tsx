import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getApiUrl, getAuthHeaders } from "@/lib/utils";
import {
  GitBranch, Github, Save, Rocket, Loader2, CheckCircle2, AlertCircle,
  Eye, EyeOff, Trash2, Clock, ExternalLink, Copy, Check
} from "lucide-react";
import { motion } from "framer-motion";

interface DeploymentStatus {
  configured: boolean;
  owner: string;
  repo: string;
  branch: string;
  authorName: string;
  authorEmail: string;
  tokenMasked: string;
  lastPushAt: string | null;
  lastPushSha: string | null;
  lastPushMessage: string | null;
}

interface PushResult {
  success: boolean;
  committed: boolean;
  sha: string;
  shortSha: string;
  branch: string;
  pushedAt: string;
  message: string;
  log: string;
}

export default function AdminDeployment() {
  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");
  const [authorName, setAuthorName] = useState("TryNex Admin");
  const [authorEmail, setAuthorEmail] = useState("admin@trynex.local");
  const [commitMessage, setCommitMessage] = useState("chore: deploy from TryNex admin");

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch(getApiUrl("/api/admin/deployment/status"), { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to load deployment status");
      const data: DeploymentStatus = await r.json();
      setStatus(data);
      setOwner(data.owner);
      setRepo(data.repo);
      setBranch(data.branch || "main");
      setAuthorName(data.authorName);
      setAuthorEmail(data.authorEmail);
      if (data.tokenMasked) setToken(data.tokenMasked);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    }
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaveOk(false);
    if (!owner.trim() || !repo.trim()) {
      setError("Owner and repo are required");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = { owner, repo, branch, authorName, authorEmail };
      if (token && !/^•+/.test(token)) body.token = token;
      const r = await fetch(getApiUrl("/api/admin/deployment/config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Save failed");
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
      await fetchStatus();
    } catch (e: any) {
      setError(e.message || "Save failed");
    }
    setSaving(false);
  };

  const handlePush = async () => {
    setError("");
    setPushResult(null);
    if (!status?.configured) {
      setError("Configure your GitHub credentials first");
      return;
    }
    setPushing(true);
    try {
      const r = await fetch(getApiUrl("/api/admin/deployment/push"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ message: commitMessage }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Push failed");
      setPushResult(data);
      await fetchStatus();
    } catch (e: any) {
      setError(e.message || "Push failed");
    }
    setPushing(false);
  };

  const handleClearToken = async () => {
    if (!confirm("Remove the saved GitHub token? You'll need to enter it again to push.")) return;
    setSaving(true);
    try {
      await fetch(getApiUrl("/api/admin/deployment/token"), { method: "DELETE", headers: getAuthHeaders() });
      setToken("");
      await fetchStatus();
    } finally { setSaving(false); }
  };

  const copySha = async () => {
    if (!pushResult?.sha) return;
    await navigator.clipboard.writeText(pushResult.sha);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const repoUrl = status?.owner && status?.repo ? `https://github.com/${status.owner}/${status.repo}` : "";

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md"
              style={{ background: "linear-gradient(135deg,#1f2937,#111827)" }}
            >
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black font-display text-gray-900">Deployment</h1>
              <p className="text-sm text-gray-500">Push your latest code to GitHub. Cloudflare Pages and Render will auto-deploy from there.</p>
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 font-medium whitespace-pre-wrap break-words">{error}</div>
          </div>
        )}

        {/* CONFIG CARD */}
        <motion.form
          onSubmit={handleSave}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">GitHub Repository</h2>
              <p className="text-xs text-gray-500 mt-0.5">Stored securely in your database. Never sent back to the browser.</p>
            </div>
            {status?.configured && (
              <span className="text-[10px] font-black tracking-wider px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> CONFIGURED
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Owner / Org</label>
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="your-github-username"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Repository</label>
                <input
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="trynex-lifestyle"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Branch</label>
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Personal Access Token
                  <a
                    href="https://github.com/settings/tokens?type=beta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1.5 text-orange-600 hover:underline normal-case font-semibold"
                  >
                    (Get one →)
                  </a>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="github_pat_…  (needs Contents: Read & Write)"
                    autoComplete="new-password"
                    className="w-full pl-4 pr-20 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm font-mono"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowToken((p) => !p)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                      aria-label={showToken ? "Hide token" : "Show token"}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {status?.tokenMasked && (
                      <button
                        type="button"
                        onClick={handleClearToken}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                        aria-label="Clear saved token"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Commit Author Name</label>
                <input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Commit Author Email</label>
                <input
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm font-medium"
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm shadow-md disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Settings
                </button>
                {saveOk && (
                  <span className="text-sm font-semibold text-green-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Saved
                  </span>
                )}
                {repoUrl && (
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-orange-600"
                  >
                    Open repo on GitHub <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </motion.form>

        {/* PUSH CARD */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-orange-500" />
              Push to GitHub
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Stages all current changes, commits, and pushes to <span className="font-mono font-bold">{branch || "main"}</span>.</p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Commit Message</label>
              <input
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm font-medium"
                maxLength={200}
              />
            </div>

            <button
              onClick={handlePush}
              disabled={pushing || !status?.configured}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-white text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: pushing
                ? "linear-gradient(135deg, #6b7280, #4b5563)"
                : "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              {pushing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Pushing…</>
              ) : (
                <><GitBranch className="w-4 h-4" /> Push to GitHub Now</>
              )}
            </button>

            {!status?.configured && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Save your repo settings (with a token) above first.
              </p>
            )}

            {status?.lastPushAt && !pushResult && (
              <div className="text-xs text-gray-500 flex items-center gap-1.5 pt-1">
                <Clock className="w-3.5 h-3.5" />
                Last push:&nbsp;
                <span className="font-semibold text-gray-700">
                  {new Date(status.lastPushAt).toLocaleString("en-BD")}
                </span>
                {status.lastPushSha && (
                  <span className="font-mono text-gray-400">· {status.lastPushSha.slice(0, 7)}</span>
                )}
              </div>
            )}

            {pushResult && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-green-800 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  {pushResult.committed ? "Pushed successfully!" : "Branch up-to-date — nothing to commit."}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Branch</div>
                    <div className="font-mono font-bold text-gray-900">{pushResult.branch}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Commit</div>
                    <button onClick={copySha} className="font-mono font-bold text-gray-900 inline-flex items-center gap-1 hover:text-orange-600">
                      {pushResult.shortSha}
                      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 opacity-50" />}
                    </button>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Pushed at</div>
                    <div className="font-semibold text-gray-900">{new Date(pushResult.pushedAt).toLocaleTimeString("en-BD")}</div>
                  </div>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer font-semibold text-green-700 hover:text-green-800">View git log</summary>
                  <pre className="mt-2 p-3 rounded-lg bg-gray-900 text-green-300 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap">{pushResult.log}</pre>
                </details>
              </motion.div>
            )}
          </div>
        </motion.div>

        <div className="text-xs text-gray-400 leading-relaxed bg-gray-50 border border-gray-100 rounded-xl p-4">
          <strong className="text-gray-600">How it works:</strong> When you push, the server stages all current files, commits with your chosen message, and pushes to your GitHub branch using your personal access token. Cloudflare Pages (storefront) and Render (API server) will detect the new commit and redeploy automatically. Your token is stored in the database and never echoed back to the browser.
        </div>
      </div>
    </AdminLayout>
  );
}
