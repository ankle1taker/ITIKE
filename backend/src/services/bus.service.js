import prisma from "../config/database.js";

const ALLOWED_STATUSES = ["ACTIVE", "MAINTENANCE", "INACTIVE"];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeRegistrationNumber = (value) => {
  if (typeof value !== "string") return value;
  return value.trim().toUpperCase();
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
    throw createError("Bus capacity must be between 1 and 200.", 400);
  }
};

const validateStatus = (status) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw createError("Invalid bus status.", 400);
  }
};

const validateLayoutId = (layoutId) => {
  if (
    layoutId !== undefined &&
    layoutId !== null &&
    (typeof layoutId !== "string" || !layoutId.trim())
  ) {
    throw createError("Invalid bus layout ID.", 400);
  }
};

const rethrowIfUniqueConstraint = (error, message) => {
  if (error?.code === "P2002") {
    throw createError(message, 409);
  }
  throw error;
};

const lockBusRow = async (tx, id, companyId) => {
  await tx.$queryRaw`
    SELECT "id"
    FROM "Bus"
    WHERE "id" = ${id}
      AND "companyId" = ${companyId}
    FOR UPDATE
  `;
};

const getActiveCompanyLayout = async (tx, layoutId, companyId) => {
  if (layoutId === undefined || layoutId === null) return null;

  const layout = await tx.busLayout.findFirst({
    where: { id: layoutId, companyId, isActive: true },
    select: { id: true },
  });

  if (!layout) {
    throw createError(
      "Bus layout not found, inactive, or not owned by your company.",
      400,
    );
  }

  return layout;
};

