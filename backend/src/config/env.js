/**
 * Environment validation. Called at startup (server.js).
 *
 * Three classes of checks:
 * - REQUIRED: missing → hard exit (can't run without them)
 * - RECOMMENDED: missing → warning (degraded but functional)
 * - PRODUCTION GUARDS: unsafe configuration in production → hard exit
 */

const REQUIRED = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
];

const RECOMMENDED = [
  "PAYMENT_PROVIDER",
  "MOCK_WEBHOOK_SECRET",
  "NOTIFICATION_PROVIDER",
  "TICKET_QR_SECRET",
  "FRONTEND_URL",
];

export const validateEnv = () => {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error("[env] FATAL — missing required env vars:");
    missing.forEach((k) => console.error(`  - ${k}`));
    console.error("[env] Add them to .env and restart.");
    process.exit(1);
  }

  const recommendedMissing = RECOMMENDED.filter((k) => !process.env[k]);
  if (recommendedMissing.length > 0) {
    console.warn("[env] WARNING — missing recommended env vars:");
    recommendedMissing.forEach((k) => console.warn(`  - ${k}`));
  }

  const nodeEnv = process.env.NODE_ENV || "development";

  // -------- PRODUCTION GUARDS --------
  if (nodeEnv === "production") {
    const productionFailures = [];

    // 1. Payment provider must be real
    if (process.env.PAYMENT_PROVIDER === "mock") {
      productionFailures.push(
        "PAYMENT_PROVIDER=mock is not allowed in production",
      );
    }

    // 2. Rate limiting must be enabled
    if (process.env.RATE_LIMIT_DISABLED === "true") {
      productionFailures.push(
        "RATE_LIMIT_DISABLED=true is not allowed in production",
      );
    }

    // 3. Sentry must be configured (silent errors are worse than crashes)
    if (!process.env.SENTRY_DSN) {
      productionFailures.push(
        "SENTRY_DSN is required in production (error tracking must be active)",
      );
    }

    // 4. Trust proxy must be explicit (rate limiting depends on it)
    if (!process.env.TRUST_PROXY) {
      productionFailures.push(
        "TRUST_PROXY is required in production (1 for single proxy, 2 for CDN+proxy, false if no proxy)",
      );
    }

    // 5. Frontend URL must be set (CORS depends on it)
    if (!process.env.FRONTEND_URL) {
      productionFailures.push(
        "FRONTEND_URL is required in production (for CORS allowlist)",
      );
    }

    if (productionFailures.length > 0) {
      console.error("[env] FATAL — unsafe production configuration:");
      productionFailures.forEach((msg) => console.error(`  - ${msg}`));
      process.exit(1);
    }

    // Notification provider=warn only (SMS is optional at launch)
    if (process.env.NOTIFICATION_PROVIDER === "mock") {
      console.warn(
        "[env] WARNING — NOTIFICATION_PROVIDER=mock in production. SMS will be logged, not delivered.",
      );
    }
  }

  console.log(`[env] validated OK (NODE_ENV=${nodeEnv})`);
};