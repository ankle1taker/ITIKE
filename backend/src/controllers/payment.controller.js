import {
  initiatePayment,
  handleWebhook,
  getPaymentStatusForBooking,
  pollAndReconcile,
} from "../services/payment.service.js";
import {
  initiatePaymentSchema,
  bookingIdParamSchema,
  webhookProviderParamSchema,
} from "../validators/payment.validator.js";

const getCustomerId = (req) => {
  if (!req.user?.id) {
    const error = new Error("User not authenticated.");
    error.statusCode = 401;
    throw error;
  }
  return req.user.id;
};

export const initiate = async (req, res, next) => {
  try {
    const { id } = bookingIdParamSchema.parse(req.params);
    const { provider, phoneNumber } = initiatePaymentSchema.parse(req.body);
    const customerId = getCustomerId(req);

    const result = await initiatePayment({
      bookingId: id,
      customerId,
      providerName: provider,
      phoneNumber,
    });

    res.status(201).json({
      success: true,
      message: "Payment initiated.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const status = async (req, res, next) => {
  try {
    const { id } = bookingIdParamSchema.parse(req.params);
    const customerId = getCustomerId(req);

    const result = await getPaymentStatusForBooking({
      bookingId: id,
      customerId,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const webhook = async (req, res, next) => {
  try {
    const { provider } = webhookProviderParamSchema.parse(req.params);

    // rawBody is set by the middleware in app.js — needed for signature verification
    const rawBody =
      req.rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

    const result = await handleWebhook({
      providerName: provider,
      headers: req.headers,
      rawBody,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const pollStatus = async (req, res, next) => {
  try {
    const { id } = bookingIdParamSchema.parse(req.params);
    const customerId = getCustomerId(req);

    // Confirm ownership by fetching booking first
    const lookup = await getPaymentStatusForBooking({
      bookingId: id,
      customerId,
    });
    if (!lookup.payment) {
      return res.status(404).json({
        success: false,
        message: "No payment for this booking.",
      });
    }

    const result = await pollAndReconcile({ paymentId: lookup.payment.id });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};