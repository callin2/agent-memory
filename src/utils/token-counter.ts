/**
 * Simple token estimation for text
 * Approximation: ~4 characters per token
 * For production, consider using tiktoken library for accuracy
 */
export function estimateTokens(text: string): number {
  if (!text) {return 0;}
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for multiple text chunks
 */
export function estimateTokensTotal(texts: string[]): number {
  return texts.reduce((sum, text) => sum + estimateTokens(text), 0);
}

/**
 * Calculate token budget allocation
 */
export interface BudgetAllocation {
  identity: number;
  rules: number;
  task_state: number;
  decision_ledger: number;
  retrieved_evidence: number;
  recent_window: number;
  handoff_packet: number;
  reserve: number;
}

export const DEFAULT_BUDGET_ALLOCATION: BudgetAllocation = {
  identity: 1200,
  rules: 6000,
  task_state: 3000,
  decision_ledger: 4000,
  retrieved_evidence: 28000,
  recent_window: 8000,
  handoff_packet: 6000,
  reserve: 8800,
};

export const DEFAULT_MAX_TOKENS = 65000;

/**
 * Calculate if budget is exceeded
 */
export function isBudgetExceeded(
  allocations: Partial<BudgetAllocation>,
  maxTokens: number = DEFAULT_MAX_TOKENS
): boolean {
  const total = Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
  return total > maxTokens;
}
