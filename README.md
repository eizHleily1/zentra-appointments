# Appointment Booking SaaS Platform

Foundation and authentication baseline for a multi-tenant appointment booking SaaS platform.

## Architecture Summary

The approved product architecture uses one mobile application, one backend, and one shared PostgreSQL database with a shared schema. Tenants represent independent businesses, and tenant-owned records will be logically isolated in future phases.

The current implementation includes the Phase 1 foundation, Phase 2 authentication, Phase 3 tenant model, business memberships, services, staff, appointments, and basic mobile MVP screens. It does not implement advanced scheduling, availability, payments, notifications, analytics, branding, platform admin functionality, or AI features.

## Phase 1 Scope

Implemented in this foundation:

- pnpm monorepo workspace.
- NestJS TypeScript backend shell in `apps/api`.
- Expo React Native TypeScript mobile shell in `apps/mobile`.
- Minimal shared package in `packages/shared`.
- Docker Compose PostgreSQL for local development.
- Environment example files.
- Backend health check at `/health`.
- Basic typecheck, lint, and test scripts.

Excluded from Phase 1:

- Tenant memberships.
- Tenant switching.
- Memberships.
- Roles.
- Permissions.
- Services.
- Staff.
- Clients.
- Schedules.
- Appointments.
- Availability.
- Branding.
- Notifications.
- Admin functionality.
- Final ORM decision.

## Phase 2 Authentication Scope

Implemented authentication capabilities:

- Global `users` table for authentication identity.
- Registration.
- Login.
- Refresh token flow with rotation.
- Logout.
- Password hashing.
- JWT access tokens.
- Hashed refresh token storage.
- Account status support: `ACTIVE` and `DISABLED`.
- Login and refresh rejection for `DISABLED` accounts.
- Basic in-process rate limiting for registration, login, and refresh endpoints.
- Authentication environment configuration.
- Authentication tests.

Not implemented in authentication:

- Tenant access.
- Membership access.
- Role authorization.
- Business service management.
- Staff management.
- Appointment workflows.
- Availability.
- Branding.
- Notifications.
- Admin functionality.
- Business logic.

## Phase 3 Tenant Model Scope

Implemented tenant capabilities:

- Tenant creation for authenticated users.
- Tenant metadata: `name`, `businessType`, and `timezone`.
- Approved business type validation:
  - `BARBER`
  - `SALON`
  - `NAIL_ARTIST`
  - `THERAPIST`
  - `CLINIC`
  - `COACH`
  - `PERSONAL_TRAINER`
  - `CONSULTANT`
  - `OTHER`
- Initial owner user reference for bootstrap ownership.
- Tenant lifecycle status:
  - `PENDING_ONBOARDING`
  - `ACTIVE`
  - `DEACTIVATED`
- Metadata updates by the initial owner reference.
- Deactivation by the initial owner reference.

Not implemented in the tenant model:

- Tenant memberships.
- Tenant switching.
- Roles.
- Permissions.
- Staff.
- Clients.
- Services.
- Schedules.
- Availability.
- Appointments.
- Branding.
- Notifications.
- Platform admin functionality.
- Suspension workflows.
- Reactivation workflows.
- Final tenant authorization model.

## Prerequisites

- Node.js 22 or later.
- pnpm 9.15.4, preferably through Corepack.
- Docker Desktop.

Enable pnpm if it is not installed globally:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

## Setup

Install dependencies:

```bash
pnpm install
```

Create local environment files from the examples:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Start PostgreSQL:

```bash
pnpm db:up
```

The PostgreSQL container listens on port `5432` internally and is exposed on host port `5433`.

Initialize Phase 2 authentication tables:

```bash
pnpm db:init:auth
```

Initialize Phase 3 tenant tables:

```bash
pnpm db:init:tenants
```

Initialize Iteration 2 membership tables:

```bash
pnpm db:init:memberships
```

Initialize Iteration 3 service tables:

```bash
pnpm db:init:services
```

Initialize Iteration 4 staff tables:

```bash
pnpm db:init:staff
```

Initialize Iteration 5 appointment tables:

```bash
pnpm db:init:appointments
```

## Start Applications

Start the backend:

```bash
pnpm dev:api
```

The backend health check is available at:

```text
http://localhost:3001/health
```

Expected response:

```json
{
  "databaseConfigured": true,
  "environment": "development",
  "phase": "Phase 1 - Foundation & Project Setup",
  "status": "ok"
}
```

Start the mobile app:

```bash
pnpm dev:mobile
```

The mobile app reads the backend base URL from `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`. The default example points to:

```text
http://localhost:3001
```

## Mobile MVP Screens

The mobile app includes simple functional screens for:

- Registration and login.
- My businesses.
- Create business.
- Business dashboard.
- Services list, create, update, and deactivate.
- Staff list, create, update, and deactivate.
- Appointments list, create, cancel, and complete.

The mobile MVP uses existing backend APIs only and keeps authentication tokens in app memory for the current session.

