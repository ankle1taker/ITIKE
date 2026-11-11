import "dotenv/config";
import { validateEnv } from "./config/env.js";
import { initSentry } from "./config/sentry.js";
import { logger } from "./middleware/logger.middleware.js";

validateEnv();
initSentry();

const { default: app } = await import("./app.js");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Itike API running on http://localhost:${PORT}`);
});

const shutdown = (signal) => {
  logger.info(`[shutdown] ${signal} received — closing server`);

  const timer = setTimeout(() => {
    logger.error("[shutdown] forced exit after 30s");
    process.exit(1);
  }, 30000);

  server.close((err) => {
    clearTimeout(timer);
    if (err) {
      logger.error({ err }, "[shutdown] error closing server");
      process.exit(1);
    }
    logger.info("[shutdown] server closed cleanly");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error({ err }, "[fatal] uncaughtException");
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (err) => {
  logger.error({ err }, "[fatal] unhandledRejection");
  shutdown("unhandledRejection");
});