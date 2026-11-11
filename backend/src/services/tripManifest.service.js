import prisma from "../config/database.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const getTripManifest = async ({ tripId, companyId, status = "CONFIRMED" }) => {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, companyId },
    select: {
      id: true,
      departureTime: true,
      arrivalTime: true,
      status: true,
      route: { select: { origin: true, destination: true } },
      bus: { select: { registrationNumber: true, capacity: true } },
    },
  });

  if (!trip) {
    throw createError("Trip not found.", 404);
  }

  const bookings = await prisma.booking.findMany({
    where: {
      tripId,
      status,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      bookingNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      passengers: {
        select: { id: true, fullName: true, phone: true, idType: true, idNumber: true },
      },
      bookingSeat: {
        select: {
          id: true,
          passengerId: true,
          tripSeat: {
            select: {
              id: true,
              seat: { select: { seatNumber: true, seatType: true } },
            },
          },
        },
      },
    },
  });

  return {
    trip,
    bookings,
    bookingCount: bookings.length,
    passengerCount: bookings.reduce((sum, b) => sum + b.passengers.length, 0),
  };
};