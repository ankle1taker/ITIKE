import rateLimit from "express-rate-limit";

const handler = (req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
  });
};

// If RATE_LIMIT_DISABLED=true, all limiters become pass-through.
// Used ONLY in test environment. Never in production.
const disabled =
  process.env.RATE_LIMIT_DISABLED === "true" ||
  process.env.NODE_ENV === "test";

const passThrough = (req, res, next) => next();

const makeLimiter = (options) => {
  if (disabled) {
    return passThrough;
  }
  return rateLimit(options);
};

export const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skipSuccessfulRequests: true,
});

export const registerLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const companyRegisterLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const paymentLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});