import prisma from "../config/database.js";
import { getProvider } from "./notifications/index.js";
import { renderTemplate } from "../templates/sms/index.js";

const MAX_ATTEMPTS = 3;

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Queue a notification. Creates a PENDING record. The dispatcher will pick it up
 * and send it within ~30 seconds. Callers should not await this â€” notifications
 * should never block the primary request.
 */
export const queueNotification = async ({
  recipientId = null,
  recipientPhone = null,
  recipientEmail = null,
  channel = "SMS",
  template,
  payload = {},
}) => {
  if (channel === "SMS" && !recipientPhone) {
    throw createError("recipientPhone required for SMS notification.", 400);
  }
  if (channel === "EMAIL" && !recipientEmail) {
    throw createError("recipientEmail required for EMAIL notification.", 400);
  }

  return prisma.notification.create({
    data: {
      recipientId,
      recipientPhone,
      recipientEmail,
      channel,
      template,
      payload,
      status: "PENDING",
    },
  });
};

/**
 * Process a single notification. Called by the dispatcher.
 * Returns { status, noop? }.
 */
export const processNotification = async (notificationId) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notification) {
    throw createError("Notification not found.", 404);
  }
  if (notification.status === "SENT") {
    return { status: "SENT", noop: true };
  }
  if (notification.attempts >= MAX_ATTEMPTS) {
    return { status: "FAILED", noop: true, reason: "max attempts reached" };
  }

  const provider = getProvider();

  let result;
  try {
    if (notification.channel === "SMS") {
      const message = renderTemplate(notification.template, notification.payload || {});
      result = await provider.sendSms({
        to: notification.recipientPhone,
        message,
      });
    } else if (notification.channel === "EMAIL") {
      const subjectMap = {
        BOOKING_CREATED: "Your Itike booking",
        PAYMENT_SUCCEEDED: "Itike payment received",
        TICKET_ISSUED: "Your Itike ticket",
        BOOKING_CANCELLED: "Itike booking cancelled",
        PAYMENT_FAILED: "Itike payment failed",
      };
      const subject = subjectMap[notification.template] || "Itike notification";
      const textBody = renderTemplate(notification.template, notification.payload || {});

      result = await provider.sendEmail({
        to: notification.recipientEmail,
        subject,
        textBody,
      });

      if (!result.supported) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: "FAILED",
            attempts: { increment: 1 },
            failureReason: "Provider does not support email",
          },
        });
        return { status: "FAILED", reason: "email not supported" };
      }
    } else {
      throw new Error(`Unknown channel: ${notification.channel}`);
    }
  } catch (err) {
    const newAttempts = notification.attempts + 1;
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: newAttempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
        attempts: newAttempts,
        failureReason: err.message || "Provider error",
      },
    });
    return { status: newAttempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING", reason: err.message };
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: "SENT",
      attempts: { increment: 1 },
      sentAt: new Date(),
      providerReference: result.providerReference || null,
      failureReason: null,
    },
  });

  return { status: "SENT", providerReference: result.providerReference };
};