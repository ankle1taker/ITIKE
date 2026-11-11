import prisma from "../config/database.js";
import { getProvider } from "./payments/index.js";
import { issueTicketForBookingInTx } from "./ticket.service.js";
import { queueNotification } from "./notification.service.js";

const HOLD_EXTENSION_MINUTES = 10;

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
      payments: {
        select: {
          id: true,
          status: true,
          attemptNumber: true,
        },
        orderBy: { attemptNumber: "desc" },
      },
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

  const activeAttempt = booking.payments.find(
    (p) => p.status === "PENDING" || p.status === "PROCESSING",
  );
  if (activeAttempt) {
    throw createError(
      `A payment attempt is already in progress (attempt ${activeAttempt.attemptNumber}).`,
      409,
    );
  }
  const successfulAttempt = booking.payments.find((p) => p.status === "SUCCESS");
  if (successfulAttempt) {
    throw createError("This booking has already been paid.", 409);
  }

  const attemptNumber = (booking.payments[0]?.attemptNumber || 0) + 1;

  const provider = getProvider();
  const requestedProvider = providerName;

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
        attemptNumber,
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
          attemptNumber,
          amount,
          provider: provider.name,
          providerReference: providerResponse.providerReference,
        },
      },
    });

    return {
      paymentId: payment.id,
      attemptNumber,
      providerReference: providerResponse.providerReference,
      status: payment.status,
      redirectUrl: providerResponse.redirectUrl || null,
      expiresAt: extendedExpiry,
    };
  });
};

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
          expiresAt: true,
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
    if (payment.status === "FAILED") {
      return { noop: true, paymentId: payment.id, status: "FAILED" };
    }
    return prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      const otherActive = await tx.payment.count({
        where: {
          bookingId: payment.booking.id,
          status: { in: ["PENDING", "PROCESSING"] },
          NOT: { id: payment.id },
        },
      });
      if (
        otherActive === 0 &&
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
          metadata: {
            providerReference,
            attemptNumber: payment.attemptNumber,
            reason: "provider reported FAILED",
          },
        },
      });

      // Notify customer (fire-and-forget)
      try {
        const fullBooking = await tx.booking.findUnique({
          where: { id: payment.booking.id },
          select: {
            customerId: true,
            bookingNumber: true,
            passengers: { select: { phone: true }, take: 1 },
          },
        });
        if (fullBooking) {
          queueNotification({
            recipientId: fullBooking.customerId,
            recipientPhone: fullBooking.passengers[0]?.phone || null,
            channel: "SMS",
            template: "PAYMENT_FAILED",
            payload: { bookingNumber: fullBooking.bookingNumber },
          }).catch((err) => {
            console.error("[notifications] PAYMENT_FAILED queue failed:", err.message);
          });
        }
      } catch (err) {
        console.error("[notifications] PAYMENT_FAILED lookup failed:", err.message);
      }

      return { paymentId: payment.id, status: "FAILED" };
    });
  }

  // status === "SUCCESS"
  const paidAmount = typeof amount === "number" ? amount : Number(payment.amount);
  const expectedAmount = Number(payment.booking.totalAmount);

  if (Math.abs(paidAmount - expectedAmount) > 0.01) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS", paidAt: paidAt ? new Date(paidAt) : new Date() },
    });
    return refundPayment({
      paymentId: payment.id,
      reason: `Amount mismatch: got ${paidAmount}, expected ${expectedAmount}`,
      triggeredBy: "system",
    });
  }

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
            attemptNumber: payment.attemptNumber,
            reason: "seats no longer held",
            tripSeatIds,
          },
        },
      });

      setImmediate(() => {
        refundPayment({
          paymentId: payment.id,
          reason: "Seat no longer available at confirm time",
          triggeredBy: "system",
        }).catch((err) => {
          console.error("[payments] auto-refund after confirm failed:", err);
        });
      });

      return {
        paymentId: payment.id,
        status: "SUCCESS",
        refundPending: true,
      };
    }

    const now = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        paidAt: paidAt ? new Date(paidAt) : now,
      },
    });

    await tx.payment.updateMany({
      where: {
        bookingId: payment.booking.id,
        status: { in: ["PENDING", "PROCESSING"] },
        NOT: { id: payment.id },
      },
      data: { status: "FAILED" },
    });

    await tx.booking.update({
      where: { id: payment.booking.id },
      data: { status: "CONFIRMED", expiresAt: null },
    });

    await tx.tripSeat.updateMany({
      where: { id: { in: tripSeatIds } },
      data: { status: "CONFIRMED" },
    });

    await issueTicketForBookingInTx(tx, {
      bookingId: payment.booking.id,
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
          attemptNumber: payment.attemptNumber,
          amount: paidAmount,
        },
      },
    });

    // Notify customer (fire-and-forget)
    try {
      const fullBooking = await tx.booking.findUnique({
        where: { id: payment.booking.id },
        select: {
          customerId: true,
          bookingNumber: true,
          totalAmount: true,
          passengers: { select: { phone: true }, take: 1 },
        },
      });
      if (fullBooking) {
        queueNotification({
          recipientId: fullBooking.customerId,
          recipientPhone: fullBooking.passengers[0]?.phone || null,
          channel: "SMS",
          template: "PAYMENT_SUCCEEDED",
          payload: {
            bookingNumber: fullBooking.bookingNumber,
            amount: Number(fullBooking.totalAmount),
          },
        }).catch((err) => {
          console.error("[notifications] PAYMENT_SUCCEEDED queue failed:", err.message);
        });
      }
    } catch (err) {
      console.error("[notifications] PAYMENT_SUCCEEDED lookup failed:", err.message);
    }

    return { paymentId: payment.id, status: "SUCCESS" };
  });
};

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

  const simulatedBody = JSON.stringify({
    providerReference: payment.providerReference,
    status: pollResult.status,
    amount: pollResult.amount,
    paidAt: pollResult.paidAt,
  });

  const webhookHeaders = {
    "x-mock-signature": process.env.MOCK_WEBHOOK_SECRET,
  };

  return handleWebhook({
    providerName: provider.name,
    headers: webhookHeaders,
    rawBody: simulatedBody,
  });
};

