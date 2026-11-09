import { z } from "zod";

export const checkInParamsSchema = z.object({
  ticketNumber: z
    .string()
    .trim()
    .min(5, "Ticket number is too short.")
    .max(50, "Ticket number is too long."),
});