import axios from 'axios'
import type { ACBRequest, ACBResponse } from '@/types'

// Use root path for Vite proxy - services include full /api/v1 path
// This prevents double /api in URLs
const API_URL = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Transparent Memory API Helper Functions
 *
 * Backend auto-captures events and auto-builds ACB via middleware.
 * Frontend just needs to include context headers: x-session-id, x-agent-id, x-tenant-id
 */

/**
 * Send a chat message with transparent memory capture
 * Backend middleware auto-records the event, no explicit API call needed
 */
export async function sendChatMessage(params: {
  sessionId: string
  agentId: string
  tenantId?: string
  channel: string
  intent?: string
  message: {
    text: string
    metadata?: Record<string, unknown>
  }
}): Promise<void> {
  await api.post('/v1/chat', params.message, {
    headers: {
      'x-session-id': params.sessionId,
      'x-agent-id': params.agentId,
      'x-tenant-id': params.tenantId || 'default',
      'x-channel': params.channel,
      ...(params.intent && { 'x-intent': params.intent }),
    },
  })
}

/**
 * Request ACB with transparent context building
 * Backend middleware auto-builds ACB from session history
 */
export async function requestACB(params: ACBRequest & {
  sessionId: string
  agentId: string
  tenantId?: string
}): Promise<ACBResponse> {
  // Remove sessionId/agentId/tenantId from body since they go in headers
  const { sessionId, agentId, tenantId, ...acbParams } = params

  const response = await api.post<ACBResponse>(
    '/v1/acb/build',
    acbParams,
    {
      headers: {
        'x-session-id': sessionId,
        'x-agent-id': agentId,
        'x-tenant-id': tenantId || 'default',
      },
    }
  )

  return response.data
}

export default api
