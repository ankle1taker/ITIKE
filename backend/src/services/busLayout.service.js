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

const handleUniqueConstraintError = (error, message) => {
  if (error?.code === "P2002") {
    throw createError(message, 409);
  }
  throw error;
};

const getLayoutOrThrow = async (tx, id, companyId, select) => {
  const layout = await tx.busLayout.findFirst({
    where: { id, companyId },
    ...(select ? { select } : {}),
  });

  if (!layout) {
    throw createError("Bus layout not found.", 404);
  }

  return layout;
};

export const createBusLayout = async ({
  companyId,
  actorId,
  name,
  code,
  layoutType,
  rowCount,
  columnCount,
  configuration,
}) => {
  validateCompanyId(companyId);
  validateActorId(actorId);

  try {
    return await prisma.$transaction(async (tx) => {
      const layout = await tx.busLayout.create({
        data: {
          companyId,
          name: name.trim(),
          code: code?.trim() || null,
          layoutType,
          rowCount,
          columnCount,
          configuration: configuration ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: "BUS_LAYOUT_CREATED",
          entityType: "BusLayout",
          entityId: layout.id,
          metadata: {
            name: layout.name,
            code: layout.code,
            layoutType: layout.layoutType,
            rowCount: layout.rowCount,
            columnCount: layout.columnCount,
          },
        },
      });

      return layout;
    });
  } catch (error) {
    handleUniqueConstraintError(
      error,
      "A bus layout with this code already exists in your company.",
    );
  }
};

export const listBusLayouts = async ({
  companyId,
  page = 1,
  limit = 20,
  search,
  isActive,
}) => {
  validateCompanyId(companyId);

  const skip = (page - 1) * limit;
  const where = { companyId };

  if (typeof isActive === "boolean") {
    where.isActive = isActive;
  }

  if (search?.trim()) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { code: { contains: term, mode: "insensitive" } },
    ];
  }

  const [layouts, total] = await prisma.$transaction([
    prisma.busLayout.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      include: {
        _count: { select: { buses: true } },
      },
    }),
    prisma.busLayout.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    layouts,
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

export const getBusLayoutById = async ({ id, companyId }) => {
  validateId(id, "Bus layout ID");
  validateCompanyId(companyId);

  const layout = await prisma.busLayout.findFirst({
    where: { id, companyId },
    include: {
      _count: { select: { buses: true } },
    },
  });

  if (!layout) {
    throw createError("Bus layout not found.", 404);
  }

  return layout;
};

export const updateBusLayout = async ({
  id,
  companyId,
  actorId,
  name,
  code,
  layoutType,
  rowCount,
  columnCount,
  configuration,
}) => {
  validateId(id, "Bus layout ID");
  validateCompanyId(companyId);
  validateActorId(actorId);

  const data = {};

  if (name !== undefined) data.name = name.trim();
  if (code !== undefined) data.code = code?.trim() || null;
  if (layoutType !== undefined) data.layoutType = layoutType;
  if (configuration !== undefined) data.configuration = configuration ?? null;

  const changesGrid =
    rowCount !== undefined || columnCount !== undefined;

  if (rowCount !== undefined) data.rowCount = rowCount;
  if (columnCount !== undefined) data.columnCount = columnCount;

  if (Object.keys(data).length === 0) {
    throw createError(
      "At least one layout field must be provided.",
      400,
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await getLayoutOrThrow(tx, id, companyId);

      if (changesGrid) {
        const nextRowCount =
          data.rowCount !== undefined ? data.rowCount : existing.rowCount;
        const nextColumnCount =
          data.columnCount !== undefined
            ? data.columnCount
            : existing.columnCount;

        if (
          nextRowCount < existing.rowCount ||
          nextColumnCount < existing.columnCount
        ) {
          const offendingSeat = await tx.seat.findFirst({
            where: {
              bus: { layoutId: id, companyId },
              status: "ACTIVE",
              OR: [
                { rowNumber: { gt: nextRowCount } },
                { columnNumber: { gt: nextColumnCount } },
              ],
            },
            select: { seatNumber: true },
          });

          if (offendingSeat) {
            throw createError(
              `Cannot shrink layout: seat ${offendingSeat.seatNumber} lies outside the new grid.`,
              409,
            );
          }
        }
      }

      const layout = await tx.busLayout.update({
        where: { id },
        data,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: "BUS_LAYOUT_UPDATED",
          entityType: "BusLayout",
          entityId: layout.id,
          metadata: { changedFields: Object.keys(data) },
        },
      });

      return layout;
    });
  } catch (error) {
    handleUniqueConstraintError(
      error,
      "A bus layout with this code already exists in your company.",
    );
  }
};

export const updateBusLayoutStatus = async ({
  id,
  companyId,
  actorId,
  isActive,
}) => {
  validateId(id, "Bus layout ID");
  validateCompanyId(companyId);
  validateActorId(actorId);

  return prisma.$transaction(async (tx) => {
    const existing = await getLayoutOrThrow(tx, id, companyId, {
      id: true,
      isActive: true,
    });

    if (existing.isActive === isActive) {
      throw createError(
        `Bus layout is already ${isActive ? "active" : "inactive"}.`,
        409,
      );
    }

    if (isActive === false) {
      const assignedBuses = await tx.bus.count({
        where: { layoutId: id, companyId },
      });

      if (assignedBuses > 0) {
        throw createError(
          `Cannot deactivate layout: it is assigned to ${assignedBuses} bus(es).`,
          409,
        );
      }
    }

    const layout = await tx.busLayout.update({
      where: { id },
      data: { isActive },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        action: "BUS_LAYOUT_STATUS_CHANGED",
        entityType: "BusLayout",
        entityId: layout.id,
        metadata: {
          previousStatus: existing.isActive,
          newStatus: isActive,
        },
      },
    });

    return layout;
  });
};