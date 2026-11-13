import { describe, it, expect, beforeAll } from "vitest";
import { api, loginAsCompanyAdmin, randomPhone } from "../helpers/api.js";

describe("Branch isolation", () => {
  let adminToken;
  let branchA;
  let branchB;
  let operatorToken;
  let operatorId;
  let busA;
  let busB;

  beforeAll(async () => {
    adminToken = await loginAsCompanyAdmin();

    const suffix = Date.now();

    // Create two branches
    const branchARes = await api("/api/company/branches", {
      method: "POST",
      token: adminToken,
      body: {
        name: `Branch A ${suffix}`,
        code: `A${suffix}`,
        phone: "0788111111",
      },
    });
    expect(branchARes.status).toBe(201);
    branchA = branchARes.body.data.branch.id;

    const branchBRes = await api("/api/company/branches", {
      method: "POST",
      token: adminToken,
      body: {
        name: `Branch B ${suffix}`,
        code: `B${suffix}`,
        phone: "0788222222",
      },
    });
    expect(branchBRes.status).toBe(201);
    branchB = branchBRes.body.data.branch.id;

    // Create a bus in branch A with 8 seats
    const busARes = await api("/api/company/buses", {
      method: "POST",
      token: adminToken,
      body: {
        branchId: branchA,
        registrationNumber: `RAA-${suffix}`,
        busType: "Coach",
        capacity: 30,
      },
    });
    expect(busARes.status).toBe(201);
    busA = busARes.body.data.bus.id;

    for (let i = 1; i <= 8; i++) {
      await api(`/api/company/buses/${busA}/seats`, {
        method: "POST",
        token: adminToken,
        body: { seatNumber: `A${i}` },
      });
    }

    // Create a bus in branch B with 8 seats
    const busBRes = await api("/api/company/buses", {
      method: "POST",
      token: adminToken,
      body: {
        branchId: branchB,
        registrationNumber: `RAB-${suffix}`,
        busType: "Coach",
        capacity: 30,
      },
    });
    expect(busBRes.status).toBe(201);
    busB = busBRes.body.data.bus.id;

    for (let i = 1; i <= 8; i++) {
      await api(`/api/company/buses/${busB}/seats`, {
        method: "POST",
        token: adminToken,
        body: { seatNumber: `B${i}` },
      });
    }

    // Create an operator assigned to branch A
    const opPhone = randomPhone("0797");
    const opRes = await api("/api/company/staff", {
      method: "POST",
      token: adminToken,
      body: {
        branchId: branchA,
        fullName: "Branch A Operator",
        phone: opPhone,
        password: "OpPass!2026",
      },
    });
    expect(opRes.status).toBe(201);
    operatorId = opRes.body.data.staff.id;

    // The staff record should carry branchId
    expect(opRes.body.data.staff.branchId).toBe(branchA);

    // Login as the operator
    const loginRes = await api("/api/auth/login", {
      method: "POST",
      body: { phone: opPhone, password: "OpPass!2026" },
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.branchId).toBe(branchA);
    operatorToken = loginRes.body.data.accessToken;
  });

  it("company admin sees branches of their company", async () => {
    const res = await api("/api/company/branches", { token: adminToken });
    expect(res.status).toBe(200);
    expect(res.body.data.branches.length).toBeGreaterThanOrEqual(2);
  });

  it("operator sees buses only from their branch", async () => {
    const res = await api("/api/company/buses?limit=100", { token: operatorToken });
    expect(res.status).toBe(200);
    for (const bus of res.body.data.buses) {
      expect(bus.branchId).toBe(branchA);
    }
  });

  it("company admin sees buses from all branches", async () => {
    const res = await api("/api/company/buses?limit=100", { token: adminToken });
    expect(res.status).toBe(200);
    const branchIds = res.body.data.buses.map((b) => b.branchId);
    expect(branchIds).toContain(branchA);
    expect(branchIds).toContain(branchB);
  });

  it("operator cannot create a bus (403, admin-only)", async () => {
    const res = await api("/api/company/buses", {
      method: "POST",
      token: operatorToken,
      body: {
        branchId: branchA,
        registrationNumber: `OP-${Date.now()}`,
        busType: "Coach",
        capacity: 30,
      },
    });
    expect(res.status).toBe(403);
  });

  it("operator cannot create a branch (403, admin-only)", async () => {
    const res = await api("/api/company/branches", {
      method: "POST",
      token: operatorToken,
      body: {
        name: `Operator Branch ${Date.now()}`,
        code: `OP${Date.now()}`,
      },
    });
    expect(res.status).toBe(403);
  });

  it("operator cannot create staff (403, admin-only)", async () => {
    const res = await api("/api/company/staff", {
      method: "POST",
      token: operatorToken,
      body: {
        fullName: "Test Staff",
        phone: randomPhone("0798"),
        password: "OpPass!2026",
      },
    });
    expect(res.status).toBe(403);
  });

  it("admin can transfer a bus between branches", async () => {
    const transferRes = await api(
      `/api/company/buses/${busA}/transfer-branch`,
      {
        method: "POST",
        token: adminToken,
        body: { targetBranchId: branchB },
      },
    );
    expect(transferRes.status).toBe(200);
    expect(transferRes.body.data.bus.branchId).toBe(branchB);
  });

  it("cannot deactivate a branch with buses", async () => {
    const res = await api(`/api/company/branches/${branchB}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { isActive: false },
    });
    expect(res.status).toBe(409);
  });

  it("branch lookup with a fake id returns 404", async () => {
    const res = await api(
      "/api/company/branches/00000000-0000-0000-0000-000000000000",
      { token: adminToken },
    );
    expect(res.status).toBe(404);
  });

  it("operator JWT carries their branchId", async () => {
    const meRes = await api("/api/auth/me", { token: operatorToken });
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.branchId).toBe(branchA);
    expect(meRes.body.data.user.role).toBe("COMPANY_OPERATOR");
  });
});