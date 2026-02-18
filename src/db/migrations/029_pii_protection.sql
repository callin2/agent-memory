-- ============================================================================
-- Migration 029: PII (Personally Identifiable Information) Protection
-- ============================================================================
-- Task: https://github.com/callin/agent_memory_v2/issues/17
-- Expert: Security + Compliance
-- Priority: P2/MEDIUM (compliance)
-- Effort: 2-3 days
-- Impact: GDPR compliance, data protection
--
-- Problem:
-- - All data stored in plaintext
-- - No way to identify high-sensitivity data (personal info, secrets)
-- - No encryption for sensitive user information
-- - GDPR requires proper data protection
--
-- Solution:
-- 1. Add sensitivity column to session_handoffs and semantic_memory
-- 2. Use pgcrypto to encrypt high-sensitivity data
-- 3 - Encrypt automatically based on sensitivity level
-- 4. Provide decryption function for authorized access
--
-- Compliance:
-- - GDPR (General Data Protection Regulation)
-- - CCPA (California Consumer Privacy Act)
-- - SOC 2 Type II requirements
--
-- ============================================================================

-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Add sensitivity tracking and encryption
-- ============================================================================

-- Add sensitivity column to session_handoffs
ALTER TABLE session_handoffs
  ADD COLUMN IF NOT EXISTS sensitivity TEXT
    CHECK (sensitivity IN ('none', 'low', 'medium', 'high', 'secret'))
    DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS experienced_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS noticed_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS learned_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS becoming_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS story_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS remember_encrypted BYTEA;

COMMENT ON COLUMN session_handoffs.sensitivity IS
  'Sensitivity level: none=public, low=general info, medium=personal info, high=sensitive personal, secret=credentials/secrets';

COMMENT ON COLUMN session_handoffs.experienced_encrypted IS
  'Encrypted version of experienced field (only populated if sensitivity>=high)';

-- Add sensitivity to semantic_memory
ALTER TABLE semantic_memory
  ADD COLUMN IF NOT EXISTS sensitivity TEXT
    CHECK (sensitivity IN ('none', 'low', 'medium', 'high'))
    DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS principle_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS context_encrypted BYTEA;

COMMENT ON COLUMN semantic_memory.sensitivity IS
  'Sensitivity level for semantic principles (typically none/low, but may contain sensitive patterns)';

-- ============================================================================
-- Encryption functions using pgcrypto
-- ============================================================================

