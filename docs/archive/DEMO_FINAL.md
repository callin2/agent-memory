# Thread's Memory System - Multi-Agent Demo

## Quick Start

```bash
# 1. Seed the demo with actual project context
npx tsx scripts/seed-demo-context.ts

# 2. Start server (if not running)
npm run dev

# 3. Open demo
open http://localhost:3456/demo/chat/index.html
```

## What This Demo Shows

**AI agents that:**
- Sound like real colleagues (natural conversation)
- Remember actual project work (z.ai, glm-4.7, TypeScript errors)
- Reference shared experiences naturally
- Build collective intelligence through memory

**Try these questions:**
1. "What did we build for Thread's Memory System?"
2. "Document the session_handoffs table schema"
3. "How did we fix the foreign key constraint error?"
4. "Tell me about your experience debugging TypeScript"

## Key Features

✅ **Natural conversation tone** - No "As the Planner..." robot-speak
✅ **Project context awareness** - Agents reference actual implementation
✅ **Shared memory** - All agents access same tenant history
✅ **Identity continuity** - Agents become through work, not role-playing

## Behind the Scenes

**Seeded memories:**
- Planner designing multi-agent orchestration
- Researcher investigating z.ai API (glm-4.7 model)
- Writer documenting session_handoffs schema
- Reviewer catching Planner's lack of context
- Researcher debugging 17 TypeScript errors
- Writer creating interactive chat UI
- Planner fixing foreign key constraint
- Researcher exploring multi-agent frameworks

**How it works:**
1. Agents query their last 10 handoffs (personal history)
2. Plus team's last 15 handoffs (shared context)
3. LLM generates responses using actual project details
4. New handoffs created after each interaction
5. Identity builds over time

## Technical Stack

- **Backend:** Node.js, Express, PostgreSQL
- **LLM:** z.ai API with glm-4.7 model
- **Memory:** Thread's Memory System (session_handoffs table)
- **Frontend:** Vanilla JS, Tailwind CSS

## Demo URLs

- **Chat Demo:** http://localhost:3456/demo/chat/index.html
- **Timeline Explorer:** http://localhost:3456/demo/timeline/index.html
- **Comparison:** http://localhost:3456/demo/comparison/index.html
- **Health Check:** http://localhost:3456/health

## Why This Matters

**Generic AI:**
> "# PostgreSQL: The Open Source Powerhouse..."
> (Could apply to any project)

**Thread's Memory System:**
> "We created session_handoffs table. I remember fixing the foreign key constraint where tenant_id references tenants table. Then we debugged those TypeScript errors..."
> (Connected to YOUR actual work)

**That's the difference - identity through shared experience.**

## Status

✅ Production-ready demo
✅ Natural agent conversations
✅ Project-specific responses
✅ Working memory integration

---

Built with ❤️ using Thread's Memory System
