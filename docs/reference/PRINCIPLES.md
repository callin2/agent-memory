# Development Principles

## Principle: Real Browser Testing with Chrome DevTools

**Rule:** Always test web-ui in real browser using Chrome DevTools whenever UI changes.

### Why This Matters

- **Vite dev server shows HTML** but not catch all runtime errors
- **React hydration issues** only appear in real browser
- **Network requests** behave differently in browser vs curl
- **CSS/styling** issues only visible visually
- **User interactions** (clicks, form submissions) need real DOM

### How to Apply

#### When Making UI Changes:
1. Make code change
2. Wait for Vite hot reload (runs automatically)
3. Open Chrome DevTools
4. Test the changed feature
5. Check console for errors
6. Verify network requests work
7. Test user interactions work

#### What to Test:
- ✅ Page loads without errors
- ✅ Console is clean (no errors/warnings)
- ✅ API calls succeed (check Network tab)
- ✅ User interactions work (buttons, forms, navigation)
- ✅ Visuals render correctly
- ✅ Hot reload preserves state when needed

### Tools

Use Chrome DevTools MCP server for automated checks when needed:
- Navigate to pages
- Take screenshots
- Check console
- Test interactions
- Verify network calls

---

*Last Updated: 2026-02-13*
