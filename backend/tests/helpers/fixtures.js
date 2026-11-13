import { api, registerCustomer } from "./api.js";

export const createCustomerAndBook = async ({
  adminToken,
  tripId,
  prefix = "test",
}) => {
  const phone = "0790" + Math.floor(100000 + Math.random() * 900000).toString();
  const password = "TestPass!2026";
  const { user, token } = await registerCustomer({
    fullName: `${prefix} Customer`,
    phone,
    password,
  });

  const seats = await api(`/api/trips/${tripId}/seats`);
  if (!seats.ok) throw new Error(`Failed to get trip seats: ${seats.status}`);
  const available = seats.body.data.seats.filter((s) => s.isAvailable);
  if (available.length === 0) throw new Error(`No available seats on trip ${tripId}`);

  const bookRes = await api("/api/customer/bookings", {
    method: "POST",
    token,
    body: {
      tripId,
      seatIds: [available[0].id],
      passengers: [{ fullName: `${prefix} Pax`, phone }],
    },
  });
  if (!bookRes.ok) {
    throw new Error(`Booking failed: ${bookRes.status} ${JSON.stringify(bookRes.body)}`);
  }

  return {
    customerPhone: phone,
    customerPassword: password,
    customerToken: token,
    customerId: user.id,
    bookingId: bookRes.body.data.booking.id,
    seatId: available[0].id,
  };
};

/**
 * Returns the ID of the seeded test bus (registrationNumber "RAB 001 B").
 * This bus is created once by scripts/seed-test-data.mjs with 8 active seats.
 * All trip-creating tests use this bus so they never pick up buses created
 * ad-hoc by other tests (which have no seats).
 */
export const getSeedBusId = async (adminToken) => {
  const res = await api(
    "/api/company/buses?search=RAB%20001%20B&limit=10",
    { token: adminToken },
  );
  if (!res.ok) {
    throw new Error(`Failed to list buses: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const bus = res.body.data.buses.find(
    (b) => b.registrationNumber === "RAB 001 B" && b.status === "ACTIVE",
  );
  if (!bus) {
    throw new Error(
      "Seed bus RAB 001 B not found or inactive. Run: node scripts/seed-test-data.mjs",
    );
  }
  return bus.id;
};

/**
 * Find the next day on which the bus has NO overlapping trip.
 * Tries startDaysAhead + 0..365 days until one succeeds.
 */
export const getAvailableTrip = async (adminToken, busId, routeId, startDaysAhead = 300) => {
  let lastError = null;
  for (let offset = 0; offset < 365; offset++) {
    const daysAhead = startDaysAhead + offset;
    const day = new Date();
    day.setDate(day.getDate() + daysAhead);
    const dayStr = day.toISOString().slice(0, 10);
    const res = await api("/api/company/trips", {
      method: "POST",
      token: adminToken,
      body: {
        routeId,
        busId,
        departureTime: `${dayStr}T10:00:00Z`,
        arrivalTime: `${dayStr}T13:00:00Z`,
        basePrice: 3000,
      },
    });
    if (res.ok) {
      return res.body.data.trip.id;
    }
    if (res.status === 409) {
      lastError = res.body;
      continue;
    }
    throw new Error(`Trip creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  throw new Error(
    `Could not find a free day for a trip on bus ${busId} within 365 days of +${startDaysAhead}. Last error: ${JSON.stringify(lastError)}`,
  );
};

export const mockWebhook = async (providerReference, status, amount) => {
  const secret = process.env.MOCK_WEBHOOK_SECRET;
  if (!secret) throw new Error("MOCK_WEBHOOK_SECRET not set in .env");
  const res = await fetch(
    `${process.env.TEST_BASE_URL || "http://localhost:5000"}/api/webhooks/mock`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mock-signature": secret,
      },
      body: JSON.stringify({ providerReference, status, amount }),
    },
  );
  return { status: res.status, ok: res.ok };
};