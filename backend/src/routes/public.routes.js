import { Router } from "express";
import {
  search as searchTrips,
  detail as getPublicTrip,
} from "../controllers/tripSearch.controller.js";
import { list as listTripSeats } from "../controllers/tripSeatPublic.controller.js";
import { register as registerCompany } from "../controllers/companyRegistration.controller.js";
import { companyRegisterLimiter } from "../middleware/rateLimiter.middleware.js";

const router = Router();

router.get("/trips/search", searchTrips);
router.get("/trips/:id/seats", listTripSeats);
router.get("/trips/:id", getPublicTrip);

router.post("/companies/register", companyRegisterLimiter, registerCompany);

export default router;