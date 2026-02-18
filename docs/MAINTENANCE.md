# Maintenance Protocol

**Purpose**: Keep this codebase maintainable for multi-agent, multi-human collaboration.

**Core Principle**: Documentation is part of the feature, not an afterthought.

---

## Golden Rules

1. **Update docs when you change code** - Not "later", NOW
2. **Keep SOURCES_OF_TRUTH.md accurate** - It's our foundation
3. **Clear communication saves time** - Detailed commits prevent confusion
4. **Test before committing** - Broken code blocks everyone
5. **Leave the codebase better** - Fix small issues when you see them

---

## Protocol: Making Changes

### 1. Before You Start

```bash
# Check what's current
cat docs/SOURCES_OF_TRUTH.md

# Find the right file to edit
# Don't guess - verify
```

**Time**: 30 seconds
**Impact**: Prevent working on wrong files

---

### 2. Making Changes

#### Adding a New Feature

**Steps**:
1. Implement the feature
2. Add/update tests
3. Update relevant documentation
4. Update SOURCES_OF_TRUTH.md
5. Commit everything together

**Example: Adding MCP Tool**

```bash
# 1. Edit source
vim src/mcp/memory-server-http.ts
# - Add tool to list
# - Implement handler

# 2. Add test
vim tests/integration/mcp/test-new-tool.mjs

# 3. Update documentation
vim docs/MCP_QUICK_START.md
# - Add to tools list
# - Add usage example

# 4. Update sources of truth
vim docs/SOURCES_OF_TRUTH.md
# - Add to MCP Tools table

# 5. Commit all together
git add src/mcp/memory-server-http.ts \
        tests/integration/mcp/test-new-tool.mjs \
        docs/MCP_QUICK_START.md \
        docs/SOURCES_OF_TRUTH.md

git commit -m "feat(mcp): add new_tool for X

- Implements new_tool with parameters Y, Z
- Handles error cases for...
- Adds integration tests
- Updates documentation with examples
- Updates SOURCES_OF_TRUTH.md

Co-Authored-By: Claude Sonnet 4.5"
```

**Time**: 1-2 hours total
**Result**: Complete, documented feature

---

#### Fixing a Bug

**Steps**:
1. Identify root cause
2. Fix the bug
3. Add/update tests to prevent regression
4. Update docs if behavior changed
5. Update SOURCES_OF_TRUTH.md if needed

**Example: Fixing Auth Bug**

```bash
# 1. Fix source
vim src/mcp/auth.ts
# - Fix token validation logic

# 2. Update/add test
vim tests/integration/mcp/test-mcp-auth.mjs
# - Add test case for the bug

# 3. Check if docs need update
# Does this change user-visible behavior?
# If yes, update MCP_HTTP_AUTH.md

# 4. Check SOURCES_OF_TRUTH.md
# Does this change what's "current"?
# If yes, update the status

# 5. Commit
git add src/mcp/auth.ts \
        tests/integration/mcp/test-mcp-auth.mjs

git commit -m "fix(auth): resolve token validation edge case

- Fixed: Tokens with special characters were rejected
- Root cause: Regex didn't escape dots
- Added test case for special characters
- No user-visible behavior change
- No doc updates needed

Fixes #123
Co-Authored-By: Claude Sonnet 4.5"
```

**Time**: 30 minutes - 1 hour
**Result**: Fixed bug with regression test

---

#### Removing a Feature

**Steps**:
1. Remove the code
2. Remove/update tests
3. Update documentation
4. Move old docs to archive/
5. Update SOURCES_OF_TRUTH.md
6. Add to CHANGELOG.md

**Example: Removing Old SSE Server**

```bash
# 1. Remove code
git rm src/mcp/memory-server.ts
git rm src/mcp/context.ts

# 2. Remove old tests
git rm test-mcp-tools.mjs
git rm test-ping.mjs

# 3. Update SOURCES_OF_TRUTH.md
vim docs/SOURCES_OF_TRUTH.md
# - Move to "Removed Source Code" section
# - Mark as removed with date

# 4. Update CHANGELOG.md
vim docs/CHANGELOG.md
# - Add breaking change entry
# - Document migration path

# 5. Commit
git add docs/SOURCES_OF_TRUTH.md docs/CHANGELOG.md

git commit -m "break(mcp): remove old SSE server

- Removed src/mcp/memory-server.ts (SSE-based)
- Removed src/mcp/context.ts (AsyncLocalStorage)
- Replaced by: src/mcp/memory-server-http.ts
- Migration: Update .mcp.json to use /mcp endpoint
- All 11 tools available in new server
- Updated SOURCES_OF_TRUTH.md
- Added migration guide to CHANGELOG

Co-Authored-By: Claude Sonnet 4.5"
```

**Time**: 1 hour
**Result**: Clean removal, clear migration path

---

#### Updating Documentation Only

**Steps**:
1. Update the documentation
2. Verify against code
3. Update SOURCES_OF_TRUTH.md if status changed
4. Commit with `docs:` prefix

**Example: Fixing Outdated Auth Guide**

