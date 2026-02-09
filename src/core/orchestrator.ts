import { Pool } from 'pg';
import { generateACBId } from '../utils/id-generator.js';
import { estimateTokens } from '../utils/token-counter.js';
import { getAllowedSensitivity, type Channel } from './privacy.js';

export interface ACBRequest {
  tenant_id: string;
  session_id: string;
  agent_id: string;
  channel: Channel;
  intent: string;
  query_text: string;
  max_tokens?: number;
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
 * Build retrieved evidence section using FTS
 */
async function retrieveEvidence(
  pool: Pool,
  tenant_id: string,
  channel: Channel,
  queryText: string,
  maxTokens: number
): Promise<ACBSection> {
  const items: ACBItem[] = [];
  let tokenUsed = 0;

  const allowedSensitivity = getAllowedSensitivity(channel);
  const tsquery = toTsquery(queryText);

  // FTS search with scoring
  const result = await pool.query(
    `SELECT chunk_id, text, token_est, refs, kind,
            ts_rank(tsv, $1) as rank,
            importance,
            EXTRACT(EPOCH FROM (NOW() - ts)) / 86400.0 as days_old
     FROM chunks
     WHERE tenant_id = $2
       AND sensitivity = ANY($3)
       AND tsv @@ $1
     ORDER BY rank DESC, importance DESC, ts DESC
     LIMIT 200`,
    [tsquery, tenant_id, allowedSensitivity]
  );

  // Scoring weights (currently unused but kept for future enhancements)
  // const alpha = 0.6; // semantic relevance
  // const beta = 0.3; // recency
  // const gamma = 0.1; // importance

  for (const row of result.rows) {
    if (tokenUsed + row.token_est > maxTokens) {break;}

    items.push({
      type: 'text',
      text: row.text,
      refs: [row.chunk_id, ...(row.refs || [])],
    });
    tokenUsed += row.token_est;
  }

  return {
    name: 'retrieved_evidence',
    items,
    token_est: tokenUsed,
  };
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
 * Build Active Context Bundle
 * Main orchestrator function
 */
export async function buildACB(
  pool: Pool,
  request: ACBRequest
): Promise<ACBResponse> {
  const acb_id = generateACBId();
  const budget_tokens = request.max_tokens || DEFAULT_MAX_TOKENS;
  const sections: ACBSection[] = [];
  let token_used = 0;

  // Budget allocations (from PRD)
  const budgets = {
    rules: 6000,
    task_state: 3000,
    recent_window: 8000,
    retrieved_evidence: 28000,
    relevant_decisions: 4000,
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

  // 4. Retrieved evidence
  if (token_used < budget_tokens) {
    const section = await retrieveEvidence(
      pool,
      request.tenant_id,
      request.channel,
      request.query_text,
      Math.min(budgets.retrieved_evidence, budget_tokens - token_used)
    );
    sections.push(section);
    token_used += section.token_est;
  }

  // 5. Decision ledger
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
  };
}
