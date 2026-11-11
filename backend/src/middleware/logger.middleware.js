import pino from "pino";
import pinoHttp from "pino-http";

const level = process.env.LOG_LEVEL || "info";

export const logger = pino({
  level,
  base: {
    service: "itike-api",
    env: process.env.NODE_ENV || "development",
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.accessToken",
    ],
    remove: true,
  },
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    // Use the ID set by requestId middleware (already on req)
    return req.requestId || "unknown";
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} — ${err.message}`;
  },
  autoLogging: {
    ignore: (req) => {
      // Don't log health checks (noise)
      return req.url === "/health";
    },
  },
});