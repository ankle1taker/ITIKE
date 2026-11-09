import { Router } from "express";
import {
  companyOverview,
  platformOverview,
} from "../controllers/analytics.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { requireCompany } from "../middleware/tenant.middleware.js";

// Company analytics — mounted under /api/company/analytics
export const companyAnalyticsRouter = Router();
companyAnalyticsRouter.get(
  "/overview",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireCompany,
  companyOverview,
);

// Platform analytics — mounted under /api/platform/analytics
export const platformAnalyticsRouter = Router();
platformAnalyticsRouter.get(
  "/overview",
  authenticate,
  authorizeRoles("PLATFORM_ADMIN"),
  platformOverview,
);