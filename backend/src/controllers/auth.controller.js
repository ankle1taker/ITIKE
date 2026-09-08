import { z } from "zod";
import {
  registerCustomer,
  loginUser,
  getAuthenticatedUser,
} from "../services/auth.service.js";

const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must contain at least 2 characters.")
    .max(100, "Full name must not exceed 100 characters."),

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

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters.")
    .max(128, "Password must not exceed 128 characters."),
});

const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(7, "Phone number is invalid.")
    .max(20, "Phone number is invalid."),

  password: z
    .string()
    .min(1, "Password is required."),
});

export const register = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const result = await registerCustomer(data);

    res.status(201).json({
      success: true,
      message: "Customer account created successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const result = await loginUser(data);

    res.status(200).json({
      success: true,
      message: "Login successful.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};