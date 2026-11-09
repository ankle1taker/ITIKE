/**
 * Airtel Money Collections API adapter.
 *
 * Reference: https://developers.airtel.africa/
 *
 * Flow:
 *   1. OAuth2 token from /auth/oauth2/token
 *   2. POST /merchant/v1/payments/ to initiate
 *   3. Receive transaction.id — becomes providerReference
 *   4. Provider sends webhook with X-Signature header (base64 HMAC-SHA256)
 *   5. We can poll GET /standard/v1/payments/{id} for status
 */

import crypto from "node:crypto";

const BASE_URL = () =>
  process.env.AIRTEL_BASE_URL || "https://openapiuat.airtel.africa";
const CLIENT_ID = () => process.env.AIRTEL_CLIENT_ID;
const CLIENT_SECRET = () => process.env.AIRTEL_CLIENT_SECRET;
const SIGNING_SECRET = () =>
  process.env.AIRTEL_WEBHOOK_SIGNING_SECRET || CLIENT_SECRET();

let cachedToken = null;
let cachedTokenExpiry = 0;

const getAccessToken = async () => {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry - 60_000) {
    return cachedToken;
  }

  const cid = CLIENT_ID();
  const secret = CLIENT_SECRET();
  if (!cid || !secret) {
    throw new Error("Airtel credentials missing from environment");
  }

  const res = await fetch(`${BASE_URL()}/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: cid,
      client_secret: secret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtel token request failed: ${res.status} ${body}`);
  }

  const json = await res.json();
  cachedToken = json.access_token;
  cachedTokenExpiry = now + (json.expires_in || 3600) * 1000;
  return cachedToken;
};

const callAirtel = async (path, { method = "GET", body, extraHeaders } = {}) => {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Country": process.env.AIRTEL_COUNTRY || "RW",
    "X-Currency": process.env.AIRTEL_CURRENCY || "RWF",
    ...(extraHeaders || {}),
  };

  const res = await fetch(`${BASE_URL()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  if (!res.ok) {
    throw new Error(`Airtel ${method} ${path} failed: ${res.status} ${text}`);
  }

  return { status: res.status, body: json };
};

export const airtelMoneyProvider = {
  name: "airtel",

  async initiatePayment({ amount, currency, phoneNumber, reference, callbackUrl }) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("airtel: invalid amount");
    }
    if (!phoneNumber) {
      throw new Error("airtel: invalid phoneNumber");
    }

    const transactionId = crypto.randomUUID();

    await callAirtel("/merchant/v1/payments/", {
      method: "POST",
      body: {
        reference: reference || transactionId,
        subscriber: {
          country: process.env.AIRTEL_COUNTRY || "RW",
          currency: currency || "RWF",
          msisdn: phoneNumber,
        },
        transaction: {
          amount: Number(amount),
          country: process.env.AIRTEL_COUNTRY || "RW",
          currency: currency || "RWF",
          id: transactionId,
        },
      },
      extraHeaders: {
        "X-Signature": "placeholder", // Airtel accepts unsigned requests in some envs
      },
    });

    return {
      providerReference: transactionId,
      status: "PENDING",
      redirectUrl: null,
    };
  },

  async verifyWebhook({ headers, rawBody }) {
    const secret = SIGNING_SECRET();
    if (!secret) {
      return { valid: false, reason: "AIRTEL_WEBHOOK_SIGNING_SECRET not configured" };
    }

    const signature = headers["x-signature"];
    if (!signature) {
      return { valid: false, reason: "missing X-Signature header" };
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(signature);
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return { valid: false, reason: "invalid signature" };
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { valid: false, reason: "invalid JSON" };
    }

    const transactionId =
      body?.transaction?.id || body?.transactionId || body?.reference;
    if (!transactionId) {
      return { valid: false, reason: "missing transaction id" };
    }

    const rawStatus = String(
      body?.transaction?.status || body?.status || "",
    ).toUpperCase();
    let status;
    if (["TS", "SUCCESSFUL", "SUCCESS"].includes(rawStatus)) status = "SUCCESS";
    else if (["TF", "FAILED", "REJECTED"].includes(rawStatus)) status = "FAILED";
    else if (["TP", "PENDING"].includes(rawStatus)) status = "PENDING";
    else return { valid: false, reason: "unknown status" };

    return {
      valid: true,
      providerReference: transactionId,
      status,
      amount: body?.transaction?.amount
        ? Number(body.transaction.amount)
        : undefined,
      paidAt: status === "SUCCESS" ? new Date() : undefined,
    };
  },

  async pollStatus({ providerReference }) {
    const { body } = await callAirtel(
      `/standard/v1/payments/${providerReference}`,
    );

    const rawStatus = String(body?.data?.transaction?.status || "").toUpperCase();
    let status;
    if (["TS", "SUCCESSFUL"].includes(rawStatus)) status = "SUCCESS";
    else if (["TF", "FAILED"].includes(rawStatus)) status = "FAILED";
    else status = "PENDING";

    return {
      status,
      paidAt: status === "SUCCESS" ? new Date() : undefined,
      amount: body?.data?.transaction?.amount
        ? Number(body.data.transaction.amount)
        : undefined,
    };
  },

  async refund({ providerReference, amount, reason }) {
    try {
      await callAirtel(`/standard/v1/payments/${providerReference}/refund`, {
        method: "POST",
        body: {
          transaction: {
            amount: Number(amount),
            country: process.env.AIRTEL_COUNTRY || "RW",
            currency: "RWF",
          },
        },
      });
      return {
        supported: true,
        providerRefundReference: `AIRTEL-REFUND-${providerReference}`,
        status: "REFUNDED",
      };
    } catch (err) {
      return { supported: true, status: "FAILED", error: err.message };
    }
  },
};