import prisma from "../config/database.js";
import { getProvider } from "./payments/index.js";

const HOLD_EXTENSION_MINUTES = 10; // Q1=b
const MAX_REFUND_LOOKBACK_MINUTES = 15; // Q5=b

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateId = (id, fieldName = "ID") => {
  if (!id || typeof id !== "string") {
    throw createError(`${fieldName} is required.`, 400);
  }
};

/**
 * Initiate a payment for a HELD booking.
 *
 * - Only the owning customer can initiate.
 * - Booking must be HELD.
 * - Booking must not be expired.
 * - Must not have an existing Payment row.
 *
 * On success:
 *  - Creates Payment (status=PENDING)
 *  - Extends Booking.expiresAt to now + 10m  (Q1=b)
 *  - Transitions Booking.status to PENDING_PAYMENT
 *  - Returns redirectUrl / providerReference for the frontend
 */
export const initiatePayment = async ({
  bookingId,
  customerId,
  providerName,
  phoneNumber,
}) => {
  validateId(bookingId, "Booking ID");

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      expiresAt: true,
      bookingNumber: true,
      payment: { select: { id: true } },
    },
  });

  if (!booking) {
    throw createError("Booking not found.", 404);
  }
  if (booking.status !== "HELD") {
    throw createError(
      `Only HELD bookings can be paid. Current status: ${booking.status}.`,
      409,
    );
  }
  if (booking.expiresAt && new Date(booking.expiresAt) <= new Date()) {
    throw createError("Booking has expired.", 409);
  }
  if (booking.payment) {
    throw createError("A payment for this booking already exists.", 409);
  }

  const provider = getProvider();
  const requestedProvider = providerName;

  // In 9a only the mock provider is wired; a request for mtn_momo/airtel
  // will reach here only if PAYMENT_PROVIDER matches in env — otherwise the
  // active provider is mock. We require the requested provider to match the
  // active provider so the customer knows what they're paying with.
  if (requestedProvider !== provider.name) {
    throw createError(
      `Provider "${requestedProvider}" is not active. Active provider: "${provider.name}".`,
      400,
    );
  }

  const amount = Number(booking.totalAmount);

  let providerResponse;
  try {
    providerResponse = await provider.initiatePayment({
      amount,
      currency: "RWF",
      phoneNumber,
      reference: booking.bookingNumber,
      callbackUrl: process.env.PAYMENT_CALLBACK_URL || null,
    });
  } catch (err) {
    // Provider-side failure — record failed payment attempt for audit, no booking change
    throw createError(
      `Payment provider failed to initiate: ${err.message}`,
      502,
    );
  }

  const now = new Date();
  const extendedExpiry = new Date(
    now.getTime() + HOLD_EXTENSION_MINUTES * 60 * 1000,
  );

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount,
        method: "MOBILE_MONEY",
        provider: provider.name,
        providerReference: providerResponse.providerReference,
        status: "PENDING",
      },
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "PENDING_PAYMENT",
        expiresAt: extendedExpiry,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: null,
        actorId: customerId,
        action: "PAYMENT_INITIATED",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          bookingId: booking.id,
          amount,
          provider: provider.name,
          providerReference: providerResponse.providerReference,
        },
      },
    });

    return {
      paymentId: payment.id,
      providerReference: providerResponse.providerReference,
      status: payment.status,
      redirectUrl: providerResponse.redirectUrl || null,
      expiresAt: extendedExpiry,
    };
  });
};

/**
 * Handle a webhook from a provider.
 *
 * - Verify signature (via provider adapter).
 * - Look up Payment by providerReference.
 * - If status SUCCESS:
 *     - If booking is still HELD/PENDING_PAYMENT and seats are held → confirm.
 *     - If seats are no longer held → auto-refund (F6/F9).
 * - If status FAILED: mark Payment FAILED, booking back to HELD (customer can retry).
 * - If status PENDING: no-op (acknowledge).
 *
 * Idempotent: if Payment is already SUCCESS or REFUNDED, return early.
 */
