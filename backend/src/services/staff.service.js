import bcrypt from "bcryptjs";
import prisma from "../config/database.js";

const SALT_ROUNDS = 12;
const STAFF_ROLE = "COMPANY_OPERATOR";

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

const publicUser = (user) => ({
  id: user.id,
  fullName: user.fullName,
  phone: user.phone,
  email: user.email,
  role: user.role,
  companyId: user.companyId,
  branchId: user.branchId ?? null,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const findStaffOrThrow = async (tx, id, companyId) => {
  const staff = await tx.user.findFirst({
    where: {
      id,
      companyId,
      role: STAFF_ROLE,
    },
  });

  if (!staff) {
    throw createError("Staff account not found.", 404);
  }

  return staff;
};

const handleUniqueConstraintError = (error) => {
  if (error?.code === "P2002") {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(", ")
      : String(error.meta?.target ?? "");
    if (target.includes("phone")) {
      throw createError("A user with this phone number already exists.", 409);
    }
    if (target.includes("email")) {
      throw createError("A user with this email already exists.", 409);
    }
    throw createError("A user with a duplicate unique value already exists.", 409);
  }
  throw error;
};

export const createStaff = async ({
  companyId,
  branchId,
  actorId,
  fullName,
  phone,
  email,
  password,
}) => {
  validateCompanyId(companyId);
  validateActorId(actorId);

  // If branchId is provided, it must belong to this company and be active
  if (branchId) {
    if (typeof branchId !== "string") {
      throw createError("Invalid branch ID.", 400);
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    return await prisma.$transaction(async (tx) => {
      if (branchId) {
        const branch = await tx.branch.findFirst({
          where: { id: branchId, companyId, isActive: true },
          select: { id: true },
        });
        if (!branch) {
          throw createError("Branch not found or inactive.", 404);
        }
      }

      const existingPhone = await tx.user.findUnique({
        where: { phone },
        select: { id: true },
      });
      if (existingPhone) {
        throw createError("A user with this phone number already exists.", 409);
      }

      if (email) {
        const existingEmail = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (existingEmail) {
          throw createError("A user with this email already exists.", 409);
        }
      }

      const staff = await tx.user.create({
        data: {
          companyId,
          branchId: branchId ?? null,
          fullName,
          phone,
          email: email ?? null,
          passwordHash,
          role: STAFF_ROLE,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: "STAFF_CREATED",
          entityType: "User",
          entityId: staff.id,
          metadata: {
            role: staff.role,
            phone: staff.phone,
            branchId: staff.branchId,
          },
        },
      });

      return publicUser(staff);
    });
  } catch (error) {
    handleUniqueConstraintError(error);
  }
};

export const listStaff = async ({
  companyId,
  branchId = null,
  page = 1,
  limit = 20,
  search,
  isActive,
}) => {
  validateCompanyId(companyId);

  if (!Number.isInteger(page) || page < 1) {
    throw createError("Page must be a positive integer.", 400);
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError("Limit must be between 1 and 100.", 400);
  }

  const where = {
    companyId,
    role: STAFF_ROLE,
  };

  if (branchId) where.branchId = branchId;

  if (typeof isActive === "boolean") {
    where.isActive = isActive;
  }

  if (search?.trim()) {
    const term = search.trim();
    where.OR = [
      { fullName: { contains: term, mode: "insensitive" } },
      { phone: { contains: term } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        role: true,
        companyId: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    staff: users,
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

export const getStaffById = async ({ id, companyId }) => {
  validateId(id, "Staff ID");
  validateCompanyId(companyId);

  const staff = await prisma.user.findFirst({
    where: {
      id,
      companyId,
      role: STAFF_ROLE,
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      role: true,
      companyId: true,
      branchId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!staff) {
    throw createError("Staff account not found.", 404);
  }

  return staff;
};

export const updateStaff = async ({
  id,
  companyId,
  actorId,
  fullName,
  phone,
  email,
}) => {
  validateId(id, "Staff ID");
  validateCompanyId(companyId);
  validateActorId(actorId);

  const data = {};

  if (fullName !== undefined) data.fullName = fullName;
  if (phone !== undefined) data.phone = phone;
  if (email !== undefined) data.email = email ?? null;

  if (Object.keys(data).length === 0) {
    throw createError("At least one staff field must be provided.", 400);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await findStaffOrThrow(tx, id, companyId);

      if (data.phone !== undefined) {
        const dup = await tx.user.findFirst({
          where: {
            phone: data.phone,
            NOT: { id },
          },
          select: { id: true },
        });
        if (dup) {
          throw createError("A user with this phone number already exists.", 409);
        }
      }

      if (data.email) {
        const dup = await tx.user.findFirst({
          where: {
            email: data.email,
            NOT: { id },
          },
          select: { id: true },
        });
        if (dup) {
          throw createError("A user with this email already exists.", 409);
        }
      }

      const staff = await tx.user.update({
        where: { id },
        data,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: "STAFF_UPDATED",
          entityType: "User",
          entityId: staff.id,
          metadata: {
            changedFields: Object.keys(data),
          },
        },
      });

      return publicUser(staff);
    });
  } catch (error) {
    handleUniqueConstraintError(error);
  }
};

export const updateStaffStatus = async ({
  id,
  companyId,
  actorId,
  isActive,
}) => {
  validateId(id, "Staff ID");
  validateCompanyId(companyId);
  validateActorId(actorId);

  if (id === actorId) {
    throw createError("You cannot change the status of your own account.", 409);
  }

  return prisma.$transaction(async (tx) => {
    const existing = await findStaffOrThrow(tx, id, companyId);

    if (existing.isActive === isActive) {
      throw createError(
        `Staff account is already ${isActive ? "active" : "inactive"}.`,
        409,
      );
    }

    const staff = await tx.user.update({
      where: { id },
      data: { isActive },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        action: "STAFF_STATUS_CHANGED",
        entityType: "User",
        entityId: staff.id,
        metadata: {
          previousStatus: existing.isActive,
          newStatus: isActive,
        },
      },
    });

    return publicUser(staff);
  });
};

export const resetStaffPassword = async ({
  id,
  companyId,
  actorId,
  password,
}) => {
  validateId(id, "Staff ID");
  validateCompanyId(companyId);
  validateActorId(actorId);

  if (id === actorId) {
    throw createError(
      "You cannot reset your own password through this endpoint.",
      409,
    );
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    await findStaffOrThrow(tx, id, companyId);

    const staff = await tx.user.update({
      where: { id },
      data: { passwordHash },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actorId,
        action: "STAFF_PASSWORD_RESET",
        entityType: "User",
        entityId: staff.id,
        metadata: {},
      },
    });

    return publicUser(staff);
  });
};