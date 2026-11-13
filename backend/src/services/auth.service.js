import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { generateAccessToken } from "../utils/jwt.js";

const SALT_ROUNDS = 12;

export const registerCustomer = async ({
  fullName,
  phone,
  email,
  password,
}) => {
  const existingPhone = await prisma.user.findUnique({
    where: {
      phone,
    },
  });

  if (existingPhone) {
    const error = new Error("A user with this phone number already exists.");
    error.statusCode = 409;
    throw error;
  }

  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingEmail) {
      const error = new Error("A user with this email already exists.");
      error.statusCode = 409;
      throw error;
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      fullName,
      phone,
      email: email || null,
      passwordHash,
      role: "CUSTOMER",
    },
  });

  const accessToken = generateAccessToken(user);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      companyId: user.companyId ?? null,
      branchId: user.branchId ?? null,
    },
    accessToken,
  };
};

export const loginUser = async ({ phone, password }) => {
  const user = await prisma.user.findUnique({
    where: {
      phone,
    },
  });

  if (!user || !user.isActive) {
    const error = new Error("Invalid phone number or password.");
    error.statusCode = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordMatches) {
    const error = new Error("Invalid phone number or password.");
    error.statusCode = 401;
    throw error;
  }

  const accessToken = generateAccessToken(user);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      branchId: user.branchId ?? null,
    },
    accessToken,
  };
};

export const getAuthenticatedUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
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

  if (!user || !user.isActive) {
    const error = new Error("User account not found or inactive.");
    error.statusCode = 401;
    throw error;
  }

  return user;
};