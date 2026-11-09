import { Router } from "express";
import {
  getPolicy,
  updatePolicy,
} from "../controllers/cancellation.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { requireCompany } from "../middleware/tenant.middleware.js";

const router = Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireCompany,
  getPolicy,
);

router.put(
  "/",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  updatePolicy,
);

export default router;