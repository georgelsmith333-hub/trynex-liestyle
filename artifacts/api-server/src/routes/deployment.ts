import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { inArray, eq } from "drizzle-orm";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAdmin } from "../middlewares/adminAuth";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

const KEYS = {
  owner: "github_owner",
  repo: "github_repo",
  branch: "github_branch",
  token: "github_token",
  authorName: "github_author_name",
  authorEmail: "github_author_email",
  lastPushAt: "github_last_push_at",
  lastPushSha: "github_last_push_sha",
  lastPushMsg: "github_last_push_message",
  renderDeployHook: "render_deploy_hook",
} as const;

const REPO_ROOT = process.env.REPO_ROOT || "/home/runner/workspace";
const TEMP_REMOTE = "trynex-deploy";

// Strict input validators — block anything that could be a shell metachar,
// command-injection vector, or git-command flag (leading "-").
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const BRANCH_RE = /^(?!-)[A-Za-z0-9._/-]{1,100}$/;
const NAME_RE = /^[^\x00-\x1f<>"\\\n\r]{1,80}$/;
const EMAIL_RE = /^[^\s<>"@\n\r]{1,80}@[^\s<>"@\n\r]{1,80}$/;
const TOKEN_RE = /^[A-Za-z0-9_]{20,200}$/;
// Render deploy hooks are HTTPS URLs
const RENDER_HOOK_RE = /^https:\/\/api\.render\.com\/deploy\/[A-Za-z0-9_?=&.-]{10,300}$/;

function scrubToken(text: string, token: string | undefined): string {
  if (!token) return text;
  return text.split(token).join("***");
}

async function readSettings(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const rows = await db.select().from(settingsTable).where(inArray(settingsTable.key, keys));
  const out: Record<string, string> = {};
  for (const row of rows) if (row.value != null) out[row.key] = row.value;
  return out;
}

async function upsertSetting(key: string, value: string) {
  const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(settingsTable).set({ value, updatedAt: new Date() }).where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value });
  }
}

// Check whether REPO_ROOT is a valid git repository by attempting a
// lightweight git command. Returns true if it is, false otherwise.
async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

router.get("/admin/deployment/status", requireAdmin, async (req, res) => {
  try {
    const s = await readSettings(Object.values(KEYS));
    const renderDeployHookRaw = s[KEYS.renderDeployHook] || "";
    res.json({
      configured: Boolean(s[KEYS.owner] && s[KEYS.repo] && s[KEYS.token]),
      owner: s[KEYS.owner] || "",
      repo: s[KEYS.repo] || "",
      branch: s[KEYS.branch] || "main",
      authorName: s[KEYS.authorName] || "TryNex Admin",
      authorEmail: s[KEYS.authorEmail] || "admin@trynex.local",
      tokenMasked: s[KEYS.token] ? `••••${s[KEYS.token].slice(-4)}` : "",
      lastPushAt: s[KEYS.lastPushAt] || null,
      lastPushSha: s[KEYS.lastPushSha] || null,
      lastPushMessage: s[KEYS.lastPushMsg] || null,
      renderDeployHookSet: Boolean(renderDeployHookRaw),
    });
  } catch (err) {
    req.log.error({ err }, "deployment status failed");
    res.status(500).json({ error: "internal_error", message: "Failed to load status" });
  }
});

