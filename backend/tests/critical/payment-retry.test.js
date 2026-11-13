import { describe, it, expect, beforeAll } from "vitest";
import { api, loginAsCompanyAdmin } from "../helpers/api.js";
import {
  createCustomerAndBook,
  getAvailableTrip,
  getSeedBusId,
  mockWebhook,
} from "../helpers/fixtures.js";

describe("Payment retry lifecycle", () => {
  let adminToken;
  let activeBusId;
  let routeId;

  beforeAll(async () => {
    adminToken = await loginAsCompanyAdmin();
    activeBusId = await getSeedBusId(adminToken);
    const trips = await api("/api/company/trips", { token: adminToken });
    routeId = trips.body.data.trips[0]?.route.id;
    if (!routeId) throw new Error("No existing route — create one first");
  });

  it("allows retry after a failed payment attempt", async () => {
    const tripId = await getAvailableTrip(adminToken, activeBusId, routeId, 311);
    const { bookingId, customerToken, customerPhone } = await createCustomerAndBook({
      adminToken,
      tripId,
      prefix: "retry",
    });

    const pay1 = await api(`/api/customer/bookings/${bookingId}/pay`, {
      method: "POST",
      token: customerToken,
      body: { provider: "mock", phoneNumber: customerPhone },
    });
    expect(pay1.status).toBe(201);
    expect(pay1.body.data.attemptNumber).toBe(1);
    await mockWebhook(pay1.body.data.providerReference, "FAILED", 3000);
    await new Promise((r) => setTimeout(r, 300));

    const pay2 = await api(`/api/customer/bookings/${bookingId}/pay`, {
      method: "POST",
      token: customerToken,
      body: { provider: "mock", phoneNumber: customerPhone },
    });
    expect(pay2.status).toBe(201);
    expect(pay2.body.data.attemptNumber).toBe(2);

    await mockWebhook(pay2.body.data.providerReference, "SUCCESS", 3000);
    await new Promise((r) => setTimeout(r, 500));

    const status = await api(`/api/customer/bookings/${bookingId}`, {
      token: customerToken,
    });
    expect(status.body.data.booking.status).toBe("CONFIRMED");
    expect(status.body.data.booking.payments.length).toBe(2);
  });

  it("blocks duplicate PENDING attempts", async () => {
    const tripId = await getAvailableTrip(adminToken, activeBusId, routeId, 312);
    const { bookingId, customerToken, customerPhone } = await createCustomerAndBook({
      adminToken,
      tripId,
      prefix: "dup",
    });

    const pay1 = await api(`/api/customer/bookings/${bookingId}/pay`, {
      method: "POST",
      token: customerToken,
      body: { provider: "mock", phoneNumber: customerPhone },
    });
    expect(pay1.status).toBe(201);

    const pay2 = await api(`/api/customer/bookings/${bookingId}/pay`, {
      method: "POST",
      token: customerToken,
      body: { provider: "mock", phoneNumber: customerPhone },
    });
    expect(pay2.status).toBe(409);
  });

  it("blocks new attempts after SUCCESS", async () => {
    const tripId = await getAvailableTrip(adminToken, activeBusId, routeId, 313);
    const { bookingId, customerToken, customerPhone } = await createCustomerAndBook({
      adminToken,
      tripId,
      prefix: "blocked",
    });

    const pay1 = await api(`/api/customer/bookings/${bookingId}/pay`, {
      method: "POST",
      token: customerToken,
      body: { provider: "mock", phoneNumber: customerPhone },
    });
    await mockWebhook(pay1.body.data.providerReference, "SUCCESS", 3000);
    await new Promise((r) => setTimeout(r, 500));

    const pay2 = await api(`/api/customer/bookings/${bookingId}/pay`, {
      method: "POST",
      token: customerToken,
      body: { provider: "mock", phoneNumber: customerPhone },
    });
    expect(pay2.status).toBe(409);
  });
});