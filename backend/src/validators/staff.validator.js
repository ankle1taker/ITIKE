import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Phone number is invalid.")
  .max(20, "Phone number is invalid.");

const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Full name must contain at least 2 characters.")
  .max(100, "Full name must not exceed 100 characters.");

const emailSchema = z
  .string()
  .trim()
  .email("Invalid email address.")
  .max(100, "Email must not exceed 100 characters.");

const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(128, "Password must not exceed 128 characters.");

export const createStaffSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID.").optional(),
  fullName: fullNameSchema,
  phone: phoneSchema,
  email: emailSchema.optional(),
  password: passwordSchema,
});

export const listStaffSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z
    .string()
    .trim()
    .max(100, "Search must not exceed 100 characters.")
    .optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const updateStaffSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    phone: phoneSchema.optional(),
    email: emailSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one staff field must be provided.",
  });

export const updateStaffStatusSchema = z.object({
  isActive: z.boolean({
    required_error: "isActive is required.",
    invalid_type_error: "isActive must be a boolean.",
  }),
});

export const resetStaffPasswordSchema = z.object({
  password: passwordSchema,
});