router.put("/admin/deployment/config", requireAdmin, async (req, res) => {
  try {
    const { owner, repo, branch, token, authorName, authorEmail, renderDeployHook } = req.body ?? {};

    const ownerStr = String(owner ?? "").trim();
    const repoStr = String(repo ?? "").trim();
    const branchStr = String(branch ?? "main").trim() || "main";
    const nameStr = String(authorName ?? "TryNex Admin").trim() || "TryNex Admin";
    const emailStr = String(authorEmail ?? "admin@trynex.local").trim() || "admin@trynex.local";

    if (!OWNER_RE.test(ownerStr)) {
      res.status(400).json({ error: "validation_error", message: "Invalid GitHub owner/org name." });
      return;
    }
    if (!REPO_RE.test(repoStr)) {
      res.status(400).json({ error: "validation_error", message: "Invalid repository name." });
      return;
    }
    if (!BRANCH_RE.test(branchStr)) {
      res.status(400).json({ error: "validation_error", message: "Invalid branch name." });
      return;
    }
    if (!NAME_RE.test(nameStr)) {
      res.status(400).json({ error: "validation_error", message: "Invalid author name." });
      return;
    }
    if (!EMAIL_RE.test(emailStr)) {
      res.status(400).json({ error: "validation_error", message: "Invalid author email." });
      return;
    }

    await upsertSetting(KEYS.owner, ownerStr);
    await upsertSetting(KEYS.repo, repoStr);
    await upsertSetting(KEYS.branch, branchStr);
    await upsertSetting(KEYS.authorName, nameStr);
    await upsertSetting(KEYS.authorEmail, emailStr);

    if (token && typeof token === "string") {
      const tokenStr = token.trim();
      if (tokenStr && !/^•+/.test(tokenStr)) {
        if (!TOKEN_RE.test(tokenStr)) {
          res.status(400).json({
            error: "validation_error",
            message: "Invalid token format. Expect a GitHub PAT (alphanumeric/underscore, 20–200 chars).",
          });
          return;
        }
        await upsertSetting(KEYS.token, tokenStr);
      }
    }

    // Render deploy hook — optional. Empty string clears it.
    if (typeof renderDeployHook === "string") {
      const hookStr = renderDeployHook.trim();
      if (hookStr === "") {
        // Clear the hook
        await db.delete(settingsTable).where(eq(settingsTable.key, KEYS.renderDeployHook));
      } else if (!RENDER_HOOK_RE.test(hookStr)) {
        res.status(400).json({
          error: "validation_error",
          message: "Invalid Render deploy hook URL. It must start with https://api.render.com/deploy/",
        });
        return;
      } else {
        await upsertSetting(KEYS.renderDeployHook, hookStr);
      }
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "deployment config save failed");
    res.status(500).json({ error: "internal_error", message: "Failed to save config" });
  }
});

