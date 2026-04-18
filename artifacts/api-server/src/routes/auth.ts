import { Router, type IRouter } from "express";
import { db, customersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import * as crypto from "crypto";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_only_secret_not_for_production";
const CUSTOMER_SALT = process.env.CUSTOMER_SALT || "trynex_customer_2024";

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
  } catch {
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
    res.status(500).json({ error: "internal_error", message: "Registration failed" });
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
    res.status(500).json({ error: "internal_error", message: "Login failed" });
  }
});

router.post("/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      res.status(400).json({ error: "validation_error", message: "Google credential is required" });
      return;
    }

    const parts = credential.split(".");
    if (parts.length !== 3) {
      res.status(400).json({ error: "validation_error", message: "Invalid credential format" });
      return;
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    const { sub: googleId, email, name, picture } = payload;

    if (!email || !googleId) {
      res.status(400).json({ error: "validation_error", message: "Invalid Google token payload" });
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
    res.status(500).json({ error: "internal_error", message: "Google login failed" });
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
