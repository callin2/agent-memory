import { getTelemetry, TelemetryEventType } from './telemetry.js';

/**
 * Mode Detection System
 *
 * Two-level discrimination pattern for multi-turn conversation focus:
 * Level 1: Detect interaction mode (TASK, EXPLORATION, DEBUGGING, LEARNING, GENERAL)
 * Level 2: Filter context based on mode + sticky invariants
 *
 * Based on: docs/MULTI_TURN_FOCUS_PROBLEM.md v0.3
 */

/**
 * Interaction modes for context filtering
 */
export enum InteractionMode {
  TASK = 'TASK',                  // "Do this thing" → need focus
  EXPLORATION = 'EXPLORATION',    // "Let's explore" → need context
  DEBUGGING = 'DEBUGGING',        // "Fix this" → need error state
  LEARNING = 'LEARNING',          // "Teach me" → need examples
  GENERAL = 'GENERAL',            // (fallback) → conservative defaults
}

/**
 * Mode budget configuration (token limits per section)
 */
export interface ModeBudgets {
  rules: number;
  task_state: number;
  recent_window: number;
  capsules: number;
  retrieved_evidence: number;
  relevant_decisions: number;
}

/**
 * Intent to mode mapping table
 * Extended as needed based on observed intents
 */
const INTENT_MODE_MAP: Record<string, InteractionMode> = {
  // Direct mappings
  'task': InteractionMode.TASK,
  'debug': InteractionMode.DEBUGGING,
  'explore': InteractionMode.EXPLORATION,
  'learn': InteractionMode.LEARNING,
  'general': InteractionMode.GENERAL,

  // Common variations
  'implement': InteractionMode.TASK,
  'fix': InteractionMode.DEBUGGING,
  'error': InteractionMode.DEBUGGING,
  'investigate': InteractionMode.EXPLORATION,
  'explain': InteractionMode.LEARNING,
  'teach': InteractionMode.LEARNING,

  // Default fallback
  'default': InteractionMode.GENERAL,
};

/**
 * Stage 1: Direct intent mapping (no classifier needed)
 *
 * Maps ACBRequest.intent to InteractionMode
 * Fallback to GENERAL if no mapping exists
 */
export function detectModeFromIntent(intent: string): InteractionMode {
  if (!intent) {
    return InteractionMode.GENERAL;
  }

  // Normalize intent (lowercase, trim)
  const normalized = intent.toLowerCase().trim();

  // Look up in mapping table
  return INTENT_MODE_MAP[normalized] || InteractionMode.GENERAL;
}

/**
 * Stage 2: Full mode detection with classifier fallback
 *
 * For future implementation when classifier is available
 */
export function detectMode(_request: any): InteractionMode {
  // TODO: Implement classifier-based detection
  // For now, use Stage 1 (intent mapping only)
  return InteractionMode.GENERAL;
}

/**
 * Get mode-aware budget allocation
 *
 * Returns token budgets for each section based on interaction mode
 */
export function getBudgets(mode: InteractionMode): ModeBudgets {
  switch (mode) {
    case InteractionMode.TASK:
      return {
        rules: 10000,           // High: constraints critical
        task_state: 5000,        // High: current state
        recent_window: 2000,     // Low: minimal history
        retrieved_evidence: 28000, // High: need specifics
        relevant_decisions: 4000,  // Medium
        capsules: 4000,
      };

    case InteractionMode.EXPLORATION:
      return {
        rules: 3000,            // Low: not constrained
        task_state: 1000,        // Low: no active task
        recent_window: 15000,    // High: maintain thread
        retrieved_evidence: 35000, // High: gather info
        relevant_decisions: 6000,  // High: what we decided
        capsules: 2000,
      };

    case InteractionMode.DEBUGGING:
      return {
        rules: 5000,
        task_state: 4000,        // Medium: what we were doing
        recent_window: 12000,    // High: what just happened
        retrieved_evidence: 25000, // High: error context
        relevant_decisions: 3000,
        capsules: 0,
      };

    case InteractionMode.LEARNING:
      return {
        rules: 8000,            // Medium: principles
        task_state: 0,           // None: not doing
        recent_window: 2000,     // Low: don't clutter
        retrieved_evidence: 40000, // Very high: examples
        relevant_decisions: 8000, // High: principles
        capsules: 2000,
      };

    case InteractionMode.GENERAL:
    default:
      // Fallback: conservative defaults
      return {
        rules: 6000,
        task_state: 3000,
        recent_window: 8000,
        retrieved_evidence: 28000,
        relevant_decisions: 4000,
        capsules: 4000,
      };
  }
}

/**
 * Sticky invariant types
 *
 * These are NEVER dropped regardless of mode filtering
 */
export enum StickyInvariantType {
  SAFETY_REQUIREMENT = 'safety_requirement',
  USER_CORRECTION = 'user_correction',
  HARD_CONSTRAINT = 'hard_constraint',
  BLOCKING_ERROR = 'blocking_error',
}

