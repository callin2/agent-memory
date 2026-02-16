# Lessons Learned

## Authentication Removal - 2026-02-13

### Issue
The project had authentication code scattered throughout, but it was agreed that auth should NOT be used. This caused:
- "No refresh token available" errors in web-ui
- Wasted development time debugging auth-related issues
- User frustration with over-engineering

### Solution
Completely removed all authentication from the project:

**Files Deleted:**
- `src/api/auth-routes.ts`
- `src/api/oauth-routes.ts`
- `src/api/refresh-routes.ts`
- `src/api/session-routes.ts`
- `src/middleware/auth.ts` & `auth.d.ts`
- `src/services/token-service.ts`
- `src/services/oauth-service.ts`
- `packages/auth/` (entire directory)
- `admin-server/src/routes/auth-routes.ts`
- `admin-server/src/routes/refresh-routes.ts`
- `admin-server/src/routes/session-routes.ts`
- `admin-server/src/services/token-service.ts`
- `admin-server/src/middleware/auth.ts`
- `web-ui/src/services/auth.ts`
- `tests/unit/auth/` & `tests/integration/auth-*.test.ts`
- `src/db/migrations/001_refresh_tokens.sql`

**Files Updated:**
- `web-ui/src/services/api.ts` - Removed auth interceptors
- `src/api/api-routes.ts` - Removed `authenticate` middleware and tenant_id overrides
- `src/server.ts` - Removed auth route imports
- `src/mcp/server.ts` - Removed all auth verification
- `admin-server/src/index.ts` - Removed auth routes
- `admin-server/src/routes/index.ts` - Removed auth exports
- `admin-server/src/middleware/index.ts` - Removed auth exports

### Development Script Improvement

**Problem:** The root `npm run dev` only started the backend server on port 3000, not the web-ui on port 5173.

**Solution:** Added `dev:all` script that starts both servers simultaneously:
```json
"dev:all": "npm run dev & cd web-ui && npm run dev"
```

This ensures both backend (port 3000) and frontend (port 5173) are running.

### Port Configuration

| Component | Port | Purpose |
|-----------|------|---------|
| Backend API | 3000 | Express.js server |
| Web UI Dev | 5173 | Vite dev server |
| Admin Server | 3456 | (optional, now minimal) |

### Key Takeaway

**Always verify that `npm run dev` starts ALL necessary services.** When a project has multiple components (backend + frontend), the main dev script should either:
1. Start all components simultaneously (using `&`), OR
2. Use a process manager like `concurrently`, OR
3. Document clearly which ports each service uses

This prevents confusion about "which port is it supposed to run on?" and ensures a complete development environment.
