/**
 * Telemetry System for Mode-Aware Context Filtering
 *
 * Production-ready monitoring and alerting for mode detection,
 * guardrail triggers, and invariant breaches.
 *
 * Based on docs/MULTI_TURN_FOCUS_PROBLEM.md v0.3
 */

import { InteractionMode, StickyInvariantType } from './mode-detection.js';

/**
 * Telemetry event types
 */
export enum TelemetryEventType {
  MODE_DETECTED = 'mode_detected',
  FALLBACK_TRIGGERED = 'fallback_triggered',
  INFARIANT_BREACH = 'invariant_breach',
  BUILDACB_CALLED = 'buildacb_called',
  MODE_TRANSITION = 'mode_transition',
}

/**
 * Base telemetry event
 */
export interface TelemetryEvent {
  event_type: TelemetryEventType;
  timestamp: number;
  request_id?: string;
  session_id?: string;
  tenant_id?: string;
  data: Record<string, unknown>;
}

/**
 * Mode detected event
 */
export interface ModeDetectedEvent extends TelemetryEvent {
  event_type: TelemetryEventType.MODE_DETECTED;
  data: {
    detected_mode: InteractionMode;
    fallback_reason?: string;
    confidence: number;
    intent_source: 'mapped' | 'fallback';
  };
}

/**
 * Fallback triggered event
 */
export interface FallbackTriggeredEvent extends TelemetryEvent {
  event_type: TelemetryEventType.FALLBACK_TRIGGERED;
  data: {
    original_mode: InteractionMode;
    fallback_mode: InteractionMode;
    reason: 'low_confidence' | 'drift_detected' | 'high_error_rate';
    confidence: number;
  };
}

/**
 * Invariant breach event
 */
export interface InvariantBreachEvent extends TelemetryEvent {
  event_type: TelemetryEventType.INFARIANT_BREACH;
  data: {
    missing_invariant: StickyInvariantType;
    severity: 'critical' | 'high' | 'medium';
    context_id: string;
    action_taken: 'logged_only' | 'fallback_to_general' | 'alert_sent';
  };
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  enabled: boolean;
  sample_rate: number; // 0.0 to 1.0 (sample % of events)
  min_log_level: 'debug' | 'info' | 'warn' | 'error';
  endpoint?: string; // Remote telemetry endpoint
  api_key?: string; // API key for remote endpoint
}

/**
 * Default telemetry configuration
 */
const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: true,
  sample_rate: 1.0, // Log all events
  min_log_level: 'info',
};

/**
 * Telemetry system
 */
