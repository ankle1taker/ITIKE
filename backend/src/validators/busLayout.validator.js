import { z } from "zod";

const LAYOUT_TYPES = ["STANDARD", "VIP", "SLEEPER", "CUSTOM"];

export const createBusLayoutSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Layout name is required.")
    .max(100, "Layout name must not exceed 100 characters."),

  code: z
    .string()
    .trim()
    .min(1, "Layout code cannot be empty.")
    .max(20, "Layout code must not exceed 20 characters.")
    .optional(),

  layoutType: z.enum(LAYOUT_TYPES).default("CUSTOM"),

  rowCount: z.coerce
    .number()
    .int("Row count must be an integer.")
    .min(1, "Row count must be at least 1.")
    .max(30, "Row count must not exceed 30."),

  columnCount: z.coerce
    .number()
    .int("Column count must be an integer.")
    .min(1, "Column count must be at least 1.")
    .max(10, "Column count must not exceed 10."),

  configuration: z.record(z.any()).optional(),
});

export const updateBusLayoutSchema = createBusLayoutSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one layout field must be provided.",
  });

export const updateBusLayoutStatusSchema = z.object({
  isActive: z.boolean({
    required_error: "isActive is required.",
    invalid_type_error: "isActive must be a boolean.",
  }),
});

export const listBusLayoutsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(50).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});