## Authentication Endpoints

Register:

```text
POST /auth/register
```

Login:

```text
POST /auth/login
```

Refresh token:

```text
POST /auth/refresh
```

Logout:

```text
POST /auth/logout
```

Authentication responses include a JWT access token, an opaque refresh token, and `Bearer` token type. Refresh tokens are stored server-side as hashes and rotated when used.

## Tenant Endpoints

Create tenant:

```text
POST /tenants
```

Update tenant metadata:

```text
PATCH /tenants/:tenantId
```

Deactivate tenant:

```text
POST /tenants/:tenantId/deactivate
```

Tenant endpoints require a valid Phase 2 JWT access token. The Phase 3 owner reference is used only as bootstrap ownership protection until future membership-based access control is implemented.

## Business Endpoints

Create business:

```text
POST /businesses
```

View my businesses:

```text
GET /businesses
```

View business details:

```text
GET /businesses/:businessId
```

Update business basic info:

```text
PATCH /businesses/:businessId
```

Deactivate business:

```text
POST /businesses/:businessId/deactivate
```

Business endpoints require a valid Phase 2 JWT access token. Creating a business also creates the authenticated user's `OWNER` membership. Viewing businesses uses memberships, and business updates/deactivation require the `OWNER` membership.

## Service Endpoints

Create service:

```text
POST /businesses/:businessId/services
```

List services for a business:

```text
GET /businesses/:businessId/services
```

View service details:

```text
GET /businesses/:businessId/services/:serviceId
```

Update service:

```text
PATCH /businesses/:businessId/services/:serviceId
```

Deactivate service:

```text
POST /businesses/:businessId/services/:serviceId/deactivate
```

Service endpoints require a valid Phase 2 JWT access token and an existing membership for the target business. Services are always scoped to exactly one business and are deactivated by setting `active` to `false`.

## Staff Endpoints

Create staff member:

```text
POST /businesses/:businessId/staff
```

List staff members for a business:

```text
GET /businesses/:businessId/staff
```

View staff member details:

```text
GET /businesses/:businessId/staff/:staffMemberId
```

Update staff member basic info:

```text
PATCH /businesses/:businessId/staff/:staffMemberId
```

Deactivate staff member:

```text
POST /businesses/:businessId/staff/:staffMemberId/deactivate
```

Staff endpoints require a valid Phase 2 JWT access token and an existing membership for the target business. Staff members are always scoped to exactly one business and are deactivated by setting `active` to `false`.

## Appointment Endpoints

Create appointment:

```text
POST /businesses/:businessId/appointments
```

List appointments for a business:

```text
GET /businesses/:businessId/appointments
```

View appointment details:

```text
GET /businesses/:businessId/appointments/:appointmentId
```

Cancel appointment:

```text
POST /businesses/:businessId/appointments/:appointmentId/cancel
```

Complete appointment:

```text
POST /businesses/:businessId/appointments/:appointmentId/complete
```

Appointment endpoints require a valid Phase 2 JWT access token and an existing membership for the target business. Appointments are always scoped to exactly one business and store service/staff snapshot fields at booking time.

## Validation

Run all type checks:

```bash
pnpm typecheck
```

Run lint:

```bash
pnpm lint
```

Run tests:

```bash
pnpm test
```

Build all packages:

```bash
pnpm build
```

## Database And ORM Readiness

PostgreSQL is provided for local development through Docker Compose. The API validates that `DATABASE_URL` is configured and uses raw PostgreSQL access for authentication persistence.

Phase 2 authentication tables are initialized explicitly with:

```text
apps/api/db/phase-2-auth.sql
```

Run the SQL with:

```bash
pnpm db:init:auth
```

Phase 3 tenant tables are initialized explicitly with:

```text
apps/api/db/phase-3-tenant-model.sql
```

Run the SQL with:

```bash
pnpm db:init:tenants
```

Iteration 2 membership tables are initialized explicitly with:

```text
apps/api/db/iteration-2-business-memberships.sql
```

Run the SQL with:

```bash
pnpm db:init:memberships
```

Iteration 3 service tables are initialized explicitly with:

```text
apps/api/db/iteration-3-services.sql
```

Run the SQL with:

```bash
pnpm db:init:services
```

Iteration 4 staff tables are initialized explicitly with:

```text
apps/api/db/iteration-4-staff.sql
```

Run the SQL with:

```bash
pnpm db:init:staff
```

Iteration 5 appointment tables are initialized explicitly with:

```text
apps/api/db/iteration-5-appointments.sql
```

Run the SQL with:

```bash
pnpm db:init:appointments
```

The Nest application does not create tables during startup. No ORM has been selected. No ORM client or ORM migrations are included.

## Development Boundary

The approved baseline currently includes Phase 1 foundation, Phase 2 authentication, and Phase 3 tenant model. Future phases require explicit approval before adding tenant memberships, tenant switching, authorization, booking, or other product functionality.
