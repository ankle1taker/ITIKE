import rateLimit from "express-rate-limit";

const handler = (req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
  });
};

// If RATE_LIMIT_DISABLED=true, all limiters become pass-through.
// Used ONLY in test/dev. Production guard in config/env.js prevents this.
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

// -------------------- IP-BASED LIMITERS --------------------
// Used for unauthenticated endpoints (login, register, public register).

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

// -------------------- USER-BASED LIMITERS --------------------
// Used for authenticated endpoints where the user is known.
// Falls back to IP if req.user is somehow not set (shouldn't happen
// after authenticate middleware runs, but defensive).

const userKeyGenerator = (req) => {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  // Fallback — req.ip respects trust proxy setting
  return `ip:${req.ip}`;
};

export const paymentLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  keyGenerator: userKeyGenerator,
});

// Booking creation: customer-driven, per-user, prevents automated bulk booking
export const bookingCreateLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  keyGenerator: userKeyGenerator,
});

// Cancellation: per-user, prevents accidental double-clicks and abuse
export const cancelLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  keyGenerator: userKeyGenerator,
});