# TDD Implementation Plan for agent_memory_v2

## Context

This project has solid testing infrastructure using Vitest, but recent feature implementations (SPEC-MEMORY-002: memory edits and capsules) were developed without following Test-Driven Development principles. The project has:
- Integration tests for new features
- Comprehensive unit tests for some services (api-key, audit)
- Missing unit tests for critical business logic

The goal is to apply TDD principles to add missing test coverage and establish TDD as the standard development approach.

## Recommended Approach: Phased TDD Implementation

### Phase 1: Memory Edit Service Unit Tests (Highest Priority)

**Why**: Core business logic from SPEC-MEMORY-002 operates without unit tests. This implements memory surgery operations (retract, amend, quarantine, attenuate, block).

**Files to Create**:
- `tests/unit/memory/memory-edit-service.test.ts`

**Critical Functions to Test** (from `src/services/memory-edit-service.ts`):
- `createMemoryEdit()` - All 5 edit operations with validation
- `getEditsForTarget()` - Query functionality
- `approveEdit()` / `rejectEdit()` - Approval workflow
- Private validators: `validateTarget()`, `validatePatchForOperation()`

**Test-First Development**:
1. Write test for `validateTarget()` → Run → Fails → Implement → Pass
2. Write test for `validatePatchForOperation(retract)` → Run → Fails → Implement → Pass
3. Repeat for each operation type (amend, quarantine, attenuate, block)
4. Write tests for `createMemoryEdit()` workflow → Run → Fails → Implement → Pass
5. Write tests for approval workflow → Run → Fails → Implement → Pass

### Phase 2: Capsule Service Unit Tests

**Why**: Capsule creation and transfer logic needs test coverage for validation and business rules.

**Files to Create**:
- `tests/unit/memory/capsule-service.test.ts`

**Critical Functions to Test** (from `src/services/capsule-service.ts`):
- `validateCapsuleItems()` - Multi-entity validation
- `validateAudienceAgents()` - Audience existence checks
- `createCapsule()` - Full creation flow with TTL calculation
- `revokeCapsule()` - Status change logic

**Test-First Development**:
1. Write tests for item validation (chunks, decisions, artifacts)
2. Write tests for audience validation
3. Write tests for TTL calculation edge cases
4. Write tests for capsule creation and revocation

### Phase 3: OAuth Service Unit Tests

**Why**: Critical authentication security needs comprehensive testing.

**Files to Create**:
- `tests/unit/auth/oauth-service.test.ts`

**Functions to Test** (from `src/services/oauth-service.ts`):
- OAuth2 flow implementation
- Token exchange validation
- User lookup and validation
- Error handling for failed authentications

### Phase 4: Session/Refresh Route Unit Tests

**Why**: Route handlers need isolated testing for error handling and edge cases.

**Files to Create**:
- `tests/unit/api/session-routes.test.ts`
- `tests/unit/api/refresh-routes.test.ts`

**Functions to Test**:
- Route handlers from `src/api/session-routes.ts`
- Route handlers from `src/api/refresh-routes.ts`
- Error scenarios, validation edge cases
- Token refresh logic

## TDD Workflow (to follow for each phase)

### Red-Green-Refactor Cycle

1. **Red**: Write failing test
   ```bash
   # Write test in tests/unit/...
   npm run test:unit -- filename.test.ts  # Should fail
   ```

2. **Green**: Write minimal code to pass
   ```bash
   # Implement in src/services/...
   npm run test:unit -- filename.test.ts  # Should pass
   ```

3. **Refactor**: Improve code while tests pass
   ```bash
   npm run test:unit -- filename.test.ts  # Still passing
   ```

4. **Build & Full Test Suite**
   ```bash
   npm run build
   npm test  # All tests pass
   ```

## Existing Patterns to Follow

**Good TDD Examples** (reuse these patterns):
- `tests/unit/auth/api-key.test.ts` - Comprehensive service testing
- `tests/unit/auth/audit.test.ts` - Complete CRUD coverage

**Test Utilities** (from `tests/vitest.setup.ts`):
- `createTestPool()` - Isolated database per test
- Schema isolation with auto-migration
- Environment setup (NODE_ENV=test, PORT=0)

## Critical Files Reference

| File | Purpose |
|------|---------|
| `src/services/memory-edit-service.ts` | Memory edit operations |
| `src/services/capsule-service.ts` | Capsule transfer system |
| `src/services/oauth-service.ts` | OAuth authentication |
| `tests/vitest.setup.ts` | Test database setup |
| `vitest.config.ts` | Test configuration |

## Verification

After each phase, verify:
1. Unit tests pass: `npm run test:unit`
2. Build succeeds: `npm run build`
3. Full test suite passes: `npm test`
4. No regressions in existing tests
5. Coverage increased (run with `--coverage` flag)

## Performance Targets (from TESTING_QUICK_REFERENCE.md)

| Operation | Target |
|-----------|--------|
| Simple insert | <50ms |
| Indexed query | <50ms |
| API endpoint | <100ms |
| Context assembly | <200ms |

Add performance assertions to critical paths using `testbench()` pattern from existing tests.

## Notes

- Project uses Vitest (not node:test despite quick reference)
- Tests organized in unit/integration/scenario structure
- Real PostgreSQL connections for tests (no mocks for "performance")
- Session isolation via separate database schemas per worker
