import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

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

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : null;

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!allowedOrigins) return callback(null, true);
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

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many order requests, please try again later" },
});

const promoLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many promo requests, please try again later" },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/google", authLimiter);
app.use("/api/auth/facebook", authLimiter);
app.post("/api/orders", orderLimiter);
app.use("/api/promo-codes/validate", promoLimiter);
app.use("/api/promo-codes/exit-intent", promoLimiter);

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

export default app;
