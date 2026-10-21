
import { z } from "zod";
import {
  createBus,
  listBuses,
  getBusById,
  updateBus,
  updateBusStatus,
} from "../services/bus.service.js";

const layoutIdSchema = z
  .string()
  .uuid("Invalid bus layout ID.")
  .nullable()
  .optional();

const createBusSchema = z.object({
  layoutId: layoutIdSchema,

  registrationNumber: z
    .string()
    .trim()
    .min(2, "Registration number is required.")
    .max(50, "Registration number must not exceed 50 characters."),

  manufacturer: z
    .string()
    .trim()
    .max(100, "Manufacturer must not exceed 100 characters.")
    .optional(),

  model: z
    .string()
    .trim()
    .max(100, "Model must not exceed 100 characters.")
    .optional(),

  busType: z
    .string()
    .trim()
    .min(2, "Bus type is required.")
    .max(50, "Bus type must not exceed 50 characters."),

  capacity: z.coerce
    .number()
    .int("Bus capacity must be an integer.")
    .min(1, "Bus capacity must be at least 1.")
    .max(200, "Bus capacity must not exceed 200."),
});

const listBusesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  search: z
    .string()
    .trim()
    .max(100, "Search must not exceed 100 characters.")
    .optional(),

  status: z
    .enum(["ACTIVE", "MAINTENANCE", "INACTIVE"])
    .optional(),
});

const updateBusSchema = z
  .object({
    layoutId: layoutIdSchema,

    registrationNumber: z
      .string()
      .trim()
      .min(2, "Registration number is required.")
      .max(50, "Registration number must not exceed 50 characters.")
      .optional(),

    manufacturer: z
      .string()
      .trim()
      .max(100, "Manufacturer must not exceed 100 characters.")
      .optional(),

    model: z
      .string()
      .trim()
      .max(100, "Model must not exceed 100 characters.")
      .optional(),

    busType: z
      .string()
      .trim()
      .min(2, "Bus type is required.")
      .max(50, "Bus type must not exceed 50 characters.")
      .optional(),

    capacity: z.coerce
      .number()
      .int("Bus capacity must be an integer.")
      .min(1, "Bus capacity must be at least 1.")
      .max(200, "Bus capacity must not exceed 200.")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one bus field must be provided.",
  });

const updateBusStatusSchema = z.object({
  status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]),
});

const getCompanyId = (req) => {
  if (!req.companyId) {
    const error = new Error("Company context is required.");
    error.statusCode = 403;
    throw error;
  }

  return req.companyId;
};

const getActorId = (req) => {
  if (!req.user?.id) {
    const error = new Error("User not authenticated.");
    error.statusCode = 401;
    throw error;
  }

  return req.user.id;
};

export const create = async (req, res, next) => {
  try {
    const data = createBusSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const bus = await createBus({
      ...data,
      companyId,
      actorId,
    });

    res.status(201).json({
      success: true,
      message: "Bus created successfully.",
      data: { bus },
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const query = listBusesSchema.parse(req.query);
    const companyId = getCompanyId(req);

    const result = await listBuses({
      ...query,
      companyId,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);

    const bus = await getBusById({
      id,
      companyId,
    });

    res.status(200).json({
      success: true,
      data: { bus },
    });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateBusSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const bus = await updateBus({
      id,
      companyId,
      actorId,
      ...data,
    });

    res.status(200).json({
      success: true,
      message: "Bus updated successfully.",
      data: { bus },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = updateBusStatusSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const bus = await updateBusStatus({
      id,
      companyId,
      actorId,
      status,
    });

    res.status(200).json({
      success: true,
      message: "Bus status updated successfully.",
      data: { bus },
    });
  } catch (error) {
    next(error);
  }
};
