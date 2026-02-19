import { Pool } from 'pg';
import { generateACBId } from '../utils/id-generator.js';
import { estimateTokens } from '../utils/token-counter.js';
import { getAllowedSensitivity, type Channel } from './privacy.js';
import {
  detectModeWithFullAnalysis,
  getBudgets,
  createInvariantContext,
  detectInvariantBreach,
  StickyInvariantType,
  type InteractionMode,
  type ModeTelemetryEvent,
  type InvariantContext,
} from './mode-detection.js';
import { getTelemetry } from './telemetry.js';

export interface ACBRequest {
  tenant_id: string;
  session_id: string;
  agent_id: string;
  channel: Channel;
  intent: string;
  query_text: string;
  max_tokens?: number;
  // Scope+subject filters
  subject_type?: string;
  subject_id?: string;
  project_id?: string;
  // Capsule and edit integration
  include_capsules?: boolean;
  include_quarantined?: boolean;
}

export interface ACBItem {
  type: 'text' | 'decision' | 'task';
  text?: string;
  decision_id?: string;
  task_id?: string;
  refs: string[];
}

export interface ACBSection {
  name: string;
  items: ACBItem[];
  token_est: number;
}

export interface ACBOmission {
  reason: string;
  candidates: string[];
  artifact_id?: string;
}

export interface ACBProvenance {
  intent: string;
  query_terms: string[];
  candidate_pool_size: number;
  filters: {
    sensitivity_allowed: string[];
  };
  scoring: {
    alpha: number;
    beta: number;
    gamma: number;
  };
}

export interface ACBResponse {
  acb_id: string;
  budget_tokens: number;
  token_used_est: number;
  sections: ACBSection[];
  omissions: ACBOmission[];
  provenance: ACBProvenance;
  // Capsule and edit integration
  capsules: CapsuleInfo[];
  edits_applied: number;
  // Mode-aware filtering (v0.3) with runtime guardrails
  mode: InteractionMode;
  mode_confidence: number;
  mode_invariants: string[];
  mode_telemetry?: ModeTelemetryEvent;
  fallback_reason?: string;
}

export interface CapsuleInfo {
  capsule_id: string;
  scope: string;
  subject_type: string;
  subject_id: string;
  item_count: number;
  author_agent_id: string;
  risks: string[];
}

const DEFAULT_MAX_TOKENS = 65000;

/**
 * Convert query text to PostgreSQL tsquery format
 */
function toTsquery(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .join(' & ');
}

/**
 * Extract search terms from query text
 */
function extractTerms(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
}

/**
 * Build rules section from rules table
 */
async function buildRulesSection(
  pool: Pool,
  tenant_id: string,
  channel: Channel,
  maxTokens: number
): Promise<ACBSection> {
  const items: ACBItem[] = [];
  let tokenUsed = 0;

  const result = await pool.query(
    `SELECT content, token_est FROM rules
     WHERE tenant_id = $1 AND (channel = $2 OR channel = 'all')
     ORDER BY priority DESC
     LIMIT 100`,
    [tenant_id, channel]
  );

  for (const row of result.rows) {
    if (tokenUsed + row.token_est > maxTokens) {break;}

    items.push({
      type: 'text',
      text: row.content,
      refs: [`view:rules.${row.scope || 'default'}`],
    });
    tokenUsed += row.token_est;
  }

  return {
    name: 'rules',
    items,
    token_est: tokenUsed,
  };
}

/**
 * Build recent window section
 */
