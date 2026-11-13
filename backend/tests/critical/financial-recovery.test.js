import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { api, loginAsCompanyAdmin } from "../helpers/api.js";
import {
  createCustomerAndBook,
  getAvailableTrip,
  getSeedBusId,
  mockWebhook,
} from "../helpers/fixtures.js";
import { __test__ as mockTest } from "../../src/services/payments/mock.provider.js";
import { pollAndReconcile, refundPayment } from "../../src/services/payment.service.js";
import prisma from "../../src/config/database.js";

describe("Financial recovery", () => {
  let adminToken;
  let activeBusId;
  let routeId;

  beforeAll(async () => {
    adminToken = await loginAsCompanyAdmin();
    activeBusId = await getSeedBusId(adminToken);
    const trips = await api("/api/company/trips", { token: adminToken });
    routeId = trips.body.data.trips[0]?.route.id;
    if (!routeId) throw new Error("No existing route — create one first");
  });

  beforeEach(() => {
    mockTest.clear();
  });

  async function createConfirmedBooking(prefix, daysAhead) {
    const tripId = await getAvailableTrip(adminToken, activeBusId, routeId, daysAhead);
    const booking = await createCustomerAndBook({ adminToken, tripId, prefix });
    const pay = await api(`/api/customer/bookings/${booking.bookingId}/pay`, {
      method: "POST",
      token: booking.customerToken,
      body: { provider: "mock", phoneNumber: booking.customerPhone },
    });
    if (pay.status !== 201) {
      throw new Error(`pay failed: ${pay.status} ${JSON.stringify(pay.body)}`);
    }
    await mockWebhook(pay.body.data.providerReference, "SUCCESS", 3000);
    await new Promise((r) => setTimeout(r, 400));
    return { ...booking, providerReference: pay.body.data.providerReference };
  }

  it("duplicate webhook is a noop (no double-confirm, no double-ticket)", async () => {
    const b = await createConfirmedBooking("dup-webhook", 400);

    const before = await api(`/api/customer/bookings/${b.bookingId}`, {
      token: b.customerToken,
    });
    expect(before.body.data.booking.status).toBe("CONFIRMED");
    const paidAtBefore = before.body.data.booking.payments[0].paidAt;

    const second = await mockWebhook(b.providerReference, "SUCCESS", 3000);
    expect(second.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 300));

    const after = await prisma.booking.findUnique({
      where: { id: b.bookingId },
      include: { payments: true, ticket: true },
    });
    expect(after.status).toBe("CONFIRMED");
    expect(after.payments.length).toBe(1);
    expect(after.payments[0].status).toBe("SUCCESS");
    expect(after.payments[0].paidAt.toISOString()).toBe(
      new Date(paidAtBefore).toISOString(),
    );
    expect(after.ticket).not.toBeNull();
  });

  it("invalid webhook signature is rejected with 401 and no state change", async () => {
    const tripId = await getAvailableTrip(adminToken, activeBusId, routeId, 401);
    const booking = await createCustomerAndBook({ adminToken, tripId, prefix: "bad-sig" });
    const pay = await api(`/api/customer/bookings/${booking.bookingId}/pay`, {
      method: "POST",
      token: booking.customerToken,
      body: { provider: "mock", phoneNumber: booking.customerPhone },
    });
    expect(pay.status).toBe(201);
    const providerReference = pay.body.data.providerReference;

    const res = await fetch(
      `${process.env.TEST_BASE_URL || "http://localhost:5000"}/api/webhooks/mock`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mock-signature": "WRONG-SIGNATURE",
        },
        body: JSON.stringify({ providerReference, status: "SUCCESS", amount: 3000 }),
      },
    );
    expect(res.status).toBe(401);

    const after = await prisma.booking.findUnique({
      where: { id: booking.bookingId },
      include: { payments: true, ticket: true },
    });
    expect(after.status).toBe("PENDING_PAYMENT");
    expect(after.payments[0].status).toBe("PENDING");
    expect(after.ticket).toBeNull();
  });

  it("payment after booking expiry triggers auto-refund (F6/F9)", async () => {
    const tripId = await getAvailableTrip(adminToken, activeBusId, routeId, 402);
    const booking = await createCustomerAndBook({ adminToken, tripId, prefix: "late-pay" });
    const pay = await api(`/api/customer/bookings/${booking.bookingId}/pay`, {
      method: "POST",
      token: booking.customerToken,
      body: { provider: "mock", phoneNumber: booking.customerPhone },
    });
    expect(pay.status).toBe(201);
    const providerReference = pay.body.data.providerReference;

    await prisma.booking.update({
      where: { id: booking.bookingId },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    });

    await prisma.tripSeat.updateMany({
      where: { bookingSeats: { some: { bookingId: booking.bookingId } } },
      data: { status: "AVAILABLE" },
    });
    await prisma.bookingHold.updateMany({
      where: { bookingId: booking.bookingId, status: "ACTIVE" },
      data: { status: "EXPIRED", releasedAt: new Date() },
    });

    await mockWebhook(providerReference, "SUCCESS", 3000);
    await new Promise((r) => setTimeout(r, 1000));

    const after = await prisma.booking.findUnique({
      where: { id: booking.bookingId },
      include: { payments: true, cancellation: true },
    });
    expect(after.status).toBe("CANCELLED");
    const paymentStatuses = after.payments.map((p) => p.status);
    expect(
      paymentStatuses.includes("REFUNDED") || paymentStatuses.includes("SUCCESS"),
    ).toBe(true);
    expect(after.cancellation).not.toBeNull();
    expect(["COMPLETED", "PROCESSING"]).toContain(after.cancellation.status);
  });

  it("refund provider fails once, retry succeeds (transient error recovery)", async () => {
    // Set up: confirmed booking with a SUCCESS payment
    const b = await createConfirmedBooking("refund-retry", 403);

    // Get the payment record
    const payment = await prisma.payment.findFirst({
      where: { bookingId: b.bookingId, status: "SUCCESS" },
      select: { id: true },
    });
    expect(payment).not.toBeNull();

    // Inject: next refund call will throw
    mockTest.failNextRefund(1);

    // Attempt 1: refundPayment should throw (provider error)
    let error1 = null;
    try {
      await refundPayment({
        paymentId: payment.id,
        reason: "test transient refund failure",
        triggeredBy: "customer_cancel",
      });
    } catch (err) {
      error1 = err;
    }
    expect(error1).not.toBeNull();
    expect(error1.message).toMatch(/refund failed/i);

    // Verify: Payment still SUCCESS, Cancellation is REJECTED
    const after1 = await prisma.booking.findUnique({
      where: { id: b.bookingId },
      include: { payments: true, cancellation: true },
    });
    expect(after1.status).toBe("CONFIRMED");
    expect(after1.payments[0].status).toBe("SUCCESS");
    expect(after1.cancellation).not.toBeNull();
    expect(after1.cancellation.status).toBe("REJECTED");

    // Attempt 2: retry should succeed
    const result2 = await refundPayment({
      paymentId: payment.id,
      reason: "retry after transient failure",
      triggeredBy: "customer_cancel",
    });
    expect(result2.status).toBe("REFUNDED");

    // Verify: Payment REFUNDED, Cancellation COMPLETED, Booking CANCELLED
    const after2 = await prisma.booking.findUnique({
      where: { id: b.bookingId },
      include: { payments: true, cancellation: true },
    });
    expect(after2.status).toBe("CANCELLED");
    expect(after2.payments[0].status).toBe("REFUNDED");
    expect(after2.cancellation.status).toBe("COMPLETED");
  });

  it("reconciler recovers late success (FAILED → SUCCESS)", async () => {
    const tripId = await getAvailableTrip(adminToken, activeBusId, routeId, 404);
    const booking = await createCustomerAndBook({ adminToken, tripId, prefix: "late-success" });
    const pay = await api(`/api/customer/bookings/${booking.bookingId}/pay`, {
      method: "POST",
      token: booking.customerToken,
      body: { provider: "mock", phoneNumber: booking.customerPhone },
    });
    expect(pay.status).toBe(201);
    const providerReference = pay.body.data.providerReference;

    await mockWebhook(providerReference, "FAILED", 3000);
    await new Promise((r) => setTimeout(r, 400));

    const failedPayment = await prisma.payment.findFirst({
      where: { providerReference },
      select: { id: true, status: true },
    });
    expect(failedPayment.status).toBe("FAILED");

    mockTest.setNextPollStatus(providerReference, "SUCCESS");

    await pollAndReconcile({ paymentId: failedPayment.id });
    await new Promise((r) => setTimeout(r, 800));

    const after = await prisma.booking.findUnique({
      where: { id: booking.bookingId },
      include: { payments: true, ticket: true },
    });
    expect(after.status).toBe("CONFIRMED");
    const finalPayment = after.payments.find(
      (p) => p.providerReference === providerReference,
    );
    expect(finalPayment.status).toBe("SUCCESS");
    expect(after.ticket).not.toBeNull();
  });
});