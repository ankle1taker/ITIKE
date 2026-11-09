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
import cancellationPolicyRoutes from "./cancellation.routes.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { requireCompany } from "../middleware/tenant.middleware.js";

const router = Router();

// ---------- Buses ----------
router.post("/buses", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, createBus);
router.get("/buses", authenticate, authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"), requireCompany, listBuses);
router.get("/buses/:id", authenticate, authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"), requireCompany, getBusById);
router.patch("/buses/:id", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, updateBus);
router.patch("/buses/:id/status", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, updateBusStatus);

// ---------- Seats ----------
router.post("/buses/:busId/seats", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, createSeat);
router.get("/buses/:busId/seats", authenticate, authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"), requireCompany, listSeats);
router.get("/buses/:busId/seats/:id", authenticate, authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"), requireCompany, getSeatById);
router.patch("/buses/:busId/seats/:id", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, updateSeat);
router.patch("/buses/:busId/seats/:id/status", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, updateSeatStatus);

// ---------- Bus Layouts ----------
router.post("/bus-layouts", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, createBusLayout);
router.get("/bus-layouts", authenticate, authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"), requireCompany, listBusLayouts);
router.get("/bus-layouts/:id", authenticate, authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"), requireCompany, getBusLayoutById);
router.patch("/bus-layouts/:id", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, updateBusLayout);
router.patch("/bus-layouts/:id/status", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, updateBusLayoutStatus);

// ---------- Staff ----------
router.post("/staff", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, createStaff);
router.get("/staff", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, listStaff);
router.get("/staff/:id", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, getStaffById);
router.patch("/staff/:id", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, updateStaff);
router.patch("/staff/:id/status", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, updateStaffStatus);
router.patch("/staff/:id/password", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, resetStaffPassword);

// ---------- Trips ----------
router.post("/trips", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, createTrip);
router.get("/trips", authenticate, authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"), requireCompany, listTrips);
router.get("/trips/:id", authenticate, authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"), requireCompany, getTripById);
router.patch("/trips/:id", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, updateTrip);
router.patch("/trips/:id/status", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, updateTripStatus);

// ---------- Trip seats ----------
router.post("/trips/:id/initialize-seats", authenticate, authorizeRoles("COMPANY_ADMIN"), requireCompany, initializeTripSeats);
router.get("/trips/:id/seats", authenticate, authorizeRoles("COMPANY_ADMIN", "COMPANY_OPERATOR"), requireCompany, listTripSeats);

// ---------- Cancellation Policy ----------
router.use("/cancellation-policy", cancellationPolicyRoutes);

export default router;