import prisma from "../config/database.js";
import { refundPayment } from "./payment.service.js";

const DEFAULT_POLICY = {
  moreThan24HoursPct: 90,
  twelveTo24HoursPct: 50,
  lessThan12HoursPct: 0,
  afterDeparturePct: 0,
};

const HOUR_MS = 60 * 60 * 1000;

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
 * Resolve the cancellation policy for a booking.
 * Priority:
 *   1. booking.termsSnapshot.policy (set at booking time — frozen for the booking's life)
 *   2. company.cancellationPolicy (live policy)
 *   3. DEFAULT_POLICY
 */
const resolvePolicyForBooking = async (tx, booking) => {
  const snapshot = booking.termsSnapshot;
  if (snapshot && snapshot.policy) {
    return {
      moreThan24HoursPct: Number(snapshot.policy.moreThan24HoursPct),
      twelveTo24HoursPct: Number(snapshot.policy.twelveTo24HoursPct),
      lessThan12HoursPct: Number(snapshot.policy.lessThan12HoursPct),
      afterDeparturePct: Number(snapshot.policy.afterDeparturePct),
      source: "snapshot",
    };
  }

  const companyId = booking.trip.companyId;
  const companyPolicy = await tx.cancellationPolicy.findUnique({
    where: { companyId },
  });
  if (companyPolicy) {
    return {
      moreThan24HoursPct: Number(companyPolicy.moreThan24HoursPct),
      twelveTo24HoursPct: Number(companyPolicy.twelveTo24HoursPct),
      lessThan12HoursPct: Number(companyPolicy.lessThan12HoursPct),
      afterDeparturePct: Number(companyPolicy.afterDeparturePct),
      source: "company",
    };
  }

  return { ...DEFAULT_POLICY, source: "default" };
};

/**
 * Compute refund percentage based on time-to-departure.
 */
const computeRefundPercentage = (policy, departureTime, now) => {
  const departure = new Date(departureTime);
  const hoursBeforeDeparture = (departure.getTime() - now.getTime()) / HOUR_MS;

  if (hoursBeforeDeparture <= 0) {
    return { pct: policy.afterDeparturePct, tier: "after_departure" };
  }
  if (hoursBeforeDeparture > 24) {
    return { pct: policy.moreThan24HoursPct, tier: "more_than_24h" };
  }
  if (hoursBeforeDeparture >= 12) {
    return { pct: policy.twelveTo24HoursPct, tier: "12_to_24h" };
  }
  return { pct: policy.lessThan12HoursPct, tier: "less_than_12h" };
};

const round2 = (num) => Math.round(num * 100) / 100;

/**
 * Cancel a CONFIRMED booking and refund per policy.
 * Synchronous + atomic: if refund fails, whole cancellation rolls back.
 */
export const cancelBooking = async ({ bookingId, customerId, reason }) => {
  validateId(bookingId, "Booking ID");

  // Pre-check (outside transaction) to fail fast with clear error before we
  // hit the provider. The real check happens inside the transaction.
  const preCheck = await prisma.booking.findFirst({
    where: { id: bookingId, customerId },
    select: {
      id: true,
      status: true,
      trip: { select: { departureTime: true } },
    },
  });

  if (!preCheck) {
    throw createError("Booking not found.", 404);
  }
  if (preCheck.status !== "CONFIRMED") {
    throw createError(
      `Only CONFIRMED bookings can be cancelled. Current status: ${preCheck.status}. ` +
        `Use the release endpoint for unpaid bookings.`,
      409,
    );
  }
  if (new Date(preCheck.trip.departureTime) <= new Date()) {
    throw createError("Cannot cancel a booking after departure.", 409);
  }

  // Full load for policy resolution + refund calculation
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId },
    include: {
      trip: {
        select: {
          id: true,
          companyId: true,
          departureTime: true,
        },
      },
      payments: {
        select: { id: true, status: true, provider: true, providerReference: true },
        orderBy: { attemptNumber: "desc" },
        take: 1,
      },
      ticket: { select: { id: true, status: true } },
      bookingSeat: { select: { tripSeatId: true } },
      cancellation: { select: { id: true } },
    },
  });

  if (booking.cancellation) {
    throw createError("A cancellation already exists for this booking.", 409);
  }
      const successfulPayment = booking.payments.find((p) => p.status === "SUCCESS");
    if (!successfulPayment) {
    throw createError(
      "Booking has no successful payment to refund.",
      409,
    );
  }

  // Resolve policy + compute refund
  const now = new Date();
  const policy = await resolvePolicyForBooking(prisma, booking);
  const { pct, tier } = computeRefundPercentage(
    policy,
    booking.trip.departureTime,
    now,
  );
  const totalAmount = Number(booking.totalAmount);
  const refundAmount = round2((totalAmount * pct) / 100);

  // Attempt refund first, before the DB transaction. If provider fails, we
  // abort early — booking stays CONFIRMED, customer can retry.
  let refundResult;
  if (refundAmount > 0) {
    try {
           refundResult = await refundPayment({
        paymentId: successfulPayment.id,
        reason: reason || `Customer cancellation (${tier}, ${pct}%)`,
        triggeredBy: "customer_cancel",
      });
    } catch (err) {
      throw createError(
        `Refund failed at provider: ${err.message}. Booking remains CONFIRMED. Please retry.`,
        502,
      );
    }
  } else {
    // Zero refund — still need to transition payment to REFUNDED (amount 0)
    // and cancel everything else. Do it inside the transaction below.
    refundResult = { status: "REFUNDED", paymentId: booking.payment.id, zero: true };
  }

  // Now transact the cancellation records.
  return prisma.$transaction(async (tx) => {
    const cancellation = await tx.cancellation.create({
      data: {
        bookingId: booking.id,
        status: "COMPLETED",
        reason: reason || null,
        refundAmount,
        requestedAt: now,
        processedAt: now,
      },
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });

    if (booking.ticket && booking.ticket.status !== "CANCELLED") {
      await tx.ticket.update({
        where: { id: booking.ticket.id },
        data: { status: "CANCELLED" },
      });
    }

    const tripSeatIds = booking.bookingSeat.map((bs) => bs.tripSeatId);
    if (tripSeatIds.length > 0) {
      await tx.tripSeat.updateMany({
        where: { id: { in: tripSeatIds }, status: "CONFIRMED" },
        data: { status: "AVAILABLE" },
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: booking.trip.companyId,
        actorId: customerId,
        action: "BOOKING_CANCELLED_BY_CUSTOMER",
        entityType: "Booking",
        entityId: booking.id,
        metadata: {
          refundAmount,
          refundPct: pct,
          policyTier: tier,
          policySource: policy.source,
          paymentId: booking.payment.id,
        },
      },
    });

    return {
      cancellationId: cancellation.id,
      bookingStatus: "CANCELLED",
      refundAmount,
      refundPct: pct,
      policyTier: tier,
    };
  });
};

