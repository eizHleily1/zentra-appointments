# Zentra Engineering Handbook v1.0

**Status:** Frozen — engineering source of truth  
**Audience:** Engineers working on Zentra  

## Authority

| Document | Role |
|----------|------|
| [Zentra Product Handbook v1.0](./Zentra-Product-Handbook-v1.0.md) | **Product behavior.** If code conflicts with product rules, the product handbook wins. |
| **This handbook** | **Engineering structure, process, and quality.** How we build and validate Zentra. |
| `README.md` | Local setup, commands, and migration runbook. |

Do not implement product behavior from memory. Read the product handbook first.

---

## Project structure

```
apps/
  api/          NestJS backend (PostgreSQL, raw SQL repositories)
  mobile/       Expo React Native client
  docs/         Product + engineering handbooks
packages/
  shared/       Minimal shared package (expand deliberately)
docker-compose.yml
```

**Monorepo:** pnpm workspaces. Run workspace commands from the repo root unless noted.

---

## Backend module pattern

Each domain lives under `apps/api/src/<module>/`:

- `*.controller.ts` — HTTP routes, DTO validation
- `*.service.ts` — business logic
- `*.repository.ts` — interface + `Symbol` token
- `postgres-*.repository.ts` — PostgreSQL implementation
- `dto/` — request/response validation
- `*.spec.ts` — unit tests beside source
- `test/in-memory-*.repository.ts` — in-memory test doubles

**Rules:**

- Keep scheduling and domain rules in pure functions where possible (`scheduling.ts`, `publish-readiness.ts`, etc.).
- No ORM. Schema changes are explicit SQL files in `apps/api/db/`.
- Nest does **not** auto-create tables at startup.

---

## Mobile module pattern

```
apps/mobile/
  App.tsx              Shell: navigation state, auth, data loading
  lib/                 api, types, formatters, constants, styles, dates
  components/          Reusable UI (tab bars, pickers, cards)
  screens/
    consumer/          Client-facing flows
    owner/             Business-owner flows
  App.test.tsx         Smoke + formatter tests
```

**Rules:**

- Screens receive data and callbacks via props; avoid hidden globals.
- Shared formatting and API access belong in `lib/`, not duplicated in screens.
- Product navigation and flows are frozen in the product handbook — do not redesign in refactors.

---

## Migration rules

1. **One SQL file per iteration** in `apps/api/db/iteration-<n>-<name>.sql` (or `phase-*` for foundation).
2. **Add a matching `pnpm db:init:*` script** in root `package.json`.
3. **Document the migration** in `README.md` in order.
4. Prefer idempotent DDL (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
5. **Never** rely on Nest startup to apply schema.
6. Apply migrations locally before merging features that depend on them.

Current head: **iteration-13** (`booking_interval_minutes` on `tenants`, default `15`).

---

## Testing rules

Every change needs appropriate validation:

| Layer | Location | When |
|-------|----------|------|
| Unit | `apps/api/src/**/*.spec.ts` | Domain logic, services, pure functions |
| E2E | `apps/api/test/*.e2e-spec.ts` | HTTP endpoints, auth, cross-module flows |
| Mobile | `apps/mobile/**/*.test.tsx` | UI smoke, formatters, critical payloads |

**In-memory repositories** are the default for service unit tests. E2E tests use the Nest test module with the same doubles unless Postgres is explicitly required.

Tests must pass before an iteration is complete. Do not skip failing tests.

---

## Validation commands

From repo root:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Per package:

```bash
pnpm --filter @appointment-saas/api test
pnpm --filter @appointment-saas/mobile test
```

Database (local):

```bash
pnpm db:up
pnpm db:init:booking-interval   # example: apply latest migration
```

---

## PR / review standards

Before requesting review, confirm:

1. **Product handbook** — behavior matches frozen product rules (or call out intentional gaps).
2. **Scope** — no drive-by refactors or unrelated changes.
3. **Migrations** — SQL + README + `db:init` script if schema changed.
4. **Tests** — added or updated for behavior you changed.
5. **Validation** — typecheck, lint, test, and build pass.
6. **Secrets** — no `.env`, credentials, or tokens committed.
7. **Generated output** — no `dist/`, coverage, or build artifacts in the diff.

Reviewers should reject PRs that change product behavior without handbook alignment, skip tests for non-trivial logic, or omit required migrations.

---

## Document control

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | Jul 2026 | Initial engineering handbook after Product Execution audit |
