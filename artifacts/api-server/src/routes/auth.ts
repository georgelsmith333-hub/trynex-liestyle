import { Router, type IRouter } from "express";
import { db, customersTable } from "@workspace/db";
import { eq, or, desc, sql } from "drizzle-orm";
import * as crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

// Lazily-built Google OAuth verifier. Re-built only when GOOGLE_CLIENT_ID
// changes (effectively never at runtime). Verifies signature, issuer,
// audience, and expiry against Google's published public keys.
let googleClient: OAuth2Client | null = null;
let googleClientForId: string | null = null;
function getGoogleClient(clientId: string): OAuth2Client {
  if (googleClient && googleClientForId === clientId) return googleClient;
  googleClient = new OAuth2Client(clientId);
  googleClientForId = clientId;
  return googleClient;
}

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_only_secret_not_for_production";
const CUSTOMER_SALT = process.env.CUSTOMER_SALT || "trynex_customer_2024";
const IS_PROD = process.env.NODE_ENV === "production";

// Surface the underlying error reason in non-prod (and as a short tag in
// prod) so a customer reporting "guest failed" can be diagnosed in seconds
// instead of grepping logs. Never leak stack traces or PII.
function failureReason(err: unknown, fallback: string): string {
  const e = err as { message?: string; code?: string } | null;
  const code = e?.code;
  const msg = e?.message ?? "";
  if (!IS_PROD && msg) return `${fallback} (${msg})`;
  if (code) return `${fallback} [${code}]`;
  return fallback;
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + CUSTOMER_SALT).digest("hex");
}

function signCustomerToken(payload: { id: number; email: string }): string {
  return jwt.sign({ ...payload, role: "customer" }, JWT_SECRET, { expiresIn: "30d" });
}

function verifyCustomerToken(token: string): { id: number; email: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
    if (decoded.role !== "customer") return null;
    return decoded;
  } catch (err) {
    return null;
  }
}

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "validation_error", message: "Name, email, and password are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "validation_error", message: "Password must be at least 6 characters" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "validation_error", message: "Invalid email address" });
      return;
    }

    const existing = await db.select().from(customersTable).where(eq(customersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "conflict", message: "An account with this email already exists" });
      return;
    }

    const [customer] = await db.insert(customersTable).values({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      passwordHash: hashPassword(password),
      verified: true,
    }).returning();

    const token = signCustomerToken({ id: customer.id, email: customer.email });
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("customer_token", token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatar: customer.avatar,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Registration failed");
    res.status(500).json({ error: "internal_error", message: failureReason(err, "Could not create your account right now. Please try again in a moment.") });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "validation_error", message: "Email and password are required" });
      return;
    }

    const [customer] = await db.select().from(customersTable).where(eq(customersTable.email, email.toLowerCase())).limit(1);

    if (!customer || !customer.passwordHash) {
      res.status(401).json({ error: "unauthorized", message: "Invalid email or password" });
      return;
    }

    if (hashPassword(password) !== customer.passwordHash) {
      res.status(401).json({ error: "unauthorized", message: "Invalid email or password" });
      return;
    }

    const token = signCustomerToken({ id: customer.id, email: customer.email });
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("customer_token", token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatar: customer.avatar,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "internal_error", message: failureReason(err, "Sign-in is temporarily unavailable. Please try again in a moment.") });
  }
});

