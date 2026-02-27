# Source Layout

This repository uses a layered `src/` structure:

- `app/`: Next.js App Router pages, layouts, and route handlers.
- `frontend/`: UI components and client-facing feature modules.
- `backend/`: Server-side feature services and domain logic.
- `database/`: Prisma client and DB-specific access utilities.
- `lib/`: Cross-cutting helper utilities (env, http, format, constants).
- `types/`: Shared domain types and factory helpers.

## Boundaries

- `app/*` may import from `frontend/*`, `backend/*`, `lib/*`, `types/*`.
- `frontend/*` should not import from `app/*`.
- `backend/*` should not import from `frontend/*`.
- `database/*` should stay persistence-focused (no UI or route concerns).
- `lib/*` should be generic/reusable and side-effect minimal.