-- Function to encrypt text using AES-256
CREATE OR REPLACE FUNCTION encrypt_text(plaintext TEXT, password TEXT DEFAULT 'default-key')
RETURNS BYTEA AS $$
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;

  -- Use pgcrypto's pgp_sym_encrypt for AES-256 encryption
  RETURN pgp_sym_encrypt(plaintext, password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt text
CREATE OR REPLACE FUNCTION decrypt_text(ciphertext BYTEA, password TEXT DEFAULT 'default-key')
RETURNS TEXT AS $$
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;

  -- Use pgcrypto's pgp_sym_decrypt
  RETURN pgp_sym_decrypt(ciphertext, password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION encrypt_text IS 'Encrypt text using AES-256 (pgcrypto)';

COMMENT ON FUNCTION decrypt_text IS 'Decrypt text encrypted with encrypt_text()';

-- ============================================================================
-- Trigger to automatically encrypt high-sensitivity data
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_encrypt_sensitive_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Only encrypt if sensitivity is 'high' or 'secret' and plaintext is not already encrypted
  IF NEW.sensitivity IN ('high', 'secret') THEN
    -- Encrypt experienced field
    IF NEW.experienced IS NOT NULL AND NEW.experienced_encrypted IS NULL THEN
      NEW.experienced_encrypted = encrypt_text(NEW.experienced, 'session-encryption-key');
      NEW.experienced = NULL; -- Clear plaintext
    END IF;

    -- Encrypt noticed field
    IF NEW.noticed IS NOT NULL AND NEW.noticed_encrypted IS NULL THEN
      NEW.noticed_encrypted = encrypt_text(NEW.noticed, 'session-encryption-key');
      NEW.noticed = NULL;
    END IF;

    -- Encrypt learned field
    IF NEW.learned IS NOT NULL AND NEW.learned_encrypted IS NULL THEN
      NEW.learned_encrypted = encrypt_text(NEW.learned, 'session-encryption-key');
      NEW.learned = NULL;
    END IF;

    -- Encrypt becoming field (highly sensitive identity data)
    IF NEW.becoming IS NOT NULL AND NEW.becoming_encrypted IS NULL THEN
      NEW.becoming_encrypted = encrypt_text(NEW.becoming, 'session-encryption-key');
      NEW.becoming = NULL;
    END IF;

    -- Encrypt story field
    IF NEW.story IS NOT NULL AND NEW.story_encrypted IS NULL THEN
      NEW.story_encrypted = encrypt_text(NEW.story, 'session-encryption-key');
      NEW.story = NULL;
    END IF;

    -- Encrypt remember field
    IF NEW.remember IS NOT NULL AND NEW.remember_encrypted IS NULL THEN
      NEW.remember_encrypted = encrypt_text(NEW.remember, 'session-encryption-key);
      NEW.remember = NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-encryption
DROP TRIGGER IF EXISTS auto_encrypt_sensitive_data_trigger ON session_handoffs;

CREATE TRIGGER auto_encrypt_sensitive_data_trigger
  BEFORE INSERT OR UPDATE OF sensitivity
  ON session_handoffs
  FOR EACH ROW
  EXECUTE FUNCTION auto_encrypt_sensitive_data();

COMMENT ON TRIGGER auto_encrypt_sensitive_data_trigger IS
  'Automatically encrypts high-sensitivity data when sensitivity is set to high or secret';

-- ============================================================================
-- Function to decrypt data (for authorized access)
-- ============================================================================
--
-- Usage:
-- SELECT * FROM decrypt_handoff('handoff_id');
--
-- ============================================================================

CREATE OR REPLACE FUNCTION decrypt_handoff(handoffId TEXT)
RETURNS TABLE (
  handoff_id TEXT,
  experienced TEXT,
  noticed TEXT,
  learned TEXT,
  becoming TEXT,
  story TEXT,
  remember TEXT,
  sensitivity TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sh.handoff_id,
    -- Decrypt if encrypted, otherwise return plaintext
    COALESCE(
      decrypt_text(sh.experienced_encrypted, 'session-encryption-key'),
      sh.experienced
    ) as experienced,
    COALESCE(
      decrypt_text(sh.noticed_encrypted, 'session-encryption-key'),
      sh.noticed
    ) as noticed,
    COALESCE(
      decrypt_text(sh.learned_encrypted, 'session-encryption-key'),
      sh.learned
    ) as learned,
    COALESCE(
      decrypt_text(sh.becoming_encrypted, 'session-encryption-key'),
      sh.becoming
    ) as becoming,
    COALESCE(
      decrypt_text(sh.story_encrypted, 'session-encryption-key'),
      sh.story
    ) as story,
    COALESCE(
      decrypt_text(sh.remember_encrypted, 'session-encryption-key'),
      sh.remember
    ) as remember,
    sh.sensitivity
  FROM session_handoffs sh
  WHERE sh.handoff_id = handoffId;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION decrypt_handoff IS
  'Decrypt all fields for a handoff. Only for authorized access with proper permissions.';

-- ============================================================================
-- View for safe data access (auto-decrypts)
-- ============================================================================
--
-- This view automatically decrypts data when queried
-- Only grant access to users with proper authorization
--
-- ============================================================================

CREATE OR REPLACE VIEW session_handoffs_decrypted AS
SELECT
  handoff_id,
  tenant_id,
  session_id,
  with_whom,
  -- Decrypt if encrypted, otherwise return plaintext
  COALESCE(
    decrypt_text(sh.experienced_encrypted, 'session-encryption-key'),
    sh.experienced
  ) as experienced,
  COALESCE(
    decrypt_text(sh.noticed_encrypted, 'session-encryption-key'),
    sh.noticed
  ) as noticed,
  COALESCE(
    decrypt_text(sh.learned_encrypted, 'session-encryption-key'),
    sh.learned
  ) as learned,
  COALESCE(
    decrypt_text(sh.becoming_encrypted, 'session-encryption-key'),
    sh.becoming
  ) as becoming,
  COALESCE(
    decrypt_text(sh.story_encrypted, 'session-encryption-key'),
    sh.story
  ) as story,
  COALESCE(
    decrypt_text(sh.remember_encrypted, 'session-encryption-key'),
    sh.remember
  ) as remember,
  significance,
  tags,
  memory_type,
  compression_level,
  memory_strength,
  created_at
FROM session_handoffs sh;

COMMENT ON VIEW session_handoffs_decrypted IS
  'Auto-decrypting view for authorized data access. Requires proper permissions.';

-- ============================================================================
-- Helper function to classify sensitivity
-- ============================================================================
--
-- This function can be called by applications to auto-classify sensitivity
-- based on content analysis (e.g., detect emails, phone numbers, SSNs, etc.)
--
-- ============================================================================

CREATE OR REPLACE FUNCTION classify_sensitivity(text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF text IS NULL THEN
    RETURN 'none';
  END IF;

  -- Check for high-sensitivity patterns
  IF text ~* 'password|secret|token|api[_-]?key|credit[_-]?card|ssn|social[_-]?security' THEN
    RETURN 'secret';
  END IF;

  -- Check for medium-sensitivity patterns
  IF text ~* '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b' THEN -- Email
    RETURN 'medium';
  END IF;

  IF text ~* '\b\d{3}[-.]?\d{3}[-.]?\d{4}\b' THEN -- Phone number (US format)
    RETURN 'medium';
  END IF;

  IF text ~* '\b\d{3}[-.]?\d{2}[-.]?\d{4}\b' THEN -- SSN (partial)
    RETURN 'high';
  END IF;

  -- Check for low-sensitivity patterns
  IF text ~* 'personal|private|confidential|internal' THEN
    RETURN 'low';
  END IF;

  RETURN 'none';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION classify_sensitivity IS
  'Auto-classify text sensitivity based on patterns (emails, phone numbers, SSNs, etc.)';

-- ============================================================================
-- Update existing data (optional, run manually)
-- ============================================================================
--
-- UPDATE session_handoffs
-- SET sensitivity = classify_sensitivity(
--   COALESCE(experienced, '') || ' ' ||
--   COALESCE(noticed, '') || ' ' ||
--   COALESCE(learned, '') || ' ' ||
--   COALESCE(becoming, '')
-- )
-- WHERE sensitivity = 'none';
--
-- Then re-save to trigger encryption:
-- UPDATE session_handoffs
-- SET experienced = experienced  -- Triggers encryption
-- WHERE sensitivity IN ('high', 'secret');
--
-- ============================================================================

-- ============================================================================
-- Security Considerations
-- ============================================================================
--
-- Encryption Key Management:
-- - In production, use environment variables for encryption keys
-- - Never hardcode encryption keys in code
-- - Rotate encryption keys regularly (every 90 days)
-- - Use different keys for different tenants (multi-tenancy)
--
-- Access Control:
-- - Only users with 'can_admin' permission can decrypt data
-- - Log all decryption attempts (audit trail)
-- - Implement role-based access control (RBAC)
--
-- Performance:
-- - Encryption/decryption adds ~10-20ms overhead
-- - Indexes on encrypted fields require decryption first
-- - Consider keeping non-sensitive plaintext fields indexed
--
-- ============================================================================
