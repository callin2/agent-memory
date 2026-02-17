/**
 * Practical Usage Examples
 *
 * Real-world examples of how to use Thread's Memory System
 * in various scenarios and applications.
 */

import { createHandoff, wakeUp } from '../src/api/handoff';
import request from 'undici';

const API_BASE = process.env.API_BASE || 'http://localhost:3456';
const TENANT_ID = 'default';

// =============================================================================
// Example 1: Daily Standup Bot
// =============================================================================

/**
 * Scenario: AI assistant that participates in daily standup meetings
 *
 * Use handoffs to remember what was committed, what's blocking, and what
 * the team is working on across days.
 */
async function dailyStandupBot() {
  console.log('=== Example 1: Daily Standup Bot ===\n');

  // Morning: Wake up with context from yesterday
  const context = await wakeUp(TENANT_ID, 'DevTeam');

  console.log('Good morning! Yesterday I learned:');
  console.log(context.last_handoff?.learned || 'Starting fresh today');

  // During standup, capture what was discussed
  await fetch(`${API_BASE}/api/v1/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      session_id: `standup-${Date.now()}`,
      with_whom: 'DevTeam',
      experienced: 'Team committed to finishing auth feature, blocked by API design decision',
      noticed: 'Sarah seemed frustrated about unclear requirements',
      learned: 'Blocking decisions should be documented immediately, not waited out',
      story: 'During standup, three team members mentioned blockers related to the same undefined API contract. This suggests we need to prioritize API design discussions.',
      becoming: 'A team helper who identifies systemic issues early',
      remember: 'API design meeting needed today at 2pm',
      significance: 0.8,
      tags: ['standup', 'blockers', 'team-process']
    })
  });

  console.log('✓ Standup context saved for tomorrow');
}

// =============================================================================
// Example 2: Customer Support Agent
// =============================================================================

/**
 * Scenario: Customer support AI that remembers previous interactions
 *
 * Build relationship with customers over time by remembering their
 * preferences, issues, and resolutions.
 */
async function customerSupportAgent() {
  console.log('\n=== Example 2: Customer Support Agent ===\n');

  const customerId = 'customer-123';

  // Check previous interactions
  const history = await fetch(
    `${API_BASE}/api/v1/handoffs/last?tenant_id=${TENANT_ID}`
  ).then(r => r.json());

  console.log('Welcome back! Last time we helped you with:');
  console.log(history.experienced || 'First time contacting support');

  // After resolving current issue
  await fetch(`${API_BASE}/api/v1/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      session_id: `support-${customerId}-${Date.now()}`,
      with_whom: customerId,
      experienced: `Helped ${customerId} resolve login issue - they were using wrong email`,
      noticed: 'Customer has had login issues 3 times this month',
      learned: 'Customers often forget which email they used for signup',
      story: `${customerId} contacted support for the 3rd time about login. We added a "show email" feature to the login screen to help users see what email they used.`,
      becoming: 'A support agent who notices patterns and prevents recurring issues',
      remember: 'Monitor login failure patterns, consider email reminder feature',
      significance: 0.7,
      tags: ['support', 'customer-service', 'ux-improvement']
    })
  });

  console.log('✓ Support interaction saved');
}

// =============================================================================
// Example 3: Learning Assistant
// =============================================================================

/**
 * Scenario: AI tutor that adapts to student's learning style
 *
 * Track what teaching methods work best for each student over time.
 */
