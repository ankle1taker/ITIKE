import { describe, it, expect, beforeAll } from "vitest";
import { api, loginAsCompanyAdmin } from "../helpers/api.js";
import { createCustomerAndBook, getAvailableTrip, mockWebhook } from "../helpers/fixtures.js";

describe("Refund state machine", () => {
  let adminToken;
  let activeBusId;
  let routeId;

  beforeAll(async () => {
    adminToken = await loginAsCompanyAdmin();
    const buses = await api("/api/company/buses", { token: adminToken });
    const activeBus = buses.body.data.buses.find((b) => b.status === "ACTIVE");
    activeBusId = activeBus.id;
    const trips = await api("/api/company/trips", { token: adminToken });
    routeId = trips.body.data.trips[0]?.route.id;
  });

  it("cancellation transitions booking, cancellation, payment correctly", async () => {
    // Fresh trip per test — no cascade
    const tripId = await getAvailableTrip(adminToken, activeBusId, routeId, 331);

    const { bookingId, customerToken, customerPhone } = await createCustomerAndBook({
      adminToken,
      tripId,
      prefix: "refund",
    });

    const pay = await api(`/api/customer/bookings/${bookingId}/pay`, {
      method: "POST",
      token: customerToken,
      body: { provider: "mock", phoneNumber: customerPhone },
    });
    expect(pay.status).toBe(201);

    await mockWebhook(pay.body.data.providerReference, "SUCCESS", 3000);
    await new Promise((r) => setTimeout(r, 500));

    const cancel = await api(`/api/customer/bookings/${bookingId}/cancel`, {
      method: "POST",
      token: customerToken,
      body: { reason: "test cancel" },
    });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.bookingStatus).toBe("CANCELLED");

    const status = await api(`/api/customer/bookings/${bookingId}`, {
      token: customerToken,
    });
    expect(status.body.data.booking.status).toBe("CANCELLED");
    expect(status.body.data.booking.payments[0].status).toBe("REFUNDED");
  });

  it("blocks double cancellation", async () => {
    // Fresh trip per test
    const tripId = await getAvailableTrip(adminToken, activeBusId, routeId, 332);

    const { bookingId, customerToken, customerPhone } = await createCustomerAndBook({
      adminToken,
      tripId,
      prefix: "double-cancel",
    });

    const pay = await api(`/api/customer/bookings/${bookingId}/pay`, {
      method: "POST",
      token: customerToken,
      body: { provider: "mock", phoneNumber: customerPhone },
    });
    await mockWebhook(pay.body.data.providerReference, "SUCCESS", 3000);
    await new Promise((r) => setTimeout(r, 500));

    const c1 = await api(`/api/customer/bookings/${bookingId}/cancel`, {
      method: "POST",
      token: customerToken,
      body: { reason: "first" },
    });
    expect(c1.status).toBe(200);

    const c2 = await api(`/api/customer/bookings/${bookingId}/cancel`, {
      method: "POST",
      token: customerToken,
      body: { reason: "second" },
    });
    expect(c2.status).toBe(409);
  });
});