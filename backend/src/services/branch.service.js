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

export const createBranch = async ({
  companyId,
  actorId,
  name,
  code,
  phone,
  address,
}) => {
  validateCompanyId(companyId);

  if (!name || typeof name !== "string" || !name.trim()) {
    throw createError("Branch name is required.", 400);
  }
  if (name.trim().length > 100) {
    throw createError("Branch name must not exceed 100 characters.", 400);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          companyId,
          name: name.trim(),
          code: code?.trim().toUpperCase() || null,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId: actorId || null,
          action: "BRANCH_CREATED",
          entityType: "Branch",
          entityId: branch.id,
          metadata: {
            name: branch.name,
            code: branch.code,
          },
        },
      });

      return branch;
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw createError(
        "A branch with this name or code already exists in your company.",
        409,
      );
    }
    throw error;
  }
};

export const listBranches = async ({ companyId, includeInactive = false }) => {
  validateCompanyId(companyId);

  const where = { companyId };
  if (!includeInactive) where.isActive = true;

  return prisma.branch.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: { buses: true, users: true, trips: true },
      },
    },
  });
};

export const getBranchById = async ({ id, companyId }) => {
  validateCompanyId(companyId);

  const branch = await prisma.branch.findFirst({
    where: { id, companyId },
    include: {
      _count: {
        select: { buses: true, users: true, trips: true },
      },
    },
  });

  if (!branch) {
    throw createError("Branch not found.", 404);
  }
  return branch;
};

export const updateBranch = async ({
  id,
  companyId,
  actorId,
  name,
  code,
  phone,
  address,
}) => {
  validateCompanyId(companyId);

  const data = {};
  if (name !== undefined) {
    if (!name.trim()) throw createError("Branch name cannot be empty.", 400);
    data.name = name.trim();
  }
  if (code !== undefined) data.code = code?.trim().toUpperCase() || null;
  if (phone !== undefined) data.phone = phone?.trim() || null;
  if (address !== undefined) data.address = address?.trim() || null;

  if (Object.keys(data).length === 0) {
    throw createError("At least one branch field must be provided.", 400);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.branch.findFirst({
        where: { id, companyId },
        select: { id: true },
      });
      if (!existing) {
        throw createError("Branch not found.", 404);
      }

      const branch = await tx.branch.update({
        where: { id },
        data,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId: actorId || null,
          action: "BRANCH_UPDATED",
          entityType: "Branch",
          entityId: branch.id,
          metadata: { changedFields: Object.keys(data) },
        },
      });

      return branch;
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw createError(
        "A branch with this name or code already exists in your company.",
        409,
      );
    }
    throw error;
  }
};

export const updateBranchStatus = async ({
  id,
  companyId,
  actorId,
  isActive,
}) => {
  validateCompanyId(companyId);

  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({
      where: { id, companyId },
      include: {
        _count: { select: { buses: true, users: true, trips: true } },
      },
    });
    if (!branch) {
      throw createError("Branch not found.", 404);
    }

    if (branch.isDefault && !isActive) {
      throw createError(
        "The default branch cannot be deactivated. Assign another default first.",
        409,
      );
    }

    if (branch.isActive === isActive) {
      throw createError(
        `Branch is already ${isActive ? "active" : "inactive"}.`,
        409,
      );
    }

    if (!isActive) {
      if (branch._count.buses > 0) {
        throw createError(
          `Cannot deactivate: branch has ${branch._count.buses} bus(es). Transfer them first.`,
          409,
        );
      }
      if (branch._count.users > 0) {
        throw createError(
          `Cannot deactivate: branch has ${branch._count.users} staff member(s). Reassign them first.`,
          409,
        );
      }
      if (branch._count.trips > 0) {
        throw createError(
          `Cannot deactivate: branch has ${branch._count.trips} trip(s). Archive them first.`,
          409,
        );
      }
    }

    const updated = await tx.branch.update({
      where: { id },
      data: { isActive },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId: actorId || null,
        action: "BRANCH_STATUS_CHANGED",
        entityType: "Branch",
        entityId: id,
        metadata: {
          previousStatus: branch.isActive,
          newStatus: isActive,
        },
      },
    });

    return updated;
  });
};

/**
 * Transfer a bus from one branch to another.
 * Blocked if the bus has active trips (SCHEDULED, BOARDING, DEPARTED, DELAYED).
 * Historical trips move to the target branch so reports stay consistent.
 */
export const transferBus = async ({
  busId,
  companyId,
  actorId,
  targetBranchId,
}) => {
  validateCompanyId(companyId);

  return prisma.$transaction(async (tx) => {
    const bus = await tx.bus.findFirst({
      where: { id: busId, companyId },
      select: {
        id: true,
        branchId: true,
        registrationNumber: true,
      },
    });
    if (!bus) {
      throw createError("Bus not found.", 404);
    }

    if (bus.branchId === targetBranchId) {
      throw createError("Bus is already assigned to that branch.", 409);
    }

    const targetBranch = await tx.branch.findFirst({
      where: { id: targetBranchId, companyId, isActive: true },
      select: { id: true, name: true },
    });
    if (!targetBranch) {
      throw createError("Target branch not found or inactive.", 404);
    }

    const activeTrips = await tx.trip.count({
      where: {
        busId,
        status: { in: ["SCHEDULED", "BOARDING", "DEPARTED", "DELAYED"] },
      },
    });
    if (activeTrips > 0) {
      throw createError(
        `Cannot transfer: bus has ${activeTrips} active trip(s). Cancel or complete them first.`,
        409,
      );
    }

    const updated = await tx.bus.update({
      where: { id: busId },
      data: { branchId: targetBranchId },
    });

    await tx.trip.updateMany({
      where: { busId },
      data: { branchId: targetBranchId },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId: actorId || null,
        action: "BUS_TRANSFERRED_BETWEEN_BRANCHES",
        entityType: "Bus",
        entityId: busId,
        metadata: {
          registrationNumber: bus.registrationNumber,
          fromBranchId: bus.branchId,
          toBranchId: targetBranchId,
          toBranchName: targetBranch.name,
        },
      },
    });

    return updated;
  });
};

/**
 * Get the default branch for a company.
 * Used for fallback scenarios (e.g., migrating existing data).
 */
export const getDefaultBranch = async ({ companyId }) => {
  validateCompanyId(companyId);

  const branch = await prisma.branch.findFirst({
    where: { companyId, isDefault: true },
  });

  if (!branch) {
    throw createError("Company has no default branch.", 404);
  }
  return branch;
};