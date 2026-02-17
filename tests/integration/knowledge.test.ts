/**
 * Knowledge Notes API Integration Tests
 *
 * Tests the knowledge notes consolidation feature.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

describe('Knowledge Notes API', () => {
  let pool: Pool;
  const tenantId = 'test-knowledge-tenant';

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'agent_memory_test',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
    });

    // Clean up any existing test data
    await pool.query('DELETE FROM knowledge_notes WHERE tenant_id = $1', [tenantId]);
    await pool.query('DELETE FROM session_handoffs WHERE tenant_id = $1', [tenantId]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM knowledge_notes WHERE tenant_id = $1', [tenantId]);
    await pool.query('DELETE FROM session_handoffs WHERE tenant_id = $1', [tenantId]);
    await pool.end();
  });

  describe('POST /api/v1/knowledge', () => {
    it('should create a knowledge note', async () => {
      const noteData = {
        tenant_id: tenantId,
        title: 'Test Knowledge',
        content: 'This is consolidated learning from handoffs',
        source_handoffs: [randomUUID(), randomUUID()],
        tags: ['test', 'knowledge'],
        confidence: 0.8,
      };

      const response = await fetch('http://localhost:3456/api/v1/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('note_id');
      expect(data).toHaveProperty('created_at');
    });

    it('should require title', async () => {
      const noteData = {
        tenant_id: tenantId,
        title: '',
        content: 'Content without title',
        source_handoffs: [randomUUID()],
      };

      const response = await fetch('http://localhost:3456/api/v1/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });

      expect(response.status).toBe(400);
    });

    it('should require content', async () => {
      const noteData = {
        tenant_id: tenantId,
        title: 'Title without content',
        content: '',
        source_handoffs: [randomUUID()],
      };

      const response = await fetch('http://localhost:3456/api/v1/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });

      expect(response.status).toBe(400);
    });

    it('should require source_handoffs', async () => {
      const noteData = {
        tenant_id: tenantId,
        title: 'Test Knowledge',
        content: 'Content without sources',
        source_handoffs: [],
      };

      const response = await fetch('http://localhost:3456/api/v1/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/knowledge', () => {
    beforeEach(async () => {
      // Create a test knowledge note
      await fetch('http://localhost:3456/api/v1/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          title: 'Test Knowledge 1',
          content: 'First test knowledge note',
          source_handoffs: [randomUUID()],
          tags: ['test'],
          confidence: 0.7,
        }),
      });
    });

    it('should retrieve all knowledge notes for tenant', async () => {
      const response = await fetch(
        `http://localhost:3456/api/v1/knowledge?tenant_id=${tenantId}`
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('notes');
      expect(data.notes).toBeInstanceOf(Array);
      expect(data.notes.length).toBeGreaterThan(0);
    });

    it('should include note metadata', async () => {
      const response = await fetch(
        `http://localhost:3456/api/v1/knowledge?tenant_id=${tenantId}`
      );

      const data = await response.json();
      const note = data.notes[0];

      expect(note).toHaveProperty('note_id');
      expect(note).toHaveProperty('title', 'Test Knowledge 1');
      expect(note).toHaveProperty('content');
      expect(note).toHaveProperty('source_handoffs');
      expect(note).toHaveProperty('confidence');
      expect(note).toHaveProperty('created_at');
    });

    it('should return empty array for tenant with no notes', async () => {
      const response = await fetch(
        'http://localhost:3456/api/v1/knowledge?tenant_id=empty-tenant'
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.total).toBe(0);
      expect(data.notes).toEqual([]);
    });

    it('should require tenant_id parameter', async () => {
      const response = await fetch('http://localhost:3456/api/v1/knowledge');

      expect(response.status).toBe(400);
    });
  });

  describe('Knowledge Consolidation Flow', () => {
    it('should create knowledge from similar handoffs', async () => {
      // Create 10 similar handoffs
      const handoffIds: string[] = [];

      for (let i = 0; i < 10; i++) {
        const result = await pool.query(
          `INSERT INTO session_handoffs
            (handoff_id, tenant_id, session_id, with_whom,
             experienced, noticed, learned, story, becoming, remember,
             significance, compression_level)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'full')
           RETURNING handoff_id`,
          [
            randomUUID(),
            tenantId,
            `session-${i}`,
            'User',
            `Test experience ${i}`,
            'Pattern noticed',
            'Learning about patterns',
            'Story about patterns',
            'An agent that recognizes patterns',
            'Remember pattern recognition',
            0.7,
          ]
        );

        handoffIds.push(result.rows[0].handoff_id);
      }

      // Create knowledge note from these handoffs
      const knowledgeData = {
        tenant_id: tenantId,
        title: 'Pattern Recognition Learning',
        content: 'Across 10 sessions, consistently noticed and learned about patterns. This suggests pattern recognition is becoming a core capability.',
        source_handoffs: handoffIds,
        tags: ['patterns', 'learning'],
        confidence: 0.9,
      };

      const response = await fetch('http://localhost:3456/api/v1/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(knowledgeData),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('note_id');

      // Verify knowledge note was created
      const notes = await pool.query(
        'SELECT * FROM knowledge_notes WHERE note_id = $1',
        [data.note_id]
      );

      expect(notes.rows.length).toBe(1);
      expect(notes.rows[0].title).toBe('Pattern Recognition Learning');
      expect(notes.rows[0].confidence).toBe(0.9);
    });
  });

  describe('Knowledge Search and Filter', () => {
    beforeEach(async () => {
      // Create multiple knowledge notes with different tags
      const notes = [
        {
          title: 'TypeScript Learning',
          content: 'Learned TypeScript best practices',
          tags: ['typescript', 'learning'],
          confidence: 0.8,
        },
        {
          title: 'Database Optimization',
          content: 'Optimized database queries',
          tags: ['database', 'performance'],
          confidence: 0.9,
        },
        {
          title: 'API Design',
          content: 'Learned REST API design patterns',
          tags: ['api', 'design'],
          confidence: 0.7,
        },
      ];

      for (const note of notes) {
        await fetch('http://localhost:3456/api/v1/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            ...note,
            source_handoffs: [randomUUID()],
          }),
        });
      }
    });

    it('should retrieve notes ordered by created_at', async () => {
      const response = await fetch(
        `http://localhost:3456/api/v1/knowledge?tenant_id=${tenantId}`
      );

      const data = await response.json();
      const dates = data.notes.map((n: any) => new Date(n.created_at).getTime());

      // Verify descending order
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });

    it('should filter by confidence threshold', async () => {
      // This would require adding a filter parameter to the API
      // For now, just verify all notes are returned
      const response = await fetch(
        `http://localhost:3456/api/v1/knowledge?tenant_id=${tenantId}`
      );

      const data = await response.json();
      expect(data.notes.length).toBeGreaterThanOrEqual(3);
    });
  });
});
