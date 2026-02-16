# Testing Quick Reference Card

## ⚡ Before Writing Code

```bash
# 1. Write test FIRST
touch src/tests/integration/your-feature.test.ts

# 2. Build to verify
npm run build

# 3. Run test (expect fail)
node --test dist/tests/integration/your-feature.test.js
```

## 📝 Test File Template

```typescript
// ALWAYS load .env first
import { readFileSync } from 'fs';
import { resolve } from 'path';
const envPath = resolve(__dirname, '../../.env.test');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) process.env[key] = valueParts.join('=').trim();
});

// THEN import
import test from "node:test";
import assert from "node:assert/strict";

test("FEATURE: What you're testing", async () => {
  // Arrange
  const input = { ... };

  // Act
  const result = await functionUnderTest(input);

  // Assert
  assert.ok(result, "Should succeed");
});
```

## 🚫 Red Flags (STOP if you see these)

❌ Mocking database for "performance test"
❌ Mocking HTTP client for "integration test"
❌ Saying "done" without running tests
❌ Standalone .mjs test files
❌ No .env loading before imports

## ✅ Green Flags (GOOD practices)

✅ Real PostgreSQL connection
✅ Real HTTP fetch calls
✅ Tests fail, then implement
✅ Build succeeds
✅ All tests pass

## 📊 Performance Targets

| Operation | Must Be |
|------------|-----------|
| Simple insert | <50ms |
| Indexed query | <50ms |
| API endpoint | <100ms |
| Context assembly | <200ms |

## 🔧 Common Commands

```bash
# Build
npm run build

# Run all tests
node --test dist/tests/

# Run specific test
node --test dist/tests/integration/your-test.test.js

# Run performance tests only
node --test dist/tests/performance/

# Verbose output
node --test --verbose dist/tests/

# With coverage
node --test --experimental-test-coverage dist/tests/
```

## 🎯 Pre-Commit Checklist

- [ ] Tests written FIRST
- [ ] Build succeeds
- [ ] Tests pass
- [ ] Real APIs used (no mocks for perf)
- [ ] .env loaded before imports
- [ ] Performance targets met

---

**Full Guide:** `WISENOTE_TESTING_GUIDE.md`
**Source:** WiseNote project best practices
