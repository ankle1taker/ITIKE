import prisma from "../config/database.js";

const DEFAULT_CANCELLATION_POLICY = {
  moreThan24HoursPct: 90,
  twelveTo24HoursPct: 50,
  lessThan12HoursPct: 0,
  afterDeparturePct: 0,
};
export const updateCompanyStatus = async (
  id,
  status,
  actorId,
) => {
  if (!id) {
    const error = new Error(
      "Company ID is required.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!actorId) {
    const error = new Error(
      "Authenticated actor is required.",
    );
    error.statusCode = 401;
    throw error;
  }

  const allowedStatuses = [
    "ACTIVE",
    "SUSPENDED",
    "INACTIVE",
  ];

  if (!allowedStatuses.includes(status)) {
    const error = new Error(
      "Invalid company status.",
    );
    error.statusCode = 400;
    throw error;
  }

  const existingCompany =
    await prisma.company.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

  if (!existingCompany) {
    const error = new Error(
      "Company not found.",
    );
    error.statusCode = 404;
    throw error;
  }

  if (existingCompany.status === status) {
    const error = new Error(
      `Company is already ${status}.`,
    );
    error.statusCode = 409;
    throw error;
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const company =
        await tx.company.update({
          where: {
            id,
          },
          data: {
            status,
          },
        });

      await tx.auditLog.create({
        data: {
          companyId: company.id,
          actorId,
          action: "COMPANY_STATUS_CHANGED",
          entityType: "Company",
          entityId: company.id,
          metadata: {
            previousStatus:
              existingCompany.status,
            newStatus: status,
          },
        },
      });

      return company;
    },
  );

  return result;
};
export const createCompany = async ({
  name,
  registrationNumber,
  phone,
  email,
  address,
  actorId,
}) => {
  if (!name || !registrationNumber || !phone || !actorId) {
    const error = new Error(
      "Missing required fields: name, registrationNumber, phone, and actorId are required.",
    );
    error.statusCode = 400;
    throw error;
  }

  const existingCompany = await prisma.company.findFirst({
    where: {
      OR: [
        {
          registrationNumber,
        },
        ...(email ? [{ email }] : []),
      ],
    },
    select: {
      id: true,
      registrationNumber: true,
      email: true,
    },
  });

  if (existingCompany) {
    const field =
      existingCompany.registrationNumber === registrationNumber
        ? "registration number"
        : "email address";

    const error = new Error(
      `A company with this ${field} already exists.`,
    );
    error.statusCode = 409;
    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name,
        registrationNumber,
        phone,
        email: email || null,
        address: address || null,
        status: "ACTIVE",
      },
    });

    await tx.cancellationPolicy.create({
      data: {
        companyId: company.id,
        ...DEFAULT_CANCELLATION_POLICY,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        actorId,
        action: "COMPANY_CREATED",
        entityType: "Company",
        entityId: company.id,
        metadata: {
          registrationNumber: company.registrationNumber,
          name: company.name,
        },
      },
    });

    return company;
  });

  return result;
};

export const listCompanies = async ({
  page = 1,
  limit = 20,
  search,
  status,
}) => {
  if (!Number.isInteger(page) || page < 1) {
    const error = new Error(
      "Page must be a positive integer.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    const error = new Error(
      "Limit must be a positive integer.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (limit > 100) {
    const error = new Error(
      "Limit cannot exceed 100.",
    );
    error.statusCode = 400;
    throw error;
  }

  const skip = (page - 1) * limit;

  const where = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    const searchTerm = search.trim();

    if (searchTerm) {
      where.OR = [
        {
          name: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          registrationNumber: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          address: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
      ];
    }
  }

  const [companies, total] = await prisma.$transaction([
    prisma.company.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: {
        id: true,
        name: true,
        registrationNumber: true,
        phone: true,
        email: true,
        address: true,
        logoUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            buses: true,
            trips: true,
          },
        },
      },
    }),

    prisma.company.count({
      where,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    companies,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

export const getCompanyById = async (id) => {
  if (!id) {
    const error = new Error(
      "Company ID is required.",
    );
    error.statusCode = 400;
    throw error;
  }

  const company = await prisma.company.findUnique({
    where: {
      id,
    },
    include: {
      cancellationPolicy: true,
      _count: {
        select: {
          users: true,
          buses: true,
          trips: true,
        },
      },
    },
  });

  if (!company) {
    const error = new Error("Company not found.");
    error.statusCode = 404;
    throw error;
  }

  return company;
};

export const updateCompany = async (
  id,
  data,
  actorId,
) => {
  if (!id) {
    const error = new Error(
      "Company ID is required.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!actorId) {
    const error = new Error(
      "Authenticated actor is required.",
    );
    error.statusCode = 401;
    throw error;
  }

  const existingCompany = await prisma.company.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      registrationNumber: true,
      phone: true,
      email: true,
      address: true,
      status: true,
    },
  });

  if (!existingCompany) {
    const error = new Error("Company not found.");
    error.statusCode = 404;
    throw error;
  }

  if (data.registrationNumber || data.email) {
    const duplicateConditions = [];

    if (data.registrationNumber) {
      duplicateConditions.push({
        registrationNumber: data.registrationNumber,
      });
    }

    if (data.email) {
      duplicateConditions.push({
        email: data.email,
      });
    }

    const duplicate = await prisma.company.findFirst({
      where: {
        AND: [
          {
            id: {
              not: id,
            },
          },
          {
            OR: duplicateConditions,
          },
        ],
      },
      select: {
        id: true,
        registrationNumber: true,
        email: true,
      },
    });

    if (duplicate) {
      const field =
        duplicate.registrationNumber ===
        data.registrationNumber
          ? "registration number"
          : "email address";

      const error = new Error(
        `A company with this ${field} already exists.`,
      );
      error.statusCode = 409;
      throw error;
    }
  }

  const updateData = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }

  if (data.registrationNumber !== undefined) {
    updateData.registrationNumber =
      data.registrationNumber;
  }

  if (data.phone !== undefined) {
    updateData.phone = data.phone;
  }

  if (data.email !== undefined) {
    updateData.email = data.email || null;
  }

  if (data.address !== undefined) {
    updateData.address = data.address || null;
  }

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.update({
      where: {
        id,
      },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        actorId,
        action: "COMPANY_UPDATED",
        entityType: "Company",
        entityId: company.id,
        metadata: {
          changes: data,
        },
      },
    });

    return company;
  });

  return result;
};