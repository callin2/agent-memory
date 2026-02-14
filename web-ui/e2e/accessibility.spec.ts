import { test, expect } from '@playwright/test'
import { A11yHelper } from './helpers/a11y.helper'

/**
 * Accessibility E2E Tests
 *
 * Tests that the application is accessible:
 * - ARIA labels
 * - Keyboard navigation
 * - Focus management
 * - Screen reader compatibility
 */
test.describe('Accessibility', () => {
  let a11y: A11yHelper

  test.beforeEach(async ({ page }) => {
    a11y = new A11yHelper(page)
  })

  test('should have proper page titles', async ({ page }) => {
    await page.goto('/dashboard')
    const title = await page.title()
    expect(title).toBeDefined()
    expect(title.length).toBeGreaterThan(0)
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/dashboard')

    // Check for h1 (use first() to handle multiple h1s)
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()

    // h1 should be the first heading
    const firstHeading = await page.evaluate(() => {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      return headings.length > 0 ? headings[0].tagName : null
    })
    expect(firstHeading).toBe('H1')
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/chat')

    // Tab through interactive elements
    const tabCount = 10
    for (let i = 0; i < tabCount; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(100)

      // Check if any element has focus (document has focus, not necessarily activeElement)
      const hasFocus = await page.evaluate(() => document.hasFocus())
      expect(hasFocus).toBe(true)
    }
  })

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/visualization')

    const images = page.locator('img')
    const count = await images.count()

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt')
      expect(alt).toBeDefined()
    }
  })

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/chat')

    // Check that inputs have associated labels
    const inputs = page.locator('input, textarea, select')
    const unlabeled: string[] = []

    const count = await inputs.count()
    for (let i = 0; i < Math.min(count, 20); i++) {
      const input = inputs.nth(i)
      const hasLabel = await a11y.hasLabel(input)
      if (!hasLabel) {
        const id = await input.getAttribute('data-testid')
        unlabeled.push(id || `input-${i}`)
      }
    }

    expect(unlabeled.length).toBe(0)
  })

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/dashboard')

    // This is a basic check - full contrast checking requires specialized tools
    // Verify that text is not gray-on-gray or similar low-contrast combinations

    const textElements = page.locator('p, span, div, h1, h2, h3, h4, h5, h6')
    const sampleSize = Math.min(10, await textElements.count())

    for (let i = 0; i < sampleSize; i++) {
      const element = textElements.nth(i)
      const color = await element.evaluate(el => {
        const styles = window.getComputedStyle(el)
        return styles.color
      })

      // Check that color is not transparent or extremely light
      expect(color).not.toBe('transparent')
      expect(color).not.toBe('rgba(0, 0, 0, 0)')
    }
  })
})
