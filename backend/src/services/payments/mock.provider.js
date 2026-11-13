import crypto from "node:crypto";

/**
 * Mock payment provider — for development and testing only.
 */

const nextPollStatusByRef = new Map();
let failAllRefunds = 0;

export const mockProvider = {
  name: "mock",

  async initiatePayment({ amount, currency, phoneNumber, reference, callbackUrl }) {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("mock: invalid amount");
    if (!phoneNumber || typeof phoneNumber !== "string") throw new Error("mock: invalid phoneNumber");
    return {
      providerReference: "MOCK-" + crypto.randomUUID(),
      status: "PENDING",
      redirectUrl: null,
    };
  },

  async verifyWebhook({ headers, rawBody }) {
    const secret = process.env.MOCK_WEBHOOK_SECRET;
    if (!secret) return { valid: false, reason: "MOCK_WEBHOOK_SECRET not configured" };
    const sig = headers["x-mock-signature"];
    if (!sig) return { valid: false, reason: "missing x-mock-signature header" };
    const expected = Buffer.from(secret);
    const provided = Buffer.from(sig);
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
      return { valid: false, reason: "invalid signature" };
    }
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { valid: false, reason: "invalid JSON body" };
    }
    const { providerReference, status, amount, paidAt } = body;
    if (!providerReference || typeof providerReference !== "string") {
      return { valid: false, reason: "missing providerReference" };
    }
    if (!["SUCCESS", "FAILED", "PENDING"].includes(status)) {
      return { valid: false, reason: "invalid status" };
    }
    return {
      valid: true,
      providerReference,
      status,
      amount: typeof amount === "number" ? amount : undefined,
      paidAt: paidAt ?? undefined,
    };
  },

  async pollStatus({ providerReference }) {
    if (nextPollStatusByRef.has(providerReference)) {
      const status = nextPollStatusByRef.get(providerReference);
      nextPollStatusByRef.delete(providerReference);
      return {
        status,
        amount: undefined,
        paidAt: status === "SUCCESS" ? new Date().toISOString() : undefined,
      };
    }
    return { status: "PENDING" };
  },

  async refund({ providerReference, amount, reason }) {
    if (!providerReference) throw new Error("mock: providerReference required for refund");
    if (failAllRefunds > 0) {
      failAllRefunds--;
      throw new Error("mock: refund failed (test-injected)");
    }
    return {
      supported: true,
      providerRefundReference: "MOCK-REF-" + crypto.randomUUID(),
      status: "REFUNDED",
    };
  },
};

export const __test__ = {
  setNextPollStatus(providerReference, status) {
    nextPollStatusByRef.set(providerReference, status);
  },
  failNextRefund(times = 1) {
    failAllRefunds = times;
  },
  clear() {
    nextPollStatusByRef.clear();
    failAllRefunds = 0;
  },
};