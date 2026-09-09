import { z } from "zod";
import {
  createCompany,
  listCompanies,
  getCompanyById,
  updateCompany,
  updateCompanyStatus,
} from "../services/company.service.js";


export const updateStatus = async (
  req,
  res,
  next,
) => {
  try {
    const { id } = req.params;

    const schema = z.object({
      status: z.enum([
        "ACTIVE",
        "SUSPENDED",
        "INACTIVE",
      ]),
    });

    const { status } = schema.parse(
      req.body,
    );

    const actorId = req.user?.id;

    if (!actorId) {
      const error = new Error(
        "User not authenticated.",
      );
      error.statusCode = 401;
      throw error;
    }

    const company =
      await updateCompanyStatus(
        id,
        status,
        actorId,
      );

    res.status(200).json({
      success: true,
      message:
        "Company status updated successfully.",
      data: {
        company,
      },
    });
  } catch (error) {
    next(error);
  }
};

const createCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      2,
      "Company name must contain at least 2 characters.",
    )
    .max(
      150,
      "Company name must not exceed 150 characters.",
    ),

  registrationNumber: z
    .string()
    .trim()
    .min(
      2,
      "Registration number is required.",
    )
    .max(
      50,
      "Registration number must not exceed 50 characters.",
    ),

  phone: z
    .string()
    .trim()
    .min(7, "Phone number is invalid.")
    .max(20, "Phone number is invalid."),

  email: z
    .string()
    .trim()
    .email("Invalid email address.")
    .optional(),

  address: z
    .string()
    .trim()
    .max(
      255,
      "Address must not exceed 255 characters.",
    )
    .optional(),
});

const listCompaniesSchema = z.object({
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
    .default(20),

  search: z
    .string()
    .trim()
    .max(100)
    .optional(),

  status: z
    .enum([
      "ACTIVE",
      "SUSPENDED",
      "INACTIVE",
    ])
    .optional(),
});

const updateCompanySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(
        2,
        "Company name must contain at least 2 characters.",
      )
      .max(
        150,
        "Company name must not exceed 150 characters.",
      )
      .optional(),

    registrationNumber: z
      .string()
      .trim()
      .min(
        2,
        "Registration number is required.",
      )
      .max(
        50,
        "Registration number must not exceed 50 characters.",
      )
      .optional(),

    phone: z
      .string()
      .trim()
      .min(7, "Phone number is invalid.")
      .max(20, "Phone number is invalid.")
      .optional(),

    email: z
      .string()
      .trim()
      .email("Invalid email address.")
      .optional(),

    address: z
      .string()
      .trim()
      .max(
        255,
        "Address must not exceed 255 characters.",
      )
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message:
        "At least one company field must be provided.",
    },
  );

export const create = async (
  req,
  res,
  next,
) => {
  try {
    const data = createCompanySchema.parse(
      req.body,
    );

    const actorId = req.user?.id;

    if (!actorId) {
      const error = new Error(
        "User not authenticated.",
      );
      error.statusCode = 401;
      throw error;
    }

    const company = await createCompany({
      ...data,
      actorId,
    });

    res.status(201).json({
      success: true,
      message: "Company created successfully.",
      data: {
        company,
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
    const query = listCompaniesSchema.parse(
      req.query,
    );

    const result = await listCompanies(query);

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



    const { id } = req.params;

    const company = await getCompanyById(id);


    res.status(200).json({
      success: true,
      data: {
        company,
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
    const { id } = req.params;

    const data = updateCompanySchema.parse(
      req.body,
    );

    const actorId = req.user?.id;

    if (!actorId) {
      const error = new Error(
        "User not authenticated.",
      );
      error.statusCode = 401;
      throw error;
    }

    const company = await updateCompany(
      id,
      data,
      actorId,
    );

    res.status(200).json({
      success: true,
      message: "Company updated successfully.",
      data: {
        company,
      },
    });
  } catch (error) {
    next(error);
  }
};
