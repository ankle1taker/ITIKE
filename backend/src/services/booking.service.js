import crypto from "node:crypto";
import prisma from "../config/database.js";
import { reconcileTripSeatsInTx } from "./tripSeat.service.js";
import { buildPolicySnapshotForBooking } from "./cancellation.service.js";
const HOLD_MINUTES = 10;

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

const generateBookingNumber = () => {
  const date = new Date();
  const ymd =
    date.getUTCFullYear().toString() +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    String(date.getUTCDate()).padStart(2, "0");
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `ITK-${ymd}-${rand}`;
};

const sweepExpiredHoldsOnTrip = async (tx, tripId) => {
  const now = new Date();

  const expiredHolds = await tx.$queryRaw`
    SELECT h."id", h."bookingId", h."tripSeatId"
    FROM "BookingHold" h
    INNER JOIN "TripSeat" ts ON ts."id"::text = h."tripSeatId"::text
    WHERE ts."tripId"::text = ${tripId}::text
      AND h."status" = 'ACTIVE'
      AND h."expiresAt" < ${now}
    FOR UPDATE
  `;

  if (expiredHolds.length === 0) {
    return { expiredBookings: 0, releasedSeats: 0 };
  }

  const tripSeatIds = expiredHolds.map((h) => h.tripSeatId);
  const bookingIds = [...new Set(expiredHolds.map((h) => h.bookingId))];

  await tx.bookingHold.updateMany({
    where: { id: { in: expiredHolds.map((h) => h.id) } },
    data: { status: "EXPIRED", releasedAt: now },
  });

  await tx.tripSeat.updateMany({
    where: { id: { in: tripSeatIds }, status: "HELD" },
    data: { status: "AVAILABLE" },
  });

  for (const bookingId of bookingIds) {
    const remainingActiveHolds = await tx.bookingHold.count({
      where: { bookingId, status: "ACTIVE" },
    });
    if (remainingActiveHolds === 0) {
      await tx.booking.updateMany({
        where: { id: bookingId, status: "HELD" },
        data: { status: "EXPIRED" },
      });
    }
  }

  return {
    expiredBookings: bookingIds.length,
    releasedSeats: tripSeatIds.length,
  };
};

const validateDropoffStop = async (tx, { trip, dropoffStopId }) => {
  if (dropoffStopId === undefined || dropoffStopId === null) {
    return null;
  }

  const stops = await tx.routeStop.findMany({
    where: { routeId: trip.routeId },
    orderBy: { sequence: "asc" },
    select: { id: true, name: true, sequence: true },
  });

  if (stops.length === 0) {
    throw createError(
      "This route has no stops configured; dropoff selection is not available.",
      400,
    );
  }

  const target = stops.find((s) => s.id === dropoffStopId);
  if (!target) {
    throw createError("Dropoff stop does not belong to this trip's route.", 400);
  }

  const minSeq = stops[0].sequence;
  const maxSeq = stops[stops.length - 1].sequence;

  if (target.sequence === minSeq) {
    throw createError("Cannot drop off at the origin stop.", 400);
  }
  if (target.sequence === maxSeq) {
    throw createError(
      "Dropoff at destination is the default; omit dropoffStopId instead.",
      400,
    );
  }

  return target.id;
};

