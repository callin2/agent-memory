import { test, expect } from '@playwright/test'

/**
 * Navigation E2E Tests
 *
 * Tests main navigation - simplified
 */
test.describe('Navigation', () => {
  test('should navigate to all pages', async ({ page }) => {
    const routes = [
      { path: '/dashboard', title: 'Dashboard' },
      { path: '/chat', title: 'Chat' },
      { path: '/retrieval', title: 'Retrieval' },
      { path: '/visualization', title: 'Visualization' },
      { path: '/metrics', title: 'Metrics' }
    ]

    for (const route of routes) {
      await page.goto(route.path)
      await expect(page.locator('h1')).toContainText(route.title)
    }
  })

  test('should have navigation menu', async ({ page }) => {
    await page.goto('/dashboard')
    const navLinks = page.locator('nav a')
    const count = await navLinks.count()
    expect(count).toBeGreaterThan(0)
  })
})
