import { z } from "zod";
import { getPublicTripSeats } from "../services/tripSeatPublic.service.js";

const tripIdParamsSchema = z.object({
  id: z.string().uuid("Invalid trip ID."),
});

export const list = async (req, res, next) => {
  try {
    const { id } = tripIdParamsSchema.parse(req.params);
    const result = await getPublicTripSeats({ tripId: id });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};