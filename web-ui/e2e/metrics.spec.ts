import { test, expect } from '@playwright/test'
import { MetricsPage } from './pages/metrics.page'

/**
 * Metrics Dashboard E2E Tests
 *
 * Tests metrics dashboard functionality:
 * - Time range selection
 * - Trend analysis
 * - Test run comparison
 * - Recent runs
 * - Tooltip verification
 */
test.describe('Metrics Dashboard', () => {
  let metricsPage: MetricsPage

  test.beforeEach(async ({ page }) => {
    metricsPage = new MetricsPage(page)
    await metricsPage.goto()
  })

  test('should display metrics dashboard', async ({ page }) => {
    await expect(page.locator('h1:has-text("Performance Metrics")')).toBeVisible()
  })

  test('should display all metric cards', async ({ page }) => {
    await metricsPage.verifyMetricCardsPresent()
  })

  test('should switch time ranges', async ({ page }) => {
    await metricsPage.selectTimeRange('1h')
    await expect(metricsPage.timeRange1h).toHaveAttribute('data-state', 'selected')

    await metricsPage.selectTimeRange('24h')
    await expect(metricsPage.timeRange24h).toHaveAttribute('data-state', 'selected')

    await metricsPage.selectTimeRange('7d')
    await expect(metricsPage.timeRange7d).toHaveAttribute('data-state', 'selected')

    await metricsPage.selectTimeRange('30d')
    await expect(metricsPage.timeRange30d).toHaveAttribute('data-state', 'selected')
  })

  test('should view trend analysis', async ({ page }) => {
    await metricsPage.viewTrends('precision')
    await metricsPage.viewTrends('recall')
    await metricsPage.viewTrends('f1')
    await metricsPage.viewTrends('latency')
  })

  test('should view test run comparison', async ({ page }) => {
    await metricsPage.viewComparison()
    await expect(page.locator('text=Test Run Comparison')).toBeVisible()
  })

  test('should view recent test runs', async ({ page }) => {
    await metricsPage.viewRecent()
    await expect(page.locator('text=Recent Test Runs')).toBeVisible()
  })

  test('should verify all tooltips exist', async ({ page }) => {
    await metricsPage.verifyTooltips()
  })
})
