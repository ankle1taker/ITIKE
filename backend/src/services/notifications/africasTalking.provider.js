/**
 * Africa's Talking SMS adapter.
 *
 * Active when NOTIFICATION_PROVIDER=africas_talking.
 * Requires: AFRICAS_TALKING_USERNAME, AFRICAS_TALKING_API_KEY, AFRICAS_TALKING_SENDER_ID
 *
 * Uses the AT REST API: POST https://api.africastalking.com/version1/messaging
 * Docs: https://developers.africastalking.com/docs/sms/sending/bulk
 *
 * NOTE: EMAIL is NOT supported by Africa's Talking â€” returns { supported: false }
 */

const BASE_URL = () =>
  process.env.AFRICAS_TALKING_BASE_URL || "https://api.africastalking.com";

const USERNAME = () => process.env.AFRICAS_TALKING_USERNAME;
const API_KEY = () => process.env.AFRICAS_TALKING_API_KEY;
const SENDER_ID = () => process.env.AFRICAS_TALKING_SENDER_ID || "ITIKE";

export const africasTalkingProvider = {
  name: "africas_talking",

  async sendSms({ to, message }) {
    const username = USERNAME();
    const apiKey = API_KEY();
    if (!username || !apiKey) {
      throw new Error(
        "africas_talking: AFRICAS_TALKING_USERNAME and AFRICAS_TALKING_API_KEY required",
      );
    }
    if (!to || typeof to !== "string") {
      throw new Error("africas_talking: recipient phone required");
    }
    if (!message || typeof message !== "string") {
      throw new Error("africas_talking: message required");
    }

    const params = new URLSearchParams();
    params.append("username", username);
    params.append("to", to);
    params.append("message", message);
    params.append("from", SENDER_ID());

    const res = await fetch(`${BASE_URL()}/version1/messaging`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey,
      },
      body: params.toString(),
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      throw new Error(
        `africas_talking: ${res.status} ${text.slice(0, 200)}`,
      );
    }

    const recipients = json?.SMSMessageData?.Recipients || [];
    const first = recipients[0];

    if (first?.status === "Success" || first?.statusCode === 101) {
      return {
        providerReference: first.messageId || `AT-${Date.now()}`,
        status: "SENT",
      };
    }

    const errMsg = first?.status || "Unknown AT error";
    const err = new Error(`africas_talking: ${errMsg}`);
    err.providerResponse = json;
    throw err;
  },

  async sendEmail() {
    return { supported: false };
  },
};