import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/config/database.js";

const SALT_ROUNDS = 12;

const companyId = process.env.COMPANY_ADMIN_COMPANY_ID;
const fullName = process.env.COMPANY_ADMIN_FULL_NAME;
const phone = process.env.COMPANY_ADMIN_PHONE;
const email = process.env.COMPANY_ADMIN_EMAIL || null;
const password = process.env.COMPANY_ADMIN_PASSWORD;

const fail = (message) => {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
};

const main = async () => {
  if (!companyId) {
    fail("COMPANY_ADMIN_COMPANY_ID is required.");
    return;
  }

  if (!fullName) {
    fail("COMPANY_ADMIN_FULL_NAME is required.");
    return;
  }

  if (!phone) {
    fail("COMPANY_ADMIN_PHONE is required.");
    return;
  }

  if (!password) {
    fail("COMPANY_ADMIN_PASSWORD is required.");
    return;
  }

  if (password.length < 8) {
    fail("COMPANY_ADMIN_PASSWORD must be at least 8 characters.");
    return;
  }

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!company) {
    fail("Company not found.");
    return;
  }

  const existingPhone = await prisma.user.findUnique({
    where: {
      phone,
    },
    select: {
      id: true,
    },
  });

  if (existingPhone) {
    fail("A user with this phone number already exists.");
    return;
  }

  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingEmail) {
      fail("A user with this email already exists.");
      return;
    }
  }

  const passwordHash = await bcrypt.hash(
    password,
    SALT_ROUNDS,
  );

  const user = await prisma.user.create({
    data: {
      fullName,
      phone,
      email,
      passwordHash,
      role: "COMPANY_ADMIN",
      companyId: company.id,
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      role: true,
      companyId: true,
      isActive: true,
    },
  });

  console.log("Company Admin created successfully.");
  console.log({
    user,
    company: {
      id: company.id,
      name: company.name,
      status: company.status,
    },
  });
};

try {
  await main();
} catch (error) {
  console.error("Failed to create Company Admin:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}