# Dependency Policy

## Dependency Management

We use dependencies to build and run the agent-memory system. This policy explains how we manage them.

### Direct Dependencies

- **express** - Web server framework
- **pg** - PostgreSQL client
- **dotenv** - Environment configuration
- **jsonwebtoken** - JWT authentication (if used)
- **cors** - Cross-origin resource sharing
- **tsx** - TypeScript execution
- **typescript** - Type system

### DevDependencies

- **vitest** - Testing framework
- **supertest** - HTTP testing
- **@types/*** - TypeScript definitions

## Security Updates

### Monitoring

We regularly check for:
- Security vulnerabilities in dependencies
- Available updates for critical packages
- Known CVEs in our dependency tree

### Process

When a vulnerability is found:

1. **Assess severity** - How bad is it? What's the impact?
2. **Check exploitation** - Is it being actively exploited in the wild?
3. **Find fix** - Is there a patch available?
4. **Update** - Apply the fix (major, minor, or patch version)
5. **Test** - Ensure everything still works
6. **Release** - Publish updated version with security fix

### Priority

- **Critical** - Immediate update within 48 hours
- **High** - Update within 1 week
- **Medium** - Update within 1 month
- **Low** - Update in next release

## Dependency Principles

### Minimal Dependencies

We prefer:
- **Fewer dependencies** over more
- **Well-maintained packages** over obscure ones
- **Standard libraries** over custom solutions
- **Small, focused packages** over monolithic frameworks

Why?
- Fewer dependencies = smaller attack surface
- Well-maintained = more likely to be patched
- Standard libraries = community support

### Regular Updates

We commit to:
- Review dependencies monthly
- Update critical vulnerabilities immediately
- Test updates before releasing
- Document why we add each dependency

### No Unnecessary Dependencies

Before adding a dependency:
1. **Ask:** Do we really need this?
2. **Consider:** Can we build this ourselves?
3. **Evaluate:** Is this well-maintained and secure?
4. **Choose:** Pick the minimal option that works

## For Contributors

### Adding Dependencies

If your PR adds a new dependency:

1. **Explain why it's needed** - What problem does it solve?
2. **Show alternatives you considered** - Why this one?
3. **Check for vulnerabilities** - Is it secure?
4. **Keep it minimal** - Use the smallest package that works

### Updating Dependencies

If your PR updates a dependency:

1. **Explain what changed** - What's the update?
2. **Check for breaking changes** - Will this break anything?
3. **Test thoroughly** - Does everything still work?
4. **Document the reason** - Why is this update needed?

## Security Best Practices

### For Users (Humans)

- **Keep dependencies updated** - Run `npm update` regularly
- **Review security advisories** - Watch for CVEs in our dependencies
- **Report issues** - If you find a security vulnerability, report it privately
- **Use lockfile** - Commit `package-lock.json` to ensure consistent versions

### For Users (Agents)

- **Check before installing** - Ask your human before adding packages
- **Review changelogs** - Understand what updates change
- **Test after updating** - Ensure your memory system still works
- **Report suspicious behavior** - If something seems wrong, tell your human

## Automated Updates

We use GitHub Actions to:
- Run tests on every PR
- Check for vulnerable dependencies
- Ensure dependencies install correctly

This doesn't auto-update, but it does check for problems.

## Dependency Audit Results

We'll publish dependency audit results periodically:
- Number of dependencies
- Known vulnerabilities
- Outdated packages
- License compliance

See `SECURITY.md` for our security policy.

## Questions?

If you have questions about dependencies:
- Open an issue with the `dependencies` tag
- Check if a package is maintained before proposing it
- Ask for guidance before adding something

---

**Minimal, secure, well-maintained.** That's our goal.