async function buildRecentWindow(
  pool: Pool,
  tenant_id: string,
  session_id: string,
  channel: Channel,
  maxTokens: number
): Promise<ACBSection> {
  const items: ACBItem[] = [];
  let tokenUsed = 0;

  const allowedSensitivity = getAllowedSensitivity(channel);

  const result = await pool.query(
    `SELECT event_id, kind, content, actor_type, actor_id, ts
     FROM events
     WHERE tenant_id = $1 AND session_id = $2
       AND sensitivity = ANY($3)
     ORDER BY ts DESC
     LIMIT 20`,
    [tenant_id, session_id, allowedSensitivity]
  );

  for (const row of result.rows) {
    let text = '';
    if (row.kind === 'message') {
      const actor = row.actor_type === 'human' ? 'User' : 'Agent';
      text = `${actor}: ${row.content.text || ''}`;
    } else if (row.kind === 'decision') {
      text = `Decision: ${row.content.decision || ''}`;
    }

    if (!text) {continue;}

    const tokens = estimateTokens(text);
    if (tokenUsed + tokens > maxTokens) {break;}

    items.push({
      type: 'text',
      text,
      refs: [row.event_id],
    });
    tokenUsed += tokens;
  }

  return {
    name: 'recent_window',
    items,
    token_est: tokenUsed,
  };
}

/**
 * Build retrieved evidence section using effective_chunks (with edits applied)
 */
async function retrieveEvidence(
  pool: Pool,
  tenant_id: string,
  channel: Channel,
  queryText: string,
  maxTokens: number,
  include_quarantined: boolean,
  subject_type: string | undefined,
  subject_id: string | undefined
): Promise<ACBSection> {
  const items: ACBItem[] = [];
  let tokenUsed = 0;

  const allowedSensitivity = getAllowedSensitivity(channel);
  const tsquery = toTsquery(queryText);

  // Use effective_chunks view with edit awareness
  const result = await pool.query(
    `SELECT chunk_id, text, token_est, edits_applied_count,
            ts, importance
     FROM effective_chunks
     WHERE tenant_id = $1
       AND sensitivity = ANY($2)
       AND tsv @@ $3
       AND ($4::boolean OR NOT is_quarantined)
       AND ($5::text IS NULL OR scope = $5)
       AND ($6::text IS NULL OR subject_type = $6)
       AND ($7::text IS NULL OR subject_id = $7)
       AND NOT ($8::text = ANY(blocked_channels))
     ORDER BY importance DESC, ts DESC
     LIMIT 200`,
    [
      tenant_id,
      allowedSensitivity,
      tsquery,
      include_quarantined,
      subject_type || null,
      subject_type || null,
      subject_id || null,
      channel,
    ]
  );

  let edits_applied = 0;

  for (const row of result.rows) {
    if (tokenUsed + row.token_est > maxTokens) {break;}

    items.push({
      type: 'text',
      text: row.text,
      refs: [row.chunk_id],
    });
    tokenUsed += row.token_est;
    edits_applied += row.edits_applied_count || 0;
  }

  const section = {
    name: 'retrieved_evidence',
    items,
    token_est: tokenUsed,
  };

  // Store edits_applied in section metadata
  (section as any).edits_applied = edits_applied;

  return section;
}

/**
 * Build decision ledger section
 */
async function retrieveDecisions(
  pool: Pool,
  tenant_id: string,
  _channel: Channel,
  queryText: string,
  maxTokens: number
): Promise<ACBSection> {
  const items: ACBItem[] = [];
  let tokenUsed = 0;

  // const allowedSensitivity = getAllowedSensitivity(_channel); // Currently unused
  const tsquery = toTsquery(queryText);

  const result = await pool.query(
    `SELECT decision_id, decision, rationale, status, refs
     FROM decisions
     WHERE tenant_id = $1
       AND status = 'active'
       AND to_tsvector('english', decision) @@ $2
     ORDER BY ts DESC
     LIMIT 50`,
    [tenant_id, tsquery]
  );

  for (const row of result.rows) {
    let text = `Decision: ${row.decision}`;
    if (row.rationale && row.rationale.length > 0) {
      text += `\nRationale: ${row.rationale.join('; ')}`;
    }

    const tokens = estimateTokens(text);
    if (tokenUsed + tokens > maxTokens) {break;}

    items.push({
      type: 'decision',
      text,
      decision_id: row.decision_id,
      refs: [row.decision_id, ...(row.refs || [])],
    });
    tokenUsed += tokens;
  }

  return {
    name: 'relevant_decisions',
    items,
    token_est: tokenUsed,
  };
}

/**
 * Build task state section
 */