export const createBooking = async ({
  customerId,
  tripId,
  seatIds,
  passengers,
  dropoffStopId,
}) => {
  if (seatIds.length !== passengers.length) {
    throw createError(
      "The number of passengers must match the number of selected seats.",
      400,
    );
  }

  const uniqueSeatIds = new Set(seatIds);
  if (uniqueSeatIds.size !== seatIds.length) {
    throw createError("Duplicate seat IDs in request.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        companyId: true,
        routeId: true,
        status: true,
        departureTime: true,
        basePrice: true,
        route: { select: { isActive: true } },
        bus: { select: { status: true } },
        company: { select: { status: true } },
      },
    });

    if (!trip) {
      throw createError("Trip not found.", 404);
    }

    await sweepExpiredHoldsOnTrip(tx, tripId);

    if (trip.status !== "SCHEDULED") {
      throw createError(
        `This trip is not open for booking (status: ${trip.status}).`,
        409,
      );
    }
    if (new Date(trip.departureTime) <= new Date()) {
      throw createError("This trip has already departed.", 409);
    }
    if (!trip.route.isActive) {
      throw createError("The route for this trip is inactive.", 409);
    }
    if (trip.bus.status !== "ACTIVE") {
      throw createError("The bus for this trip is not active.", 409);
    }
    if (trip.company.status !== "ACTIVE") {
      throw createError("The operating company is not active.", 409);
    }

    const lockedSeats = await tx.$queryRaw`
      SELECT ts."id", ts."seatId", ts."status", ts."tripId"
      FROM "TripSeat" ts
      WHERE ts."id"::text = ANY(${seatIds}::text[])
        AND ts."tripId"::text = ${tripId}::text
      FOR UPDATE
    `;

    if (lockedSeats.length !== seatIds.length) {
      throw createError(
        "One or more selected seats do not belong to this trip.",
        400,
      );
    }

    const unavailable = lockedSeats
      .filter((s) => s.status !== "AVAILABLE")
      .map((s) => s.id);

    if (unavailable.length > 0) {
      const error = createError("One or more seats are no longer available.", 409);
      error.unavailableSeatIds = unavailable;
      throw error;
    }

    const validDropoffStopId = await validateDropoffStop(tx, {
      trip,
      dropoffStopId,
    });

    const basePriceNum = Number(trip.basePrice);
    const totalAmount = basePriceNum * seatIds.length;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

    const bookingNumber = generateBookingNumber();

    const policySnapshot = await buildPolicySnapshotForBooking(trip.companyId);

    const booking = await tx.booking.create({
      data: {
        bookingNumber,
        tripId,
        customerId,
        dropoffStopId: validDropoffStopId,
        status: "HELD",
        totalAmount,
        expiresAt,
        termsSnapshot: policySnapshot,
      },
    });

    const passengerRecords = [];
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      const passenger = await tx.bookingPassenger.create({
        data: {
          bookingId: booking.id,
          fullName: p.fullName,
          phone: p.phone,
          idType: p.idType ?? null,
          idNumber: p.idNumber ?? null,
        },
      });
      passengerRecords.push(passenger);
    }

    for (let i = 0; i < seatIds.length; i++) {
      const seatId = seatIds[i];
      const passenger = passengerRecords[i];

      await tx.bookingSeat.create({
        data: {
          bookingId: booking.id,
          tripSeatId: seatId,
          passengerId: passenger.id,
          amount: basePriceNum,
        },
      });

      await tx.bookingHold.create({
        data: {
          bookingId: booking.id,
          tripSeatId: seatId,
          status: "ACTIVE",
          expiresAt,
        },
      });
    }

    await tx.tripSeat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: "HELD" },
    });

    await tx.auditLog.create({
      data: {
        companyId: trip.companyId,
        actorId: customerId,
        action: "BOOKING_CREATED",
        entityType: "Booking",
        entityId: booking.id,
        metadata: {
          bookingNumber: booking.bookingNumber,
          tripId,
          seatCount: seatIds.length,
          totalAmount,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    const full = await tx.booking.findUnique({
      where: { id: booking.id },
      include: {
        trip: {
          select: {
            id: true,
            departureTime: true,
            arrivalTime: true,
            basePrice: true,
            route: { select: { origin: true, destination: true } },
            bus: { select: { registrationNumber: true } },
            company: { select: { id: true, name: true } },
          },
        },
        passengers: {
          select: { id: true, fullName: true, phone: true, idType: true, idNumber: true },
        },
        bookingSeat: {
          select: {
            id: true,
            amount: true,
            passengerId: true,
            tripSeat: {
              select: {
                id: true,
                seat: { select: { seatNumber: true, seatType: true, floorNumber: true } },
              },
            },
          },
        },
        dropoffStop: { select: { id: true, name: true, sequence: true } },
      },
    });

    return full;
  });
};

export const listMyBookings = async ({ customerId, page = 1, limit = 20, status }) => {
  if (!Number.isInteger(page) || page < 1) {
    throw createError("Page must be a positive integer.", 400);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw createError("Limit must be between 1 and 50.", 400);
  }

  const where = { customerId };
  if (status) where.status = status;

  const skip = (page - 1) * limit;

  const [bookings, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      include: {
        trip: {
          select: {
            id: true,
            departureTime: true,
            arrivalTime: true,
            route: { select: { origin: true, destination: true } },
          },
        },
        _count: { select: { bookingSeat: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    bookings,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1 && totalPages > 0,
    },
  };
};

export const getMyBookingById = async ({ id, customerId }) => {
  validateId(id, "Booking ID");

  const booking = await prisma.booking.findFirst({
    where: { id, customerId },
    include: {
      trip: {
        select: {
          id: true,
          departureTime: true,
          arrivalTime: true,
          basePrice: true,
          status: true,
          route: { select: { origin: true, destination: true } },
          bus: { select: { registrationNumber: true } },
          company: { select: { id: true, name: true } },
        },
      },
      passengers: {
        select: { id: true, fullName: true, phone: true, idType: true, idNumber: true },
      },
      bookingSeat: {
        select: {
          id: true,
          amount: true,
          passengerId: true,
          tripSeat: {
            select: {
              id: true,
              status: true,
              seat: { select: { seatNumber: true, seatType: true, floorNumber: true } },
            },
          },
        },
      },
      holds: {
        select: { id: true, status: true, expiresAt: true, releasedAt: true },
      },
      dropoffStop: { select: { id: true, name: true, sequence: true } },
       payments: {
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          method: true,
          provider: true,
          providerReference: true,
          paidAt: true,
          amount: true,
        },
        orderBy: { attemptNumber: "desc" },
      },
    },
  });

  if (!booking) {
    throw createError("Booking not found.", 404);
  }

  return booking;
};
export const releaseBooking = async ({ id, customerId }) => {
  validateId(id, "Booking ID");

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id, customerId },
      select: {
        id: true,
        status: true,
        customerId: true,
        bookingSeat: {
          select: { tripSeatId: true },
        },
        holds: {
          where: { status: "ACTIVE" },
          select: { id: true },
        },
      },
    });

    if (!booking) {
      throw createError("Booking not found.", 404);
    }

    if (booking.status !== "HELD") {
      throw createError(
        `Only HELD bookings can be released. Current status: ${booking.status}.`,
        409,
      );
    }

    const now = new Date();

    await tx.bookingHold.updateMany({
      where: {
        bookingId: booking.id,
        status: "ACTIVE",
      },
      data: {
        status: "RELEASED",
        releasedAt: now,
      },
    });

    const seatIds = booking.bookingSeat.map((bs) => bs.tripSeatId);
    if (seatIds.length > 0) {
      await tx.tripSeat.updateMany({
        where: {
          id: { in: seatIds },
          status: "HELD",
        },
        data: { status: "AVAILABLE" },
      });
    }

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        expiresAt: null,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: null,
        actorId: customerId,
        action: "BOOKING_RELEASED",
        entityType: "Booking",
        entityId: booking.id,
        metadata: {
          releasedSeatCount: seatIds.length,
          previousStatus: "HELD",
        },
      },
    });

    const released = await tx.booking.findUnique({
      where: { id: booking.id },
      include: {
        trip: {
          select: {
            id: true,
            departureTime: true,
            arrivalTime: true,
            basePrice: true,
            route: { select: { origin: true, destination: true } },
            bus: { select: { registrationNumber: true } },
            company: { select: { id: true, name: true } },
          },
        },
        passengers: {
          select: { id: true, fullName: true, phone: true },
        },
        bookingSeat: {
          select: {
            id: true,
            amount: true,
            tripSeat: {
              select: {
                id: true,
                status: true,
                seat: { select: { seatNumber: true } },
              },
            },
          },
        },
        holds: {
          select: { id: true, status: true, releasedAt: true },
        },
      },
    });

    return released;
  });
};

