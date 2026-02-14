import { Page, expect } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * Chat Page Object
 *
 * Encapsulates chat interface interactions for testing
 * message sending, session management, and scenario generation
 */
export class ChatPage extends BasePage {
  readonly url = '/chat'

  // Locators
  readonly messageInput = this.page.locator('textarea[placeholder*="message"]')
  readonly sendButton = this.page.locator('button[data-testid="send-button"]')
  readonly newSessionButton = this.page.locator('button:has-text("New Session")')
  readonly messageList = this.page.locator('[data-testid="message-list"]')
  readonly channelSelect = this.page.locator('button[id="channel-select"]')
  readonly sensitivitySelect = this.page.locator('button[id="sensitivity-select"]')
  readonly subjectTagger = this.page.locator('input[data-testid="tag-input"]')
  readonly scenarioTab = this.page.locator('button:has-text("Scenario")')
  readonly generateButton = this.page.locator('button[data-testid="generate-button"]')
  readonly sendAllButton = this.page.locator('button[data-testid="send-all-button"]')

  async goto() {
    await super.goto(this.url)
    // Wait for page to load
    await this.page.waitForSelector('h1:has-text("Chat Interface")', { timeout: 5000 })
  }

  /**
   * Send a message
   */
  async sendMessage(content: string, channel?: string, sensitivity?: string) {
    // Select channel if provided
    if (channel) {
      await this.channelSelect.click()
      await this.page.locator(`[data-value="${channel}"]`).click()
    }

    // Select sensitivity if provided
    if (sensitivity) {
      await this.sensitivitySelect.click()
      await this.page.locator(`[data-value="${sensitivity}"]`).click()
    }

    // Type and send message
    await this.messageInput.fill(content)
    await this.sendButton.click()

    // Wait for message to appear
    await this.page.waitForTimeout(500)
  }

  /**
   * Verify message appears in list
   */
  async verifyMessageExists(content: string) {
    await expect(this.messageList.locator(`text=${content}`)).toBeVisible()
  }

  /**
   * Create new session
   */
  async createNewSession() {
    const currentUrl = this.page.url()
    await this.newSessionButton.click()

    // Wait for session change
    await this.page.waitForTimeout(1000)

    // Verify session ID changed
    expect(this.page.url()).not.toBe(currentUrl)
  }

  /**
   * Generate test scenario
   */
  async generateScenario(complexity?: number) {
    await this.scenarioTab.click()

    if (complexity) {
      const slider = this.page.locator('[data-testid="complexity-slider"]')
      await slider.fill(complexity.toString())
    }

    await this.generateButton.click()

    // Wait for generation to complete
    await this.page.waitForSelector('[data-testid="send-all-button"]', { timeout: 10000 })
  }

  /**
   * Send all generated messages
   */
  async sendAllGenerated() {
    await this.sendAllButton.click()
    await this.page.waitForTimeout(2000)
  }

  /**
   * Get message count
   */
  async getMessageCount(): Promise<number> {
    return await this.messageList.locator('[data-testid^="message-"]').count()
  }

  /**
   * Verify all tooltips exist
   */
  async verifyTooltips() {
    // Message input tooltip
    await this.verifyTooltip('textarea[placeholder*="message"]', 'message')

    // Send button tooltip
    await this.verifyTooltip('button:has-text("Send")', 'send')

    // New Session button tooltip
    await this.verifyTooltip('button:has-text("New Session")', 'session')

    // Channel select tooltip
    await this.verifyTooltip('[data-testid="channel-select"]', 'channel')

    // Sensitivity select tooltip
    await this.verifyTooltip('[data-testid="sensitivity-select"]', 'sensitivity')

    // Subject tagger tooltip
    await this.verifyTooltip('[data-testid="subject-tagger"]', 'subject')
  }
}
