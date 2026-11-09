import { Router } from "express";
import {
  create as createBooking,
  list as listMyBookings,
  getById as getMyBookingById,
  release as releaseBooking,
} from "../controllers/booking.controller.js";
import {
  initiate as initiatePayment,
  status as paymentStatus,
  pollStatus as pollPaymentStatus,
} from "../controllers/payment.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

// ---------- Customer bookings ----------
router.post("/bookings", authenticate, authorizeRoles("CUSTOMER"), createBooking);
router.get("/bookings", authenticate, authorizeRoles("CUSTOMER"), listMyBookings);
router.get("/bookings/:id", authenticate, authorizeRoles("CUSTOMER"), getMyBookingById);
router.delete("/bookings/:id", authenticate, authorizeRoles("CUSTOMER"), releaseBooking);

// ---------- Customer payments ----------
router.post("/bookings/:id/pay", authenticate, authorizeRoles("CUSTOMER"), initiatePayment);
router.get("/bookings/:id/payment", authenticate, authorizeRoles("CUSTOMER"), paymentStatus);
router.post("/bookings/:id/payment/poll", authenticate, authorizeRoles("CUSTOMER"), pollPaymentStatus);

export default router;