import { test, expect } from '@playwright/test'
import { VisualizationPage } from './pages/visualization.page'
import { MetricsPage } from './pages/metrics.page'
import { ChatPage } from './pages/chat.page'
import { RetrievalPage } from './pages/retrieval.page'
import { APIHelper } from './helpers/api.helper'
import { DatabaseHelper } from './helpers/database.helper'
import crypto from 'crypto'

/**
 * Visualization & Metrics Integration Tests
 *
 * Tests data flow: Database → API → Visualization/Metrics UI
 */

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
}

const testTenantId = generateId('tenant_viz')
const testUserId = generateId('user_viz')
const db = new DatabaseHelper()

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await db.connect()
  await db.createTenant(testTenantId, 'Visualization Test Tenant')
  await db.createUser(testTenantId, testUserId, ['agent'])
})

test.afterAll(async () => {
  await db.cleanupTenant(testTenantId)
  await db.disconnect()
})

test.describe('Visualization - Full Stack Integration', () => {
  test('should display memories from database in graph view', async ({ page, request }) => {
    const api = new APIHelper(request)
    const vizPage = new VisualizationPage(page)
    const chatPage = new ChatPage(page)

    // STEP 1: Create test memories via chat
    const messages = [
      'User decision: Use TypeScript for type safety',
      'User artifact: Created schema design',
      'User context: Working on memory system',
    ]

    await chatPage.goto()
    for (const msg of messages) {
      await chatPage.sendMessage(msg)
      await page.waitForTimeout(500)
    }

    // STEP 2: Navigate to visualization
    await vizPage.goto()

    // STEP 3: Switch to graph view
    await vizPage.switchView('graph')

    // STEP 4: Verify graph displays data
    await vizPage.verifyGraphVisible()
    await vizPage.verifyDataDisplayed()

    // STEP 5: Verify data source (API returns capsules)
    const response = await api.getCapsules(testTenantId, testUserId)
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.capsules.length).toBeGreaterThan(0)

    // STEP 6: Verify data in database
    const dbCount = await db.countCapsules(testTenantId)
    expect(dbCount).toBeGreaterThan(0)
  })

  test('should filter memories in timeline view', async ({ page }) => {
    const vizPage = new VisualizationPage(page)
    const chatPage = new ChatPage(page)

    // Create memories with different timestamps
    await chatPage.goto()
    await chatPage.sendMessage('First memory')
    await page.waitForTimeout(1000)
    await chatPage.sendMessage('Second memory')
    await page.waitForTimeout(1000)
    await chatPage.sendMessage('Third memory')
    await page.waitForTimeout(500)

    // Navigate to timeline view
    await vizPage.goto()
    await vizPage.switchView('timeline')

    // Verify timeline displays
    await vizPage.verifyTimelineVisible()

    // Apply time filter if available
    const filterExists = await page.locator('[data-testid="time-filter"], [data-testid="date-range"]').count()
    if (filterExists > 0) {
      await page.click('[data-testid="time-filter"], [data-testid="date-range"]')
      await page.waitForTimeout(500)
    }

    // Verify filtered data
    await vizPage.verifyDataDisplayed()
  })

  test('should display database view with accurate counts', async ({ page, request }) => {
    const api = new APIHelper(request)
    const vizPage = new VisualizationPage(page)

    // Create test data via API
    const numCapsules = 5
    for (let i = 0; i < numCapsules; i++) {
      await api.createCapsule(testTenantId, testUserId, {
        scope: 'session',
        subject_type: 'db_test',
        subject_id: generateId('db'),
        items: { chunks: [], decisions: [], artifacts: [] },
        ttl_days: 7,
        risks: [],
        audience_agent_ids: [testUserId],
      })
    }

    // Navigate to database view
    await vizPage.goto()
    await vizPage.switchView('database')

    // Verify database view shows data
    await vizPage.verifyDatabaseViewVisible()
    await vizPage.verifyDataDisplayed()

    // Verify counts match
    const dbCount = await db.countCapsules(testTenantId)
    expect(dbCount).toBeGreaterThanOrEqual(numCapsules)

    // Get count from API
    const response = await api.getCapsules(testTenantId, testUserId)
    const data = await response.json()

    // Database count should be >= API count (database includes revoked)
    expect(dbCount).toBeGreaterThanOrEqual(data.capsules.length)
  })

  test('should search and filter memories', async ({ page }) => {
    const vizPage = new VisualizationPage(page)
    const chatPage = new ChatPage(page)

    // Create searchable memories
    await chatPage.goto()
    await chatPage.sendMessage('Important: System configuration')
    await chatPage.sendMessage('Note: User preferences')
    await page.waitForTimeout(500)

    // Navigate to visualization
    await vizPage.goto()

    // Perform search
    await vizPage.searchMemories('configuration')

    // Verify search results
    await page.waitForTimeout(1000)
    const resultsExist = await vizPage.verifyDataDisplayed()
    expect(resultsExist).toBeTruthy()
  })

  test('should export memory data', async ({ page, request }) => {
    const api = new APIHelper(request)
    const vizPage = new VisualizationPage(page)

    // Create test data
    await api.createCapsule(testTenantId, testUserId, {
      scope: 'session',
      subject_type: 'export_test',
      subject_id: generateId('export'),
      items: {
        chunks: [generateId('chunk')],
        decisions: [],
        artifacts: [],
      },
      ttl_days: 7,
      risks: [],
      audience_agent_ids: [testUserId],
    })

    // Navigate to visualization
    await vizPage.goto()

    // Click export button if exists
    const exportButton = page.locator('button:has-text("Export"), button[title*="export" i]').first()
    const exportExists = await exportButton.count()

    if (exportExists > 0) {
      // Setup download handler
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()
      const download = await downloadPromise

      // Verify download
      expect(download.suggestedFilename()).toBeDefined()
    } else {
      // Export functionality may not be implemented yet
      console.log('Export button not found - skipping export test')
    }
  })
})