router.post("/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      res.status(400).json({ error: "validation_error", message: "Google credential is required. The Google sign-in button may not have completed — please try again." });
      return;
    }

    const expectedAud = process.env.GOOGLE_CLIENT_ID || "";

    // Production MUST verify the Google ID token signature against Google's
    // public keys. Without this, anyone can mint a forged JWT with arbitrary
    // `email`/`sub` and take over any account. Refuse to start the flow if
    // the server is mis-configured in production.
    if (IS_PROD && !expectedAud) {
      res.status(503).json({ error: "google_not_configured", message: "Google sign-in is not configured on the server. Please contact support or use email login." });
      return;
    }

    let payload: Record<string, unknown>;
    if (expectedAud) {
      // Full verification: signature + issuer + audience + expiry.
      try {
        const ticket = await getGoogleClient(expectedAud).verifyIdToken({
          idToken: credential as string,
          audience: expectedAud,
        });
        const verifiedPayload = ticket.getPayload();
        if (!verifiedPayload) {
          res.status(401).json({ error: "invalid_credential", message: "Google credential could not be verified. Please retry the sign-in." });
          return;
        }
        payload = verifiedPayload as unknown as Record<string, unknown>;
      } catch (verifyErr) {
        const msg = (verifyErr as { message?: string } | null)?.message ?? "";
        if (/expired/i.test(msg)) {
          res.status(401).json({ error: "expired_credential", message: "Your Google sign-in expired. Please sign in again." });
          return;
        }
        if (/audience|aud/i.test(msg)) {
          res.status(401).json({ error: "wrong_audience", message: "Google sign-in is misconfigured for this site (audience mismatch). Please contact support." });
          return;
        }
        res.status(401).json({ error: "invalid_credential", message: "Google credential could not be verified. Please retry the sign-in." });
        return;
      }
    } else {
      // Dev/staging fallback (GOOGLE_CLIENT_ID unset, NODE_ENV !== production).
      // Manual decode — INSECURE, used only to keep local development working.
      const parts = (credential as string).split(".");
      if (parts.length !== 3) {
        res.status(400).json({ error: "validation_error", message: "Invalid Google credential format. Please retry the sign-in." });
        return;
      }
      try {
        payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as Record<string, unknown>;
      } catch {
        res.status(400).json({ error: "validation_error", message: "Could not decode Google credential. Please retry the sign-in." });
        return;
      }
      const exp = typeof payload.exp === "number" ? payload.exp : 0;
      if (exp && exp * 1000 < Date.now()) {
        res.status(401).json({ error: "expired_credential", message: "Your Google sign-in expired. Please sign in again." });
        return;
      }
    }

    const googleId = payload.sub as string | undefined;
    const email = payload.email as string | undefined;
    const name = payload.name as string | undefined;
    const picture = payload.picture as string | undefined;
    const emailVerified = payload.email_verified as boolean | undefined;

    if (!email || !googleId) {
      res.status(400).json({ error: "validation_error", message: "Google did not return your email. Please ensure your Google account has a verified email and try again." });
      return;
    }
    if (emailVerified === false) {
      res.status(403).json({ error: "email_not_verified", message: "Your Google account email is not verified. Please verify it with Google and try again." });
      return;
    }

    let [customer] = await db.select().from(customersTable)
      .where(or(eq(customersTable.googleId, googleId), eq(customersTable.email, email.toLowerCase())))
      .limit(1);

    if (customer) {
      if (!customer.googleId) {
        await db.update(customersTable)
          .set({ googleId, avatar: picture || customer.avatar, updatedAt: new Date() })
          .where(eq(customersTable.id, customer.id));
        customer = { ...customer, googleId, avatar: picture || customer.avatar };
      }
    } else {
      [customer] = await db.insert(customersTable).values({
        name: name || "Google User",
        email: email.toLowerCase(),
        googleId,
        avatar: picture || null,
        verified: true,
      }).returning();
    }

    const token = signCustomerToken({ id: customer.id, email: customer.email });
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("customer_token", token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatar: customer.avatar,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Google login failed");
    res.status(500).json({ error: "internal_error", message: failureReason(err, "Google sign-in is temporarily unavailable. Please try again or use email login.") });
  }
});