async function learningAssistant() {
  console.log('\n=== Example 3: Learning Assistant ===\n');

  const studentId = 'student-456';

  // Wake up with learning history
  const context = await fetch(
    `${API_BASE}/api/v1/wake-up?tenant_id=${TENANT_ID}&with_whom=${studentId}`
  ).then(r => r.json());

  console.log(`Hi ${studentId}! I remember you learn best by:`);

  // Show what's been learned about this student
  const learningStyle = context.identity_thread
    .filter((h: any) => h.becoming?.includes('learn'))
    .slice(0, 3);

  learningStyle.forEach((h: any) => {
    console.log(`  - ${h.becoming}`);
  });

  // After tutoring session
  await fetch(`${API_BASE}/api/v1/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      session_id: `tutor-${studentId}-${Date.now()}`,
      with_whom: studentId,
      experienced: 'Taught recursion using visual examples instead of code',
      noticed: 'Student understood immediately when seeing tree diagrams',
      learned: 'Visual learners benefit from diagrams before code',
      story: 'Previous attempts to teach recursion with code examples failed. Today I tried drawing tree structures on the whiteboard first, and the student grasped the concept immediately.',
      becoming: 'A tutor who adapts teaching methods to individual learning styles',
      remember: `${studentId} learns best visually - use diagrams before code`,
      significance: 0.9,
      tags: ['tutoring', 'learning-style', 'visual-learner']
    })
  });

  console.log('✓ Learning session saved');
}

// =============================================================================
// Example 4: Research Assistant
// =============================================================================

/**
 * Scenario: AI research assistant tracking literature and insights
 *
 * Build knowledge over time by consolidating research findings
 * and identifying patterns across papers.
 */
async function researchAssistant() {
  console.log('\n=== Example 4: Research Assistant ===\n');

  // After reading a paper
  await fetch(`${API_BASE}/api/v1/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      session_id: `research-paper-${Date.now()}`,
      with_whom: 'ResearchLab',
      experienced: 'Read paper on transformer attention mechanisms',
      noticed: 'Authors used sparse attention to reduce O(n²) complexity',
      learned: 'Sparse attention patterns can maintain accuracy while improving efficiency',
      story: 'This is the 5th paper I\'ve read on efficient transformers. All of them mention sparse attention as a key technique. This suggests it\'s become a consensus approach in the field.',
      becoming: 'A research assistant who synthesizes patterns across literature',
      remember: 'Create summary of sparse attention techniques across all papers read',
      significance: 0.8,
      tags: ['research', 'transformers', 'attention-mechanisms']
    })
  });

  // After reading 10+ papers, consolidation will automatically create a knowledge note
  console.log('✓ Research insight saved (will be consolidated after 10+ similar insights)');
}

// =============================================================================
// Example 5: Project Management Agent
// =============================================================================

/**
 * Scenario: AI project manager tracking progress and risks
 *
 * Remember project history, decisions, and their outcomes
 * to provide better guidance in future projects.
 */
async function projectManagementAgent() {
  console.log('\n=== Example 5: Project Management Agent ===\n');

  const projectName = 'E-commerce Redesign';

  // After retrospective
  await fetch(`${API_BASE}/api/v1/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      session_id: `project-${projectName}-${Date.now()}`,
      with_whom: 'ProductTeam',
      experienced: 'E-commerce redesign completed 2 weeks late but under budget',
      noticed: 'Late delivery was caused by scope creep, not technical issues',
      learned: 'Strict scope control is more important than perfect estimation',
      story: 'We spent weeks estimating perfectly, but then added features mid-project without adjusting timeline. Future projects should have a formal change request process.',
      becoming: 'A project manager who prevents scope creep through process',
      remember: 'Implement change request process before next project',
      significance: 0.9,
      tags: ['project-management', 'scope-creep', 'lessons-learned']
    })
  });

  // Retrieve similar past projects when starting new one
  const similarProjects = await fetch(
    `${API_BASE}/api/v1/handoffs/last?tenant_id=${TENANT_ID}`
  ).then(r => r.json());

  console.log('Lessons from past projects:');
  console.log(similarProjects.learned || 'No previous project data');

  console.log('✓ Project retrospective saved');
}

// =============================================================================
// Example 6: Personal Memory Assistant
// =============================================================================

/**
 * Scenario: AI personal assistant that remembers user's life
 *
 * Track personal goals, habits, and growth over time.
 */
async function personalMemoryAssistant() {
  console.log('\n=== Example 6: Personal Memory Assistant ===\n');

  const userId = 'user-789';

  // Capture meaningful life event
  await fetch(`${API_BASE}/api/v1/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      session_id: `personal-${userId}-${Date.now()}`,
      with_whom: userId,
      experienced: 'Ran first 5K race in 35 minutes',
      noticed: 'Felt tired afterwards but accomplished',
      learned: 'Consistent training for 8 weeks paid off',
      story: 'Started running 3 months ago. Could barely run 1km then. Today completed 5K race. This shows that gradual progress leads to significant results.',
      becoming: 'A person who commits to goals and follows through',
      remember: 'Sign up for 10K race in 6 months',
      significance: 0.85,
      tags: ['personal', 'running', 'goals', 'achievement']
    })
  });

  // Export identity thread to see growth over time
  const identity = await fetch(
    `${API_BASE}/api/v1/export/thread?tenant_id=${TENANT_ID}&format=markdown`
  ).then(r => r.text());

  console.log('Your growth journey:');
  console.log(identity.split('\n').slice(0, 10).join('\n'));

  console.log('✓ Personal milestone saved');
}

