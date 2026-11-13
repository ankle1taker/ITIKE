import { describe, it, expect, beforeAll } from "vitest";
import { api, loginAsCompanyAdmin, randomPhone, registerCustomer } from "../helpers/api.js";
import { getAvailableTrip, getSeedBusId } from "../helpers/fixtures.js";

describe("Booking concurrency", () => {
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

  it("only one booking succeeds for the same seat under concurrency", async () => {
    const tripId = await getAvailableTrip(adminToken, activeBusId, routeId, 320);

    const c1 = await registerCustomer({
      fullName: "Race A",
      phone: randomPhone("0791"),
      password: "TestPass!2026",
    });
    const c2 = await registerCustomer({
      fullName: "Race B",
      phone: randomPhone("0792"),
      password: "TestPass!2026",
    });

    const seats = await api(`/api/trips/${tripId}/seats`);
    const available = seats.body.data.seats.filter((s) => s.isAvailable);
    expect(available.length).toBeGreaterThan(0);
    const targetSeatId = available[0].id;

    const [r1, r2] = await Promise.all([
      api("/api/customer/bookings", {
        method: "POST",
        token: c1.token,
        body: {
          tripId,
          seatIds: [targetSeatId],
          passengers: [{ fullName: "Race A Pax", phone: randomPhone("0793") }],
        },
      }),
      api("/api/customer/bookings", {
        method: "POST",
        token: c2.token,
        body: {
          tripId,
          seatIds: [targetSeatId],
          passengers: [{ fullName: "Race B Pax", phone: randomPhone("0794") }],
        },
      }),
    ]);

    const successes = [r1, r2].filter((r) => r.status === 201).length;
    const conflicts = [r1, r2].filter((r) => r.status === 409).length;
    expect(successes).toBe(1);
    expect(conflicts).toBe(1);
  });
});