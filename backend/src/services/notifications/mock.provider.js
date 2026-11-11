import crypto from "node:crypto";

/**
 * Mock notification provider â€” logs to console, returns success.
 * Active in V1 when NOTIFICATION_PROVIDER=mock (default).
 */
export const mockProvider = {
  name: "mock",

  async sendSms({ to, message }) {
    if (!to || typeof to !== "string") {
      throw new Error("mock-sms: recipient phone required");
    }
    if (!message || typeof message !== "string") {
      throw new Error("mock-sms: message required");
    }

    console.log(`[mock-sms] to=${to} message=${message.slice(0, 60)}${message.length > 60 ? "..." : ""}`);

    return {
      providerReference: "MOCK-SMS-" + crypto.randomUUID(),
      status: "SENT",
    };
  },

  async sendEmail({ to, subject, textBody }) {
    console.log(`[mock-email] to=${to} subject=${subject}`);
    return {
      supported: true,
      providerReference: "MOCK-EMAIL-" + crypto.randomUUID(),
      status: "SENT",
    };
  },
};