import {
  cancelBooking,
  getCompanyPolicy,
  upsertCompanyPolicy,
} from "../services/cancellation.service.js";
import {
  cancelBookingSchema,
  cancelBookingParamsSchema,
  upsertPolicySchema,
} from "../validators/cancellation.validator.js";

const getCustomerId = (req) => {
  if (!req.user?.id) {
    const error = new Error("User not authenticated.");
    error.statusCode = 401;
    throw error;
  }
  return req.user.id;
};

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

export const cancel = async (req, res, next) => {
  try {
    const { id } = cancelBookingParamsSchema.parse(req.params);
    const data = cancelBookingSchema.parse(req.body || {});
    const customerId = getCustomerId(req);

    const result = await cancelBooking({
      bookingId: id,
      customerId,
      reason: data.reason,
    });

    res.status(200).json({
      success: true,
      message: "Booking cancelled and refund issued.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPolicy = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const policy = await getCompanyPolicy({ companyId });
    res.status(200).json({ success: true, data: { policy } });
  } catch (error) {
    next(error);
  }
};

export const updatePolicy = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);
    const data = upsertPolicySchema.parse(req.body);

    const policy = await upsertCompanyPolicy({
      companyId,
      actorId,
      ...data,
    });

    res.status(200).json({
      success: true,
      message: "Cancellation policy updated.",
      data: { policy },
    });
  } catch (error) {
    next(error);
  }
};