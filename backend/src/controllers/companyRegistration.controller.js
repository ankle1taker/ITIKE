import { z } from "zod";
import { registerCompanyApplication } from "../services/companyRegistration.service.js";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Company name must contain at least 2 characters.")
    .max(150, "Company name must not exceed 150 characters."),
  registrationNumber: z
    .string()
    .trim()
    .min(3, "Registration number is required.")
    .max(50, "Registration number must not exceed 50 characters."),
  phone: z
    .string()
    .trim()
    .min(7, "Phone is invalid.")
    .max(20, "Phone is invalid."),
  email: z.string().trim().email("Invalid email.").max(100).optional(),
  address: z.string().trim().max(300).optional(),
});

export const register = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await registerCompanyApplication(data);
    res.status(201).json({
      success: true,
      message:
        "Company registration received. A platform administrator will review your application.",
      data: { company: result },
    });
  } catch (error) {
    next(error);
  }
};