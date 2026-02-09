import { randomBytes } from 'crypto';

/**
 * Generate a unique ID with a prefix
 * Format: {prefix}_{16_char_hex}
 */
export function generateId(prefix: string): string {
  const bytes = randomBytes(8);
  const hex = bytes.toString('hex').substring(0, 16);
  return `${prefix}_${hex}`;
}

/**
 * Generate event ID
 */
export function generateEventId(): string {
  return generateId('evt');
}

/**
 * Generate chunk ID
 */
export function generateChunkId(): string {
  return generateId('chk');
}

/**
 * Generate decision ID
 */
export function generateDecisionId(): string {
  return generateId('dec');
}

/**
 * Generate task ID
 */
export function generateTaskId(): string {
  return generateId('tsk');
}

/**
 * Generate artifact ID
 */
export function generateArtifactId(): string {
  return generateId('art');
}

/**
 * Generate ACB ID
 */
export function generateACBId(): string {
  return generateId('acb');
}