router.post("/auth/facebook", async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      res.status(400).json({ error: "validation_error", message: "Facebook access token is required" });
      return;
    }

    const fbResponse = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
    );

    if (!fbResponse.ok) {
      res.status(401).json({ error: "unauthorized", message: "Invalid Facebook token" });
      return;
    }

    const fbData = await fbResponse.json() as { id: string; name: string; email?: string; picture?: { data?: { url?: string } } };
    const { id: facebookId, name, email, picture } = fbData;
    const avatar = picture?.data?.url || null;

    if (!facebookId) {
      res.status(400).json({ error: "validation_error", message: "Could not get Facebook user info" });
      return;
    }

    const lookupEmail = email?.toLowerCase() || `fb_${facebookId}@facebook.local`;

    let [customer] = await db.select().from(customersTable)
      .where(or(eq(customersTable.facebookId, facebookId), eq(customersTable.email, lookupEmail)))
      .limit(1);

    if (customer) {
      if (!customer.facebookId) {
        await db.update(customersTable)
          .set({ facebookId, avatar: avatar || customer.avatar, updatedAt: new Date() })
          .where(eq(customersTable.id, customer.id));
        customer = { ...customer, facebookId, avatar: avatar || customer.avatar };
      }
    } else {
      [customer] = await db.insert(customersTable).values({
        name: name || "Facebook User",
        email: lookupEmail,
        facebookId,
        avatar,
        verified: true,
      }).returning();
    }

    const token = signCustomerToken({ id: customer.id, email: customer.email });
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("customer_token", token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatar: customer.avatar,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Facebook login failed");
    res.status(500).json({ error: "internal_error", message: "Facebook login failed" });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? req.cookies?.customer_token;

    if (!token) {
      res.status(401).json({ error: "unauthorized", message: "Not authenticated" });
      return;
    }

    const decoded = verifyCustomerToken(token);
    if (!decoded) {
      res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
      return;
    }

    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, decoded.id)).limit(1);

    if (!customer) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatar: customer.avatar,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Auth check failed");
    res.status(500).json({ error: "internal_error", message: "Auth check failed" });
  }
});

router.put("/auth/change-password", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? req.cookies?.customer_token;
    if (!token) {
      res.status(401).json({ error: "unauthorized", message: "Not authenticated" });
      return;
    }
    const decoded = verifyCustomerToken(token);
    if (!decoded) {
      res.status(401).json({ error: "unauthorized", message: "Invalid token" });
      return;
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "validation_error", message: "Current and new passwords are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "validation_error", message: "New password must be at least 6 characters" });
      return;
    }
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, decoded.id)).limit(1);
    if (!customer) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    if (!customer.passwordHash) {
      res.status(400).json({ error: "bad_request", message: "Password change not available for social login accounts. Please use Google or Facebook to sign in." });
      return;
    }
    if (hashPassword(currentPassword) !== customer.passwordHash) {
      res.status(401).json({ error: "unauthorized", message: "Current password is incorrect" });
      return;
    }
    await db.update(customersTable)
      .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(customersTable.id, decoded.id));
    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    req.log.error({ err }, "Change password failed");
    res.status(500).json({ error: "internal_error", message: "Failed to change password" });
  }
});

