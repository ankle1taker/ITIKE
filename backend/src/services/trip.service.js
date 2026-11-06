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

const getBusOrThrow = async (tx, busId, companyId) => {
  const bus = await tx.bus.findFirst({
    where: { id: busId, companyId },
    select: { id: true, status: true, capacity: true },
  });

  if (!bus) {
    throw createError("Bus not found.", 404);
  }

  return bus;
};

const getRouteOrThrow = async (tx, routeId) => {
  const route = await tx.route.findUnique({
    where: { id: routeId },
    select: {
      id: true,
      isActive: true,
      origin: true,
      destination: true,
      _count: { select: { stops: true } },
    },
  });

  if (!route) {
    throw createError("Route not found.", 404);
  }

  return route;
};

const assertNoBusOverlap = async (
  tx,
  busId,
  departureTime,
  arrivalTime,
  excludeTripId = null,
) => {
  const where = {
    busId,
    status: { in: ["SCHEDULED", "BOARDING", "DEPARTED", "DELAYED"] },
    arrivalTime: { gt: departureTime },
    departureTime: { lt: arrivalTime },
  };

  if (excludeTripId) {
    where.NOT = { id: excludeTripId };
  }

  const overlapping = await tx.trip.findFirst({
    where,
    select: { id: true, departureTime: true, arrivalTime: true },
  });

  if (overlapping) {
    throw createError(
      "This bus already has a trip scheduled during that time window.",
      409,
    );
  }
};

const ALLOWED_TRANSITIONS = {
  SCHEDULED: ["BOARDING", "CANCELLED", "DELAYED"],
  DELAYED: ["SCHEDULED", "BOARDING", "CANCELLED"],
  BOARDING: ["DEPARTED", "DELAYED", "CANCELLED"],
  DEPARTED: ["ARRIVED", "CANCELLED"],
  ARRIVED: [],
  CANCELLED: [],
};

const assertTransitionAllowed = (from, to) => {
  if (from === to) {
    throw createError(`Trip is already ${to}.`, 409);
  }
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw createError(`Cannot transition trip from ${from} to ${to}.`, 409);
  }
};

const FROZEN_UPDATE_FIELDS_AFTER_BOARDING = [
  "routeId",
  "arrivalTime",
  "basePrice",
];

