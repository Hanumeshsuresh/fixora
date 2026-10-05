# Fixora

Fixora is a Coimbatore services marketplace for discovering, booking, and tracking trusted nearby professionals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/fixora run dev` — run the Fixora web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/fixora` — React + Vite marketplace UI
- `artifacts/api-server` — Express REST API, sessions, notifications, and local demo uploads
- `lib/api-spec/openapi.yaml` — API contract and source for generated hooks/schemas
- `lib/db/src/schema/fixora.ts` — Fixora PostgreSQL schema
- `README.md` — short product overview and demo sign-ins

## Architecture decisions

- Auth uses an opaque random session token in an HttpOnly cookie; only its SHA-256 hash is stored in PostgreSQL.
- Booking photos are stored under the API server's local `uploads/` directory for the college demo, with paths and metadata in PostgreSQL.
- Nearby sorting uses the Haversine distance formula and Coimbatore-area seed coordinates.
- Notification delivery uses SSE with client-side polling as a recovery path.

## Product

Customers can search nearby service providers, send requests with problem photos, track status changes, and review completed jobs. Professionals manage service profiles, availability, and incoming requests. Admins view marketplace metrics and manage verification and account status.

## User preferences

- Keep the app responsive and accessible, with a deep-blue base and orange accents.

## Gotchas

- Demo seed data is inserted on the API's first start when the categories table is empty.
- The browser and API are same-origin through the artifact proxy; keep app calls relative to `/api`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
