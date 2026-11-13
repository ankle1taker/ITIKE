import {
  createTrip,
  listTrips,
  getTripById,
  updateTrip,
  updateTripStatus,
} from "../services/trip.service.js";
import {
  createTripSchema,
  listTripsSchema,
  updateTripSchema,
  updateTripStatusSchema,
} from "../validators/trip.validator.js";

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
    const data = createTripSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const trip = await createTrip({
      ...data,
      companyId,
      actorId,
      branchId: req.branchId || null,
    });

    res.status(201).json({
      success: true,
      message: "Trip created successfully.",
      data: { trip },
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const query = listTripsSchema.parse(req.query);
    const companyId = getCompanyId(req);

    const result = await listTrips({
      ...query,
      companyId,
      branchId: req.branchId || null,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    const trip = await getTripById({ id: req.params.id, companyId });

    res.status(200).json({ success: true, data: { trip } });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const data = updateTripSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const trip = await updateTrip({
      ...data,
      id: req.params.id,
      companyId,
      actorId,
    });

    res.status(200).json({
      success: true,
      message: "Trip updated successfully.",
      data: { trip },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { status } = updateTripStatusSchema.parse(req.body);
    const companyId = getCompanyId(req);
    const actorId = getActorId(req);

    const trip = await updateTripStatus({
      id: req.params.id,
      companyId,
      actorId,
      status,
    });

    res.status(200).json({
      success: true,
      message: "Trip status updated successfully.",
      data: { trip },
    });
  } catch (error) {
    next(error);
  }
};