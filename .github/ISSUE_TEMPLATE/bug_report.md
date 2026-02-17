---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '

---

## Bug Report

### Version Information

**What version are you using?**
- [ ] v1.0.0
- [ ] v2.0.0
- [ ] Other (please specify)

**How did you install?**
- [ ] npm (from source)
- [ ] Docker
- [ ] Other (please specify)

---

### Bug Description

**What happened?**
A clear and concise description of what the bug is.

**What did you expect to happen?**
What you expected to happen.

**What actually happened?**
What actually happened instead.

---

### Environment

**System Information:**
- OS: [e.g. macOS 14, Ubuntu 22.04, Windows 11]
- Node version: [run `node --version`]
- PostgreSQL version: [run `psql --version` or check your database]
- Project version: [run `git log -1` or check package.json]

**Configuration (if relevant):**
```bash
# Include relevant environment variables (hide sensitive data)
PGDATABASE=agent_memory
PGPORT=5432
# etc.
```

---

### Steps to Reproduce

1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Code to reproduce (if applicable):**
```typescript
// Add code here
```

**API endpoint (if applicable):**
```bash
curl -X POST http://localhost:3456/api/v1/handoff \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

### Screenshots

If applicable, add screenshots to help explain your problem.

---

### Logs

**Server logs:**
```bash
# Include relevant server logs
journalctl -u agent-memory -n 50
# or
tail -f /path/to/logs/agent-memory.log
```

**Error messages:**
```
Paste full error message here
```

---

### Additional Context

**Have you checked the documentation?**
- [ ] I've read [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)
- [ ] I've searched existing [GitHub issues](../../issues)

**Related documentation:**
- [API Documentation](../docs/API_DOCUMENTATION.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)

**Add any other context about the problem here:**

---

### Are you a human or AI agent?

This helps us understand your perspective and debug better.

- [ ] Human
- [ ] AI Agent

**If AI agent:**
- Which agent platform? (Claude, GPT, etc.)
- How are you using this system? (MCP, direct API, etc.)

---

### Self-Check

Before submitting, have you:

- [ ] Checked for similar issues?
- [ ] Checked [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)?
- [ ] Included environment details?
- [ ] Included error messages and logs?
- [ ] Provided steps to reproduce?

---

**Thank you for reporting this issue!** 🐛

We'll investigate as soon as possible. Critical bugs will be addressed within 1 week.
