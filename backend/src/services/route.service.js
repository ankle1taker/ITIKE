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

const validateActorId = (actorId) => {
  if (!actorId || typeof actorId !== "string") {
    throw createError("User not authenticated.", 401);
  }
};

const buildStopsCreate = (stops) => {
  if (!stops || stops.length === 0) return [];
  return stops.map((s, idx) => ({
    name: s.name,
    sequence: idx + 1,
  }));
};

const checkFirstLastStops = (origin, destination, stops) => {
  if (!stops || stops.length === 0) return;
  const first = stops[0].name.toLowerCase();
  const last = stops[stops.length - 1].name.toLowerCase();
  if (first !== origin.toLowerCase() || last !== destination.toLowerCase()) {
    throw createError(
      "If stops are provided, the first stop must equal origin and the last stop must equal destination.",
      400,
    );
  }
};

export const createRoute = async ({
  actorId,
  origin,
  destination,
  stops,
}) => {
  validateActorId(actorId);

  if (origin.toLowerCase() === destination.toLowerCase()) {
    throw createError("Origin and destination must be different.", 400);
  }

  checkFirstLastStops(origin, destination, stops);

  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.route.findFirst({
      where: {
        origin: { equals: origin, mode: "insensitive" },
        destination: { equals: destination, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw createError(
        "A route with this origin and destination already exists.",
        409,
      );
    }

    const route = await tx.route.create({
      data: {
        origin,
        destination,
        isActive: true,
        stops:
          stops && stops.length > 0
            ? { create: buildStopsCreate(stops) }
            : undefined,
      },
      include: {
        stops: { orderBy: { sequence: "asc" } },
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: null,
        actorId,
        action: "ROUTE_CREATED",
        entityType: "Route",
        entityId: route.id,
        metadata: {
          origin: route.origin,
          destination: route.destination,
          stopCount: route.stops.length,
        },
      },
    });

    return route;
  });
};

export const listRoutes = async ({
  page = 1,
  limit = 20,
  search,
  isActive,
}) => {
  if (!Number.isInteger(page) || page < 1) {
    throw createError("Page must be a positive integer.", 400);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError("Limit must be between 1 and 100.", 400);
  }

  const where = {};
  if (typeof isActive === "boolean") where.isActive = isActive;

  if (search?.trim()) {
    const term = search.trim();
    where.OR = [
      { origin: { contains: term, mode: "insensitive" } },
      { destination: { contains: term, mode: "insensitive" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [routes, total] = await prisma.$transaction([
    prisma.route.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      include: {
        _count: { select: { stops: true, trips: true } },
      },
    }),
    prisma.route.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    routes,
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

export const getRouteById = async ({ id }) => {
  validateId(id, "Route ID");

  const route = await prisma.route.findUnique({
    where: { id },
    include: {
      stops: { orderBy: { sequence: "asc" } },
      _count: { select: { trips: true } },
    },
  });

  if (!route) {
    throw createError("Route not found.", 404);
  }

  return route;
};

export const updateRoute = async ({
  id,
  actorId,
  origin,
  destination,
}) => {
  validateId(id, "Route ID");
  validateActorId(actorId);

  const data = {};
  if (origin !== undefined) data.origin = origin;
  if (destination !== undefined) data.destination = destination;

  if (Object.keys(data).length === 0) {
    throw createError("At least one route field must be provided.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.route.findUnique({
      where: { id },
      include: {
        stops: { orderBy: { sequence: "asc" } },
        _count: { select: { trips: true } },
      },
    });

    if (!existing) {
      throw createError("Route not found.", 404);
    }

    const nextOrigin = data.origin ?? existing.origin;
    const nextDestination = data.destination ?? existing.destination;

    if (nextOrigin.toLowerCase() === nextDestination.toLowerCase()) {
      throw createError("Origin and destination must be different.", 400);
    }

    if (existing._count.trips > 0) {
      const changingName =
        (data.origin !== undefined &&
          data.origin.toLowerCase() !== existing.origin.toLowerCase()) ||
        (data.destination !== undefined &&
          data.destination.toLowerCase() !==
            existing.destination.toLowerCase());

      if (changingName) {
        throw createError(
          "Cannot change origin or destination while trips exist for this route.",
          409,
        );
      }
    }

    if (existing.stops.length > 0) {
      const firstStop = existing.stops[0].name.toLowerCase();
      const lastStop =
        existing.stops[existing.stops.length - 1].name.toLowerCase();
      if (
        firstStop !== nextOrigin.toLowerCase() ||
        lastStop !== nextDestination.toLowerCase()
      ) {
        throw createError(
          "Origin/destination change would desync the existing first/last stops. Replace stops instead.",
          409,
        );
      }
    }

    const duplicate = await tx.route.findFirst({
      where: {
        NOT: { id },
        origin: { equals: nextOrigin, mode: "insensitive" },
        destination: { equals: nextDestination, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw createError(
        "A route with this origin and destination already exists.",
        409,
      );
    }

    const route = await tx.route.update({
      where: { id },
      data,
      include: { stops: { orderBy: { sequence: "asc" } } },
    });

    await tx.auditLog.create({
      data: {
        companyId: null,
        actorId,
        action: "ROUTE_UPDATED",
        entityType: "Route",
        entityId: route.id,
        metadata: { changedFields: Object.keys(data) },
      },
    });

    return route;
  });
};

export const updateRouteStatus = async ({ id, actorId, isActive }) => {
  validateId(id, "Route ID");
  validateActorId(actorId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.route.findUnique({
      where: { id },
      include: { _count: { select: { trips: true } } },
    });

    if (!existing) {
      throw createError("Route not found.", 404);
    }

    if (existing.isActive === isActive) {
      throw createError(
        `Route is already ${isActive ? "active" : "inactive"}.`,
        409,
      );
    }

    if (isActive === false && existing._count.trips > 0) {
      throw createError(
        `Cannot deactivate route: it is used by ${existing._count.trips} trip(s).`,
        409,
      );
    }

    const route = await tx.route.update({
      where: { id },
      data: { isActive },
    });

    await tx.auditLog.create({
      data: {
        companyId: null,
        actorId,
        action: "ROUTE_STATUS_CHANGED",
        entityType: "Route",
        entityId: route.id,
        metadata: {
          previousStatus: existing.isActive,
          newStatus: isActive,
        },
      },
    });

    return route;
  });
};

export const replaceRouteStops = async ({ id, actorId, stops }) => {
  validateId(id, "Route ID");
  validateActorId(actorId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.route.findUnique({
      where: { id },
      select: { id: true, origin: true, destination: true },
    });

    if (!existing) {
      throw createError("Route not found.", 404);
    }

    if (stops.length > 0) {
      const first = stops[0].name.toLowerCase();
      const last = stops[stops.length - 1].name.toLowerCase();
      if (
        first !== existing.origin.toLowerCase() ||
        last !== existing.destination.toLowerCase()
      ) {
        throw createError(
          "If stops are provided, the first stop must equal origin and the last stop must equal destination.",
          400,
        );
      }
    }

    // Remove all existing stops, then recreate from input in order.
    await tx.routeStop.deleteMany({ where: { routeId: id } });

    if (stops.length > 0) {
      await tx.routeStop.createMany({
        data: stops.map((s, idx) => ({
          routeId: id,
          name: s.name,
          sequence: idx + 1,
        })),
      });
    }

    const route = await tx.route.findUnique({
      where: { id },
      include: { stops: { orderBy: { sequence: "asc" } } },
    });

    await tx.auditLog.create({
      data: {
        companyId: null,
        actorId,
        action: "ROUTE_STOPS_REPLACED",
        entityType: "Route",
        entityId: id,
        metadata: { stopCount: stops.length },
      },
    });

    return route;
  });
};