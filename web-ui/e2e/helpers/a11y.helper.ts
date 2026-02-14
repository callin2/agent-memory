import { Page, Locator } from '@playwright/test'

/**
 * Accessibility Test Helper
 *
 * Provides utility methods for accessibility testing
 */
export class A11yHelper {
  constructor(readonly page: Page) {}

  /**
   * Check if element has an associated label
   */
  async hasLabel(element: Locator): Promise<boolean> {
    const hasId = await element.getAttribute('id')
    const hasAriaLabel = await element.getAttribute('aria-label')
    const hasAriaLabelledBy = await element.getAttribute('aria-labelledby')

    if (hasAriaLabel || hasAriaLabelledBy) {
      return true
    }

    if (hasId) {
      const labelSelector = 'label[for="' + hasId + '"]'
      const label = this.page.locator(labelSelector)
      const count = await label.count()
      return count > 0
    }

    // Check if wrapped in label
    const parentLabel = await element.evaluate(el => {
      let parent = el.parentElement
      while (parent) {
        if (parent.tagName === 'LABEL') return true
        parent = parent.parentElement
      }
      return false
    })

    return parentLabel
  }

  /**
   * Check if element is focusable
   */
  async isFocusable(element: Locator): Promise<boolean> {
    const tagName = await element.evaluate(el => el.tagName)
    const interactiveTags = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT']

    if (interactiveTags.includes(tagName)) {
      return true
    }

    // Check for tabindex
    const tabIndex = await element.getAttribute('tabindex')
    if (tabIndex && parseInt(tabIndex) >= 0) {
      return true
    }

    return false
  }

  /**
   * Get all focusable elements
   */
  async getFocusableElements(): Promise<Locator[]> {
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    const elements = await this.page.locator(selector).all()
    return elements
  }

  /**
   * Check if element has ARIA attributes
   */
  async hasAria(element: Locator, attribute: string): Promise<boolean> {
    const ariaAttr = 'aria-' + attribute
    const value = await element.getAttribute(ariaAttr)
    return value !== null
  }

  /**
   * Verify element is visible to screen readers
   */
  async isVisibleToScreenReader(element: Locator): Promise<boolean> {
    const display = await element.evaluate(el => {
      const styles = window.getComputedStyle(el)
      return {
        display: styles.display,
        visibility: styles.visibility,
        hidden: el.hasAttribute('hidden'),
        ariaHidden: el.getAttribute('aria-hidden')
      }
    })

    if (display.display === 'none' || display.visibility === 'hidden' || display.hidden) {
      return false
    }

    if (display.ariaHidden === 'true') {
      return false
    }

    return true
  }
}
