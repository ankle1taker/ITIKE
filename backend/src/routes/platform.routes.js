import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import {
  create,
  list,
  getById,
  update,
  updateStatus,
} from "../controllers/company.controller.js";

const router = Router();

router.post(
  "/companies",
  authenticate,
  authorizeRoles("PLATFORM_ADMIN"),
  create,
);

router.get(
  "/companies",
  authenticate,
  authorizeRoles("PLATFORM_ADMIN"),
  list,
);

router.get(
  "/companies/:id",
  authenticate,
  authorizeRoles("PLATFORM_ADMIN"),
  getById,
);

router.patch(
  "/companies/:id",
  authenticate,
  authorizeRoles("PLATFORM_ADMIN"),
  update,
);

router.patch(
  "/companies/:id/status",
  authenticate,
  authorizeRoles("PLATFORM_ADMIN"),
  updateStatus,
);

export default router;