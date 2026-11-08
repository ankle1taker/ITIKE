import { Router } from "express";
import {
  create as createBooking,
  list as listMyBookings,
  getById as getMyBookingById,
  release as releaseBooking,
} from "../controllers/booking.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

// ---------- Customer bookings ----------
router.post(
  "/bookings",
  authenticate,
  authorizeRoles("CUSTOMER"),
  createBooking,
);

router.get(
  "/bookings",
  authenticate,
  authorizeRoles("CUSTOMER"),
  listMyBookings,
);

router.get(
  "/bookings/:id",
  authenticate,
  authorizeRoles("CUSTOMER"),
  getMyBookingById,
);

router.delete(
  "/bookings/:id",
  authenticate,
  authorizeRoles("CUSTOMER"),
  releaseBooking,
);

export default router;