import { Router } from "express";
import { verify } from "../controllers/ticket.controller.js";

const router = Router();

// Public QR verification — no auth required.
// Returns ticket status + trip summary. No PII.
router.post("/verify", verify);

export default router;