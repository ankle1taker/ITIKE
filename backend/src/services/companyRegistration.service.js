import prisma from "../config/database.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeRegNumber = (value) => {
  if (typeof value !== "string") return value;
  return value.trim().toUpperCase();
};

export const registerCompanyApplication = async ({
  name,
  registrationNumber,
  phone,
  email,
  address,
}) => {
  if (!name || typeof name !== "string" || !name.trim()) {
    throw createError("Company name is required.", 400);
  }
  if (!registrationNumber || typeof registrationNumber !== "string" || !registrationNumber.trim()) {
    throw createError("Registration number is required.", 400);
  }
  if (!phone || typeof phone !== "string" || !phone.trim()) {
    throw createError("Phone is required.", 400);
  }

  const normalizedReg = normalizeRegNumber(registrationNumber);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.company.findUnique({
      where: { registrationNumber: normalizedReg },
    });

    if (existing) {
      throw createError(
        "A company with this registration number has already applied.",
        409,
      );
    }

    if (email) {
      const existingEmail = await tx.company.findUnique({ where: { email } });
      if (existingEmail) {
        throw createError("A company with this email already exists.", 409);
      }
    }

    const company = await tx.company.create({
      data: {
        name: name.trim(),
        registrationNumber: normalizedReg,
        phone: phone.trim(),
        email: email?.trim() || null,
        address: address?.trim() || null,
        status: "INACTIVE",
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        actorId: null,
        action: "COMPANY_REGISTRATION_REQUESTED",
        entityType: "Company",
        entityId: company.id,
        metadata: {
          name: company.name,
          registrationNumber: company.registrationNumber,
          phone: company.phone,
        },
      },
    });

    return {
      id: company.id,
      name: company.name,
      status: company.status,
    };
  });
};