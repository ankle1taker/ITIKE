import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { requireCompany } from "../middleware/tenant.middleware.js";
import {
  create,
  list,
  getById,
  update,
  updateStatus,
} from "../controllers/bus.controller.js";

const router = Router();

router.post(
  "/buses",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  create,
);

router.get(
  "/buses",
  authenticate,
  authorizeRoles(
    "COMPANY_ADMIN",
    "COMPANY_OPERATOR",
  ),
  requireCompany,
  list,
);

router.get(
  "/buses/:id",
  authenticate,
  authorizeRoles(
    "COMPANY_ADMIN",
    "COMPANY_OPERATOR",
  ),
  requireCompany,
  getById,
);

router.patch(
  "/buses/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  update,
);

router.patch(
  "/buses/:id/status",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  updateStatus,
);

export default router;
