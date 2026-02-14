import { test, expect } from '@playwright/test'
import { ChatPage } from './pages/chat.page'

/**
 * Chat Feature E2E Tests
 *
 * Tests chat functionality - basic smoke tests only
 */
test.describe('Chat Feature', () => {
  test('should display chat interface', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.locator('h1:has-text("Chat Interface")')).toBeVisible()
  })

  test('should have message input', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.locator('textarea[placeholder*="message"]')).toBeVisible()
  })

  test('should have new session button', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.locator('button:has-text("New Session")')).toBeVisible()
  })
})
