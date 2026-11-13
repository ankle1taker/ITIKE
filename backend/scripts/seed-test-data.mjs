import "dotenv/config";
import prisma from "../src/config/database.js";

const log = (...a) => console.log("[seed]", ...a);

// Fixed identifiers so re-running this script is safe
const COMPANY_ID = "bfef69b1-f23f-4a9c-b390-d81a5d0d85bb";
const ROUTE_ID = "0529bd75-80b7-439f-afe2-d7f1b201d8c5";

async function main() {
  // 1. Verify company + route exist
  const company = await prisma.company.findUnique({
    where: { id: COMPANY_ID },
    select: { id: true, name: true },
  });
  if (!company) {
    throw new Error(`Company ${COMPANY_ID} not found. Create it first.`);
  }
  log("company:", company.name);

  const route = await prisma.route.findUnique({
    where: { id: ROUTE_ID },
    select: { id: true, origin: true, destination: true },
  });
  if (!route) {
    throw new Error(`Route ${ROUTE_ID} not found. Create it first.`);
  }
  log("route:", `${route.origin} → ${route.destination}`);

  // 2. Ensure a branch exists (Main Branch)
  let branch = await prisma.branch.findFirst({
    where: { companyId: COMPANY_ID, code: "MAIN" },
    select: { id: true, name: true },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        companyId: COMPANY_ID,
        name: "Main Branch",
        code: "MAIN",
        isDefault: true,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    log("branch created:", branch.name, branch.id);
  } else {
    log("branch exists:", branch.name, branch.id);
  }

  // 3. Ensure a test bus exists
  let bus = await prisma.bus.findFirst({
    where: { companyId: COMPANY_ID, registrationNumber: "RAB 001 B" },
    select: { id: true, registrationNumber: true, branchId: true },
  });
  if (!bus) {
    bus = await prisma.bus.create({
      data: {
        companyId: COMPANY_ID,
        branchId: branch.id,
        registrationNumber: "RAB 001 B",
        busType: "Coach",
        capacity: 50,
        status: "ACTIVE",
      },
      select: { id: true, registrationNumber: true, branchId: true },
    });
    log("bus created:", bus.registrationNumber, bus.id);
  } else {
    log("bus exists:", bus.registrationNumber, bus.id);
  }

  // 4. Ensure 8 active seats on the bus (tests need ≥4 available seats)
  const seatCount = await prisma.seat.count({
    where: { busId: bus.id, status: "ACTIVE" },
  });
  if (seatCount < 8) {
    const needed = 8 - seatCount;
    log(`creating ${needed} seats (had ${seatCount})`);
    for (let i = 1; i <= needed; i++) {
      const seatNumber = `S${String(seatCount + i).padStart(3, "0")}`;
      await prisma.seat.create({
        data: {
          busId: bus.id,
          seatNumber,
          rowNumber: Math.ceil((seatCount + i) / 4),
          columnNumber: ((seatCount + i - 1) % 4) + 1,
          floorNumber: 1,
          seatType: "REGULAR",
          status: "ACTIVE",
          isBookable: true,
        },
      });
    }
    log(`seats now: ${await prisma.seat.count({ where: { busId: bus.id, status: "ACTIVE" } })}`);
  } else {
    log(`seats: ${seatCount} (ok)`);
  }

  // 5. Ensure at least one SCHEDULED trip exists (tests read trips[0].route.id)
  const existingTrip = await prisma.trip.findFirst({
    where: { companyId: COMPANY_ID, status: "SCHEDULED" },
    select: { id: true, departureTime: true },
  });
  if (!existingTrip) {
    // Schedule a trip far in the future to avoid overlap with test-generated trips
    const departure = new Date();
    departure.setDate(departure.getDate() + 90);
    departure.setHours(10, 0, 0, 0);
    const arrival = new Date(departure);
    arrival.setHours(13, 0, 0, 0);

    const trip = await prisma.trip.create({
      data: {
        companyId: COMPANY_ID,
        branchId: branch.id,
        routeId: ROUTE_ID,
        busId: bus.id,
        departureTime: departure,
        arrivalTime: arrival,
        basePrice: 3000,
        status: "SCHEDULED",
      },
      select: { id: true, departureTime: true },
    });
    log("trip created:", trip.id, trip.departureTime.toISOString());

    // Initialize TripSeat rows for this trip (needed for seat availability)
    const seats = await prisma.seat.findMany({
      where: { busId: bus.id, status: "ACTIVE" },
      select: { id: true },
    });
    for (const seat of seats) {
      await prisma.tripSeat.create({
        data: {
          tripId: trip.id,
          seatId: seat.id,
          status: "AVAILABLE",
        },
      });
    }
    log(`trip seats initialized: ${seats.length}`);
  } else {
    log("trip exists:", existingTrip.id, existingTrip.departureTime.toISOString());
  }

  log("done.");
}

try {
  await main();
} catch (err) {
  console.error("[seed] FAILED:", err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}