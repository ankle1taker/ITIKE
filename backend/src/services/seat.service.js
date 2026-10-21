
import prisma from "../config/database.js";

const ALLOWED_STATUSES = ["ACTIVE", "INACTIVE"];

const ALLOWED_SEAT_TYPES = [
  "REGULAR",
  "PREMIUM",
  "VIP",
  "ACCESSIBLE",
];

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

const normalizeSeatNumber = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().toUpperCase();
};

const validateSeatNumber = (seatNumber) => {
  if (
    typeof seatNumber !== "string" ||
    !seatNumber.trim() ||
    seatNumber.trim().length > 20
  ) {
    throw createError(
      "Seat number must contain between 1 and 20 characters.",
      400,
    );
  }
};

const validateCoordinate = (value, fieldName) => {
  if (value === undefined || value === null) {
    return;
  }

  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw createError(
      `${fieldName} must be an integer between 1 and 100, or null.`,
      400,
    );
  }
};

const validateFloorNumber = (floorNumber) => {
  if (
    !Number.isInteger(floorNumber) ||
    floorNumber < 1 ||
    floorNumber > 10
  ) {
    throw createError(
      "Floor number must be an integer between 1 and 10.",
      400,
    );
  }
};

const validateSeatType = (seatType) => {
  if (!ALLOWED_SEAT_TYPES.includes(seatType)) {
    throw createError("Invalid seat type.", 400);
  }
};

const validateStatus = (status) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw createError("Invalid seat status.", 400);
  }
};

const handleUniqueConstraintError = (error) => {
  if (error?.code === "P2002") {
    throw createError(
      "A seat with this number already exists on this bus.",
      409,
    );
  }

  throw error;
};

/*
 * Must use the same bus-row lock as bus.service.js.
 * This serializes seat creation/reactivation against capacity changes.
 */
const lockBusForMutation = async (tx, busId, companyId) => {
  await tx.$queryRaw`
    SELECT "id"
    FROM "Bus"
    WHERE "id" = ${busId}
      AND "companyId" = ${companyId}
    FOR UPDATE
  `;

  const bus = await tx.bus.findFirst({
    where: {
      id: busId,
      companyId,
    },
    select: {
      id: true,
      capacity: true,
      status: true,
    },
  });

  if (!bus) {
    throw createError("Bus not found.", 404);
  }

  return bus;
};

const getBus = async ({ busId, companyId }) => {
  validateId(busId, "Bus ID");
  validateCompanyId(companyId);

  const bus = await prisma.bus.findFirst({
    where: {
      id: busId,
      companyId,
    },
    select: {
      id: true,
      capacity: true,
      status: true,
    },
  });

  if (!bus) {
    throw createError("Bus not found.", 404);
  }

  return bus;
};

export const createSeat = async ({
  busId,
  companyId,
  actorId,
  seatNumber,
  rowNumber = null,
  columnNumber = null,
  floorNumber = 1,
  seatType = "REGULAR",
  isBookable = true,
}) => {
  validateId(busId, "Bus ID");
  validateCompanyId(companyId);
  validateActorId(actorId);
  validateSeatNumber(seatNumber);
  validateCoordinate(rowNumber, "Row number");
  validateCoordinate(columnNumber, "Column number");
  validateFloorNumber(floorNumber);
  validateSeatType(seatType);

  if (typeof isBookable !== "boolean") {
    throw createError("isBookable must be a boolean.", 400);
  }

  const normalizedSeatNumber = normalizeSeatNumber(seatNumber);

  try {
    return await prisma.$transaction(async (tx) => {
      const bus = await lockBusForMutation(
        tx,
        busId,
        companyId,
      );

      const existingSeat = await tx.seat.findUnique({
        where: {
          busId_seatNumber: {
            busId,
            seatNumber: normalizedSeatNumber,
          },
        },
        select: { id: true },
      });

      if (existingSeat) {
        throw createError(
          "A seat with this number already exists on this bus.",
          409,
        );
      }

      const activeSeatCount = await tx.seat.count({
        where: {
          busId,
          status: "ACTIVE",
        },
      });

      if (activeSeatCount >= bus.capacity) {
        throw createError(
          `This bus has reached its capacity of ${bus.capacity} active seats.`,
          409,
        );
      }

      const seat = await tx.seat.create({
        data: {
          busId,
          seatNumber: normalizedSeatNumber,
          rowNumber,
          columnNumber,
          floorNumber,
          seatType,
          isBookable,
          status: "ACTIVE",
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: "SEAT_CREATED",
          entityType: "Seat",
          entityId: seat.id,
          metadata: {
            busId,
            seatNumber: seat.seatNumber,
            rowNumber: seat.rowNumber,
            columnNumber: seat.columnNumber,
            floorNumber: seat.floorNumber,
            seatType: seat.seatType,
            isBookable: seat.isBookable,
          },
        },
      });

      return seat;
    });
  } catch (error) {
    handleUniqueConstraintError(error);
  }
};

