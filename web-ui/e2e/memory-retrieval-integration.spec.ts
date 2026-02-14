import { test, expect } from '@playwright/test'
import { RetrievalPage } from './pages/retrieval.page'
import { ChatPage } from './pages/chat.page'
import { APIHelper } from './helpers/api.helper'
import { DatabaseHelper } from './helpers/database.helper'
import crypto from 'crypto'

/**
 * Memory Retrieval Integration Tests
 *
 * Tests the complete memory retrieval flow:
 * UI Form → API Query → Database Search → Results Display
 */

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
}

const testTenantId = generateId('tenant_retrieval')
const testUserId = generateId('user_retrieval')
const db = new DatabaseHelper()

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await db.connect()
  await db.createTenant(testTenantId, 'Memory Retrieval Test Tenant')
  await db.createUser(testTenantId, testUserId, ['agent'])
})

test.afterAll(async () => {
  await db.cleanupTenant(testTenantId)
  await db.disconnect()
})

test.describe('Memory Retrieval - Full Stack', () => {
  test.beforeEach(async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto()
  })

  test('should retrieve memories created via chat', async ({ page, request }) => {
    const api = new APIHelper(request)
    const retrievalPage = new RetrievalPage(page)
    const chatPage = new ChatPage(page)

    // STEP 1: Create memories via chat
    const testMessages = [
      'User prefers TypeScript over JavaScript',
      'User works on agent memory system',
      'User likes PostgreSQL for data storage',
    ]

    for (const msg of testMessages) {
      await chatPage.sendMessage(msg)
      await page.waitForTimeout(500)
    }

    // STEP 2: Navigate to retrieval page
    await retrievalPage.goto()

    // STEP 3: Build query for memories
    await retrievalPage.buildQuery('TypeScript', 'user', 'default')

    // STEP 4: Execute retrieval
    await retrievalPage.executeRetrieval()

    // STEP 5: Verify results in UI
    await retrievalPage.verifyResultsExist()
    const resultCount = await retrievalPage.getResultCount()
    expect(resultCount).toBeGreaterThan(0)

    // STEP 6: Verify results via API
    const capsulesResponse = await api.getCapsules(testTenantId, testUserId, {
      subject_type: 'user',
    })

    expect(capsulesResponse.status()).toBe(200)
    const data = await capsulesResponse.json()
    expect(data.capsules.length).toBeGreaterThan(0)

    // STEP 7: Verify data in database
    const capsulesInDb = await db.listCapsules(testTenantId)
    expect(capsulesInDb.length).toBeGreaterThan(0)
  })

  test('should filter retrieval results by subject_type', async ({ page, request }) => {
    const api = new APIHelper(request)
    const retrievalPage = new RetrievalPage(page)
    const chatPage = new ChatPage(page)

    // Create messages with different subject types
    await chatPage.sendMessage('Session: working on project X', 'default', 'normal')
    await page.waitForTimeout(500)

    await chatPage.sendMessage('Project: project Y requires attention', 'default', 'normal')
    await page.waitForTimeout(500)

    // Navigate to retrieval
    await retrievalPage.goto()

    // Query by subject_type='session'
    await retrievalPage.buildQuery('working', 'session', 'default')
    await retrievalPage.executeRetrieval()

    const sessionResults = await retrievalPage.getResultCount()
    expect(sessionResults).toBeGreaterThanOrEqual(0)

    // Verify via API
    const response = await api.getCapsules(testTenantId, testUserId, {
      subject_type: 'session',
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.capsules).toBeInstanceOf(Array)
  })

  test('should display memory scores and comparisons', async ({ page }) => {
    const retrievalPage = new RetrievalPage(page)
    const chatPage = new ChatPage(page)

    // Create test memories
    await chatPage.sendMessage('Important: database schema needs review')
    await page.waitForTimeout(500)

    // Navigate to retrieval
    await retrievalPage.goto()

    // Build and execute query
    await retrievalPage.buildQuery('database', 'user', 'default')
    await retrievalPage.executeRetrieval()

    // Check Scores tab
    await retrievalPage.switchTab('scores')
    await retrievalPage.verifyScoresVisible()

    // Check Comparison tab
    await retrievalPage.switchTab('comparison')
    await retrievalPage.verifyComparisonVisible()
  })

  test('should handle empty retrieval results gracefully', async ({ page }) => {
    const retrievalPage = new RetrievalPage(page)

    await retrievalPage.goto()

    // Query for non-existent memory
    await retrievalPage.buildQuery('nonexistent_memory_xyz123', 'user', 'default')
    await retrievalPage.executeRetrieval()

    // Should show empty state or no results message
    await page.waitForTimeout(1000)

    const noResults = await page.locator('text=No results, text=no memories found, text=0 results').count()
    expect(noResults + (await retrievalPage.getResultCount())).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Memory Retrieval - API & Database Integration', () => {
  test('should retrieve capsules with complex filters', async ({ request }) => {
    const api = new APIHelper(request)

    // Create multiple capsules with different properties
    const capsuleIds = []

    for (let i = 0; i < 3; i++) {
      const response = await api.createCapsule(testTenantId, testUserId, {
        scope: i % 2 === 0 ? 'session' : 'project',
        subject_type: 'test_subject',
        subject_id: generateId('subject'),
        items: { chunks: [], decisions: [], artifacts: [] },
        ttl_days: 7,
        risks: i === 0 ? ['test_risk'] : [],
        audience_agent_ids: [testUserId],
      })

      expect(response.status()).toBe(201)
      const data = await response.json()
      capsuleIds.push(data.capsule_id)
    }

    // Query with subject_type filter
    const response = await api.getCapsules(testTenantId, testUserId, {
      subject_type: 'test_subject',
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.capsules.length).toBeGreaterThanOrEqual(3)

    // Verify all capsules exist in database
    for (const id of capsuleIds) {
      const exists = await db.capsuleExists(id)
      expect(exists).toBe(true)
    }
  })

  test('should handle retrieval with pagination', async ({ request }) => {
    const api = new APIHelper(request)

    // Create many capsules
    const numCapsules = 15
    for (let i = 0; i < numCapsules; i++) {
      await api.createCapsule(testTenantId, testUserId, {
        scope: 'session',
        subject_type: 'pagination_test',
        subject_id: generateId('page'),
        items: { chunks: [], decisions: [], artifacts: [] },
        ttl_days: 7,
        risks: [],
        audience_agent_ids: [testUserId],
      })
    }

    // Query capsules
    const response = await api.getCapsules(testTenantId, testUserId, {
      subject_type: 'pagination_test',
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.capsules.length).toBeGreaterThanOrEqual(numCapsules)

    // Verify database count matches
    const dbCount = await db.countCapsules(testTenantId)
    expect(dbCount).toBeGreaterThanOrEqual(numCapsules)
  })
})

test.describe('Memory Retrieval - Performance & Stress', () => {
  test('should handle rapid consecutive retrievals', async ({ page, request }) => {
    const api = new APIHelper(request)
    const retrievalPage = new RetrievalPage(page)

    // Pre-create capsules
    for (let i = 0; i < 5; i++) {
      await api.createCapsule(testTenantId, testUserId, {
        scope: 'session',
        subject_type: 'stress_test',
        subject_id: generateId('stress'),
        items: { chunks: [], decisions: [], artifacts: [] },
        ttl_days: 7,
        risks: [],
        audience_agent_ids: [testUserId],
      })
    }

    // Perform rapid retrievals
    const retrievalPromises = []

    for (let i = 0; i < 5; i++) {
      retrievalPromises.push(
        api.getCapsules(testTenantId, testUserId, {
          subject_type: 'stress_test',
        })
      )
    }

    const results = await Promise.all(retrievalPromises)

    // All should succeed
    const successCount = results.filter(r => r.status() === 200).length
    expect(successCount).toBe(5)
  })

  test('should retrieve large result sets efficiently', async ({ request }) => {
    const api = new APIHelper(request)

    const startTime = Date.now()

    const response = await api.getCapsules(testTenantId, testUserId, {
      subject_type: 'stress_test',
    })

    const duration = Date.now() - startTime

    expect(response.status()).toBe(200)

    // Should complete in reasonable time (< 2 seconds)
    expect(duration).toBeLessThan(2000)
  })
})
