/**
 * MTN MoMo Collections API adapter.
 *
 * Reference: https://momodeveloper.mtn.com/api-documentation
 *
 * Flow:
 *   1. Obtain OAuth access token from /collection/token/
 *   2. POST /collection/v1_0/requesttopay with amount + phone
 *   3. Receive X-Reference-Id (UUID) — this becomes our providerReference
 *   4. Provider sends webhook to our callback URL when status changes
 *   5. We can also poll GET /collection/v1_0/requesttopay/{referenceId}
 *
 * Signature verification for MoMo webhooks: MTN does NOT sign webhooks with
 * an HMAC header by default; instead they recommend validating by calling the
 * GET /requesttopay/{referenceId} endpoint and confirming the status matches
 * what the webhook claims. We implement verifyWebhook by requiring a valid
 * referenceId in the body (returns valid=true only if referenceId format is
 * legitimate UUID); the ACTUAL verification happens via pollStatus in the
 * webhook handler (payment.service.js).
 *
 * This is the officially documented MTN approach. Do NOT skip the poll step.
 */

const BASE_URL = () =>
  process.env.MTN_MOMO_BASE_URL || "https://sandbox.momodeveloper.mtn.com";
const SUBSCRIPTION_KEY = () => process.env.MTN_MOMO_SUBSCRIPTION_KEY;
const API_USER = () => process.env.MTN_MOMO_API_USER;
const API_KEY = () => process.env.MTN_MOMO_API_KEY;
const TARGET_ENV = () =>
  process.env.MTN_MOMO_TARGET_ENV || "sandbox";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let cachedToken = null;
let cachedTokenExpiry = 0;

const getAccessToken = async () => {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry - 60_000) {
    return cachedToken;
  }

  const apiUser = API_USER();
  const apiKey = API_KEY();
  const subKey = SUBSCRIPTION_KEY();
  if (!apiUser || !apiKey || !subKey) {
    throw new Error("MTN MoMo credentials missing from environment");
  }

  const authHeader = "Basic " + Buffer.from(`${apiUser}:${apiKey}`).toString("base64");

  const res = await fetch(`${BASE_URL()}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Ocp-Apim-Subscription-Key": subKey,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MTN MoMo token request failed: ${res.status} ${body}`);
  }

  const json = await res.json();
  cachedToken = json.access_token;
  cachedTokenExpiry = now + (json.expires_in || 3600) * 1000;
  return cachedToken;
};

const callMomo = async (path, { method = "GET", body } = {}) => {
  const token = await getAccessToken();
  const subKey = SUBSCRIPTION_KEY();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Ocp-Apim-Subscription-Key": subKey,
    "X-Target-Environment": TARGET_ENV(),
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  if (!res.ok) {
    throw new Error(
      `MTN MoMo ${method} ${path} failed: ${res.status} ${text}`,
    );
  }

  return { status: res.status, body: json };
};

export const mtnMomoProvider = {
  name: "mtn_momo",

  async initiatePayment({ amount, currency, phoneNumber, reference, callbackUrl }) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("mtn_momo: invalid amount");
    }
    if (!phoneNumber) {
      throw new Error("mtn_momo: invalid phoneNumber");
    }

    const referenceId = crypto.randomUUID();
    const externalId = reference || referenceId;

    await callMomo("/collection/v1_0/requesttopay", {
      method: "POST",
      body: {
        amount: String(amount),
        currency: currency || "EUR",
        externalId,
        payer: {
          partyIdType: "MSISDN",
          partyId: phoneNumber,
        },
        payerMessage: "Itike ticket payment",
        payeeNote: `Itike booking ${reference || ""}`,
        // callbackUrl not needed if provider is configured centrally
      },
    });

    // MTN returns 202 Accepted with no body; X-Reference-Id is the ref
    return {
      providerReference: referenceId,
      status: "PENDING",
      redirectUrl: null,
    };
  },

  async verifyWebhook({ headers, rawBody }) {
    // MTN does not sign webhooks. We trust the referenceId if it's a valid
    // UUID, and REQUIRED the caller (payment.service.js) to poll before
    // confirming. This matches MTN's official recommendation.
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { valid: false, reason: "invalid JSON" };
    }

    const providerReference =
      body.referenceId || body.externalId || body.reference;
    if (!providerReference || !UUID_REGEX.test(String(providerReference))) {
      return { valid: false, reason: "missing or invalid referenceId" };
    }

    const rawStatus = String(body.status || "").toUpperCase();
    let status;
    if (rawStatus === "SUCCESSFUL" || rawStatus === "SUCCESS") status = "SUCCESS";
    else if (rawStatus === "FAILED" || rawStatus === "REJECTED") status = "FAILED";
    else if (rawStatus === "PENDING") status = "PENDING";
    else return { valid: false, reason: "unknown status" };

    return {
      valid: true,
      providerReference,
      status,
      amount: body.amount ? Number(body.amount) : undefined,
      paidAt: body.financialTransactionId ? new Date() : undefined,
    };
  },

  async pollStatus({ providerReference }) {
    const { body } = await callMomo(
      `/collection/v1_0/requesttopay/${providerReference}`,
    );

    const rawStatus = String(body.status || "").toUpperCase();
    let status;
    if (rawStatus === "SUCCESSFUL") status = "SUCCESS";
    else if (rawStatus === "FAILED" || rawStatus === "REJECTED") status = "FAILED";
    else status = "PENDING";

    return {
      status,
      paidAt: body.financialTransactionId ? new Date() : undefined,
      amount: body.amount ? Number(body.amount) : undefined,
    };
  },

  async refund({ providerReference, amount, reason }) {
    // MTN MoMo Refund API: POST /collection/v1_0/requesttopay/{refId}/refund
    try {
      await callMomo(
        `/collection/v1_0/requesttopay/${providerReference}/refund`,
        {
          method: "POST",
          body: {
            amount: String(amount),
            currency: "EUR",
            externalId: `REFUND-${providerReference}`,
            payerMessage: reason || "Refund",
          },
        },
      );
      return {
        supported: true,
        providerRefundReference: `MTN-REFUND-${providerReference}`,
        status: "REFUNDED",
      };
    } catch (err) {
      return {
        supported: true,
        status: "FAILED",
        error: err.message,
      };
    }
  },
};