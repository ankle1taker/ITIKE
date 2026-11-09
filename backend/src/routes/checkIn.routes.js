import { Router } from "express";
import { checkIn } from "../controllers/checkIn.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { requireCompany } from "../middleware/tenant.middleware.js";

const router = Router();

router.post(
  "/:ticketNumber/check-in",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireCompany,
  checkIn,
);

export default router;