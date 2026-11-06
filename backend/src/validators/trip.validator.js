import { z } from "zod";

const TRIP_STATUSES = [
  "SCHEDULED",
  "BOARDING",
  "DEPARTED",
  "ARRIVED",
  "CANCELLED",
  "DELAYED",
];

const isoDateTimeSchema = z
  .string()
  .trim()
  .datetime({ offset: true, message: "Must be a valid ISO 8601 datetime." });

const basePriceSchema = z.coerce
  .number()
  .multipleOf(0.01, "Price must have at most 2 decimal places.")
  .gt(0, "Price must be greater than 0.")
  .max(1000000, "Price must not exceed 1,000,000.");

export const createTripSchema = z
  .object({
    routeId: z.string().uuid("Invalid route ID."),
    busId: z.string().uuid("Invalid bus ID."),
    departureTime: isoDateTimeSchema,
    arrivalTime: isoDateTimeSchema,
    basePrice: basePriceSchema,
  })
  .refine(
    (data) => new Date(data.departureTime) < new Date(data.arrivalTime),
    {
      message: "Arrival time must be after departure time.",
      path: ["arrivalTime"],
    },
  )
  .refine((data) => new Date(data.departureTime) > new Date(), {
    message: "Departure time must be in the future.",
    path: ["departureTime"],
  });

export const listTripsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(TRIP_STATUSES).optional(),
  busId: z.string().uuid("Invalid bus ID.").optional(),
  routeId: z.string().uuid("Invalid route ID.").optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  search: z
    .string()
    .trim()
    .max(100, "Search must not exceed 100 characters.")
    .optional(),
});

export const updateTripSchema = z
  .object({
    routeId: z.string().uuid("Invalid route ID.").optional(),
    arrivalTime: isoDateTimeSchema.optional(),
    basePrice: basePriceSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one trip field must be provided.",
  });

export const updateTripStatusSchema = z.object({
  status: z.enum(TRIP_STATUSES),
});