export const handleWebhook = async ({ providerName, headers, rawBody }) => {
  const provider = getProvider();
  if (providerName !== provider.name) {
    throw createError(
      `Webhook provider "${providerName}" does not match active provider "${provider.name}".`,
      404,
    );
  }

  const verification = await provider.verifyWebhook({ headers, rawBody });
  if (!verification.valid) {
    throw createError(
      `Invalid webhook signature${verification.reason ? `: ${verification.reason}` : ""}.`,
      401,
    );
  }

  const { providerReference, status, amount, paidAt } = verification;

  const payment = await prisma.payment.findUnique({
  where: { providerReference },
  include: {
    booking: {
      select: {
        id: true,
        status: true,
        totalAmount: true,
        expiresAt: true,    // ← ADD THIS
        bookingSeat: { select: { tripSeatId: true } },
      },
    },
  },
});

  if (!payment) {
    throw createError("Payment not found for provider reference.", 404);
  }

  if (payment.status === "SUCCESS" || payment.status === "REFUNDED") {
    return { noop: true, paymentId: payment.id, status: payment.status };
  }

  if (status === "PENDING") {
    return { noop: true, paymentId: payment.id, status: payment.status };
  }

  if (status === "FAILED") {
    return prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      // Revert booking to HELD so customer can try again (if still not expired)
      if (
        payment.booking.status === "PENDING_PAYMENT" &&
        payment.booking.expiresAt &&
        new Date(payment.booking.expiresAt) > new Date()
      ) {
        await tx.booking.update({
          where: { id: payment.booking.id },
          data: { status: "HELD" },
        });
      }
      await tx.auditLog.create({
        data: {
          companyId: null,
          actorId: null,
          action: "PAYMENT_FAILED",
          entityType: "Payment",
          entityId: payment.id,
          metadata: { providerReference, reason: "provider reported FAILED" },
        },
      });
      return { paymentId: payment.id, status: "FAILED" };
    });
  }

  // status === "SUCCESS"
  const paidAmount = typeof amount === "number" ? amount : Number(payment.amount);
  const expectedAmount = Number(payment.booking.totalAmount);

  if (Math.abs(paidAmount - expectedAmount) > 0.01) {
    // Q9: reject partial amounts — refund
    return refundPayment({
      paymentId: payment.id,
      reason: `Amount mismatch: got ${paidAmount}, expected ${expectedAmount}`,
      triggeredBy: "system",
    });
  }

  // Lock the tripSeat rows for this booking and verify they are still HELD
  const tripSeatIds = payment.booking.bookingSeat.map((bs) => bs.tripSeatId);

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`
      SELECT ts."id", ts."status"
      FROM "TripSeat" ts
      WHERE ts."id"::text = ANY(${tripSeatIds}::text[])
      FOR UPDATE
    `;

    const stillHeld = locked.every((s) => s.status === "HELD");

    if (!stillHeld) {
      // F6/F9: payment succeeded but seats no longer held → refund
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS", paidAt: paidAt ? new Date(paidAt) : new Date() },
      });

      await tx.auditLog.create({
        data: {
          companyId: null,
          actorId: null,
          action: "PAYMENT_SUCCEEDED_SEAT_GONE",
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            providerReference,
            reason: "seats no longer held",
            tripSeatIds,
          },
        },
      });

      // Queue for refund — process inline for V1 (Q7=a)
      setImmediate(() => {
        refundPayment({
          paymentId: payment.id,
          reason: "Seat no longer available at confirm time",
          triggeredBy: "system",
        }).catch((err) => {
          // eslint-disable-next-line no-console
          console.error("[payments] auto-refund after confirm failed:", err);
        });
      });

      return {
        paymentId: payment.id,
        status: "SUCCESS",
        refundPending: true,
      };
    }

    // Normal confirm
    const now = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        paidAt: paidAt ? new Date(paidAt) : now,
      },
    });

    await tx.booking.update({
      where: { id: payment.booking.id },
      data: { status: "CONFIRMED", expiresAt: null },
    });

    await tx.tripSeat.updateMany({
      where: { id: { in: tripSeatIds } },
      data: { status: "CONFIRMED" },
    });

    await tx.bookingHold.updateMany({
      where: { bookingId: payment.booking.id, status: "ACTIVE" },
      data: { status: "CONVERTED", releasedAt: now },
    });

    await tx.auditLog.create({
      data: {
        companyId: null,
        actorId: null,
        action: "PAYMENT_SUCCEEDED",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          providerReference,
          bookingId: payment.booking.id,
          amount: paidAmount,
        },
      },
    });

    return { paymentId: payment.id, status: "SUCCESS" };
  });
};

