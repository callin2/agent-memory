-- ============================================================================
-- Migration 026: Episodic vs Semantic Memory Distinction
-- ============================================================================
-- Task: https://github.com/callin/agent_memory_v2/issues/11
-- Expert: Domain + Cognitive Science
-- Priority: P1/HIGH (research completeness)
-- Effort: 12-16 hours (1.5-2 days)
-- Impact: Matches human memory architecture (Tulving, 1972)
--
-- Problem:
-- - Current system treats all memories as episodes (sessions)
-- - No distinction between time-bound events and timeless principles
-- - Misses opportunity to extract generalized knowledge
--
-- Solution:
-- 1. Add memory_type enum to session_handoffs (episodic by default)
-- 2. Create semantic_memory table for principles/patterns
-- 3. Add foreign key from semantic → episodic (source material)
-- 4. Enable cross-episode knowledge extraction
--
-- Research Basis:
-- - Episodic Memory: "What, when, where" (Tulving, 1972)
-- - Semantic Memory: "Timeless principles, facts, concepts"
-- - Humans extract semantic knowledge from episodic experience
-- - Example: "I used TypeScript in Project X" → "TypeScript good for large apps"
--
-- ============================================================================

-- Add memory_type enum to session_handoffs
ALTER TABLE session_handoffs
  ADD COLUMN IF NOT EXISTS memory_type TEXT
    CHECK (memory_type IN ('episodic', 'semantic'))
    DEFAULT 'episodic';

COMMENT ON COLUMN session_handoffs.memory_type IS
  'Episodic: time-bound sessions (what/when/where). Semantic: timeless principles (generalized knowledge).';

-- Create semantic_memory table for generalized principles
CREATE TABLE IF NOT EXISTS semantic_memory (
  semantic_id TEXT PRIMARY KEY DEFAULT ('sm_' || encode(gen_random_bytes(16), 'hex')),

  -- Ownership
  tenant_id TEXT NOT NULL DEFAULT 'default',

  -- Core content
  principle TEXT NOT NULL,           -- The principle/lesson (timeless)
  context TEXT,                      -- Example/context (optional)

  -- Metadata
  category TEXT,                      -- e.g., 'coding', 'communication', 'problem-solving'
  confidence NUMERIC(3, 2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),

  -- Source tracking (which episodes informed this principle)
  source_handoff_ids TEXT[] DEFAULT '{}',
  source_count INT DEFAULT 0,

  -- Tags for retrieval
  tags TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_reinforced_at TIMESTAMPTZ,

  -- Foreign key to tenants
  CONSTRAINT fk_semantic_memory_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE
);

-- Indexes for semantic memory
CREATE INDEX IF NOT EXISTS idx_semantic_memory_tenant_category
  ON semantic_memory(tenant_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_tenant_confidence
  ON semantic_memory(tenant_id, confidence DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_tags
  ON semantic_memory USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_fts
  ON semantic_memory USING GIN (
    to_tsvector('english',
      coalesce(principle, '') || ' ' ||
      coalesce(context, '')
    )
  );

-- Comments
COMMENT ON TABLE semantic_memory IS
  'Semantic memory: timeless principles, patterns, and generalized knowledge extracted from episodic experiences.';

COMMENT ON COLUMN semantic_memory.principle IS
  'The timeless principle/lesson (e.g., "TypeScript is good for large applications")';

COMMENT ON COLUMN semantic_memory.context IS
  'Concrete example or context (e.g., "Used in Project X with 50+ files")';

COMMENT ON COLUMN semantic_memory.category IS
  'Domain category: coding, communication, problem-solving, etc.';

COMMENT ON COLUMN semantic_memory.confidence IS
  'How certain we are this principle is correct (0.0-1.0). Reinforced by repeated observation.';

COMMENT ON COLUMN semantic_memory.source_handoff_ids IS
  'Episodic memories that informed this principle. Enables traceability.';

COMMENT ON COLUMN semantic_memory.last_reinforced_at IS
  'Last time this principle was observed/confirmed. Principles fade if not reinforced.';

-- ============================================================================
-- Episodic vs Semantic Memory Examples
-- ============================================================================
--
-- EPISODIC (session_handoffs):
-- "On 2026-02-18, I used TypeScript with React in Project X. The type system
--  caught 3 bugs at compile time. Team appreciated the safety."
--
-- SEMANTIC (semantic_memory):
-- Principle: "TypeScript prevents bugs in large React applications"
-- Context: "Caught 3 compile-time bugs in Project X"
-- Category: "coding"
-- Confidence: 0.8
--
-- EPISODIC:
-- "User said they didn't like the complex UI. I simplified it to 3 buttons.
--  User satisfaction increased from 2.1 to 4.7 stars."
--
-- SEMANTIC:
-- Principle: "Simple UI beats complex features for user satisfaction"
-- Context: "Simplified from 8 widgets to 3 buttons, +123% satisfaction"
-- Category: "ux-design"
-- Confidence: 0.9
--
-- ============================================================================
-- Extraction Process (Consolidation)
-- ============================================================================
--
-- 1. Collect episodic memories (last 30 days)
-- 2. LLM identifies patterns across episodes
-- 3. Extract timeless principles
-- 4. Calculate confidence (frequency × significance)
-- 5. Store in semantic_memory table
-- 6. Link back to source episodes via source_handoff_ids
--
-- ============================================================================
-- Usage in wake_up
-- ============================================================================
--
-- Load order:
-- 1. Semantic principles (~100 tokens) - "What I know"
-- 2. Recent episodes (~500 tokens) - "What happened recently"
-- 3. Progressive retrieval (on-demand) - "Specific details"
--
-- This matches human memory: General knowledge → Recent events → Details
--
-- ============================================================================

-- Enable episodic ↔ semantic linking
ALTER TABLE session_handoffs
  ADD COLUMN IF NOT EXISTS semantic_id TEXT REFERENCES semantic_memory(semantic_id);

COMMENT ON COLUMN session_handoffs.semantic_id IS
  'If this episode was consolidated into a semantic principle, link to it.';

-- ============================================================================
-- Verification Queries
-- ============================================================================
--
-- Check semantic memory count:
-- SELECT COUNT(*) FROM semantic_memory;
--
-- View principles by category:
-- SELECT category, COUNT(*) FROM semantic_memory GROUP BY category;
--
-- Find high-confidence principles:
-- SELECT principle, confidence FROM semantic_memory WHERE confidence >= 0.8;
--
-- Track principle reinforcement:
-- SELECT semantic_id, principle, source_count, last_reinforced_at
-- FROM semantic_memory
-- ORDER BY source_count DESC;
--
-- ============================================================================
