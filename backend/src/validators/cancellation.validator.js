import { z } from "zod";

const pctSchema = z.coerce
  .number()
  .min(0, "Percentage must be at least 0.")
  .max(100, "Percentage must not exceed 100.")
  .multipleOf(0.01, "Percentage must have at most 2 decimal places.");

export const cancelBookingSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Reason must not exceed 500 characters.")
    .optional(),
});

export const cancelBookingParamsSchema = z.object({
  id: z.string().uuid("Invalid booking ID."),
});

export const upsertPolicySchema = z.object({
  moreThan24HoursPct: pctSchema,
  twelveTo24HoursPct: pctSchema,
  lessThan12HoursPct: pctSchema,
  afterDeparturePct: pctSchema,
});