import prisma from "../config/database.js";

const ALLOWED_STATUSES = [
  "ACTIVE",
  "MAINTENANCE",
  "INACTIVE",
];

const normalizeRegistrationNumber = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().toUpperCase();
};

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

const validateCapacity = (capacity) => {
  if (!Number.isInteger(capacity)) {
    throw createError("Bus capacity must be an integer.", 400);
  }

  if (capacity < 1 || capacity > 200) {
    throw createError(
      "Bus capacity must be between 1 and 200.",
      400,
    );
  }
};

const validateStatus = (status) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw createError(
      "Invalid bus status.",
      400,
    );
  }
};

export const createBus = async ({
  companyId,
  registrationNumber,
  manufacturer,
  model,
  busType,
  capacity,
  actorId,
}) => {
  validateCompanyId(companyId);
  validateActorId(actorId);

  if (!registrationNumber) {
    throw createError(
      "Registration number is required.",
      400,
    );
  }

  if (!busType) {
    throw createError(
      "Bus type is required.",
      400,
    );
  }

  validateCapacity(capacity);

  const normalizedRegistrationNumber =
    normalizeRegistrationNumber(registrationNumber);

  const existingBus = await prisma.bus.findUnique({
    where: {
      companyId_registrationNumber: {
        companyId,
        registrationNumber:
          normalizedRegistrationNumber,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingBus) {
    throw createError(
      "A bus with this registration number already exists in your company.",
      409,
    );
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const bus = await tx.bus.create({
        data: {
          companyId,
          registrationNumber:
            normalizedRegistrationNumber,
          manufacturer: manufacturer || null,
          model: model || null,
          busType: busType.trim(),
          capacity,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: "BUS_CREATED",
          entityType: "Bus",
          entityId: bus.id,
          metadata: {
            registrationNumber:
              bus.registrationNumber,
            busType: bus.busType,
            capacity: bus.capacity,
          },
        },
      });

      return bus;
    },
  );

  return result;
};

export const listBuses = async ({
  companyId,
  page = 1,
  limit = 20,
  search,
  status,
}) => {
  validateCompanyId(companyId);

  if (!Number.isInteger(page) || page < 1) {
    throw createError(
      "Page must be a positive integer.",
      400,
    );
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw createError(
      "Limit must be between 1 and 100.",
      400,
    );
  }

  if (status) {
    validateStatus(status);
  }

  const skip = (page - 1) * limit;

  const where = {
    companyId,
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      {
        registrationNumber: {
          contains: search.trim(),
          mode: "insensitive",
        },
      },
      {
        manufacturer: {
          contains: search.trim(),
          mode: "insensitive",
        },
      },
      {
        model: {
          contains: search.trim(),
          mode: "insensitive",
        },
      },
      {
        busType: {
          contains: search.trim(),
          mode: "insensitive",
        },
      },
    ];
  }

  const [buses, total] =
    await prisma.$transaction([
      prisma.bus.findMany({
        where,
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        skip,
        take: limit,
      }),
      prisma.bus.count({
        where,
      }),
    ]);

  const totalPages =
    total === 0
      ? 0
      : Math.ceil(total / limit);

  return {
    buses,
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

export const getBusById = async ({
  id,
  companyId,
}) => {
  validateId(id, "Bus ID");
  validateCompanyId(companyId);

  const bus = await prisma.bus.findFirst({
    where: {
      id,
      companyId,
    },
    include: {
      _count: {
        select: {
          seats: true,
          trips: true,
        },
      },
    },
  });

  if (!bus) {
    throw createError(
      "Bus not found.",
      404,
    );
  }

  return bus;
};

export const updateBus = async ({
  id,
  companyId,
  actorId,
  registrationNumber,
  manufacturer,
  model,
  busType,
  capacity,
}) => {
  validateId(id, "Bus ID");
  validateCompanyId(companyId);
  validateActorId(actorId);

  const existingBus =
    await prisma.bus.findFirst({
      where: {
        id,
        companyId,
      },
    });

  if (!existingBus) {
    throw createError(
      "Bus not found.",
      404,
    );
  }

  const data = {};

  if (registrationNumber !== undefined) {
    const normalizedRegistrationNumber =
      normalizeRegistrationNumber(
        registrationNumber,
      );

    if (!normalizedRegistrationNumber) {
      throw createError(
        "Registration number cannot be empty.",
        400,
      );
    }

    const duplicate =
      await prisma.bus.findFirst({
        where: {
          companyId,
          registrationNumber:
            normalizedRegistrationNumber,
          NOT: {
            id,
          },
        },
        select: {
          id: true,
        },
      });

    if (duplicate) {
      throw createError(
        "A bus with this registration number already exists in your company.",
        409,
      );
    }

    data.registrationNumber =
      normalizedRegistrationNumber;
  }

  if (manufacturer !== undefined) {
    data.manufacturer =
      manufacturer?.trim() || null;
  }

  if (model !== undefined) {
    data.model =
      model?.trim() || null;
  }

  if (busType !== undefined) {
    if (
      typeof busType !== "string" ||
      !busType.trim()
    ) {
      throw createError(
        "Bus type cannot be empty.",
        400,
      );
    }

    data.busType = busType.trim();
  }

  if (capacity !== undefined) {
    validateCapacity(capacity);
    data.capacity = capacity;
  }

  if (Object.keys(data).length === 0) {
    throw createError(
      "At least one bus field must be provided.",
      400,
    );
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const bus = await tx.bus.update({
        where: {
          id,
        },
        data,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: "BUS_UPDATED",
          entityType: "Bus",
          entityId: bus.id,
          metadata: {
            changedFields: Object.keys(data),
          },
        },
      });

      return bus;
    },
  );

  return result;
};

export const updateBusStatus = async ({
  id,
  companyId,
  actorId,
  status,
}) => {
  validateId(id, "Bus ID");
  validateCompanyId(companyId);
  validateActorId(actorId);
  validateStatus(status);

  const existingBus =
    await prisma.bus.findFirst({
      where: {
        id,
        companyId,
      },
      select: {
        id: true,
        registrationNumber: true,
        status: true,
      },
    });

  if (!existingBus) {
    throw createError(
      "Bus not found.",
      404,
    );
  }

  if (existingBus.status === status) {
    throw createError(
      `Bus is already ${status}.`,
      409,
    );
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const bus = await tx.bus.update({
        where: {
          id,
        },
        data: {
          status,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: "BUS_STATUS_CHANGED",
          entityType: "Bus",
          entityId: bus.id,
          metadata: {
            previousStatus:
              existingBus.status,
            newStatus: status,
          },
        },
      });

      return bus;
    },
  );

  return result;
};
