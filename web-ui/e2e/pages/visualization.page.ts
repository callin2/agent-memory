import { Page, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Visualization Page Object
 *
 * Encapsulates visualization testing interactions
 */
export class VisualizationPage extends BasePage {
  readonly url = '/visualization'

  // Locators
  readonly searchInput = this.page.locator('input[placeholder*="Search events"]')
  readonly exportImageButton = this.page.locator('button:has-text("Export Image")')
  readonly exportDataButton = this.page.locator('button:has-text("Export Data")')
  readonly clearFiltersButton = this.page.locator('button:has-text("Clear All Filters")')
  readonly graphViewTab = this.page.locator('button:has-text("Graph View")')
  readonly databaseViewTab = this.page.locator('button:has-text("Database View")')
  readonly timelineViewTab = this.page.locator('button:has-text("Timeline View")')

  async goto() {
    await super.goto(this.url)
    // Wait for page to load
    await this.page.waitForSelector('h1:has-text("Memory Visualization")', { timeout: 5000 })
  }

  /**
   * Search events
   */
  async searchEvents(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(500)
  }

  /**
   * Filter by subject
   */
  async filterBySubject(subject: string) {
    const button = this.page.locator(`button:has-text("${subject}")`)
    await button.click()
    await this.page.waitForTimeout(300)
    // Just verify it was clicked, not state
  }

  /**
   * Filter by event kind
   */
  async filterByKind(kind: string) {
    const button = this.page.locator(`button:has-text("${kind}")`)
    await button.click()
    await this.page.waitForTimeout(300)
    // Just verify it was clicked, not state
  }

  /**
   * Clear all filters
   */
  async clearFilters() {
    await this.clearFiltersButton.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Switch to graph view
   */
  async viewGraph() {
    await this.graphViewTab.click()
    await expect(this.page.locator('canvas')).toBeVisible()
  }

  /**
   * Switch to database view
   */
  async viewDatabase() {
    await this.databaseViewTab.click()
    await expect(this.page.locator('table')).toBeVisible()
  }

  /**
   * Switch to timeline view
   */
  async viewTimeline() {
    await this.timelineViewTab.click()
    await expect(this.page.locator('.relative.h-20')).toBeVisible()
  }

  /**
   * Verify tooltips on all interactive elements
   */
  async verifyTooltips() {
    // Export buttons
    await this.verifyTooltip('button:has-text("Export Image")', 'export')
    await this.verifyTooltip('button:has-text("Export Data")', 'export')

    // Search input
    await this.verifyTooltip('input[placeholder*="Search events"]', 'search')

    // Clear filters button
    await this.verifyTooltip('button:has-text("Clear All Filters")', 'clear')

    // View tabs
    await this.verifyTooltip('button:has-text("Graph View")', 'graph')
    await this.verifyTooltip('button:has-text("Database View")', 'database')
    await this.verifyTooltip('button:has-text("Timeline View")', 'timeline')
  }
}