export const createBus = async ({
  companyId,
  layoutId,
  registrationNumber,
  manufacturer,
  model,
  busType,
  capacity,
  actorId,
}) => {
  validateCompanyId(companyId);
  validateActorId(actorId);
  validateLayoutId(layoutId);

  if (typeof registrationNumber !== "string" || !registrationNumber.trim()) {
    throw createError("Registration number is required.", 400);
  }
  if (typeof busType !== "string" || !busType.trim()) {
    throw createError("Bus type is required.", 400);
  }

  validateCapacity(capacity);

  const normalizedRegistrationNumber =
    normalizeRegistrationNumber(registrationNumber);

  try {
    return await prisma.$transaction(async (tx) => {
      const layout = await getActiveCompanyLayout(tx, layoutId, companyId);

      const bus = await tx.bus.create({
        data: {
          companyId,
          layoutId: layout?.id ?? null,
          registrationNumber: normalizedRegistrationNumber,
          manufacturer: manufacturer?.trim() || null,
          model: model?.trim() || null,
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
            registrationNumber: bus.registrationNumber,
            busType: bus.busType,
            capacity: bus.capacity,
            layoutId: bus.layoutId,
          },
        },
      });

      return bus;
    });
  } catch (error) {
    rethrowIfUniqueConstraint(
      error,
      "A bus with this registration number or another unique value already exists in your company.",
    );
  }
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
    throw createError("Page must be a positive integer.", 400);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError("Limit must be between 1 and 100.", 400);
  }
  if (status) validateStatus(status);

  const skip = (page - 1) * limit;
  const where = { companyId };
  if (status) where.status = status;

  if (search?.trim()) {
    const searchTerm = search.trim();
    where.OR = [
      { registrationNumber: { contains: searchTerm, mode: "insensitive" } },
      { manufacturer: { contains: searchTerm, mode: "insensitive" } },
      { model: { contains: searchTerm, mode: "insensitive" } },
      { busType: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  const [buses, total] = await prisma.$transaction([
    prisma.bus.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      include: {
        layout: { select: { id: true, name: true, layoutType: true } },
      },
    }),
    prisma.bus.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

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

export const getBusById = async ({ id, companyId }) => {
  validateId(id, "Bus ID");
  validateCompanyId(companyId);

  const bus = await prisma.bus.findFirst({
    where: { id, companyId },
    include: {
      layout: { select: { id: true, name: true, layoutType: true } },
      _count: { select: { seats: true, trips: true } },
    },
  });

  if (!bus) {
    throw createError("Bus not found.", 404);
  }

  return bus;
};

export const updateBus = async ({
  id,
  companyId,
  actorId,
  layoutId,
  registrationNumber,
  manufacturer,
  model,
  busType,
  capacity,
}) => {
  validateId(id, "Bus ID");
  validateCompanyId(companyId);
  validateActorId(actorId);
  validateLayoutId(layoutId);

  const data = {};

  if (registrationNumber !== undefined) {
    const normalized = normalizeRegistrationNumber(registrationNumber);
    if (!normalized) {
      throw createError("Registration number cannot be empty.", 400);
    }
    data.registrationNumber = normalized;
  }

  if (manufacturer !== undefined) {
    data.manufacturer = manufacturer?.trim() || null;
  }
  if (model !== undefined) {
    data.model = model?.trim() || null;
  }
  if (busType !== undefined) {
    if (typeof busType !== "string" || !busType.trim()) {
      throw createError("Bus type cannot be empty.", 400);
    }
    data.busType = busType.trim();
  }
  if (capacity !== undefined) {
    validateCapacity(capacity);
    data.capacity = capacity;
  }
  if (layoutId !== undefined) {
    data.layoutId = layoutId;
  }

  if (Object.keys(data).length === 0) {
    throw createError("At least one bus field must be provided.", 400);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await lockBusRow(tx, id, companyId);

      const existingBus = await tx.bus.findFirst({
        where: { id, companyId },
        select: { id: true, capacity: true, status: true },
      });

      if (!existingBus) {
        throw createError("Bus not found.", 404);
      }

      if (data.registrationNumber !== undefined) {
        const duplicate = await tx.bus.findFirst({
          where: {
            companyId,
            registrationNumber: data.registrationNumber,
            NOT: { id },
          },
          select: { id: true },
        });

        if (duplicate) {
          throw createError(
            "A bus with this registration number already exists in your company.",
            409,
          );
        }
      }

      if (layoutId !== undefined && layoutId !== null) {
        await getActiveCompanyLayout(tx, layoutId, companyId);
      }

      if (
        data.capacity !== undefined &&
        data.capacity !== existingBus.capacity
      ) {
        const activeSeatCount = await tx.seat.count({
          where: { busId: id, status: "ACTIVE" },
        });

        if (data.capacity < activeSeatCount) {
          throw createError(
            `Capacity cannot be reduced below the ${activeSeatCount} active seats configured on this bus.`,
            409,
          );
        }
      }

      const bus = await tx.bus.update({ where: { id }, data });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: "BUS_UPDATED",
          entityType: "Bus",
          entityId: bus.id,
          metadata: { changedFields: Object.keys(data) },
        },
      });

      return bus;
    });
  } catch (error) {
    rethrowIfUniqueConstraint(
      error,
      "A bus with this registration number or another unique value already exists in your company.",
    );
  }
};

export const updateBusStatus = async ({ id, companyId, actorId, status }) => {
  validateId(id, "Bus ID");
  validateCompanyId(companyId);
  validateActorId(actorId);
  validateStatus(status);

  return prisma.$transaction(async (tx) => {
    await lockBusRow(tx, id, companyId);

    const existingBus = await tx.bus.findFirst({
      where: { id, companyId },
      select: { id: true, registrationNumber: true, status: true },
    });

    if (!existingBus) {
      throw createError("Bus not found.", 404);
    }
    if (existingBus.status === status) {
      throw createError(`Bus is already ${status}.`, 409);
    }

    const bus = await tx.bus.update({ where: { id }, data: { status } });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        action: "BUS_STATUS_CHANGED",
        entityType: "Bus",
        entityId: bus.id,
        metadata: {
          previousStatus: existingBus.status,
          newStatus: status,
        },
      },
    });

    return bus;
  });
};