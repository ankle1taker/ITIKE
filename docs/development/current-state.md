# Itike Current Development State

Last updated: 2026-09-9

## Project

Itike is a professional bus ticket reservation platform initially targeting Rwanda.

Repository:

`C:\Users\__HIRWA__\Desktop\itike`

---

# Current Git State

Latest successful checkpoint:

`d84919a feat: add company tenant isolation`

Previous important checkpoints:

- `31c2d1c feat: add authentication and role authorization`
- `3888020 feat: connect backend to PostgreSQL with Prisma`
- `a4e38e4 chore: stabilize backend with Prisma 7 and PostgreSQL`
- `c3b1eb1 chore: ignore dependencies`
- `1bb5d62 feat: add initial backend API`

The working tree was clean at the last checkpoint.

---

# Technology

Backend:

- Node.js
- Express 5
- Prisma 7.10.x
- PostgreSQL
- JWT
- bcryptjs
- Zod
- pg
- @prisma/adapter-pg

Frontend has not yet been developed into the production application.

---

# Database

PostgreSQL database:

`itike_db`

Database server:

local PostgreSQL

Prisma reports:

`Database schema is up to date.`

There are currently two migrations.

The current Prisma schema contains the core Itike domain models including:

- Company
- User
- Bus
- Seat
- Route
- RouteStop
- Trip
- TripSeat
- Booking
- BookingPassenger
- BookingSeat
- BookingHold
- Payment
- Ticket
- CancellationPolicy
- Cancellation
- AuditLog

---

# Authentication Status

Implemented:

- customer registration
- login
- JWT access tokens
- `/api/auth/me`
- authentication middleware
- role authorization middleware
- company tenant middleware

Verified:

- valid login
- valid JWT
- `/me` with valid token
- `/me` without token
- `/me` with invalid token
- incorrect password
- role authorization
- CUSTOMER blocked from PLATFORM_ADMIN-only test
- customer blocked from company-scoped tenant test

---

# Tenant Isolation

Implemented:

`backend/src/middleware/tenant.middleware.js`

Current behavior:

- rejects unauthenticated users
- rejects authenticated users without a companyId
- attaches authenticated companyId to `req.companyId`

Important:

PLATFORM_ADMIN has no companyId and therefore must not automatically use `requireCompany`.

Platform-level routes should use role authorization instead.

---

# Platform Administrator

A first PLATFORM_ADMIN account has successfully been created.

Creation mechanism:

`backend/scripts/create-platform-admin.js`

Command:

`npm run admin:create`

Credentials are stored locally through `.env`.

Do not expose them.

Do not run the bootstrap script again unless intentionally testing duplicate protection.

---

# Current Issue / Last Activity

The next verification is PLATFORM_ADMIN login.

A previous login attempt using PowerShell produced:

`The underlying connection was closed: An unexpected error occurred on a receive.`

However:

`GET /health`

continued to return:

- success = true
- service = Itike API
- status = healthy
- database = connected

Therefore the server and database were still available after the failed login request.

The root cause of the login connection issue has NOT yet been established.

Do not assume the problem is incorrect credentials.

Correct invalid credentials should normally produce a controlled 401 response.

The next debugging action should be to reproduce the admin login and inspect the backend terminal/runtime output directly.

---

# Immediate Next Objective

Company Management has been implemented and verified.

Verified Company Management capabilities:

1. Platform administrator can create companies.
2. Platform administrator can list companies.
3. Platform administrator can search companies.
4. Platform administrator can filter companies by status.
5. Platform administrator can retrieve a company by ID.
6. Platform administrator can update company information.
7. Platform administrator can suspend a company.
8. Platform administrator can reactivate a company.
9. Duplicate status transitions are rejected.
10. Invalid status values are rejected.
11. Unauthorized CUSTOMER access is rejected.
12. Nonexistent companies return controlled 404 responses.
13. Company creation creates a default cancellation policy.
14. Critical company mutations are audited.

Company Management is now a completed V1 backend module.

## Next Module

The next implementation objective is:

**Bus Management**

Planned Bus Management capabilities:

- create bus
- list company buses
- retrieve bus
- update bus
- activate/deactivate bus
- registration-number uniqueness
- bus/company ownership validation
- bus status validation
- company tenant isolation
- audit logging for administrative mutations

Important integrity rule:

A bus must belong to exactly one company, and company-scoped users must only access buses belonging to their authenticated company.

After Bus Management, the planned sequence is:

1. Seat configuration
2. Routes and stops
3. Trips
4. Trip-seat inventory
5. Booking and temporary seat holds
6. Payments
7. Tickets and QR codes
8. Check-in and manifests
9. Cancellations and refunds
10. Customer frontend
11. Company management frontend
12. Platform administration frontend
13. Testing, security hardening, and deployment