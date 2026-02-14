import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration for Full Stack Integration
 *
 * This config enables automated testing of the complete system:
 * - Frontend (React/Vite on port 5173)
 * - Backend API (Express on port 3000)
 * - Database (PostgreSQL)
 *
 * Coverage Areas:
 * - Login/Authentication
 * - Chat interface → API → Database
 * - Memory retrieval
 * - Capsule CRUD operations
 * - Visualization
 * - Metrics dashboard
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start both backend and frontend servers
  webServer: [
    {
      command: 'cd .. && npm run build && npm start',
      url: 'http://localhost:3000',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
