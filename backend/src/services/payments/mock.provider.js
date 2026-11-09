import crypto from "node:crypto";

/**
 * Mock payment provider — for development and testing only.
 *
 * Behaviors:
 *  - initiatePayment returns a MOCK-<uuid> reference, status PENDING.
 *  - verifyWebhook REQUIRES header `x-mock-signature` to match MOCK_WEBHOOK_SECRET.
 *    This exercises the "bad signature" path in tests.
 *  - The webhook body must be JSON with fields:
 *      { providerReference, status: "SUCCESS"|"FAILED"|"PENDING", amount, paidAt? }
 *  - pollStatus returns PENDING — tests can drive status via webhook only,
 *    which keeps webhook/poll ordering explicit.
 *
 * In production with PAYMENT_PROVIDER=mock, the app refuses to start
 * (see payments/index.js), so this can never be used live.
 */
export const mockProvider = {
  name: "mock",

  async initiatePayment({ amount, currency, phoneNumber, reference, callbackUrl }) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("mock: invalid amount");
    }
    if (!phoneNumber || typeof phoneNumber !== "string") {
      throw new Error("mock: invalid phoneNumber");
    }
    const providerReference = "MOCK-" + crypto.randomUUID();
    return {
      providerReference,
      status: "PENDING",
      redirectUrl: null,
    };
  },

  async verifyWebhook({ headers, rawBody }) {
    const secret = process.env.MOCK_WEBHOOK_SECRET;
    if (!secret) {
      return { valid: false, reason: "MOCK_WEBHOOK_SECRET not configured" };
    }

    // headers is Express's headers object; HTTP headers are lowercase in Express
    const sig = headers["x-mock-signature"];
    if (!sig) {
      return { valid: false, reason: "missing x-mock-signature header" };
    }

    // Constant-time compare — the header is short and secret is short, but do it right
    const expected = Buffer.from(secret);
    const provided = Buffer.from(sig);
    if (
      expected.length !== provided.length ||
      !crypto.timingSafeEqual(expected, provided)
    ) {
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
    // Mock poller always returns PENDING. Webhooks drive state.
    // This proves that the webhook path is the primary confirm path in 9a,
    // and the poll path is only needed if webhooks fail (which 9c will cover).
    return { status: "PENDING" };
  },

  async refund({ providerReference, amount, reason }) {
    if (!providerReference) {
      throw new Error("mock: providerReference required for refund");
    }
    return {
      supported: true,
      providerRefundReference: "MOCK-REF-" + crypto.randomUUID(),
      status: "REFUNDED",
    };
  },
};