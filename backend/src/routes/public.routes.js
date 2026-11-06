import { Router } from "express";
import {
  search as searchTrips,
  detail as getPublicTrip,
} from "../controllers/tripSearch.controller.js";

const router = Router();

// ---------- Public trip search ----------
// No authentication — customers can search and view trips before signing in.
router.get("/trips/search", searchTrips);
router.get("/trips/:id", getPublicTrip);

export default router;