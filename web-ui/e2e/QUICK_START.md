# Full Stack Integration Tests - Quick Start

## 🎯 What These Tests Cover

Complete **end-to-end testing** of the Agent Memory System:

```
User Interface (React) → Backend API (Express) → Database (PostgreSQL)
```

**36 comprehensive tests** covering:
- ✅ Capsule CRUD operations
- ✅ Memory retrieval and filtering
- ✅ Visualization and metrics
- ✅ Performance and stress testing
- ✅ Data consistency verification
- ✅ Error handling

---

## 🚀 Quick Start

### Prerequisites

1. **PostgreSQL running** on localhost:5432
   ```bash
   # macOS
   brew services start postgresql

   # Linux
   sudo systemctl start postgresql
   ```

2. **Database exists** (agent_memory_dev)
   ```bash
   createdb agent_memory_dev
   ```

3. **Dependencies installed**
   ```bash
   cd web-ui
   npm install
   npx playwright install --with-deps
   ```

4. **Backend built**
   ```bash
   cd ..
   npm run build
   cd web-ui
   ```

---

## ▶️ Running Tests

### Option 1: Run All Integration Tests

```bash
cd web-ui
npm run test:integration
```

### Option 2: Run with Visual UI (Recommended for Debugging)

```bash
cd web-ui
npm run test:integration -- --ui
```

### Option 3: Run in Headed Mode (See Browser)

```bash
cd web-ui
npm run test:integration -- --headed
```

### Option 4: Run Specific Test File

```bash
# Core integration tests only
npm test integration.spec.ts

# Memory retrieval tests only
npm test memory-retrieval-integration.spec.ts

# Visualization tests only
npm test visualization-metrics-integration.spec.ts
```

### Option 5: Use Shell Script

```bash
cd web-ui/e2e
./run-integration-tests.sh          # Run all tests
./run-integration-tests.sh ui       # Run with UI
./run-integration-tests.sh debug    # Debug mode
```

---

## 📊 Viewing Test Results

### HTML Report

```bash
npm run test:report
# Opens: playwright-report/index.html
```

### Screenshots & Videos

Failed tests automatically generate:
- **Screenshots**: `web-ui/test-results/`
- **Videos**: `web-ui/test-results/`
- **Traces**: `web-ui/test-results/`

View traces with:
```bash
npx playwright show-trace test-results/[trace-file].zip
```

---

## 📁 Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `integration.spec.ts` | 13 | CRUD, Performance, Error Handling |
| `memory-retrieval-integration.spec.ts` | 8 | Retrieval, Filtering, Pagination |
| `visualization-metrics-integration.spec.ts` | 15 | Visualization, Metrics, Cross-Feature |

**Total**: 36 tests

---

## 🔍 Test Examples

### Example 1: Full Stack CRUD Test

```typescript
test('CREATE: capsule via API persists to database', async ({ request }) => {
  const api = new APIHelper(request)

  // 1. Create via API
  const response = await api.createCapsule(tenantId, userId, {...})
  expect(response.status()).toBe(201)

  // 2. Verify in database
  const capsule = await db.getCapsule(capsuleId)
  expect(capsule.status).toBe('active')

  // 3. Verify via API
  const getResponse = await api.getCapsule(tenantId, userId, capsuleId)
  expect(getResponse.status()).toBe(200)
})
```

### Example 2: UI to Database Test

```typescript
test('should send message from UI → API → Database', async ({ page, request }) => {
  const chatPage = new ChatPage(page)

  // 1. Send message via UI
  await chatPage.goto()
  await chatPage.sendMessage('Test message')

  // 2. Verify in UI
  await chatPage.verifyMessageExists('Test message')

  // 3. Verify via API
  const response = await api.getCapsules(tenantId, userId)
  expect(response.body.capsules.length).toBeGreaterThan(0)

  // 4. Verify in database
  const count = await db.countCapsules(tenantId)
  expect(count).toBeGreaterThan(0)
})
```

---

## 🛠️ Troubleshooting

### PostgreSQL Not Running

```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL
brew services start postgresql  # macOS
sudo systemctl start postgresql # Linux
```

### Database Doesn't Exist

```bash
# Create database
createdb agent_memory_dev

# Or with psql
psql -U postgres -c "CREATE DATABASE agent_memory_dev;"
```

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port in playwright.config.ts
```

### Tests Time Out

Increase timeout in `playwright.config.ts`:
```typescript
webServer: {
  timeout: 180 * 1000, // Increase from 120s
}
```

---

## 📈 Continuous Integration

### GitHub Actions

```yaml
- name: Run E2E tests
  run: |
    cd web-ui
    npm run test:integration
```

### Docker

```bash
docker-compose up -d postgres
npm run test:integration
```

---

## 📚 Additional Resources

- **Full Documentation**: `e2e/TEST_COVERAGE.md`
- **Existing E2E Tests**: `e2e/*.spec.ts`
- **Page Objects**: `e2e/pages/*.page.ts`
- **Test Helpers**: `e2e/helpers/*.ts`

---

## ✅ Success Criteria

All tests pass when:
- ✅ Backend server starts successfully
- ✅ Frontend loads without errors
- ✅ Database connections work
- ✅ All 36 tests pass
- ✅ No console errors
- ✅ Performance benchmarks met

---

## 🎓 Next Steps

1. **Run tests locally** to verify setup
2. **Review test coverage** in TEST_COVERAGE.md
3. **Add new tests** for additional features
4. **Set up CI/CD** for automated testing
5. **Monitor test results** in each build

---

**Happy Testing! 🚀**
