# GLM (z.ai) Usage Report

## Configuration

```bash
LLM_PROVIDER=zai
LLM_MODEL=GLM-4.5-air
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=1000
ZAI_API_KEY=0b59f5980c764cbcb8c60def8b37a3b5.zPHaTUuz0gaoMVNN
ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4
```

## Where GLM is Used

### 1. Consolidation (Reflection Generation)

**File:** `src/services/consolidation/reflection.ts`

**Purpose:** Generate high-level reflections from consolidated memories

**Usage:**

#### a) Generate Salient Questions
```typescript
// Input: 100-700 session observations
System: "You are an expert at analyzing agent memory consolidation. Given a set of session observations, generate 3-5 high-level questions..."

User: "Here are {n} recent session observations: {observations}
Generate 3-5 salient high-level questions..."

// Output: 3-5 abstract questions
// Example: "What patterns emerge across these sessions?"
```

#### b) Generate Insights
```typescript
System: "You are an expert at analyzing agent experiences. Answer questions based on observations..."

User: "Question: {question}
Observations: {observations}
Answer the question insightfully..."

// Output: 3-5 insights per question
```

#### c) Generate Summary
```typescript
System: "You are an expert at summarizing agent experiences..."

User: "Here are {n} recent sessions:
{observations}

Provide a 200-400 character summary..."

// Output: Consolidated reflection summary
```

**Frequency:**
- Daily: ~100 sessions → 1 reflection
- Weekly: ~700 sessions → 1 reflection
- Monthly: ~10,000 sessions → 1 reflection

**Estimated API Calls:**
- Daily: 3-5 calls per reflection (questions + insights + summary)
- Weekly: Same
- Monthly: Same
- **Total: ~3-5 calls per day (during consolidation)**

---

### 2. Semantic Memory (Principle Extraction)

**File:** `src/services/semantic-memory.ts`

**Purpose:** Extract timeless principles from specific episodes

**Usage:**

```typescript
System: "You are an expert at extracting timeless principles from experiences.
Review the episodic memories and extract 3-5 generalized principles.

For each principle:
- Name it (2-6 words)
- Provide context (concrete example from episodes)
- Category (learning, pattern, identity, preference)
- Confidence (0.0-1.0)

Return as JSON array."

User: "Episodic memories:
{episodes}

Extract 3-5 principles..."

// Output:
[
  {
    "principle": "User benefits from concrete examples for abstract concepts",
    "context": "Struggled with TypeScript generics until shown practical example",
    "category": "learning",
    "confidence": 0.85
  }
]
```

**Frequency:**
- Every consolidation (daily/weekly/monthly)
- Processes the same sessions as reflection

**Estimated API Calls:**
- 1-2 calls per consolidation
- **Total: ~1-2 calls per day**

---

### 3. Chat Demo (Multi-Agent Orchestration)

**File:** `src/api/chat-demo.ts`

**Purpose:** Demo chat interface with agent coordination

**Usage:**

```typescript
System: "You coordinate a multi-agent team building Thread's Memory System..."

User: "{user_message}"

// Output: Agent coordination response
```

**Frequency:**
- Only in demo mode
- **Production: NOT USED**

---

## Total GLM API Usage

### Daily Estimate:

| Purpose | Calls per Day | Notes |
|---------|---------------|-------|
| Consolidation (Reflection) | 3-5 | Daily consolidation at 2 AM |
| Semantic Memory (Principles) | 1-2 | During consolidation |
| Chat Demo | 0 | Demo only |
| **TOTAL** | **4-7 calls/day** | **~30-50 calls/week** |

### Weekly Estimate:

| Schedule | Sessions | API Calls |
|----------|----------|-----------|
| Daily (7×) | 700 | 21-35 |
| Weekly (1×) | 700 | 3-5 |
| **TOTAL** | **1,400** | **24-40 calls/week** |

### Monthly Estimate:

| Schedule | Sessions | API Calls |
|----------|----------|-----------|
| Daily (30×) | 3,000 | 90-150 |
| Weekly (4×) | 2,800 | 12-20 |
| Monthly (1×) | 10,000 | 3-5 |
| **TOTAL** | **15,800** | **105-175 calls/month** |

---

## Cost Analysis

### GLM-4.5-air Pricing:

**z.ai pricing** (check z.ai for current rates):
- Typically much cheaper than GPT-4
- Estimated: ¥0.001-0.01 per 1K tokens

### Token Usage per Call:

| Call Type | Input Tokens | Output Tokens | Total |
|-----------|--------------|---------------|-------|
| Questions | 2,000 | 200 | 2,200 |
| Insights | 2,500 | 500 | 3,000 |
| Summary | 3,000 | 300 | 3,300 |
| Principles | 1,500 | 400 | 1,900 |
| **Average** | **2,250** | **350** | **2,600** |

### Monthly Cost Estimate:

```
Calls per month: ~150
Tokens per call: ~2,600
Total tokens: ~390,000 tokens/month

Estimated cost: ¥0.39-3.90 per month (very rough estimate)
```

**Actual cost depends on z.ai's current pricing.**

---

## Fallback Behavior

If GLM API fails, system has **heuristic fallbacks**:

1. **Reflection Generation:**
   - Questions: Template-based questions
   - Insights: Pattern extraction from tags/becoming
   - Summary: Concatenation of recent experiences

2. **Semantic Memory:**
   - Principles: Heuristic extraction (patterns in text)
   - Categories: Keyword-based classification

**System continues working even if GLM is down!** ✅

---

## Monitoring

### Check GLM Usage:

```bash
# View consolidation logs
pm2 logs consolidation-daily --lines 50

# Check API errors in logs
grep -r "z.ai API error" logs/

# Monitor consolidation status
pm2 status | grep consolidation
```

### Test GLM Integration:

```bash
# Manually trigger daily consolidation
CONSOLIDATION_TYPE=daily node dist/scripts/run-consolidation.js

# Check results
psql -d agent_memory_dev -c "SELECT * FROM memory_reflections ORDER BY created_at DESC LIMIT 5;"
```

---

## Optimization Opportunities

### Current State:
- ✅ Consolidation runs during low-activity hours (2-4 AM)
- ✅ Batching: Processes all sessions at once
- ✅ Has fallback if GLM fails

### Future Optimizations:
1. **Cache LLM responses** - Avoid regenerating same reflections
2. **Incremental consolidation** - Only process new sessions
3. **Smaller model** - Use cheaper model for simple tasks
4. **Prompt compression** - Reduce input token count

---

## Configuration Changes

### To Change Model:

```bash
# .env
LLM_MODEL=GLM-4.5-flash  # Faster, cheaper
LLM_MODEL=GLM-4.5-air     # Current (balanced)
LLM_MODEL=GLM-4           # Most capable (slower, more expensive)
```

### To Disable LLM:

```bash
# Remove API key
ZAI_API_KEY=

# System will use heuristic fallbacks
```

### To Switch Provider:

```bash
# Use OpenAI instead
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4

# Use Anthropic instead
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-3-sonnet-20240229
```

---

## Summary

**GLM Usage:** Minimal, efficient, with fallbacks
**Daily Calls:** 4-7 calls during consolidation
**Monthly Cost:** Estimated ¥0.39-3.90 (verify with z.ai)
**Reliability:** System works even if GLM is down
**Optimization:** Already batched and scheduled for low-activity hours

**Recommendation:** Current usage is reasonable and cost-effective. No changes needed unless you see specific issues or high costs.
