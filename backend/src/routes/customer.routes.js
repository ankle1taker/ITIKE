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
import {
  getForBooking as getTicketForBooking,
  list as listMyTickets,
} from "../controllers/ticket.controller.js";
import { cancel as cancelBooking } from "../controllers/cancellation.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import {
  paymentLimiter,
  bookingCreateLimiter,
  cancelLimiter,
} from "../middleware/rateLimiter.middleware.js";

const router = Router();

// Bookings
router.post(
  "/bookings",
  authenticate,
  authorizeRoles("CUSTOMER"),
  bookingCreateLimiter,
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

// Cancellation
router.post(
  "/bookings/:id/cancel",
  authenticate,
  authorizeRoles("CUSTOMER"),
  cancelLimiter,
  cancelBooking,
);

// Payments
router.post(
  "/bookings/:id/pay",
  authenticate,
  authorizeRoles("CUSTOMER"),
  paymentLimiter,
  initiatePayment,
);
router.get(
  "/bookings/:id/payment",
  authenticate,
  authorizeRoles("CUSTOMER"),
  paymentStatus,
);
router.post(
  "/bookings/:id/payment/poll",
  authenticate,
  authorizeRoles("CUSTOMER"),
  pollPaymentStatus,
);

// Tickets
router.get(
  "/tickets",
  authenticate,
  authorizeRoles("CUSTOMER"),
  listMyTickets,
);
router.get(
  "/bookings/:id/ticket",
  authenticate,
  authorizeRoles("CUSTOMER"),
  getTicketForBooking,
);

export default router;