/**
 * Sticky invariant definition
 */
export interface StickyInvariant {
  type: StickyInvariantType;
  rule: string;
  priority: number;  // Higher = more sticky (700-1000)
}

/**
 * Sticky invariants that are never dropped
 */
export const STICKY_INVARIANTS: StickyInvariant[] = [
  {
    type: StickyInvariantType.SAFETY_REQUIREMENT,
    rule: 'Never drop safety-critical constraints',
    priority: 1000,
  },
  {
    type: StickyInvariantType.USER_CORRECTION,
    rule: 'Latest user correction always included',
    priority: 900,
  },
  {
    type: StickyInvariantType.HARD_CONSTRAINT,
    rule: 'Explicit "must" or "must not" requirements',
    priority: 800,
  },
  {
    type: StickyInvariantType.BLOCKING_ERROR,
    rule: 'Current blocking errors',
    priority: 700,
  },
];

/**
 * Telemetry event for mode detection
 */
export interface ModeTelemetryEvent {
  timestamp: number;
  detected_mode: InteractionMode;
  fallback_reason?: string;
  confidence?: number;
  intent_source: 'mapped' | 'fallback';
  request_id?: string;
}

/**
 * Context bundle for invariant tracking
 */
export interface InvariantContext {
  invariants: Set<StickyInvariantType>;
  add(type: StickyInvariantType): void;
  has(type: StickyInvariantType): boolean;
}

/**
 * Create invariant context
 */
export function createInvariantContext(): InvariantContext {
  const invariants = new Set<StickyInvariantType>();

  return {
    invariants,
    add(type: StickyInvariantType) {
      invariants.add(type);
    },
    has(type: StickyInvariantType) {
      return invariants.has(type);
    },
  };
}

/**
 * Log telemetry (placeholder for production monitoring)
 * Now integrated with telemetry system
 */
function logTelemetry(event: ModeTelemetryEvent): void {
  const telemetry = getTelemetry();
  telemetry.logModeDetection({
    request_id: event.request_id,
    detected_mode: event.detected_mode,
    fallback_reason: event.fallback_reason,
    confidence: event.confidence || 1.0,
    intent_source: event.intent_source,
  });
}

/**
 * Detect mode with runtime guardrails
 *
 * Includes fallback logic for:
 * - Low confidence (< 70%)
 * - Drift detection
 * - High error rate for mode
 *
 * For production use with telemetry and monitoring
 */
export function detectModeWithGuardrails(
  request: any,
  options: {
    request_id?: string;
    getConfidence?: (mode: InteractionMode) => number;
    detectDrift?: (mode: InteractionMode) => boolean;
    getModeErrorRate?: (mode: InteractionMode) => number;
    getBaselineErrorRate?: () => number;
  } = {}
): { mode: InteractionMode; fallbackReason?: string; telemetry: ModeTelemetryEvent } {
  const intent = request.intent || '';
  const mode = detectModeFromIntent(intent);
  const confidence = options.getConfidence?.(mode) ?? 1.0;

  // Determine intent source
  const intent_source = (mode === InteractionMode.GENERAL && intent)
    ? 'fallback' as const
    : 'mapped' as const;

  // Build telemetry event
  const telemetry: ModeTelemetryEvent = {
    timestamp: Date.now(),
    detected_mode: mode,
    confidence,
    intent_source,
    request_id: options.request_id,
  };

  // Trigger 1: Low confidence
  if (confidence < 0.70) {
    telemetry.fallback_reason = 'low_confidence';
    logTelemetry(telemetry);
    return {
      mode: InteractionMode.GENERAL,
      fallbackReason: 'low_confidence',
      telemetry,
    };
  }

  // Trigger 2: Drift detected
  if (options.detectDrift?.(mode)) {
    telemetry.fallback_reason = 'drift_detected';
    logTelemetry(telemetry);
    return {
      mode: InteractionMode.GENERAL,
      fallbackReason: 'drift_detected',
      telemetry,
    };
  }

  // Trigger 3: High error rate for this mode
  if (options.getModeErrorRate && options.getBaselineErrorRate) {
    const modeErrorRate = options.getModeErrorRate(mode);
    const baselineErrorRate = options.getBaselineErrorRate();

    if (modeErrorRate > 2 * baselineErrorRate) {
      telemetry.fallback_reason = 'high_error_rate';
      logTelemetry(telemetry);
      return {
        mode: InteractionMode.GENERAL,
        fallbackReason: 'high_error_rate',
        telemetry,
      };
    }
  }

  // No fallback needed
  logTelemetry(telemetry);
  return { mode, telemetry };
}

/**
 * Invariant breach details for rollback/alerting
 */
export interface InvariantBreach {
  breached: boolean;
  missing?: StickyInvariantType;
  context_id?: string;
  timestamp?: number;
}

