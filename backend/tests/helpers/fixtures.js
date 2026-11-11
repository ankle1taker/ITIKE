/**
 * Test fixtures: create test data (trips, customers) via the API.
 */

import { api, randomPhone, randomRegistrationNumber, registerCustomer } from "./api.js";

export const createCustomerAndBook = async ({
  adminToken,
  tripId,
  prefix = "test",
}) => {
  // Register customer
  const phone = randomPhone();
  const password = "TestPass!2026";
  const { user, token } = await registerCustomer({
    fullName: `${prefix} Customer`,
    phone,
    password,
  });

  // Find a seat on the trip
  const seats = await api(`/api/trips/${tripId}/seats`);
  if (!seats.ok) throw new Error(`Failed to get trip seats: ${seats.status}`);
  const available = seats.body.data.seats.filter((s) => s.isAvailable);
  if (available.length === 0) throw new Error(`No available seats on trip ${tripId}`);

  // Create booking
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

export const getAvailableTrip = async (adminToken, busId, routeId, daysAhead = 300) => {
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

  if (!res.ok) {
    throw new Error(`Trip creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body.data.trip.id;
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