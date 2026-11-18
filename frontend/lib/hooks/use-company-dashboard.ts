"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

// Matches backend GET /api/company/analytics/overview
export interface AnalyticsOverview {
  trips: { total: number; upcoming: number };
  bookings: { allTime: number; thisMonth: number };
  revenue: { total: number; currency: string; paymentCount: number };
  occupancy: { percent: number; seatsBooked: number; seatsTotal: number };
}

// Matches backend GET /api/company/trips (subset)
export interface TripSummary {
  id: string;
  departureTime: string;
  arrivalTime: string | null;
  status: string;
  route: {
    id: string;
    origin: string;
    destination: string;
  };
  bus: {
    id: string;
    registrationNumber: string;
    capacity: number;
    branchId: string;
  };
  _count: {
    bookings: number;
  };
}

export interface TripsResponse {
  trips: TripSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function useCompanyDashboard() {
  const analytics = useQuery({
    queryKey: ["company-analytics"],
    queryFn: () =>
      api.get<AnalyticsOverview>("/api/backend/company/analytics/overview"),
  });

  const upcomingTrips = useQuery({
    queryKey: ["company-trips-upcoming"],
    queryFn: () =>
      api.get<TripsResponse>(
        "/api/backend/company/trips?status=SCHEDULED&limit=4",
      ),
  });

  return { analytics, upcomingTrips };
}