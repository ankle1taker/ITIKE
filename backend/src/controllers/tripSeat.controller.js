import {
  initializeTripSeats,
  getTripSeats,
} from "../services/tripSeat.service.js";

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

export const initialize = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const result = await initializeTripSeats({
      tripId: req.params.id,
      companyId,
      actorId,
    });

    res.status(200).json({
      success: true,
      message: "Trip seats initialized.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const result = await getTripSeats({
      tripId: req.params.id,
      companyId,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};