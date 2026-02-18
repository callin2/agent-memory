# AGENTS.md

This file is written for agentic coding assistants operating in this repo.

## Repo Layout

- `src/`: main service (Express HTTP API + MCP server + core logic)
- `src/api/`: HTTP route modules (mounted in `src/server.ts`)
- `src/mcp/`: MCP HTTP server (JSON-RPC 2.0 over HTTP POST with Bearer token auth)
- `src/core/`: orchestration/recording/privacy/security
- `src/services/`: DB-backed services (tokens, sessions, audit, oauth, capsules, edits)
- `src/db/`: `schema.sql` + migrations in `src/db/migrations/*.sql`
- `tests/`: Vitest (`unit/`, `integration/`, `scenarios/`, `load/`)
- `admin-server/`: separate Express service (WIP)
- `packages/auth/`: shared auth library (JWT/API key/middleware)
- `docs/`: operational docs + `docs/openapi.yaml`
- `dist/`: build output (generated)

Note: `tsconfig.json` and ESLint intentionally exclude some legacy files (e.g. `src/api/routes.ts`, `src/api/routes-secure.ts`, `src/core/recorder-enhanced.ts`). Prefer editing the active codepaths used by `src/server.ts`.

## Commands (Root Service)

Prereq: Node >= 20.

- Install: `npm install`
- Dev server (hot reload): `npm run dev` (entry: `src/server.ts`)
- Build: `npm run build` (tsc -> `dist/`)
- Start built server: `npm start`
- Start MCP mode: `npm run start:mcp` (or `tsx src/server.ts --mcp`)
- Typecheck only: `npm run typecheck`
- Lint: `npm run lint` (ESLint config: `src/.eslintrc.js`)
- Format: `npm run format` (Prettier defaults over `src/**/*.ts`)

## Commands (Subprojects)

This repo is not configured as an npm workspace. Run commands inside each subproject.

`admin-server/`: `cd admin-server && npm install && npm run dev` (tests: `npm test`)

`packages/auth/`: `cd packages/auth && npm install && npm run build` (tests: `npm test`)

## Testing (Vitest)

Default runner: `vitest run` (see `vitest.config.ts`).

Common suites:

- All tests: `npm test`
- Unit only: `npm run test:unit`
- Scenarios only: `npm run test:scenarios`
- Watch mode: `npm run test:watch`

Run a single test file (recommended patterns):

- `npm test -- tests/unit/auth/refresh-token.test.ts`
- `npm test -- tests/integration/auth-flow.test.ts`

Run a single test by name:

- `npm test -- -t "Token theft"`
- `npm test -- tests/integration/mcp-auth-flow.test.ts -t "initialize"`

Scenario runners:

- `npx tsx tests/scenarios/index.ts` (custom console runner)
- `bash tests/scenarios/spec-memory-002/test-runner.sh` (writes `.test-results/`)

Test DB notes:

- Many tests assume Postgres is running and use `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD`.
- Some tests set `process.env.NODE_ENV = 'test'` before importing `src/server.ts` to skip auto-migrations.

## Database Commands

- Setup dev DB: `npm run db:setup:dev` (calls `setup-dev-db.sh`)
- Migrate dev: `npm run db:migrate:dev`
- Migrate prod: `npm run db:migrate:prod`
- Verify DBs: `npm run db:verify`

Destructive (do not run casually):

- `npm run db:reset` drops and recreates `$PGDATABASE`.

DB selection:

- The services primarily use `PGDATABASE` (see `DATABASE_SETUP.md`).

## Code Style & Conventions

### TypeScript + ESM

- `tsconfig.json` uses `module: NodeNext` / `moduleResolution: NodeNext`.
- Local (relative) imports include `.js` extensions in source (e.g. `import { buildACB } from '../core/orchestrator.js'`). Keep this pattern.
- `strict` is enabled; `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` are enabled.

### Imports

- Order imports: built-ins -> external deps -> internal modules.
- Prefer explicit named exports and small modules.
- Use `import type { ... }` for type-only imports when it helps avoid runtime cycles (rare in this repo, but supported).

### Formatting

- Prettier is used with defaults (`npm run format`). Don\'t hand-format large blocks.
- ESLint rules (key ones): `eqeqeq` always, `curly` always, `prefer-const`, `no-var`.
- `no-console` is a warning; `console.warn`/`console.error` are allowed. Avoid adding new `console.log` in production paths.

### Naming + Data Shapes

- Files: kebab-case (e.g. `auth-routes.ts`, `memory-edit-service.ts`).
- Types/interfaces: `PascalCase`. Functions/vars: `camelCase`. Constants: `UPPER_SNAKE_CASE`.
- External API payloads and DB columns use `snake_case` (e.g. `tenant_id`, `session_id`). Preserve this in request/response bodies and SQL.
- IDs use prefixes (e.g. `evt_...`, `chk_...`, `dec_...`, `rt_...`). Validate ID format in routes when applicable.

### Error Handling

- Route handlers typically:
  - Validate input early; `return res.status(400/401/403/404).json(...)`.
  - Wrap async logic in `try/catch` and return `500` on unexpected failures.
- Avoid leaking internals: many routes only include `message` in `development` (`NODE_ENV=development`). Follow that pattern.
- Prefer `catch (err: unknown)` in new code and narrow to `err instanceof Error` before reading `err.message`.

### Logging, Audit, Security

- Security-sensitive actions should be logged via `AuditService` when possible (see `src/services/audit-service.ts`).
- Use `logSecurityEvent()` for suspicious/blocked input (see `src/core/security.ts`).
- Enforce tenant isolation everywhere:
  - HTTP API uses `authenticate`/`authenticateAny` from `src/middleware/auth.ts` and compares `tenant_id`.
  - MCP server injects `tenant_id` from the authenticated user and must not accept cross-tenant access.
- Use parameterized SQL (`$1`, `$2`, ...) only; never build SQL with string concatenation.
- When using transactions, use `const client = await pool.connect()` + `BEGIN/COMMIT/ROLLBACK` + `client.release()` in `finally`.

### Where To Put Code

- HTTP endpoints: `src/api/*-routes.ts` (routers created via `createXRoutes(...)`).
- Business logic + DB access: `src/services/*.ts`.
- Cross-cutting utilities: `src/utils/*.ts`.
- Security/validation helpers: `src/core/security.ts`.

## Cursor / Copilot Rules

- No Cursor rules found (`.cursor/rules/` or `.cursorrules` absent).
- No GitHub Copilot instructions found (`.github/copilot-instructions.md` absent).

## Secrets

- Never commit `.env` with real credentials.
- If you add new env vars, update templates (`.env.dev`, `.env.prod`, `.env.test`).
