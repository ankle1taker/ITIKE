import { z } from "zod";

export const createBranchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Branch name is required.")
    .max(100, "Branch name must not exceed 100 characters."),
  code: z
    .string()
    .trim()
    .min(1, "Branch code must not be empty.")
    .max(20, "Branch code must not exceed 20 characters.")
    .optional(),
  phone: z
    .string()
    .trim()
    .max(20, "Phone must not exceed 20 characters.")
    .optional(),
  address: z
    .string()
    .trim()
    .max(300, "Address must not exceed 300 characters.")
    .optional(),
});

export const updateBranchSchema = createBranchSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one branch field must be provided.",
  });

export const updateBranchStatusSchema = z.object({
  isActive: z.boolean({
    required_error: "isActive is required.",
    invalid_type_error: "isActive must be a boolean.",
  }),
});

export const transferBusSchema = z.object({
  targetBranchId: z.string().uuid("Invalid target branch ID."),
});