/**
 * Centralised configuration. Everything that reads environment variables
 * or holds magic strings goes here.
 */

export const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  backendApiUrl: process.env.BACKEND_API_URL || "http://localhost:5000",
  sessionCookieName: "itike_session",
  sessionMaxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
} as const;

export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  search: "/search",
  tripDetail: (tripId: string) => `/trips/${tripId}`,
  checkout: (bookingId: string) => `/checkout/${bookingId}`,
  payment: (bookingId: string) => `/payment/${bookingId}`,
  ticket: (bookingId: string) => `/ticket/${bookingId}`,
  account: "/account",
  bookings: "/account/bookings",
  profile: "/account/profile",
  company: {
    dashboard: "/company/dashboard",
    branches: "/company/branches",
    buses: "/company/buses",
    trips: "/company/trips",
    bookings: "/company/bookings",
    manifests: "/company/manifests",
    checkIn: "/company/check-in",
    staff: "/company/staff",
  },
  admin: {
    dashboard: "/admin/dashboard",
  },
} as const;

export type UserRole =
  | "CUSTOMER"
  | "COMPANY_ADMIN"
  | "COMPANY_OPERATOR"
  | "PLATFORM_ADMIN";

export const postLoginRedirect: Record<UserRole, string> = {
  CUSTOMER: routes.search,
  COMPANY_ADMIN: routes.company.dashboard,
  COMPANY_OPERATOR: routes.company.dashboard,
  PLATFORM_ADMIN: routes.admin.dashboard,
};