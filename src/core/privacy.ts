export type Channel = 'private' | 'public' | 'team' | 'agent';
export type Sensitivity = 'none' | 'low' | 'high' | 'secret';

/**
 * Get allowed sensitivity levels for a given channel
 */
export function getAllowedSensitivity(channel: Channel): Sensitivity[] {
  switch (channel) {
    case 'public':
      return ['none', 'low'];
    case 'private':
    case 'team':
      return ['none', 'low', 'high'];
    case 'agent':
      return ['none', 'low'];
    default:
      return ['none'];
  }
}

/**
 * Check if a sensitivity level is allowed for a channel
 */
export function isSensitivityAllowed(
  sensitivity: Sensitivity,
  channel: Channel
): boolean {
  const allowed = getAllowedSensitivity(channel);
  return allowed.includes(sensitivity);
}

/**
 * Filter array of sensitivities to only those allowed
 */
export function filterAllowedSensitivities(
  sensitivities: Sensitivity[],
  channel: Channel
): Sensitivity[] {
  const allowed = getAllowedSensitivity(channel);
  return sensitivities.filter((s) => allowed.includes(s));
}

/**
 * Redact secret patterns from text
 * This is a basic implementation - production should use more sophisticated detection
 */
export function redactSecrets(text: string): string {
  // Common secret patterns
  const patterns = [
    // API keys
    /sk-[a-zA-Z0-9]{20,}/g,
    /Bearer [a-zA-Z0-9._+\-/=]{20,}/g,
    // Generic tokens
    /token["\s:]+[a-zA-Z0-9._+\-/=]{20,}/gi,
    // Passwords
    /password["\s:]+[^\s"'`]{8,}/gi,
  ];

  let redacted = text;
  for (const pattern of patterns) {
    redacted = redacted.replace(pattern, '[SECRET_REDACTED]');
  }

  return redacted;
}

/**
 * Check if content contains secrets
 */
export function containsSecrets(text: string): boolean {
  const redacted = redactSecrets(text);
  return redacted !== text;
}