export const createTrip = async ({
  companyId,
  actorId,
  routeId,
  busId,
  departureTime,
  arrivalTime,
  basePrice,
}) => {
  validateCompanyId(companyId);
  validateActorId(actorId);

  const dep = new Date(departureTime);
  const arr = new Date(arrivalTime);

  if (!(dep < arr)) {
    throw createError("Arrival time must be after departure time.", 400);
  }
  if (!(dep > new Date())) {
    throw createError("Departure time must be in the future.", 400);
  }

  return prisma.$transaction(async (tx) => {
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

    await assertNoBusOverlap(tx, busId, dep, arr);

    const trip = await tx.trip.create({
      data: {
        companyId,
        routeId,
        busId,
        departureTime: dep,
        arrivalTime: arr,
        basePrice,
        status: "SCHEDULED",
      },
      include: {
        route: {
          select: { id: true, origin: true, destination: true },
        },
        bus: {
          select: { id: true, registrationNumber: true, capacity: true },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        action: "TRIP_CREATED",
        entityType: "Trip",
        entityId: trip.id,
        metadata: {
          routeId: trip.routeId,
          busId: trip.busId,
          departureTime: trip.departureTime.toISOString(),
          arrivalTime: trip.arrivalTime.toISOString(),
          basePrice: trip.basePrice.toString(),
        },
      },
    });

    const warnings = [];
    if (route._count.stops === 0) {
      warnings.push("Route has no stops configured.");
    }

    return { trip, warnings };
  });
};

export const listTrips = async ({
  companyId,
  page = 1,
  limit = 20,
  status,
  busId,
  routeId,
  from,
  to,
  search,
}) => {
  validateCompanyId(companyId);

  if (!Number.isInteger(page) || page < 1) {
    throw createError("Page must be a positive integer.", 400);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError("Limit must be between 1 and 100.", 400);
  }

  const where = { companyId };

  if (status) where.status = status;
  if (busId) where.busId = busId;
  if (routeId) where.routeId = routeId;

  if (from || to) {
    where.departureTime = {};
    if (from) where.departureTime.gte = new Date(from);
    if (to) where.departureTime.lte = new Date(to);
  }

  if (search?.trim()) {
    const term = search.trim();
    where.route = {
      OR: [
        { origin: { contains: term, mode: "insensitive" } },
        { destination: { contains: term, mode: "insensitive" } },
      ],
    };
  }

  const skip = (page - 1) * limit;

  const [trips, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where,
      orderBy: [{ departureTime: "asc" }, { id: "asc" }],
      skip,
      take: limit,
      include: {
        route: { select: { id: true, origin: true, destination: true } },
        bus: { select: { id: true, registrationNumber: true, capacity: true } },
        _count: { select: { tripSeats: true, bookings: true } },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    trips,
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

export const getTripById = async ({ id, companyId }) => {
  validateId(id, "Trip ID");
  validateCompanyId(companyId);

  const trip = await prisma.trip.findFirst({
    where: { id, companyId },
    include: {
      route: {
        select: {
          id: true,
          origin: true,
          destination: true,
          stops: { orderBy: { sequence: "asc" } },
        },
      },
      bus: {
        select: {
          id: true,
          registrationNumber: true,
          capacity: true,
          status: true,
        },
      },
      _count: { select: { tripSeats: true, bookings: true } },
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
  validateCompanyId(companyId);
  validateActorId(actorId);

  const data = {};
  if (routeId !== undefined) data.routeId = routeId;
  if (arrivalTime !== undefined) data.arrivalTime = new Date(arrivalTime);
  if (basePrice !== undefined) data.basePrice = basePrice;

  if (Object.keys(data).length === 0) {
    throw createError("At least one trip field must be provided.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.trip.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw createError("Trip not found.", 404);
    }

    const isFrozen =
      existing.status === "BOARDING" ||
      existing.status === "DEPARTED" ||
      existing.status === "ARRIVED" ||
      existing.status === "CANCELLED";

    if (isFrozen) {
      const touchedFrozen = FROZEN_UPDATE_FIELDS_AFTER_BOARDING.some(
        (f) => data[f] !== undefined,
      );
      if (touchedFrozen) {
        throw createError(
          "Cannot modify route, arrival time, or price once boarding has started.",
          409,
        );
      }
    }

    if (data.routeId !== undefined && data.routeId !== existing.routeId) {
      const route = await getRouteOrThrow(tx, data.routeId);
      if (!route.isActive) {
        throw createError("Route is inactive.", 409);
      }
    }

    if (data.arrivalTime !== undefined) {
      if (!(existing.departureTime < data.arrivalTime)) {
        throw createError(
          "Arrival time must be after departure time.",
          400,
        );
      }
      await assertNoBusOverlap(
        tx,
        existing.busId,
        existing.departureTime,
        data.arrivalTime,
        id,
      );
    }

    if (data.basePrice !== undefined && data.basePrice <= 0) {
      throw createError("Price must be greater than 0.", 400);
    }

    const trip = await tx.trip.update({
      where: { id },
      data,
      include: {
        route: { select: { id: true, origin: true, destination: true } },
        bus: { select: { id: true, registrationNumber: true, capacity: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        action: "TRIP_UPDATED",
        entityType: "Trip",
        entityId: trip.id,
        metadata: { changedFields: Object.keys(data) },
      },
    });

    return trip;
  });
};

export const updateTripStatus = async ({
  id,
  companyId,
  actorId,
  status,
}) => {
  validateId(id, "Trip ID");
  validateCompanyId(companyId);
  validateActorId(actorId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.trip.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw createError("Trip not found.", 404);
    }

    assertTransitionAllowed(existing.status, status);

    const trip = await tx.trip.update({
      where: { id },
      data: { status },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        action: "TRIP_STATUS_CHANGED",
        entityType: "Trip",
        entityId: trip.id,
        metadata: {
          previousStatus: existing.status,
          newStatus: status,
        },
      },
    });

    return trip;
  });
};