/**
 * Encryption/Decryption Service
 *
 * Handles PII protection for sensitive data.
 * Integrates with PostgreSQL pgcrypto functions.
 *
 * Part of Task 17: PII Protection & GDPR Compliance
 */

import { Pool } from 'pg';

export interface SensitivityLevel {
  level: 'none' | 'low' | 'medium' | 'high' | 'secret';
  description: string;
  encrypted: boolean;
}

export class EncryptionService {
  private pool: Pool;
  private encryptionKey: string;

  constructor(pool: Pool, encryptionKey?: string) {
    this.pool = pool;
    // In production, use environment variable for encryption key
    this.encryptionKey = encryptionKey || process.env.ENCRYPTION_KEY || 'session-encryption-key';

    if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
      console.warn('[Encryption] WARNING: Using default encryption key. Set ENCRYPTION_KEY env var!');
    }
  }

  /**
   * Classify sensitivity of text content
   * Uses PostgreSQL classify_sensitivity function
   */
  async classifySensitivity(text: string): Promise<SensitivityLevel> {
    if (!text) {
      return {
        level: 'none',
        description: 'No content',
        encrypted: false
      };
    }

    const result = await this.pool.query(
      `SELECT classify_sensitivity($1) as level`,
      [text]
    );

    const level = result.rows[0].level as 'none' | 'low' | 'medium' | 'high' | 'secret';

    const descriptions: Record<string, string> = {
      none: 'Public data',
      low: 'General information',
      medium: 'Personal information (email, phone)',
      high: 'Sensitive personal data',
      secret: 'Credentials, secrets, API keys'
    };

    return {
      level,
      description: descriptions[level] || level,
      encrypted: level === 'high' || level === 'secret'
    };
  }

  /**
   * Decrypt a handoff for authorized access
   * Should only be called after proper authentication/authorization
   */
  async decryptHandoff(handoffId: string): Promise<any | null> {
    const result = await this.pool.query(
      `SELECT * FROM decrypt_handoff($1)`,
      [handoffId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Batch decrypt handoffs for authorized export
   * WARNING: Only use with proper authorization
   */
  async decryptHandoffsBatch(handoffIds: string[]): Promise<any[]> {
    if (handoffIds.length === 0) {
      return [];
    }

    const result = await this.pool.query(
      `SELECT
        sh.handoff_id,
        COALESCE(
          decrypt_text(sh.experienced_encrypted, $1),
          sh.experienced
        ) as experienced,
        COALESCE(
          decrypt_text(sh.noticed_encrypted, $1),
          sh.noticed
        ) as noticed,
        COALESCE(
          decrypt_text(sh.learned_encrypted, $1),
          sh.learned
        ) as learned,
        COALESCE(
          decrypt_text(sh.becoming_encrypted, $1),
          sh.becoming
        ) as becoming,
        COALESCE(
          decrypt_text(sh.story_encrypted, $1),
          sh.story
        ) as story,
        COALESCE(
          decrypt_text(sh.remember_encrypted, $1),
          sh.remember
        ) as remember,
        sh.sensitivity,
        sh.created_at
      FROM session_handoffs sh
      WHERE sh.handoff_id = ANY($2)`,
      [this.encryptionKey, handoffIds]
    );

    return result.rows;
  }

  /**
   * Encrypt text manually (rarely needed - trigger handles this)
   */
  async encryptText(plaintext: string): Promise<Buffer> {
    const result = await this.pool.query(
      `SELECT encrypt_text($1, $2) as encrypted`,
      [plaintext, this.encryptionKey]
    );

    return Buffer.from(result.rows[0].encrypted, 'base64');
  }

  /**
   * Decrypt text manually
   */
  async decryptText(ciphertext: Buffer): Promise<string> {
    const result = await this.pool.query(
      `SELECT decrypt_text($1, $2) as decrypted`,
      [ciphertext.toString('base64'), this.encryptionKey]
    );

    return result.rows[0].decrypted;
  }

  /**
   * Get encryption status for a tenant
   */
  async getEncryptionStats(tenantId: string): Promise<{
    total: number;
    encrypted: number;
    bySensitivity: Record<string, number>;
  }> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE experienced_encrypted IS NOT NULL
                           OR noticed_encrypted IS NOT NULL
                           OR learned_encrypted IS NOT NULL
                           OR becoming_encrypted IS NOT NULL) as encrypted,
        sensitivity
      FROM session_handoffs
      WHERE tenant_id = $1
      GROUP BY sensitivity`,
      [tenantId]
    );

    const bySensitivity: Record<string, number> = {};
    let total = 0;
    let encrypted = 0;

    for (const row of result.rows) {
      bySensitivity[row.sensitivity] = parseInt(row.count);
      total += parseInt(row.count);
      if (row.sensitivity === 'high' || row.sensitivity === 'secret') {
        encrypted += parseInt(row.count);
      }
    }

    return {
      total,
      encrypted,
      bySensitivity
    };
  }

  /**
   * Re-encrypt with new key (key rotation)
   * WARNING: Expensive operation - run during maintenance window
   */
  async rotateEncryptionKey(oldKey: string, newKey: string): Promise<{
    processed: number;
    failed: number;
  }> {
    // This would require custom SQL to decrypt with old key and encrypt with new
    // For now, return not implemented
    throw new Error('Key rotation not yet implemented. Requires manual SQL execution.');
  }
}

/**
 * Create encryption service instance
 */
export function createEncryptionService(pool: Pool): EncryptionService {
  return new EncryptionService(pool);
}
