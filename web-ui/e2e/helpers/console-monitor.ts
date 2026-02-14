import { test, Page } from '@playwright/test'

/**
 * Console Error Monitor
 *
 * Captures and reports browser console errors during testing
 */

export interface ConsoleError {
  type: string
  text: string
  location?: string
  timestamp: Date
}

export class ConsoleMonitor {
  private errors: ConsoleError[] = []
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  /**
   * Start monitoring console errors
   */
  start() {
    this.errors = []

    // Listen for all console messages
    this.page.on('console', msg => {
      const type = msg.type()
      const text = msg.text()

      // Capture errors and warnings
      if (type === 'error') {
        this.errors.push({
          type,
          text,
          location: msg.location()?.url,
          timestamp: new Date(),
        })

        // Log to test output for visibility
        console.error(`🔴 Browser Console Error: ${text}`)
        if (msg.location()) {
          console.error(`   Location: ${msg.location().url}:${msg.location().lineNumber}`)
        }
      } else if (type === 'warning') {
        console.warn(`⚠️  Browser Console Warning: ${text}`)
      }
    })

    // Listen for page errors
    this.page.on('pageerror', error => {
      const errorText = error.message
      this.errors.push({
        type: 'pageerror',
        text: errorText,
        location: error.stack?.split('\n')[0],
        timestamp: new Date(),
      })

      console.error(`🔴 Page Error: ${errorText}`)
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`)
      }
    })

    // Listen for failed requests
    this.page.on('requestfailed', request => {
      const failure = request.failure()
      if (failure) {
        const errorText = `Request failed: ${request.method()} ${request.url()} - ${failure.textText}`
        this.errors.push({
          type: 'requestfailed',
          text: errorText,
          timestamp: new Date(),
        })

        console.error(`🔴 ${errorText}`)
      }
    })

    // Listen for responses with error status codes
    this.page.on('response', response => {
      if (response.status() >= 400) {
        const errorText = `HTTP Error: ${response.status()} ${response.url()}`
        this.errors.push({
          type: 'httperror',
          text: errorText,
          timestamp: new Date(),
        })

        console.error(`🔴 ${errorText}`)
      }
    })
  }

  /**
   * Stop monitoring and return all captured errors
   */
  stop(): ConsoleError[] {
    return [...this.errors]
  }

  /**
   * Get all captured errors without stopping
   */
  getErrors(): ConsoleError[] {
    return [...this.errors]
  }

  /**
   * Clear all captured errors
   */
  clear() {
    this.errors = []
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: string): ConsoleError[] {
    return this.errors.filter(e => e.type === type)
  }

  /**
   * Check if any errors were captured
   */
  hasErrors(): boolean {
    return this.errors.length > 0
  }

  /**
   * Assert no errors were captured
   * Throws an error with details if any errors exist
   */
  assertNoErrors() {
    if (this.errors.length > 0) {
      const errorSummary = this.errors.map((e, i) =>
        `\n  ${i + 1}. [${e.type}] ${e.text}${e.location ? `\n     at: ${e.location}` : ''}`
      ).join('')

      throw new Error(
        `❌ Console errors detected (${this.errors.length}):${errorSummary}`
      )
    }
  }

  /**
   * Filter errors by text pattern
   */
  filterByPattern(pattern: RegExp): ConsoleError[] {
    return this.errors.filter(e => pattern.test(e.text))
  }

  /**
   * Ignore specific error patterns
   */
  ignorePatterns(patterns: RegExp[]): ConsoleError[] {
    return this.errors.filter(e => {
      return !patterns.some(pattern => pattern.test(e.text))
    })
  }
}

/**
 * Set up console monitoring for a test
 * Returns a function that will assert no errors occurred
 */
export function monitorConsole(page: Page): () => void {
  const monitor = new ConsoleMonitor(page)
  monitor.start()

  return () => {
    const errors = monitor.stop()

    // Ignore certain common development errors
    const ignoredPatterns = [
      // DevTools extension messages (harmless)
      /DevTools.*extension/,
      /chrome-extension:/,

      // React development warnings (acceptable in tests)
      /Warning:.* ReactDOM.render/,
      /Warning: Each child in a list should have a unique "key" prop/,

      // Third-party library warnings
      /Download the React DevTools/,
    ]

    const significantErrors = monitor.ignorePatterns(ignoredPatterns)

    if (significantErrors.length > 0) {
      console.error('\n❌ Significant console errors detected:')
      significantErrors.forEach((e, i) => {
        console.error(`  ${i + 1}. [${e.type}] ${e.text}`)
      })

      throw new Error(
        `❌ Test failed with ${significantErrors.length} console error(s)`
      )
    }
  }
}

/**
 * Create a Playwright test fixture that automatically monitors console
 */
export const consoleTest = test.extend<{
  monitorConsole: () => void
}>({
  monitorConsole: async ({ page }, use) => {
    let cleanup: (() => void) | null = null

    await use(() => {
      cleanup = monitorConsole(page)
      return cleanup
    })

    // Cleanup after test
    if (cleanup) {
      cleanup()
    }
  },
})
