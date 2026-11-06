import prisma from "../config/database.js";

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

const validateCompanyId = (companyId) => {
  if (!companyId || typeof companyId !== "string") {
    throw createError("Company ID is required.", 400);
  }
};

const validateActorId = (actorId) => {
  if (!actorId || typeof actorId !== "string") {
    throw createError("User not authenticated.", 401);
  }
};

/**
 * Reconcile TripSeat rows for a trip against the current active seats of its bus.
 *
 * Rules:
 *  - Add TripSeat rows for every ACTIVE seat that is not yet in the trip.
 *  - Remove TripSeat rows whose physical seat is now INACTIVE, ONLY if the
 *    TripSeat is currently AVAILABLE. HELD / CONFIRMED / BLOCKED rows are preserved
 *    and reported as warnings.
 *  - Idempotent: calling twice in a row adds 0 and removes 0.
 *
 * Must be called inside an existing transaction (`tx`). Callers own the
 * transaction because they also log audit and possibly read the trip first.
 */
export const reconcileTripSeatsInTx = async (
  tx,
  { tripId, busId, companyId },
) => {
  // Fetch active seats on the bus
  const activeSeats = await tx.seat.findMany({
    where: { busId, status: "ACTIVE" },
    select: { id: true },
  });
  const activeSeatIds = new Set(activeSeats.map((s) => s.id));

  // Fetch current TripSeat rows for this trip, with seat status to know if the
  // physical seat is still usable.
  const existing = await tx.tripSeat.findMany({
    where: { tripId },
    select: {
      id: true,
      seatId: true,
      status: true,
      seat: { select: { status: true, seatNumber: true } },
    },
  });

  const existingSeatIds = new Set(existing.map((ts) => ts.seatId));

  // Add: active seats that aren't yet in the trip
  const toAdd = [];
  for (const seat of activeSeats) {
    if (!existingSeatIds.has(seat.id)) {
      toAdd.push({ tripId, seatId: seat.id, status: "AVAILABLE" });
    }
  }

  // Remove candidates: TripSeat rows whose physical seat is now INACTIVE,
  // only if TripSeat.status === "AVAILABLE". Anything else is preserved + warned.
  const toRemove = [];
  const warnings = [];
  for (const ts of existing) {
    const seatStillActive = ts.seat.status === "ACTIVE";
    if (!seatStillActive && ts.status === "AVAILABLE") {
      toRemove.push(ts.id);
    } else if (!seatStillActive) {
      warnings.push(
        `Seat ${ts.seat.seatNumber} is inactive on the bus but TripSeat is ${ts.status}; preserved to avoid data loss.`,
      );
    }
  }

  if (toAdd.length > 0) {
    await tx.tripSeat.createMany({ data: toAdd });
  }

  if (toRemove.length > 0) {
    await tx.tripSeat.deleteMany({ where: { id: { in: toRemove } } });
  }

  // Post counts for the response
  const totalAfter = await tx.tripSeat.count({ where: { tripId } });

  return {
    added: toAdd.length,
    removed: toRemove.length,
    total: totalAfter,
    warnings,
  };
};

/**
 * Public reconcile endpoint. Wraps the transaction, validates ownership
 * and status, and writes an audit log.
 */
export const initializeTripSeats = async ({
  tripId,
  companyId,
  actorId,
}) => {
  validateId(tripId, "Trip ID");
  validateCompanyId(companyId);
  validateActorId(actorId);

  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findFirst({
      where: { id: tripId, companyId },
      select: { id: true, busId: true, status: true },
    });

    if (!trip) {
      throw createError("Trip not found.", 404);
    }

    if (trip.status !== "SCHEDULED") {
      throw createError(
        `Cannot initialize seats for a trip in ${trip.status} status. Only SCHEDULED trips can be reconciled.`,
        409,
      );
    }

    const result = await reconcileTripSeatsInTx(tx, {
      tripId: trip.id,
      busId: trip.busId,
      companyId,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        action: "TRIP_SEATS_INITIALIZED",
        entityType: "Trip",
        entityId: trip.id,
        metadata: {
          added: result.added,
          removed: result.removed,
          total: result.total,
          warningCount: result.warnings.length,
        },
      },
    });

    return result;
  });
};

/**
 * Read-only: grouped seat inventory for a trip.
 */
export const getTripSeats = async ({ tripId, companyId }) => {
  validateId(tripId, "Trip ID");
  validateCompanyId(companyId);

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, companyId },
    select: { id: true, status: true, busId: true },
  });

  if (!trip) {
    throw createError("Trip not found.", 404);
  }

  const tripSeats = await prisma.tripSeat.findMany({
    where: { tripId },
    orderBy: [
      { seat: { floorNumber: "asc" } },
      { seat: { rowNumber: "asc" } },
      { seat: { columnNumber: "asc" } },
      { seat: { seatNumber: "asc" } },
    ],
    select: {
      id: true,
      status: true,
      seat: {
        select: {
          id: true,
          seatNumber: true,
          rowNumber: true,
          columnNumber: true,
          floorNumber: true,
          seatType: true,
        },
      },
    },
  });

  const counts = {
    AVAILABLE: 0,
    HELD: 0,
    CONFIRMED: 0,
    BLOCKED: 0,
  };
  for (const ts of tripSeats) {
    counts[ts.status] = (counts[ts.status] ?? 0) + 1;
  }

  return {
    trip: { id: trip.id, status: trip.status, busId: trip.busId },
    counts,
    total: tripSeats.length,
    seats: tripSeats,
  };
};