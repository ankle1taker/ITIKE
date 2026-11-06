import {
  searchTrips,
  getPublicTripById,
} from "../services/tripSearch.service.js";
import {
  searchTripsSchema,
  tripIdParamSchema,
} from "../validators/tripSearch.validator.js";

export const search = async (req, res, next) => {
  try {
    const query = searchTripsSchema.parse(req.query);
    const result = await searchTrips(query);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const detail = async (req, res, next) => {
  try {
    const { id } = tripIdParamSchema.parse(req.params);
    const trip = await getPublicTripById({ id });

    res.status(200).json({ success: true, data: { trip } });
  } catch (error) {
    next(error);
  }
};