/**
 * Poll provider for current status and reconcile. Called by:
 *  - Frontend "check payment status" endpoint (see controller)
 *  - Background reconciler (module 9c)
 *  - Admin endpoint (Q3=c)
 */
export const pollAndReconcile = async ({ paymentId }) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { select: { id: true } } },
  });
  if (!payment) {
    throw createError("Payment not found.", 404);
  }
  if (payment.status === "SUCCESS" || payment.status === "REFUNDED") {
    return { status: payment.status, noop: true };
  }

  const provider = getProvider();
  const pollResult = await provider.pollStatus({
    providerReference: payment.providerReference,
  });

  if (pollResult.status === "PENDING") {
    return { status: "PENDING", noop: true };
  }

  // Reuse webhook processing by simulating a valid webhook payload
  const simulatedBody = JSON.stringify({
    providerReference: payment.providerReference,
    status: pollResult.status,
    amount: pollResult.amount,
    paidAt: pollResult.paidAt,
  });

  const webhookHeaders = {
    // For mock provider, the "signature" is MOCK_WEBHOOK_SECRET — a valid internal call
    "x-mock-signature": process.env.MOCK_WEBHOOK_SECRET,
  };

  return handleWebhook({
    providerName: provider.name,
    headers: webhookHeaders,
    rawBody: simulatedBody,
  });
};

/**
 * Refund a SUCCESS payment.
 *
 * Triggered by:
 *  - Auto-refund on F6/F9 (seat gone or amount mismatch)
 *  - Manual admin refund (V1: no endpoint yet; called only internally)
 */
export const refundPayment = async ({ paymentId, reason, triggeredBy }) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) {
    throw createError("Payment not found.", 404);
  }
  if (payment.status === "REFUNDED") {
    return { status: "REFUNDED", noop: true };
  }
  if (payment.status !== "SUCCESS") {
    throw createError(
      `Only SUCCESS payments can be refunded. Current status: ${payment.status}.`,
      409,
    );
  }

  const provider = getProvider();
  const refundResult = await provider.refund({
    providerReference: payment.providerReference,
    amount: Number(payment.amount),
    reason,
  });

  if (!refundResult.supported) {
    throw createError("Provider does not support refunds.", 400);
  }

  return prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED" },
    });

    await tx.booking.updateMany({
      where: { id: payment.bookingId },
      data: { status: "CANCELLED" },
    });

    // Release seats if they were still CONFIRMED
    const bookingSeats = await tx.bookingSeat.findMany({
      where: { bookingId: payment.bookingId },
      select: { tripSeatId: true },
    });
    const tripSeatIds = bookingSeats.map((b) => b.tripSeatId);
    if (tripSeatIds.length > 0) {
      await tx.tripSeat.updateMany({
        where: { id: { in: tripSeatIds }, status: "CONFIRMED" },
        data: { status: "AVAILABLE" },
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: null,
        actorId: null,
        action: "PAYMENT_REFUNDED",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          reason,
          triggeredBy,
          providerRefundReference: refundResult.providerRefundReference,
        },
      },
    });

    return { status: "REFUNDED", paymentId: payment.id };
  });
};

/**
 * Get payment status for a booking (used by frontend after redirect).
 * Owned-booking only — enforced via the customerId check.
 */
export const getPaymentStatusForBooking = async ({ bookingId, customerId }) => {
  validateId(bookingId, "Booking ID");

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId },
    select: {
      id: true,
      status: true,
      payment: {
        select: {
          id: true,
          status: true,
          provider: true,
          providerReference: true,
          paidAt: true,
        },
      },
    },
  });
  if (!booking) {
    throw createError("Booking not found.", 404);
  }

  return {
    bookingId: booking.id,
    bookingStatus: booking.status,
    payment: booking.payment,
  };
};