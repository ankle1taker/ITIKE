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

// Africa/Kigali is UTC+02:00 year-round (no DST).
const dayBoundsKigali = (dateStr) => {
  const start = new Date(dateStr + "T00:00:00+02:00");
  const end = new Date(dateStr + "T23:59:59.999+02:00");
  return { start, end };
};

const computeDurationMinutes = (departure, arrival) => {
  if (!departure || !arrival) return null;
  return Math.round((arrival.getTime() - departure.getTime()) / 60000);
};

/**
 * A TripSeat counts as available if:
 *  - status AVAILABLE, OR
 *  - status HELD but all of its ACTIVE BookingHolds have expired.
 *
 * The authoritative expiry is BookingHold.expiresAt, NOT Booking.expiresAt,
 * because Booking.expiresAt only gets synced when a sweep runs. Search is
 * read-only and must not depend on a sweep to have happened.
 */
const isSeatEffectivelyAvailable = (tripSeat, now) => {
  if (tripSeat.status === "AVAILABLE") return true;
  if (tripSeat.status === "HELD") {
    const holds = tripSeat.bookingHolds || [];
    // Consider only holds that are still logically ACTIVE (not RELEASED/EXPIRED/etc.)
    const activeHolds = holds.filter((h) => h.status === "ACTIVE");
    // No active hold at all → the seat is stuck in HELD with no owner; treat as available
    if (activeHolds.length === 0) return true;
    // If ALL active holds are expired → seat is available
    return activeHolds.every((h) => new Date(h.expiresAt) < now);
  }
  return false;
};

const shapePublicTrip = (trip, now) => {
  const availableSeats = trip.tripSeats.filter((ts) =>
    isSeatEffectivelyAvailable(ts, now),
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
    duration: computeDurationMinutes(trip.departureTime, trip.arrivalTime),
    basePrice: trip.basePrice,
    availableSeats,
    totalSeats: trip.tripSeats.length,
  };
};

// Fetch only the fields the availability check needs.
// BookingHold is the authoritative source of expiresAt.
const tripSeatInclude = {
  select: {
    status: true,
    bookingHolds: {
      select: {
        status: true,
        expiresAt: true,
      },
    },
  },
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
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw createError("minPrice cannot be greater than maxPrice.", 400);
  }
  if (companyId !== undefined) {
    validateCompanyId(companyId);
  }

  const { start, end } = dayBoundsKigali(date);
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

  const requiresInMemory = sort === "duration_asc" || minSeats !== undefined;

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

  if (requiresInMemory) {
    const allTrips = await prisma.trip.findMany({
      where,
      orderBy,
      include: {
        company: { select: { id: true, name: true } },
        route: { select: { origin: true, destination: true } },
        bus: { select: { registrationNumber: true, capacity: true } },
        tripSeats: tripSeatInclude,
      },
    });

    let shaped = allTrips.map((t) => shapePublicTrip(t, now));

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
        tripSeats: tripSeatInclude,
      },
    }),
    prisma.trip.count({ where }),
  ]);

  const shaped = trips.map((t) => shapePublicTrip(t, now));
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
      tripSeats: tripSeatInclude,
    },
  });

  if (!trip) {
    throw createError("Trip not found.", 404);
  }

  const shaped = shapePublicTrip(trip, now);
  shaped.route.stops = trip.route.stops;

  return shaped;
};