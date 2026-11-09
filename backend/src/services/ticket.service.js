import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "../config/database.js";

const QR_EXPIRY_HOURS_AFTER_DEPARTURE = 24;

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getQrSecret = () => {
  const secret = process.env.TICKET_QR_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "TICKET_QR_SECRET (or JWT_SECRET fallback) is required to sign QR codes.",
    );
  }
  return secret;
};

const generateTicketNumber = () => {
  const date = new Date();
  const ymd =
    date.getUTCFullYear().toString() +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    String(date.getUTCDate()).padStart(2, "0");
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `TKT-${ymd}-${rand}`;
};

const signQrPayload = ({ ticketId, bookingId, ticketNumber, customerId, expiresAt }) => {
  const secret = getQrSecret();
  const expSeconds = Math.floor(expiresAt.getTime() / 1000);
  return jwt.sign(
    {
      tid: ticketId,
      bid: bookingId,
      tn: ticketNumber,
      sub: customerId,
    },
    secret,
    { expiresIn: expSeconds - Math.floor(Date.now() / 1000) },
  );
};

/**
 * Generate a ticket for a CONFIRMED booking.
 * Called from payment.service.js inside the payment-confirmation transaction.
 * Uses the caller's `tx` — do not open a nested transaction.
 *
 * Idempotent: if a ticket already exists for the booking, returns it unchanged.
 */
export const issueTicketForBookingInTx = async (tx, { bookingId }) => {
  const existing = await tx.ticket.findUnique({
    where: { bookingId },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }

  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customerId: true,
      status: true,
      trip: {
        select: {
          departureTime: true,
        },
      },
    },
  });

  if (!booking) {
    throw createError("Booking not found.", 404);
  }
  if (booking.status !== "CONFIRMED") {
    throw createError(
      `Cannot issue ticket for booking in ${booking.status} status.`,
      409,
    );
  }

  const expiresAt = new Date(
    new Date(booking.trip.departureTime).getTime() +
      QR_EXPIRY_HOURS_AFTER_DEPARTURE * 60 * 60 * 1000,
  );

  const ticketNumber = generateTicketNumber();

  // Create ticket first with a placeholder qrCodeValue, then sign, then update
  // (JWT needs the ticket ID which only exists after insert).
  const ticket = await tx.ticket.create({
    data: {
      bookingId: booking.id,
      ticketNumber,
      qrCodeValue: `pending-${ticketNumber}`,
      status: "ACTIVE",
      issuedAt: new Date(),
    },
  });

  const qrCode = signQrPayload({
    ticketId: ticket.id,
    bookingId: booking.id,
    ticketNumber: ticket.ticketNumber,
    customerId: booking.customerId,
    expiresAt,
  });

  const finalTicket = await tx.ticket.update({
    where: { id: ticket.id },
    data: { qrCodeValue: qrCode },
  });

  await tx.auditLog.create({
    data: {
      companyId: null,
      actorId: booking.customerId,
      action: "TICKET_ISSUED",
      entityType: "Ticket",
      entityId: finalTicket.id,
      metadata: {
        bookingId: booking.id,
        ticketNumber: finalTicket.ticketNumber,
        expiresAt: expiresAt.toISOString(),
      },
    },
  });

  return finalTicket;
};

/**
 * Verify a QR code. Returns ticket status + summary.
 * No PII (name, phone) returned.
 * Signature failures → 400; DB-missing ticket → 400 (safer than 404 — the QR
 * was valid but the ticket was deleted; don't reveal).
 */
export const verifyQrCode = async ({ qrCode }) => {
  const secret = getQrSecret();

  let decoded;
  try {
    decoded = jwt.verify(qrCode, secret);
  } catch (err) {
    throw createError("Invalid or expired QR code.", 400);
  }

  const { tid } = decoded || {};
  if (!tid || typeof tid !== "string") {
    throw createError("Invalid QR payload.", 400);
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: tid },
    include: {
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          trip: {
            select: {
              departureTime: true,
              route: { select: { origin: true, destination: true } },
            },
          },
          bookingSeat: {
            select: {
              tripSeat: {
                select: {
                  seat: { select: { seatNumber: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    throw createError("Ticket not found.", 400);
  }

  return {
    valid: true,
    status: ticket.status,
    ticketNumber: ticket.ticketNumber,
    bookingNumber: ticket.booking.bookingNumber,
    bookingStatus: ticket.booking.status,
    trip: {
      departureTime: ticket.booking.trip.departureTime,
      route: `${ticket.booking.trip.route.origin} → ${ticket.booking.trip.route.destination}`,
    },
    seatNumbers: ticket.booking.bookingSeat.map(
      (bs) => bs.tripSeat.seat.seatNumber,
    ),
    issuedAt: ticket.issuedAt,
    usedAt: ticket.usedAt,
  };
};

/**
 * Fetch the ticket for a booking. Ownership enforced via customerId.
 */
export const getTicketForBooking = async ({ bookingId, customerId }) => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId },
    select: { id: true },
  });
  if (!booking) {
    throw createError("Booking not found.", 404);
  }

  const ticket = await prisma.ticket.findUnique({
    where: { bookingId: booking.id },
    include: {
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          trip: {
            select: {
              departureTime: true,
              arrivalTime: true,
              route: { select: { origin: true, destination: true } },
              bus: { select: { registrationNumber: true } },
              company: { select: { name: true } },
            },
          },
          passengers: {
            select: { id: true, fullName: true },
          },
          bookingSeat: {
            select: {
              amount: true,
              passengerId: true,
              tripSeat: {
                select: {
                  seat: { select: { seatNumber: true, seatType: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    throw createError("No ticket issued for this booking yet.", 404);
  }

  return ticket;
};

/**
 * List tickets for the authenticated customer.
 */
export const listMyTickets = async ({ customerId, page = 1, limit = 20, status }) => {
  if (!Number.isInteger(page) || page < 1) {
    throw createError("Page must be a positive integer.", 400);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw createError("Limit must be between 1 and 50.", 400);
  }

  const where = {
    booking: { customerId },
  };
  if (status) where.status = status;

  const skip = (page - 1) * limit;

  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            trip: {
              select: {
                departureTime: true,
                route: { select: { origin: true, destination: true } },
              },
            },
          },
        },
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    tickets,
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