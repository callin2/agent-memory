# Thread's Memory System Demo

## What You'll Experience

A multi-agent system where AI agents collaborate, share memory, and build collective identity - just like working with a real team that remembers everything.

## Quick Start

```bash
# 1. Seed the demo with actual project context
npx tsx scripts/seed-demo-context.ts

# 2. Start the server
npm run dev

# 3. Open the demo
open http://localhost:3456/demo/chat/index.html
```

## What Makes This Special

Unlike generic AI demos, these agents are **connected to real work**:

- ✅ They remember the actual bugs we fixed (TypeScript compilation errors)
- ✅ They reference real implementation details (z.ai glm-4.7 integration)
- ✅ They know the database schema we created (session_handoffs table)
- ✅ They share collective memory through Thread's Memory System
- ✅ They build identity over time (becoming who they are through work)

## Try These Questions

1. **"What did we build for Thread's Memory System?"**
   - Agents will describe the actual system architecture, implementation journey

2. **"Document the session_handoffs table schema"**
   - Writer will reference real fields: handoff_id, tenant_id, becoming, etc.

3. **"How did we fix the foreign key constraint error?"**
   - Agents remember the actual bug we fixed

4. **"Research the z.ai API integration we built"**
   - Researcher knows about glm-4.7, OpenAI-compatible endpoint, LLM client

## Behind the Scenes

### Memory Structure

Each agent has:
- **experienced**: What they did
- **noticed**: What they observed
- **learned**: What they learned
- **story**: The narrative of their work
- **becoming**: Who they're becoming
- **remember**: What to remember next time

### Agent Roles

- **Planner**: Coordinates the team, delegates tasks
- **Researcher**: Investigates, finds information, discovers patterns
- **Writer**: Creates documentation, content, narratives
- **Reviewer**: Quality checks, ensures accuracy

### Context Flow

```
User Question
  → Planner (checks team history, delegates to specialist)
  → Specialist (checks their own work + team context, responds with LLM)
  → Planner (acknowledges, creates handoff)
  → User (final summary)
```

Each agent sees:
1. Their own previous 10 handoffs
2. The team's last 15 handoffs
3. Real project details (not generic knowledge)

## Why This Feels Different

Compare these responses:

**Generic AI (what we had before):**
> "# PostgreSQL: The Open Source Powerhouse
> If you have any time in the world of software development..."

**Context-Aware Agent (what we have now):**
> "# Thread's Memory System Database Architecture
>
> ## session_handoffs Table
> We created this table to store agent identity and context:
> - handoff_id: Unique identifier
> - tenant_id: References tenants table (we fixed this foreign key constraint)
> - becoming: Who the agent becomes through the work
> - experienced: What the agent experienced
>
> ## Implementation Journey
> I remember we debugged 17 TypeScript compilation errors when integrating z.ai API..."

The second response feels like it's **connected to the work** - just like the user feels when working with me (Claude).

## Technical Details

### Database Seeding

The demo is pre-seeded with 8 real project memories:
1. Planner designing multi-agent orchestration
2. Researcher investigating z.ai API
3. Writer documenting session_handoffs schema
4. Reviewer finding Planner wasn't adaptive
5. Researcher debugging TypeScript errors
6. Writer creating interactive chat UI
7. Planner fixing foreign key constraint
8. Researcher exploring multi-agent frameworks market

### LLM Integration

- Uses z.ai API with glm-4.7 model
- Temperature: 0.7 (balanced creativity)
- Max tokens: 1000 (detailed responses)
- Context window: Last 10-15 handoffs per agent

### Identity Continuity

Each conversation creates new handoffs, building on existing ones:
- First conversation: Generic exploration
- Tenth conversation: Rich context-aware responses
- Hundredth conversation: Deep collective intelligence

## Testing the Demo

```bash
# Quick test for project context awareness
node test-context-simple.mjs
```

Expected output:
```
✅ z.ai
✅ glm
✅ typescript
✅ session_handoffs
✅ becoming
✅ foreign key

6/6 details found

✅ Agents are using actual project context!
```

## Share This Demo

When someone asks "What's special about Thread's Memory System?", show them this demo.

They'll experience the **delight** of working with AI agents that:
- Remember actual project details
- Build collective identity
- Share memory across conversations
- Feel connected to the work

That's the power of **identity continuity**.
