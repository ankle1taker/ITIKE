import prisma from "../config/database.js";

const validateCompanyId = (companyId) => {
  if (!companyId || typeof companyId !== "string") {
    const error = new Error("Company ID is required.");
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Company analytics overview.
 *
 * Aggregates across all of this company's trips:
 *   - total trips (scheduled, active)
 *   - total bookings (CONFIRMED status only, all-time and this month)
 *   - total revenue (sum of SUCCESS payments)
 *   - average occupancy per trip
 *   - top routes by booking count
 *   - last 30 days trend
 */
export const getCompanyAnalytics = async ({ companyId }) => {
  validateCompanyId(companyId);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalTrips,
    upcomingTrips,
    totalBookingsAllTime,
    bookingsThisMonth,
    revenueResult,
    totalSeatsBooked,
    topRoutes,
  ] = await Promise.all([
    prisma.trip.count({ where: { companyId } }),
    prisma.trip.count({
      where: {
        companyId,
        status: { in: ["SCHEDULED", "BOARDING", "DELAYED"] },
        departureTime: { gt: now },
      },
    }),
    prisma.booking.count({
      where: {
        trip: { companyId },
        status: "CONFIRMED",
      },
    }),
    prisma.booking.count({
      where: {
        trip: { companyId },
        status: "CONFIRMED",
        createdAt: { gte: monthStart },
      },
    }),
    prisma.payment.aggregate({
      where: {
        status: "SUCCESS",
        booking: { trip: { companyId } },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.bookingSeat.count({
      where: {
        booking: {
          trip: { companyId },
          status: "CONFIRMED",
        },
      },
    }),
    prisma.booking.groupBy({
      by: ["tripId"],
      where: {
        trip: { companyId },
        status: "CONFIRMED",
      },
      _count: { _all: true },
      orderBy: { _count: { tripId: "desc" } },
      take: 5,
    }),
  ]);

  // Enrich topRoutes with route info
  const tripIds = topRoutes.map((t) => t.tripId);
  const tripsWithRoute = tripIds.length
    ? await prisma.trip.findMany({
        where: { id: { in: tripIds } },
        select: {
          id: true,
          route: { select: { origin: true, destination: true } },
        },
      })
    : [];
  const tripRouteMap = Object.fromEntries(
    tripsWithRoute.map((t) => [t.id, t.route]),
  );

  const topRoutesDetailed = topRoutes.map((t) => {
    const route = tripRouteMap[t.tripId] || { origin: "?", destination: "?" };
    return {
      route: `${route.origin} → ${route.destination}`,
      bookings: t._count._all,
    };
  });

  // Last 30 days trend — bookings by day
  const recentBookings = await prisma.booking.findMany({
    where: {
      trip: { companyId },
      status: "CONFIRMED",
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { createdAt: true },
  });
  const dailyMap = {};
  for (const b of recentBookings) {
    const day = b.createdAt.toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  }
  const bookingsTrend = Object.entries(dailyMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const revenueAllTime = Number(revenueResult._sum.amount || 0);

  // Average occupancy: total seats on active trips vs total seats booked
  const activeTripsSeats = await prisma.tripSeat.count({
    where: {
      trip: { companyId },
    },
  });
  const occupancyPct =
    activeTripsSeats > 0
      ? Math.round((totalSeatsBooked / activeTripsSeats) * 10000) / 100
      : 0;

  return {
    trips: {
      total: totalTrips,
      upcoming: upcomingTrips,
    },
    bookings: {
      allTime: totalBookingsAllTime,
      thisMonth: bookingsThisMonth,
    },
    revenue: {
      total: revenueAllTime,
      currency: "RWF",
      paymentCount: revenueResult._count.id,
    },
    occupancy: {
      percent: occupancyPct,
      seatsBooked: totalSeatsBooked,
      seatsTotal: activeTripsSeats,
    },
    topRoutes: topRoutesDetailed,
    bookingsTrend,
  };
};

/**
 * Platform-wide analytics overview.
 */
export const getPlatformAnalytics = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalCompanies,
    activeCompanies,
    totalUsers,
    totalTrips,
    upcomingTrips,
    totalBookings,
    bookingsThisMonth,
    revenueResult,
    totalTicketsIssued,
    totalTicketsUsed,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.trip.count(),
    prisma.trip.count({
      where: {
        status: { in: ["SCHEDULED", "BOARDING", "DELAYED"] },
        departureTime: { gt: now },
      },
    }),
    prisma.booking.count({ where: { status: "CONFIRMED" } }),
    prisma.booking.count({
      where: {
        status: "CONFIRMED",
        createdAt: { gte: monthStart },
      },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.ticket.count(),
    prisma.ticket.count({ where: { status: "USED" } }),
  ]);

  return {
    companies: {
      total: totalCompanies,
      active: activeCompanies,
    },
    users: {
      total: totalUsers,
    },
    trips: {
      total: totalTrips,
      upcoming: upcomingTrips,
    },
    bookings: {
      allTime: totalBookings,
      thisMonth: bookingsThisMonth,
    },
    revenue: {
      total: Number(revenueResult._sum.amount || 0),
      currency: "RWF",
      paymentCount: revenueResult._count.id,
    },
    tickets: {
      issued: totalTicketsIssued,
      used: totalTicketsUsed,
      usageRatePct:
        totalTicketsIssued > 0
          ? Math.round((totalTicketsUsed / totalTicketsIssued) * 10000) / 100
          : 0,
    },
  };
};