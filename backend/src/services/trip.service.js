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

const validateTimes = (departureTime, arrivalTime) => {
  const dep = new Date(departureTime);
  const arr = new Date(arrivalTime);

  if (Number.isNaN(dep.getTime())) {
    throw createError("Invalid departure time.", 400);
  }
  if (Number.isNaN(arr.getTime())) {
    throw createError("Invalid arrival time.", 400);
  }
  if (arr <= dep) {
    throw createError("Arrival time must be after departure time.", 400);
  }
  return { dep, arr };
};

const validatePrice = (basePrice) => {
  const num = Number(basePrice);
  if (Number.isNaN(num) || num < 0) {
    throw createError("Base price must be a non-negative number.", 400);
  }
  return num;
};

const getRouteOrThrow = async (tx, routeId) => {
  const route = await tx.route.findUnique({
    where: { id: routeId },
    select: { id: true, origin: true, destination: true, isActive: true },
  });
  if (!route) {
    throw createError("Route not found.", 404);
  }
  return route;
};

const getBusOrThrow = async (tx, busId, companyId) => {
  const bus = await tx.bus.findFirst({
    where: { id: busId, companyId },
    select: { id: true, status: true, capacity: true, branchId: true },
  });
  if (!bus) {
    throw createError("Bus not found.", 404);
  }
  return bus;
};

const assertNoBusOverlap = async (tx, busId, dep, arr, excludeTripId = null) => {
  const where = {
    busId,
    status: { notIn: ["CANCELLED", "ARRIVED"] },
    AND: [
      { departureTime: { lt: arr } },
      {
        OR: [
          { arrivalTime: { gt: dep } },
          {
            AND: [
              { arrivalTime: null },
              { departureTime: { gte: dep } },
            ],
          },
        ],
      },
    ],
  };
  if (excludeTripId) {
    where.NOT = { id: excludeTripId };
  }

  const conflict = await tx.trip.findFirst({
    where,
    select: { id: true, departureTime: true, arrivalTime: true },
  });
  if (conflict) {
    throw createError(
      "This bus already has a trip scheduled during that time window.",
      409,
    );
  }
};

const initializeTripSeats = async (tx, tripId, busId) => {
  const seats = await tx.seat.findMany({
    where: { busId, status: "ACTIVE" },
    select: { id: true },
  });
  if (seats.length === 0) {
    throw createError(
      "Bus has no active seats configured. Configure seats before scheduling trips.",
      409,
    );
  }
  const data = seats.map((s) => ({
    tripId,
    seatId: s.id,
    status: "AVAILABLE",
  }));
  await tx.tripSeat.createMany({ data });
  return seats.length;
};

export const createTrip = async ({
  companyId,
  actorId,
  routeId,
  busId,
  departureTime,
  arrivalTime,
  basePrice,
  branchId = null,
}) => {
  validateId(routeId, "Route ID");
  validateId(busId, "Bus ID");
  const { dep, arr } = validateTimes(departureTime, arrivalTime);
  const price = validatePrice(basePrice);

  return prisma.$transaction(async (tx) => {
    // Lock the bus row first — prevents concurrent trip creations on the same bus
    const lockedBus = await tx.$queryRaw`
      SELECT "id"
      FROM "Bus"
      WHERE "id"::text = ${busId}::text
        AND "companyId"::text = ${companyId}::text
      FOR UPDATE
    `;
    if (lockedBus.length === 0) {
      throw createError("Bus not found.", 404);
    }

    const route = await getRouteOrThrow(tx, routeId);
    if (!route.isActive) {
      throw createError("Route is inactive.", 409);
    }

    const bus = await getBusOrThrow(tx, busId, companyId);
    if (bus.status !== "ACTIVE") {
      throw createError(
        `Bus is not available for trips (status: ${bus.status}).`,
        409,
      );
    }

    // If caller passed a branchId, it must match the bus's branch
    if (branchId && branchId !== bus.branchId) {
      throw createError(
        "Bus does not belong to the requested branch.",
        409,
      );
    }

    const activeSeatCount = await tx.seat.count({
      where: { busId, status: "ACTIVE" },
    });
    if (activeSeatCount === 0) {
      throw createError(
        "Bus has no active seats configured. Configure seats before scheduling trips.",
        409,
      );
    }

    await assertNoBusOverlap(tx, busId, dep, arr);

    const trip = await tx.trip.create({
      data: {
        companyId,
        branchId: bus.branchId,
        routeId,
        busId,
        departureTime: dep,
        arrivalTime: arr,
        basePrice: price,
        status: "SCHEDULED",
      },
    });

    await initializeTripSeats(tx, trip.id, busId);

    await tx.auditLog.create({
      data: {
        companyId,
        actorId: actorId || null,
        action: "TRIP_CREATED",
        entityType: "Trip",
        entityId: trip.id,
        metadata: {
          routeId,
          busId,
          branchId: bus.branchId,
          departureTime: dep.toISOString(),
          arrivalTime: arr.toISOString(),
          basePrice: price,
        },
      },
    });

    return tx.trip.findUnique({
      where: { id: trip.id },
      include: {
        route: { select: { id: true, origin: true, destination: true } },
        bus: {
          select: {
            id: true,
            registrationNumber: true,
            capacity: true,
            branchId: true,
          },
        },
      },
    });
  });
};

