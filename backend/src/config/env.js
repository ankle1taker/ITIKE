/**
 * Environment validation. Called at startup.
 * If any required var is missing, exit(1) before the server starts.
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
  if (nodeEnv === "production") {
    if (process.env.PAYMENT_PROVIDER === "mock") {
      console.error("[env] FATAL — PAYMENT_PROVIDER=mock is not allowed in production.");
      process.exit(1);
    }
    if (process.env.NOTIFICATION_PROVIDER === "mock") {
      console.warn("[env] WARNING — NOTIFICATION_PROVIDER=mock in production. SMS will be logged, not delivered.");
    }
  }

  console.log(`[env] validated OK (NODE_ENV=${nodeEnv})`);
};