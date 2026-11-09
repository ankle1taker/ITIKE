import { checkInTicket } from "../services/checkIn.service.js";
import { checkInParamsSchema } from "../validators/checkIn.validator.js";

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

export const checkIn = async (req, res, next) => {
  try {
    const { ticketNumber } = checkInParamsSchema.parse(req.params);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const result = await checkInTicket({ ticketNumber, companyId, actorId });

    res.status(200).json({
      success: true,
      message: "Ticket checked in.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};