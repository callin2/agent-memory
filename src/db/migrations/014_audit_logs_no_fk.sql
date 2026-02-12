-- Audit logs may reference unknown or deleted users.
-- Keep user_id as an optional string without FK enforcement.

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS fk_audit_user;
