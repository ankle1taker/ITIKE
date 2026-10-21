import { z } from "zod";
import {
  createSeat,
  listSeats,
  getSeatById,
  updateSeat,
  updateSeatStatus,
} from "../services/seat.service.js";

const coordinateSchema = z.coerce
  .number()
  .int("Coordinate must be an integer.")
  .min(1, "Coordinate must be a positive integer.");

const createSeatSchema = z.object({
  seatNumber: z
    .string()
    .trim()
    .min(1, "Seat number is required.")
    .max(
      20,
      "Seat number must not exceed 20 characters.",
    ),

  rowNumber: coordinateSchema.optional(),

  columnNumber:
    coordinateSchema.optional(),
});

const listSeatsSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(100),

  search: z
    .string()
    .trim()
    .max(
      50,
      "Search must not exceed 50 characters.",
    )
    .optional(),

  status: z
    .enum([
      "ACTIVE",
      "INACTIVE",
    ])
    .optional(),
});

const updateSeatSchema = z
  .object({
    seatNumber: z
      .string()
      .trim()
      .min(
        1,
        "Seat number is required.",
      )
      .max(
        20,
        "Seat number must not exceed 20 characters.",
      )
      .optional(),

    rowNumber:
      coordinateSchema.optional(),

    columnNumber:
      coordinateSchema.optional(),
  })
  .refine(
    (data) =>
      Object.keys(data).length > 0,
    {
      message:
        "At least one seat field must be provided.",
    },
  );

const updateSeatStatusSchema =
  z.object({
    status: z.enum([
      "ACTIVE",
      "INACTIVE",
    ]),
  });

const getCompanyId = (req) => {
  if (!req.companyId) {
    const error = new Error(
      "Company context is required.",
    );

    error.statusCode = 403;

    throw error;
  }

  return req.companyId;
};

const getActorId = (req) => {
  if (!req.user?.id) {
    const error = new Error(
      "User not authenticated.",
    );

    error.statusCode = 401;

    throw error;
  }

  return req.user.id;
};

export const create = async (
  req,
  res,
  next,
) => {
  try {
    const data =
      createSeatSchema.parse(
        req.body,
      );

    const companyId =
      getCompanyId(req);

    const actorId =
      getActorId(req);

    const seat =
      await createSeat({
        ...data,
        busId: req.params.busId,
        companyId,
        actorId,
      });

    res.status(201).json({
      success: true,
      message:
        "Seat created successfully.",
      data: {
        seat,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (
  req,
  res,
  next,
) => {
  try {
    const query =
      listSeatsSchema.parse(
        req.query,
      );

    const companyId =
      getCompanyId(req);

    const result =
      await listSeats({
        ...query,
        busId: req.params.busId,
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

export const getById = async (
  req,
  res,
  next,
) => {
  try {
    const companyId =
      getCompanyId(req);

    const seat =
      await getSeatById({
        busId: req.params.busId,
        seatId: req.params.id,
        companyId,
      });

    res.status(200).json({
      success: true,
      data: {
        seat,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const update = async (
  req,
  res,
  next,
) => {
  try {
    const data =
      updateSeatSchema.parse(
        req.body,
      );

    const companyId =
      getCompanyId(req);

    const actorId =
      getActorId(req);

    const seat =
      await updateSeat({
        ...data,
        busId: req.params.busId,
        seatId: req.params.id,
        companyId,
        actorId,
      });

    res.status(200).json({
      success: true,
      message:
        "Seat updated successfully.",
      data: {
        seat,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (
  req,
  res,
  next,
) => {
  try {
    const { status } =
      updateSeatStatusSchema.parse(
        req.body,
      );

    const companyId =
      getCompanyId(req);

    const actorId =
      getActorId(req);

    const seat =
      await updateSeatStatus({
        busId: req.params.busId,
        seatId: req.params.id,
        companyId,
        actorId,
        status,
      });

    res.status(200).json({
      success: true,
      message:
        "Seat status updated successfully.",
      data: {
        seat,
      },
    });
  } catch (error) {
    next(error);
  }
};