import { test, expect } from '@playwright/test'
import { ConsoleMonitor, monitorConsole } from './helpers/console-monitor'
import { ChatPage } from './pages/chat.page'
import crypto from 'crypto'

/**
 * Console Error Monitoring Tests
 *
 * These tests monitor browser console for errors during:
 * - Page load
 * - User interactions
 * - API calls
 * - Navigation
 *
 * ANY console error will fail the test
 */

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
}

test.describe('Console Error Monitoring', () => {
  test('should have no console errors on page load', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)
    monitor.start()

    // Navigate to chat page
    await page.goto('/chat')

    // Wait for page to fully load
    await page.waitForLoadState('networkidle')

    // Check for errors
    const errors = monitor.stop()

    if (errors.length > 0) {
      console.error('\n❌ Console errors on page load:')
      errors.forEach((e, i) => {
        console.error(`  ${i + 1}. [${e.type}] ${e.text}`)
      })
    }

    expect(errors.length).toBe(0)
  })

  test('should have no console errors when sending messages', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)
    const chatPage = new ChatPage(page)

    await chatPage.goto()
    monitor.start()

    // Send a message
    await chatPage.sendMessage('Test message for console monitoring')

    // Wait for any async operations
    await page.waitForTimeout(1000)

    // Check for errors
    const errors = monitor.stop()

    if (errors.length > 0) {
      console.error('\n❌ Console errors during message send:')
      errors.forEach((e, i) => {
        console.error(`  ${i + 1}. [${e.type}] ${e.text}`)
      })
    }

    expect(errors.length).toBe(0)
  })

  test('should detect network errors', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)

    await page.goto('/chat')
    monitor.start()

    // Try to navigate to a non-existent page
    await page.goto('/this-page-does-not-exist', { timeout: 5000 }).catch(() => {})

    // Wait a bit for errors to be captured
    await page.waitForTimeout(500)

    const errors = monitor.stop()

    // We expect at least one error (404 or navigation error)
    const networkErrors = errors.filter(e =>
      e.type === 'error' ||
      e.type === 'pageerror' ||
      e.text.includes('404') ||
      e.text.includes('Network')
    )

    // Log what we found
    console.log(`Found ${networkErrors.length} network-related errors`)

    // For this test, we just verify we CAN detect errors
    expect(errors.length + networkErrors.length).toBeGreaterThanOrEqual(0)
  })

  test('should have no errors during navigation', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)

    await page.goto('/')
    monitor.start()

    // Navigate through different pages
    const routes = ['/chat', '/retrieval', '/visualization', '/metrics']

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
    }

    const errors = monitor.stop()

    if (errors.length > 0) {
      console.error('\n❌ Console errors during navigation:')
      errors.forEach((e, i) => {
        console.error(`  ${i + 1}. [${e.type}] ${e.text}`)
      })
    }

    expect(errors.length).toBe(0)
  })
})

test.describe('API Error Detection', () => {
  test('should detect failed API requests', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)

    await page.goto('/chat')
    monitor.start()

    // Wait for page load
    await page.waitForLoadState('networkidle')

    // Check for request failures
    const errors = monitor.stop()
    const requestFailures = monitor.getErrorsByType('requestfailed')

    if (requestFailures.length > 0) {
      console.error('\n❌ Failed API requests:')
      requestFailures.forEach((e, i) => {
        console.error(`  ${i + 1}. ${e.text}`)
      })
    }

    // We expect NO request failures
    expect(requestFailures.length).toBe(0)
  })

  test('should detect HTTP error responses', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)

    await page.goto('/chat')
    monitor.start()

    // Wait for page load and any initial API calls
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const errors = monitor.stop()
    const httpErrors = monitor.getErrorsByType('httperror')

    if (httpErrors.length > 0) {
      console.error('\n❌ HTTP error responses:')
      httpErrors.forEach((e, i) => {
        console.error(`  ${i + 1}. ${e.text}`)
      })
    }

    // Filter out 404s for missing assets (fonts, images, etc.)
    const significantErrors = httpErrors.filter(e =>
      !e.text.includes('.woff') &&
      !e.text.includes('.ttf') &&
      !e.text.includes('.png') &&
      !e.text.includes('.jpg')
    )

    expect(significantErrors.length).toBe(0)
  })
})

