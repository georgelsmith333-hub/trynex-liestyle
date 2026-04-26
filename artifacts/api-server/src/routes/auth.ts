import { Router, type IRouter } from "express";
import { db, customersTable, settingsTable, customerPasswordResetTokensTable } from "@workspace/db";
import { eq, or, desc, sql, and, gt, isNull } from "drizzle-orm";
import * as crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import {
  hashPasswordArgon2,
  verifyPasswordAny,
  isArgon2Hash,
} from "../lib/passwordHash";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, "token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
  newPassword: z.string().min(6, "newPassword must be at least 6 characters"),
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown): { ok: true; data: T } | { ok: false; message: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.errors.map((e) => e.message).join("; ");
    return { ok: false, message: msg };
  }
  return { ok: true, data: result.data };
}

function hasRows(result: unknown): boolean {
  if (Array.isArray(result)) return result.length > 0;
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown[] }).rows;
    return Array.isArray(rows) && rows.length > 0;
  }
  return false;
}

// Lazily-built Google OAuth verifier. Re-built only when the configured
// client ID changes. Verifies signature, issuer, audience, and expiry
// against Google's published public keys.
let googleClient: OAuth2Client | null = null;
let googleClientForId: string | null = null;
function getGoogleClient(clientId: string): OAuth2Client {
  if (googleClient && googleClientForId === clientId) return googleClient;
  googleClient = new OAuth2Client(clientId);
  googleClientForId = clientId;
  return googleClient;
}

// Resolve the active Google OAuth client ID. Admins typically configure
// this in the Site Settings panel (DB), so we MUST consult the settings
// table — falling back to the env var only when the DB row is absent.
export async function getConfiguredGoogleClientId(): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "googleClientId"))
      .limit(1);
    const dbValue = row?.value?.trim();
    if (dbValue) return dbValue;
  } catch {
    // Fall through to env fallback if the settings table is unreachable.
  }
  return (process.env.GOOGLE_CLIENT_ID || "").trim();
}

const router: IRouter = Router();

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable is required in production");
}
const JWT_SECRET = process.env.JWT_SECRET || "dev_only_secret_not_for_production";
const CUSTOMER_SALT = process.env.CUSTOMER_SALT || "trynex_customer_2024";
const IS_PROD = process.env.NODE_ENV === "production";

function failureReason(err: unknown, fallback: string): string {
  const e = err as { message?: string; code?: string } | null;
  const code = e?.code;
  const msg = e?.message ?? "";
  if (!IS_PROD && msg) return `${fallback} (${msg})`;
  if (code) return `${fallback} [${code}]`;
  return fallback;
}

function signCustomerToken(payload: { id: number; email: string }): string {
  return jwt.sign({ ...payload, role: "customer" }, JWT_SECRET, { expiresIn: "30d" });
}

function verifyCustomerToken(token: string): { id: number; email: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
    if (decoded.role !== "customer") return null;
    return decoded;
  } catch {
    return null;
  }
}

