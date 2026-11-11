import { describe, it, expect, beforeAll } from "vitest";
import { api, loginAsCompanyAdmin, randomPhone, registerCustomer } from "../helpers/api.js";
import { getAvailableTrip } from "../helpers/fixtures.js";

describe("Booking concurrency", () => {
  let adminToken;
  let tripId;

  beforeAll(async () => {
    adminToken = await loginAsCompanyAdmin();
    const buses = await api("/api/company/buses", { token: adminToken });
    const activeBus = buses.body.data.buses.find((b) => b.status === "ACTIVE");
    const trips = await api("/api/company/trips", { token: adminToken });
    const routeId = trips.body.data.trips[0]?.route.id;
    tripId = await getAvailableTrip(adminToken, activeBus.id, routeId, 320);
  });

  it("only one booking succeeds for the same seat under concurrency", async () => {
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