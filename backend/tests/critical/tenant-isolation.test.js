import { describe, it, expect } from "vitest";
import { api, loginAsCompanyAdmin, loginAsPlatformAdmin, randomPhone } from "../helpers/api.js";
import { registerCustomer } from "../helpers/api.js";

describe("Tenant isolation", () => {
  it("company admin cannot access another company's bus (404)", async () => {
    const token = await loginAsCompanyAdmin();
    const fakeBusId = "00000000-0000-0000-0000-000000000000";
    const res = await api(`/api/company/buses/${fakeBusId}`, { token });
    expect(res.status).toBe(404);
  });

  it("customer cannot access company admin endpoints (403)", async () => {
    const c = await registerCustomer({
      fullName: "Isolation Test",
      phone: randomPhone("0795"),
      password: "TestPass!2026",
    });
    const res = await api("/api/company/buses", { token: c.token });
    expect(res.status).toBe(403);
  });

  it("company admin cannot access platform admin endpoints (403)", async () => {
    const token = await loginAsCompanyAdmin();
    const res = await api("/api/platform/companies", { token });
    expect(res.status).toBe(403);
  });

  it("platform admin cannot access company-only bus endpoints (403)", async () => {
    const token = await loginAsPlatformAdmin();
    const res = await api("/api/company/buses", { token });
    expect(res.status).toBe(403);
  });
});