router.post("/auth/register", async (req, res) => {
  try {
    const parsed = parseBody(RegisterSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { name, email, phone, password } = parsed.data;

    const trimmedName = name.trim().replace(/\s+/g, " ");
    const nameRegex = /^[\p{L}][\p{L}\s'-]{1,49}$/u;
    if (trimmedName.length < 2 || /\d/.test(trimmedName) || /@/.test(trimmedName) || !nameRegex.test(trimmedName)) {
      res.status(400).json({ error: "validation_error", message: "Please enter a valid name (letters only, 2–50 characters)" });
      return;
    }

    if (phone && !/^[+\d][\d\s-]{6,18}$/.test(phone.trim())) {
      res.status(400).json({ error: "validation_error", message: "Invalid phone number" });
      return;
    }

    const existing = await db.select().from(customersTable).where(eq(customersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "conflict", message: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPasswordArgon2(password);
    const [customer] = await db.insert(customersTable).values({
      name: trimmedName,
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      passwordHash,
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
    const parsed = parseBody(LoginSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { email, password } = parsed.data;

    const [customer] = await db.select().from(customersTable).where(eq(customersTable.email, email.toLowerCase())).limit(1);

    if (!customer || !customer.passwordHash) {
      res.status(401).json({ error: "unauthorized", message: "Invalid email or password" });
      return;
    }

    const isValid = await verifyPasswordAny(customer.passwordHash, password, CUSTOMER_SALT);
    if (!isValid) {
      res.status(401).json({ error: "unauthorized", message: "Invalid email or password" });
      return;
    }

    // Transparent re-hash from SHA-256 → argon2id on successful login
    if (!isArgon2Hash(customer.passwordHash)) {
      const newHash = await hashPasswordArgon2(password);
      await db.update(customersTable)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(customersTable.id, customer.id));
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

    const expectedAud = await getConfiguredGoogleClientId();

    if (IS_PROD && !expectedAud) {
      res.status(503).json({ error: "google_not_configured", message: "Google sign-in is not configured on the server. Please contact support or use email login." });
      return;
    }

    let payload: Record<string, unknown>;
    if (expectedAud) {
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
    const parsed = parseBody(ChangePasswordSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { currentPassword, newPassword } = parsed.data;
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, decoded.id)).limit(1);
    if (!customer) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    if (!customer.passwordHash) {
      res.status(400).json({ error: "bad_request", message: "Password change not available for social login accounts. Please use Google or Facebook to sign in." });
      return;
    }
    const isValid = await verifyPasswordAny(customer.passwordHash, currentPassword, CUSTOMER_SALT);
    if (!isValid) {
      res.status(401).json({ error: "unauthorized", message: "Current password is incorrect" });
      return;
    }
    const newHash = await hashPasswordArgon2(newPassword);
    await db.update(customersTable)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(customersTable.id, decoded.id));
    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    req.log.error({ err }, "Change password failed");
    res.status(500).json({ error: "internal_error", message: "Failed to change password" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// Issues a one-time reset token. In production, this would be emailed to the
// user. Here we return the token in the response (admin integration pending).
// Body: { email }
// ---------------------------------------------------------------------------
router.post("/auth/forgot-password", async (req, res) => {
  try {
    const parsed = parseBody(ForgotPasswordSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { email } = parsed.data;
    const [customer] = await db.select().from(customersTable)
      .where(eq(customersTable.email, email.toLowerCase().trim()))
      .limit(1);

    // Always respond success to avoid user enumeration
    if (!customer || customer.isGuest || !customer.passwordHash) {
      res.json({ success: true, message: "If this email is registered, a reset link has been sent." });
      return;
    }

    // Invalidate previous tokens for this customer
    await db.update(customerPasswordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(customerPasswordResetTokensTable.customerId, customer.id),
          isNull(customerPasswordResetTokensTable.usedAt)
        )
      );

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(customerPasswordResetTokensTable).values({
      customerId: customer.id,
      tokenHash,
      expiresAt,
    });

    req.log.info({ customerId: customer.id }, "Password reset token issued");

    // In production, email the token. For now, return it in response (for frontend/admin use).
    res.json({
      success: true,
      message: "If this email is registered, a reset link has been sent.",
      // Only expose in non-production; in production this would be emailed
      ...(process.env.NODE_ENV !== "production" ? { resetToken: rawToken } : {}),
    });
  } catch (err) {
    req.log.error({ err }, "Forgot-password failed");
    res.status(500).json({ error: "internal_error", message: "Could not process request" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// Consumes the reset token and sets a new password.
// Body: { token, newPassword }
// ---------------------------------------------------------------------------
router.post("/auth/reset-password", async (req, res) => {
  try {
    const parsed = parseBody(ResetPasswordSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { token, newPassword } = parsed.data;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date();

    const [resetToken] = await db.select().from(customerPasswordResetTokensTable)
      .where(
        and(
          eq(customerPasswordResetTokensTable.tokenHash, tokenHash),
          isNull(customerPasswordResetTokensTable.usedAt),
          gt(customerPasswordResetTokensTable.expiresAt, now)
        )
      )
      .limit(1);

    if (!resetToken) {
      res.status(400).json({ error: "invalid_token", message: "Reset link is invalid or has expired. Please request a new one." });
      return;
    }

    const newHash = await hashPasswordArgon2(newPassword);
    await db.update(customersTable)
      .set({ passwordHash: newHash, updatedAt: now })
      .where(eq(customersTable.id, resetToken.customerId));

    await db.update(customerPasswordResetTokensTable)
      .set({ usedAt: now })
      .where(eq(customerPasswordResetTokensTable.id, resetToken.id));

    res.json({ success: true, message: "Password reset successfully. You can now sign in with your new password." });
  } catch (err) {
    req.log.error({ err }, "Reset-password failed");
    res.status(500).json({ error: "internal_error", message: "Could not reset password" });
  }
});

router.post("/auth/guest", async (req, res) => {
  try {
    const { name, phone } = (req.body ?? {}) as { name?: string; phone?: string };
    const safeName = (name?.trim() || "Guest");

    const MAX_TRIES = 5;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      try {
        const result = await db.execute(
          sql`SELECT MAX(guest_sequence) AS seq FROM customers`,
        );
        const rows = (result as unknown as { rows?: Array<{ seq: number | null }> }).rows
          ?? (result as unknown as Array<{ seq: number | null }>);
        const lastSeq = (rows?.[0]?.seq as number | null) ?? 0;
        const nextSeq = lastSeq + 1 + attempt;
        const padded = String(nextSeq).padStart(4, "0");
        const username = `guestaccount${padded}`;
        const guestEmail = `${username}@trynex.guest`;
        const guestPassword = username;
        const passwordHash = await hashPasswordArgon2(guestPassword);

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

router.get("/auth/health", async (_req, res) => {
  const googleConfigured = Boolean(await getConfiguredGoogleClientId());
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
    customersTableExists = hasRows(tableCheck);
    const colCheck = await db.execute(
      sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'guest_sequence' LIMIT 1`,
    );
    guestSequenceColumnExists = hasRows(colCheck);
  } catch {
    // ignore
  }
  res.json({
    ok: dbReachable,
    googleConfigured,
    jwtSecretPresent,
    adminJwtSecretPresent,
    allowedOriginsConfigured,
    dbReachable,
    customersTableExists,
    guestSequenceColumnExists,
  });
});

router.post("/auth/logout", async (req, res) => {
  res.clearCookie("customer_token");
  res.json({ success: true, message: "Logged out" });
});

export default router;
