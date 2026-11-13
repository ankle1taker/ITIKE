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
import {
  create as createStaff,
  list as listStaff,
  getById as getStaffById,
  update as updateStaff,
  updateStatus as updateStaffStatus,
  resetPassword as resetStaffPassword,
} from "../controllers/staff.controller.js";
import {
  create as createTrip,
  list as listTrips,
  getById as getTripById,
  update as updateTrip,
  updateStatus as updateTripStatus,
} from "../controllers/trip.controller.js";
import {
  initialize as initializeTripSeats,
  list as listTripSeats,
} from "../controllers/tripSeat.controller.js";
import {
  create as createBranch,
  list as listBranches,
  getById as getBranchById,
  update as updateBranch,
  updateStatus as updateBranchStatus,
  transferBusToBranch,
} from "../controllers/branch.controller.js";
import { list as listTripManifest } from "../controllers/tripManifest.controller.js";

import cancellationPolicyRoutes from "./cancellation.routes.js";
import checkInRoutes from "./checkIn.routes.js";
import { companyAnalyticsRouter } from "./analytics.routes.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { requireCompany } from "../middleware/tenant.middleware.js";
import {
  requireCompanyAdmin,
  requireBranchAccess,
} from "../middleware/branch.middleware.js";

const router = Router();

// ---------- Branches ----------
router.post(
  "/branches",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompanyAdmin,
  createBranch,
);
router.get(
  "/branches",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireCompanyAdmin,
  listBranches,
);
router.get(
  "/branches/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireCompanyAdmin,
  getBranchById,
);
router.patch(
  "/branches/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompanyAdmin,
  updateBranch,
);
router.patch(
  "/branches/:id/status",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompanyAdmin,
  updateBranchStatus,
);

// ---------- Buses ----------
router.post(
  "/buses",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireBranchAccess,
  createBus,
);
router.get(
  "/buses",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireBranchAccess,
  listBuses,
);
router.get(
  "/buses/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireBranchAccess,
  getBusById,
);
router.patch(
  "/buses/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireBranchAccess,
  updateBus,
);
router.patch(
  "/buses/:id/status",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireBranchAccess,
  updateBusStatus,
);

// ---------- Bus transfer between branches ----------
router.post(
  "/buses/:busId/transfer-branch",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompanyAdmin,
  transferBusToBranch,
);

// ---------- Seats ----------
router.post(
  "/buses/:busId/seats",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireBranchAccess,
  createSeat,
);
router.get(
  "/buses/:busId/seats",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireBranchAccess,
  listSeats,
);
router.get(
  "/buses/:busId/seats/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireBranchAccess,
  getSeatById,
);
router.patch(
  "/buses/:busId/seats/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireBranchAccess,
  updateSeat,
);
router.patch(
  "/buses/:busId/seats/:id/status",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireBranchAccess,
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

// ---------- Staff ----------
router.post(
  "/staff",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompanyAdmin,
  createStaff,
);
router.get(
  "/staff",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompanyAdmin,
  listStaff,
);
router.get(
  "/staff/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompanyAdmin,
  getStaffById,
);
router.patch(
  "/staff/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompanyAdmin,
  updateStaff,
);
router.patch(
  "/staff/:id/status",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompanyAdmin,
  updateStaffStatus,
);
router.patch(
  "/staff/:id/password",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireCompanyAdmin,
  resetStaffPassword,
);

// ---------- Trips ----------
router.post(
  "/trips",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireBranchAccess,
  createTrip,
);
router.get(
  "/trips",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireBranchAccess,
  listTrips,
);
router.get(
  "/trips/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireBranchAccess,
  getTripById,
);
router.patch(
  "/trips/:id",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireBranchAccess,
  updateTrip,
);
router.patch(
  "/trips/:id/status",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireBranchAccess,
  updateTripStatus,
);

// ---------- Trip seats ----------
router.post(
  "/trips/:id/initialize-seats",
  authenticate,
  authorizeRoles("COMPANY_ADMIN"),
  requireBranchAccess,
  initializeTripSeats,
);
router.get(
  "/trips/:id/seats",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireBranchAccess,
  listTripSeats,
);

// ---------- Trip manifest ----------
router.get(
  "/trips/:tripId/bookings",
  authenticate,
  authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"),
  requireBranchAccess,
  listTripManifest,
);

// ---------- Cancellation Policy ----------
router.use("/cancellation-policy", cancellationPolicyRoutes);

// ---------- Tickets (check-in) ----------
router.use("/tickets", checkInRoutes);

// ---------- Analytics ----------
router.use("/analytics", companyAnalyticsRouter);

export default router;