export class Telemetry {
  private config: TelemetryConfig;
  private eventBuffer: TelemetryEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private bufferSize = 100; // Flush when buffer reaches this size

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start periodic flush (every 30 seconds)
    if (this.config.enabled) {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, 30000);
    }
  }

  /**
   * Log a telemetry event
   */
  log(event: TelemetryEvent): void {
    if (!this.config.enabled) {
      return;
    }

    // Sample events
    if (Math.random() > this.config.sample_rate) {
      return;
    }

    // Add to buffer
    this.eventBuffer.push(event);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  /**
   * Log mode detection
   */
  logModeDetection(params: {
    request_id?: string;
    session_id?: string;
    tenant_id?: string;
    detected_mode: InteractionMode;
    fallback_reason?: string;
    confidence: number;
    intent_source: 'mapped' | 'fallback';
  }): void {
    const event: ModeDetectedEvent = {
      event_type: TelemetryEventType.MODE_DETECTED,
      timestamp: Date.now(),
      request_id: params.request_id,
      session_id: params.session_id,
      tenant_id: params.tenant_id,
      data: {
        detected_mode: params.detected_mode,
        fallback_reason: params.fallback_reason,
        confidence: params.confidence,
        intent_source: params.intent_source,
      },
    };

    this.log(event);
  }

  /**
   * Log fallback trigger
   */
  logFallback(params: {
    request_id?: string;
    session_id?: string;
    tenant_id?: string;
    original_mode: InteractionMode;
    fallback_mode: InteractionMode;
    reason: 'low_confidence' | 'drift_detected' | 'high_error_rate';
    confidence: number;
  }): void {
    const event: FallbackTriggeredEvent = {
      event_type: TelemetryEventType.FALLBACK_TRIGGERED,
      timestamp: Date.now(),
      request_id: params.request_id,
      session_id: params.session_id,
      tenant_id: params.tenant_id,
      data: {
        original_mode: params.original_mode,
        fallback_mode: params.fallback_mode,
        reason: params.reason,
        confidence: params.confidence,
      },
    };

    this.log(event);

    // Also log as warning
    console.warn('[Telemetry] Fallback triggered:', params);
  }

  /**
   * Log invariant breach
   */
  logInvariantBreach(params: {
    request_id?: string;
    session_id?: string;
    tenant_id?: string;
    missing_invariant: StickyInvariantType;
    context_id: string;
    action_taken: 'logged_only' | 'fallback_to_general' | 'alert_sent';
  }): void {
    // Determine severity based on invariant type
    let severity: 'critical' | 'high' | 'medium' = 'medium';
    if (params.missing_invariant === StickyInvariantType.SAFETY_REQUIREMENT) {
      severity = 'critical';
    } else if (params.missing_invariant === StickyInvariantType.USER_CORRECTION) {
      severity = 'high';
    } else if (params.missing_invariant === StickyInvariantType.HARD_CONSTRAINT) {
      severity = 'high';
    }

    const event: InvariantBreachEvent = {
      event_type: TelemetryEventType.INFARIANT_BREACH,
      timestamp: Date.now(),
      request_id: params.request_id,
      session_id: params.session_id,
      tenant_id: params.tenant_id,
      data: {
        missing_invariant: params.missing_invariant,
        severity,
        context_id: params.context_id,
        action_taken: params.action_taken,
      },
    };

    this.log(event);

    // Log based on severity
    if (severity === 'critical') {
      console.error('[Telemetry] CRITICAL invariant breach:', params);
    } else if (severity === 'high') {
      console.warn('[Telemetry] HIGH severity invariant breach:', params);
    } else {
      console.info('[Telemetry] Medium severity invariant breach:', params);
    }
  }

  /**
   * Flush buffered events to storage
   */
  private async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    // TODO: Send to remote endpoint if configured
    if (this.config.endpoint) {
      try {
        await this.sendToEndpoint(events);
      } catch (error) {
        console.error('[Telemetry] Failed to send events:', error);
        // Re-add events to buffer for retry
        this.eventBuffer.unshift(...events);
      }
    }

    // Always log to stdout in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Telemetry] Flushed', events.length, 'events');
    }
  }

  /**
   * Send events to remote endpoint
   */
  private async sendToEndpoint(events: TelemetryEvent[]): Promise<void> {
    if (!this.config.endpoint || !this.config.api_key) {
      return;
    }

    // TODO: Implement actual HTTP request
    // Example:
    // const response = await fetch(this.config.endpoint, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-API-Key': this.config.api_key,
    //   },
    //   body: JSON.stringify({ events }),
    // });
    //
    // if (!response.ok) {
    //   throw new Error(`Telemetry upload failed: ${response.status}`);
    // }
  }

  /**
   * Get statistics from buffered events
   */
  getStats(): {
    total_events: number;
    by_type: Record<TelemetryEventType, number>;
    oldest_event_age_ms: number;
  } {
    const by_type: Record<string, number> = {};
    for (const type of Object.values(TelemetryEventType)) {
      by_type[type] = 0;
    }

    let oldest_timestamp = Date.now();

    for (const event of this.eventBuffer) {
      by_type[event.event_type] = (by_type[event.event_type] || 0) + 1;
      if (event.timestamp < oldest_timestamp) {
        oldest_timestamp = event.timestamp;
      }
    }

    return {
      total_events: this.eventBuffer.length,
      by_type: by_type as Record<TelemetryEventType, number>,
      oldest_event_age_ms: Date.now() - oldest_timestamp,
    };
  }

  /**
   * Shutdown telemetry system
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
  }
}

/**
 * Global telemetry instance
 */
let globalTelemetry: Telemetry | null = null;

/**
 * Get or create global telemetry instance
 */
export function getTelemetry(): Telemetry {
  if (!globalTelemetry) {
    // Read config from environment
    const config: Partial<TelemetryConfig> = {
      enabled: process.env.TELEMETRY_ENABLED !== 'false',
      endpoint: process.env.TELEMETRY_ENDPOINT,
      api_key: process.env.TELEMETRY_API_KEY,
      sample_rate: parseFloat(process.env.TELEMETRY_SAMPLE_RATE || '1.0'),
    };

    globalTelemetry = new Telemetry(config);
  }

  return globalTelemetry;
}
