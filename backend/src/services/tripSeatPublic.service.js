import prisma from "../config/database.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Public seat map for a trip. No auth, no PII.
 * A seat is available if:
 *  - TripSeat.status = AVAILABLE, OR
 *  - TripSeat.status = HELD but its ACTIVE BookingHold has expired
 */
export const getPublicTripSeats = async ({ tripId }) => {
  const now = new Date();

  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      status: "SCHEDULED",
      departureTime: { gt: now },
      route: { isActive: true },
      bus: { status: "ACTIVE" },
      company: { status: "ACTIVE" },
    },
    select: {
      id: true,
      departureTime: true,
      arrivalTime: true,
      basePrice: true,
      route: { select: { origin: true, destination: true } },
      bus: {
        select: {
          id: true,
          registrationNumber: true,
          capacity: true,
          layout: {
            select: { id: true, rowCount: true, columnCount: true, layoutType: true },
          },
        },
      },
    },
  });

  if (!trip) {
    throw createError("Trip not found.", 404);
  }

  const tripSeats = await prisma.tripSeat.findMany({
    where: { tripId },
    select: {
      id: true,
      status: true,
      bookingHolds: {
        where: { status: "ACTIVE" },
        select: { expiresAt: true },
      },
      seat: {
        select: {
          id: true,
          seatNumber: true,
          rowNumber: true,
          columnNumber: true,
          floorNumber: true,
          seatType: true,
          isBookable: true,
        },
      },
    },
    orderBy: [
      { seat: { floorNumber: "asc" } },
      { seat: { rowNumber: "asc" } },
      { seat: { columnNumber: "asc" } },
      { seat: { seatNumber: "asc" } },
    ],
  });

  const isEffectivelyAvailable = (ts) => {
    if (ts.status === "AVAILABLE") return true;
    if (ts.status === "HELD") {
      const activeHolds = ts.bookingHolds.filter((h) => h.status === "ACTIVE");
      if (activeHolds.length === 0) return true;
      return activeHolds.every((h) => new Date(h.expiresAt) < now);
    }
    return false;
  };

  const seats = tripSeats.map((ts) => ({
    id: ts.id,
    seatId: ts.seat.id,
    seatNumber: ts.seat.seatNumber,
    rowNumber: ts.seat.rowNumber,
    columnNumber: ts.seat.columnNumber,
    floorNumber: ts.seat.floorNumber,
    seatType: ts.seat.seatType,
    isBookable: ts.seat.isBookable,
    isAvailable: isEffectivelyAvailable(ts),
  }));

  const availableCount = seats.filter((s) => s.isAvailable).length;

  return {
    trip: {
      id: trip.id,
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime,
      basePrice: trip.basePrice,
      route: trip.route,
      bus: {
        registrationNumber: trip.bus.registrationNumber,
        capacity: trip.bus.capacity,
        layout: trip.bus.layout,
      },
    },
    seats,
    availableCount,
    totalCount: seats.length,
  };
};