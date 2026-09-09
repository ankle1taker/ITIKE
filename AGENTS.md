# Itike Engineering Instructions

## Project

Itike is a professional bus ticket reservation platform initially designed for Rwanda, with Kigali as an initial operating market.

The system is intended to support:

- Customers
- Multiple bus companies
- Company administrators
- Company operators
- Platform administrators
- Routes and intermediate stops
- Buses and custom seat layouts
- Individual scheduled trips
- Temporary seat holds
- Bookings
- Mobile-money and card payments
- E-tickets and QR codes
- Cancellations and refunds
- Audit logging

This is intended to become a production-grade system, not a prototype.

---

# Current Architecture

## Backend

- Node.js
- Express
- Prisma 7
- PostgreSQL
- JWT authentication
- bcryptjs password hashing
- Zod validation
- PostgreSQL driver through @prisma/adapter-pg

Backend location:

`backend/`

Backend source:

`backend/src/`

Database schema:

`backend/prisma/schema.prisma`

Prisma migrations:

`backend/prisma/migrations/`

---

# Backend Structure

Current backend structure:

backend/src/

- config/
- controllers/
- generated/
- middleware/
- routes/
- services/
- utils/
- app.js
- server.js

Important files:

- `src/config/database.js`
- `src/controllers/auth.controller.js`
- `src/middleware/auth.middleware.js`
- `src/middleware/role.middleware.js`
- `src/middleware/tenant.middleware.js`
- `src/routes/auth.routes.js`
- `src/services/auth.service.js`
- `src/utils/jwt.js`
- `src/app.js`
- `src/server.js`

---

# Database

The project uses PostgreSQL.

Database development environment is local PostgreSQL.

Prisma version:

7.10.x

The database currently has the initial migrations and is reported as up to date.

DO NOT modify the Prisma schema unless the domain actually requires a structural change.

Never use destructive database commands casually.

Before changing the schema:

1. Inspect the current schema.
2. Understand existing migrations.
3. Determine whether the requested feature actually requires a schema change.
4. Explain the impact.
5. Create a proper migration.

Never delete the database to solve an application problem.

---

# User Roles

The system has these roles:

- CUSTOMER
- COMPANY_ADMIN
- COMPANY_OPERATOR
- PLATFORM_ADMIN

Important rules:

## CUSTOMER

Customers can:

- create their own customer account
- log in
- search trips
- make bookings
- manage their bookings
- receive tickets

Customers must NEVER be able to select their own privileged role during public registration.

---

## COMPANY_ADMIN

A company administrator belongs to exactly one company.

They may eventually manage:

- their company's buses
- seats
- trips
- operators
- operational information

They must NEVER access another company's tenant data.

---

## COMPANY_OPERATOR

A company operator belongs to one company and has more restricted operational permissions than COMPANY_ADMIN.

---

## PLATFORM_ADMIN

A platform administrator manages the entire Itike platform.

A platform administrator does NOT need a companyId.

PLATFORM_ADMIN is a platform-level role, not a company-level role.

---

# Authentication

Authentication uses JWT.

The JWT contains:

- user ID
- role
- companyId

Authentication middleware:

`src/middleware/auth.middleware.js`

Role middleware:

`src/middleware/role.middleware.js`

Company tenant middleware:

`src/middleware/tenant.middleware.js`

Never trust role or company information supplied by the frontend.

Always derive authorization from the authenticated server-side identity.

---

# Multi-Tenant Security

Company data must be isolated server-side.

Example:

Company A:

`companyId = A`

Company B:

`companyId = B`

A Company A administrator must never be able to retrieve, modify, delete, or otherwise access Company B resources by changing an ID in the URL or request body.

Never rely on frontend filtering for tenant isolation.

Every company-scoped query must enforce the appropriate company boundary.

---

# Important Cross-Entity Integrity Rules

Prisma relations alone do not enforce every business invariant.

The backend must validate:

1. A Trip's bus belongs to the same company as the Trip.
2. A TripSeat's seat belongs to the Trip's bus.
3. A Booking dropoff stop belongs to the Booking's Trip route.
4. A BookingSeat belongs to the correct TripSeat.
5. A company user belongs to the company being accessed.
6. A bus cannot be assigned to overlapping trips.
7. A physical seat cannot be confirmed for two bookings on the same trip.
8. Expired holds must not remain capable of blocking a seat.
9. Payment state and Booking state must be handled separately.
10. Critical administrative actions should be auditable.

These checks belong in the appropriate service/transaction layer.

---

# Booking Model

The conceptual booking flow is:

Customer

→ select trip

→ select seats

→ create temporary holds

→ enter passenger information

→ payment

→ successful payment

→ confirm booking

→ generate ticket

Temporary seat state:

AVAILABLE

→ HELD

→ CONFIRMED

If a hold expires:

HELD

→ AVAILABLE

Never implement seat availability as a permanent global property of the physical Seat record.

Availability is trip-specific.

---

# Payment

Booking status and payment status are separate concepts.

Never assume:

payment success = booking state automatically correct

Payment processing must eventually support:

- provider reference
- asynchronous webhook handling
- idempotency
- retries
- verification
- reconciliation

Do not invent a payment provider integration without verifying the provider's current API requirements.

---

# Security Rules

Never:

- expose passwords
- log plaintext passwords
- commit `.env`
- hard-code secrets
- allow public role escalation
- trust frontend authorization
- expose unrestricted Prisma operations
- disable authentication to make a test pass
- delete the database to fix application bugs

Validate all external input.

Use Zod or equivalent validation at API boundaries.

Return safe error messages to clients.

Log useful technical details server-side without exposing secrets.

---

# Coding Rules

Before changing code:

1. Inspect the relevant files.
2. Understand existing architecture.
3. Search for existing implementations before creating new ones.
4. Avoid duplicate utilities.
5. Prefer small, focused changes.
6. Preserve working functionality.
7. Do not rewrite unrelated files.

After changing code:

1. Run relevant tests/checks.
2. Reproduce the original problem.
3. Verify the fix.
4. Inspect the Git diff.
5. Report exactly what changed.

Never claim a fix worked unless it was actually tested.

---

# Error Debugging Protocol

When an error occurs:

1. Read the complete error.
2. Inspect the relevant source file.
3. Inspect surrounding dependencies.
4. Reproduce the error.
5. Identify the root cause.
6. Fix the root cause.
7. Run the relevant command again.
8. Run regression checks.
9. Inspect `git diff`.

Do not make random changes based only on the error message.

---

# Database Safety

Before migrations:

- inspect `schema.prisma`
- inspect migration history
- check `prisma migrate status`

Never use:

`prisma migrate reset`

unless explicitly instructed.

Never drop or recreate the database to solve an ordinary development error.

---

# Git

Git is used continuously.

Before significant work:

```bash
git status
