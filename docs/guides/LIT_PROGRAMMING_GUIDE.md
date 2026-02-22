# Literate Programming for AI-Native Codebases

## Agent Development Guidelines

**Version:** 1.0
**Date:** 2026-02-21
**Target File Size:** ~1000 tokens
**Purpose:** Create codebases that AI agents can understand efficiently

---

## Overview

Literate `.lit.ts` files mix **narrative documentation** with **implementation code**. The goal: AI agents can understand and modify code with minimal token usage.

**Key Principle:** One concept per file, self-contained context.

---

## File Format Specification

### Basic Structure

```typescript
/**
 * ============================================================================
 * <TOOL_NAME> - Literate Programming Version
 * ============================================================================
 *
 * Target: ~1000 tokens
 *
 * TABLE OF CONTENTS:
 * 1. <Chapter Title> [Documentation Pattern]
 * 2. <Chapter Title> [Documentation Pattern]
 * ...
 * ============================================================================
 */

/**
 * ============================================================================
 * CHAPTER 1: <TITLE>
 * ============================================================================
 *
 * <Documentation pattern applied here>
 */

// ... code

/**
 * ============================================================================
 * END OF <TOOL_NAME>
 * ============================================================================
 *
 * TOKEN COUNT: <actual count>
 * NEXT STEPS: <what to do next>
 * RELATED FILES: <list>
 * ============================================================================
 */
```

---

## Documentation Patterns (Choose Based on Context)

### Pattern 1: Contract-Based (Default)

**Use for:** Standard sections, overview, simple operations

**Structure:**
- **What:** Clear description of what the code does
- **Input:** Expected inputs (types, constraints)
- **Output:** What it returns
- **Side Effects:** State changes, external calls

**Example:**
```typescript
/**
 * CONTRACT:
 * - Input: sessionId (string), withWhom (string), experienced (string)
 * - Output: Created handoff record with handoff_id
 * - Side Effect: Insert into session_handoffs table
 *
 * WHAT THIS DOES:
 * Preserves agent identity between sessions...
 */
```

---

### Pattern 2: Design by Contract (Critical Paths)

**Use for:** Validation, error handling, core business logic, database operations

**Structure:**
- **Precondition:** What must be true before execution
- **Postcondition:** What will be true after execution
- **Invariants:** What remains true throughout execution

**Example:**
```typescript
/**
 * DESIGN BY CONTRACT:
 * - Precondition: args object may have undefined/null values
 * - Postcondition: Returns error OR valid handoff object
 * - Invariants: All 8 required params present and non-empty
 */
```

---

### Pattern 3: Rationale Block (Complex Logic)

**Use for:** Algorithms, trade-offs, non-obvious decisions

**Structure:**
- **Why this approach:** The reasoning behind the implementation
- **Alternatives considered:** What was rejected and why
- **Trade-offs:** What was balanced

**Example:**
```typescript
/**
 * RATIONALE:
 * We validate BEFORE database operations because:
 * 1. PostgreSQL "NOT NULL constraint" errors don't specify which parameter
 * 2. Agent needs structured error to fix the problem
 * 3. Failing fast prevents partial execution
 *
 * ALTERNATIVES CONSIDERED:
 * - Let database handle validation: Rejected (cryptic errors)
 * - Validate in normalizeParams: Rejected (too early, no context)
 *
 * TRADE-OFFS:
 * - Extra validation code: Worth it for clear error messages
 * - Slight performance cost: Acceptable for non-critical path
 */
```

---

### Pattern 4: Usage Examples (Public APIs)

**Use for:** Tool interfaces, public functions, client-facing APIs

**Structure:**
- **Example 1:** Common use case
- **Example 2:** Edge case or alternative usage
- **Example 3:** Error scenario (if applicable)

**Example:**
```typescript
/**
 * USAGE EXAMPLES:
 *
 * Example 1: At Session End
 * ```typescript
 * await create_handoff({
 *   session_id: process.env.SESSION_ID || crypto.randomUUID(),
 *   with_whom: "Callin",
 *   experienced: "Fixed bug in validation...",
 *   // ... all required fields
 * });
 * ```
 *
 * Example 2: After Major Insight
 * ```typescript
 * await create_handoff({
 *   session_id: "s_insight_001",
 *   with_whom: "User",
 *   experienced: "Discovered new pattern...",
 *   // ... all required fields
 * });
 * ```
 */
```