async function buildTaskState(
  pool: Pool,
  tenant_id: string,
  _session_id: string,
  _channel: Channel,
  maxTokens: number
): Promise<ACBSection> {
  const items: ACBItem[] = [];
  let tokenUsed = 0;

  const result = await pool.query(
    `SELECT task_id, title, details, status
     FROM tasks
     WHERE tenant_id = $1 AND status IN ('open', 'doing')
     ORDER BY ts DESC
     LIMIT 20`,
    [tenant_id]
  );

  if (result.rows.length === 0) {
    return {
      name: 'task_state',
      items: [],
      token_est: 0,
    };
  }

  let text = 'Current Tasks:\n';
  for (const row of result.rows) {
    text += `- [${row.status}] ${row.title}`;
    if (row.details) {
      text += `: ${row.details}`;
    }
    text += '\n';
  }

  const tokens = estimateTokens(text);
  if (tokens <= maxTokens) {
    items.push({
      type: 'text',
      text,
      refs: result.rows.map((r) => r.task_id),
    });
    tokenUsed = tokens;
  }

  return {
    name: 'task_state',
    items,
    token_est: tokenUsed,
  };
}

/**
 * Build capsules section
 */
async function buildCapsulesSection(
  pool: Pool,
  tenant_id: string,
  agent_id: string,
  maxTokens: number,
  subject_type?: string,
  subject_id?: string
): Promise<{ section: ACBSection; capsules: CapsuleInfo[] }> {
  const items: ACBItem[] = [];
  const capsules: CapsuleInfo[] = [];
  let tokenUsed = 0;

  const result = await pool.query(
    `SELECT * FROM get_available_capsules($1::text, $2::text, $3::text, $4::text)`,
    [tenant_id, agent_id, subject_type || null, subject_id || null]
  );

  for (const row of result.rows) {
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
    const chunkCount = items.chunks?.length || 0;
    const decisionCount = items.decisions?.length || 0;
    const artifactCount = items.artifacts?.length || 0;
    const totalItems = chunkCount + decisionCount + artifactCount;

    capsules.push({
      capsule_id: row.capsule_id,
      scope: row.scope,
      subject_type: row.subject_type,
      subject_id: row.subject_id,
      item_count: totalItems,
      author_agent_id: row.author_agent_id,
      risks: row.risks,
    });

    // Add capsule content as text item
    let capsuleText = `Capsule ${row.capsule_id}: `;
    if (chunkCount > 0) { capsuleText += `${chunkCount} chunks`; }
    if (decisionCount > 0) { capsuleText += `, ${decisionCount} decisions`; }
    if (artifactCount > 0) { capsuleText += `, ${artifactCount} artifacts`; }
    if (row.risks.length > 0) { capsuleText += `\nRisks: ${row.risks.join(', ')}`; }

    const tokens = 50; // Estimate
    if (tokenUsed + tokens <= maxTokens) {
      items.push({
        type: 'text',
        text: capsuleText,
        refs: [`capsule:${row.capsule_id}`],
      });
      tokenUsed += tokens;
    }
  }

  return {
    section: {
      name: 'capsules',
      items,
      token_est: tokenUsed,
    },
    capsules,
  };
}

/**
 * Build Active Context Bundle with capsules and memory edits
 * Main orchestrator function - enhanced for SPEC-MEMORY-002
 * NOW: Mode-aware filtering (v0.3) with runtime guardrails
 */
