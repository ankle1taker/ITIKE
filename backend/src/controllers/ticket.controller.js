import {
  verifyQrCode,
  getTicketForBooking,
  listMyTickets,
} from "../services/ticket.service.js";
import {
  verifyQrSchema,
  ticketBookingIdParamSchema,
  listTicketsSchema,
} from "../validators/ticket.validator.js";

const getCustomerId = (req) => {
  if (!req.user?.id) {
    const error = new Error("User not authenticated.");
    error.statusCode = 401;
    throw error;
  }
  return req.user.id;
};

export const verify = async (req, res, next) => {
  try {
    const { qrCode } = verifyQrSchema.parse(req.body);
    const result = await verifyQrCode({ qrCode });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getForBooking = async (req, res, next) => {
  try {
    const { id } = ticketBookingIdParamSchema.parse(req.params);
    const customerId = getCustomerId(req);
    const ticket = await getTicketForBooking({ bookingId: id, customerId });
    res.status(200).json({ success: true, data: { ticket } });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const query = listTicketsSchema.parse(req.query);
    const customerId = getCustomerId(req);
    const result = await listMyTickets({ ...query, customerId });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};