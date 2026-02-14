import { test, expect } from '@playwright/test'
import { ChatPage } from './pages/chat.page'
import { RetrievalPage } from './pages/retrieval.page'
import { VisualizationPage } from './pages/visualization.page'
import { MetricsPage } from './pages/metrics.page'

/**
 * Comprehensive Tooltip Verification Tests
 *
 * Tests that ALL interactive elements have proper tooltips
 * explaining: WHAT + WHY + EXPECTED BEHAVIOR
 */
test.describe('Tooltip Verification', () => {
  test('Chat page tooltips', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto()
    await chatPage.verifyTooltips()
  })

  test('Retrieval page tooltips', async ({ page }) => {
    const retrievalPage = new RetrievalPage(page)
    await retrievalPage.goto()
    await retrievalPage.verifyTooltips()
  })

  test('Visualization page tooltips', async ({ page }) => {
    const visualizationPage = new VisualizationPage(page)
    await visualizationPage.goto()
    await visualizationPage.verifyTooltips()
  })

  test('Metrics page tooltips', async ({ page }) => {
    const metricsPage = new MetricsPage(page)
    await metricsPage.goto()
    await metricsPage.verifyTooltips()
  })

  test('Navigation tooltips', async ({ page }) => {
    await page.goto('/dashboard')

    const navItems = ['dashboard', 'chat', 'retrieval', 'visualization', 'metrics']

    for (const item of navItems) {
      const navLink = page.locator(`[data-testid="nav-${item}"]`)
      await navLink.hover()

      const title = await navLink.getAttribute('title')
      expect(title).toBeDefined()
      expect(title!.length).toBeGreaterThan(50) // Comprehensive tooltips should be descriptive

      // Verify it explains WHAT and WHY
      const titleLower = title!.toLowerCase()
      expect(titleLower).toMatch(/(view|test|manage|build|analyze|monitor)/) // Action words
    }
  })
})
