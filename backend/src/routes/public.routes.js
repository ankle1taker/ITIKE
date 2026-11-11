import { Router } from "express";
import {
  search as searchTrips,
  detail as getPublicTrip,
} from "../controllers/tripSearch.controller.js";
import { list as listTripSeats } from "../controllers/tripSeatPublic.controller.js";
import { register as registerCompany } from "../controllers/companyRegistration.controller.js";

const router = Router();

// ---------- Public trip search ----------
router.get("/trips/search", searchTrips);
router.get("/trips/:id/seats", listTripSeats);
router.get("/trips/:id", getPublicTrip);

// ---------- Public company registration ----------
router.post("/companies/register", registerCompany);

export default router;