import {
  createBooking,
  listMyBookings,
  getMyBookingById,
} from "../services/booking.service.js";
import {
  createBookingSchema,
  listBookingsSchema,
  bookingIdParamSchema,
} from "../validators/booking.validator.js";

const getCustomerId = (req) => {
  if (!req.user?.id) {
    const error = new Error("User not authenticated.");
    error.statusCode = 401;
    throw error;
  }
  return req.user.id;
};

export const create = async (req, res, next) => {
  try {
    const data = createBookingSchema.parse(req.body);
    const customerId = getCustomerId(req);

    const booking = await createBooking({
      ...data,
      customerId,
    });

    res.status(201).json({
      success: true,
      message: "Booking created and seats held.",
      data: { booking },
    });
  } catch (error) {
    if (error.unavailableSeatIds) {
      return res.status(error.statusCode || 409).json({
        success: false,
        message: error.message,
        unavailableSeatIds: error.unavailableSeatIds,
      });
    }
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const query = listBookingsSchema.parse(req.query);
    const customerId = getCustomerId(req);

    const result = await listMyBookings({ ...query, customerId });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = bookingIdParamSchema.parse(req.params);
    const customerId = getCustomerId(req);

    const booking = await getMyBookingById({ id, customerId });

    res.status(200).json({ success: true, data: { booking } });
  } catch (error) {
    next(error);
  }
};