import { Router } from "express";
import { webhook } from "../controllers/payment.controller.js";

const router = Router();

// POST /api/webhooks/:provider — public, no auth
// Signature verification happens inside the provider adapter.
router.post("/:provider", webhook);

export default router;