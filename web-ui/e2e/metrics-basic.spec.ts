import { test, expect } from '@playwright/test'
import { MetricsPage } from './pages/metrics.page'

/**
 * Metrics Dashboard E2E Tests
 *
 * Tests metrics dashboard - simplified
 */
test.describe('Metrics Dashboard', () => {
  test('should display metrics dashboard', async ({ page }) => {
    await page.goto('/metrics')
    await expect(page.locator('h1:has-text("Performance Metrics")')).toBeVisible()
  })

  test('should display metric cards', async ({ page }) => {
    await page.goto('/metrics')
    await expect(page.locator('text=Total Tests')).toBeVisible()
    await expect(page.locator('text=Avg Precision')).toBeVisible()
    await expect(page.locator('text=Avg Recall')).toBeVisible()
  })

  test('should have time range buttons', async ({ page }) => {
    await page.goto('/metrics')
    const buttons = page.locator('div[class*="flex gap-2"] button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
  })
})