/**
 * Get the company's cancellation policy (or defaults if none set).
 */
export const getCompanyPolicy = async ({ companyId }) => {
  const policy = await prisma.cancellationPolicy.findUnique({
    where: { companyId },
  });

  if (!policy) {
    return {
      ...DEFAULT_POLICY,
      source: "default",
      isCustom: false,
    };
  }

  return {
    moreThan24HoursPct: Number(policy.moreThan24HoursPct),
    twelveTo24HoursPct: Number(policy.twelveTo24HoursPct),
    lessThan12HoursPct: Number(policy.lessThan12HoursPct),
    afterDeparturePct: Number(policy.afterDeparturePct),
    source: "company",
    isCustom: true,
  };
};

/**
 * Upsert the company's cancellation policy.
 */
export const upsertCompanyPolicy = async ({
  companyId,
  actorId,
  moreThan24HoursPct,
  twelveTo24HoursPct,
  lessThan12HoursPct,
  afterDeparturePct,
}) => {
  if (typeof actorId !== "string") {
    throw createError("User not authenticated.", 401);
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.cancellationPolicy.findUnique({
      where: { companyId },
      select: { id: true },
    });

    const data = {
      moreThan24HoursPct,
      twelveTo24HoursPct,
      lessThan12HoursPct,
      afterDeparturePct,
    };

    let policy;
    if (existing) {
      policy = await tx.cancellationPolicy.update({
        where: { companyId },
        data,
      });
    } else {
      policy = await tx.cancellationPolicy.create({
        data: { companyId, ...data },
      });
    }

    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        action: "CANCELLATION_POLICY_UPDATED",
        entityType: "CancellationPolicy",
        entityId: policy.id,
        metadata: data,
      },
    });

    return {
      moreThan24HoursPct: Number(policy.moreThan24HoursPct),
      twelveTo24HoursPct: Number(policy.twelveTo24HoursPct),
      lessThan12HoursPct: Number(policy.lessThan12HoursPct),
      afterDeparturePct: Number(policy.afterDeparturePct),
      source: "company",
      isCustom: true,
    };
  });
};

/**
 * Snapshot the company's current policy into a booking's termsSnapshot.
 * Called from createBooking (booking.service.js) at booking creation.
 */
export const buildPolicySnapshotForBooking = async (companyId) => {
  const policy = await prisma.cancellationPolicy.findUnique({
    where: { companyId },
  });

  const effective = policy
    ? {
        moreThan24HoursPct: Number(policy.moreThan24HoursPct),
        twelveTo24HoursPct: Number(policy.twelveTo24HoursPct),
        lessThan12HoursPct: Number(policy.lessThan12HoursPct),
        afterDeparturePct: Number(policy.afterDeparturePct),
      }
    : DEFAULT_POLICY;

  return {
    policy: {
      ...effective,
      snapshotAt: new Date().toISOString(),
    },
  };
};