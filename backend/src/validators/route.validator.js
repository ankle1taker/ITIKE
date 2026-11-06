import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must contain at least 2 characters.")
  .max(100, "Name must not exceed 100 characters.");

const stopNameSchema = z
  .string()
  .trim()
  .min(2, "Stop name must contain at least 2 characters.")
  .max(100, "Stop name must not exceed 100 characters.");

const stopsArraySchema = z
  .array(
    z.object({
      name: stopNameSchema,
    }),
  )
  .max(50, "A route cannot have more than 50 stops.")
  .optional();

export const createRouteSchema = z
  .object({
    origin: nameSchema,
    destination: nameSchema,
    stops: stopsArraySchema,
  })
  .refine((data) => data.origin.toLowerCase() !== data.destination.toLowerCase(), {
    message: "Origin and destination must be different.",
    path: ["destination"],
  })
  .refine(
    (data) => {
      if (!data.stops || data.stops.length === 0) return true;
      const first = data.stops[0].name.toLowerCase();
      const last = data.stops[data.stops.length - 1].name.toLowerCase();
      return (
        first === data.origin.toLowerCase() &&
        last === data.destination.toLowerCase()
      );
    },
    {
      message:
        "If stops are provided, the first stop must equal origin and the last stop must equal destination.",
      path: ["stops"],
    },
  );

export const updateRouteSchema = z
  .object({
    origin: nameSchema.optional(),
    destination: nameSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one route field must be provided.",
  })
  .refine(
    (data) =>
      !(
        data.origin !== undefined &&
        data.destination !== undefined &&
        data.origin.toLowerCase() === data.destination.toLowerCase()
      ),
    {
      message: "Origin and destination must be different.",
      path: ["destination"],
    },
  );

export const updateRouteStatusSchema = z.object({
  isActive: z.boolean({
    required_error: "isActive is required.",
    invalid_type_error: "isActive must be a boolean.",
  }),
});

export const replaceStopsSchema = z.object({
  stops: z
    .array(
      z.object({
        name: stopNameSchema,
      }),
    )
    .max(50, "A route cannot have more than 50 stops."),
});

export const listRoutesSchema = z.object({
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