export const listTrips = async ({
  companyId,
  branchId = null,
  page = 1,
  limit = 20,
  status,
  busId,
  routeId,
  from,
  to,
  search,
}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  const where = { companyId };
  if (branchId) where.branchId = branchId;
  if (status) where.status = status;
  if (busId) where.busId = busId;
  if (routeId) where.routeId = routeId;

  if (from || to) {
    where.departureTime = {};
    if (from) where.departureTime.gte = new Date(from);
    if (to) where.departureTime.lte = new Date(to);
  }

  if (search && search.trim()) {
    where.OR = [
      { route: { origin: { contains: search.trim(), mode: "insensitive" } } },
      {
        route: {
          destination: { contains: search.trim(), mode: "insensitive" },
        },
      },
      {
        bus: {
          registrationNumber: {
            contains: search.trim(),
            mode: "insensitive",
          },
        },
      },
    ];
  }

  const [trips, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where,
      orderBy: [{ departureTime: "asc" }, { id: "asc" }],
      skip,
      take: safeLimit,
      include: {
        route: { select: { id: true, origin: true, destination: true } },
        bus: {
          select: {
            id: true,
            registrationNumber: true,
            capacity: true,
            branchId: true,
          },
        },
        _count: { select: { bookings: true } },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);

  return {
    trips,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1 && totalPages > 0,
    },
  };
};

export const getTripById = async ({ id, companyId }) => {
  validateId(id, "Trip ID");
  const trip = await prisma.trip.findFirst({
    where: { id, companyId },
    include: {
      route: {
        select: {
          id: true,
          origin: true,
          destination: true,
          stops: {
            select: { id: true, name: true, sequence: true },
            orderBy: { sequence: "asc" },
          },
        },
      },
      bus: {
        select: {
          id: true,
          registrationNumber: true,
          capacity: true,
          branchId: true,
        },
      },
      _count: { select: { bookings: true, tripSeats: true } },
    },
  });
  if (!trip) {
    throw createError("Trip not found.", 404);
  }
  return trip;
};

export const updateTrip = async ({
  id,
  companyId,
  actorId,
  routeId,
  arrivalTime,
  basePrice,
}) => {
  validateId(id, "Trip ID");

  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        status: true,
        routeId: true,
        busId: true,
        departureTime: true,
        arrivalTime: true,
        basePrice: true,
      },
    });
    if (!trip) {
      throw createError("Trip not found.", 404);
    }

    if (trip.status === "BOARDING" || trip.status === "DEPARTED" || trip.status === "ARRIVED") {
      throw createError(
        "Route, arrival time, and price cannot be changed once a trip is boarding or later.",
        409,
      );
    }

    const data = {};
    const changedFields = [];

    if (routeId !== undefined && routeId !== trip.routeId) {
      const route = await getRouteOrThrow(tx, routeId);
      if (!route.isActive) {
        throw createError("Route is inactive.", 409);
      }
      data.routeId = routeId;
      changedFields.push("routeId");
    }

    if (arrivalTime !== undefined) {
      const arr = new Date(arrivalTime);
      if (Number.isNaN(arr.getTime())) {
        throw createError("Invalid arrival time.", 400);
      }
      if (arr <= new Date(trip.departureTime)) {
        throw createError("Arrival time must be after departure time.", 400);
      }
      await assertNoBusOverlap(
        tx,
        trip.busId,
        new Date(trip.departureTime),
        arr,
        trip.id,
      );
      data.arrivalTime = arr;
      changedFields.push("arrivalTime");
    }

    if (basePrice !== undefined) {
      data.basePrice = validatePrice(basePrice);
      changedFields.push("basePrice");
    }

    if (changedFields.length === 0) {
      throw createError("No updatable fields provided.", 400);
    }

    const updated = await tx.trip.update({
      where: { id: trip.id },
      data,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId: actorId || null,
        action: "TRIP_UPDATED",
        entityType: "Trip",
        entityId: trip.id,
        metadata: { changedFields, updated: data },
      },
    });

    return updated;
  });
};

const VALID_TRANSITIONS = {
  SCHEDULED: ["BOARDING", "DEPARTED", "CANCELLED", "DELAYED"],
  DELAYED: ["SCHEDULED", "BOARDING", "CANCELLED"],
  BOARDING: ["DEPARTED", "DELAYED", "CANCELLED"],
  DEPARTED: ["ARRIVED", "CANCELLED"],
  ARRIVED: [],
  CANCELLED: [],
};

export const updateTripStatus = async ({
  id,
  companyId,
  actorId,
  status,
}) => {
  validateId(id, "Trip ID");

  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!trip) {
      throw createError("Trip not found.", 404);
    }

    const allowed = VALID_TRANSITIONS[trip.status] || [];
    if (!allowed.includes(status)) {
      throw createError(
        `Cannot transition trip from ${trip.status} to ${status}.`,
        409,
      );
    }

    const updated = await tx.trip.update({
      where: { id: trip.id },
      data: { status },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId: actorId || null,
        action: "TRIP_STATUS_CHANGED",
        entityType: "Trip",
        entityId: trip.id,
        metadata: { previousStatus: trip.status, newStatus: status },
      },
    });

    return updated;
  });
};