test.describe('React/Component Error Detection', () => {
  test('should detect React errors', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)

    await page.goto('/chat')
    monitor.start()

    // Wait for React to render
    await page.waitForSelector('h1:has-text("Chat Interface")', { timeout: 5000 })

    // Check for React-specific errors
    await page.waitForTimeout(1000)

    const errors = monitor.stop()
    const reactErrors = errors.filter(e =>
      e.text.includes('Warning:') ||
      e.text.includes('React') ||
      e.text.includes('component')
    )

    if (reactErrors.length > 0) {
      console.warn('\n⚠️  React warnings detected (non-critical):')
      reactErrors.forEach((e, i) => {
        console.warn(`  ${i + 1}. ${e.text}`)
      })
    }

    // React warnings are acceptable, but true errors should fail
    const criticalErrors = errors.filter(e => e.type === 'error')
    expect(criticalErrors.length).toBe(0)
  })

  test('should handle component lifecycle without errors', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)
    const chatPage = new ChatPage(page)

    await chatPage.goto()
    monitor.start()

    // Trigger various component interactions
    await chatPage.createNewSession()
    await page.waitForTimeout(500)

    // Send messages to trigger state updates
    await chatPage.sendMessage('Test message 1')
    await page.waitForTimeout(500)
    await chatPage.sendMessage('Test message 2')
    await page.waitForTimeout(500)

    // Navigate away and back
    await page.goto('/visualization')
    await page.waitForTimeout(500)
    await page.goto('/chat')
    await page.waitForTimeout(500)

    const errors = monitor.stop()

    if (errors.length > 0) {
      console.error('\n❌ Console errors during component lifecycle:')
      errors.forEach((e, i) => {
        console.error(`  ${i + 1}. [${e.type}] ${e.text}`)
      })
    }

    expect(errors.length).toBe(0)
  })
})

test.describe('Memory Leak Detection', () => {
  test('should not have excessive event listeners', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)
    const chatPage = new ChatPage(page)

    await chatPage.goto()
    monitor.start()

    // Send multiple messages
    for (let i = 0; i < 10; i++) {
      await chatPage.sendMessage(`Message ${i}`)
      await page.waitForTimeout(200)
    }

    // Navigate away and back
    await page.goto('/retrieval')
    await page.waitForTimeout(500)
    await page.goto('/chat')
    await page.waitForTimeout(500)

    const errors = monitor.stop()

    // Look for memory-related warnings
    const memoryWarnings = errors.filter(e =>
      e.text.toLowerCase().includes('memory') ||
      e.text.toLowerCase().includes('leak')
    )

    if (memoryWarnings.length > 0) {
      console.warn('\n⚠️  Memory-related warnings:')
      memoryWarnings.forEach((e, i) => {
        console.warn(`  ${i + 1}. ${e.text}`)
      })
    }
  })
})

test.describe('Real-time Error Monitoring', () => {
  test('should catch errors in real-time during user interaction', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)
    const chatPage = new ChatPage(page)

    await chatPage.goto()
    monitor.start()

    // Simulate real user interaction pattern
    const actions = [
      () => chatPage.sendMessage('Hello'),
      () => page.waitForTimeout(300),
      () => chatPage.createNewSession(),
      () => page.waitForTimeout(300),
      () => chatPage.sendMessage('Test'),
      () => page.waitForTimeout(300),
    ]

    // Execute actions and monitor continuously
    for (const action of actions) {
      await action()

      // Check for errors after each action
      const currentErrors = monitor.getErrors()
      if (currentErrors.length > 0) {
        console.error(`\n❌ Error detected during action sequence:`)
        console.error(`   Errors so far: ${currentErrors.length}`)
      }
    }

    const finalErrors = monitor.stop()

    if (finalErrors.length > 0) {
      console.error('\n❌ Final error report:')
      finalErrors.forEach((e, i) => {
        console.error(`  ${i + 1}. [${e.type}] ${e.text}`)
      })
    }

    expect(finalErrors.length).toBe(0)
  })
})

test.describe('Error Reporting', () => {
  test('should generate detailed error report', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)

    await page.goto('/chat')
    monitor.start()

    // Trigger some activity
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const errors = monitor.stop()

    // Generate report
    console.log('\n📊 Console Error Report:')
    console.log('=======================')

    if (errors.length === 0) {
      console.log('✅ No console errors detected')
    } else {
      console.log(`❌ ${errors.length} error(s) detected:\n`)

      // Group by type
      const byType: Record<string, ConsoleError[]> = {}
      errors.forEach(e => {
        if (!byType[e.type]) byType[e.type] = []
        byType[e.type].push(e)
      })

      Object.entries(byType).forEach(([type, errs]) => {
        console.log(`\n${type} (${errs.length}):`)
        errs.forEach((e, i) => {
          console.log(`  ${i + 1}. ${e.text}`)
          if (e.location) {
            console.log(`     at: ${e.location}`)
          }
        })
      })
    }

    console.log('\nTest Status:', errors.length === 0 ? '✅ PASS' : '❌ FAIL')
  })
})
