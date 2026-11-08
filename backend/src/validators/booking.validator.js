import { z } from "zod";

const passengerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Passenger full name must contain at least 2 characters.")
    .max(100, "Passenger full name must not exceed 100 characters."),

  phone: z
    .string()
    .trim()
    .min(7, "Passenger phone is invalid.")
    .max(20, "Passenger phone is invalid."),

  idType: z
    .string()
    .trim()
    .max(20, "ID type must not exceed 20 characters.")
    .optional(),

  idNumber: z
    .string()
    .trim()
    .max(50, "ID number must not exceed 50 characters.")
    .optional(),
});

export const createBookingSchema = z
  .object({
    tripId: z.string().uuid("Invalid trip ID."),

    seatIds: z
      .array(z.string().uuid("Invalid seat ID."))
      .min(1, "At least one seat must be selected.")
      .max(50, "Cannot book more than 50 seats at once."),

    passengers: z
      .array(passengerSchema)
      .min(1, "At least one passenger is required.")
      .max(50, "Cannot book more than 50 passengers at once."),

    dropoffStopId: z
      .string()
      .uuid("Invalid dropoff stop ID.")
      .nullable()
      .optional(),
  })
  .refine((data) => data.seatIds.length === data.passengers.length, {
    message:
      "The number of passengers must match the number of selected seats.",
    path: ["passengers"],
  });

export const listBookingsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z
    .enum([
      "HELD",
      "PENDING_PAYMENT",
      "CONFIRMED",
      "CANCELLED",
      "EXPIRED",
      "REFUNDED",
    ])
    .optional(),
});

export const bookingIdParamSchema = z.object({
  id: z.string().uuid("Invalid booking ID."),
});