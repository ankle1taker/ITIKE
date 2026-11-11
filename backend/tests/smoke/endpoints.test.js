import { describe, it, expect } from "vitest";
import { api } from "../helpers/api.js";

describe("Smoke tests — endpoints respond", () => {
  it("health check", async () => {
    const res = await api("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });

  it("public trip search returns 200", async () => {
    const res = await api(
      "/api/trips/search?origin=Kigali&destination=Musanze-155433&date=2027-12-01",
    );
    expect(res.status).toBe(200);
    expect(res.body.data.trips).toBeDefined();
  });

  it("unauthenticated /api/customer/bookings returns 401", async () => {
    const res = await api("/api/customer/bookings");
    expect(res.status).toBe(401);
  });

  it("unauthenticated /api/company/buses returns 401", async () => {
    const res = await api("/api/company/buses");
    expect(res.status).toBe(401);
  });

  it("unauthenticated /api/platform/companies returns 401", async () => {
    const res = await api("/api/platform/companies");
    expect(res.status).toBe(401);
  });

  it("public company registration accepts new company", async () => {
    const res = await api("/api/companies/register", {
      method: "POST",
      body: {
        name: "Smoke Test Company",
        registrationNumber: "SMOKE-" + Math.floor(100000 + Math.random() * 900000),
        phone: "0788111111",
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.company.status).toBe("INACTIVE");
  });
});