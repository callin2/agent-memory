import { Page, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Metrics Page Object
 *
 * Encapsulates metrics dashboard testing interactions
 */
export class MetricsPage extends BasePage {
  readonly url = '/metrics'

  // Locators
  readonly timeRange1h = this.page.locator('button:has-text("1 Hour")')
  readonly timeRange24h = this.page.locator('button:has-text("24 Hours")')
  readonly timeRange7d = this.page.locator('button:has-text("7 Days")')
  readonly timeRange30d = this.page.locator('button:has-text("30 Days")')
  readonly timeRangeButtons = this.page.locator('div[class*="flex gap-2"] button')
  readonly trendsTab = this.page.locator('button:has-text("Trend Analysis")')
  readonly comparisonTab = this.page.locator('button:has-text("Test Run Comparison")')
  readonly recentTab = this.page.locator('button:has-text("Recent Test Runs")')
  readonly precisionButton = this.page.locator('button:has-text("PRECISION")')
  readonly recallButton = this.page.locator('button:has-text("RECALL")')
  readonly f1Button = this.page.locator('button:has-text("F1")')
  readonly latencyButton = this.page.locator('button:has-text("LATENCY")')

  async goto() {
    await super.goto(this.url)
    // Wait for metrics to load
    await this.page.waitForSelector('h1:has-text("Performance Metrics")', { timeout: 5000 })
  }

  /**
   * Select time range
   */
  async selectTimeRange(range: '1h' | '24h' | '7d' | '30d') {
    const buttonMap = {
      '1h': this.timeRange1h,
      '24h': this.timeRange24h,
      '7d': this.timeRange7d,
      '30d': this.timeRange30d
    }

    await buttonMap[range].click()
    await this.page.waitForTimeout(500)
  }

  /**
   * View trends
   */
  async viewTrends(metric?: 'precision' | 'recall' | 'f1' | 'latency') {
    await this.trendsTab.click()

    if (metric) {
      const buttonMap = {
        'precision': this.precisionButton,
        'recall': this.recallButton,
        'f1': this.f1Button,
        'latency': this.latencyButton
      }
      await buttonMap[metric].click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * View comparison
   */
  async viewComparison() {
    await this.comparisonTab.click()
    await expect(this.page.locator('text=Test Run Comparison')).toBeVisible()
  }

  /**
   * View recent test runs
   */
  async viewRecent() {
    await this.recentTab.click()
    await expect(this.page.locator('text=Recent Test Runs')).toBeVisible()
  }

  /**
   * Verify metric cards are displayed
   */
  async verifyMetricCardsPresent() {
    await expect(this.page.locator('text=Total Tests')).toBeVisible()
    await expect(this.page.locator('text=Avg Precision')).toBeVisible()
    await expect(this.page.locator('text=Avg Recall')).toBeVisible()
    await expect(this.page.locator('text=Avg F1 Score')).toBeVisible()
    await expect(this.page.locator('text=Avg Latency')).toBeVisible()
  }

  /**
   * Verify all tooltips exist
   */
  async verifyTooltips() {
    // Time range buttons
    await this.verifyTooltip('button:has-text("1 Hour")', 'time range')
    await this.verifyTooltip('button:has-text("24 Hours")', 'time range')
    await this.verifyTooltip('button:has-text("7 Days")', 'time range')
    await this.verifyTooltip('button:has-text("30 Days")', 'time range')

    // Tab buttons
    await this.verifyTooltip('button:has-text("Trend Analysis")', 'trend')
    await this.verifyTooltip('button:has-text("Test Run Comparison")', 'comparison')
    await this.verifyTooltip('button:has-text("Recent Test Runs")', 'recent')
  }
}
