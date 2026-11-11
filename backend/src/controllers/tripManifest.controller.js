import { z } from "zod";
import { getTripManifest } from "../services/tripManifest.service.js";

const paramsSchema = z.object({
  tripId: z.string().uuid("Invalid trip ID."),
});

const querySchema = z.object({
  status: z
    .enum(["HELD", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "EXPIRED", "REFUNDED"])
    .default("CONFIRMED"),
});

const getCompanyId = (req) => {
  if (!req.companyId) {
    const error = new Error("Company context is required.");
    error.statusCode = 403;
    throw error;
  }
  return req.companyId;
};

export const list = async (req, res, next) => {
  try {
    const { tripId } = paramsSchema.parse(req.params);
    const query = querySchema.parse(req.query);
    const companyId = getCompanyId(req);

    const result = await getTripManifest({
      tripId,
      companyId,
      status: query.status,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};