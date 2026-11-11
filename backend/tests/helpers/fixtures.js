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
 * Find the next day on which the bus has NO overlapping trip.
 * Tries startDaysAhead + 0..30 days until one succeeds.
 * This makes tests idempotent across runs — no more "bus already has a trip" collisions.
 */
export const getAvailableTrip = async (adminToken, busId, routeId, startDaysAhead = 300) => {
  let lastError = null;

  for (let offset = 0; offset < 30; offset++) {
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

    // 409 = overlap, try next day
    if (res.status === 409) {
      lastError = res.body;
      continue;
    }

    // Any other error = real failure, don't retry
    throw new Error(`Trip creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  throw new Error(
    `Could not find a free day for a trip on bus ${busId} within 30 days of +${startDaysAhead}. Last error: ${JSON.stringify(lastError)}`,
  );
};

export const mockWebhook = async (providerReference, status, amount) => {
  const secret = process.env.MOCK_WEBHOOK_SECRET;
  if (!secret) throw new Error("MOCK_WEBHOOK_SECRET not set in .env");

  const res = await fetch(`${process.env.TEST_BASE_URL || "http://localhost:5000"}/api/webhooks/mock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mock-signature": secret,
    },
    body: JSON.stringify({ providerReference, status, amount }),
  });

  return { status: res.status, ok: res.ok };
};