export const refundPayment = async ({ paymentId, reason, triggeredBy }) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        select: {
          id: true,
          status: true,
          bookingSeat: { select: { tripSeatId: true } },
        },
      },
    },
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

  const existing = await prisma.cancellation.findUnique({
    where: { bookingId: payment.bookingId },
  });

  if (existing) {
    if (existing.status === "COMPLETED") {
      return { status: "REFUNDED", noop: true, cancellationId: existing.id };
    }
    if (existing.status === "PROCESSING") {
      throw createError(
        "Refund is already in progress. Await completion or admin intervention.",
        409,
      );
    }
  }

  const cancellation = await prisma.$transaction(async (tx) => {
    if (existing) {
      return tx.cancellation.update({
        where: { id: existing.id },
        data: {
          status: "PROCESSING",
          failureReason: null,
          providerRefundReference: null,
          requestedAt: new Date(),
        },
      });
    }
    return tx.cancellation.create({
      data: {
        bookingId: payment.bookingId,
        status: "PROCESSING",
        reason: reason || null,
        refundAmount: Number(payment.amount),
      },
    });
  });

  let refundResult;
  try {
    const provider = getProvider();
    refundResult = await provider.refund({
      providerReference: payment.providerReference,
      amount: Number(payment.amount),
      reason: reason || "Refund",
    });
    if (!refundResult.supported) {
      throw new Error("Provider does not support refunds.");
    }
  } catch (err) {
    await prisma.cancellation.update({
      where: { id: cancellation.id },
      data: {
        status: "REJECTED",
        failureReason: err.message || "Provider refund failed",
        processedAt: new Date(),
      },
    });
    throw createError(
      `Refund failed at provider: ${err.message}. Booking remains CONFIRMED. Retry allowed.`,
      502,
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED" },
    });

    await tx.cancellation.update({
      where: { id: cancellation.id },
      data: {
        status: "COMPLETED",
        providerRefundReference: refundResult.providerRefundReference || null,
        failureReason: null,
        processedAt: new Date(),
      },
    });

    await tx.booking.updateMany({
      where: { id: payment.bookingId },
      data: { status: "CANCELLED" },
    });

    const tripSeatIds = payment.booking.bookingSeat.map((b) => b.tripSeatId);
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
          attemptNumber: payment.attemptNumber,
          providerRefundReference: refundResult.providerRefundReference,
          cancellationId: cancellation.id,
        },
      },
    });

    return {
      status: "REFUNDED",
      paymentId: payment.id,
      cancellationId: cancellation.id,
    };
  });
};

export const forceCompleteRefund = async ({ cancellationId, actorId, note }) => {
  const cancellation = await prisma.cancellation.findUnique({
    where: { id: cancellationId },
    include: { booking: { select: { id: true } } },
  });
  if (!cancellation) {
    throw createError("Cancellation not found.", 404);
  }
  if (cancellation.status !== "PROCESSING") {
    throw createError(
      `Only PROCESSING cancellations can be force-completed. Current: ${cancellation.status}.`,
      409,
    );
  }

  const payment = await prisma.payment.findFirst({
    where: { bookingId: cancellation.bookingId },
    orderBy: { attemptNumber: "desc" },
  });

  return prisma.$transaction(async (tx) => {
    if (payment && payment.status === "SUCCESS") {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED" },
      });
    }

    await tx.cancellation.update({
      where: { id: cancellationId },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
        failureReason: null,
      },
    });

    await tx.booking.updateMany({
      where: { id: cancellation.bookingId },
      data: { status: "CANCELLED" },
    });

    await tx.auditLog.create({
      data: {
        companyId: null,
        actorId,
        action: "REFUND_FORCE_COMPLETED_BY_ADMIN",
        entityType: "Cancellation",
        entityId: cancellationId,
        metadata: {
          note: note || "Manual admin completion after PROCESSING state",
          paymentId: payment?.id,
        },
      },
    });

    return { cancellationId, status: "COMPLETED" };
  });
};

export const getPaymentStatusForBooking = async ({ bookingId, customerId }) => {
  validateId(bookingId, "Booking ID");

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId },
    select: {
      id: true,
      status: true,
      payments: {
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          provider: true,
          providerReference: true,
          paidAt: true,
        },
        orderBy: { attemptNumber: "desc" },
      },
    },
  });
  if (!booking) {
    throw createError("Booking not found.", 404);
  }

  const latest = booking.payments[0] || null;

  return {
    bookingId: booking.id,
    bookingStatus: booking.status,
    payment: latest,
    payments: booking.payments,
  };
};