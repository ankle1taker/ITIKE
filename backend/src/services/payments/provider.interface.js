/**
 * Payment provider interface.
 *
 * Every provider (mock, MTN MoMo, Airtel Money) MUST implement this shape
 * so payment.service.js can treat them identically.
 *
 * CONTRACT:
 *
 *   {
 *     name: string,
 *
 *     // Initiate a charge. Called from POST /api/customer/bookings/:id/pay.
 *     // Returns the provider's reference that we store on Payment.providerReference.
 *     async initiatePayment({ amount, currency, phoneNumber, reference, callbackUrl })
 *       → {
 *           providerReference: string,     // e.g. "MOCK-<uuid>" or MoMo ref
 *           status: "PENDING" | "FAILED",   // initial status from provider
 *           redirectUrl: string | null,     // if provider uses redirect flow
 *         },
 *
 *     // Verify an incoming webhook. Called from POST /api/webhooks/:provider.
 *     // MUST return { valid: false } for any invalid signature — never throw.
 *     // MUST return { valid: true, ... } only when the signature is proven.
 *     async verifyWebhook({ headers, rawBody })
 *       → {
 *           valid: boolean,
 *           reason?: string,             // for logs, e.g. "missing header"
 *           providerReference?: string,  // required if valid=true
 *           status?: "SUCCESS" | "FAILED" | "PENDING",
 *           amount?: number,             // in same currency as initiatePayment
 *           paidAt?: Date | string,
 *         },
 *
 *     // Poll provider for the current status. Called from confirm-by-poll path.
 *     // Called by the future background reconciler (module 9c) as well.
 *     async pollStatus({ providerReference })
 *       → {
 *           status: "PENDING" | "SUCCESS" | "FAILED",
 *           paidAt?: Date | string,
 *           amount?: number,
 *         },
 *
 *     // Refund a SUCCESS payment. Called by auto-refund path and manual refund endpoint.
 *     // If provider does not support refunds, return { supported: false }.
 *     async refund({ providerReference, amount, reason })
 *       → {
 *           supported: boolean,
 *           providerRefundReference?: string,
 *           status?: "REFUNDED" | "FAILED",
 *         },
 *   }
 *
 * INVARIANTS:
 *
 *  - initiatePayment MUST throw on provider error (network/auth/etc.);
 *    payment.service.js will mark Payment.status=FAILED and return 502.
 *
 *  - verifyWebhook MUST NOT throw on invalid signature — return { valid: false }.
 *    Throwing would break the webhook endpoint and cause provider retry storms.
 *
 *  - pollStatus MUST throw on provider error; caller handles retry/backoff.
 *
 *  - All amount fields are in the same currency as the initiatePayment call,
 *    as a plain number (not string, not Decimal). Prisma Decimal conversion
 *    happens in payment.service.js.
 */

export const PROVIDER_NAMES = Object.freeze({
  MOCK: "mock",
  MTN_MOMO: "mtn_momo",
  AIRTEL: "airtel",
});