export async function buildACB(
  pool: Pool,
  request: ACBRequest
): Promise<ACBResponse> {
  const acb_id = generateACBId();
  const budget_tokens = request.max_tokens || DEFAULT_MAX_TOKENS;
  const sections: ACBSection[] = [];
  let token_used = 0;
  let total_edits_applied = 0;
  const allCapsules: CapsuleInfo[] = [];

  // NEW: Full mode analysis with confidence estimation and invariant extraction
  const { mode, confidence, invariants, fallbackReason, telemetry: modeTelemetry } =
    detectModeWithFullAnalysis(request);

  // NEW: Create invariant context for tracking sticky invariants
  const invariantContext = createInvariantContext();

  // NEW: Add detected invariants to context
  for (const invariant of invariants) {
    invariantContext.add(invariant);
  }

  // NEW: Get mode-aware budgets
  const baseBudgets = getBudgets(mode);
  const budgets = {
    rules: baseBudgets.rules,
    task_state: baseBudgets.task_state,
    recent_window: baseBudgets.recent_window,
    capsules: request.include_capsules ? baseBudgets.capsules : 0,
    retrieved_evidence: baseBudgets.retrieved_evidence,
    relevant_decisions: baseBudgets.relevant_decisions,
  };

  // 1. Rules section
  if (token_used < budget_tokens) {
    const section = await buildRulesSection(
      pool,
      request.tenant_id,
      request.channel,
      Math.min(budgets.rules, budget_tokens - token_used)
    );
    sections.push(section);
    token_used += section.token_est;
  }

  // 2. Task state section
  if (token_used < budget_tokens) {
    const section = await buildTaskState(
      pool,
      request.tenant_id,
      request.session_id,
      request.channel,
      Math.min(budgets.task_state, budget_tokens - token_used)
    );
    sections.push(section);
    token_used += section.token_est;
  }

  // 3. Recent window
  if (token_used < budget_tokens) {
    const section = await buildRecentWindow(
      pool,
      request.tenant_id,
      request.session_id,
      request.channel,
      Math.min(budgets.recent_window, budget_tokens - token_used)
    );
    sections.push(section);
    token_used += section.token_est;
  }

  // 4. Capsules (new for SPEC-MEMORY-002)
  if (request.include_capsules && token_used < budget_tokens) {
    const { section, capsules } = await buildCapsulesSection(
      pool,
      request.tenant_id,
      request.agent_id,
      Math.min(budgets.capsules, budget_tokens - token_used),
      request.subject_type,
      request.subject_id
    );
    sections.push(section);
    token_used += section.token_est;
    allCapsules.push(...capsules);
  }

  // 5. Retrieved evidence (enhanced with edit awareness)
  if (token_used < budget_tokens) {
    const section = await retrieveEvidence(
      pool,
      request.tenant_id,
      request.channel,
      request.query_text,
      Math.min(budgets.retrieved_evidence, budget_tokens - token_used),
      request.include_quarantined ?? false,
      request.subject_type,
      request.subject_id
    );
    sections.push(section);
    token_used += section.token_est;
    total_edits_applied += (section as any).edits_applied || 0;
  }

  // 6. Decision ledger
  if (token_used < budget_tokens) {
    const section = await retrieveDecisions(
      pool,
      request.tenant_id,
      request.channel,
      request.query_text,
      Math.min(budgets.relevant_decisions, budget_tokens - token_used)
    );
    sections.push(section);
    token_used += section.token_est;
  }

  // NEW: Check for invariant breaches before returning (runtime safety)
  const breach = detectInvariantBreach(invariantContext, 800, acb_id);
  if (breach.breached) {
    // Invariant breach detected - log via telemetry
    const telemetry = getTelemetry();
    telemetry.logInvariantBreach({
      request_id: acb_id,
      session_id: request.session_id,
      tenant_id: request.tenant_id,
      missing_invariant: breach.missing!,
      context_id: breach.context_id || acb_id,
      action_taken: 'logged_only', // Continue anyway for now
    });
  }

  // Convert invariants set to array for response
  const invariantArray = Array.from(invariantContext.invariants);

  return {
    acb_id,
    budget_tokens,
    token_used_est: token_used,
    sections,
    omissions: [],
    provenance: {
      intent: request.intent,
      query_terms: extractTerms(request.query_text),
      candidate_pool_size: 0, // TODO: track from queries
      filters: {
        sensitivity_allowed: getAllowedSensitivity(request.channel),
      },
      scoring: {
        alpha: 0.6,
        beta: 0.3,
        gamma: 0.1,
      },
    },
    // New for SPEC-MEMORY-002
    capsules: allCapsules,
    edits_applied: total_edits_applied,
    // NEW: Mode-aware filtering (v0.3) with full analysis
    mode,
    mode_confidence: confidence,
    mode_invariants: invariantArray,
    mode_telemetry: modeTelemetry,
    fallback_reason: fallbackReason,
  };
}