// Create a guest account (no password, synthetic email) so the buyer can
// place orders & track them without registering. Sequence is monotonic and
// the email collision is guarded by a retry on the unique index.
router.post("/auth/guest", async (req, res) => {
  try {
    const { name, phone } = (req.body ?? {}) as { name?: string; phone?: string };
    const safeName = (name?.trim() || "Guest");

    const MAX_TRIES = 5;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      try {
        // Compute next sequence over ALL rows that ever held a guest_sequence
        // (including converted accounts, which keep their sequence after
        // is_guest is flipped to false). This guarantees uniqueness against
        // the partial unique index on guest_sequence.
        const [last] = await db
          .select({ seq: customersTable.guestSequence })
          .from(customersTable)
          .orderBy(desc(customersTable.guestSequence))
          .limit(1);
        const nextSeq = (last?.seq ?? 0) + 1 + attempt;
        const padded = String(nextSeq).padStart(4, "0");
        const username = `guestaccount${padded}`;
        const guestEmail = `${username}@trynex.guest`;
        // Auto-generated password = username (per guest-account contract)
        const guestPassword = username;
        const passwordHash = hashPassword(guestPassword);

        const [customer] = await db.insert(customersTable).values({
          name: `${safeName} #${padded}`,
          email: guestEmail,
          phone: phone?.trim() || null,
          passwordHash,
          isGuest: true,
          guestSequence: nextSeq,
          verified: false,
        }).returning();

        const token = signCustomerToken({ id: customer.id, email: customer.email });
        const isProduction = process.env.NODE_ENV === "production";
        res.cookie("customer_token", token, {
          httpOnly: true,
          sameSite: isProduction ? "none" : "lax",
          secure: isProduction,
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
        res.json({
          success: true,
          id: customer.id,
          username,
          password: guestPassword,
          token,
          customer: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            avatar: customer.avatar,
            username,
          },
          isGuest: true,
          guestSequence: nextSeq,
        });
        return;
      } catch (err) {
        lastErr = err;
        const code = (err as { code?: string } | null)?.code;
        const msg = String((err as { message?: string } | null)?.message ?? "");
        // Unique violation on email/sequence — retry with a higher sequence
        if (code === "23505" || /duplicate key|unique/i.test(msg)) {
          continue;
        }
        throw err;
      }
    }
    throw lastErr ?? new Error("Could not allocate guest sequence");
  } catch (err) {
    req.log.error({ err }, "Guest account creation failed");
    res.status(500).json({ error: "internal_error", message: failureReason(err, "Could not create a guest account right now. Please try again in a moment, or sign in with Google.") });
  }
});

// Diagnostic endpoint — returns ONLY booleans so future regressions can be
// debugged in one curl. Never returns secret values. Safe to expose.
router.get("/auth/health", async (_req, res) => {
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID);
  const jwtSecretPresent = Boolean(process.env.JWT_SECRET);
  const adminJwtSecretPresent = Boolean(process.env.ADMIN_JWT_SECRET);
  const allowedOriginsConfigured = Boolean(process.env.ALLOWED_ORIGINS);
  let dbReachable = false;
  let customersTableExists = false;
  let guestSequenceColumnExists = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbReachable = true;
    const tableCheck = await db.execute(
      sql`SELECT 1 FROM information_schema.tables WHERE table_name = 'customers' LIMIT 1`,
    );
    customersTableExists = (tableCheck as { rows?: unknown[] }).rows
      ? ((tableCheck as { rows: unknown[] }).rows.length > 0)
      : Array.isArray(tableCheck) && tableCheck.length > 0;
    const colCheck = await db.execute(
      sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'guest_sequence' LIMIT 1`,
    );
    guestSequenceColumnExists = (colCheck as { rows?: unknown[] }).rows
      ? ((colCheck as { rows: unknown[] }).rows.length > 0)
      : Array.isArray(colCheck) && colCheck.length > 0;
  } catch {
    // dbReachable stays false
  }
  res.json({
    google_configured: googleConfigured,
    jwt_secret_present: jwtSecretPresent,
    admin_jwt_secret_present: adminJwtSecretPresent,
    allowed_origins_configured: allowedOriginsConfigured,
    db_reachable: dbReachable,
    customers_table_exists: customersTableExists,
    guest_sequence_column_exists: guestSequenceColumnExists,
    node_env: process.env.NODE_ENV || "development",
  });
});

router.post("/auth/logout", (_req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("customer_token", {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  });
  res.json({ success: true });
});

router.put("/auth/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? req.cookies?.customer_token;
    if (!token) {
      res.status(401).json({ error: "unauthorized", message: "Not authenticated" });
      return;
    }

    const decoded = verifyCustomerToken(token);
    if (!decoded) {
      res.status(401).json({ error: "unauthorized", message: "Invalid token" });
      return;
    }

    const { name, phone } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone?.trim() || null;

    const [customer] = await db.update(customersTable)
      .set(updates)
      .where(eq(customersTable.id, decoded.id))
      .returning();

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatar: customer.avatar,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Profile update failed");
    res.status(500).json({ error: "internal_error", message: "Profile update failed" });
  }
});

export default router;
