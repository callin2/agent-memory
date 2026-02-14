import { Page, expect } from '@playwright/test'

/**
 * Base Page Object Model
 *
 * Provides common utilities and navigation methods
 * for all page objects to extend.
 */
export class BasePage {
  constructor(readonly page: Page) {}

  /**
   * Navigate to a specific route
   */
  async goto(route: string) {
    await this.page.goto(route)
    // Wait for either networkidle or domcontentloaded to avoid timeout
    await Promise.race([
      this.page.waitForLoadState('networkidle'),
      this.page.waitForLoadState('domcontentloaded')
    ])
  }

  /**
   * Wait for element to be visible and clickable
   */
  async waitForElement(selector: string) {
    await this.page.waitForSelector(selector, { state: 'visible' })
  }

  /**
   * Click element and wait for navigation/network
   */
  async clickAndWait(selector: string) {
    await this.page.click(selector)
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Fill input and wait for debounced updates
   */
  async fillInput(selector: string, value: string) {
    await this.page.fill(selector, value)
    await this.page.waitForTimeout(300) // Wait for debounce
  }

  /**
   * Check if element has specific text
   */
  async hasText(selector: string, text: string): Promise<boolean> {
    const element = this.page.locator(selector)
    const count = await element.filter({ hasText: text }).count()
    return count > 0
  }

  /**
   * Verify tooltip exists on hover
   */
  async verifyTooltip(selector: string, expectedTooltipText: string) {
    const element = this.page.locator(selector)
    await element.hover()

    // Check for title attribute or tooltip element
    const title = await element.getAttribute('title')
    if (title) {
      expect(title.toLowerCase()).toContain(expectedTooltipText.toLowerCase())
    } else {
      // Check for custom tooltip element
      const tooltip = this.page.locator('[role="tooltip"]').filter({ hasText: expectedTooltipText })
      await expect(tooltip).toBeVisible()
    }
  }

  /**
   * Take screenshot on failure
   */
  async screenshotFailure(testName: string) {
    await this.page.screenshot({
      path: `screenshots/${testName}-failure.png`,
      fullPage: true
    })
  }
}
