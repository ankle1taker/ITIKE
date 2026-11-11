import { z } from "zod";
import { forceCompleteRefund } from "../services/payment.service.js";

const forceCompleteSchema = z.object({
  note: z
    .string()
    .trim()
    .max(500, "Note must not exceed 500 characters.")
    .optional(),
});

const cancellationIdParamsSchema = z.object({
  id: z.string().uuid("Invalid cancellation ID."),
});

const getActorId = (req) => {
  if (!req.user?.id) {
    const error = new Error("User not authenticated.");
    error.statusCode = 401;
    throw error;
  }
  return req.user.id;
};

export const forceComplete = async (req, res, next) => {
  try {
    const { id } = cancellationIdParamsSchema.parse(req.params);
    const data = forceCompleteSchema.parse(req.body || {});
    const actorId = getActorId(req);

    const result = await forceCompleteRefund({
      cancellationId: id,
      actorId,
      note: data.note,
    });

    res.status(200).json({
      success: true,
      message: "Refund marked as COMPLETED by admin.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};