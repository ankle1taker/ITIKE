import { Router } from "express";
import {
  register,
  login,
  me,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  loginLimiter,
  registerLimiter,
} from "../middleware/rateLimiter.middleware.js";

const router = Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.get("/me", authenticate, me);

export default router;