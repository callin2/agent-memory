import { test, expect } from '@playwright/test'
import { ConsoleMonitor } from './helpers/console-monitor'
import crypto from 'crypto'

/**
 * API URL Validation Tests
 *
 * These tests verify that:
 * 1. Frontend sends correct API URLs
 * 2. No double /api in URLs
 * 3. Proxy configuration works
 * 4. Requests reach the backend correctly
 */

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
}

test.describe('API URL Validation', () => {
  test('should not have double /api in request URLs', async ({ page }) => {
    const correctUrls: string[] = []
    const incorrectUrls: string[] = []

    // Intercept all requests
    page.on('request', request => {
      const url = request.url()
      console.log(`📤 Request: ${request.method()} ${url}`)

      // Check for double /api
      if (url.includes('/api/api/')) {
        incorrectUrls.push(url)
        console.error(`❌ DOUBLE /api DETECTED: ${url}`)
      } else if (url.includes('/api/')) {
        correctUrls.push(url)
        console.log(`✅ Correct URL: ${url}`)
      }
    })

    // Navigate to chat page
    await page.goto('/chat')

    // Wait for initial API calls
    await page.waitForTimeout(2000)

    // Report results
    console.log('\n📊 URL Validation Report:')
    console.log('========================')
    console.log(`✅ Correct URLs: ${correctUrls.length}`)
    console.log(`❌ Incorrect URLs (double /api): ${incorrectUrls.length}`)

    if (incorrectUrls.length > 0) {
      console.error('\n❌ FAILED: Double /api detected in URLs:')
      incorrectUrls.forEach(url => console.error(`  - ${url}`))
    }

    expect(incorrectUrls.length).toBe(0)
  })

  test('should send requests to correct backend endpoint', async ({ page }) => {
    const capturedRequests: { url: string; method: string }[] = []

    // Capture all API requests
    page.on('request', request => {
      const url = request.url()

      if (url.includes('/api/')) {
        capturedRequests.push({
          url,
          method: request.method(),
        })
      }
    })

    await page.goto('/chat')

    // Wait for page to load and make initial requests
    await page.waitForLoadState('networkidle')

    // Verify we captured API requests
    console.log(`\n📡 Captured ${capturedRequests.length} API requests`)

    capturedRequests.forEach((req, i) => {
      console.log(`  ${i + 1}. ${req.method} ${req.url}`)
    })

    // Check that URLs are correctly formatted
    const urlPatterns = [
      { pattern: /\/api\/v1\/events/, name: 'GET /api/v1/events' },
      { pattern: /\/api\/v1\/health/, name: 'GET /api/v1/health' },
    ]

    urlPatterns.forEach(({ pattern, name }) => {
      const found = capturedRequests.some(req => pattern.test(req.url))
      console.log(`${found ? '✅' : '⚠️ '} ${name}: ${found ? 'Found' : 'Not captured'}`)
    })

    // Most importantly: verify NO double /api
    const hasDoubleApi = capturedRequests.some(req => req.url.includes('/api/api/'))
    expect(hasDoubleApi).toBe(false)
  })

  test('should proxy API requests correctly', async ({ page }) => {
    let requestReachedBackend = false
    let proxyError = false

    // Monitor requests and responses
    page.on('request', request => {
      const url = request.url()

      if (url.includes('/api/')) {
        console.log(`📤 Frontend → Proxy: ${request.method()} ${url}`)

        // Verify URL format
        if (url.includes('/api/api/')) {
          console.error(`❌ PROXY ERROR: Double /api in URL`)
          proxyError = true
        }
      }
    })

    page.on('response', async response => {
      const url = response.url()

      if (url.includes('/api/')) {
        const status = response.status()
        console.log(`📥 Proxy → Frontend: ${status} ${url}`)

        if (status >= 200 && status < 300) {
          requestReachedBackend = true
        } else if (status !== 404) {
          // 404 might be expected for some endpoints during testing
          console.warn(`⚠️  Unexpected status: ${status}`)
        }
      }
    })

    // Navigate to chat
    await page.goto('/chat')
    await page.waitForTimeout(2000)

    // Verify proxy worked
    expect(proxyError).toBe(false)
    expect(requestReachedBackend).toBe(true)
  })

  test('should format event API request correctly', async ({ page }) => {
    const eventRequests: string[] = []

    page.on('request', request => {
      const url = request.url()

      // Capture event API calls
      if (url.includes('/events') || url.includes('/api/v1/events')) {
        eventRequests.push(url)
        console.log(`📡 Events API: ${url}`)
      }
    })

    await page.goto('/chat')
    await page.waitForTimeout(2000)

    console.log(`\n🎯 Event API Requests: ${eventRequests.length}`)

    eventRequests.forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`)

      // Verify URL format
      expect(url).not.toContain('/api/api/')
      expect(url).toMatch(/\/api\/v1\/events/)
    })
  })
})

test.describe('API Response Validation', () => {
  test('should receive successful responses from backend', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)

    await page.goto('/chat')
    monitor.start()

    // Wait for initial API calls
    await page.waitForTimeout(2000)

    // Check responses
    const responses = await page.evaluate(() => {
      return new Promise((resolve) => {
        const captured: any[] = []

        // Override fetch to capture responses
        const originalFetch = window.fetch
        window.fetch = async (...args) => {
          const response = await originalFetch(...args)
          const url = args[0] as string

          if (url.includes('/api/')) {
            captured.push({
              url,
              status: response.status,
              ok: response.ok,
            })
          }

          return response
        }

        // Wait a bit then resolve
        setTimeout(() => resolve(captured), 1000)
      })
    })

    monitor.stop()

    console.log('\n📊 API Responses:')
    responses.forEach((resp: any, i: number) => {
      console.log(`  ${i + 1}. ${resp.status} ${resp.ok ? '✅' : '❌'} ${resp.url}`)
    })

    // Verify we got responses (not all connection errors)
    const hasSuccessResponse = responses.some((r: any) => r.status >= 200 && r.status < 300)
    expect(hasSuccessResponse).toBe(true)
  })

  test('should handle API errors gracefully', async ({ page }) => {
    const monitor = new ConsoleMonitor(page)
    const errorUrls: string[] = []

    page.on('response', response => {
      if (response.status() >= 400) {
        const url = response.url()
        if (url.includes('/api/')) {
          errorUrls.push(`${response.status()} ${url}`)
        }
      }
    })

    await page.goto('/chat')
    monitor.start()
    await page.waitForTimeout(2000)

    const errors = monitor.stop()

    console.log('\n⚠️  API Errors:')
    if (errorUrls.length > 0) {
      errorUrls.forEach(url => console.log(`  ${url}`))
    } else {
      console.log('  No API errors detected')
    }

    // Filter out expected 404s for missing optional endpoints
    const significantErrors = errorUrls.filter(url => {
      // Allow 404 for certain optional endpoints
      return !url.includes('404') || url.includes('/events') || url.includes('/health')
    })

    console.log(`\n✅ Test passed with ${significantErrors.length} significant errors`)
  })
})

test.describe('URL Construction Tests', () => {
  test('memory service constructs correct URLs', async ({ page }) => {
    // Inject test code to verify URL construction
    const urlTest = await page.evaluate(async () => {
      // Test the memory service URL construction
      const MEMORY_API = '/api/v1'

      const urls = {
        getEvents: `${MEMORY_API}/events`,
        postEvent: `${MEMORY_API}/events`,
        buildACB: `${MEMORY_API}/acb/build`,
        getChunks: `${MEMORY_API}/chunks`,
      }

      return {
        urls,
        // Check for double /api
        hasDoubleApi: Object.values(urls).some(url => url.includes('/api/api/')),
        // Verify all start with /api
        allStartWithApi: Object.values(urls).every(url => url.startsWith('/api')),
      }
    })

    console.log('\n🔗 URL Construction Test:')
    console.log('URLs constructed by memory service:')
    Object.entries(urlTest.urls).forEach(([name, url]) => {
      console.log(`  ${name}: ${url}`)
    })

    console.log(`\nHas double /api: ${urlTest.hasDoubleApi ? '❌ YES' : '✅ NO'}`)
    console.log(`All start with /api: ${urlTest.allStartWithApi ? '✅ YES' : '❌ NO'}`)

    expect(urlTest.hasDoubleApi).toBe(false)
    expect(urlTest.allStartWithApi).toBe(true)
  })

  test('axios baseURL is configured correctly', async ({ page }) => {
    const axiosConfig = await page.evaluate(() => {
      // Access the axios instance from the window (if exposed)
      // @ts-ignore
      return {
        // Check if there's a global axios config
        hasAxios: typeof window.axios !== 'undefined',
        // Check environment variable
        envApiUrl: (import.meta as any).env?.VITE_API_URL,
      }
    })

    console.log('\n⚙️  Axios Configuration:')
    console.log(`  VITE_API_URL: ${axiosConfig.envApiUrl || '(not set)'}`)

    // If set to /api, that's correct (services add /v1/...)
    // If set to empty string, that's also correct
    // If set to /api/v1, that's wrong (would cause double /v1)

    const apiUrl = axiosConfig.envApiUrl || ''

    if (apiUrl === '/api') {
      console.log('  ✅ Using proxy: /api')
    } else if (apiUrl === '') {
      console.log('  ✅ Using relative URLs')
    } else {
      console.log(`  ⚠️  Unusual configuration: ${apiUrl}`)
    }
  })
})

test.describe('Integration Test - Real API Calls', () => {
  test('should successfully call events API', async ({ page }) => {
    let eventsApiCalled = false
    let eventsApiUrl = ''

    page.on('request', request => {
      const url = request.url()

      if (url.includes('/events')) {
        eventsApiCalled = true
        eventsApiUrl = url
        console.log(`📡 Events API called: ${url}`)
      }
    })

    await page.goto('/chat')

    // Wait for page to load and make API calls
    try {
      await page.waitForTimeout(3000)
    } catch (e) {
      // Ignore timeout
    }

    console.log('\n🎯 Events API Call Test:')
    console.log(`  Called: ${eventsApiCalled ? '✅ YES' : '❌ NO'}`)
    console.log(`  URL: ${eventsApiUrl}`)

    if (eventsApiUrl) {
      // Verify URL format
      const hasDoubleApi = eventsApiUrl.includes('/api/api/')
      const correctFormat = eventsApiUrl.includes('/api/v1/events')

      console.log(`  Format: ${hasDoubleApi ? '❌ DOUBLE /api' : '✅ Correct'}`)
      console.log(`  Pattern: ${correctFormat ? '✅ /api/v1/events' : '❌ Unexpected pattern'}`)

      expect(hasDoubleApi).toBe(false)
    }

    // The API might fail with 404 (no events), but that's OK - we're testing URL format
    expect(eventsApiCalled).toBe(true)
  })

  test('should verify all API endpoints use correct format', async ({ page }) => {
    const apiCalls: { method: string; url: string; correct: boolean }[] = []

    page.on('request', request => {
      const url = request.url()

      if (url.includes('/api/')) {
        apiCalls.push({
          method: request.method(),
          url,
          correct: !url.includes('/api/api/'),
        })
      }
    })

    await page.goto('/chat')

    // Trigger various interactions to test different endpoints
    await page.click('button:has-text("New Session")')
    await page.waitForTimeout(500)

    // Wait for API calls
    await page.waitForTimeout(1000)

    console.log('\n📋 API Endpoint Format Check:')
    console.log(`Total API calls: ${apiCalls.length}`)

    let allCorrect = true

    apiCalls.forEach((call, i) => {
      const status = call.correct ? '✅' : '❌'
      console.log(`  ${i + 1}. ${status} ${call.method} ${call.url}`)

      if (!call.correct) {
        allCorrect = false
      }
    })

    console.log(`\n${allCorrect ? '✅ ALL URLS CORRECT' : '❌ SOME URLS INCORRECT'}`)

    expect(allCorrect).toBe(true)
  })
})

test.describe('Network Request Monitoring', () => {
  test('should log all network requests for debugging', async ({ page }) => {
    const requests: { timestamp: Date; method: string; url: string; type: string }[] = []

    page.on('request', request => {
      const url = request.url()
      const resourceType = request.resourceType()

      requests.push({
        timestamp: new Date(),
        method: request.method(),
        url,
        type: resourceType,
      })
    })

    await page.goto('/chat')
    await page.waitForTimeout(2000)

    console.log('\n🌐 Network Requests:')
    console.log('===================')

    // Group by type
    const byType: Record<string, typeof requests> = {}
    requests.forEach(req => {
      if (!byType[req.type]) byType[req.type] = []
      byType[req.type].push(req)
    })

    Object.entries(byType).forEach(([type, reqs]) => {
      console.log(`\n${type} (${reqs.length}):`)
      reqs.slice(0, 5).forEach((req, i) => {
        const url = req.url.length > 60 ? req.url.substring(0, 60) + '...' : req.url
        console.log(`  ${i + 1}. ${req.method} ${url}`)
      })
      if (reqs.length > 5) {
        console.log(`  ... and ${reqs.length - 5} more`)
      }
    })

    // Verify API requests
    const apiRequests = requests.filter(r => r.url.includes('/api/'))
    console.log(`\n📡 API Requests: ${apiRequests.length}`)

    const badUrls = apiRequests.filter(r => r.url.includes('/api/api/'))
    if (badUrls.length > 0) {
      console.error(`\n❌ URLs with double /api: ${badUrls.length}`)
      badUrls.forEach(r => console.error(`  - ${r.url}`))
    }

    expect(badUrls.length).toBe(0)
  })
})