```bash
# 1. Update doc
vim docs/MCP_HTTP_AUTH.md
# - Fix endpoint from /sse to /mcp
# - Update examples

# 2. Verify against code
cat src/mcp/memory-server-http.ts | grep endpoint

# 3. Update SOURCES_OF_TRUTH.md
vim docs/SOURCES_OF_TRUTH.md
# - Update "Last Updated" date
# - Verify status is still ✅ Current

# 4. Commit
git add docs/MCP_HTTP_AUTH.md docs/SOURCES_OF_TRUTH.md

git commit -m "docs(mcp): fix auth guide endpoints

- Fixed: Endpoint references /sse → /mcp
- Updated: All curl examples
- Verified: Matches memory-server-http.ts
- Updated SOURCES_OF_TRUTH.md timestamp

Co-Authored-By: Claude Sonnet 4.5"
```

**Time**: 15-30 minutes
**Result**: Accurate documentation

---

### 3. After You Finish

```bash
# Verify changes
git status
git diff --cached

# Run tests if applicable
npm test

# Commit with detailed message
git commit -m "..."
```

---

## Protocol: Keeping Sources of Truth Current

### When to Update SOURCES_OF_TRUTH.md

**Update when**:
- ✅ Adding new tool/feature
- ✅ Removing old tool/feature
- ✅ Changing architecture/transport
- ✅ File status changes (current → outdated → removed)
- ✅ Adding new documentation
- ✅ Archiving old documentation

**Don't update when**:
- ❌ Bug fix that doesn't change behavior
- ❌ Code refactor that doesn't change interface
- ❌ Adding test files
- ❌ Internal code improvements

---

### How to Update SOURCES_OF_TRUTH.md

**Step 1: Find the relevant table**
- Configuration Files
- Source Code
- MCP Tools
- Documentation
- Tests

**Step 2: Update the entry**
```markdown
| File | Status | Last Updated |
|------|--------|--------------|
| `src/mcp/new-tool.ts` | New feature | 2026-02-19 |
```

**Step 3: Move old entries**
- Current → Removed (if deleted)
- Current → Outdated (if replaced)
- Outdated → Archive (if very old)

**Step 4: Update timestamp**
```markdown
**Last updated**: 2026-02-19
```

---

## Protocol: Weekly Review

### For Humans (5 minutes)

```bash
# Check sources of truth
cat docs/SOURCES_OF_TRUTH.md

# Look for:
# - Stale "✅ Current" markers
# - New files not listed
# - Inaccurate information

# Update if needed
vim docs/SOURCES_OF_TRUTH.md
```

**Frequency**: Once per week
**Impact**: Prevents documentation drift

---

### For Agents (Automated)

Before starting work:
```bash
# Read sources of truth
cat docs/SOURCES_OF_TRUTH.md | grep -A 50 "Truth Table"
```

After finishing work:
```bash
# Update if you changed what's current
# If status changed, update the table
```

**Frequency**: Every session
**Impact**: Agents always work on current files

---

## Protocol: Handling Outdated Documentation

### Found Outdated Doc? 3 Options

#### Option 1: Update It (Best)
```bash
# 1. Update the doc to match reality
vim docs/OUTDATED_DOC.md

# 2. Update SOURCES_OF_TRUTH.md
# Change status from ❌ Outdated → ✅ Current
vim docs/SOURCES_OF_TRUTH.md

# 3. Commit
git add docs/OUTDATED_DOC.md docs/SOURCES_OF_TRUTH.md
git commit -m "docs: update OUTDATED_DOC.md

- Updated section X to match current implementation
- Verified against src/file.ts
- Updated SOURCES_OF_TRUTH.md status

Co-Authored-By: Claude Sonnet 4.5"
```

#### Option 2: Archive It (Good for very old docs)
```bash
# 1. Move to archive
mv docs/OUTDATED_DOC.md docs/archive/

# 2. Update SOURCES_OF_TRUTH.md
# Add to archived table
vim docs/SOURCES_OF_TRUTH.md

# 3. Commit
git add docs/archive/OUTDATED_DOC.md docs/SOURCES_OF_TRUTH.md
git commit -m "docs: archive OUTDATED_DOC.md

- Moved to archive/ (historical reference)
- Replaced by: NEW_DOC.md
- Updated SOURCES_OF_TRUTH.md

Co-Authored-By: Claude Sonnet 4.5"
```

#### Option 3: Delete It (Only if truly useless)
```bash
# WARNING: Only delete if:
# - Not historically interesting
# - No one references it
# - Completely superseded

git rm docs/USELESS_DOC.md
vim docs/SOURCES_OF_TRUTH.md
git add docs/SOURCES_OF_TRUTH.md
git commit -m "docs: remove USELESS_DOC.md

- Deleted: No longer relevant
- No replacement needed
- Updated SOURCES_OF_TRUTH.md

Co-Authored-By: Claude Sonnet 4.5"
```

**Recommendation**: Prefer Option 1 or 2. Archive, don't delete.

---

## Protocol: Commit Messages

### Structure

