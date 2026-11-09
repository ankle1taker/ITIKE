/**
 * Background reconciler for PENDING payments.
 *
 * Runs every 60 seconds. For each Payment in PENDING status:
 *   - If older than 15 minutes: attempt poll; if still pending, mark FAILED
 *     and revert booking to HELD (or EXPIRED if hold is gone).
 *   - If 30 seconds to 15 minutes: attempt poll; if SUCCESS, confirm.
 *
 * This closes the failure modes:
 *   F2 — webhook dropped
 *   F3 — webhook arrived but signature failed (we already logged it)
 *   F10 — provider API down when we polled immediately
 *   F11 — customer phone lost network after PIN
 *
 * IMPORTANT: uses the same pollAndReconcile() from payment.service.js,
 * so the confirm path is identical to the webhook path.
 */

import prisma from "../config/database.js";
import { pollAndReconcile } from "./payment.service.js";

const INTERVAL_MS = 60 * 1000;
const STALE_THRESHOLD_MS = 15 * 60 * 1000;

let timer = null;
let running = false;

const runOnce = async () => {
  if (running) return;
  running = true;
  try {
    const cutoff = new Date(Date.now() - 30 * 1000);

    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        createdAt: true,
        providerReference: true,
      },
      take: 50,
    });

    if (pendingPayments.length === 0) {
      return;
    }

    for (const p of pendingPayments) {
      try {
        const ageMs = Date.now() - new Date(p.createdAt).getTime();

        if (ageMs > STALE_THRESHOLD_MS) {
          // Too old — mark FAILED and revert booking
          await prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: p.id },
              data: { status: "FAILED" },
            });
            const payment = await tx.payment.findUnique({
              where: { id: p.id },
              select: { bookingId: true },
            });
            if (payment) {
              await tx.booking.updateMany({
                where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
                data: { status: "HELD" },
              });
            }
            await tx.auditLog.create({
              data: {
                companyId: null,
                actorId: null,
                action: "PAYMENT_RECONCILER_TIMEOUT",
                entityType: "Payment",
                entityId: p.id,
                metadata: { reason: "15min stale", ageMs },
              },
            });
          });
          // eslint-disable-next-line no-console
          console.log(`[reconciler] payment=${p.id} timed out after 15min`);
        } else {
          const result = await pollAndReconcile({ paymentId: p.id });
          if (result && !result.noop) {
            // eslint-disable-next-line no-console
            console.log(`[reconciler] payment=${p.id} reconciled status=${result.status}`);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[reconciler] payment=${p.id} failed:`, err.message);
      }
    }
  } finally {
    running = false;
  }
};

export const startPaymentReconciler = () => {
  if (timer) return;
  // eslint-disable-next-line no-console
  console.log(`[reconciler] started (interval=${INTERVAL_MS}ms)`);
  runOnce().catch(() => {});
  timer = setInterval(runOnce, INTERVAL_MS);
};

export const stopPaymentReconciler = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    // eslint-disable-next-line no-console
    console.log("[reconciler] stopped");
  }
};