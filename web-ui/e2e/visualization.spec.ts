import { test, expect } from '@playwright/test'
import { VisualizationPage } from './pages/visualization.page'

/**
 * Visualization Feature E2E Tests
 *
 * Tests visualization functionality:
 * - Graph view
 * - Database view
 * - Timeline view
 * - Filtering
 * - Tooltip verification
 */
test.describe('Visualization Feature', () => {
  let visualizationPage: VisualizationPage

  test.beforeEach(async ({ page }) => {
    visualizationPage = new VisualizationPage(page)
    await visualizationPage.goto()
  })

  test('should display visualization interface', async ({ page }) => {
    await expect(page.locator('h1:has-text("Memory Visualization")')).toBeVisible()
  })

  test('should switch between view types', async ({ page }) => {
    await visualizationPage.viewGraph()
    await visualizationPage.viewDatabase()
    await visualizationPage.viewTimeline()
  })

  test('should search events', async ({ page }) => {
    await visualizationPage.searchEvents('test')

    // Verify search was performed
    const searchValue = await visualizationPage.searchInput.inputValue()
    expect(searchValue).toBe('test')
  })

  test('should filter by subject', async ({ page }) => {
    await visualizationPage.filterBySubject('auth')

    // Button should be in selected state
    const button = page.locator('button:has-text("auth")')
    await expect(button).toHaveAttribute('data-state', 'selected')
  })

  test('should filter by event kind', async ({ page }) => {
    await visualizationPage.filterByKind('message')

    // Button should be in selected state
    const button = page.locator('button:has-text("message")')
    await expect(button).toHaveAttribute('data-state', 'selected')
  })

  test('should clear all filters', async ({ page }) => {
    // Apply some filters first
    await visualizationPage.filterBySubject('auth')
    await visualizationPage.filterByKind('message')

    // Clear filters
    await visualizationPage.clearFilters()

    // Verify filters are cleared
    const authButton = page.locator('button:has-text("auth")')
    await expect(authButton).not.toHaveAttribute('data-state', 'selected')
  })

  test('should verify all tooltips exist', async ({ page }) => {
    await visualizationPage.verifyTooltips()
  })

  test('should have mock data loaded', async ({ page }) => {
    // Check that statistics are displayed
    await expect(page.locator('text=Total Events')).toBeVisible()
    await expect(page.locator('text=Unique Sessions')).toBeVisible()
    await expect(page.locator('text=Unique Actors')).toBeVisible()
  })
})
