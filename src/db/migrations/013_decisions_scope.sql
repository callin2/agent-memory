-- Expand allowed decision scopes to match scope+subject framework

ALTER TABLE decisions
  DROP CONSTRAINT IF EXISTS decisions_scope_check;

ALTER TABLE decisions
  ADD CONSTRAINT decisions_scope_check
  CHECK (scope IN ('session', 'user', 'project', 'policy', 'global'));
