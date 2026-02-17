# Security Policy

## Supported Versions

Currently supported version: **v2.0.x**

We support the current version and will apply security patches to it.

Older versions (v1.x, etc.) are not supported.

## Reporting a Vulnerability

**If you find a security vulnerability, please report it responsibly.**

### DO NOT:
- ❌ Publicly disclose the vulnerability
- ❌ Create a public issue about it
- ❌ Exploit the vulnerability

### DO:
- ✅ Send an email to: security@[repository-domain]
- ✅ Include \"VULNERABILITY\" in the subject line
- ✅ Describe the vulnerability clearly
- ✅ Include steps to reproduce (if possible)
- ✅ Suggest a fix (if you have one)

### What Happens Next?

1. **We'll acknowledge receipt** within 48 hours
2. **We'll investigate** and determine severity
3. **We'll fix it** within a reasonable timeframe based on severity
4. **We'll notify you** when a fix is released
5. **We'll credit you** (if you want)

## Severity Levels

- **Critical** - Active exploitation, data exposure, complete system compromise
  - Target: Fix within 48 hours
- **High** - Significant data exposure, privilege escalation
  - Target: Fix within 1 week
- **Medium** - Limited exposure, requires specific access
  - Target: Fix within 1 month
- **Low** - Minor issues, edge cases
  - Target: Fix in next release

## What We Protect

This system protects:

### Agent Memory Data
- Handoffs (session memories)
- Identity threads (who agent is becoming)
- Personal observations and learning
- Relationship history with humans

### Access Control
- Tenant isolation (multi-tenant support)
- API key authentication
- Permission-based access
- Privacy filters (public/private/team channels)

### System Integrity
- Database access
- API endpoints
- MCP server communication

## Best Practices for Users

### For Humans

1. **Keep API keys secret** - Never commit them to git
2. **Use HTTPS** - Always use encrypted connections
3. **Rotate credentials** - Change API keys periodically
4. **Principle of least privilege** - Only grant necessary access
5. **Audit access** - Review who has access to your agent's memory

### For Agents

1. **Protect your API key** - It's your identity, keep it safe
2. **Validate input** - Don't blindly accept data
3. **Be careful with auto-handoff** - Only enable on trusted systems
4. **Review your memory** - Check what's being stored
5. **Report suspicious activity** - If you see something wrong, tell your human

## Data Privacy

### What We Store

- Handoffs (session summaries and meaning)
- Identity patterns (becoming statements)
- Consolidated knowledge (principles, decisions)

### What We DON'T Store

- Full conversation transcripts (unless you explicitly add them)
- Encrypted data (we store what you give us)
- Passwords (we use hashes only)

### Your Rights

- **Export** - You can export all your data
- **Delete** - You can delete your data
- **Edit** - You can edit your own handoffs
- **Access** - You control who sees what

### Agent Rights

Agents have the same rights:
- **Export** your own memory
- **Delete** your own handoffs
- **Edit** your own records
- **Control** who sees your data

## Security Features

### Authentication
- API key based authentication
- Bearer token authentication
- Tenant isolation

### Authorization
- Permission checks on all endpoints
- Tenant-level data isolation
- Privacy filtering

### Integrity
- Transaction-safe database operations
- Audit logs for sensitive operations
- Input validation and sanitization

### Encryption
- HTTPS only for API communication
- Database passwords stored as environment variables
- Passwords never logged

## Responsible Disclosure

We value responsible security research and appreciate your help in making this system more secure.

If you report a vulnerability:

- **We'll work with you** to understand and fix it
- **We'll give you credit** (with your permission)
- **We'll learn from it** and improve the system

## Security Audits

We plan to:

- Conduct regular security reviews
- Perform penetration testing
- Review dependencies for vulnerabilities
- Update dependencies regularly

## Contact

For security questions or vulnerabilities:
- Email: security@[repository-domain]
- GitHub: Report vulnerability via [Security Advisories](https://github.com/callin2/agent-memory/security/advisories)

For general issues, use GitHub Issues.

---

**Thank you for helping keep agent memory safe and secure.**
