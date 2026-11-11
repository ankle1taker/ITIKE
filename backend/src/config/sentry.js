import * as Sentry from "@sentry/node";

let initialized = false;

export const initSentry = () => {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log("[sentry] SENTRY_DSN not set — error tracking disabled (dev-safe)");
    initialized = true;
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    // Don't send PII to Sentry
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });

  console.log(`[sentry] initialized (env=${process.env.NODE_ENV || "development"})`);
  initialized = true;
};

export const captureException = (err, context) => {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(err, { extra: context });
};

export { Sentry };