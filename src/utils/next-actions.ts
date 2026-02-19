/**
 * Get Next Actions
 *
 * Analyzes open feedback and suggests prioritized actions
 * Helps maintain focus on high-impact improvements
 */

export interface NextAction {
  priority: 'high' | 'medium' | 'low';
  category: string;
  action: string;
  feedback_id: string;
  description: string;
  estimated_effort: 'quick' | 'moderate' | 'large';
}

/**
 * Get suggested next actions from open feedback
 */
export function getNextActions(feedback: any[], limit: number = 5): NextAction[] {
  const openFeedback = feedback.filter(f => f.status === 'open');
  const actions: NextAction[] = [];
  const now = new Date();

  for (const item of openFeedback) {
    // Skip external bugs (can't fix in codebase)
    if (item.description.includes('Claude Code') || item.description.includes('external')) {
      continue;
    }

    // Determine priority based on severity and age
    const daysSinceCreated = Math.floor((now.getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24));

    let priority: 'high' | 'medium' | 'low';
    if (item.severity === 'high' || item.severity === 'critical' || daysSinceCreated > 7) {
      priority = 'high';
    } else if (item.severity === 'medium' || daysSinceCreated > 3) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    // Estimate effort
    let estimated_effort: 'quick' | 'moderate' | 'large';
    if (item.type === 'insight' || item.description.includes('add') || item.description.includes('create')) {
      estimated_effort = 'moderate';
    } else if (item.description.includes('fix') || item.description.includes('update')) {
      estimated_effort = 'quick';
    } else {
      estimated_effort = 'large';
    }

    actions.push({
      priority,
      category: item.category,
      action: generateAction(item),
      feedback_id: item.feedback_id,
      description: item.description,
      estimated_effort
    });
  }

  // Sort by priority (high first) then by effort (quick first)
  actions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    const effortOrder = { quick: 0, moderate: 1, large: 2 };
    return effortOrder[a.estimated_effort] - effortOrder[b.estimated_effort];
  });

  return actions.slice(0, limit);
}

/**
 * Generate actionable suggestion from feedback
 */
function generateAction(item: any): string {
  if (item.type === 'friction' || item.type === 'bug') {
    return `Fix: ${item.description.substring(0, 50)}...`;
  } else if (item.type === 'suggestion') {
    return `Consider: ${item.description.substring(0, 50)}...`;
  } else if (item.type === 'pattern') {
    return `Address pattern: ${item.description.substring(0, 50)}...`;
  } else {
    return `Review: ${item.description.substring(0, 50)}...`;
  }
}

/**
 * Get system health summary
 */
export function getSystemHealth(feedback: any[], recentHandoffs: number = 0) {
  const open = feedback.filter(f => f.status === 'open').length;
  const addressed = feedback.filter(f => f.status === 'addressed').length;
  const total = feedback.length;
  const addressedRate = total > 0 ? Math.round((addressed / total) * 100) : 0;

  return {
    feedback: {
      total,
      open,
      addressed,
      addressed_rate: `${addressedRate}%`
    },
    activity: {
      handoffs_last_7_days: recentHandoffs
    },
    health: addressedRate >= 70 ? 'good' : addressedRate >= 50 ? 'fair' : 'needs_attention'
  };
}