---

## Chapter Structure Guidelines

### Recommended Chapter Template

```typescript
CHAPTER 1: PURPOSE & OVERVIEW [Contract-Based]
- What does this code do?
- Why does it exist?
- What problem does it solve?

CHAPTER 2: WHEN TO USE IT [Contract-Based + Usage Example]
- When should this be called?
- What are the prerequisites?
- What are typical usage patterns?

CHAPTER 3: PARAMETERS/INPUTS [Contract-Based]
- What are the required inputs?
- What are optional inputs?
- What are the constraints?

CHAPTER 4: IMPLEMENTATION LOGIC [Design by Contract + Rationale]
- How does it work?
- Why this approach?
- What are the critical paths?

CHAPTER 5: ERROR HANDLING [Critical Path: Design by Contract]
- What can go wrong?
- How are errors handled?
- What error messages are returned?

CHAPTER 6: COMPLETE CODE [Implementation]
- Full working implementation
- Includes all dependencies
- Production-ready
```

---

## Token Targeting Strategies

### Target: ~1000 tokens per file

**Allocation:**
- Documentation/narrative: ~400 tokens
- Code/implementation: ~600 tokens

**If file exceeds 1200 tokens:**
- Split into multiple focused files
- Extract shared logic to separate utility file
- Remove redundant explanations

**If file under 600 tokens:**
- Consider merging related concepts
- Add more context/examples
- Combine with closely related tool

---

## Choosing Documentation Patterns

**Decision Tree:**

```
Is this a critical path (validation, error handling, core logic)?
├─ YES → Use Design by Contract
└─ NO
    └─ Is the logic complex or non-obvious?
        ├─ YES → Add Rationale Block
        └─ NO
            └─ Is this a public API/tool interface?
                ├─ YES → Add Usage Examples
                └─ NO → Use Contract-Based (default)
```

---

## File Naming Conventions

```
<tool-name>.lit.ts

Examples:
- create-handoff.lit.ts
- wake-up.lit.ts
- semantic-search.lit.ts
- get-last-handoff.lit.ts

Rules:
- Use kebab-case (lowercase, hyphens)
- End with .lit.ts suffix
- Name should clearly indicate purpose
- One file per tool/feature
```

---

## Dependencies and Related Files

**Always include at the end:**

```typescript
/**
 * DEPENDENCIES:
 * - <package/module>: <why it's needed>
 *
 * RELATED TOOLS:
 * - <tool-name>: <relationship>
 * - <tool-name>: <relationship>
 *
 * RELATED FILES:
 * - <file-path.lit.ts>: <how it relates>
 *
 * HANDLER LOCATION (if applicable):
 * In <original-file>:<line-range>
 * In lit structure: This file IS the handler
 */
```

---

## Quality Checklist

Before considering a `.lit.ts` file complete:

- [ ] Target token count ~1000 (±200)
- [ ] All chapters have appropriate documentation patterns
- [ ] Critical paths use Design by Contract
- [ ] Complex logic has Rationale blocks
- [ ] Public APIs have Usage Examples
- [ ] File is self-contained (can understand without reading other files)
- [ ] Dependencies are documented
- [ ] Related files are listed
- [ ] Token count is stated at end
- [ ] Code is production-ready (not pseudocode)

---

## Example Reference

See `create-handoff.lit.ts` for complete example of all patterns applied.

---

## Next Steps After Creating .lit.ts Files

1. **Build evaluation facility** - Measure token usage, comprehension time
2. **Test with AI agents** - Have agents read and modify files
3. **Iterate on format** - Adjust based on real usage data
4. **Convert more files** - Apply pattern to other tools

---

## Philosophy

> "The goal is not documentation for documentation's sake.
> The goal is AI agents can understand and modify code efficiently.
> Every word should serve that purpose."

---

## Credits

**Concept Origin:** Donald Knuth's Literate Programming (1984)

**AI-Native Adaptation:** Developed from user's 23-year journey with literate programming:
- 2002: Discovered literate programming concepts
- LEO Editor: Visual demonstration of code+docs together
- Literate CoffeeScript: Elegant implementation without special tools
- 2025: Applied to AI agent codebase optimization

**Core Insight:** Small files (~1000 tokens) + narrative structure = efficient AI comprehension

---

**Version History:**
- 1.0 (2026-02-21): Initial guidelines with 4 documentation patterns
