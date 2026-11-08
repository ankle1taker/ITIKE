import prisma from "../src/config/database.js";
import { createBooking } from "../src/services/booking.service.js";

const main = async () => {
  console.log("=== DEBUG BOOKING ===");

  const trip = await prisma.trip.findFirst({
    where: { status: "SCHEDULED", departureTime: { gt: new Date() } },
    orderBy: { departureTime: "asc" },
    select: { id: true, status: true, departureTime: true, basePrice: true },
  });

  if (!trip) {
    console.error("NO SCHEDULED FUTURE TRIP FOUND");
    process.exit(1);
  }
  console.log("trip:", trip.id, trip.status, trip.departureTime.toISOString());

  const seat = await prisma.tripSeat.findFirst({
    where: { tripId: trip.id, status: "AVAILABLE" },
    select: { id: true, status: true, seat: { select: { seatNumber: true } } },
  });

  if (!seat) {
    console.error("NO AVAILABLE TRIP SEAT ON TRIP");
    process.exit(1);
  }
  console.log("seat:", seat.id, seat.status, seat.seat.seatNumber);

  const customer = await prisma.user.findFirst({
    where: { role: "CUSTOMER" },
    select: { id: true, fullName: true, phone: true },
  });

  if (!customer) {
    console.error("NO CUSTOMER USER IN DB — run scripts/create-... or register via API once");
    process.exit(1);
  }
  console.log("customer:", customer.id, customer.fullName);

  console.log("--- invoking createBooking ---");
  try {
    const b = await createBooking({
      customerId: customer.id,
      tripId: trip.id,
      seatIds: [seat.id],
      passengers: [{ fullName: "Debug Alice", phone: "0788000001" }],
      dropoffStopId: null,
    });
    console.log("=== SUCCESS ===");
    console.log("bookingNumber:", b.bookingNumber);
    console.log("bookingId:", b.id);
    console.log("status:", b.status);
    console.log("totalAmount:", b.totalAmount);
    console.log("seatCount:", b.bookingSeat.length);
  } catch (e) {
    console.error("=== ERROR ===");
    console.error("name:", e.name);
    console.error("code:", e.code);
    console.error("message:", e.message);
    console.error("meta:", JSON.stringify(e.meta, null, 2));
    console.error("stack:", e.stack);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});