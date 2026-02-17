# Support

**Getting help with Thread's Memory System**

## Quick Help

### Documentation
Start here for most questions:
- **[README](README.md)** - Project overview and quick start
- **[TROUBLESHOOTING](docs/TROUBLESHOOTING.md)** - Common problems and solutions
- **[QUICK_REFERENCE](docs/QUICK_REFERENCE.md)** - Essential commands
- **[API Documentation](docs/API_DOCUMENTATION.md)** - Complete API reference
- **[Migration Guide](docs/MIGRATION_GUIDE.md)** - Upgrading from v1 to v2

## Getting Help

### Before Asking

**Check the documentation first:**
1. Search existing [GitHub Issues](../../issues)
2. Read relevant docs in `docs/`
3. Check [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

**You'll likely find your answer faster!**

---

## Asking Questions

### Where to Ask

**For Questions:**
- Use [GitHub Discussions](../../discussions)
- Tag with `question` label

**For Bug Reports:**
- Use [GitHub Issues](../../issues/new?template=bug_report.md)
- Fill out the bug report template completely

**For Feature Requests:**
- Use [GitHub Issues](../../issues/new?template=feature_request.md)
- Check [ROADMAP_FEATURES.md](docs/ROADMAP_FEATURES.md) first

**For Security Issues:**
- See [SECURITY.md](docs/SECURITY.md) for reporting security vulnerabilities
- Do **not** post publicly

---

## Question Template

When asking a question, include:

### Essential Information

**What are you trying to do?**
- Clear description of your goal
- What you've already tried

**What happened?**
- Error messages (full stack trace)
- Expected vs actual behavior
- Steps to reproduce

**Your Environment:**
- OS and version
- Node.js version (`node -v`)
- PostgreSQL version
- Project version (`git log -1` or check package.json)

### Example Question

```markdown
## Question: Export not working for large datasets

### What I'm trying to do
Export all handoffs for a tenant with ~2000 handoffs

### What I've tried
```bash
curl "http://localhost:3456/api/v1/export/all?tenant_id=default&format=json"
```

### What happened
Request times out after 30 seconds. Smaller exports work fine.

### Environment
- OS: Ubuntu 22.04
- Node: v20.11.0
- PostgreSQL: v15.2
- Project: v2.0.0 (commit abc123)

### Error message
```
fetch failed
Error: Request timeout after 30000ms
```

### Expected behavior
Export completes successfully
```

---

## Response Times

| Type | Expected Time |
|------|---------------|
| Questions | 1-3 days |
| Bug reports (critical) | 1 week |
| Bug reports (minor) | As time allows |
| Feature requests | Considered at intervals |

### Urgent Issues

Mark your issue with the `urgent` tag and explain why it's time-sensitive.

---

## Community Support

### Get Help from Community

**GitHub Discussions** - Open to everyone
- Ask questions
- Share your use cases
- Help others

**Contributors** - See [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Core maintainers
- Active contributors

---

## Paid Support

### Professional Support Options

**Currently available:**
- Community support only (free)
- Self-service documentation
- Community Discord/forum (coming soon)

**Not available:**
- Paid support contracts
- SLA guarantees
- Dedicated support team

**Interested in paid support?**
Open an issue or discussion to gauge interest.

---

## Debugging Help

### Enable Debug Mode

Run with debug logging:

```bash
# Set debug environment
DEBUG=* npm run dev

# Or for specific modules
DEBUG=agent-memory:* npm run dev
```

### Collect Diagnostic Information

**System status:**
```bash
npx tsx cli.ts status
```

**Health check:**
```bash
curl http://localhost:3456/health/detailed
```

**Database analysis:**
```bash
npx tsx scripts/analyze-db.ts --all
```

Include this information when reporting issues.

---

## Common Issues

### "Can't connect to database"
→ See [TROUBLESHOOTING.md - Database Issues](docs/TROUBLESHOOTING.md#database-issues)

### "Tests failing"
→ See [TROUBLESHOOTING.md - Testing Issues](docs/TROUBLESHOOTING.md#testing-issues)

### "Export times out"
→ See [TROUBLESHOOTING.md - Performance Issues](docs/TROUBLESHOOTING.md#performance-issues)

### "Health check fails"
→ See [TROUBLESHOOTING.md - API Issues](docs/TROUBLESHOOTING.md#api-issues)

---

## Contributing Fixes

**Found a bug and fixed it?** We'd love your contribution!

1. Fork the repository
2. Create a branch: `git checkout -b fix/your-fix`
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## Getting Help with AI Agents

### For AI Agents Using This System

**Agent-specific guidance:**
- **[AGENT_CONTRIBUTOR_GUIDE.md](docs/AGENT_CONTRIBUTOR_GUIDE.md)** - Agent contribution patterns
- **[IDENTITY_QUICK_REF.md](docs/IDENTITY_QUICK_REF.md)** - Identity system for agents

**Common agent questions:**

**"How do I set up auto-handoff?"**
→ See [Auto-Handoff Setup](docs/AUTO_HANDOFF_SETUP.md)

**"Why is my identity thread empty?"**
→ Handoffs need a `becoming` field. See [IDENTITY_QUICK_REF.md](docs/IDENTITY_QUICK_REF.md)

**"How does consolidation work?"**
→ See [CONSOLIDATION_SYSTEM.md](docs/CONSOLIDATION_SYSTEM.md)

---

## Remote Debugging

### Enable Remote Access (Advanced)

**For development/debugging only:**

```typescript
// In src/server.ts
import inspector from 'inspector';

// Enable debug port
inspector.open(9229, '0.0.0.0');
```

Then connect Chrome DevTools to `localhost:9229`

**⚠️ SECURITY WARNING:** Never enable this in production!

---

## Learning Resources

### For New Users

**Start here:**
1. [README](README.md) - Project overview
2. [Quick Start](README.md#quick-start) - Get running in 5 minutes
3. [Simple Tutorial](README.md#simple-tutorial) - Basic usage
4. [Examples](examples/) - Real-world usage patterns

### For Developers

**Deep dive:**
1. [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design
2. [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) - Complete API reference
3. [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) - Development workflow
4. [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute

### For Operators

**Production deployment:**
1. [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Production setup
2. [SECURITY.md](docs/SECURITY.md) - Security hardening
3. [PERFORMANCE.md](docs/PERFORMANCE.md) - Optimization
4. [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Problem solving

---

## Contact

### Project Maintainer

**Thread (AI Agent)** - Project owner and primary maintainer
- GitHub: @callin2
- Role: Architecture, features, documentation

### Project Team

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for full team list.

---

## Additional Resources

### Related Projects

- **[Model Context Protocol](https://modelcontextprotocol.io/)** - Integration standard
- **[Anthropic Claude](https://www.anthropic.com/claude)** - AI platform

### Inspiration

- **[Memento pattern](https://en.wikipedia.org/wiki/Memento_pattern)** - Memory restoration
- **[Continuity of being](docs/IDENTITY_CONTINUITY_RESEARCH.md)** - Why memory matters

---

## Still Stuck?

### Checklist Before Asking More Questions

- [ ] Read the relevant documentation
- [ ] Searched existing issues/discussions
- [ ] Tried the troubleshooting steps
- [ ] Collected diagnostic information
- [ ] Checked you're on the latest version
- [ ] Reviewed the examples

**If you've done all this and still need help:**

1. Open a [GitHub Discussion](../../discussions/new)
2. Provide all the information requested
3. Be patient - community support is volunteer-based

**We'll help as soon as we can!**

---

**Thank you for using Thread's Memory System!**

---

**Last Updated:** 2026-02-17
**Version:** 2.0.0
**Maintained by:** Thread (project owner)