export const listSeats = async ({
  busId,
  companyId,
  page = 1,
  limit = 100,
  search,
  status,
}) => {
  await getBus({ busId, companyId });

  if (!Number.isInteger(page) || page < 1) {
    throw createError("Page must be a positive integer.", 400);
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError("Limit must be between 1 and 100.", 400);
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    throw createError("Invalid seat status.", 400);
  }

  const where = { busId };

  if (status) {
    where.status = status;
  }

  if (search?.trim()) {
    where.seatNumber = {
      contains: search.trim(),
      mode: "insensitive",
    };
  }

  const skip = (page - 1) * limit;

  const [seats, total] = await prisma.$transaction([
    prisma.seat.findMany({
      where,
      orderBy: [
        { floorNumber: "asc" },
        { rowNumber: "asc" },
        { columnNumber: "asc" },
        { seatNumber: "asc" },
      ],
      skip,
      take: limit,
    }),
    prisma.seat.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    seats,
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

export const getSeatById = async ({
  busId,
  id,
  companyId,
}) => {
  validateId(busId, "Bus ID");
  validateId(id, "Seat ID");
  await getBus({ busId, companyId });

  const seat = await prisma.seat.findFirst({
    where: {
      id,
      busId,
    },
  });

  if (!seat) {
    throw createError("Seat not found.", 404);
  }

  return seat;
};

export const updateSeat = async ({
  busId,
  id,
  companyId,
  actorId,
  seatNumber,
  rowNumber,
  columnNumber,
  floorNumber,
  seatType,
  isBookable,
}) => {
  validateId(busId, "Bus ID");
  validateId(id, "Seat ID");
  validateCompanyId(companyId);
  validateActorId(actorId);

  const data = {};

  if (seatNumber !== undefined) {
    validateSeatNumber(seatNumber);
    data.seatNumber = normalizeSeatNumber(seatNumber);
  }

  if (rowNumber !== undefined) {
    validateCoordinate(rowNumber, "Row number");
    data.rowNumber = rowNumber;
  }

  if (columnNumber !== undefined) {
    validateCoordinate(columnNumber, "Column number");
    data.columnNumber = columnNumber;
  }

  if (floorNumber !== undefined) {
    validateFloorNumber(floorNumber);
    data.floorNumber = floorNumber;
  }

  if (seatType !== undefined) {
    validateSeatType(seatType);
    data.seatType = seatType;
  }

  if (isBookable !== undefined) {
    if (typeof isBookable !== "boolean") {
      throw createError("isBookable must be a boolean.", 400);
    }

    data.isBookable = isBookable;
  }

  if (Object.keys(data).length === 0) {
    throw createError(
      "At least one seat field must be provided.",
      400,
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await lockBusForMutation(tx, busId, companyId);

      const existingSeat = await tx.seat.findFirst({
        where: {
          id,
          busId,
        },
      });

      if (!existingSeat) {
        throw createError("Seat not found.", 404);
      }

      if (data.seatNumber !== undefined) {
        const duplicate = await tx.seat.findFirst({
          where: {
            busId,
            seatNumber: data.seatNumber,
            NOT: { id },
          },
          select: { id: true },
        });

        if (duplicate) {
          throw createError(
            "A seat with this number already exists on this bus.",
            409,
          );
        }
      }

      const seat = await tx.seat.update({
        where: { id },
        data,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: "SEAT_UPDATED",
          entityType: "Seat",
          entityId: seat.id,
          metadata: {
            changedFields: Object.keys(data),
          },
        },
      });

      return seat;
    });
  } catch (error) {
    handleUniqueConstraintError(error);
  }
};

export const updateSeatStatus = async ({
  busId,
  id,
  companyId,
  actorId,
  status,
}) => {
  validateId(busId, "Bus ID");
  validateId(id, "Seat ID");
  validateCompanyId(companyId);
  validateActorId(actorId);
  validateStatus(status);

  return prisma.$transaction(async (tx) => {
    const bus = await lockBusForMutation(
      tx,
      busId,
      companyId,
    );

    const existingSeat = await tx.seat.findFirst({
      where: {
        id,
        busId,
      },
    });

    if (!existingSeat) {
      throw createError("Seat not found.", 404);
    }

    if (existingSeat.status === status) {
      throw createError(`Seat is already ${status}.`, 409);
    }

    if (status === "ACTIVE") {
      const activeSeatCount = await tx.seat.count({
        where: {
          busId,
          status: "ACTIVE",
          NOT: { id },
        },
      });

      if (activeSeatCount >= bus.capacity) {
        throw createError(
          `This bus has reached its capacity of ${bus.capacity} active seats.`,
          409,
        );
      }
    }

    const seat = await tx.seat.update({
      where: { id },
      data: { status },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        action: "SEAT_STATUS_CHANGED",
        entityType: "Seat",
        entityId: seat.id,
        metadata: {
          previousStatus: existingSeat.status,
          newStatus: status,
        },
      },
    });

    return seat;
  });
};
