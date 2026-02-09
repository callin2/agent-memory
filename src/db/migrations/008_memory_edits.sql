-- Migration 008: Memory Surgery Operations
-- Creates memory_edits table for memory governance (retract, amend, quarantine, attenuate, block)

CREATE TABLE IF NOT EXISTS memory_edits (
  edit_id         TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_type     TEXT NOT NULL CHECK (target_type IN ('chunk', 'decision', 'capsule')),
  target_id       TEXT NOT NULL,
  op              TEXT NOT NULL CHECK (op IN ('retract', 'amend', 'quarantine', 'attenuate', 'block')),
  reason          TEXT NOT NULL,
  proposed_by     TEXT NOT NULL CHECK (proposed_by IN ('human', 'agent')),
  approved_by     TEXT,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  patch           JSONB NOT NULL, -- {text?: string, importance?: number, importance_delta?: number, channel?: string}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at      TIMESTAMPTZ,

  -- Foreign key constraints
  CONSTRAINT fk_edit_proposer
    FOREIGN KEY (proposed_by) REFERENCES users(user_id) ON DELETE RESTRICT,

  CONSTRAINT fk_edit_approver
    FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Indexes for memory edit queries

-- Apply edits by target (chunk, decision, capsule)
CREATE INDEX idx_edits_tenant_target
  ON memory_edits (tenant_id, target_type, target_id, status)
  WHERE status = 'approved';

-- Audit trail queries by status
CREATE INDEX idx_edits_tenant_status
  ON memory_edits (tenant_id, status, applied_at);

-- Index for proposed_by queries
CREATE INDEX idx_edits_proposed_by
  ON memory_edits (tenant_id, proposed_by, ts DESC);

-- Index for approved_by queries (audit trail)
CREATE INDEX idx_edits_approved_by
  ON memory_edits (tenant_id, approved_by, applied_at DESC)
  WHERE approved_by IS NOT NULL;

-- Comments for documentation
COMMENT ON TABLE memory_edits IS 'Audit trail for memory modifications with governance workflow';
COMMENT ON COLUMN memory_edits.edit_id IS 'Unique edit identifier';
COMMENT ON COLUMN memory_edits.tenant_id IS 'Tenant ID for isolation';
COMMENT ON COLUMN memory_edits.target_type IS 'chunk, decision, or capsule';
COMMENT ON COLUMN memory_edits.target_id IS 'ID of the target memory item';
COMMENT ON COLUMN memory_edits.op IS 'Operation: retract, amend, quarantine, attenuate, block';
COMMENT ON COLUMN memory_edits.reason IS 'Reason for the edit';
COMMENT ON COLUMN memory_edits.proposed_by IS 'User or agent who proposed the edit';
COMMENT ON COLUMN memory_edits.approved_by IS 'User who approved the edit (if approval required)';
COMMENT ON COLUMN memory_edits.status IS 'pending, approved, or rejected';
COMMENT ON COLUMN memory_edits.patch IS 'JSONB patch data (text replacement, importance change, etc.)';
COMMENT ON COLUMN memory_edits.applied_at IS 'Timestamp when edit was applied';

-- Edit operation semantics:
-- retract: Exclude from ALL queries (hard delete without data loss)
-- amend: Replace text and/or importance
-- quarantine: Exclude from auto-retrieval unless include_quarantined=true
-- attenuate: Reduce importance score (delta or absolute)
-- block: Exclude if channel matches blocked list
