# E2E Test Suite

This directory contains end-to-end tests for the Agent Memory Web UI using Playwright.

## Test Structure

```
e2e/
├── pages/              # Page Object Models
│   ├── base.page.ts    # Base page with common utilities
│   ├── chat.page.ts    # Chat interface page
│   ├── retrieval.page.ts # Memory retrieval page
│   ├── visualization.page.ts # Visualization page
│   ├── metrics.page.ts # Metrics dashboard page
│   └── login.page.ts   # Login page
├── helpers/            # Test helpers
│   └── a11y.helper.ts  # Accessibility testing utilities
├── chat.spec.ts        # Chat feature tests
├── retrieval.spec.ts   # Retrieval feature tests
├── visualization.spec.ts # Visualization feature tests
├── metrics.spec.ts     # Metrics dashboard tests
├── navigation.spec.ts  # Navigation and routing tests
├── tooltips.spec.ts    # Tooltip verification tests
└── accessibility.spec.ts # Accessibility tests
```

## Running Tests

### Run all tests (headless)
```bash
npm test
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:headed
```

### Debug tests
```bash
npm run test:debug
```

### View test report
```bash
npm run test:report
```

## Test Coverage

### Features Tested

1. **Chat Feature** (`chat.spec.ts`)
   - Message sending
   - Session management
   - Scenario generation
   - Channel selection
   - Sensitivity levels
   - Tooltip verification

2. **Retrieval Feature** (`retrieval.spec.ts`)
   - Query building
   - ACB retrieval
   - Results display
   - Tab navigation (Results, Scores, Comparison, Feedback)
   - Form validation
   - Tooltip verification

3. **Visualization Feature** (`visualization.spec.ts`)
   - Graph view
   - Database view
   - Timeline view
   - Event filtering
   - Search functionality
   - Export features
   - Tooltip verification

4. **Metrics Dashboard** (`metrics.spec.ts`)
   - Time range selection
   - Trend analysis
   - Test run comparison
   - Recent runs view
   - Metric cards display
   - Tooltip verification

5. **Navigation** (`navigation.spec.ts`)
   - Page routing
   - Navigation menu
   - URL handling
   - Navigation tooltips

6. **Tooltips** (`tooltips.spec.ts`)
   - Comprehensive tooltip verification
   - WHAT + WHY + EXPECTED BEHAVIOR validation

7. **Accessibility** (`accessibility.spec.ts`)
   - Heading hierarchy
   - Keyboard navigation
   - Form labels
   - Color contrast
   - ARIA attributes

## Page Object Model

Tests use the Page Object Model pattern for maintainability:

```typescript
// Example usage
const chatPage = new ChatPage(page)
await chatPage.goto()
await chatPage.sendMessage('Hello world')
await chatPage.verifyMessageExists('Hello world')
```

## Token Cost Savings

This E2E test suite reduces token costs by:

1. **Automated Regression Testing**: Catch bugs before manual testing
2. **Fast Feedback**: Run tests locally instead of waiting for user reports
3. **Clear Error Reports**: Screenshots and videos on failure show exact issues
4. **Comprehensive Coverage**: Tests all user flows in one command
5. **No Manual Steps**: No need for back-and-forth debugging conversations

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm test

- name: Upload test report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Writing New Tests

1. Create a page object in `pages/` if testing a new feature
2. Extend `BasePage` for common utilities
3. Add test methods for user actions
4. Create a `.spec.ts` file with your tests
5. Run tests to verify

### Example Test

```typescript
import { test, expect } from '@playwright/test'
import { MyPage } from './pages/my.page'

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    const myPage = new MyPage(page)
    await myPage.goto()
    await myPage.doAction()
    await expect(page.locator('result')).toBeVisible()
  })
})
```

## Debugging Failed Tests

When a test fails:
1. Check `playwright-report/index.html` for detailed report
2. Screenshots are saved in `screenshots/`
3. Videos are saved in `videos/`
4. Traces are saved in `traces/` (can be opened in playwright trace viewer)

## Best Practices

1. **Use Page Objects**: Keep selectors in page objects, not tests
2. **Wait for Elements**: Use `waitForSelector` or `waitForLoadState`
3. **Test User Flows**: Test what users do, not implementation details
4. **Avoid Hardcoded Waits**: Use `waitForSelector` instead of `waitForTimeout`
5. **Data Attributes**: Use `data-testid` for reliable element selection
6. **Tooltips**: Verify tooltips explain WHAT + WHY + EXPECTED BEHAVIOR
