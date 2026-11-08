import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import {
  create as createCompany,
  list as listCompanies,
  getById as getCompanyById,
  update as updateCompany,
  updateStatus as updateCompanyStatus,
} from "../controllers/company.controller.js";
import {
  create as createRoute,
  list as listRoutes,
  getById as getRouteById,
  update as updateRoute,
  updateStatus as updateRouteStatus,
  replaceStops as replaceRouteStops,
} from "../controllers/route.controller.js";
import { sweep as sweepBookings } from "../controllers/bookingSweep.controller.js";

const router = Router();

// ---------- Companies ----------
router.post("/companies", authenticate, authorizeRoles("PLATFORM_ADMIN"), createCompany);
router.get("/companies", authenticate, authorizeRoles("PLATFORM_ADMIN"), listCompanies);
router.get("/companies/:id", authenticate, authorizeRoles("PLATFORM_ADMIN"), getCompanyById);
router.patch("/companies/:id", authenticate, authorizeRoles("PLATFORM_ADMIN"), updateCompany);
router.patch("/companies/:id/status", authenticate, authorizeRoles("PLATFORM_ADMIN"), updateCompanyStatus);

// ---------- Routes ----------
router.post("/routes", authenticate, authorizeRoles("PLATFORM_ADMIN"), createRoute);
router.get("/routes", authenticate, authorizeRoles("PLATFORM_ADMIN"), listRoutes);
router.get("/routes/:id", authenticate, authorizeRoles("PLATFORM_ADMIN"), getRouteById);
router.patch("/routes/:id", authenticate, authorizeRoles("PLATFORM_ADMIN"), updateRoute);
router.patch("/routes/:id/status", authenticate, authorizeRoles("PLATFORM_ADMIN"), updateRouteStatus);
router.put("/routes/:id/stops", authenticate, authorizeRoles("PLATFORM_ADMIN"), replaceRouteStops);

// ---------- Bookings (admin ops) ----------
router.post("/bookings/sweep", authenticate, authorizeRoles("PLATFORM_ADMIN"), sweepBookings);

export default router;