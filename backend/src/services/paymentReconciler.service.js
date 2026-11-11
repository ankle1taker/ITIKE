import prisma from "../config/database.js";
import { pollAndReconcile } from "./payment.service.js";

const INTERVAL_MS = 60 * 1000;
const STALE_THRESHOLD_MS = 15 * 60 * 1000;
const LATE_SUCCESS_WINDOW_MS = 60 * 60 * 1000;

let timer = null;
let running = false;

const log = (...args) => console.log("[reconciler]", ...args);

const runOnce = async () => {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const pendingCutoff = new Date(now.getTime() - 30 * 1000);
    const failedCutoff = new Date(now.getTime() - LATE_SUCCESS_WINDOW_MS);

    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: pendingCutoff },
      },
      select: { id: true, createdAt: true, attemptNumber: true },
      take: 50,
    });

    for (const p of pendingPayments) {
      try {
        const ageMs = Date.now() - new Date(p.createdAt).getTime();
        if (ageMs > STALE_THRESHOLD_MS) {
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
              const otherActive = await tx.payment.count({
                where: {
                  bookingId: payment.bookingId,
                  status: { in: ["PENDING", "PROCESSING"] },
                  NOT: { id: p.id },
                },
              });
              if (otherActive === 0) {
                await tx.booking.updateMany({
                  where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
                  data: { status: "HELD" },
                });
              }
            }
            await tx.auditLog.create({
              data: {
                companyId: null,
                actorId: null,
                action: "PAYMENT_RECONCILER_TIMEOUT",
                entityType: "Payment",
                entityId: p.id,
                metadata: { ageMs, attemptNumber: p.attemptNumber },
              },
            });
          });
          log(`payment=${p.id} timeout after 15min`);
        } else {
          const result = await pollAndReconcile({ paymentId: p.id });
          if (result && !result.noop) {
            log(`payment=${p.id} reconciled status=${result.status}`);
          }
        }
      } catch (err) {
        log(`payment=${p.id} failed: ${err.message}`);
      }
    }

    // F12: late-success recovery â€” poll FAILED payments for 60 min
    const recentlyFailed = await prisma.payment.findMany({
      where: {
        status: "FAILED",
        updatedAt: { gte: failedCutoff },
      },
      select: { id: true, updatedAt: true, attemptNumber: true },
      take: 30,
    });

    for (const p of recentlyFailed) {
      try {
        const result = await pollAndReconcile({ paymentId: p.id });
        if (result && !result.noop) {
          log(`LATE-SUCCESS payment=${p.id} status=${result.status}`);
        }
      } catch (err) {
        log(`late-poll payment=${p.id} failed: ${err.message}`);
      }
    }
  } finally {
    running = false;
  }
};

export const startPaymentReconciler = () => {
  if (timer) return;
  log(`started (interval=${INTERVAL_MS}ms)`);
  runOnce().catch(() => {});
  timer = setInterval(runOnce, INTERVAL_MS);
};

export const stopPaymentReconciler = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log("stopped");
  }
};