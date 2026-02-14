/**
 * Integration Tests: Transparent Memory
 *
 * Tests for transparent memory system:
 * - POST /api/v1/events (explicit API)
 * - GET /api/v1/events (query by session)
 * - Verify events are stored and retrieved correctly
 *
 * This verifies Phase 1 foundation works as expected.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../dist/server.js';

describe('Transparent Memory Integration Tests', () => {
  const tenantId = 'test-tenant-transparent-memory';
  const sessionId = `test-session-${Date.now()}`;

  it('stores event via explicit API call', async () => {
    const response = await request(app)
      .post('/api/v1/events')
      .send({
        tenant_id: tenantId,
        session_id: sessionId,
        channel: 'agent',
        actor: {
          type: 'agent',
          id: 'test-agent'
        },
        kind: 'message',
        content: {
          text: 'test message for transparent memory'
        },
        scope: {
          subject_type: 'user',
          subject_id: 'test-user'
        }
      });

    expect(response.status).toBe(201);
    expect(response.body.event_id).toMatch(/^evt_[a-f0-9]{16}$/i);
    expect(response.body.chunk_ids).toBeDefined();
    expect(Array.isArray(response.body.chunk_ids)).toBe(true);
  });

  it('retrieves events by session_id', async () => {
    const response = await request(app)
      .get(`/api/v1/events?session_id=${sessionId}&tenant_id=${tenantId}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);

    const event = response.body[0];
    expect(event.session_id).toBe(sessionId);
    expect(event.tenant_id).toBe(tenantId);
    expect(event.channel).toBe('agent');
    expect(event.content.text).toBe('test message for transparent memory');
  });

  it('retrieves specific event by event_id', async () => {
    // First create an event
    const createRes = await request(app)
      .post('/api/v1/events')
      .send({
        tenant_id: tenantId,
        session_id: sessionId,
        channel: 'agent',
        actor: { type: 'agent', id: 'test-agent' },
        kind: 'message',
        content: { text: 'specific event test' }
      });

    const eventId = createRes.body.event_id;

    // Then retrieve it
    const response = await request(app)
      .get(`/api/v1/events/${eventId}`);

    expect(response.status).toBe(200);
    expect(response.body.event_id).toBe(eventId);
    expect(response.body.content.text).toBe('specific event test');
  });

  it('returns 404 for non-existent event_id', async () => {
    const response = await request(app)
      .get('/api/v1/events/evt_0123456789abcdef');

    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });

  it('validates required fields', async () => {
    const response = await request(app)
      .post('/api/v1/events')
      .send({
        // Missing tenant_id and session_id
        channel: 'agent',
        content: { text: 'missing required fields' }
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.errors).toBeDefined();
  });
});
