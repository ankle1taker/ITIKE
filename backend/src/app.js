import express from "express";
import cors from "cors";

import prisma from "./config/database.js";

import authRoutes from "./routes/auth.routes.js";
import platformRoutes from "./routes/platform.routes.js";
import companyRoutes from "./routes/company.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import publicRoutes from "./routes/public.routes.js";
import webhooksRoutes from "./routes/webhooks.routes.js";
import ticketsRoutes from "./routes/tickets.routes.js";

import { getProvider } from "./services/payments/index.js";
import { startPaymentReconciler } from "./services/paymentReconciler.service.js";
import { startNotificationDispatcher } from "./services/notificationDispatcher.service.js";
import { getProvider as getNotificationProvider } from "./services/notifications/index.js";

import { requestId } from "./middleware/requestId.middleware.js";
import { httpLogger, logger } from "./middleware/logger.middleware.js";
import { captureException } from "./config/sentry.js";

const app = express();

// -------------------- TRUST PROXY --------------------
// Rate limiting and req.ip depend on this being correct.
// - No proxy (local dev / single server): "false"
// - Single proxy (Vercel/Render/Railway): "1"
// - CDN + proxy (Cloudflare + Nginx): "2"
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === "false" || trustProxy === undefined) {
  app.set("trust proxy", false);
} else if (!Number.isNaN(Number(trustProxy))) {
  app.set("trust proxy", Number(trustProxy));
} else {
  app.set("trust proxy", trustProxy); // e.g., "loopback"
}

// -------------------- CORS --------------------
// Only allow configured frontend origins. Requests without Origin header
// (curl, mobile apps, webhooks) bypass CORS — that's expected.
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin (server-to-server, curl, mobile) → allow
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true, // allow cookies (for frontend cookie auth later)
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-mock-signature",
    ],
    exposedHeaders: ["x-request-id", "ratelimit-limit", "ratelimit-remaining"],
    maxAge: 600,
  }),
);

// -------------------- REQUEST ID + LOGGING --------------------
app.use(requestId);
app.use(httpLogger);

// -------------------- WEBHOOKS (before express.json) --------------------
// Webhooks need raw body for signature verification.
app.use(
  "/api/webhooks",
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  }),
  webhooksRoutes,
);

// -------------------- JSON BODY PARSER --------------------
app.use(express.json());

// -------------------- HEALTH --------------------
app.get("/health", async (req, res) => {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startTime;

    let pendingNotifications = 0;
    try {
      pendingNotifications = await prisma.notification.count({
        where: { status: "PENDING" },
      });
    } catch {
      // Notification model may not exist in some envs
    }

    res.status(200).json({
      success: true,
      service: "Itike API",
      status: "healthy",
      uptimeSeconds: Math.floor(process.uptime()),
      database: { status: "connected", latencyMs: dbLatency },
      queues: { pendingNotifications },
    });
  } catch (error) {
    logger.error({ err: error }, "Database health check failed");
    res.status(503).json({
      success: false,
      service: "Itike API",
      status: "unhealthy",
      database: { status: "disconnected" },
    });
  }
});

// -------------------- ROUTES --------------------
app.use("/api/auth", authRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api", publicRoutes);

// -------------------- ERROR HANDLER --------------------
app.use((error, req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const isDev = process.env.NODE_ENV !== "production";

  req.log?.error({ err: error, requestId: req.requestId }, "Request error");

  if (statusCode === 500) {
    captureException(error, { requestId: req.requestId, path: req.path });
  }

  if (error.name === "ZodError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: error.issues,
      requestId: req.requestId,
    });
  }

  const body = {
    success: false,
    message:
      statusCode === 500
        ? isDev
          ? error.message || String(error)
          : "Internal server error."
        : error.message,
    requestId: req.requestId,
  };

  if (isDev && statusCode === 500) {
    body.debug = {
      name: error.name,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    };
  }

  if (error.unavailableSeatIds) {
    body.unavailableSeatIds = error.unavailableSeatIds;
  }

  res.status(statusCode).json(body);
});

// -------------------- STARTUP CHECKS --------------------
getProvider();
getNotificationProvider();

if (process.env.ENABLE_PAYMENT_RECONCILER === "true") {
  startPaymentReconciler();
}

if (process.env.ENABLE_NOTIFICATION_DISPATCHER !== "false") {
  startNotificationDispatcher();
}

export default app;