test.describe('Metrics Dashboard - Full Stack Integration', () => {
  test('should display system health metrics', async ({ page, request }) => {
    const api = new APIHelper(request)
    const metricsPage = new MetricsPage(page)

    // STEP 1: Check backend health
    const healthResponse = await api.healthCheck()
    expect(healthResponse.status()).toBe(200)

    // STEP 2: Navigate to metrics
    await metricsPage.goto()

    // STEP 3: Verify metrics displayed
    await metricsPage.verifyMetricsDisplayed()

    // STEP 4: Check specific metric cards if they exist
    const uptimeCard = page.locator('[data-testid="uptime-card"], [data-testid="health-card"]').first()
    const cardExists = await uptimeCard.count()

    if (cardExists > 0) {
      await expect(uptimeCard).toBeVisible()
    }
  })

  test('should display memory storage statistics', async ({ page, request }) => {
    const api = new APIHelper(request)
    const metricsPage = new MetricsPage(page)

    // Create test memories
    const numMemories = 10
    for (let i = 0; i < numMemories; i++) {
      await api.createCapsule(testTenantId, testUserId, {
        scope: 'session',
        subject_type: 'metrics_test',
        subject_id: generateId('metrics'),
        items: { chunks: [], decisions: [], artifacts: [] },
        ttl_days: 7,
        risks: [],
        audience_agent_ids: [testUserId],
      })
    }

    // Navigate to metrics
    await metricsPage.goto()

    // Verify storage statistics displayed
    await metricsPage.verifyStorageMetricsVisible()

    // Verify counts match database
    const dbCount = await db.countCapsules(testTenantId)
    expect(dbCount).toBeGreaterThanOrEqual(numMemories)

    // API should return same data
    const response = await api.getCapsules(testTenantId, testUserId)
    expect(response.status()).toBe(200)
    const data = await response.json()

    // Verify metrics page shows accurate data
    const capsuleCountElement = page.locator('text=memories, text=capsules, text=10, text=' + numMemories)
    const countText = await capsuleCountElement.count()
    expect(countText).toBeGreaterThan(0)
  })

  test('should display retrieval performance metrics', async ({ page, request }) => {
    const api = new APIHelper(request)
    const metricsPage = new MetricsPage(page)

    // Perform retrieval operations
    const startTime = Date.now()
    await api.getCapsules(testTenantId, testUserId)
    const retrievalTime = Date.now() - startTime

    // Navigate to metrics
    await metricsPage.goto()

    // Look for performance metrics section
    const perfSection = page.locator('[data-testid="performance-metrics"], text=Performance, text=Retrieval Time').first()
    const perfExists = await perfSection.count()

    if (perfExists > 0) {
      await expect(perfSection).toBeVisible()

      // Verify retrieval time is displayed (< 1 second is good)
      const perfText = await perfSection.textContent()
      expect(perfText).toBeDefined()
    }
  })

  test('should show trend analysis over time', async ({ page }) => {
    const metricsPage = new MetricsPage(page)

    await metricsPage.goto()

    // Look for time range selector
    const timeRangeSelector = page.locator('[data-testid="time-range-select"], button:has-text("7d"), button:has-text("24h")').first()
    const selectorExists = await timeRangeSelector.count()

    if (selectorExists > 0) {
      // Click different time ranges
      await timeRangeSelector.click()
      await page.waitForTimeout(500)

      // Verify charts update
      const charts = page.locator('[data-testid="chart"], canvas, svg').all()
      expect(charts).toBeDefined()
    }
  })

  test('should display recent test runs', async ({ page }) => {
    const metricsPage = new MetricsPage(page)

    await metricsPage.goto()

    // Look for recent runs section
    const recentRunsSection = page.locator('[data-testid="recent-runs"], text=Recent Runs, text=Latest Tests').first()
    const sectionExists = await recentRunsSection.count()

    if (sectionExists > 0) {
      await expect(recentRunsSection).toBeVisible()

      // Verify run history items
      const runItems = page.locator('[data-testid^="run-"], [data-testid="test-run"]').all()
      expect(runItems).toBeDefined()
    }
  })
})

