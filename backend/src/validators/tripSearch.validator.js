import { z } from "zod";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
  .refine((v) => !Number.isNaN(Date.parse(v + "T00:00:00Z")), {
    message: "Date is not a valid calendar date.",
  });

const decimalSchema = z.coerce
  .number()
  .multipleOf(0.01, "Price must have at most 2 decimal places.")
  .gte(0, "Price must be zero or greater.");

export const searchTripsSchema = z.object({
  origin: z
    .string()
    .trim()
    .min(2, "Origin is required.")
    .max(100, "Origin must not exceed 100 characters."),

  destination: z
    .string()
    .trim()
    .min(2, "Destination is required.")
    .max(100, "Destination must not exceed 100 characters."),

  date: isoDateSchema,

  companyId: z.string().uuid("Invalid company ID.").optional(),

  minSeats: z.coerce
    .number()
    .int()
    .min(1, "minSeats must be at least 1.")
    .optional(),

  minPrice: decimalSchema.optional(),
  maxPrice: decimalSchema.optional(),

  sort: z
    .enum(["departure_asc", "price_asc", "price_desc", "duration_asc"])
    .default("departure_asc"),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const tripIdParamSchema = z.object({
  id: z.string().uuid("Invalid trip ID."),
});