import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Phone number is invalid.")
  .max(20, "Phone number is invalid.");

export const initiatePaymentSchema = z.object({
  provider: z.enum(["mock", "mtn_momo", "airtel"], {
    message: "Invalid provider.",
  }),
  phoneNumber: phoneSchema,
});

export const bookingIdParamSchema = z.object({
  id: z.string().uuid("Invalid booking ID."),
});

export const webhookProviderParamSchema = z.object({
  provider: z.enum(["mock", "mtn_momo", "airtel"], {
    message: "Unknown payment provider.",
  }),
});