/**
 * Test helper: HTTP client for the Itike API.
 * Requires the API to be running at BASE_URL (default: http://localhost:5000).
 *
 * Usage in tests:
 *   const { api, loginAsCompanyAdmin, loginAsCustomer, loginAsPlatformAdmin } = require("./helpers/api");
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

export const api = async (path, { method = "GET", token, body } = {}) => {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  return {
    status: res.status,
    ok: res.ok,
    body: json,
  };
};

export const login = async (phone, password) => {
  const res = await api("/api/auth/login", {
    method: "POST",
    body: { phone, password },
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${phone}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken;
};

export const registerCustomer = async ({ fullName, phone, password }) => {
  const res = await api("/api/auth/register", {
    method: "POST",
    body: { fullName, phone, password },
  });
  if (!res.ok) {
    throw new Error(`Registration failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    user: res.body.data.user,
    token: res.body.data.accessToken,
  };
};

export const loginAsCompanyAdmin = () => {
  const phone = process.env.TEST_COMPANY_ADMIN_PHONE;
  const password = process.env.TEST_COMPANY_ADMIN_PASSWORD;
  if (!phone || !password) {
    throw new Error(
      "TEST_COMPANY_ADMIN_PHONE and TEST_COMPANY_ADMIN_PASSWORD must be set in .env",
    );
  }
  return login(phone, password);
};

export const loginAsPlatformAdmin = () => {
  const phone = process.env.TEST_PLATFORM_ADMIN_PHONE;
  const password = process.env.TEST_PLATFORM_ADMIN_PASSWORD;
  if (!phone || !password) {
    throw new Error(
      "TEST_PLATFORM_ADMIN_PHONE and TEST_PLATFORM_ADMIN_PASSWORD must be set in .env",
    );
  }
  return login(phone, password);
};

export const randomPhone = (prefix = "0790") =>
  prefix + Math.floor(100000 + Math.random() * 900000).toString();

export const randomRegistrationNumber = (prefix = "TEST") =>
  prefix + "-" + Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Reset/release any pending test data on a trip, so tests can run repeatedly.
 */
export const releaseTripBookings = async (tripId, adminToken) => {
  // This uses Prisma directly — assumes tests are run in the same repo
  const prisma = (await import("../../src/config/database.js")).default;
  try {
    const bookings = await prisma.booking.findMany({
      where: { tripId, status: { in: ["HELD", "PENDING_PAYMENT"] } },
      select: { id: true },
    });
    if (bookings.length > 0) {
      const ids = bookings.map((b) => b.id);
      await prisma.$transaction(async (tx) => {
        await tx.bookingHold.updateMany({
          where: { bookingId: { in: ids }, status: "ACTIVE" },
          data: { status: "RELEASED", releasedAt: new Date() },
        });
        const seats = await tx.bookingSeat.findMany({
          where: { bookingId: { in: ids } },
          select: { tripSeatId: true },
        });
        if (seats.length > 0) {
          await tx.tripSeat.updateMany({
            where: { id: { in: seats.map((s) => s.tripSeatId) } },
            data: { status: "AVAILABLE" },
          });
        }
        await tx.booking.updateMany({
          where: { id: { in: ids } },
          data: { status: "EXPIRED" },
        });
      });
    }
  } finally {
    await prisma.$disconnect();
  }
};