import prisma from "../config/database.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Check in a ticket.
 *
 * Rules:
 *   - Ticket must exist and belong to a booking on a trip owned by req.companyId.
 *   - Ticket must be ACTIVE (not USED, CANCELLED, EXPIRED).
 *   - Trip status must be BOARDING, DEPARTED, or SCHEDULED-close-to-departure.
 *     (For V1: allow SCHEDULED, BOARDING, DELAYED. Reject DEPARTED/ARRIVED/CANCELLED.)
 *   - Sets Ticket.status=USED, Ticket.usedAt=now.
 *   - Audit log TICKET_CHECKED_IN.
 *
 * Idempotent-ish: if already USED, returns 409 with usedAt so operator knows when.
 */
export const checkInTicket = async ({
  ticketNumber,
  companyId,
  actorId,
}) => {
  if (!ticketNumber || typeof ticketNumber !== "string") {
    throw createError("Ticket number is required.", 400);
  }
  if (!companyId) {
    throw createError("Company context is required.", 403);
  }

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { ticketNumber },
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            status: true,
            trip: {
              select: {
                id: true,
                companyId: true,
                status: true,
                departureTime: true,
                route: { select: { origin: true, destination: true } },
              },
            },
            passengers: { select: { id: true, fullName: true, phone: true } },
            bookingSeat: {
              select: {
                tripSeat: {
                  select: { seat: { select: { seatNumber: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw createError("Ticket not found.", 404);
    }

    if (ticket.booking.trip.companyId !== companyId) {
      throw createError("Ticket does not belong to your company.", 404);
    }

    if (ticket.status === "USED") {
      throw createError(
        `Ticket already used at ${ticket.usedAt?.toISOString() || "unknown time"}.`,
        409,
      );
    }

    if (ticket.status !== "ACTIVE") {
      throw createError(
        `Cannot check in a ticket with status ${ticket.status}.`,
        409,
      );
    }

    if (ticket.booking.status !== "CONFIRMED") {
      throw createError(
        `Cannot check in a booking with status ${ticket.booking.status}.`,
        409,
      );
    }

    const tripStatus = ticket.booking.trip.status;
    if (!["SCHEDULED", "BOARDING", "DELAYED"].includes(tripStatus)) {
      throw createError(
        `Cannot check in for a trip with status ${tripStatus}.`,
        409,
      );
    }

    const now = new Date();

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: "USED", usedAt: now },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        action: "TICKET_CHECKED_IN",
        entityType: "Ticket",
        entityId: ticket.id,
        metadata: {
          ticketNumber: ticket.ticketNumber,
          bookingId: ticket.booking.id,
          bookingNumber: ticket.booking.bookingNumber,
          checkedInAt: now.toISOString(),
        },
      },
    });

    return {
      ticketId: updated.id,
      ticketNumber: updated.ticketNumber,
      usedAt: updated.usedAt,
      bookingNumber: ticket.booking.bookingNumber,
      trip: {
        departureTime: ticket.booking.trip.departureTime,
        route: `${ticket.booking.trip.route.origin} → ${ticket.booking.trip.route.destination}`,
      },
      passengers: ticket.booking.passengers,
      seats: ticket.booking.bookingSeat.map(
        (bs) => bs.tripSeat.seat.seatNumber,
      ),
    };
  });
};