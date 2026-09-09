import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/config/database.js";

const SALT_ROUNDS = 12;

const requiredEnvironmentVariables = [
  "PLATFORM_ADMIN_NAME",
  "PLATFORM_ADMIN_PHONE",
  "PLATFORM_ADMIN_EMAIL",
  "PLATFORM_ADMIN_PASSWORD",
];

const fail = async (message) => {
  console.error(message);
  await prisma.$disconnect();
  process.exit(1);
};

for (const variable of requiredEnvironmentVariables) {
  if (!process.env[variable]) {
    await fail(`Missing required environment variable: ${variable}`);
  }
}

const fullName = process.env.PLATFORM_ADMIN_NAME.trim();
const phone = process.env.PLATFORM_ADMIN_PHONE.trim();
const email = process.env.PLATFORM_ADMIN_EMAIL.trim().toLowerCase();
const password = process.env.PLATFORM_ADMIN_PASSWORD;

if (fullName.length < 2) {
  await fail(
    "PLATFORM_ADMIN_NAME must contain at least 2 characters.",
  );
}

if (phone.length < 7 || phone.length > 20) {
  await fail("PLATFORM_ADMIN_PHONE is invalid.");
}

if (password.length < 12) {
  await fail(
    "PLATFORM_ADMIN_PASSWORD must contain at least 12 characters.",
  );
}

try {
  const existingPlatformAdmin = await prisma.user.findFirst({
    where: {
      role: "PLATFORM_ADMIN",
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      isActive: true,
    },
  });

  if (existingPlatformAdmin) {
    console.error("A PLATFORM_ADMIN already exists.");
    console.error(
      `Existing admin: ${existingPlatformAdmin.fullName} (${existingPlatformAdmin.phone})`,
    );
    process.exitCode = 1;
  } else {
    const existingPhone = await prisma.user.findUnique({
      where: {
        phone,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (existingPhone) {
      console.error(
        `The phone number is already registered to a ${existingPhone.role} account.`,
      );
      process.exitCode = 1;
    } else {
      const existingEmail = await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (existingEmail) {
        console.error(
          `The email address is already registered to a ${existingEmail.role} account.`,
        );
        process.exitCode = 1;
      } else {
        const passwordHash = await bcrypt.hash(
          password,
          SALT_ROUNDS,
        );

        const platformAdmin = await prisma.user.create({
          data: {
            fullName,
            phone,
            email,
            passwordHash,
            role: "PLATFORM_ADMIN",
            companyId: null,
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
            createdAt: true,
          },
        });

        console.log(
          "Platform administrator created successfully.",
        );
        console.log("");
        console.log({
          id: platformAdmin.id,
          fullName: platformAdmin.fullName,
          phone: platformAdmin.phone,
          email: platformAdmin.email,
          role: platformAdmin.role,
          companyId: platformAdmin.companyId,
          isActive: platformAdmin.isActive,
          createdAt: platformAdmin.createdAt,
        });
      }
    }
  }
} catch (error) {
  console.error(
    "Failed to create platform administrator.",
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}