/**
 * Global sweep — releases ALL expired holds across the entire platform.
 * Used by PLATFORM_ADMIN via POST /api/platform/bookings/sweep.
 * Does NOT lock seats per-trip; each expired hold is released atomically.
 */
export const sweepAllExpiredHolds = async ({ actorId }) => {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const expiredHolds = await tx.bookingHold.findMany({
      where: { status: "ACTIVE", expiresAt: { lt: now } },
      select: { id: true, bookingId: true, tripSeatId: true },
    });

    if (expiredHolds.length === 0) {
      await tx.auditLog.create({
        data: {
          companyId: null,
          actorId,
          action: "BOOKING_SWEEP",
          entityType: "Booking",
          entityId: "global",
          metadata: { expiredBookings: 0, releasedSeats: 0 },
        },
      });
      return { expiredBookings: 0, releasedSeats: 0 };
    }

    const holdIds = expiredHolds.map((h) => h.id);
    const tripSeatIds = [...new Set(expiredHolds.map((h) => h.tripSeatId))];
    const bookingIds = [...new Set(expiredHolds.map((h) => h.bookingId))];

    await tx.bookingHold.updateMany({
      where: { id: { in: holdIds } },
      data: { status: "EXPIRED", releasedAt: now },
    });

    await tx.tripSeat.updateMany({
      where: { id: { in: tripSeatIds }, status: "HELD" },
      data: { status: "AVAILABLE" },
    });

    for (const bookingId of bookingIds) {
      const remainingActive = await tx.bookingHold.count({
        where: { bookingId, status: "ACTIVE" },
      });
      if (remainingActive === 0) {
        await tx.booking.updateMany({
          where: { id: bookingId, status: "HELD" },
          data: { status: "EXPIRED" },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        companyId: null,
        actorId,
        action: "BOOKING_SWEEP",
        entityType: "Booking",
        entityId: "global",
        metadata: {
          expiredBookings: bookingIds.length,
          releasedSeats: tripSeatIds.length,
        },
      },
    });

    return {
      expiredBookings: bookingIds.length,
      releasedSeats: tripSeatIds.length,
    };
  });
};