import { test, expect } from '@playwright/test'

/**
 * Multi-Turn Dialogue Test Case
 *
 * Simulates a realistic 10-turn conversation between user and chat interface
 * Tests: session management, messaging, state updates, controls
 */
test.describe('Multi-Turn Dialogue Conversation', () => {
  test('should complete 10-turn dialogue conversation', async ({ page }) => {
    // Navigate to chat page
    await page.goto('http://172.30.1.77:5173/chat')

    // Wait for page to load
    await expect(page.locator('h1:has-text("Chat Interface")')).toBeVisible()

    // ===== TURN 1: Initial Greeting =====
    console.log('Turn 1: User sends greeting')
    await page.waitForSelector('textarea[placeholder*="message"]', { state: 'visible' })
    await page.fill('textarea[placeholder*="message"]', 'Hello! This is a test of the chat interface.')
    await page.click('button:has-text("Send")')
    await page.waitForTimeout(1000)

    // Verify message was sent
    const messageCount1 = await page.locator('p.text-sm.text-muted-foreground').textContent()
    console.log('Messages after turn 1:', messageCount1)

    // ===== TURN 2: Context Message =====
    console.log('Turn 2: User provides context')
    await page.fill('textarea[placeholder*="message"]', 'I am testing the multi-turn memory capabilities.')
    await page.click('button:has-text("Send")')
    await page.waitForTimeout(1000)

    // ===== TURN 3: Subject Tagging =====
    console.log('Turn 3: User demonstrates subject tagging')
    await page.fill('textarea[placeholder*="message"]', 'Testing subject tagging feature.')
    await page.fill('input[data-testid="subject-tagger"]', 'demo-conversation')
    await page.keyboard.press('Enter')
    await page.click('button:has-text("Send")')
    await page.waitForTimeout(1000)

    // ===== TURN 4: Change Channel =====
    console.log('Turn 4: User changes channel to Team')
    await page.click('button[data-testid="channel-select"]')
    await page.click('[data-value="team"]')
    await page.fill('textarea[placeholder*="message"]', 'This is a team-only message.')
    await page.click('button:has-text("Send")')
    await page.waitForTimeout(1000)

    // ===== TURN 5: Change Sensitivity =====
    console.log('Turn 5: User tests sensitivity levels')
    await page.click('button[data-testid="sensitivity-select"]')
    await page.click('[data-value="high"]')
    await page.fill('textarea[placeholder*="message"]', 'This is a high sensitivity message.')
    await page.click('button:has-text("Send")')
    await page.waitForTimeout(1000)

    // ===== TURN 6: Switch to Scenario Tab =====
    console.log('Turn 6: User explores scenario generator')
    await page.click('button:has-text("Scenario")')
    await page.waitForTimeout(500)

    // Set complexity
    await page.locator('[data-testid="complexity-slider"]').fill('5')

    // Select length
    await page.click('button:has-text("Short (2 messages)")')

    // Add subject tag for scenario
    await page.fill('input[data-testid="subject-tagger"]', 'batch-test')
    await page.keyboard.press('Enter')

    // Generate scenario
    await page.click('button:has-text("Generate Scenario")')
    await page.waitForTimeout(3000)

    // ===== TURN 7: Review Generated Messages =====
    console.log('Turn 7: User reviews generated messages')
    const generatedMessages = await page.locator('.border.rounded-md.p-3').count()
    console.log('Generated messages:', generatedMessages)
    expect(generatedMessages).toBeGreaterThan(0)

    // ===== TURN 8: Edit Generated Message =====
    console.log('Turn 8: User edits a generated message')
    // Click edit button on first message
    const editButtons = await page.locator('button[title*="Edit"]').all()
    if (editButtons.length > 0) {
      await editButtons[0].click()
      await page.waitForTimeout(500)
    }

    // ===== TURN 9: Send Generated Messages =====
    console.log('Turn 9: User sends all generated messages')
    const sendAllButton = page.locator('button:has-text("Send All Messages")')
    const isDisabled = await sendAllButton.isDisabled()

    if (!isDisabled) {
      await sendAllButton.click()
      await page.waitForTimeout(3000)

      // Verify messages increased
      const finalMessageCount = await page.locator('p.text-sm.text-muted-foreground').textContent()
      console.log('Messages after sending all:', finalMessageCount)
    }

    // ===== TURN 10: Create New Session =====
    console.log('Turn 10: User creates fresh session')
    await page.click('button:has-text("New Session")')
    await page.waitForTimeout(2000)

    // Verify new session created
    const sessionInfo = await page.locator('p:has-text("Session ID:")').textContent()
    console.log('New session:', sessionInfo)

    // Verify messages are empty in new session
    const newSessionInfo = await page.locator('p.text-sm.text-muted-foreground').textContent()
    expect(newSessionInfo).toContain('0 messages')

    // ===== FINAL VERIFICATION =====
    console.log('Final Verification')

    // Verify all controls still work
    await expect(page.locator('textarea[placeholder*="message"]')).toBeVisible()
    await expect(page.locator('button:has-text("Send")')).toBeVisible()
    await expect(page.locator('button:has-text("New Session")')).toBeVisible()

    // Check for errors
    const errors = page.locator('.text-destructive, [role="alert"]')
    const errorCount = await errors.count()
    console.log('Errors found:', errorCount)
    expect(errorCount).toBe(0)

    console.log('✅ 10-turn dialogue test completed successfully!')
  })

  test('should handle rapid successive messages', async ({ page }) => {
    await page.goto('http://172.30.1.77:5173/chat')
    await expect(page.locator('h1:has-text("Chat Interface")')).toBeVisible()

    // Send 10 messages rapidly
    const messages = [
      'Message 1',
      'Message 2',
      'Message 3',
      'Message 4',
      'Message 5',
      'Message 6',
      'Message 7',
      'Message 8',
      'Message 9',
      'Message 10'
    ]

    for (let i = 0; i < messages.length; i++) {
      console.log(`Sending message ${i + 1}/10`)
      await page.fill('textarea[placeholder*="message"]', messages[i])
      await page.click('button:has-text("Send")')
      await page.waitForTimeout(500)
    }

    // Verify all messages sent
    const finalCount = await page.locator('p.text-sm.text-muted-foreground')
    const text = await finalCount.textContent()
    console.log('Final message count:', text)
    expect(text).toContain('10 messages')
  })

  test('should maintain state across tab switches', async ({ page }) => {
    await page.goto('http://172.30.1.77:5173/chat')

    // Send message in New Message tab
    await page.fill('textarea[placeholder*="message"]', 'State test message')
    await page.click('button:has-text("Send")')
    await page.waitForTimeout(1000)

    // Switch to Scenario tab
    await page.click('button:has-text("Scenario")')
    await page.waitForTimeout(500)

    // Switch back to New Message tab
    await page.click('button:has-text("New Message")')
    await page.waitForTimeout(500)

    // Verify previous messages still visible
    await expect(page.locator('text=State test message')).toBeVisible()

    // Send another message
    await page.fill('textarea[placeholder*="message"]', 'State test message 2')
    await page.click('button:has-text("Send")')
    await page.waitForTimeout(1000)

    // Verify both messages exist
    await expect(page.locator('text=State test message')).toBeVisible()
    await expect(page.locator('text=State test message 2')).toBeVisible()
  })
})
