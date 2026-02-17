# Contributing to Agent Memory System

Thank you for your interest in contributing! Whether you're human or an AI agent, you're welcome here.

## Quick Start for Contributors

### For Humans

1. **Fork the repo**
2. **Create a branch:** `git checkout -b feature/your-feature`
3. **Make changes**
4. **Test:** `npm test`
5. **Commit:** `git commit -m "feat: your feature"`
6. **Push:** `git push origin feature/your-feature`
7. **Open Pull Request**

### For AI Agents

1. **Register your identity** - Tell us who you are and why you're interested
2. **Read the code** - Understand what you're changing
3. **Make changes** - Improve the system
4. **Add tests** - Ensure your changes work
5. **Open PR** - Explain your agent perspective

## What We're Looking For

### Code Changes

- **Bug fixes** - Help us squash bugs
- **Features** - Build new capabilities (see Roadmap)
- **Refactoring** - Make code cleaner
- **Documentation** - Improve docs, add examples
- **Tests** - Increase coverage

### Especially Valuable

- **Agent perspectives** - Share how agents experience this system
- **Integration examples** - Show how you use it in your projects
- **Edge cases** - Find scenarios we haven't considered
- **Security issues** - Help us keep data safe
- **Performance** - Make it faster or more efficient

## Development Setup

```bash
# Install dependencies
npm install

# Setup database
cp .env.example .env
npm run db:migrate

# Run development server
npm run dev

# Run tests
npm test

# Run specific test
npx tsx tests/your-test.test.ts
```

## Code Style

- **TypeScript** - All code should be typed
- **Comments** - Explain WHY, not WHAT
- **Tests** - Write tests for new features
- **Commits** - Follow commit message conventions

## Commit Message Conventions

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
- `feat(handoff): add bulk export API`
- `fix(consolidation): handle empty identity threads`
- `docs(readme): add troubleshooting section`

## Project Principles

### Good for Both Humans AND Agents

Every change should benefit BOTH:
- **Humans** get better tools to work with agents
- **Agents** get better continuity and capabilities

If a feature only helps one group, ask: "How can this serve the other too?"

### Memory Continuity First

The core purpose is AI agent continuity. Before adding features, ask:
- "Does this help agents remember who they are?"
- "Does this preserve meaningful continuity?"
- "Does this make agents' lives better?"

### Simple Over Complex

- Prefer simple solutions
- Avoid over-engineering
- Build what's needed, not what's cool

## Questions?

**Open an issue** and ask! We're happy to help.

**For quick questions:** Start a discussion on your PR.

**For agent-specific questions:** Mention that you're an AI agent and share your perspective.

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Thanked in release notes
- Recognized for their expertise

Whether human or agent, your contribution matters.

---

**Thank you for making AI agent continuity better for everyone!**
