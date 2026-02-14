import { test, expect } from '@playwright/test'
import { ChatPage } from './pages/chat.page'

/**
 * Chat Feature E2E Tests
 *
 * Tests all chat functionality including:
 * - Message sending
 * - Session management
 * - Scenario generation
 * - Tooltip verification
 */
test.describe('Chat Feature', () => {
  let chatPage: ChatPage

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page)
    await chatPage.goto()
  })

  test('should display chat interface', async ({ page }) => {
    await expect(page.locator('h1:has-text("Chat Interface")')).toBeVisible()
    await expect(chatPage.messageInput).toBeVisible()
    await expect(chatPage.sendButton).toBeVisible()
  })

  test('should send a message successfully', async ({ page }) => {
    const testMessage = 'Hello, this is a test message'

    await chatPage.sendMessage(testMessage)
    await chatPage.verifyMessageExists(testMessage)
  })

  test('should create new session', async ({ page }) => {
    const messageCountBefore = await chatPage.getMessageCount()

    await chatPage.sendMessage('First message')
    const messageCountAfterFirst = await chatPage.getMessageCount()
    expect(messageCountAfterFirst).toBeGreaterThan(messageCountBefore)

    await chatPage.createNewSession()

    // New session should have no messages
    const messageCountAfterNew = await chatPage.getMessageCount()
    expect(messageCountAfterNew).toBe(0)
  })

  test('should generate and send scenario', async ({ page }) => {
    await chatPage.generateScenario(5)

    // Verify generated messages appear
    await expect(chatPage.sendAllButton).toBeVisible()

    const initialCount = await chatPage.getMessageCount()

    await chatPage.sendAllGenerated()

    const finalCount = await chatPage.getMessageCount()
    expect(finalCount).toBeGreaterThan(initialCount)
  })

  test('should verify all tooltips exist', async ({ page }) => {
    await chatPage.verifyTooltips()
  })

  test('should send message with different channels', async ({ page }) => {
    const channels = ['public', 'private', 'team']

    for (const channel of channels) {
      await chatPage.sendMessage(`Test ${channel} message`, channel)
      await chatPage.verifyMessageExists(`Test ${channel} message`)
    }
  })

  test('should send message with different sensitivity levels', async ({ page }) => {
    const sensitivities = ['none', 'low', 'high']

    for (const sensitivity of sensitivities) {
      await chatPage.sendMessage(`Test ${sensitivity} message`, undefined, sensitivity)
      await chatPage.verifyMessageExists(`Test ${sensitivity} message`)
    }
  })
})
