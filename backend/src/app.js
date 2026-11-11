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

const app = express();

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
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      service: "Itike API",
      status: "healthy",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(503).json({
      success: false,
      service: "Itike API",
      status: "unhealthy",
      database: "disconnected",
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
  console.error(error);

  if (error.name === "ZodError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: error.issues,
    });
  }

  const statusCode = error.statusCode || 500;
  const isDev = process.env.NODE_ENV !== "production";

  const body = {
    success: false,
    message:
      statusCode === 500
        ? isDev
          ? error.message || String(error)
          : "Internal server error."
        : error.message,
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