```
type(scope): description

- What changed
- Why it changed
- Migration path (if breaking)
- Related files updated
- Test coverage added

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Types

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(mcp): add get_compression_stats tool` |
| `fix` | Bug fix | `fix(auth): resolve token validation edge case` |
| `docs` | Documentation only | `docs(mcp): update quick start for HTTP` |
| `refactor` | Code change without feature change | `refactor(mcp): simplify auth flow` |
| `test` | Adding/updating tests | `test(mcp): add bearer token validation tests` |
| `chore` | Maintenance tasks | `chore: update dependencies` |
| `break` | Breaking change | `break(mcp): migrate from SSE to HTTP` |

### Scopes

Common scopes:
- `mcp` - MCP server
- `auth` - Authentication
- `api` - REST API
- `db` - Database
- `docs` - Documentation
- `tests` - Test infrastructure

---

## Protocol: Code Review

### For Humans Reviewing Agent Work

**Checklist**:
- [ ] Did agent update SOURCES_OF_TRUTH.md if needed?
- [ ] Did agent update relevant documentation?
- [ ] Did agent add/update tests?
- [ ] Does commit message clearly explain changes?
- [ ] Are changes consistent with SOURCES_OF_TRUTH.md?

**If something is wrong**:
1. Be specific about what's wrong
2. Reference SOURCES_OF_TRUTH.md
3. Explain why it's wrong
4. Suggest the fix

**Example**:
```
The MCP tool was added correctly, but:

❌ SOURCES_OF_TRUTH.md not updated
→ Please add the new tool to the "MCP Tools" table

❌ No usage example in MCP_QUICK_START.md
→ Please add an example like the other tools

Once fixed, this will be ready to merge.
```

---

### For Agents Reviewing Human Work

**Checklist**:
- [ ] Does change match SOURCES_OF_TRUTH.md?
- [ ] Are tests passing?
- [ ] Is documentation accurate?
- [ ] Any files that need updating?

**If something is unclear**:
1. Ask specific question
2. Reference SOURCES_OF_TRUTH.md
3. Explain what's confusing

---

## Protocol: Handling Confusion

### "I Don't Know Which File to Edit"

**Solution**:
```bash
# 1. Read SOURCES_OF_TRUTH.md
cat docs/SOURCES_OF_TRUTH.md

# 2. Find your topic in Truth Table
# 3. Read the "Current" file listed
# 4. Edit that file
# 5. Update SOURCES_OF_TRUTH.md if needed
```

---

### "This Doc Contradicts That Doc"

**Solution**:
```bash
# 1. Check SOURCES_OF_TRUTH.md
# Which one is marked ✅ Current?

# 2. The one marked ✅ is correct
# 3. Update the other to match
# 4. Update SOURCES_OF_TRUTH.md
```

---

### "I Think SOURCES_OF_TRUTH.md is Wrong"

**Solution**:
```bash
# 1. Verify against code
cat src/file.ts

# 2. If code is different:
#    - Update SOURCES_OF_TRUTH.md to match code
#    - Commit with clear message

# 3. If doc is different:
#    - Update code to match SOURCES_OF_TRUTH.md
#    - Or update SOURCES_OF_TRUTH.md if doc is right

git commit -m "docs(truth): fix SOURCES_OF_TRUTH.md accuracy

- Corrected: File X status was outdated
- Verified against src/file.ts
- All sources now aligned

Co-Authored-By: Claude Sonnet 4.5"
```

---

## Monthly Tasks

### For Humans (30 minutes)

```bash
# 1. Review documentation health
find docs -name "*.md" -mtime -30

# 2. Check for duplicates
find docs -name "*QUICK*"
find docs -name "*AUTH*"

# 3. Archive outdated docs
mv docs/old-thing.md docs/archive/

# 4. Update SOURCES_OF_TRUTH.md
vim docs/SOURCES_OF_TRUTH.md

# 5. Review and consolidate
# - Merge duplicate topics
# - Remove truly obsolete files
# - Update status markers
```

**Frequency**: First of each month
**Impact**: Prevents documentation bloat

---

## Summary

### The Routine

**Before work**:
1. Read SOURCES_OF_TRUTH.md (30 seconds)
2. Know what to edit (don't guess)

**During work**:
3. Make changes
4. Add tests
5. Update docs

**After work**:
6. Update SOURCES_OF_TRUTH.md if status changed
7. Commit with detailed message
8. Verify tests pass

### The Mindset

- **Documentation is code** - Treat it with same respect
- **Sources of truth are sacred** - Keep them accurate
- **Clear communication** - Detailed commits prevent confusion
- **Leave it better** - Fix small issues when you see them

### The Result

A maintainable codebase where:
- ✅ Agents know what to work on
- ✅ Humans can understand agent work
- ✅ New contributors can start quickly
- ✅ Confusion is minimized
- ✅ Collaboration is effective

---

**Remember**: This protocol only works if we follow it.
When in doubt, update SOURCES_OF_TRUTH.md.
It's the foundation of our collaboration.

---

**Last updated**: 2026-02-19
**Maintained by**: Project team (humans and agents together)
