import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { validateAdminSession } from "./lib/adminSessions";

const app: Express = express();

app.set("trust proxy", 1);

// Security headers — protects against clickjacking, MIME sniffing, XSS,
// referrer leaks, etc. CSP is disabled at the API layer because this
// service only emits JSON; the storefront sets its own CSP.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
    hsts: process.env.NODE_ENV === "production"
      ? { maxAge: 60 * 60 * 24 * 365, includeSubDomains: true, preload: true }
      : false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS allowlist resolution.
//
// Priority:
//   1. `ALLOWED_ORIGINS` env var (comma-separated) — the operator's
//      explicit list, used in production.
//   2. A built-in safe default that contains ONLY the production
//      storefront origin and explicit local-dev origins. Critically,
//      the default contains NO Replit-hosted origins — production must
//      stay independent of any *.replit.dev / *.repl.co host.
//
// In production (`NODE_ENV === "production"`) we additionally require
// `ALLOWED_ORIGINS` to be configured so a misconfigured deploy can't
// silently fall back to a permissive policy.
const DEFAULT_DEV_ORIGINS = [
  "https://trynexshop.com",
  "http://localhost:5173",
  "http://localhost:8081",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8081",
];

const allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : DEFAULT_DEV_ORIGINS;

if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
  logger.error(
    "ALLOWED_ORIGINS env var is not set in production. Refusing to start with a permissive CORS fallback.",
  );
  throw new Error("ALLOWED_ORIGINS must be configured in production");
}

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Same-origin / non-browser requests (curl, server-to-server)
      // have no Origin header — allow them.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many requests, please try again later" },
});

// Aggressive rate limit for the admin login endpoint specifically. The
// admin password is a single shared secret, so brute-forcing it is the
// realistic attack. 8 attempts per IP per 15 minutes is more than enough
// for a legitimate operator who fat-fingered their password.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many login attempts, please try again in 15 minutes" },
});

const orderLimiter = rateLimit({
  // Production-tuned: 30 orders / 15 min per IP. The previous value (10)
  // was tripping legitimate customers behind shared NATs (mobile carriers,
  // offices) and made admin-side test orders impossible during deploys.
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // Admin-authenticated requests bypass the limiter entirely so the
  // operator can place test orders without burning through the budget.
  // We *fully verify* the JWT — a stray "Bearer x" header from an
  // anonymous client must NOT be enough to bypass the limit.
  skip: async (req) => {
    const auth = req.headers.authorization;
    if (!auth) return false;
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    if (!m) return false;
    return (await validateAdminSession(m[1].trim())) !== null;
  },
  message: {
    error: "rate_limited",
    message: "Too many orders from this network in the last 15 minutes. Please wait a few minutes and try again, or message us on WhatsApp to place your order directly.",
  },
});

const promoLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many promo requests, please try again later" },
});

// Order tracking: prevent enumeration attacks (probing TN-XXXXX numbers
// + phones to leak order details). 20 lookups / 5 min per IP is plenty
// for a real customer who's just refreshing their tracking page.
const trackLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many tracking requests. Please wait a few minutes." },
});

// Public-read endpoints: prevents bot scraping abuse without affecting
// legitimate users (200 reads / 5 min per IP = ~40/min).
const publicReadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Slow down — too many requests." },
});

// Review submissions: 5 per 10 minutes per IP is more than enough for a
// legitimate buyer. Prevents spam review campaigns.
const reviewSubmitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many review submissions. Please try again in 10 minutes." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/google", authLimiter);
app.use("/api/auth/facebook", authLimiter);
app.use("/api/auth/guest", authLimiter);
app.use("/api/admin/login", adminLoginLimiter);
app.use("/api/admin/reset-password", adminLoginLimiter);
app.post("/api/orders", orderLimiter);
app.use("/api/promo-codes/validate", promoLimiter);
app.use("/api/promo-codes/exit-intent", promoLimiter);
app.use("/api/orders/track", trackLimiter);
// Public-read limiter is applied to whole prefixes so it covers
// list, detail, and related-item routes (e.g. /api/products/:id,
// /api/blog/:id/related, /api/reviews/:productId).
app.use("/api/products", publicReadLimiter);
app.use("/api/categories", publicReadLimiter);
app.use("/api/blog", publicReadLimiter);
app.use("/api/reviews", publicReadLimiter);
app.post("/api/reviews", reviewSubmitLimiter);

app.use("/api", (_req, res, next) => {
  const url = _req.originalUrl;

  if (url.includes("/sitemap.xml") || url.includes("/robots.txt")) {
    return next();
  }

  if (_req.method === "GET") {
    if (
      url.includes("/products") ||
      url.includes("/categories") ||
      url.includes("/blog") ||
      url.includes("/testimonials") ||
      url.includes("/settings")
    ) {
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    } else {
      res.setHeader("Cache-Control", "private, no-cache");
    }
  }

  if (
    _req.method === "POST" ||
    _req.method === "PUT" ||
    _req.method === "PATCH" ||
    _req.method === "DELETE"
  ) {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
});

app.use("/api", router);

import sitemapRouter from "./routes/sitemap";
app.use("/", sitemapRouter);

// Catch-all 404 for unmatched API routes
app.use("/api/{*path}", (_req, res) => {
  res.status(404).json({ error: "not_found", message: "Route not found" });
});

// Global Express error handler — catches any error thrown/passed via next(err)
// in route handlers. Without this, unhandled errors produce a 500 with an
// Express HTML page instead of a clean JSON body.
app.use((err: unknown, req: any, res: any, _next: any) => {
  const message = err instanceof Error ? err.message : "An unexpected error occurred";
  const isCors = message.startsWith("CORS:");
  if (!isCors) {
    logger.error({ err, url: req.url, method: req.method }, "Unhandled error");
  }
  if (res.headersSent) return;
  res.status(isCors ? 403 : 500).json({
    error: isCors ? "cors_error" : "internal_error",
    message,
  });
});

export default app;
