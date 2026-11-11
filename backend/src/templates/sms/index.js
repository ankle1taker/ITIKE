/**
 * SMS templates. Each function returns the SMS text as a string.
 * Keep under 160 chars where possible (single SMS) â€” multi-part SMS costs more.
 */

export const templates = {
  BOOKING_CREATED: ({ bookingNumber, totalAmount, expiresInMinutes }) =>
    `Itike: Booking ${bookingNumber} created. Total ${totalAmount} RWF. Complete payment within ${expiresInMinutes} min.`,

  PAYMENT_SUCCEEDED: ({ bookingNumber, amount }) =>
    `Itike: Payment of ${amount} RWF received for booking ${bookingNumber}. Your ticket is being issued.`,

  PAYMENT_FAILED: ({ bookingNumber }) =>
    `Itike: Payment for booking ${bookingNumber} failed. Please retry within 10 min or your seat will be released.`,

  TICKET_ISSUED: ({ bookingNumber, ticketNumber, route, departureTime }) =>
    `Itike: Your ticket is ready. Booking ${bookingNumber}, ticket ${ticketNumber}. ${route}, depart ${departureTime}. Show this SMS or open the app.`,

  BOOKING_CANCELLED: ({ bookingNumber, refundAmount }) =>
    `Itike: Booking ${bookingNumber} cancelled. Refund of ${refundAmount} RWF is being processed.`,
};

export const renderTemplate = (template, data) => {
  const fn = templates[template];
  if (!fn) {
    throw new Error(`Unknown SMS template: ${template}`);
  }
  return fn(data);
};