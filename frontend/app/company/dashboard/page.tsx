"use client";

import {
  useCompanyDashboard,
  type TripSummary,
} from "@/lib/hooks/use-company-dashboard";
import {
  Bus,
  CalendarDays,
  ClipboardList,
  Users,
  BarChart3,
  Headphones,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export default function DashboardPage() {
  const { analytics, upcomingTrips } = useCompanyDashboard();

  if (analytics.isLoading || upcomingTrips.isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const data = analytics.data ?? {
    trips: { total: 0, upcoming: 0 },
    bookings: { allTime: 0, thisMonth: 0 },
    revenue: { total: 0, currency: "RWF", paymentCount: 0 },
    occupancy: { percent: 0, seatsBooked: 0, seatsTotal: 0 },
  };

  const trips: TripSummary[] = upcomingTrips.data?.trips ?? [];

  return (
    <div className="space-y-6 pb-10">
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 text-white p-8 md:p-10 flex flex-col md:flex-row justify-between items-center h-64 md:h-56 shadow-lg">
        <div className="relative z-10 md:max-w-lg">
          <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
          <p className="text-slate-300">
            Here is what is happening with your transport company today.
          </p>
        </div>
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Bus className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Trips</p>
            <p className="text-2xl font-bold text-slate-900">
              {data.trips.total}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CalendarDays className="h-7 w-7 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Upcoming Trips</p>
            <p className="text-2xl font-bold text-slate-900">
              {data.trips.upcoming}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
            <ClipboardList className="h-7 w-7 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Bookings</p>
            <p className="text-2xl font-bold text-slate-900">
              {data.bookings.allTime}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <Users className="h-7 w-7 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Occupancy</p>
            <p className="text-2xl font-bold text-slate-900">
              {data.occupancy.percent}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" /> Revenue Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-72 flex flex-col items-center justify-center text-slate-500">
            <p className="text-4xl font-bold text-slate-900 mb-2">
              {data.revenue.total.toLocaleString()} RWF
            </p>
            <p>Total Revenue from {data.revenue.paymentCount} payments</p>
            <p className="text-xs text-slate-400 mt-4">
              (Chart visualization coming in a future update)
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Bus className="h-5 w-5 text-blue-600" /> Upcoming Trips
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {trips.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No upcoming trips found.
              </div>
            ) : (
              <div className="divide-y">
                {trips.map((trip) => (
                  <div
                    key={trip.id}
                    className="p-4 flex items-center justify-between text-sm hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {trip.route.origin} → {trip.route.destination}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {format(new Date(trip.departureTime), "MMM d, HH:mm")} •{" "}
                        {trip.bus.registrationNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {trip._count.bookings} / {trip.bus.capacity}
                      </p>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1 bg-blue-100 text-blue-700">
                        Seats
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" /> Recent
              Bookings
            </CardTitle>
          </CardHeader>
          <div className="p-6 text-center text-sm text-slate-500">
            Booking list will appear here once we implement the bookings
            endpoint.
          </div>
        </Card>

        <div className="bg-[#EFF6FF] rounded-xl border border-blue-100 p-6 flex flex-col justify-center relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Need Help?
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Our support team is available 24/7 to assist you.
            </p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-blue-700">
              <Headphones className="h-4 w-4" /> Contact Support
            </button>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10">
            <Headphones className="h-32 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}