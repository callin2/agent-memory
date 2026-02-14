import { test, expect } from '@playwright/test'
import { RetrievalPage } from './pages/retrieval.page'
import { ChatPage } from './pages/chat.page'

/**
 * Retrieval Feature E2E Tests
 *
 * Tests ACB retrieval functionality:
 * - Query building
 * - Results display
 * - Tab navigation
 * - Tooltip verification
 */
test.describe('Retrieval Feature', () => {
  let retrievalPage: RetrievalPage
  let chatPage: ChatPage

  test.beforeEach(async ({ page }) => {
    retrievalPage = new RetrievalPage(page)
    chatPage = new ChatPage(page)
  })

  test('should display retrieval interface', async ({ page }) => {
    await retrievalPage.goto()
    await expect(page.locator('h1:has-text("Memory Retrieval")')).toBeVisible()
    await expect(retrievalPage.sessionIdInput).toBeVisible()
    await expect(retrievalPage.intentInput).toBeVisible()
  })

  test('should build and submit query', async ({ page }) => {
    // First create some test data
    await chatPage.goto()
    await chatPage.sendMessage('Test message for retrieval')

    // Now test retrieval
    await retrievalPage.goto()
    await retrievalPage.buildQuery({
      sessionId: chatPage.page.url().split('/').pop() || 'test-session',
      intent: 'Test memory retrieval',
      queryText: 'test message'
    })

    await retrievalPage.verifyResultsDisplayed()
  })

  test('should navigate between result tabs', async ({ page }) => {
    await retrievalPage.goto()

    // Build a query first (may not have results in test env)
    await retrievalPage.sessionIdInput.fill('test-session')
    await retrievalPage.intentInput.fill('Test query')
    await retrievalPage.retrieveButton.click()

    // Test tab navigation
    await retrievalPage.viewScores()
    await retrievalPage.viewComparison()
    await retrievalPage.viewFeedback()
  })

  test('should verify all tooltips exist', async ({ page }) => {
    await retrievalPage.goto()
    await retrievalPage.verifyTooltips()
  })

  test('should validate required fields', async ({ page }) => {
    await retrievalPage.goto()

    // Try to submit without required fields
    await retrievalPage.retrieveButton.click()

    // Should show validation error
    const hasError = await retrievalPage.hasText('alert', 'required') ||
                    await retrievalPage.hasText('.text-destructive', 'required')
    expect(hasError).toBeTruthy()
  })
})
