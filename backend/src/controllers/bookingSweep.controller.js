import { sweepAllExpiredHolds } from "../services/booking.service.js";

export const sweep = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      const error = new Error("User not authenticated.");
      error.statusCode = 401;
      throw error;
    }

    const result = await sweepAllExpiredHolds({ actorId: req.user.id });

    res.status(200).json({
      success: true,
      message: "Sweep complete.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};