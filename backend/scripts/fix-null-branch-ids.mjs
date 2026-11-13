import "dotenv/config";
import prisma from "../src/config/database.js";

const log = (...a) => console.log("[fix]", ...a);

async function main() {
  // Backfill Trip.branchId from its bus's branch
  const nullTrips = await prisma.trip.findMany({
    where: { branchId: null },
    select: { id: true, busId: true, companyId: true },
  });
  log(`null trips: ${nullTrips.length}`);

  for (const trip of nullTrips) {
    const bus = await prisma.bus.findUnique({
      where: { id: trip.busId },
      select: { branchId: true },
    });
    if (bus?.branchId) {
      await prisma.trip.update({
        where: { id: trip.id },
        data: { branchId: bus.branchId },
      });
      log(`trip ${trip.id} → branch ${bus.branchId}`);
    } else {
      // Fallback: use company's Main Branch
      const main = await prisma.branch.findFirst({
        where: { companyId: trip.companyId, code: "MAIN" },
        select: { id: true },
      });
      if (main) {
        await prisma.trip.update({
          where: { id: trip.id },
          data: { branchId: main.id },
        });
        log(`trip ${trip.id} → fallback MAIN ${main.id}`);
      } else {
        log(`WARN: no branch for trip ${trip.id} (company ${trip.companyId})`);
      }
    }
  }

  // Backfill Bus.branchId from company's Main Branch (should be 0, defensive)
  const nullBuses = await prisma.bus.findMany({
    where: { branchId: null },
    select: { id: true, companyId: true },
  });
  log(`null buses: ${nullBuses.length}`);
  for (const bus of nullBuses) {
    const main = await prisma.branch.findFirst({
      where: { companyId: bus.companyId, code: "MAIN" },
      select: { id: true },
    });
    if (main) {
      await prisma.bus.update({
        where: { id: bus.id },
        data: { branchId: main.id },
      });
      log(`bus ${bus.id} → MAIN ${main.id}`);
    } else {
      log(`WARN: no MAIN branch for bus ${bus.id} (company ${bus.companyId})`);
    }
  }

  // Final verify
  const remainingTrips = await prisma.trip.count({ where: { branchId: null } });
  const remainingBuses = await prisma.bus.count({ where: { branchId: null } });
  log(`remaining null trips: ${remainingTrips}, null buses: ${remainingBuses}`);
  log("done.");
}

try {
  await main();
} catch (err) {
  console.error("[fix] FAILED:", err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}