# Itike — Database ERD V1

## Purpose

Initial database model for the Itike bus reservation platform. This is V1 and is expected to evolve after implementation and client/operator feedback.

## Core entities

- Company
- User
- Bus
- Seat
- Route
- RouteStop
- Trip
- Booking
- BookingPassenger
- BookingHold
- Payment
- Ticket
- CancellationPolicy
- AuditLog

## Relationships

- A Company has many Users.
- A Company has many Buses.
- A Bus has many Seats.
- A Route has many RouteStops.
- A Route has many Trips.
- A Trip uses one Bus.
- A Customer User can create many Bookings.
- A Booking belongs to one Trip.
- A Booking contains one or more BookingPassengers.
- Each BookingPassenger is assigned to one Seat for that Trip.
- A BookingPassenger may specify an allowed drop-off RouteStop.
- A Booking can have payment information.
- A confirmed Booking produces a Ticket.
- A Booking may have temporary seat holds during checkout.
- A Company can have a cancellation policy.
- Important administrative actions are recorded in AuditLog.

## Business rules

1. Customer accounts are separate from company staff accounts.
2. A company can have multiple company administrators and operators.
3. Company data must be isolated between companies.
4. Buses can have different types and capacities.
5. Operators can configure seats for each bus.
6. Routes are centrally managed by the Itike platform.
7. Routes may contain intermediate stops.
8. Trips are created individually.
9. A trip represents an actual scheduled journey.
10. A customer can book for themselves or other passengers.
11. One booking can contain multiple passengers/seats.
12. Passenger full name and phone are required.
13. ID/passport is optional.
14. Seats can be temporarily held for 10 minutes during checkout.
15. Expired holds release seats.
16. Repeated seat-hold abuse must be prevented/rate-limited.
17. Payment is primarily Mobile Money, with card support for international customers.
18. Ticket generation occurs after successful payment/confirmation.
19. Tickets include a QR code.
20. Cancellation/refund rules are time-based and may be configurable.
21. The applicable cancellation terms must be preserved for an existing booking.
22. Platform Admin has system-wide control.
23. Company Admin manages only their own company.
24. Company Operators have restricted operational permissions.
25. Seat availability is trip-specific; a physical Seat is not globally BOOKED or AVAILABLE.
26. Intermediate stops are operational route features and may be used as passenger drop-off points.
27. V1 is intentionally iterative and may be refined after real client/operator feedback.

## Important integrity requirements

### Seat concurrency

The system must prevent two confirmed bookings from claiming the same physical seat on the same trip.

Conceptually:

`Trip + Seat = unique active allocation`

This must be enforced at the database/backend transaction level, not only in the frontend.

### Multi-tenant isolation

Company staff must only access resources belonging to their company unless they have platform-wide administrative permission.

### Booking/payment state separation

Booking status and payment status should be modeled separately so states such as:

- Booking: PENDING / CONFIRMED / CANCELLED
- Payment: PENDING / SUCCESS / FAILED / REFUNDED

can be represented correctly.

## Conceptual flow

Customer -> Search Trip -> Select Seats -> Enter Passenger Details -> Create Booking -> 10-minute Hold -> Payment -> Confirm Booking -> Generate Ticket -> QR Code

If payment fails or the hold expires, the held seats are released.

## V1 status

Approved for implementation, with refinement expected after testing and stakeholder feedback.
