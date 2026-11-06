import { Router } from "express";
import {
  create as createBus,
  list as listBuses,
  getById as getBusById,
  update as updateBus,
  updateStatus as updateBusStatus,
} from "../controllers/bus.controller.js";
import {
  create as createSeat,
  list as listSeats,
  getById as getSeatById,
  update as updateSeat,
  updateStatus as updateSeatStatus,
} from "../controllers/seat.controller.js";
import {
  create as createBusLayout,
  list as listBusLayouts,
  getById as getBusLayoutById,
  update as updateBusLayout,
  updateStatus as updateBusLayoutStatus,
} from "../controllers/busLayout.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { requireCompany } from "../middleware/tenant.middleware.js";

const router = Router();

// ---------- Buses ----------
router.post(
  "/buses",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  createBus,
);

router.get(
  "/buses",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireCompany,
  listBuses,
);

router.get(
  "/buses/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireCompany,
  getBusById,
);

router.patch(
  "/buses/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  updateBus,
);

router.patch(
  "/buses/:id/status",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  updateBusStatus,
);

// ---------- Seats ----------
router.post(
  "/buses/:busId/seats",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  createSeat,
);

router.get(
  "/buses/:busId/seats",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireCompany,
  listSeats,
);

router.get(
  "/buses/:busId/seats/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireCompany,
  getSeatById,
);

router.patch(
  "/buses/:busId/seats/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  updateSeat,
);

router.patch(
  "/buses/:busId/seats/:id/status",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  updateSeatStatus,
);

// ---------- Bus Layouts ----------
router.post(
  "/bus-layouts",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  createBusLayout,
);

router.get(
  "/bus-layouts",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireCompany,
  listBusLayouts,
);

router.get(
  "/bus-layouts/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireCompany,
  getBusLayoutById,
);

router.patch(
  "/bus-layouts/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  updateBusLayout,
);

router.patch(
  "/bus-layouts/:id/status",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompany,
  updateBusLayoutStatus,
);

export default router;