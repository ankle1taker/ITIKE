import prisma from "../config/database.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateCompanyId = (companyId) => {
  if (!companyId || typeof companyId !== "string") {
    throw createError("Company ID is required.", 400);
  }
};

const dayBoundsUtc = (dateStr) => {
  const start = new Date(dateStr + "T00:00:00.000Z");
  const end = new Date(dateStr + "T23:59:59.999Z");
  return { start, end };
};

const computeDurationMinutes = (departure, arrival) => {
  if (!departure || !arrival) return null;
  return Math.round((arrival.getTime() - departure.getTime()) / 60000);
};

const shapePublicTrip = (trip) => {
  const availableSeats = trip.tripSeats.filter(
    (ts) => ts.status === "AVAILABLE",
  ).length;

  return {
    id: trip.id,
    company: {
      id: trip.company.id,
      name: trip.company.name,
    },
    route: {
      origin: trip.route.origin,
      destination: trip.route.destination,
    },
    bus: {
      registrationNumber: trip.bus.registrationNumber,
      capacity: trip.bus.capacity,
    },
    departureTime: trip.departureTime,
    arrivalTime: trip.arrivalTime,
    duration: computeDurationMinutes(
      trip.departureTime,
      trip.arrivalTime,
    ),
    basePrice: trip.basePrice,
    availableSeats,
    totalSeats: trip.tripSeats.length,
  };
};

export const searchTrips = async ({
  origin,
  destination,
  date,
  companyId,
  minSeats,
  minPrice,
  maxPrice,
  sort = "departure_asc",
  page = 1,
  limit = 20,
}) => {
  if (!Number.isInteger(page) || page < 1) {
    throw createError("Page must be a positive integer.", 400);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw createError("Limit must be between 1 and 50.", 400);
  }
  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    minPrice > maxPrice
  ) {
    throw createError("minPrice cannot be greater than maxPrice.", 400);
  }
  if (companyId !== undefined) {
    validateCompanyId(companyId);
  }

  const { start, end } = dayBoundsUtc(date);
  const now = new Date();

  const where = {
    status: "SCHEDULED",
    departureTime: { gte: start, lte: end },
    route: {
      isActive: true,
      origin: { equals: origin, mode: "insensitive" },
      destination: { equals: destination, mode: "insensitive" },
    },
    bus: { status: "ACTIVE" },
    company: { status: "ACTIVE" },
  };

  if (companyId !== undefined) where.companyId = companyId;

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.basePrice = {};
    if (minPrice !== undefined) where.basePrice.gte = minPrice;
    if (maxPrice !== undefined) where.basePrice.lte = maxPrice;
  }

  if (now > end) {
    return {
      trips: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  if (start <= now) {
    where.departureTime = { gt: now, lte: end };
  }

  // Fetch orderBy for base DB query. `duration_asc` and `minSeats` require
  // in-memory filtering/sorting because Prisma cannot express either natively.
  const requiresInMemory =
    sort === "duration_asc" || minSeats !== undefined;

  const orderBy = (() => {
    switch (sort) {
      case "price_asc":
        return [{ basePrice: "asc" }, { departureTime: "asc" }, { id: "asc" }];
      case "price_desc":
        return [{ basePrice: "desc" }, { departureTime: "asc" }, { id: "asc" }];
      case "duration_asc":
        return [{ departureTime: "asc" }, { id: "asc" }];
      case "departure_asc":
      default:
        return [{ departureTime: "asc" }, { id: "asc" }];
    }
  })();

  const skip = (page - 1) * limit;

  // For in-memory paths, fetch all matching rows (no DB pagination),
  // then filter/sort/slice deterministically.
  if (requiresInMemory) {
    const allTrips = await prisma.trip.findMany({
      where,
      orderBy,
      include: {
        company: { select: { id: true, name: true } },
        route: { select: { origin: true, destination: true } },
        bus: { select: { registrationNumber: true, capacity: true } },
        tripSeats: { select: { status: true } },
      },
    });

    let shaped = allTrips.map(shapePublicTrip);

    if (minSeats !== undefined) {
      shaped = shaped.filter((t) => t.availableSeats >= minSeats);
    }

    if (sort === "duration_asc") {
      shaped.sort((a, b) => (a.duration ?? 0) - (b.duration ?? 0));
    }

    const totalCount = shaped.length;
    const paged = shaped.slice(skip, skip + limit);
    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);

    return {
      trips: paged,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1 && totalPages > 0,
      },
    };
  }

  // Fast path: no in-memory work needed — DB pagination is exact.
  const [trips, totalCount] = await prisma.$transaction([
    prisma.trip.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        company: { select: { id: true, name: true } },
        route: { select: { origin: true, destination: true } },
        bus: { select: { registrationNumber: true, capacity: true } },
        tripSeats: { select: { status: true } },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  const shaped = trips.map(shapePublicTrip);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);

  return {
    trips: shaped,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1 && totalPages > 0,
    },
  };
};

export const getPublicTripById = async ({ id }) => {
  const now = new Date();

  const trip = await prisma.trip.findFirst({
    where: {
      id,
      status: "SCHEDULED",
      departureTime: { gt: now },
      route: { isActive: true },
      bus: { status: "ACTIVE" },
      company: { status: "ACTIVE" },
    },
    include: {
      company: { select: { id: true, name: true } },
      route: {
        select: {
          origin: true,
          destination: true,
          stops: {
            orderBy: { sequence: "asc" },
            select: { name: true, sequence: true },
          },
        },
      },
      bus: { select: { registrationNumber: true, capacity: true } },
      tripSeats: { select: { status: true } },
    },
  });

  if (!trip) {
    throw createError("Trip not found.", 404);
  }

  const shaped = shapePublicTrip(trip);
  shaped.route.stops = trip.route.stops;

  return shaped;
};