import { z } from "zod";

export const verifyQrSchema = z.object({
  qrCode: z
    .string()
    .trim()
    .min(10, "QR code is too short.")
    .max(4000, "QR code is too long."),
});

export const ticketBookingIdParamSchema = z.object({
  id: z.string().uuid("Invalid booking ID."),
});

export const listTicketsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z
    .enum(["ACTIVE", "USED", "CANCELLED", "EXPIRED"])
    .optional(),
});