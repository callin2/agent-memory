import { test, expect } from '@playwright/test'

/**
 * Navigation E2E Tests
 *
 * Tests main navigation and routing:
 * - All pages accessible
 * - Navigation menu works
 * - URL routing correct
 */
test.describe('Navigation', () => {
  test('should navigate to all pages', async ({ page }) => {
    const routes = [
      { path: '/dashboard', title: 'Dashboard' },
      { path: '/chat', title: 'Chat Interface' },
      { path: '/retrieval', title: 'Memory Retrieval' },
      { path: '/visualization', title: 'Memory Visualization' },
      { path: '/metrics', title: 'Performance Metrics' }
    ]

    for (const route of routes) {
      await page.goto(route.path)
      await expect(page.locator('h1')).toContainText(route.title)
    }
  })

  test('should use navigation menu', async ({ page }) => {
    await page.goto('/dashboard')

    // Click on each navigation item
    const navItems = ['Chat', 'Retrieval', 'Visualization', 'Metrics']

    for (const item of navItems) {
      const navLink = page.locator(`[data-testid="nav-${item.toLowerCase()}"]`)
      await navLink.click()
      await page.waitForTimeout(500)

      // Verify URL changed (be more flexible with the check)
      const currentUrl = page.url()
      expect(currentUrl.toLowerCase()).toContain(item.toLowerCase())
    }
  })

  test('should verify navigation tooltips', async ({ page }) => {
    await page.goto('/dashboard')

    const navItems = [
      { label: 'Dashboard', keywords: ['overview', 'statistics', 'progress'] },
      { label: 'Chat', keywords: ['interface', 'conversation', 'memory'] },
      { label: 'Retrieval', keywords: ['context', 'bundles', 'ACB'] },
      { label: 'Visualization', keywords: ['graphs', 'timelines', 'relationships'] },
      { label: 'Metrics', keywords: ['performance', 'statistics', 'efficiency'] }
    ]

    for (const item of navItems) {
      const navLink = page.locator(`[data-testid="nav-${item.label.toLowerCase()}"]`)

      // Hover and check tooltip
      await navLink.hover()
      const title = await navLink.getAttribute('title')
      expect(title).toBeDefined()

      // Verify tooltip contains relevant keywords
      const tooltipLower = title!.toLowerCase()
      const hasKeyword = item.keywords.some(keyword => tooltipLower.includes(keyword))
      expect(hasKeyword).toBeTruthy()
    }
  })
})