/**
 * Check if invariant breach has occurred
 *
 * An invariant breach occurs when context is constructed WITHOUT
 * a sticky invariant that SHOULD be present
 *
 * Logs breach for monitoring/alerting
 */
export function detectInvariantBreach(
  context: InvariantContext,
  requiredPriority: number = 800,
  context_id?: string
): InvariantBreach {
  const requiredInvariants = STICKY_INVARIANTS.filter(i => i.priority >= requiredPriority);

  for (const invariant of requiredInvariants) {
    // Check if invariant type is marked as present
    if (!context.has(invariant.type)) {
      const breach: InvariantBreach = {
        breached: true,
        missing: invariant.type,
        context_id,
        timestamp: Date.now(),
      };

      // Log breach for monitoring
      if (process.env.NODE_ENV === 'development') {
        console.error('[Invariant Breach]', JSON.stringify(breach));
      }

      // TODO: Send alert to monitoring system
      // alertOnCall({ severity: 'CRITICAL', message: 'Invariant breach detected', breach });

      return breach;
    }
  }

  return { breached: false };
}

/**
 * Better Invariant Detection
 *
 * Extract sticky invariants from request content using heuristics
 */

/**
 * Extract invariants from query text
 */
export function extractInvariantsFromQuery(query: string): StickyInvariantType[] {
  const invariants: StickyInvariantType[] = [];
  const lower = query.toLowerCase();

  // Safety requirements
  if (
    lower.includes('safety') ||
    lower.includes('security') ||
    lower.includes('must be secure') ||
    lower.includes('must validate') ||
    lower.includes('authentication')
  ) {
    invariants.push(StickyInvariantType.SAFETY_REQUIREMENT);
  }

  // User corrections (explicit)
  if (
    lower.includes(' actually ') ||
    lower.includes(' wait ') ||
    lower.includes(' no, ') ||
    lower.includes(' not ') && lower.includes(' but ') ||
    lower.includes(' correction') ||
    lower.includes(' instead')
  ) {
    invariants.push(StickyInvariantType.USER_CORRECTION);
  }

  // Hard constraints
  if (
    lower.includes(' must ') ||
    lower.includes(' must not ') ||
    lower.includes(' required ') ||
    lower.includes(' mandatory ') ||
    lower.includes(' critical ')
  ) {
    invariants.push(StickyInvariantType.HARD_CONSTRAINT);
  }

  // Blocking errors
  if (
    lower.includes(' error ') ||
    lower.includes(' fail') ||
    lower.includes(' bug ') ||
    lower.includes(' broken ') ||
    lower.includes(' crash') ||
    lower.includes(' exception')
  ) {
    invariants.push(StickyInvariantType.BLOCKING_ERROR);
  }

  return invariants;
}

/**
 * Confidence Estimation
 *
 * Estimate confidence for mode detection based on intent quality
 */

/**
 * Estimate confidence for intent-based mode detection
 */
export function estimateConfidence(
  intent: string,
  detectedMode: InteractionMode
): number {
  // No intent provided
  if (!intent || intent.trim() === '') {
    return 0.5; // Low confidence
  }

  // Direct mapping (high confidence)
  const directMappings = ['task', 'debug', 'explore', 'learn', 'general'];
  if (directMappings.includes(intent.toLowerCase())) {
    return 0.95; // Very high confidence
  }

  // Common variations (medium-high confidence)
  const variations = ['implement', 'fix', 'error', 'investigate', 'explain', 'teach'];
  if (variations.includes(intent.toLowerCase())) {
    return 0.85; // High confidence
  }

  // Unknown intent but we still detected a mode
  if (detectedMode === InteractionMode.GENERAL) {
    return 0.6; // Low-medium confidence
  }

  // Fallback to GENERAL (low confidence)
  return 0.5;
}

/**
 * Full mode detection with confidence estimation and invariant extraction
 */
export function detectModeWithFullAnalysis(request: any): {
  mode: InteractionMode;
  confidence: number;
  invariants: StickyInvariantType[];
  fallbackReason?: string;
  telemetry: ModeTelemetryEvent;
} {
  const intent = request.intent || '';
  const query = request.query_text || '';

  // Detect mode
  const mode = detectModeFromIntent(intent);

  // Estimate confidence
  const confidence = estimateConfidence(intent, mode);

  // Extract invariants
  const invariants = extractInvariantsFromQuery(query);

  // Build telemetry
  const telemetry: ModeTelemetryEvent = {
    timestamp: Date.now(),
    detected_mode: mode,
    confidence,
    intent_source: (mode === InteractionMode.GENERAL && intent) ? 'fallback' : 'mapped',
    request_id: request.request_id,
  };

  // Check for low confidence fallback
  let fallbackReason: string | undefined;
  if (confidence < 0.70) {
    fallbackReason = 'low_confidence';
  }

  // Log telemetry
  logTelemetry(telemetry);

  return {
    mode,
    confidence,
    invariants,
    fallbackReason,
    telemetry,
  };
}
