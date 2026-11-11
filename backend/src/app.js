import express from "express";
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

// Request ID first — every log entry after this can reference it
app.use(requestId);

// Structured request logging
app.use(httpLogger);

app.use(
  "/api/webhooks",
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  }),
  webhooksRoutes,
);

app.use(express.json());

app.get("/health", async (req, res) => {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startTime;

    // Optional: query queue depths if models exist
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

app.use("/api/auth", authRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api", publicRoutes);

app.use((error, req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const isDev = process.env.NODE_ENV !== "production";

  // Log with request ID
  req.log?.error({ err: error, requestId: req.requestId }, "Request error");

  // Send to Sentry if configured and it's a 500
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

// Fail fast if payment provider is misconfigured
getProvider();

// Fail fast if notification provider is misconfigured
getNotificationProvider();

// Background services
if (process.env.ENABLE_PAYMENT_RECONCILER === "true") {
  startPaymentReconciler();
}

if (process.env.ENABLE_NOTIFICATION_DISPATCHER !== "false") {
  startNotificationDispatcher();
}

export default app;