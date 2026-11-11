# Itike — API Contract (V1)

**Base URL:** `http://localhost:5000` (dev) — production URL TBD
**Version:** V1 (frozen 2026-11-11)
**Content-Type:** `application/json` unless otherwise noted

---

## Conventions

- **Auth:** JWT in `Authorization: Bearer <token>` header. Exception: `/api/webhooks/*` (signature-verified), `/api/companies/register` (public), `/api/trips/*` (public), `/api/tickets/verify` (public).
- **Roles:** `CUSTOMER`, `COMPANY_ADMIN`, `COMPANY_OPERATOR`, `PLATFORM_ADMIN`.
- **Error format:**
  ```json
  {
    "success": false,
    "message": "Human-readable error",
    "errors": [...],          // Zod validation errors only
    "unavailableSeatIds": [...]  // booking conflicts only
  }