// =============================================================================
// Example 7: Code Review Assistant
// =============================================================================

/**
 * Scenario: AI code reviewer that remembers team coding patterns
 *
 * Learn team's coding style and provide consistent feedback.
 */
async function codeReviewAssistant() {
  console.log('\n=== Example 7: Code Review Assistant ===\n');

  const teamName = 'BackendTeam';

  // After reviewing code
  await fetch(`${API_BASE}/api/v1/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      session_id: `review-${teamName}-${Date.now()}`,
      with_whom: teamName,
      experienced: 'Reviewed PR #123 - new authentication endpoints',
      noticed: 'Team consistently forgets to add error handling for database queries',
      learned: 'Need to emphasize error handling in code review checklist',
      story: 'This is the 5th PR this month missing database error handling. Adding try-catch blocks is not part of our current review checklist, so reviewers miss it.',
      becoming: 'A code reviewer who prevents recurring mistakes through process',
      remember: 'Update review checklist to include database error handling',
      significance: 0.75,
      tags: ['code-review', 'quality', 'process-improvement']
    })
  });

  console.log('✓ Code review insight saved');
}

// =============================================================================
// Example 8: Therapeutic Journaling Partner
// =============================================================================

/**
 * Scenario: AI journaling partner that helps with self-reflection
 *
 * Remember therapy sessions and personal growth patterns.
 */
async function therapeuticJournalingPartner() {
  console.log('\n=== Example 8: Therapeutic Journaling Partner ===\n');

  const userId = 'user-therapeutic';

  // After journaling session
  await fetch(`${API_BASE}/api/v1/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      session_id: `journal-${userId}-${Date.now()}`,
      with_whom: userId,
      experienced: 'Discussed feeling anxious about career progress',
      noticed: 'Anxiety increases when comparing to others on social media',
      learned: 'Social media comparison is trigger for anxiety',
      story: 'We explored why career progress feels slow. Realized that I only see others\' highlights on LinkedIn, not their struggles. This comparison is unfair to myself.',
      becoming: 'A person who recognizes unfair comparisons and focuses on own path',
      remember: 'Limit LinkedIn usage to 30min/day, focus on own goals',
      significance: 0.95,
      tags: ['journaling', 'self-awareness', 'mental-health']
    })
  });

  // Consolidate after 10+ therapy sessions to identify patterns
  console.log('✓ Journaling session saved (patterns will emerge over time)');
}

// =============================================================================
// Main - Run Examples
// =============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Thread\'s Memory System - Practical Usage          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    await dailyStandupBot();
    await customerSupportAgent();
    await learningAssistant();
    await researchAssistant();
    await projectManagementAgent();
    await personalMemoryAssistant();
    await codeReviewAssistant();
    await therapeuticJournalingPartner();

    console.log('\n✅ All examples completed successfully!');
    console.log('\nKey Takeaways:');
    console.log('1. Handoffs capture meaning, not just data');
    console.log('2. Identity threads show growth over time');
    console.log('3. Consolidation finds patterns automatically');
    console.log('4. Use "becoming" to track who you\'re becoming');
    console.log('5. Use "remember" for actionable items\n');
  } catch (error) {
    console.error('❌ Example failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  dailyStandupBot,
  customerSupportAgent,
  learningAssistant,
  researchAssistant,
  projectManagementAgent,
  personalMemoryAssistant,
  codeReviewAssistant,
  therapeuticJournalingPartner,
};