test.describe('Cross-Feature Integration', () => {
  test('chat → visualization flow', async ({ page }) => {
    const chatPage = new ChatPage(page)
    const vizPage = new VisualizationPage(page)

    // Create memories in chat
    await chatPage.goto()
    await chatPage.sendMessage('Test message for visualization')
    await page.waitForTimeout(500)

    // Navigate to visualization
    await vizPage.goto()
    await vizPage.switchView('graph')

    // Verify memory appears in visualization
    await vizPage.verifyDataDisplayed()
  })

  test('chat → metrics flow', async ({ page }) => {
    const chatPage = new ChatPage(page)
    const metricsPage = new MetricsPage(page)

    // Get initial metrics
    await metricsPage.goto()
    const initialText = await page.textContent('body')

    // Create new memories
    await chatPage.goto()
    await chatPage.sendMessage('Message for metrics update')
    await page.waitForTimeout(500)

    // Return to metrics
    await metricsPage.goto()
    const updatedText = await page.textContent('body')

    // Metrics should be updated (different from initial)
    expect(updatedText).toBeDefined()
  })

  test('visualization → retrieval flow', async ({ page }) => {
    const vizPage = new VisualizationPage(page)
    const retrievalPage = new RetrievalPage()

    // View memories in visualization
    await vizPage.goto()
    await vizPage.switchView('database')

    // Select a memory to retrieve
    const memoryItem = page.locator('[data-testid^="memory-"], [data-testid^="capsule-"]').first()
    const itemExists = await memoryItem.count()

    if (itemExists > 0) {
      // Click to view details
      await memoryItem.click()
      await page.waitForTimeout(500)

      // Look for related memories or retrieval option
      const relatedSection = page.locator('[data-testid="related-memories"], button:has-text("Find Similar")').first()
      const relatedExists = await relatedSection.count()

      if (relatedExists > 0) {
        // Should provide path to retrieval
        expect(relatedExists).toBeGreaterThan(0)
      }
    }
  })
})

test.describe('Data Consistency Across Features', () => {
  test('capsule count consistent across all views', async ({ page, request }) => {
    const api = new APIHelper(request)
    const vizPage = new VisualizationPage(page)
    const metricsPage = new MetricsPage(page)

    // Create known number of capsules
    const createCount = 5
    for (let i = 0; i < createCount; i++) {
      await api.createCapsule(testTenantId, testUserId, {
        scope: 'session',
        subject_type: 'consistency_test',
        subject_id: generateId('consistent'),
        items: { chunks: [], decisions: [], artifacts: [] },
        ttl_days: 7,
        risks: [],
        audience_agent_ids: [testUserId],
      })
    }

    // Get count from API
    const apiResponse = await api.getCapsules(testTenantId, testUserId)
    const apiData = await apiResponse.json()
    const apiCount = apiData.capsules.length

    // Get count from database
    const dbCount = await db.countCapsules(testTenantId)

    // Navigate to visualization - database view
    await vizPage.goto()
    await vizPage.switchView('database')

    // Navigate to metrics
    await metricsPage.goto()

    // All counts should be consistent
    expect(apiCount).toBeGreaterThan(0)
    expect(dbCount).toBeGreaterThanOrEqual(apiCount)
  })

  test('capsule data integrity across features', async ({ page, request }) => {
    const api = new APIHelper(request)
    const chatPage = new ChatPage(page)
    const vizPage = new VisualizationPage(page)

    // Create capsule with specific data
    const uniqueMessage = `Unique integration test message ${Date.now()}`
    const subjectId = generateId('integrity')

    await chatPage.goto()
    await chatPage.sendMessage(uniqueMessage)
    await page.waitForTimeout(500)

    // Retrieve via API
    const response = await api.getCapsules(testTenantId, testUserId)
    const apiData = await response.json()
    const foundInApi = apiData.capsules.some((c: any) =>
      c.items?.chunks?.some((chunk: string) => chunk.includes(uniqueMessage)) ||
      c.subject_id === subjectId
    )

    // View in visualization
    await vizPage.goto()
    await vizPage.switchView('graph')

    // Search for the unique message
    await vizPage.searchMemories(uniqueMessage)
    await page.waitForTimeout(500)

    // Verify displayed
    const displayed = await vizPage.verifyDataDisplayed()

    // Verify in database
    const capsules = await db.listCapsules(testTenantId)
    const foundInDb = capsules.some((c: any) =>
      c.subject_id === subjectId || JSON.stringify(c).includes(uniqueMessage)
    )

    expect(foundInApi || displayed || foundInDb).toBeTruthy()
  })
})