router.post("/admin/deployment/push", requireAdmin, async (req, res) => {
  let activeToken: string | undefined;
  let remoteAdded = false;
  const cwd = REPO_ROOT;
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

  const runGit = async (args: string[], _label: string): Promise<{ stdout: string; stderr: string }> => {
    return await execFileAsync("git", args, { cwd, env, maxBuffer: 10 * 1024 * 1024 });
  };

  const log: string[] = [];
  const safeRun = async (args: string[], label: string): Promise<string> => {
    try {
      const { stdout, stderr } = await runGit(args, label);
      const out = (stdout + stderr).trim();
      log.push(`$ git ${label}\n${scrubToken(out, activeToken) || "(ok)"}`);
      return out;
    } catch (e: any) {
      const out = scrubToken(((e.stdout || "") + (e.stderr || "") + (e.message || "")).toString(), activeToken);
      log.push(`$ git ${label}\nERROR: ${out}`);
      throw new Error(`${label} failed: ${out}`);
    }
  };

  try {
    const rawMessage = String(req.body?.message ?? "chore: push from TryNex admin");
    // Reject control characters; cap length.
    if (/[\x00-\x1f]/.test(rawMessage)) {
      res.status(400).json({ error: "validation_error", message: "Commit message contains invalid characters." });
      return;
    }
    const message = rawMessage.slice(0, 200) || "chore: push from TryNex admin";

    const s = await readSettings(Object.values(KEYS));
    const owner = s[KEYS.owner];
    const repo = s[KEYS.repo];
    const branch = s[KEYS.branch] || "main";
    const token = s[KEYS.token];
    const authorName = s[KEYS.authorName] || "TryNex Admin";
    const authorEmail = s[KEYS.authorEmail] || "admin@trynex.local";

    if (!owner || !repo || !token) {
      res.status(400).json({ error: "not_configured", message: "GitHub credentials not configured. Save settings first." });
      return;
    }

    // Re-validate stored values defensively (in case schema/DB was tampered with).
    if (!OWNER_RE.test(owner) || !REPO_RE.test(repo) || !BRANCH_RE.test(branch) ||
        !NAME_RE.test(authorName) || !EMAIL_RE.test(authorEmail) || !TOKEN_RE.test(token)) {
      res.status(400).json({ error: "validation_error", message: "Stored deployment settings are invalid. Please re-save them." });
      return;
    }

    // Pre-flight: confirm we are inside a git repository at REPO_ROOT.
    // On Render's production servers, the source repo is not present —
    // only the compiled artifact is deployed. In that case, git commands
    // would fail with "not a git repository". Detect this early and give
    // a clear, actionable error message instead of a cryptic git failure.
    const inRepo = await isGitRepo(cwd);
    if (!inRepo) {
      res.status(503).json({
        error: "not_a_git_repo",
        message:
          `Cannot find a git repository at REPO_ROOT (${cwd}). ` +
          "Git push is only available when the API server is running inside the source repository (e.g. on Replit). " +
          "In production, use the 'Trigger Render Deploy' button instead, or push from your development machine.",
      });
      return;
    }

    activeToken = token;
    const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;

    await safeRun(["config", "user.name", authorName], "config user.name");
    await safeRun(["config", "user.email", authorEmail], "config user.email");

    // Best-effort cleanup of any leftover remote, then add fresh.
    try { await runGit(["remote", "remove", TEMP_REMOTE], "remote remove (pre)"); } catch { /* ok */ }
    await safeRun(["remote", "add", TEMP_REMOTE, remoteUrl], "remote add");
    remoteAdded = true;

    await safeRun(["add", "-A"], "add -A");

    let committed = true;
    try {
      await runGit(["diff", "--cached", "--quiet"], "diff --cached --quiet");
      committed = false;
      log.push("$ git diff --cached --quiet\n(no staged changes)");
    } catch {
      await safeRun(["commit", "-m", message], "commit");
    }

    await safeRun(["push", TEMP_REMOTE, `HEAD:refs/heads/${branch}`], `push ${branch}`);
    const sha = (await safeRun(["rev-parse", "HEAD"], "rev-parse HEAD")).trim();

    const now = new Date().toISOString();
    await upsertSetting(KEYS.lastPushAt, now);
    await upsertSetting(KEYS.lastPushSha, sha.slice(0, 40));
    await upsertSetting(KEYS.lastPushMsg, message);

    res.json({
      success: true,
      committed,
      sha: sha.slice(0, 40),
      shortSha: sha.slice(0, 7),
      branch,
      pushedAt: now,
      message,
      log: log.join("\n\n"),
    });
  } catch (err: any) {
    const safeMsg = scrubToken(String(err?.message || "Push failed"), activeToken);
    req.log.error({ msg: safeMsg }, "git push failed");
    res.status(500).json({ error: "push_failed", message: safeMsg });
  } finally {
    if (remoteAdded) {
      try { await runGit(["remote", "remove", TEMP_REMOTE], "remote remove (cleanup)"); } catch { /* ignore */ }
    }
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/deployment/trigger
// Trigger a Render deploy hook. This is the recommended way to redeploy
// from the production admin panel where the git repo is not available.
// The hook URL is stored in the settings table (never returned to the client).
// ---------------------------------------------------------------------------
router.post("/admin/deployment/trigger", requireAdmin, async (req, res) => {
  try {
    const s = await readSettings([KEYS.renderDeployHook]);
    const hookUrl = s[KEYS.renderDeployHook];
    if (!hookUrl) {
      res.status(400).json({
        error: "not_configured",
        message: "Render deploy hook not configured. Add it in the deployment settings.",
      });
      return;
    }

    // Call the Render deploy hook. Render expects a POST; the response is
    // typically a 201 with a JSON body describing the triggered deploy.
    const hookRes = await fetch(hookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!hookRes.ok) {
      const body = await hookRes.text().catch(() => "");
      req.log.error({ status: hookRes.status, body }, "Render deploy hook returned non-2xx");
      res.status(502).json({
        error: "hook_failed",
        message: `Render deploy hook returned HTTP ${hookRes.status}. Check the hook URL.`,
      });
      return;
    }

    const data = await hookRes.json().catch(() => ({}));
    const triggeredAt = new Date().toISOString();
    req.log.info({ triggeredAt }, "Render deploy hook triggered");

    res.json({
      success: true,
      triggeredAt,
      render: data,
    });
  } catch (err: any) {
    req.log.error({ err }, "Render deploy trigger failed");
    res.status(500).json({ error: "internal_error", message: String(err?.message || "Trigger failed") });
  }
});

router.delete("/admin/deployment/token", requireAdmin, async (req, res) => {
  try {
    await db.delete(settingsTable).where(eq(settingsTable.key, KEYS.token));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "deployment clear-token failed");
    res.status(500).json({ error: "internal_error", message: "Failed to clear token" });
  }
});

export default router;
