/**
 * Notification provider interface.
 *
 * Every provider (mock, Africa's Talking, etc.) MUST implement this shape.
 *
 * CONTRACT:
 *
 *   {
 *     name: string,
 *
 *     // Send one SMS.
 *     // MUST throw on provider error â€” dispatcher will retry up to 3 times.
 *     async sendSms({ to, message })
 *       â†’ {
 *           providerReference: string,
 *           status: "SENT" | "FAILED",
 *         },
 *
 *     // Send one email. Optional â€” implementations may return { supported: false }
 *     // if the provider doesn't handle email.
 *     async sendEmail({ to, subject, textBody })
 *       â†’ {
 *           supported: boolean,
 *           providerReference?: string,
 *           status?: "SENT" | "FAILED",
 *         },
 *   }
 */

export const PROVIDER_NAMES = Object.freeze({
  MOCK: "mock",
  AFRICAS_TALKING: "africas_talking",
});